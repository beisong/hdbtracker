/**
 * WorthIt — API Configuration
 *
 * Always same-origin: local dev is served by Express directly, and in production
 * the Cloudflare Pages function (functions/[[path]].js) proxies /api/* to Fly.io.
 */
const API_BASE = '';

/**
 * CARTO basemap tile API key — required since Aug 2026, when CARTO started
 * watermarking unauthenticated requests to their free raster tile endpoint
 * (basemaps.cartocdn.com). Not a secret credential: CARTO's own quickstart
 * embeds this directly in public client-side tile URLs (like a Google Maps
 * JS key), rate-limited by CARTO's fair-use policy, not by keeping it hidden.
 * Get/rotate a free key at https://carto.com/basemaps/apikey.
 */
const CARTO_API_KEY = 'cb1_2njt_1_5a99d85fa900afd4e72c9414';
