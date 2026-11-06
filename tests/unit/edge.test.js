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
    '/compare',
    '/compare/a/b/c',
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
    '/compare/bedok-vs-tampines',
    '/compare/bedok-vs-tampines/4-room',
  ])('does not 404 for valid route %s', async (pathname) => {
    const res = await onRequest(makeContext(pathname));
    expect(res.status).toBe(200);
  });

  it('301-redirects a renamed provisional BTO slug, keeping the query string', async () => {
    const res = await onRequest(makeContext('/bto/bedok-bayshore-ii/?utm_source=x', GOOGLEBOT));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://worthit.canlah.app/bto/bayshore-sails?utm_source=x');
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

describe('edge sitemap.xml', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

  it('returns 503 + Retry-After when the API returns 503 (DB swap)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Database not ready' }, 503)));
    const res = await onRequest(makeContext('/sitemap.xml'));
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('3600');
    expect(res.headers.get('cache-control')).toBeNull();
  });

  it('returns 503 when the API returns an empty urls list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ urls: [] })));
    const res = await onRequest(makeContext('/sitemap.xml'));
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('3600');
  });

  it('returns 503 when the API payload has no urls key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    const res = await onRequest(makeContext('/sitemap.xml'));
    expect(res.status).toBe(503);
  });

  it('passes an abort signal to the sitemap fetch', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('The operation was aborted'));
    vi.stubGlobal('fetch', fetchMock);
    const res = await onRequest(makeContext('/sitemap.xml'));
    expect(res.status).toBe(503);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('serves the sitemap with 200 when the API returns urls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      urls: [{ url: 'https://worthit.canlah.app/hdb/bedok', lastmod: '2026-11-01', changefreq: 'weekly', priority: 0.8 }],
    })));
    const res = await onRequest(makeContext('/sitemap.xml'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
    const xml = await res.text();
    expect(xml).toContain('<loc>https://worthit.canlah.app/hdb/bedok</loc>');
  });
});

describe('edge meta attribute escaping', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('escapes double quotes in description and og fields as &quot;', async () => {
    const html = INDEX_HTML.replace('</head>',
      '<meta property="og:title" content="x">\n<meta property="og:description" content="x">\n</head>');
    const meta = {
      title: 'Bedok HDB Resale | WorthIt',
      description: 'The "best" estate',
      og_title: 'Bedok "East"',
      og_description: 'Say "hi"',
      canonical: 'https://worthit.canlah.app/hdb/bedok',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify(meta),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    const res = await onRequest(makeContext('/hdb/bedok', GOOGLEBOT, html));
    expect(res.status).toBe(200);
    const out = await res.text();
    expect(out).toContain('<meta name="description" content="The &quot;best&quot; estate">');
    expect(out).toContain('<meta property="og:title" content="Bedok &quot;East&quot;">');
    expect(out).toContain('<meta property="og:description" content="Say &quot;hi&quot;">');
    expect(out).not.toContain('content="The "best"');
  });
});
