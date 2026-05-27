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
});
