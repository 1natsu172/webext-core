import { defineCustomEventMessaging } from '@webext-core/messaging/page';

export interface DuckduckgoMessagingProtocol {
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

export const duckduckgoMessaging = defineCustomEventMessaging<DuckduckgoMessagingProtocol>({
  namespace: '@webext-core/messaging-demo/duckduckgo',
  logger: {...console, debug: console.log}
});
