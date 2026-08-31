'use strict';
const request = require('../helpers/createApp.js');

describe('GET /api/bto/launches', () => {
  it('returns 200 with launches sorted newest-first', async () => {
    const res = await request.get('/api/bto/launches');
    expect(res.status).toBe(200);
    const ids = res.body.launches.map(l => l.launch_id);
    expect(ids[0]).toBe('2026-11');
  });

  it('project nesting shape includes flats array and total_units', async () => {
    const res = await request.get('/api/bto/launches');
    const june = res.body.launches.find(l => l.launch_id === '2026-06');
    const proj = june.projects.find(p => p.project === 'BEDOK VISTA CREST');
    expect(proj).toBeDefined();
    expect(proj.total_units).toBe(500);
    expect(proj.flats).toHaveLength(2);
  });

  it('upcoming project present with empty flats', async () => {
    const res = await request.get('/api/bto/launches');
    const nov = res.body.launches.find(l => l.launch_id === '2026-11');
    expect(nov.status).toBe('upcoming');
    const proj = nov.projects.find(p => p.project === 'TOA PAYOH SUMMIT');
    expect(proj).toBeDefined();
    expect(proj.flats).toHaveLength(0);
    expect(proj.total_units).toBe(0);
  });
});

describe('GET /api/bto/projects', () => {
  it('finds the project for query "vista"', async () => {
    const res = await request.get('/api/bto/projects?q=vista');
    expect(res.status).toBe(200);
    expect(res.body.projects.map(p => p.project)).toContain('BEDOK VISTA CREST');
  });

  it('returns empty array for short query', async () => {
    const res = await request.get('/api/bto/projects?q=v');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(0);
  });

  it('returns 400 for query over 200 chars', async () => {
    const res = await request.get('/api/bto/projects?q=' + 'a'.repeat(201));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/bto/project-overview', () => {
  it('returns 200 with comparison for BEDOK VISTA CREST', async () => {
    const res = await request.get('/api/bto/project-overview?project=BEDOK+VISTA+CREST');
    expect(res.status).toBe(200);
    const threeRoom = res.body.comparison.find(c => c.resale_flat_type === '3 ROOM');
    expect(threeRoom).toBeDefined();
    expect(threeRoom.comps_count).toBeGreaterThanOrEqual(5);
    expect(threeRoom.comps_basis).toBe('1000m');
    expect(threeRoom.resale_median).toBeGreaterThanOrEqual(279000);
    expect(threeRoom.resale_median).toBeLessThanOrEqual(300000);
    expect(threeRoom.discount_pct).toBeGreaterThan(0);
  });

  it('case-insensitive project lookup works', async () => {
    const res = await request.get('/api/bto/project-overview?project=bedok+vista+crest');
    expect(res.status).toBe(200);
    expect(res.body.project).toBe('BEDOK VISTA CREST');
  });

  it('returns 404 for unknown project', async () => {
    const res = await request.get('/api/bto/project-overview?project=NO+SUCH+BTO');
    expect(res.status).toBe(404);
  });

  it('upcoming project (no lat/lng, no flats) returns 200 with empty comparison, no crash', async () => {
    const res = await request.get('/api/bto/project-overview?project=TOA+PAYOH+SUMMIT');
    expect(res.status).toBe(200);
    expect(res.body.flats).toHaveLength(0);
    expect(res.body.comparison).toHaveLength(0);
  });

  it('returns 400 when project parameter is missing', async () => {
    const res = await request.get('/api/bto/project-overview');
    expect(res.status).toBe(400);
  });
});
