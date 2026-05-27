'use strict';
const request = require('../helpers/createApp.js');

describe('GET /api/resolve', () => {
  it('returns 400 when q param is missing', async () => {
    const res = await request.get('/api/resolve');
    expect(res.status).toBe(400);
  });

  it('resolves BEDOK (exact match)', async () => {
    const res = await request.get('/api/resolve?q=BEDOK');
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
    expect(res.body.town).toBe('BEDOK');
  });

  it('resolves bedok (case-insensitive)', async () => {
    const res = await request.get('/api/resolve?q=bedok');
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
    expect(res.body.town).toBe('BEDOK');
  });

  it('returns resolved=false for unknown town', async () => {
    const res = await request.get('/api/resolve?q=NONEXISTENT+TOWN+XYZ');
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(false);
  });

  it.skip('6-digit postal code calls OneMap (external API — skip in CI)', async () => {
    // Would call https://www.onemap.gov.sg — skipped to avoid external dependency
    const res = await request.get('/api/resolve?q=560001');
    expect(res.status).toBe(200);
  });
});
