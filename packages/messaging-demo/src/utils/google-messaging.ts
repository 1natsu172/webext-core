import { defineWindowMessaging } from '@webext-core/messaging/page';

export interface GoogleMessagingProtocol {
  ping(): string;
  ping2(): {
    reactProps: {
        className: string;
        onClick: () => void;
    }[];
}
  fromInjected(): string;
  fromInjected2(): string;
}

export const googleMessaging = defineWindowMessaging<GoogleMessagingProtocol>({
  namespace: '@webext-core/messaging-demo/google',
  logger: {...console, debug: console.log}

});
