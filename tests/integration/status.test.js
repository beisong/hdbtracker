'use strict';
const request = require('../helpers/createApp.js');

describe('GET /api/status', () => {
  it('returns 200 with ok status and correct transaction count', async () => {
    const res = await request.get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.total_transactions).toBe(42);
    expect(res.body.latest_month).toBe('2025-05');
  });
});
