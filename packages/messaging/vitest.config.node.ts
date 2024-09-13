import { defineConfig, defaultInclude, defaultExclude, UserConfig } from 'vitest/config';

const config = {
  node: {
    test: {
      name: 'node',
      include: [...defaultInclude],
      exclude: [...defaultExclude, '**/*.browser.{test,spec}.ts'],
    },
  } satisfies UserConfig,
};

export default defineConfig(
  config.node,
);
