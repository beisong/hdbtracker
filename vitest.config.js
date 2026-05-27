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
    exclude: ['**/node_modules/**', 'tests/smoke/**'],
    // smoke tests use vitest.smoke.config.js so they don't run in the default suite
  },
});
