#!/usr/bin/env node
/**
 * Auto-increments ?v=N in public/index.html before a frontend deploy.
 * Run via: npm run deploy:frontend (called automatically).
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const match = html.match(/\?v=(\d+)/);
if (!match) {
  console.error('bump-version: could not find ?v=N in index.html');
  process.exit(1);
}

const oldVersion = parseInt(match[1], 10);
const newVersion = oldVersion + 1;

html = html.replace(/\?v=\d+/g, `?v=${newVersion}`);
fs.writeFileSync(indexPath, html);

// Keep CLAUDE.md in sync
const claudePath = path.join(__dirname, '..', 'CLAUDE.md');
if (fs.existsSync(claudePath)) {
  const claude = fs.readFileSync(claudePath, 'utf8');
  fs.writeFileSync(claudePath, claude.replace(/Current: `v=\d+`/, `Current: \`v=${newVersion}\``));
}

console.log(`bump-version: v=${oldVersion} → v=${newVersion}`);
