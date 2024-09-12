import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    web_accessible_resources: [
      {
        resources: ['google-injected.js'],
        matches: ['*://*.google.com/*'],
      },
    ],
  },
  runner: {
    startUrls: ['https://google.com/'],
    openConsole: true,
    openDevtools: true,
  },
});
