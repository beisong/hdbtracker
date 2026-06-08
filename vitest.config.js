import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';

// Single source of truth for the fixture DB path (cross-platform: os.tmpdir()).
const { FIXTURE_DB_PATH } = createRequire(import.meta.url)('./tests/fixtures/seed.js');

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./tests/setup/global.mjs'],
    env: {
      DB_PATH: FIXTURE_DB_PATH,
    },
    pool: 'forks',
    exclude: ['**/node_modules/**', 'tests/smoke/**'],
    // smoke tests use vitest.smoke.config.js so they don't run in the default suite
  },
});
