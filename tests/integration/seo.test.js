'use strict';
const request = require('../helpers/createApp.js');

describe('GET /api/seo/sitemap', () => {
  it('returns 200 with urls array', async () => {
    const res = await request.get('/api/seo/sitemap');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.urls)).toBe(true);
    expect(res.body.urls.length).toBeGreaterThan(0);
  });

  it('includes homepage URL', async () => {
    const res = await request.get('/api/seo/sitemap');
    const urls = res.body.urls.map(u => u.url);
    expect(urls).toContain('https://worthit.canlah.app/');
  });

  it('includes HDB town pages for fixture towns', async () => {
    const res = await request.get('/api/seo/sitemap');
    const urls = res.body.urls.map(u => u.url);
    expect(urls).toContain('https://worthit.canlah.app/hdb/bedok');
    expect(urls).toContain('https://worthit.canlah.app/hdb/toa-payoh');
  });

  it('includes private project pages for fixture projects', async () => {
    const res = await request.get('/api/seo/sitemap');
    const urls = res.body.urls.map(u => u.url);
    expect(urls).toContain('https://worthit.canlah.app/private/sky-habitat');
    expect(urls).toContain('https://worthit.canlah.app/private/the-canopy');
  });

  it('includes the static E-E-A-T content pages', async () => {
    const res = await request.get('/api/seo/sitemap');
    const urls = res.body.urls.map(u => u.url);
    expect(urls).toContain('https://worthit.canlah.app/about');
    expect(urls).toContain('https://worthit.canlah.app/methodology');
    expect(urls).toContain('https://worthit.canlah.app/data-sources');
  });
});

describe('Static content pages', () => {
  it('serves /about, /methodology, /data-sources with their own content', async () => {
    const about = await request.get('/about');
    expect(about.status).toBe(200);
    expect(about.text).toContain('About WorthIt');
    expect(about.text).toContain('rel="canonical" href="https://worthit.canlah.app/about"');

    const method = await request.get('/methodology');
    expect(method.status).toBe(200);
    expect(method.text).toContain('Deal Score');

    const data = await request.get('/data-sources');
    expect(data.status).toBe(200);
    expect(data.text).toContain('Not financial advice');
  });
});

describe('GET /api/seo/metadata', () => {
  it('returns 400 when route param is missing', async () => {
    const res = await request.get('/api/seo/metadata');
    expect(res.status).toBe(400);
  });

  it('returns metadata for homepage route /', async () => {
    const res = await request.get('/api/seo/metadata?route=/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('description');
    expect(res.body).toHaveProperty('json_ld');
  });

  it('returns metadata for HDB town route', async () => {
    const res = await request.get('/api/seo/metadata?route=/hdb/bedok');
    expect(res.status).toBe(200);
    expect(res.body.title.toLowerCase()).toContain('bedok');
  });

  it('returns metadata for district route', async () => {
    const res = await request.get('/api/seo/metadata?route=/district/11');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('title');
  });

  it('routes /hdb/<town>/<flat-type> to a distinct flat-type page', async () => {
    const res = await request.get('/api/seo/metadata?route=/hdb/bedok/4-room');
    expect(res.status).toBe(200);
    // Distinct from the plain town page: title carries the flat-type label
    expect(res.body.title).toContain('4 Room');
    expect(res.body.title.toLowerCase()).toContain('bedok');
    // Canonical stays within the town namespace (sub-path when data exists, town page when thin)
    expect(res.body.canonical).toContain('/hdb/bedok');
  });

  it('does not treat an unknown flat-type slug as a flat-type page', async () => {
    const res = await request.get('/api/seo/metadata?route=/hdb/bedok/not-a-type');
    expect(res.status).toBe(200);
    // Unknown second segment → falls through; should not produce a "Room"/"Executive" title
    expect(res.body.title).not.toContain('Room');
  });

  it('town page links to its flat-type pages and overlapping districts', async () => {
    const res = await request.get('/api/seo/metadata?route=/hdb/bedok');
    expect(res.status).toBe(200);
    expect(res.body.content_html).toContain('/hdb/bedok/4-room');
    expect(res.body.content_html).toContain('/district/16'); // Bedok → D16
  });

  it('WebPage JSON-LD carries a dateModified freshness signal', async () => {
    const res = await request.get('/api/seo/metadata?route=/hdb/bedok');
    const graph = JSON.parse(res.body.json_ld)['@graph'];
    const webpage = graph.find(n => n['@type'] === 'WebPage');
    expect(webpage.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps meta descriptions within the SERP snippet limit (<=160 chars)', async () => {
    for (const route of ['/hdb/bedok', '/hdb/bedok/4-room', '/private/sky-habitat', '/district/11']) {
      const res = await request.get(`/api/seo/metadata?route=${route}`);
      expect(res.body.description.length, `${route} description too long`).toBeLessThanOrEqual(160);
    }
  });

  it('marks unresolved deep routes as noindex (soft-404 guard)', async () => {
    const res = await request.get('/api/seo/metadata?route=/hdb/notarealtown');
    expect(res.body.robots).toBe('noindex, follow');
    expect(res.body.canonical).toBe('https://worthit.canlah.app/');
  });

  it('does not noindex a resolved page or the homepage', async () => {
    const town = await request.get('/api/seo/metadata?route=/hdb/bedok');
    expect(town.body.robots).toBeFalsy();
    const home = await request.get('/api/seo/metadata?route=/');
    expect(home.body.robots).toBeFalsy();
  });
});
