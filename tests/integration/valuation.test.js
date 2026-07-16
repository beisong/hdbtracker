'use strict';
const request = require('../helpers/createApp.js');

// Fixture: postal 460100 = Blk 100 BEDOK NORTH ST 1 (3 ROOM, 65 sqm, lease ~67y,
// storeys 01–12). Blocks 100/200/500/700/900 sit within ~100m of each other,
// giving 17 3-ROOM comps in the last 12 months → high confidence.
describe('GET /api/valuation', () => {
  describe('validation', () => {
    it('400 when neither postal nor block+street given', async () => {
      const res = await request.get('/api/valuation');
      expect(res.status).toBe(400);
    });

    it('400 for a non-6-digit postal', async () => {
      const res = await request.get('/api/valuation?postal=abc');
      expect(res.status).toBe(400);
    });

    it('400 for an out-of-range price', async () => {
      const res = await request.get('/api/valuation?postal=460100&price=999');
      expect(res.status).toBe(400);
    });

    it('400 for an out-of-range area_sqm', async () => {
      const res = await request.get('/api/valuation?postal=460100&price=300000&area_sqm=5000');
      expect(res.status).toBe(400);
    });

    it('found:false for an unknown postal', async () => {
      const res = await request.get('/api/valuation?postal=999999');
      expect(res.status).toBe(200);
      expect(res.body.found).toBe(false);
    });
  });

  describe('block facts (no price)', () => {
    it('returns subject + block_facts for a known postal', async () => {
      const res = await request.get('/api/valuation?postal=460100');
      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.subject.block).toBe('100');
      expect(res.body.subject.street_name).toBe('BEDOK NORTH ST 1');
      expect(res.body.subject.town).toBe('BEDOK');
      expect(res.body.valuation).toBeUndefined();
    });

    it('infers flat types, areas and storey ranges from block history', async () => {
      const res = await request.get('/api/valuation?postal=460100');
      const types = res.body.block_facts.flat_types;
      expect(types).toHaveLength(1);
      expect(types[0].flat_type).toBe('3 ROOM');
      expect(types[0].areas).toEqual([65]);
      expect(types[0].storey_ranges).toContain('01 TO 03');
    });

    it('infers remaining lease from the newest transaction, adjusted for elapsed time', async () => {
      const res = await request.get('/api/valuation?postal=460100');
      // Blk 100 newest tx: 2025-04, lease 67y; fixture data runs to 2025-05 → ~66.9y
      const lease = res.body.block_facts.remaining_lease_years;
      expect(lease).toBeGreaterThan(60);
      expect(lease).toBeLessThanOrEqual(67);
    });

    it('resolves by block + street as well', async () => {
      const res = await request.get('/api/valuation?block=100&street=BEDOK+NORTH+ST+1');
      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.subject.postal).toBe('460100');
    });
  });

  describe('valuation (with price)', () => {
    it('returns a full valuation with sane fair-value math', async () => {
      const res = await request.get('/api/valuation?postal=460100&price=290000');
      expect(res.status).toBe(200);
      const v = res.body.valuation;
      expect(v).toBeTruthy();
      // 3-room comps are ~$279k–300k, all 65 sqm → fair value in that band
      expect(v.fair_value).toBeGreaterThan(270000);
      expect(v.fair_value).toBeLessThan(310000);
      expect(v.fair_low).toBeLessThanOrEqual(v.fair_value);
      expect(v.fair_high).toBeGreaterThanOrEqual(v.fair_value);
      expect(v.deal_score).toBeGreaterThanOrEqual(0);
      expect(v.deal_score).toBeLessThanOrEqual(100);
      expect(['Good deal', 'Fair price', 'Premium']).toContain(v.verdict);
    });

    it('uses nearby comps at 500m with high confidence when the pool is deep', async () => {
      const res = await request.get('/api/valuation?postal=460100&price=290000');
      const v = res.body.valuation;
      expect(v.radius_m).toBe(500);
      expect(v.comps_used).toBeGreaterThanOrEqual(15);
      expect(v.confidence).toBe('high');
      expect(v.lease_filtered).toBe(true);
    });

    it('excludes same-town blocks outside the radius from the comp pool', async () => {
      // BEDOK SOUTH AVE 1 (4 ROOM) is ~1.7km away — a 4 ROOM check on Blk 100
      // must not find those as 500m comps and falls back to the town pool
      const res = await request.get('/api/valuation?postal=460100&price=430000&flat_type=4+ROOM&area_sqm=90');
      const v = res.body.valuation;
      expect(v).toBeTruthy();
      expect(v.radius_m).toBe(null);
      expect(v.confidence).toBe('low');
    });

    it('comps carry dist_m, sorted nearest first', async () => {
      const res = await request.get('/api/valuation?postal=460100&price=290000');
      const comps = res.body.valuation.comps;
      expect(comps.length).toBeGreaterThan(0);
      for (const c of comps) expect(typeof c.dist_m).toBe('number');
      for (let i = 1; i < comps.length; i++) {
        expect(comps[i].dist_m).toBeGreaterThanOrEqual(comps[i - 1].dist_m);
      }
    });

    it('scores a clear underprice as a good deal and a clear overprice as premium', async () => {
      const low = await request.get('/api/valuation?postal=460100&price=240000');
      const high = await request.get('/api/valuation?postal=460100&price=340000');
      expect(low.body.valuation.deal_score).toBeGreaterThanOrEqual(70);
      expect(low.body.valuation.verdict).toBe('Good deal');
      expect(high.body.valuation.deal_score).toBeLessThan(45);
      expect(high.body.valuation.verdict).toBe('Premium');
      expect(low.body.valuation.percentile_rank).toBeLessThan(high.body.valuation.percentile_rank);
    });
  });

  describe('SEO', () => {
    it('serves generic metadata for /check and noindexes per-postal variants', async () => {
      const base = await request.get('/api/seo/metadata?route=/check');
      expect(base.status).toBe(200);
      expect(base.body.title).toContain('Deal Score');
      expect(base.body.robots ?? null).toBeNull();

      const deep = await request.get('/api/seo/metadata?route=/check/460100');
      expect(deep.body.robots).toBe('noindex, follow');
      expect(deep.body.canonical).toBe('https://worthit.canlah.app/check');
    });

    it('includes /check in the sitemap', async () => {
      const res = await request.get('/api/seo/sitemap');
      const urls = res.body.urls.map(u => u.url);
      expect(urls).toContain('https://worthit.canlah.app/check');
    });
  });
});
