'use strict';
const request = require('../helpers/createApp.js');

describe('GET /api/towns', () => {
  it('returns 200 with towns and districts arrays', async () => {
    const res = await request.get('/api/towns');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.towns)).toBe(true);
    expect(Array.isArray(res.body.districts)).toBe(true);
  });

  it('contains BEDOK and TOA PAYOH', async () => {
    const res = await request.get('/api/towns');
    expect(res.body.towns).toContain('BEDOK');
    expect(res.body.towns).toContain('TOA PAYOH');
  });

  it('does not include private property projects as towns', async () => {
    const res = await request.get('/api/towns');
    expect(res.body.towns).not.toContain('SKY HABITAT');
    expect(res.body.towns).not.toContain('THE CANOPY');
  });
});

describe('GET /api/flat-types', () => {
  it('returns 200 with flat_types array', async () => {
    const res = await request.get('/api/flat-types');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.flat_types)).toBe(true);
  });

  it('contains the HDB flat types from the fixture', async () => {
    const res = await request.get('/api/flat-types');
    expect(res.body.flat_types).toContain('3 ROOM');
    expect(res.body.flat_types).toContain('4 ROOM');
  });
});
