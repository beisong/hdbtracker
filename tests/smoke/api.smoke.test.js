'use strict';

// Targets the live API. Override with SMOKE_API_URL env var to test a different environment.
const BASE = process.env.SMOKE_API_URL || 'https://worthit-api.fly.dev';
const TIMEOUT = 15000;

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ─── Status ───────────────────────────────────────────────────────────────────
describe('GET /api/status', () => {
  it('returns 200 with live transaction count', async () => {
    const { status, data } = await get('/api/status');
    expect(status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.total_transactions).toBeGreaterThan(100000);
  }, TIMEOUT);
});

// ─── Reference data ───────────────────────────────────────────────────────────
describe('GET /api/towns', () => {
  it('returns known HDB towns', async () => {
    const { status, data } = await get('/api/towns');
    expect(status).toBe(200);
    expect(data.towns).toContain('BEDOK');
    expect(data.towns).toContain('TAMPINES');
    expect(data.towns).toContain('TOA PAYOH');
  }, TIMEOUT);

  it('does not include private project names', async () => {
    const { status, data } = await get('/api/towns');
    expect(status).toBe(200);
    expect(data.towns).not.toContain(null);
  }, TIMEOUT);
});

describe('GET /api/flat-types', () => {
  it('returns standard flat types', async () => {
    const { status, data } = await get('/api/flat-types');
    expect(status).toBe(200);
    expect(data.flat_types).toContain('3 ROOM');
    expect(data.flat_types).toContain('4 ROOM');
    expect(data.flat_types).toContain('5 ROOM');
  }, TIMEOUT);
});

// ─── Area overview ────────────────────────────────────────────────────────────
describe('GET /api/area-overview', () => {
  it('returns full shape for a known town', async () => {
    const { status, data } = await get('/api/area-overview?town=BEDOK');
    expect(status).toBe(200);
    expect(data.town_summary.total_transactions_12m).toBeGreaterThan(0);
    expect(Array.isArray(data.prices_by_type)).toBe(true);
    expect(Array.isArray(data.trend_data)).toBe(true);
    expect(Array.isArray(data.recent_transactions)).toBe(true);
    expect(data.price_percentiles).toHaveProperty('p50');
  }, TIMEOUT);

  it('missing town → 400', async () => {
    const { status } = await get('/api/area-overview');
    expect(status).toBe(400);
  }, TIMEOUT);
});

// ─── Resolve ──────────────────────────────────────────────────────────────────
describe('GET /api/resolve', () => {
  it('resolves a known town name', async () => {
    const { status, data } = await get('/api/resolve?q=TAMPINES');
    expect(status).toBe(200);
    expect(data.resolved).toBe(true);
    expect(data.town).toBe('TAMPINES');
  }, TIMEOUT);

  it('returns resolved:false for unknown query', async () => {
    const { status, data } = await get('/api/resolve?q=NOTAREALPLACE99999');
    expect(status).toBe(200);
    expect(data.resolved).toBe(false);
  }, TIMEOUT);

  it('missing q → 400', async () => {
    const { status } = await get('/api/resolve');
    expect(status).toBe(400);
  }, TIMEOUT);
});

// ─── Private property ─────────────────────────────────────────────────────────
describe('GET /api/private/projects', () => {
  it('returns matching projects for a known query', async () => {
    const { status, data } = await get('/api/private/projects?q=sky');
    expect(status).toBe(200);
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('returns empty array for no query', async () => {
    const { status, data } = await get('/api/private/projects');
    expect(status).toBe(200);
    expect(data.projects).toEqual([]);
  }, TIMEOUT);
});

describe('GET /api/private/project-overview', () => {
  it('returns full shape for a known project', async () => {
    const { status, data } = await get('/api/private/project-overview?project=SKY+HABITAT');
    expect(status).toBe(200);
    expect(data.found).toBe(true);
    expect(data.project.total_transactions).toBeGreaterThan(0);
    expect(Array.isArray(data.recent_transactions)).toBe(true);
    expect(Array.isArray(data.trend_data)).toBe(true);
  }, TIMEOUT);

  it('missing project → 400', async () => {
    const { status } = await get('/api/private/project-overview');
    expect(status).toBe(400);
  }, TIMEOUT);
});

describe('GET /api/private/district-overview', () => {
  it('returns overview for district 11', async () => {
    const { status, data } = await get('/api/private/district-overview?district=11');
    expect(status).toBe(200);
    expect(data.found).toBe(true);
    expect(Array.isArray(data.recent_transactions)).toBe(true);
  }, TIMEOUT);

  it('missing district → 400', async () => {
    const { status } = await get('/api/private/district-overview');
    expect(status).toBe(400);
  }, TIMEOUT);
});

// ─── SEO ──────────────────────────────────────────────────────────────────────
describe('GET /api/seo/sitemap', () => {
  it('returns sitemap with live town URLs', async () => {
    const { status, data } = await get('/api/seo/sitemap');
    expect(status).toBe(200);
    expect(Array.isArray(data.urls)).toBe(true);
    expect(data.urls.some(u => u.url.includes('/hdb/bedok'))).toBe(true);
  }, TIMEOUT);
});

describe('GET /api/seo/metadata', () => {
  it('returns metadata for home route', async () => {
    const { status, data } = await get('/api/seo/metadata?route=/');
    expect(status).toBe(200);
    expect(typeof data.title).toBe('string');
    expect(typeof data.description).toBe('string');
  }, TIMEOUT);

  it('returns metadata for a town route', async () => {
    const { status, data } = await get('/api/seo/metadata?route=/hdb/bedok');
    expect(status).toBe(200);
    expect(data.title.toLowerCase()).toContain('bedok');
  }, TIMEOUT);

  it('missing route → 400', async () => {
    const { status } = await get('/api/seo/metadata');
    expect(status).toBe(400);
  }, TIMEOUT);
});
