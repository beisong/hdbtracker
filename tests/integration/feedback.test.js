'use strict';
const Database = require('better-sqlite3');
const request = require('../helpers/createApp.js');

// Tests run in order: the global-cap test fills the store, so it must stay last.
describe('POST /api/feedback — abuse limits', () => {
  it('honeypot: a filled "website" field returns ok without storing a row', async () => {
    const db = new Database(process.env.FEEDBACK_DB_PATH, { readonly: true });
    const before = db.prepare('SELECT COUNT(*) AS n FROM feedback').get().n;
    const res = await request.post('/api/feedback')
      .set('X-Forwarded-For', '203.0.113.1')
      .send({ message: 'spam', website: 'http://spam.example' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(db.prepare('SELECT COUNT(*) AS n FROM feedback').get().n).toBe(before);
    db.close();
  });

  it('per-IP limit: 6th submission within an hour from one IP → 429, other IPs unaffected', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request.post('/api/feedback')
        .set('X-Forwarded-For', '203.0.113.2')
        .send({ message: `hello ${i}` });
      expect(res.status).toBe(200);
    }
    const blocked = await request.post('/api/feedback')
      .set('X-Forwarded-For', '203.0.113.2')
      .send({ message: 'one too many' });
    expect(blocked.status).toBe(429);

    const other = await request.post('/api/feedback')
      .set('X-Forwarded-For', '203.0.113.3')
      .send({ message: 'different IP' });
    expect(other.status).toBe(200);
  });

  it('global cap: once 200 rows exist in the last 24h, any IP gets 429', async () => {
    const db = new Database(process.env.FEEDBACK_DB_PATH);
    const n = db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE created_at >= datetime('now', '-1 day')").get().n;
    const insert = db.prepare('INSERT INTO feedback (message) VALUES (?)');
    db.transaction(() => { for (let i = n; i < 200; i++) insert.run(`filler ${i}`); })();
    db.close();

    const res = await request.post('/api/feedback')
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ message: 'fresh IP, but the daily cap is full' });
    expect(res.status).toBe(429);
  });
});
