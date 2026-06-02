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
- ✅ Automated test suite — 127 tests, 9 files: Vitest + supertest + fixture SQLite; unit (helpers + frontend utils) + integration (all 15 API endpoints); fixed null-town bug in `/api/resolve` as part of writing tests (May 2026)
- ✅ SQL injection fix in `/api/private/project-overview` — parameterized `property_type` across all 5 queries (May 2026)
- ✅ Smoke test suite — 19 tests in `tests/smoke/` hitting live `worthit-api.fly.dev`; separate `vitest.smoke.config.js`; `npm run test:smoke` (live) + `npm run test:smoke-local` (localhost:3000) (May 2026)
- ✅ Pre-deploy test gate — `deploy`, `deploy:api`, `deploy:frontend` scripts all chain `npm test &&` so a failing test blocks the deploy (May 2026)
- ✅ Units switched from sqm to sqft — display-only conversion via `sqmToSqft()`/`psmToPsf()` helpers in `app.js`; chart data divided by 10.7639 before plotting; DB schema unchanged (May 2026)
- ✅ Frontend cache busting — `public/_headers` + `?v=2` query strings on all local assets; bump version on every JS/CSS deploy (May 2026)
- ✅ CLAUDE.md created — commands, architecture, units, cache busting procedure, Dockerfile note, testing gaps (May 2026)
- ✅ Map unavailable bug fixed — client was sending up to 200 addresses to `/api/geocode` but server cap is 100; introduced in commit `082d253`; fixed by capping client at 100 (May 2026)

- ✅ Test suite expanded to 158 tests (up from 127) (May 2026):
  - `addNearbyHDB()` geocode cap bug fixed (was 200, should be 100 — same silent failure as the original map bug)
  - Resolve regression tests guard the private-project-name-as-town routing bug
  - API contract tests: `avg_psm` in trend_data, `private_trend_data`, `hdb_trend_data` (directly tests the dataset_source bug), `project_coords`, `coordinates`, `price_per_sqm` for deal score, street filter path
  - `nearby-hdb` endpoint validation tests (was completely untested)
  - `sqmToSqft`/`psmToPsf` unit tests; geocode address-cap tests for both `load()` and `addNearbyHDB()`
- ✅ Private project search routing bug fixed — 55 projects containing town names (e.g. "THE EDEN AT TAMPINES", "BEDOK RESIDENCES") were incorrectly routed to HDB town pages; fixed in `/api/resolve` by removing `inputUpper.includes(t)` and adding word-boundary check to `t.includes(inputUpper)` (May 2026)
- ✅ psm→psf internal variable and ID renaming — magic number `10.7639` consolidated to helpers only; sort values, HTML IDs, and JS variable names all renamed to match display unit (May 2026)

## Map & Performance — Jun 2026

- ✅ Lease shown at top of all map popups (Jun 2026) — all 4 popup types display `Xy lease` in the subtitle line using most recent transaction's `remaining_lease_years`; null-safe (omitted if absent)
- ✅ Distance-based nearby HDB for private project map (Jun 2026):
  - Server (`/api/nearby-hdb`): replaced `street_name IN (...)` (radius-leaking) with exact `(block || '|' || street_name) IN (...)` pairs from `findNearbyHdbBlocks()`; dropped redundant `town` lookup; attaches `lat`/`lng` to each transaction from `hdb_block_coords` via `coordByKey`
  - Client (`addNearbyHDB()` in `map.js`): now synchronous; dropped `API.geocodeAddresses()` call entirely; uses pre-attached coords from server
  - New integration test file `tests/integration/nearby-hdb.test.js` (5 tests); updated unit tests — removed stale geocode-cap test, added 2 new tests; total: 163 tests

## UI & Infra Fixes — Jun 2026

- ✅ Share button added to navbar (beside dark mode toggle) — `#nav-share-btn` reuses `.theme-toggle` CSS; always visible at top of page (Jun 2026)
- ✅ Share icon updated — both navbar and results-section share buttons now use upload-arrow icon (`M4 12v8...` / `polyline 16 6 12 2 8 6`) (Jun 2026)
- ✅ Share function fixed — removed `title` + `text` fields from `navigator.share()` call; was leaking `--` placeholder text when no search had been done; now passes `{ url }` only (Jun 2026)
- ✅ `deploy:data` script hardened (Jun 2026):
  - Added `fly machines start e7845746c2d918 && sleep 5` at start — handles Fly.io free-tier auto-stop (machine sleeps when idle; SSH doesn't trigger auto-start like HTTP does)
  - Combined `mv` + `rm -f resale.db-wal resale.db-shm` in single SSH command — prevents stale WAL from corrupting reads after DB swap
- ✅ Live DB re-uploaded (Jun 2026) — production DB was missing all URA_PRIVATE data (138K rows); stale WAL caused `COUNT(*) = 371` instead of 370K; fixed by deleting WAL/SHM and restarting; autocomplete now works for private project names

## SEO / GSC Fixes — Jun 2026

- ✅ GSC "Alternate page with proper canonical" fix — bot fallback now injects correct path-based canonical when Fly.io unreachable
- ✅ GSC "Server error 5xx" fix — sitemap 500 → 503 with `Retry-After: 3600`
- ✅ 5s AbortController timeout on edge function metadata fetch — fast fail on Fly.io cold starts
- ✅ Sitemap `lastmod` — derived from `MAX(month)` in DB, added to all sitemap entries
- ✅ Homepage SEO town list → crawlable `<a>` links (was plain text)
- ✅ Twitter card image dimensions added (1200×630)
- ✅ og-image.png updated

## SEO Enhancement — COMPLETE (2026-05-29)

- ✅ HDB pages: FAQ JSON-LD with real prices by flat type + YoY direction; content_html with prices table + internal links to all 25 other towns
- ✅ Private project pages: EC detection (new launch vs MOP-reached via tx velocity); title tag "New EC Launch" or "MOP YYYY"; FAQPage with EC MOP Q&As; badge in content_html
- ✅ District pages: top-projects table, avg PSF in title, FAQPage with top project names
- ✅ Edge function `injectContent()` replaces static seo-content section with bot-specific HTML
- ✅ `fmtPrice()` / `fmtPsf()` helpers added (psm → psf via ÷10.7639)
- ✅ Deployed to production (May 2026)
- ✅ Added `Google-InspectionTool` to bot patterns — Rich Results Test now correctly gets injected JSON-LD
- ✅ Validated with Google Rich Results Test — FAQPage detected
- ⚠️ FAQ rich results deprecated by Google as of May 7, 2026 — FAQPage JSON-LD kept (harmless) but won't show rich result cards; BreadcrumbList + content injection still fully valuable
- 🔲 Submit sitemap to Google Search Console (manual — GSC → Sitemaps → `sitemap.xml`)

## Automation — Jun 2026 (WORKING)

- ✅ GitHub Actions workflow for automated data refresh — verified end-to-end (Jun 2026):
  - `.github/workflows/refresh-data.yml` — daily **03:00 SGT** cron (`0 19 * * *`) + `workflow_dispatch` manual trigger
  - Node 24; flyctl installed via `setup-flyctl@v1` + aliased to `fly`
  - Repo secrets: `URA_API_ACCESS_KEY` + `FLY_API_TOKEN` (**org token** via `fly tokens create org` — deploy tokens can't issue SSH certs)
  - To switch to weekly: change cron to `0 19 * * 0`
  - `deploy:data` updated: gzip-compress DB before SFTP (107MB→~21MB to avoid connection drops), `gunzip` on server, remote multi-step command wrapped in `sh -c '...'` (flyctl `--command` doesn't run a shell), `sleep` 5→10s
  - See activeContext.md "Automated Data Refresh" for full gotcha list

## What's Left to Build / Improve (Active)
- (no active items)

## What's Left to Build / Improve
- ✅ Automated tests — 127 tests, 9 test files (unit + integration) using Vitest + supertest (May 2026)
- ✅ SQL injection fix in `/api/private/project-overview` — replaced string-interpolated `property_type` with parameterized `?` + spread pattern across all 5 queries (May 2026)
- ✅ Input validation across all endpoints — string length caps, lat/lng Singapore bounding box check, geocode array size limit (100), district-summary list cap (30), district-overview format check (May 2026)
- ✅ Test coverage for client-server contract mismatches — geocode limit test, `TransactionMap.load()` and `addNearbyHDB()` address cap, API field shape contracts (May 2026)
- 🔲 Geocode cache size limits (prevent memory leak)
- 🔲 Database indexes for query performance
- 🔲 Server refactor (split monolithic `server/index.js` into modules)
- 🔲 Rate limiting on API endpoints
- 🔲 Google Search Console verification & submission
- ✅ Open Graph image (`og-image.png`) for social sharing
- 🔲 Cloudflare Cache API for sitemap caching at edge
- 🔲 Structured data testing & rich results validation
- ✅ Google Analytics 4 (GA4 tag `G-WGC8D0FRSQ` with SPA pageview tracking)
- ✅ GA4 custom events: search, view_results, click_outbound, search_failed, select_flat_type, filter_transactions, toggle_mrt, share (8 events via `App.track()` helper)

- ✅ Map color-coded deal score restored (Jun 2026) — `addNearbyHDB()` and `addNearbyProjects()` were using hardcoded blue/purple; now use `getValueStyle()` green→blue→red coloring based on price vs nearby median
- ✅ Postal code pinned block (Jun 2026) — searched block floated to top of transaction list via `pinnedBlock` in `applyTransactionFilters()`; block number parsed from `resolved.address`
- ✅ HDB block coordinates table (Jun 2026):
  - `scripts/hdb_blocks.csv` (739KB) — 12,442 blocks, trimmed from [BlueSkyLT/siteselect_sg](https://github.com/BlueSkyLT/siteselect_sg/blob/main/dataset/hdb.csv); 100% coverage of all 9,709 unique HDB addresses in transactions DB
  - `hdb_block_coords(block, street_name, lat, lng, postal)` table in SQLite — seeded from CSV in `download_data.py`; index on `(lat, lng)` for bounding-box queries
  - `seed_hdb_block_coords()` + `geocode_missing_hdb_blocks()` in `download_data.py` — seed on every full rebuild; incrementally geocode any new blocks via OneMap (350ms delay, same pattern as URA script)
  - Server seeds table on startup if missing via `seedHdbBlockCoords()` — opens writable connection, seeds from CSV, closes; readonly connection then reads it
  - `findNearbyHdbBlocks(lat, lng, radiusM=500)` in `server/index.js` — synchronous SQLite bounding-box query (no HTTP calls)
- ✅ Separate `/postal/<code>` URL route (Jun 2026) — postal code searches now push `/postal/523876` instead of `/hdb/tampines`; `handleUrlRoute()` handles direct navigation; `/api/seo/metadata` returns address-specific metadata for bots; sitemap unchanged (postal codes excluded)
- ✅ Private property postal code fix (Jun 2026) — `lastResolvedData` was missing `isPrivate: true` in the postal→private path, causing project transactions to scatter as circle markers instead of a pin popup; dead code `if (isPostalCode && ...)` inside `else if (!isPostalCode)` removed
- ✅ Distant private property markers fix (Jun 2026) — postal code searches skip `loadPrivateSummaryForTown` (which was loading all district private data regardless of distance); use `addNearbyProjects` from `/api/nearby-hdb` (550m bounding box) instead; town-name searches keep district-wide summary
- ✅ Distance-based postal code search (Jun 2026) — replaced entire Nominatim 9-point reverse-geocoding pipeline:
  - **Before**: postal code → `/api/nearby-streets` (9 async Nominatim HTTP calls + keyword street matching) → street names → `/api/area-overview` (filter by street names, entire streets included regardless of distance)
  - **After**: postal code → `/api/area-overview?lat=X&lng=Y` → `findNearbyHdbBlocks()` → filter by exact `(block || '|' || street_name)` pairs within 500m
  - Fixes two-cluster bug (523876): keyword fallback in `findDbStreets` was matching every "HOUGANG*" street across the whole town
  - Removed `/api/nearby-streets` endpoint, `findNearbyStreets()`, `nearbyStreetsCache`, `strict` param from `findDbStreets`; removed `getNearbyStreets()` from `api.js`; removed extra round-trip from `app.js`
  - Fallback: if `hdb_block_coords` returns nothing (e.g., edge of table coverage), falls back to single `street` param via `findDbStreets`

## Known Issues
1. **Memory leak potential**: Geocode cache (`Map`) has no size limit or eviction policy
2. **No DB indexes**: Large queries may be slow without proper indexing

## Evolution of Project Decisions
- Started as HDB-only tool, later expanded to include URA private property data
- Street matching evolved from simple prefix matching to multi-strategy system
- Nearby-block lookup evolved: simple street names → Nominatim 9-point reverse geocoding → `hdb_block_coords` distance query (no external API)
- Geocoding: OneMap primary + Nominatim fallback (for map display); `hdb_block_coords` for postal search radius
- npm scripts use cross-platform `scripts/run-python.js` wrapper
- DB seeding: tried SSH + Python on Fly.io → OOM kill → switched to local build + SFTP upload