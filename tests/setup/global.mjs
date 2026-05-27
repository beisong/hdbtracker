import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createFixtureDb, FIXTURE_DB_PATH } = require('../fixtures/seed.js');

let _cleanup;

export function setup() {
  const { cleanup } = createFixtureDb(FIXTURE_DB_PATH);
  _cleanup = cleanup;
}

export function teardown() {
  if (_cleanup) _cleanup();
}
