'use strict';
const request = require('../helpers/createApp.js');

describe('GET /api/private/projects', () => {
  it('returns empty array when q is missing', async () => {
    const res = await request.get('/api/private/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
  });

  it('returns matching projects for query "SKY"', async () => {
    const res = await request.get('/api/private/projects?q=SKY');
    expect(res.status).toBe(200);
    const names = res.body.projects.map(p => p.project);
    expect(names).toContain('SKY HABITAT');
  });

  it('returns matching projects for partial lowercase query "canopy"', async () => {
    const res = await request.get('/api/private/projects?q=canopy');
    expect(res.status).toBe(200);
    const names = res.body.projects.map(p => p.project);
    expect(names).toContain('THE CANOPY');
  });

  it('returns empty array for unmatched query', async () => {
    const res = await request.get('/api/private/projects?q=NONEXISTENT');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
  });
});

describe('GET /api/private/project-overview', () => {
  it('returns 400 when project param is missing', async () => {
    const res = await request.get('/api/private/project-overview');
    expect(res.status).toBe(400);
  });

  it('returns 200 with correct shape for SKY HABITAT', async () => {
    const res = await request.get('/api/private/project-overview?project=SKY+HABITAT');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body).toHaveProperty('project');
    expect(res.body).toHaveProperty('prices_by_type');
    expect(res.body).toHaveProperty('price_trend');
    expect(res.body).toHaveProperty('trend_data');
    expect(res.body).toHaveProperty('recent_transactions');
    expect(res.body).toHaveProperty('price_percentiles');
  });

  it('returns found=false for unknown project', async () => {
    const res = await request.get('/api/private/project-overview?project=NO+SUCH+PROJECT');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
  });

  it('returns correct transaction count for SKY HABITAT', async () => {
    const res = await request.get('/api/private/project-overview?project=SKY+HABITAT');
    expect(res.body.recent_transactions.length).toBe(8);
  });
});

describe('GET /api/private/property-types', () => {
  it('returns 200 with non-empty property_types array', async () => {
    const res = await request.get('/api/private/property-types');
    expect(res.status).toBe(200);
    expect(res.body.property_types.length).toBeGreaterThan(0);
  });

  it('includes APARTMENT and CONDOMINIUM from fixture data', async () => {
    const res = await request.get('/api/private/property-types');
    const types = res.body.property_types.map(t => t.flat_type);
    expect(types).toContain('APARTMENT');
    expect(types).toContain('CONDOMINIUM');
  });
});

describe('GET /api/private/district-summary', () => {
  it('returns found=false when districts param is missing', async () => {
    const res = await request.get('/api/private/district-summary');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
  });

  it('returns found=true for district 11 (has fixture data)', async () => {
    const res = await request.get('/api/private/district-summary?districts=11');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body).toHaveProperty('top_projects');
    expect(res.body).toHaveProperty('summary');
  });

  it('top_projects includes SKY HABITAT for district 11', async () => {
    const res = await request.get('/api/private/district-summary?districts=11');
    const names = res.body.top_projects.map(p => p.project);
    expect(names).toContain('SKY HABITAT');
  });

  it('returns found=false for district with no data', async () => {
    const res = await request.get('/api/private/district-summary?districts=99');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
  });
});

describe('GET /api/private/district-overview', () => {
  it('returns 400 when district param is missing', async () => {
    const res = await request.get('/api/private/district-overview');
    expect(res.status).toBe(400);
  });

  it('returns 200 with correct shape for district 11', async () => {
    const res = await request.get('/api/private/district-overview?district=11');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('top_projects');
    expect(res.body).toHaveProperty('prices_by_type');
    expect(res.body).toHaveProperty('trend_data');
    expect(res.body).toHaveProperty('recent_transactions');
  });

  it('returns found=false for district with no data', async () => {
    const res = await request.get('/api/private/district-overview?district=99');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
  });
});
