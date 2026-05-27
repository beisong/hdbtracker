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
});
