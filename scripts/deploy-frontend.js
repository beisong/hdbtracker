#!/usr/bin/env node
// Loads .env then runs wrangler deploy — works on both Mac and Windows.
require('dotenv').config();
const { spawnSync } = require('child_process');
const result = spawnSync(
  'npx',
  ['wrangler', 'pages', 'deploy', 'public', '--project-name=worthit'],
  { stdio: 'inherit', env: process.env, shell: true }
);
process.exit(result.status ?? 0);
