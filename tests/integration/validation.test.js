'use strict';
const request = require('../helpers/createApp.js');

describe('Parameter validation — 400 responses', () => {
  it('GET /api/area-overview — missing town → 400', async () => {
    const res = await request.get('/api/area-overview');
    expect(res.status).toBe(400);
  });

  it('GET /api/resolve — missing q → 400', async () => {
    const res = await request.get('/api/resolve');
    expect(res.status).toBe(400);
  });

  it('GET /api/nearby-streets — missing lat → 400', async () => {
    const res = await request.get('/api/nearby-streets?lng=103.8&town=BEDOK');
    expect(res.status).toBe(400);
  });

  it('GET /api/nearby-streets — missing lng → 400', async () => {
    const res = await request.get('/api/nearby-streets?lat=1.3&town=BEDOK');
    expect(res.status).toBe(400);
  });

  it('GET /api/nearby-streets — missing town → 400', async () => {
    const res = await request.get('/api/nearby-streets?lat=1.3&lng=103.8');
    expect(res.status).toBe(400);
  });

  it('POST /api/geocode — no body → 400', async () => {
    const res = await request.post('/api/geocode').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/geocode — addresses is not an array → 400', async () => {
    const res = await request.post('/api/geocode').send({ addresses: 'not-an-array' });
    expect(res.status).toBe(400);
  });

  it('POST /api/geocode — 101 addresses exceeds limit → 400', async () => {
    const addresses = Array.from({ length: 101 }, (_, i) => ({ block: String(i), street_name: 'TEST ST' }));
    const res = await request.post('/api/geocode').send({ addresses });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exceeds limit/i);
  });

  it('GET /api/seo/metadata — missing route → 400', async () => {
    const res = await request.get('/api/seo/metadata');
    expect(res.status).toBe(400);
  });

  it('GET /api/private/project-overview — missing project → 400', async () => {
    const res = await request.get('/api/private/project-overview');
    expect(res.status).toBe(400);
  });

  it('GET /api/private/district-overview — missing district → 400', async () => {
    const res = await request.get('/api/private/district-overview');
    expect(res.status).toBe(400);
  });

  it('GET /api/nearby-hdb — missing lat → 400', async () => {
    const res = await request.get('/api/nearby-hdb?lng=103.8');
    expect(res.status).toBe(400);
  });

  it('GET /api/nearby-hdb — missing lng → 400', async () => {
    const res = await request.get('/api/nearby-hdb?lat=1.3');
    expect(res.status).toBe(400);
  });

  it('GET /api/nearby-hdb — non-Singapore coordinates → 400', async () => {
    const res = await request.get('/api/nearby-hdb?lat=0&lng=0');
    expect(res.status).toBe(400);
  });
});
