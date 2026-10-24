import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const { onRequest } = await import(pathToFileURL(join(here, '..', '..', 'functions', '[[path]].js')).href);

// Minimal request/context stubs — the 404 branch returns before any ASSETS access, and the
// valid-route branch is satisfied by an ASSETS stub that always answers 200.
function makeContext(pathname, ua = 'Mozilla/5.0', html = 'INDEX') {
  return {
    request: {
      url: `https://worthit.canlah.app${pathname}`,
      method: 'GET',
      headers: { get: (k) => (k.toLowerCase() === 'user-agent' ? ua : null) },
    },
    env: { ASSETS: { fetch: async () => new Response(html, { status: 200 }) } },
  };
}

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const TWITTERBOT = 'Twitterbot/1.0';

const INDEX_HTML = `<!doctype html><html><head>
<title>WorthIt — Singapore HDB Resale Prices</title>
<meta name="description" content="static description">
<link rel="canonical" href="https://worthit.canlah.app/">
</head><body><section id="seo-content">home content</section></body></html>`;

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

describe('edge bot metadata handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 503 + Retry-After to a crawler when metadata is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The operation was aborted')));
    const res = await onRequest(makeContext('/hdb/tampines', GOOGLEBOT, INDEX_HTML));
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('300');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('still serves a preview bot when metadata is unavailable, without an undefined title', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The operation was aborted')));
    const res = await onRequest(makeContext('/hdb/tampines', TWITTERBOT, INDEX_HTML));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<title>WorthIt — Singapore HDB Resale Prices</title>');
    expect(html).not.toContain('undefined');
    expect(html).toContain('rel="canonical" href="https://worthit.canlah.app/hdb/tampines"');
  });

  it('treats a partial metadata payload as a failure instead of serving a duplicate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ canonical: 'https://worthit.canlah.app/hdb/tampines' }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    const res = await onRequest(makeContext('/hdb/tampines', GOOGLEBOT, INDEX_HTML));
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('300');
  });

  it('keeps the static title for a preview bot receiving a partial payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ canonical: 'https://worthit.canlah.app/hdb/tampines' }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    const res = await onRequest(makeContext('/hdb/tampines', TWITTERBOT, INDEX_HTML));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('<title>undefined</title>');
    expect(html).toContain('<title>WorthIt — Singapore HDB Resale Prices</title>');
  });

  it('injects full metadata and page content for a crawler', async () => {
    const meta = {
      title: 'Tampines HDB Resale Price 2026 — $657 psf Avg | WorthIt',
      description: 'Tampines HDB resale prices: 2,171 sales in 12 months.',
      canonical: 'https://worthit.canlah.app/hdb/tampines',
      content_html: '<section id="seo-content"><h1>Tampines</h1></section>',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify(meta),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    const res = await onRequest(makeContext('/hdb/tampines', GOOGLEBOT, INDEX_HTML));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<title>Tampines HDB Resale Price 2026 — $657 psf Avg | WorthIt</title>');
    expect(html).toContain('<h1>Tampines</h1>');
    expect(html).toContain('rel="canonical" href="https://worthit.canlah.app/hdb/tampines"');
  });
});
