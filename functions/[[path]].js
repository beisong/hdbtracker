/**
 * WorthIt — Cloudflare Pages Function (Edge Handler)
 * 
 * Smart gatekeeper:
 * - Bot requests → fetch SEO metadata from Fly.io API, inject into HTML
 * - /robots.txt → serve robots.txt
 * - /sitemap.xml → generate from API
 * - Normal users → serve static SPA
 */

const API_BASE = 'https://worthit-api.fly.dev';
const SITE_URL = 'https://worthit.canlah.app';

// The API machine auto-stops when idle (fly.toml min_machines_running = 0), so a cold bot
// request can take well over 5s. Give it more room before declaring failure.
const META_TIMEOUT_MS = 8000;
const SITEMAP_TIMEOUT_MS = 5000;
const META_CACHE_TTL = 86400;

// Bots that only build link previews and never retry: they must still get a usable card.
const PREVIEW_BOT_PATTERNS = [
  /facebookexternalhit/i, /facebot/i, /twitterbot/i, /linkedinbot/i, /slackbot/i,
  /discordbot/i, /discordapp/i, /telegrambot/i, /whatsapp/i, /pinterest/i,
  /embedly/i, /skypeuripreview/i, /vkshare/i, /outbrain/i,
];

function isPreviewBot(userAgent) {
  return PREVIEW_BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}

const BOT_PATTERNS = [
  /googlebot/i, /google-inspectiontool/i, /bingbot/i, /yandexbot/i, /baiduspider/i, /duckduckbot/i,
  /slurp/i, /facebot/i, /facebookexternalhit/i, /twitterbot/i,
  /linkedinbot/i, /slackbot/i, /discordbot/i, /telegrambot/i,
  /whatsapp/i, /applebot/i, /semrushbot/i, /ahrefsbot/i,
  /mj12bot/i, /dotbot/i, /rogerbot/i, /seznambot/i,
  /developers\.google\.com\/\+\/web\/snippet/i, /pinterest/i,
  /embedly/i, /skypeuripreview/i, /outbrain/i, /vkshare/i,
  /discordapp/i,
  // AI / LLM crawlers — without these, deep routes (/hdb/*, /private/*, /district/*) serve the
  // empty SPA shell (no JS execution), so these bots index nothing. Listing them gives the same
  // server-rendered metadata + content_html as Googlebot.
  /gptbot/i, /oai-searchbot/i, /chatgpt-user/i, /claudebot/i, /claude-web/i, /anthropic-ai/i,
  /perplexitybot/i, /google-extended/i, /ccbot/i, /bytespider/i, /amazonbot/i,
  /applebot-extended/i, /cohere-ai/i, /diffbot/i, /meta-externalagent/i, /youbot/i, /petalbot/i,
];

function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}

// Known SPA route shapes (extension-less). Anything else gets a real 404 instead of the
// SPA shell, so junk URLs (/foo/bar/baz, /_headers) can't burn crawl budget as 200s.
// /about, /methodology and /data-sources are handled earlier via STATIC_PAGES.
const SPA_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/hdb\/[^/]+(?:\/[^/]+)?$/,
  /^\/bto$/,
  /^\/bto\/[^/]+$/,
  /^\/private\/[^/]+$/,
  /^\/district\/\d{1,2}$/,
  /^\/postal\/\d{6}$/,
  /^\/check$/,
  /^\/check\/\d{6}$/,
  /^\/compare\/[^/]+(?:\/[^/]+)?$/,
];

// Renamed pages → permanent redirect. Provisional Nov 2026 BTO slugs replaced by HDB's
// official project names once Annex A was published (2026-11-06).
const REDIRECTS = new Map([
  ['/bto/bedok-bayshore-i', '/bto/bayshore-oasis'],
  ['/bto/bedok-bayshore-ii', '/bto/bayshore-sails'],
  ['/bto/geylang-mattar', '/bto/merpati-meadow'],
  ['/bto/toa-payoh-caldecott', '/bto/toa-payoh-hillside'],
  ['/bto/tengah-garden-avenue', '/bto/plantation-dew'],
  ['/bto/yishun-chencharu', '/bto/chencharu-acres'],
  ['/bto/sembawang-north', '/bto/sembawang-anchor'],
]);

// Escape a value for use inside a double-quoted HTML attribute.
function escapeAttr(value) {
  return String(value).replace(/"/g, '&quot;');
}

// Inject SEO meta tags into HTML
function injectMeta(html, meta) {
  // Update title (never write "undefined" — a partial meta object keeps the static title)
  if (meta.title) {
    html = html.replace(
      /<title>[^<]*<\/title>/i,
      `<title>${meta.title}</title>`
    );
  }

  // Update or add meta description
  if (meta.description) {
    if (/<meta\s+name=["']description["']/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${escapeAttr(meta.description)}">`
      );
    } else {
      html = html.replace(
        '</head>',
        `<meta name="description" content="${escapeAttr(meta.description)}">\n</head>`
      );
    }
  }

  // Override robots directive (e.g. noindex for unresolved deep routes / soft-404s)
  if (meta.robots) {
    if (/<meta\s+name=["']robots["']/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']robots["'][^>]*>/i,
        `<meta name="robots" content="${meta.robots}">`
      );
    } else {
      html = html.replace(
        '</head>',
        `<meta name="robots" content="${meta.robots}">\n</head>`
      );
    }
  }

  // Update canonical
  if (meta.canonical) {
    if (/<link\s+rel=["']canonical["']/i.test(html)) {
      html = html.replace(
        /<link\s+rel=["']canonical["'][^>]*>/i,
        `<link rel="canonical" href="${meta.canonical}">`
      );
    } else {
      html = html.replace(
        '</head>',
        `<link rel="canonical" href="${meta.canonical}">\n</head>`
      );
    }
  }

  // Update og:title
  if (meta.og_title) {
    if (/<meta\s+property=["']og:title["']/i.test(html)) {
      html = html.replace(
        /<meta\s+property=["']og:title["'][^>]*>/i,
        `<meta property="og:title" content="${escapeAttr(meta.og_title)}">`
      );
    }
  }

  // Update og:description
  if (meta.og_description) {
    if (/<meta\s+property=["']og:description["']/i.test(html)) {
      html = html.replace(
        /<meta\s+property=["']og:description["'][^>]*>/i,
        `<meta property="og:description" content="${escapeAttr(meta.og_description)}">`
      );
    }
  }

  // Update og:url
  if (meta.canonical) {
    if (/<meta\s+property=["']og:url["']/i.test(html)) {
      html = html.replace(
        /<meta\s+property=["']og:url["'][^>]*>/i,
        `<meta property="og:url" content="${meta.canonical}">`
      );
    }
  }

  // Update og:image (keep existing as default, edge function can override if needed)
  // The default og:image in index.html already points to og-image.png, so no update needed

  // Inject JSON-LD (replace existing seo-jsonld if present, or add new)
  if (meta.json_ld) {
    // Remove existing seo-jsonld
    html = html.replace(
      /<script type="application\/ld\+json" id="seo-jsonld">[\s\S]*?<\/script>/i,
      ''
    );
    html = html.replace(
      '</head>',
      `<script type="application/ld+json" id="seo-jsonld">${meta.json_ld}</script>\n</head>`
    );
  }

  return html;
}

// Replace the static seo-content section with bot-specific content when available
function injectContent(html, meta) {
  if (!meta.content_html) return html;
  return html.replace(
    /<section[^>]+id=["']seo-content["'][^>]*>[\s\S]*?<\/section>/i,
    meta.content_html
  );
}

// Fetch page metadata, memoized in the edge cache per route so a sleeping API machine only
// affects the first crawl of a route per data center, not every crawler request.
async function fetchSeoMetadata(route, waitUntil) {
  const cacheKey = new Request(`${SITE_URL}/__seo-meta?route=${encodeURIComponent(route)}`, { method: 'GET' });
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;

  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return await hit.json();
    } catch (err) {}
  }

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), META_TIMEOUT_MS);
  try {
    const metaResp = await fetch(`${API_BASE}/api/seo/metadata?route=${encodeURIComponent(route)}`, {
      headers: { 'User-Agent': 'WorthIt-Edge/1.0' },
      signal: controller.signal,
    });
    const meta = await metaResp.json();
    if (!meta || !meta.title) throw new Error('incomplete metadata payload');

    // Only cache complete payloads — a partial object must not be replayed to crawlers.
    if (cache) {
      const store = cache.put(cacheKey, new Response(JSON.stringify(meta), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${META_CACHE_TTL}`,
        },
      })).catch(err => {});
      if (waitUntil) waitUntil(store); else await store;
    }

    return meta;
  } finally {
    clearTimeout(abortTimer);
  }
}

async function proxyApi(request, url) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  // Overwrite (not append) so clients can't spoof the IP the feedback rate limiter keys on.
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  try {
    const upstream = await fetch(`${API_BASE}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
    });
    // fetch() already decoded the body; a stale Content-Encoding would make the runtime
    // re-compress regardless of what the client accepts. Let Cloudflare negotiate instead.
    const respHeaders = new Headers(upstream.headers);
    respHeaders.delete('content-encoding');
    respHeaders.delete('content-length');
    // API responses are data, not pages — keep them out of the index without blocking
    // crawler fetches (Googlebot's renderer fetches /api/* same-origin; a robots Disallow
    // would break rendering, an X-Robots-Tag does not).
    respHeaders.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: respHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'API unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
    });
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  // Same-origin API proxy: Googlebot's renderer won't reliably fetch from a separate,
  // reputation-less host (worthit-api.fly.dev), so the SPA calls /api/* here instead.
  if (url.pathname.startsWith('/api/')) {
    return proxyApi(request, url);
  }

  // Handle robots.txt — keep in sync with public/robots.txt
  if (url.pathname === '/robots.txt') {
    const aiBots = [
      'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai',
      'PerplexityBot', 'Google-Extended', 'CCBot', 'Amazonbot', 'Applebot-Extended',
      'cohere-ai', 'meta-externalagent', 'Bytespider',
    ];
    const body =
      `User-agent: *\nAllow: /\nDisallow: /_headers\n\n` +
      aiBots.map(b => `User-agent: ${b}\nAllow: /\n`).join('\n') +
      `\nSitemap: ${SITE_URL}/sitemap.xml\n`;
    return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
  }

  // Handle sitemap.xml
  if (url.pathname === '/sitemap.xml') {
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), SITEMAP_TIMEOUT_MS);
    try {
      const resp = await fetch(`${API_BASE}/api/seo/sitemap`, { signal: controller.signal });
      // e.g. 503 {"error":"Database not ready"} during a DB swap — never serve an empty
      // <urlset> with a 24h cache; fall through to the 503 + Retry-After branch instead.
      if (!resp.ok) throw new Error(`sitemap API returned ${resp.status}`);
      const data = await resp.json();
      if (!data || !Array.isArray(data.urls) || data.urls.length === 0) {
        throw new Error('sitemap API returned no urls');
      }
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${data.urls.map(u => `  <url>
    <loc>${u.url}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
      return new Response(xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch (err) {
      // 503 tells Google to retry later rather than treating it as a hard failure
      return new Response('Service temporarily unavailable', {
        status: 503,
        headers: { 'Retry-After': '3600' },
      });
    } finally {
      clearTimeout(abortTimer);
    }
  }

  // Standalone static content pages (E-E-A-T): serve their own HTML to everyone — bots and
  // humans alike — bypassing the SPA/index.html injection so crawlers get the real content.
  // Fetch the original clean URL (/about) from ASSETS — Pages resolves it to about.html.
  // (Requesting /about.html instead triggers Pages' .html→clean-URL 308 and loops.)
  const STATIC_PAGES = new Set(['/about', '/methodology', '/data-sources']);
  if (STATIC_PAGES.has(url.pathname.replace(/\/$/, ''))) {
    return env.ASSETS.fetch(request);
  }

  // Static assets (images, fonts, etc.) must bypass bot detection — bots fetching
  // og:image or favicon would otherwise receive HTML instead of the actual file.
  if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) {
    return env.ASSETS.fetch(request);
  }

  // Real 404 for unknown extension-less paths — nothing below this point should answer 200
  // to a URL the SPA can't route (deep routes that fail to resolve stay 200 + server noindex).
  const routePath = url.pathname.replace(/\/+$/, '') || '/';
  const redirectTo = REDIRECTS.get(routePath);
  if (redirectTo) {
    return Response.redirect(`${url.origin}${redirectTo}${url.search}`, 301);
  }
  if (!SPA_ROUTE_PATTERNS.some(re => re.test(routePath))) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  // For bots: inject SEO metadata
  if (isBot(userAgent)) {
    const route = url.pathname === '/' ? '/' : url.pathname;
    let meta;

    try {
      meta = await fetchSeoMetadata(route, context.waitUntil ? context.waitUntil.bind(context) : null);
    } catch (err) {
      console.error('SEO metadata unavailable:', err.message);

      // A 503 tells search engines to come back instead of indexing a broken duplicate.
      if (!isPreviewBot(userAgent)) {
        return new Response('Temporarily unavailable', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain; charset=UTF-8',
            'Retry-After': '300',
            'Cache-Control': 'no-store',
          },
        });
      }

      // Link-preview bots never retry — give them the real page with the static title intact.
      const assetResp = await env.ASSETS.fetch(new Request(new URL('/', url.toString())));
      let html = await assetResp.text();
      html = injectMeta(html, { canonical: `${SITE_URL}${url.pathname}` });
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
      });
    }

    const assetResp = await env.ASSETS.fetch(new Request(new URL('/', url.toString())));
    let html = await assetResp.text();

    html = injectMeta(html, meta);
    html = injectContent(html, meta);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // Normal users: serve SPA — try static asset first, fall back to index.html
  const staticResp = await env.ASSETS.fetch(request);
  // If the path has a file extension and we got a 200, return it (JS, CSS, images, etc.)
  if (staticResp.status === 200 || /\.[a-z]{2,5}$/.test(url.pathname)) {
    return staticResp;
  }
  // SPA fallback: serve index.html for all other routes
  return env.ASSETS.fetch(new Request(new URL('/', url.toString())));
}
