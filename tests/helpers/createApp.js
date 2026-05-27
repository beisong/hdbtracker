'use strict';
// IMPORTANT: DB_PATH must be set before requiring server/index.js
// because it opens the database at module load time.
// This is guaranteed by the globalSetup + test.env in vitest.config.js
const { app } = require('../../server/index.js');
const supertest = require('supertest');

module.exports = supertest(app);
