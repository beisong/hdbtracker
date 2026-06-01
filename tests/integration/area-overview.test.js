'use strict';
const request = require('../helpers/createApp.js');

describe('GET /api/area-overview', () => {
  it('returns 400 when town param is missing', async () => {
    const res = await request.get('/api/area-overview');
    expect(res.status).toBe(400);
  });

  it('returns 200 with correct shape for a valid town', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('prices_by_type');
    expect(res.body).toHaveProperty('town_summary');
    expect(res.body).toHaveProperty('price_percentiles');
    expect(res.body).toHaveProperty('price_trend');
    expect(res.body).toHaveProperty('trend_data');
    expect(res.body).toHaveProperty('recent_transactions');
    expect(res.body).toHaveProperty('distribution');
  });

  it('town_summary counts all 10 BEDOK fixture rows (within 12 months)', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK');
    expect(res.body.town_summary.total_transactions_12m).toBe(10);
  });

  it('price_percentiles are ordered p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK');
    const pp = res.body.price_percentiles;
    expect(pp.p10).toBeLessThanOrEqual(pp.p25);
    expect(pp.p25).toBeLessThanOrEqual(pp.p50);
    expect(pp.p50).toBeLessThanOrEqual(pp.p75);
    expect(pp.p75).toBeLessThanOrEqual(pp.p90);
  });

  it('flat_type filter returns only 3 ROOM results', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK&flat_type=3+ROOM');
    expect(res.status).toBe(200);
    const types = res.body.prices_by_type.map(p => p.flat_type);
    expect(types).toContain('3 ROOM');
    expect(types).not.toContain('4 ROOM');
  });

  it('multi-select flat_type returns both 3 ROOM and 4 ROOM', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK&flat_type=3+ROOM,4+ROOM');
    expect(res.status).toBe(200);
    const types = res.body.prices_by_type.map(p => p.flat_type);
    expect(types).toContain('3 ROOM');
    expect(types).toContain('4 ROOM');
  });

  it('nonexistent town returns 200 with empty/zero summary', async () => {
    const res = await request.get('/api/area-overview?town=NONEXISTENT');
    expect(res.status).toBe(200);
    expect(res.body.town_summary.total_transactions_12m).toBe(0);
    expect(res.body.recent_transactions).toHaveLength(0);
  });

  it('trend_data is sorted by month ascending', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK');
    const months = res.body.trend_data.map(d => d.month);
    for (let i = 1; i < months.length; i++) {
      expect(months[i] >= months[i - 1]).toBe(true);
    }
  });

  it('returns data for lowercase town input', async () => {
    const res = await request.get('/api/area-overview?town=bedok');
    expect(res.status).toBe(200);
    expect(res.body.town).toBe('BEDOK');
  });

  // Contract: charts.js reads d.avg_psm from trend_data — if this field is renamed the chart breaks silently.
  it('trend_data entries have avg_psm field', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK');
    expect(res.body.trend_data.length).toBeGreaterThan(0);
    for (const entry of res.body.trend_data) {
      expect(entry).toHaveProperty('avg_psm');
      expect(typeof entry.avg_psm).toBe('number');
    }
  });

  // Contract: dual-line trend chart requires private_trend_data to be an array (can be empty).
  it('returns private_trend_data as an array', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK');
    expect(res.body).toHaveProperty('private_trend_data');
    expect(Array.isArray(res.body.private_trend_data)).toBe(true);
  });

  // Contract: $/sqft stat card reads prices_by_type[*].median_psm.
  it('prices_by_type entries have median_psm field', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK');
    expect(res.body.prices_by_type.length).toBeGreaterThan(0);
    for (const entry of res.body.prices_by_type) {
      expect(entry).toHaveProperty('median_psm');
    }
  });

  // Street filter path — fallback when no lat/lng is available (e.g. server-side resolve).
  it('street filter returns only transactions for that street', async () => {
    const res = await request.get('/api/area-overview?town=BEDOK&street=BEDOK+NORTH+ST+1');
    expect(res.status).toBe(200);
    expect(res.body.street_filtered).toBe(true);
    // Fixture: BEDOK NORTH ST 1 has only 3 ROOM (not 4 ROOM)
    const types = res.body.prices_by_type.map(t => t.flat_type);
    expect(types).toContain('3 ROOM');
    expect(types).not.toContain('4 ROOM');
  });

  // Distance-based filter — lat/lng postal code path using hdb_block_coords
  it('lat/lng filter returns only nearby blocks (not distant ones on same town)', async () => {
    // Fixture: BEDOK NORTH ST 1 blocks are at ~1.325, 103.930
    //          BEDOK SOUTH AVE 1 blocks are at ~1.310, 103.920 (~2km away)
    const res = await request.get('/api/area-overview?town=BEDOK&lat=1.3251&lng=103.9301');
    expect(res.status).toBe(200);
    expect(res.body.street_filtered).toBe(true);
    // Should only include BEDOK NORTH ST 1 (3 ROOM), not BEDOK SOUTH AVE 1 (4 ROOM)
    const types = res.body.prices_by_type.map(t => t.flat_type);
    expect(types).toContain('3 ROOM');
    expect(types).not.toContain('4 ROOM');
  });
});
