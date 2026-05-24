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
