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

// Inject SEO meta tags into HTML
function injectMeta(html, meta) {
  // Update title
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${meta.title}</title>`
  );

  // Update or add meta description
  if (meta.description) {
    if (/<meta\s+name=["']description["']/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${meta.description.replace(/"/g, '"')}">`
      );
    } else {
      html = html.replace(
        '</head>',
        `<meta name="description" content="${meta.description.replace(/"/g, '"')}">\n</head>`
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
        `<meta property="og:title" content="${meta.og_title.replace(/"/g, '"')}">`
      );
    }
  }

  // Update og:description
  if (meta.og_description) {
    if (/<meta\s+property=["']og:description["']/i.test(html)) {
      html = html.replace(
        /<meta\s+property=["']og:description["'][^>]*>/i,
        `<meta property="og:description" content="${meta.og_description.replace(/"/g, '"')}">`
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

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  // Handle robots.txt — keep in sync with public/robots.txt
  if (url.pathname === '/robots.txt') {
    const aiBots = [
      'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai',
      'PerplexityBot', 'Google-Extended', 'CCBot', 'Amazonbot', 'Applebot-Extended',
      'cohere-ai', 'meta-externalagent', 'Bytespider',
    ];
    const body =
      `User-agent: *\nAllow: /\n\n` +
      aiBots.map(b => `User-agent: ${b}\nAllow: /\n`).join('\n') +
      `\nSitemap: ${SITE_URL}/sitemap.xml\n`;
    return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
  }

  // Handle sitemap.xml
  if (url.pathname === '/sitemap.xml') {
    try {
      const resp = await fetch(`${API_BASE}/api/seo/sitemap`);
      const data = await resp.json();
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${(data.urls || []).map(u => `  <url>
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
    }
  }

  // Static assets (images, fonts, etc.) must bypass bot detection — bots fetching
  // og:image or favicon would otherwise receive HTML instead of the actual file.
  if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) {
    return env.ASSETS.fetch(request);
  }

  // For bots: inject SEO metadata
  if (isBot(userAgent)) {
    try {
      const route = url.pathname === '/' ? '/' : url.pathname;
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 5000);
      const metaResp = await fetch(`${API_BASE}/api/seo/metadata?route=${encodeURIComponent(route)}`, {
        headers: { 'User-Agent': 'WorthIt-Edge/1.0' },
        signal: controller.signal,
      });
      clearTimeout(abortTimer);
      const meta = await metaResp.json();

      // Fetch the static index.html
      const assetResp = await env.ASSETS.fetch(new Request(new URL('/', url.toString())));
      let html = await assetResp.text();

      // Inject metadata and page-specific content
      html = injectMeta(html, meta);
      html = injectContent(html, meta);

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (err) {
      // API unreachable (e.g. Fly.io cold start) — still inject the correct canonical
      // from the URL path so Google doesn't mark this page as "Alternate with proper canonical"
      console.error('SEO injection failed:', err.message);
      const assetResp = await env.ASSETS.fetch(new Request(new URL('/', url.toString())));
      let html = await assetResp.text();
      html = injectMeta(html, { canonical: `${SITE_URL}${url.pathname}` });
      return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }
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
