# Progress: WorthIt

## What Works
- ✅ HDB resale data download pipeline (Python → SQLite)
- ✅ URA private property data download pipeline
- ✅ Express.js server with full REST API
- ✅ HDB area overview endpoint with town/street/flat-type filtering
- ✅ Postal code resolution (OneMap → road → town matching)
- ✅ Street name abbreviation/expansion matching system
- ✅ Nearby streets discovery via Nominatim reverse geocoding
- ✅ Geocoding with OneMap primary + Nominatim fallback
- ✅ Private property project search and overview
- ✅ Price trend analysis (6m, 1y, 3y, 5y changes)
- ✅ Price distribution histograms
- ✅ Price percentiles (p10, p25, p50, p75, p90)
- ✅ Map visualization with transaction markers
- ✅ SPA frontend with Tailwind CSS + Chart.js
- ✅ Mobile-responsive design
- ✅ District code search with private property overview
- ✅ Town ↔ district mapping
- ✅ Server graceful startup without database

## Deployment Status

**Architecture:**
```
localhost:3000         → Express serves both frontend + API (local dev)
worthit.canlah.app     → Cloudflare Pages (static) — ✅ LIVE
worthit-api.fly.dev    → Fly.io (Express API + SQLite) — ✅ LIVE
```

**Completed:**
- ✅ Dockerfile, fly.toml, .dockerignore
- ✅ API_BASE config in `public/config.js` (auto-detects environment)
- ✅ CORS configured for cross-origin requests
- ✅ Fly.io app deployed (`worthit-api`)
- ✅ Database seeded (370K transactions, data through May 2026)
  - Built locally, uploaded via `fly ssh sftp put`
  - Fly.io free tier (256MB RAM) can't run Python download scripts
- ✅ Server graceful startup without database
- ✅ README with full deployment guide and debugging commands
- ✅ `.gitignore` updated with `fly.ssh*`
- ✅ Frontend deployed to Cloudflare Pages via `npx wrangler pages deploy public --project-name=worthit`
- ✅ Custom domain: `worthit.canlah.app` (DNS on Cloudflare, domain from Porkbun, Universal SSL)
- ✅ Pushed to GitHub (`beisong/hdbtracker`)

**Remaining:**
- None — deployment is complete!

**Key commands:**
- Deploy API: `fly deploy`
- Deploy Frontend: `npx wrangler pages deploy public --project-name=worthit`
- Seed DB: `python scripts/download_data.py` → `fly ssh sftp put server/db/resale.db /data/resale.db` → `fly machine restart <id>`
- Update monthly: Re-run download locally → re-upload via SFTP

## What's Left to Build / Improve
- 🔲 Automated tests
- 🔲 SQL injection fix in `/api/private/project-overview`
- 🔲 Input validation/sanitization across all endpoints
- 🔲 Geocode cache size limits (prevent memory leak)
- 🔲 Database indexes for query performance
- 🔲 Server refactor (split monolithic `server/index.js` into modules)
- 🔲 Rate limiting on API endpoints
- 🔲 Google Search Console verification & submission
- 🔲 Open Graph image (og:image) for social sharing
- 🔲 Cloudflare Cache API for sitemap caching at edge
- 🔲 Structured data testing & rich results validation
- ✅ Google Analytics 4 (GA4 tag `G-WGC8D0FRSQ` with SPA pageview tracking)

## Known Issues
1. **SQL injection**: `/api/private/project-overview` builds SQL with string interpolation for `property_type` filter
2. **Memory leak potential**: Geocode cache (`Map`) has no size limit or eviction policy
3. **No DB indexes**: Large queries may be slow without proper indexing

## Evolution of Project Decisions
- Started as HDB-only tool, later expanded to include URA private property data
- Street matching evolved from simple prefix matching to multi-strategy system
- Geocoding: OneMap primary + Nominatim fallback
- npm scripts use cross-platform `scripts/run-python.js` wrapper
- DB seeding: tried SSH + Python on Fly.io → OOM kill → switched to local build + SFTP upload