export default defineUnlistedScript(async () => {
  console.log('[google-injected.ts] Injected script loaded');

  googleMessaging.onMessage('ping', event => {
    console.log('[google-injected.ts] Received', event);
    return 'pong';
  });

  googleMessaging.onMessage('ping2', event => {
    console.log('[google-injected.ts] Received2', event);
    return 'pong2';
  });

  googleMessaging.sendMessage('fromInjected', undefined).then(x => {
    console.log('[google-injected.ts] Received:', x);
  });

  const res = await googleMessaging.sendMessage('fromInjected2', undefined);
  console.log('[google-injected.ts] Response:', res);
});
