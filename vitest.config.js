import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./tests/setup/global.mjs'],
    env: {
      DB_PATH: '/tmp/worthornot-test.db',
    },
    pool: 'forks',
  },
});
