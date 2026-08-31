'use strict';
const request = require('../helpers/createApp.js');

describe('GET /api/nearby-hdb', () => {
  // Fixture coords: BEDOK NORTH ST 1 blocks are at ~1.3250–1.3258, 103.9300–103.9308
  //                 BEDOK SOUTH AVE 1 blocks are at ~1.3100–1.3102, 103.9200–103.9202 (~1.7 km away)
  const NEAR_BEDOK_NORTH = { lat: 1.3251, lng: 103.9301 };

  it('returns 200 with transactions for a valid location', async () => {
    const res = await request.get(
      `/api/nearby-hdb?lat=${NEAR_BEDOK_NORTH.lat}&lng=${NEAR_BEDOK_NORTH.lng}`
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('transactions');
    expect(Array.isArray(res.body.transactions)).toBe(true);
    expect(res.body.transactions.length).toBeGreaterThan(0);
  });

  it('each transaction carries lat and lng', async () => {
    const res = await request.get(
      `/api/nearby-hdb?lat=${NEAR_BEDOK_NORTH.lat}&lng=${NEAR_BEDOK_NORTH.lng}`
    );
    expect(res.status).toBe(200);
    for (const tx of res.body.transactions) {
      expect(typeof tx.lat).toBe('number');
      expect(typeof tx.lng).toBe('number');
    }
  });

  it('only includes blocks within ~500 m radius — excludes distant blocks on same town', async () => {
    const res = await request.get(
      `/api/nearby-hdb?lat=${NEAR_BEDOK_NORTH.lat}&lng=${NEAR_BEDOK_NORTH.lng}`
    );
    expect(res.status).toBe(200);
    const streets = res.body.transactions.map(tx => tx.street_name);
    // BEDOK NORTH ST 1 blocks are within radius — must appear
    expect(streets).toContain('BEDOK NORTH ST 1');
    // BEDOK SOUTH AVE 1 blocks are ~1.7 km away — must be excluded
    expect(streets).not.toContain('BEDOK SOUTH AVE 1');
  });

  it('returns nearby_projects array', async () => {
    const res = await request.get(
      `/api/nearby-hdb?lat=${NEAR_BEDOK_NORTH.lat}&lng=${NEAR_BEDOK_NORTH.lng}`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.nearby_projects)).toBe(true);
  });

  it('returns empty transactions for a valid SG location with no nearby blocks', async () => {
    // Far south (Sentosa sea area) — no HDB blocks even after widening to 2000m
    const res = await request.get('/api/nearby-hdb?lat=1.249&lng=103.830');
    expect(res.status).toBe(200);
    expect(res.body.transactions).toEqual([]);
  });

  // Regression: nearby_projects must not be skipped just because no HDB blocks were
  // found nearby — a site can be HDB-sparse but condo-dense (e.g. a new coastal BTO
  // site). Previously the handler returned early on zero HDB blocks, before ever
  // computing nearby_projects, silently dropping real private projects.
  it('still returns nearby private projects when no HDB blocks are nearby', async () => {
    // SKY HABITAT (Bishan) is ~12.6km from the fixture's Bedok HDB blocks — none
    // nearby even after the 500m->1000m->2000m widening — but it should still surface.
    const res = await request.get('/api/nearby-hdb?lat=1.3521&lng=103.8198');
    expect(res.status).toBe(200);
    expect(res.body.transactions).toEqual([]);
    const names = res.body.nearby_projects.map(p => p.project);
    expect(names).toContain('SKY HABITAT');
  });
});
