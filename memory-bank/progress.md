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
- ✅ Fast initial page load (parallel API calls, no artificial delays)
- ✅ Logo links to homepage
- ✅ Clean navbar (removed data-status text)

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

- ✅ Flat type multi-select toggle (May 2026)
- ✅ CLAUDE.md with Memory Bank workflow
- ✅ Trend calculation fix — 3-month rolling avg instead of point-to-point single months (May 2026)
- ✅ Trend chart fixed for private/district — was showing flat line due to wrong field name (May 2026)
- ✅ Price trend metric switched to $/sqm across all search types — eliminates flat-size compositional bias (May 2026)
- ✅ Dual-line trend chart — HDB (blue) + Private (purple) shown together for town and district searches (May 2026)
- ✅ Fixed district-overview HDB query — wrong dataset_source value meant HDB data was always empty (May 2026)
- ✅ OneMap geocoding fallback in download_ura_data.py for projects missing SVY21 coords (May 2026)
- ✅ Fixed private project map — was passing empty array to TransactionMap.load (May 2026)
- ✅ Zero-downtime DB deploy — upload to .new, atomic mv, restart (May 2026)
- ✅ WAL checkpoint before DB upload — PRAGMA wal_checkpoint(TRUNCATE) ensures all writes are in main file (May 2026)
- ✅ Map deal score coloring fixed — `getValueStyle()` was computed but hardcoded blue was used; now wired up for both HDB and private markers (May 2026)
- ✅ Private marker visual differentiation — thick purple border (`weight:4`, `+2` radius) vs HDB thin white border; fill = deal score for both (May 2026)
- ✅ Deal score dot on mobile transaction cards — colored dot next to $/sqm, same green→blue→red scale as map (May 2026)
- ✅ Section jump bar (Charts/Map/Transactions) — mobile-only sticky pill strip inside results section (May 2026)
- ✅ Floating "New Search" FAB — appears after first search, scrolls to search input on tap (May 2026)
- ✅ Share button — `navigator.share()` with clipboard fallback + toast notification (May 2026)
- ✅ Card tap → map highlight — click handler on mobile cards for touch devices (May 2026)
- ✅ Map scroll-zoom disabled on mobile — `scrollWheelZoom: window.innerWidth >= 640` (May 2026)
- ✅ Empty state "Clear filters" button — resets all transaction filter controls (May 2026)
- ✅ Tiny text fix — `text-[10px]` → `text-xs` for type badges in transactions (May 2026)
- ✅ Map popup alignment fix — resolved min-width vs max-width conflict on mobile (May 2026)
- ✅ Map popup type shortening — `shortType()` helper for all 16 flat/property type values (May 2026)
- ✅ Mobile UI pass — nested scroll fix, filter bar 2-row layout, chart/map height, scroll hint fade, stat card overflow, keyboard scroll (May 2026)

## What's Left to Build / Improve
- 🔲 Automated tests
- 🔲 SQL injection fix in `/api/private/project-overview`
- 🔲 Input validation/sanitization across all endpoints
- 🔲 Geocode cache size limits (prevent memory leak)
- 🔲 Database indexes for query performance
- 🔲 Server refactor (split monolithic `server/index.js` into modules)
- 🔲 Rate limiting on API endpoints
- 🔲 Google Search Console verification & submission
- ✅ Open Graph image (`og-image.png`) for social sharing
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