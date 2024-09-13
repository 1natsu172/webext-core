import { GenericMessenger, defineGenericMessanging } from './generic';
import { NamespaceMessagingConfig, Message, WindowMessage } from './types';

type WindowMessageTypeMap = Record<
  | 'REQUEST_TYPE'
  | 'RESPONSE_TYPE'
  | 'HANDSHAKE_START_TYPE'
  | 'HANDSHAKE_COMPLETE_TYPE'
  | 'TRANSFER_PORT_START_TYPE'
  | 'TRANSFER_PORT_COMPLETE_TYPE',
  string
>;
type WindowMessageType = (typeof windowMessageTypeMap)[keyof typeof windowMessageTypeMap];

const windowMessageTypeMap = {
  REQUEST_TYPE: '@webext-core/messaging/window',
  RESPONSE_TYPE: '@webext-core/messaging/window/response',
  HANDSHAKE_START_TYPE: '@webext-core/messaging/window/handshake-start',
  HANDSHAKE_COMPLETE_TYPE: '@webext-core/messaging/window/handshake-complete',
  TRANSFER_PORT_START_TYPE: '@webext-core/messaging/window/transfer-port-start',
  TRANSFER_PORT_COMPLETE_TYPE: '@webext-core/messaging/window/transfer-port-complete',
} as const satisfies WindowMessageTypeMap;

const {
  REQUEST_TYPE,
  RESPONSE_TYPE,
  TRANSFER_PORT_START_TYPE,
  TRANSFER_PORT_COMPLETE_TYPE,
  HANDSHAKE_START_TYPE,
  HANDSHAKE_COMPLETE_TYPE,
} = windowMessageTypeMap;

/**
 * Configuration passed into `defineWindowMessaging`.
 */
export interface WindowMessagingConfig extends NamespaceMessagingConfig {}

/**
 * For a `WindowMessenger`, `sendMessage` requires an additional argument, the `targetOrigin`. It
 * defines which frames inside the page should receive the message.
 *
 * > See <https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#targetorigin> for more
 * details.
 */
export type WindowSendMessageArgs = [targetOrigin?: string];

export type WindowMessenger<TProtocolMap extends Record<string, any>> = GenericMessenger<
  TProtocolMap,
  {},
  WindowSendMessageArgs
>;

/**
 * Returns a `WindowMessenger`. It is backed by the `window.postMessage` API.  It can be used to
 * communicate between:
 *
 * - Content script and website
 * - Content script and injected script
 *
 * @example
 * interface WebsiteMessengerSchema {
 *   initInjectedScript(data: ...): void;
 * }
 *
 * export const websiteMessenger = defineWindowMessaging<initInjectedScript>();
 *
 * // Content script
 * websiteMessenger.sendMessage("initInjectedScript", ...);
 *
 * // Injected script
 * websiteMessenger.onMessage("initInjectedScript", (...) => {
 *   // ...
 * })
 */
export function defineWindowMessaging<
  TProtocolMap extends Record<string, any> = Record<string, any>,
>(config: WindowMessagingConfig): WindowMessenger<TProtocolMap> {
  const namespace = config.namespace;
  const instanceId = crypto.randomUUID();

  let removeAdditionalListeners: Array<() => void> = [];

  const senderChannels = new Map<keyof TProtocolMap, MessageChannel>();
  const responderPorts = new Map<keyof TProtocolMap, MessagePort>();

  function getSenderChannel<TType extends keyof TProtocolMap>(
    type: TType,
  ): { senderPort: MessagePort; responderPort: MessagePort } {
    if (!senderChannels.has(type)) {
      senderChannels.set(type, new MessageChannel());
    }
    const channel = senderChannels.get(type) as MessageChannel;
    return { senderPort: channel.port1, responderPort: channel.port2 };
  }

  function getResponderPort<TType extends keyof TProtocolMap>(type: TType): MessagePort {
    const port = responderPorts.get(type);
    if (!port) {
      throw Error(`[messaging/window] Internal error: not found ${String(type)} responderPort.`);
    }
    return port;
  }

  function cleanupPort<TType extends keyof TProtocolMap>(type: TType) {
    senderChannels.get(type)?.port1.close();
    senderChannels.get(type)?.port2.close();
    responderPorts.get(type)?.close();
    senderChannels.delete(type);
    responderPorts.delete(type);
  }

  const transferPort = (message: Message<TProtocolMap, any>, targetOrigin?: string) => {
    const { senderPort, responderPort } = getSenderChannel(message.type);
    const removeCon = new AbortController();

    return new Promise(res => {
      let doneHandshake = false;
      window.addEventListener(
        'message',
        (event: MessageEvent<WindowMessage<TProtocolMap, any, WindowMessageType>>) => {
          if (
            event.data.type === HANDSHAKE_COMPLETE_TYPE &&
            event.data.namespace === namespace &&
            event.data.message.type === message.type &&
            event.data.instanceId !== instanceId
          ) {
            config.logger?.debug(
              `[messaging/window] handshake complete. {id=${event.data.message.id} type=${event.data.message.type}}`,
              event,
            );
            doneHandshake = true;
          }
        },
        { signal: removeCon.signal },
      );
      senderPort.addEventListener(
        'message',
        (event: MessageEvent<WindowMessage<TProtocolMap, any, WindowMessageType>>) => {
          if (
            event.data.type !== TRANSFER_PORT_COMPLETE_TYPE ||
            event.data.namespace !== namespace
          ) {
            return;
          }
          res(event);
          config.logger?.debug(
            `[messaging/window] succeed port transfer. {id=${event.data.message.id} type=${event.data.message.type}}`,
            event,
          );
          removeCon.abort('complete transfer responderPort.');
        },
        { signal: removeCon.signal },
      );
      senderPort.start();

      const startHandshake = () => {
        config.logger?.debug(
          `[messaging/window] try handshake. {id=${message.id} type=${message.type}}`,
        );
        window.postMessage(
          {
            type: HANDSHAKE_START_TYPE,
            message,
            senderOrigin: location.origin,
            namespace,
            instanceId,
          } satisfies WindowMessage<TProtocolMap, any, WindowMessageType>,
          targetOrigin ?? '*',
        );
      };
      const transferPort = () => {
        config.logger?.debug(
          `[messaging/window] try port transfer. {id=${message.id} type=${message.type}}`,
        );
        window.postMessage(
          {
            type: TRANSFER_PORT_START_TYPE,
            message,
            senderOrigin: location.origin,
            namespace,
            instanceId,
          } satisfies WindowMessage<TProtocolMap, any, WindowMessageType>,
          targetOrigin ?? '*',
          [responderPort],
        );
      };
      const pollingId = setInterval(() => {
        if (doneHandshake) {
          clearInterval(pollingId);
          transferPort();
          return;
        }
        startHandshake();
      }, 1e3);
    });
  };

  const sendWindowMessage = (message: Message<TProtocolMap, any>) =>
    new Promise(res => {
      const responseListener = (event: MessageEvent) => {
        config.logger?.debug('responseListener', message.id, responderPorts.get(message.type));
        if (event.data.type === RESPONSE_TYPE) {
          res(event.data.response);
          removeResponseListener();
        }
      };
      const { senderPort } = getSenderChannel(message.type);
      const removeResponseListener = () => {
        cleanupPort(message.type);
      };
      removeAdditionalListeners.push(removeResponseListener);
      senderPort.onmessage = responseListener;
      senderPort.postMessage({
        type: REQUEST_TYPE,
        message,
        senderOrigin: location.origin,
        namespace,
        instanceId,
      } satisfies WindowMessage<TProtocolMap, any, WindowMessageType>);
    });

  const messenger = defineGenericMessanging<TProtocolMap, {}, WindowSendMessageArgs>({
    ...config,

    async sendMessage(message, targetOrigin) {
      await transferPort(message, targetOrigin);
      return sendWindowMessage(message);
    },

    addRootListener(processMessage) {
      const responseMessage = async (
        event: MessageEvent<WindowMessage<TProtocolMap, any, WindowMessageType>>,
      ) => {
        if (
          event.data.type !== REQUEST_TYPE ||
          event.data.namespace !== namespace ||
          !responderPorts.has(event.data.message.type)
        ) {
          return;
        }

        const responderPort = getResponderPort(event.data.message.type);

        const response = await processMessage(event.data.message);
        responderPort.postMessage({ type: RESPONSE_TYPE, response });
      };

      const takeResponderPort = (
        event: MessageEvent<WindowMessage<TProtocolMap, any, WindowMessageType>>,
      ) => {
        if (
          event.data.namespace !== namespace ||
          event.data.instanceId === instanceId ||
          responderPorts.has(event.data.message.type)
        ) {
          return;
        }

        if (event.data.type === HANDSHAKE_START_TYPE) {
          config.logger?.debug(
            `[messaging/window] receive handshake message. {id=${event.data.message.id} type=${event.data.message.type}}`,
            event,
          );
          window.postMessage(
            {
              type: HANDSHAKE_COMPLETE_TYPE,
              message: event.data.message,
              senderOrigin: location.origin,
              namespace,
              instanceId,
            } satisfies WindowMessage<TProtocolMap, any, WindowMessageType>,
            event.origin ?? '*',
          );
        }

        if (event.data.type === TRANSFER_PORT_START_TYPE) {
          const responderPort = event.ports[0];
          responderPorts.set(event.data.message.type, responderPort);

          responderPort.onmessage = responseMessage;

          responderPort.postMessage({
            type: TRANSFER_PORT_COMPLETE_TYPE,
            message: event.data.message,
            senderOrigin: location.origin,
            namespace,
            instanceId,
          } satisfies WindowMessage<TProtocolMap, any, WindowMessageType>);
        }
      };

      window.addEventListener('message', takeResponderPort);
      return () => window.removeEventListener('message', takeResponderPort);
    },
  });

  return {
    ...messenger,
    removeAllListeners() {
      messenger.removeAllListeners();
      removeAdditionalListeners.forEach(removeListener => removeListener());
      removeAdditionalListeners = [];
      senderChannels.forEach((_, key) => {
        cleanupPort(key);
      });
    },
  };
}
