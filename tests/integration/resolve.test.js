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

  // Regression: project names containing a town word must NOT resolve to that town.
  // Before the fix, "BEDOK RESIDENCES".includes("BEDOK") was truthy → wrongly routed to HDB page.
  it('project name containing a town word → resolved=false', async () => {
    const res = await request.get('/api/resolve?q=BEDOK+RESIDENCES');
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(false);
  });

  // Partial prefix of a multi-word town must still resolve (the other direction).
  it('"TOA" resolves to TOA PAYOH (partial prefix match)', async () => {
    const res = await request.get('/api/resolve?q=TOA');
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
    expect(res.body.town).toBe('TOA PAYOH');
  });

  // Partial suffix of a multi-word town must also still resolve.
  it('"PAYOH" resolves to TOA PAYOH (partial word match)', async () => {
    const res = await request.get('/api/resolve?q=PAYOH');
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
    expect(res.body.town).toBe('TOA PAYOH');
  });

  it.skip('6-digit postal code calls OneMap (external API — skip in CI)', async () => {
    // Would call https://www.onemap.gov.sg — skipped to avoid external dependency
    const res = await request.get('/api/resolve?q=560001');
    expect(res.status).toBe(200);
  });
});
