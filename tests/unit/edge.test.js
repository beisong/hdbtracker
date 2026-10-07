import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const { onRequest } = await import(pathToFileURL(join(here, '..', '..', 'functions', '[[path]].js')).href);

// Minimal request/context stubs — the 404 branch returns before any ASSETS access, and the
// valid-route branch is satisfied by an ASSETS stub that always answers 200.
function makeContext(pathname, ua = 'Mozilla/5.0') {
  return {
    request: {
      url: `https://worthit.canlah.app${pathname}`,
      method: 'GET',
      headers: { get: (k) => (k.toLowerCase() === 'user-agent' ? ua : null) },
    },
    env: { ASSETS: { fetch: async () => new Response('INDEX', { status: 200 }) } },
  };
}

describe('edge 404 for unknown routes', () => {
  it.each([
    '/foo/bar/baz',
    '/_headers',
    '/check/abc',
    '/hdb',
    '/district/abc',
    '/postal/123',
  ])('returns 404 for %s', async (pathname) => {
    const res = await onRequest(makeContext(pathname));
    expect(res.status).toBe(404);
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it.each([
    '/',
    '/hdb/bedok',
    '/hdb/bedok/4-room',
    '/bto',
    '/bto/bedok-vista-crest',
    '/private/eco',
    '/district/16',
    '/postal/520123',
    '/check',
    '/check/520123',
  ])('does not 404 for valid route %s', async (pathname) => {
    const res = await onRequest(makeContext(pathname));
    expect(res.status).toBe(200);
  });

  it('serves robots.txt with the /_headers disallow', async () => {
    const res = await onRequest(makeContext('/robots.txt'));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Disallow: /_headers');
    expect(body).toContain('Sitemap: https://worthit.canlah.app/sitemap.xml');
  });
});
