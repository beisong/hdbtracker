import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createFixtureDb, FIXTURE_DB_PATH, removeFeedbackTestDb } = require('../fixtures/seed.js');

let _cleanup;

export function setup() {
  removeFeedbackTestDb();
  const { cleanup } = createFixtureDb(FIXTURE_DB_PATH);
  _cleanup = cleanup;
}

export function teardown() {
  if (_cleanup) _cleanup();
  removeFeedbackTestDb();
}
