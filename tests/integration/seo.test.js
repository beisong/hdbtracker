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

  it('resolves a private slug exactly before falling back to fuzzy matching', async () => {
    // "sky" fuzzy-matches SKY HABITAT (more transactions) — the exact slug must win
    const sky = await request.get('/api/seo/metadata?route=/private/sky');
    expect(sky.body.title).toMatch(/^SKY Condo Resale Price/);
    expect(sky.body.canonical).toBe('https://worthit.canlah.app/private/sky');
    const habitat = await request.get('/api/seo/metadata?route=/private/sky-habitat');
    expect(habitat.body.title).toMatch(/^SKY HABITAT /);
    // A slug that doesn't round-trip still finds the project via the fuzzy fallback
    const partial = await request.get('/api/seo/metadata?route=/private/habitat');
    expect(partial.body.title).toMatch(/^SKY HABITAT /);
  });

  it('pads short private titles with the district and formats psf with commas', async () => {
    const res = await request.get('/api/seo/metadata?route=/private/sky');
    expect(res.body.title).toBe('SKY Condo Resale Price — $929 psf, District 11 | WorthIt');
    const habitat = await request.get('/api/seo/metadata?route=/private/sky-habitat');
    expect(habitat.body.description).toMatch(/sales since 2024/);
    expect(habitat.body.description).toMatch(/\$900k–\$1\.22M/);
  });

  it('head=1 returns only head fields (no bot page content)', async () => {
    const res = await request.get('/api/seo/metadata?route=/hdb/bedok&head=1');
    expect(res.body.title).toMatch(/Bedok/);
    expect(res.body.canonical).toBe('https://worthit.canlah.app/hdb/bedok');
    expect(res.body.content_html).toBeUndefined();
    expect(res.body.json_ld).toBeUndefined();
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

describe('GET /api/seo/metadata — BTO', () => {
  it('/bto has a title mentioning BTO', async () => {
    const res = await request.get('/api/seo/metadata?route=/bto');
    expect(res.status).toBe(200);
    expect(res.body.title).toContain('BTO');
  });

  it('/bto/bedok-vista-crest has project title and content_html', async () => {
    const res = await request.get('/api/seo/metadata?route=/bto/bedok-vista-crest');
    expect(res.body.title).toContain('Bedok Vista Crest');
    expect(res.body.content_html).toBeTruthy();
  });

  it('post-MOP /bto/bedok-north-grove leads with its own resale prices', async () => {
    const res = await request.get('/api/seo/metadata?route=/bto/bedok-north-grove');
    expect(res.status).toBe(200);
    expect(res.body.title).toMatch(/Bedok North Grove Resale Prices/);
    expect(res.body.title).toMatch(/\(May 2015 BTO\)/);
    expect(res.body.content_html).toMatch(/Bedok North Grove Resale Transactions/);
    expect(res.body.content_html).toMatch(/100 BEDOK NORTH ST 1/);
    expect(res.body.json_ld).toMatch(/What is the resale price of flats at Bedok North Grove/);
  });

  it('pre-MOP /bto/bedok-vista-crest keeps the BTO price title', async () => {
    const res = await request.get('/api/seo/metadata?route=/bto/bedok-vista-crest');
    expect(res.body.title).toMatch(/BTO Price/);
    expect(res.body.content_html).not.toMatch(/Resale Transactions/);
  });

  it('studio-only /bto/golden-clover explains why there are no resales', async () => {
    const res = await request.get('/api/seo/metadata?route=/bto/golden-clover');
    expect(res.body.content_html).toMatch(/30-year lease and can't be resold on the open market/);
  });

  it('non-studio pages have no studio note', async () => {
    const res = await request.get('/api/seo/metadata?route=/bto/bedok-north-grove');
    expect(res.body.content_html).not.toMatch(/30-year lease/);
  });

  it('unknown /bto/nope is noindex', async () => {
    const res = await request.get('/api/seo/metadata?route=/bto/nope');
    expect(res.body.robots).toBe('noindex, follow');
  });
});

describe('GET /api/seo/sitemap — BTO', () => {
  it('includes /bto and the priced project, not the upcoming skeleton', async () => {
    const res = await request.get('/api/seo/sitemap');
    const urls = res.body.urls.map(u => u.url);
    expect(urls).toContain('https://worthit.canlah.app/bto');
    expect(urls).toContain('https://worthit.canlah.app/bto/bedok-vista-crest');
    expect(urls).not.toContain('https://worthit.canlah.app/bto/toa-payoh-summit');
  });
});

describe('API crawl control', () => {
  it('sets X-Robots-Tag noindex on /api responses (keeps APIs out of the index)', async () => {
    const res = await request.get('/api/status');
    expect(res.status).toBe(200);
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });
});

describe('public/robots.txt', () => {
  it('disallows /_headers and keeps the sitemap reference', () => {
    const fs = require('fs');
    const path = require('path');
    const txt = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'robots.txt'), 'utf8');
    expect(txt).toMatch(/User-agent: \*\nAllow: \/\nDisallow: \/_headers/);
    expect(txt).toMatch(/Sitemap: https:\/\/worthit\.canlah\.app\/sitemap\.xml/);
  });
});


describe('GET /api/seo/metadata — town comparison', () => {
  const BASE = 'https://worthit.canlah.app';
  const meta = (route) => request.get(`/api/seo/metadata?route=${encodeURIComponent(route)}`);

  it('returns a comparison title, description and self-canonical for a valid pair', async () => {
    const res = await meta('/compare/bedok-vs-toa-payoh');
    expect(res.status).toBe(200);
    expect(res.body.title).toContain('Bedok vs Toa Payoh');
    expect(res.body.canonical).toBe(`${BASE}/compare/bedok-vs-toa-payoh`);
    expect(res.body.robots ?? null).toBeNull();
    expect(res.body.description.length).toBeLessThanOrEqual(160);
    expect(res.body.content_html).toContain('<table');
    expect(res.body.content_html).toContain('href="/hdb/toa-payoh"');
  });

  it('uses true medians (not averages) in the comparison table and description', async () => {
    // Expected values straight from the fixture DB, using the same 12-month window as the server
    const Database = require('better-sqlite3');
    const db = new Database(process.env.DB_PATH, { readonly: true });
    const latest = db.prepare('SELECT MAX(month) AS m FROM transactions').get().m;
    let y = +latest.slice(0, 4), m = +latest.slice(5, 7) - 12;
    while (m <= 0) { m += 12; y--; }
    const prices = db.prepare(`SELECT resale_price FROM transactions WHERE town = 'BEDOK' AND resale_price IS NOT NULL
      AND month >= ? AND dataset_source != 'URA_PRIVATE'`).all(`${y}-${String(m).padStart(2, '0')}`).map(r => r.resale_price);
    db.close();
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    const mean = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
    const k = (p) => `$${Math.round(p / 1000)}k`;
    expect(k(med)).not.toBe(k(mean)); // fixture must tell the two apart for this test to mean anything

    const res = await meta('/compare/bedok-vs-toa-payoh');
    expect(res.body.content_html).toContain('Median Price');
    expect(res.body.content_html).not.toContain('Avg Price');
    expect(res.body.description).toContain(`Bedok ${k(med)}`);
    expect(res.body.content_html).toContain(`>${k(med)}<`);
  });

  it('gives the reversed order the same (alphabetical) canonical', async () => {
    const res = await meta('/compare/toa-payoh-vs-bedok');
    expect(res.status).toBe(200);
    expect(res.body.canonical).toBe(`${BASE}/compare/bedok-vs-toa-payoh`);
    expect(res.body.title).toContain('Bedok vs Toa Payoh');
  });

  it('supports a flat-type comparison with its own canonical', async () => {
    const res = await meta('/compare/toa-payoh-vs-bedok/4-room');
    expect(res.body.title).toContain('4 Room');
    expect(res.body.canonical).toBe(`${BASE}/compare/bedok-vs-toa-payoh/4-room`);
    expect(res.body.description.length).toBeLessThanOrEqual(160);
  });

  it('consolidates a flat type with no recent sales to the all-types comparison', async () => {
    const res = await meta('/compare/bedok-vs-toa-payoh/2-room');
    expect(res.body.canonical).toBe(`${BASE}/compare/bedok-vs-toa-payoh`);
  });

  it('supports three towns, sorted alphabetically', async () => {
    const res = await meta('/compare/toa-payoh-vs-punggol-vs-bedok');
    expect(res.body.canonical).toBe(`${BASE}/compare/bedok-vs-punggol-vs-toa-payoh`);
    expect(res.body.description.length).toBeLessThanOrEqual(160);
  });

  it.each([
    '/compare/bedok-vs-not-a-town',
    '/compare/bedok',
    '/compare/bedok-vs-bedok',
    '/compare/bedok-vs-toa-payoh/not-a-type',
    '/compare/bedok-vs-toa-payoh-vs-punggol-vs-bedok',
  ])('noindexes the invalid comparison %s', async (route) => {
    const res = await meta(route);
    expect(res.status).toBe(200);
    expect(res.body.robots).toBe('noindex, follow');
    expect(res.body.canonical).toBe(`${BASE}/`);
  });
});

describe('GET /api/seo/sitemap — town comparisons', () => {
  it('includes compare URLs in canonical (alphabetical) order', async () => {
    const res = await request.get('/api/seo/sitemap');
    const urls = res.body.urls.map(u => u.url);
    expect(urls).toContain('https://worthit.canlah.app/compare/bedok-vs-toa-payoh');
    expect(urls).not.toContain('https://worthit.canlah.app/compare/toa-payoh-vs-bedok');
    const compare = urls.filter(u => u.includes('/compare/'));
    expect(compare.length).toBeLessThanOrEqual(50);
    for (const u of compare) {
      const slugs = u.split('/compare/')[1].split('-vs-');
      expect(slugs).toEqual([...slugs].sort());
    }
  });
});
