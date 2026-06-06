#!/usr/bin/env node
// Print rows from the feedback DB (newest first).
//
//   node scripts/read-feedback.js [dbPath]
//
// dbPath resolution: argv[2] → FEEDBACK_DB_PATH env → /data/feedback.db (prod default).
// Run against production via:  npm run feedback   (fly ssh console -C "node /app/scripts/read-feedback.js")
// Run against your local DB via: npm run feedback:local

const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = process.argv[2] || process.env.FEEDBACK_DB_PATH || '/data/feedback.db';

if (!fs.existsSync(dbPath)) {
  console.log(`No feedback DB at ${dbPath} (no feedback submitted yet, or wrong path).`);
  process.exit(0);
}

const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT * FROM feedback ORDER BY id DESC').all();
db.close();

console.log(`${rows.length} feedback row(s) in ${dbPath}\n`);
console.log(JSON.stringify(rows, null, 2));
