export default defineUnlistedScript(async () => {
  console.log('[duckduckgo-injected.ts] Injected script loaded');

  duckduckgoMessaging.onMessage('ping', event => {
    console.log('[duckduckgo-injected.ts] Received', event);
    return 'pong';
  });

  duckduckgoMessaging.onMessage('ping2', event => {
    console.log('[duckduckgo-injected.ts] Received2', event);
 
    const props = [
      {
        "className": "ml-md",
        onClick: () => {
          console.log('THIS HANDLER CANNOT SERIALIZE')
        }
      }
    ]
  
    const ret = {reactProps: props};
    console.log("return value will be", ret)
  
    return ret
  });

  duckduckgoMessaging.sendMessage('fromInjected', undefined).then(res => {
    console.log('[duckduckgo-injected.ts] Response:', res);
  });

  const res2 = await duckduckgoMessaging.sendMessage('fromInjected2', undefined);
  console.log('[duckduckgo-injected.ts] Response2:', res2);
});
