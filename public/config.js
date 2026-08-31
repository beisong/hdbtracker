/**
 * WorthIt — API Configuration
 * 
 * Auto-detects environment:
 * - Local dev (localhost) → API_BASE = '' (same-origin, server serves both)
 * - Production (Cloudflare Pages) → API_BASE = 'https://hdbtracker-api.fly.dev'
 * 
 * When you set up a custom domain (api.yourdomain.com), update the URL below.
 */
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? ''
  : 'https://worthit-api.fly.dev';

/**
 * CARTO basemap tile API key — required since Aug 2026, when CARTO started
 * watermarking unauthenticated requests to their free raster tile endpoint
 * (basemaps.cartocdn.com). Not a secret credential: CARTO's own quickstart
 * embeds this directly in public client-side tile URLs (like a Google Maps
 * JS key), rate-limited by CARTO's fair-use policy, not by keeping it hidden.
 * Get/rotate a free key at https://carto.com/basemaps/apikey.
 */
const CARTO_API_KEY = 'cb1_2njt_1_5a99d85fa900afd4e72c9414';
