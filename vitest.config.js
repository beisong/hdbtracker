import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// Single source of truth for the fixture DB path (cross-platform: os.tmpdir()).
const { FIXTURE_DB_PATH } = createRequire(import.meta.url)('./tests/fixtures/seed.js');

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./tests/setup/global.mjs'],
    env: {
      DB_PATH: FIXTURE_DB_PATH,
      BTO_BLOCKS_PATH: fileURLToPath(new URL('./tests/fixtures/bto_project_blocks.json', import.meta.url)),
    },
    pool: 'forks',
    exclude: ['**/node_modules/**', 'tests/smoke/**'],
    // smoke tests use vitest.smoke.config.js so they don't run in the default suite
  },
});
