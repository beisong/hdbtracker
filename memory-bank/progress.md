# Progress: WorthIt

## What Works
- ✅ BTO Launches — `bto_projects` table (dual-seeded like `hdb_block_coords`) + `/api/bto/launches`, `/api/bto/projects`, `/api/bto/project-overview`; BTO project names searchable from the main search bar (exact-match resolve + autocomplete) with a project page showing flats/prices and a live BTO-vs-nearby-resale comparison; `/bto` + `/bto/<slug>` routes; SEO metadata + sitemap. June 2026 launch (7 projects) fully seeded; 4 other 2025/2026 launches are documented skeletons pending curation. (Aug 2026, built locally — **not yet committed/deployed**, 239 tests pass)
- ✅ Check My Price — `/api/valuation` Deal Score + fair-value calculator with chip-based UI, 3 entry points (postal search card, transaction-row 💰 buttons, `/check/<postal>?price=` deep links) (Jul 2026, deployed v=20)
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
- ✅ In-app feedback (navbar button → modal → `POST /api/feedback` → separate writable `feedback.db`; honeypot + 5/hr per-IP rate limit; captures route + user_agent)
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

## Map Completeness Fixes — Jul 2026 (DEPLOYED, v=20)

- ✅ `/api/area-overview` attaches lat/lng to all returned transactions (from `hdb_block_coords`) — client geocoding now fallback-only; 100-address cap no longer limits markers
- ✅ Per-block window query (`rn <= 3`, LIMIT 400) for block-filtered searches — every block with resale history within the radius gets a map marker
- ✅ Condo-marker race fixed — nearby-projects fetch chained after `TransactionMap.load()` resolves (`addNearbyProjects` no-ops on uninitialized map)
- ✅ `/api/nearby-hdb` private projects: true 800m haversine radius + `dist_m`, cap 20 → 40
- ✅ Test count: 213 → **217**; verified live at 523876: 162 tx / 54 unique blocks / 0 missing coords; 9 condos ≤ 752m

## Check My Price — Jul 2026 (DEPLOYED, v=20)

- ✅ `findNearbyHdbBlocks()` true-radius fix — haversine post-filter + `dist_m` attached, nearest-first; applies globally (postal search, nearby-hdb, valuation)
- ✅ `GET /api/valuation` — block facts (postal or block+street) + fair value / Deal Score / percentile from storey-adjusted nearby comps; confidence ladder 500m → 1000m → no-lease → town fallback
- ✅ Storey buckets lease-banded ±10y + factor clamp ±10% — fixes vintage bias (high floors ≠ new blocks)
- ✅ Frontend `#valuation-section` card — price + pre-filled chips (type/size/floor inferred from block history); entry via postal search, transaction-row 💰 buttons, `/check/<postal>?price=` deep links; GA4 events
- ✅ SEO — `/check` metadata branch + sitemap entry; per-postal check URLs noindexed
- ✅ Test count: 171 → **213** (16 valuation integration + new helper/parsePrice unit tests; fixture +12 Bedok North rows; 2 deliberate count-assertion updates)
- ✅ Deployed Jul 2026 (v=20) — 19 smoke tests pass; valuation + map fixes verified live

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

## DEPLOYED — Jun 2026 (full SEO batch live)

- ✅ All Jun 2026 SEO work below is **deployed** (`npm run deploy` → Fly API + Cloudflare Pages); cache **v=19**; live `latest_month` **2026-06**. Verified: town×flat-type bot injection (Googlebot), E-E-A-T pages 200, sitemap has 123 town×flat-type URLs + data-sources.
- ✅ Fixed E-E-A-T 308 redirect loop during deploy — edge now fetches the clean URL (`env.ASSETS.fetch(request)`) for `STATIC_PAGES` instead of `/x.html`.
- ⚠️ **Cloudflare blocks `ClaudeBot` + `PerplexityBot` at the zone level (403)** before the Pages Function runs (Bot Fight Mode / "Block AI bots"); `GPTBot`, `OAI-SearchBot`, `Googlebot`, `bingbot` pass (200). `BOT_PATTERNS`/robots.txt can't override this — **user action in Cloudflare dashboard** (Security → Bots / AI Crawl Control) if Claude/Perplexity access is wanted.

## E-E-A-T Content Pages — Jun 2026

- ✅ `/about`, `/methodology`, `/data-sources` — standalone static HTML trust pages (own meta/canonical/OG/JSON-LD; AboutPage+Org, TechArticle, Dataset). Honest, non-fabricated copy; accurate Deal Score / trend / percentile methodology; "Not financial advice" disclaimer + data provenance/limitations
- ✅ URL `/data-sources` (not `/data` — collides with existing `public/data/mrt_stations.json` via express.static)
- ✅ Served via edge `STATIC_PAGES` short-circuit (bots + humans) + Express routes for local/Fly; added to sitemap + footer nav; pages cross-link each other
- ✅ 171 tests pass (2 new); MRT asset `/data/*` unaffected; deployed Jun 2026 (v=19)
- Backlog remaining: ranking/best-of pages, comparison pages, Tailwind CDN→static CSS, off-site backlinks

## SEO Content Expansion — Jun 2026 (town×flat-type, freshness, Q&A, cross-links)

- ✅ Town × flat-type programmatic pages `/hdb/<town>/<flat-type>` — server metadata branch (per-type price/psf/range/YoY, unique title, WebPage+Breadcrumb+FAQ JSON-LD, content_html), ~123 sitemap URLs (cnt≥5 / 24mo), client routing + URL emission on single flat-type select; thin combos canonicalize to town page
- ✅ Freshness — `dateModified` on all WebPage nodes + visible "Data updated through <Month Year>" note
- ✅ Q&A prose (`faqsToHtml`) on town/town×type/private/district content_html — featured-snippet / AI-Overview bait (FAQ rich results deprecated but prose still works)
- ✅ Cross-linking — town→flat-type pages + overlapping districts; district→HDB towns
- ✅ 166 tests pass (5 new in `tests/integration/seo.test.js`); validated live; deployed Jun 2026 (v=19)
- 🔲 Backlog: ranking/best-of pages, comparison pages, About/methodology/data (E-E-A-T), Tailwind CDN→static CSS + font trim, off-site backlinks

## SEO Quick-Wins Pass — Jun 2026

Audit-driven, zero-regression fixes (Tailwind Play CDN migration deferred by user choice):
- ✅ AI/LLM crawlers added to `BOT_PATTERNS` (`functions/[[path]].js`) — GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot, Google-Extended, CCBot, Bytespider, Amazonbot, Applebot-Extended, etc. — so deep routes serve injected metadata + content instead of the empty SPA shell
- ✅ 28 crawlable `/district/NN` links added to homepage `#seo-content` (D01–D28 were sitemap-only / orphaned)
- ✅ robots.txt (edge + static) — explicit `Allow: /` blocks for major AI crawlers
- ✅ Resource hints — `preconnect` API origin + `dns-prefetch` jsdelivr/unpkg/tailwind
- ✅ `defer` on Chart.js + Leaflet (verified safe vs DOMContentLoaded init order)
- ✅ Structured data — homepage `Organization.logo` + `SoftwareApplication` node; richer static fallback JSON-LD (WebSite + Organization)
- ✅ Meta polish — `og:image:alt`, light/dark `theme-color`
- ✅ 162 tests pass; JSON-LD + bot metadata validated; deployed Jun 2026 (v=19)
- ⏭️ Deferred: replace Tailwind Play CDN with prebuilt static CSS (biggest CWV win, higher regression risk)

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
- ✅ Submitted sitemap to Google Search Console (Jun 2026)

## Automation — data refresh broke 4 Jul 2026, fixed 28 Aug 2026

- ⚠️ **`Refresh Data` failed every night 2026-07-04 → 2026-08-26** (last green run 2026-07-03). Production `resale.db` has been stale since then; it refreshes on the first successful run after the fix lands.
  - **Not an expired token** — `FLY_API_TOKEN` authenticated on every failed run (`fly machines start` succeeded).
  - Trigger: one transient `copy file: connection lost (12812288 bytes written)` during SFTP left a truncated `/data/resale.db.new.gz` on the Fly volume. The `&&` chain then skipped the `gunzip && mv` that consumes it, so every subsequent run died on `remote file ... already exists. flyctl sftp doesn't overwrite existing files for safety`.
  - **Fix**: `deploy:data` now runs `fly ssh console --command "rm -f /data/resale.db.new.gz /data/resale.db.new"` before the `sftp put` — idempotent, self-healing, and never touches the live `/data/resale.db`. **Local only — user handles the commit.**
  - Verify after commit: trigger `Refresh Data` from the Actions tab (or `gh workflow run "Refresh Data"`), then `gh run watch`.
  - Lesson: a `&&` chain that stages a file remotely must clear its own staging path first, or one dropped connection wedges the pipeline permanently.
  - `FLY_API_TOKEN` (org token) created ~Jun 2026, default ~1-year expiry → renew around **Jun 2027**.

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
- ✅ Google Search Console verification & sitemap submission (Jun 2026)
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



## Search Indexing Status (Sep 2026 — diagnosed via GSC)

**The organic-traffic problem is non-indexing, not on-page SEO.** Google Search Console data as of 2026-09-04:
- Homepage: `Crawled – currently not indexed`, last crawl **2026-05-29**
- `/hdb/tampines`: `URL is unknown to Google` (never crawled)
- Sitemap: 255 submitted / **0 indexed**; Google's copy was 3 months stale
- 3 impressions, 0 clicks across 94 days

Google's last crawl **predated the entire June 2026 SEO batch**, so the bot-injection, E-E-A-T pages, town×flat-type pages and meta work had never been seen. The on-page work isn't underperforming — it was unread. Root cause is zero external backlinks: Google won't spend crawl budget on a new subdomain nothing links to.

**Implication: adding more programmatic pages or meta tweaks will not help.** The bottleneck is off-site (see TODO below).

Fixed this pass:
- ✅ ~13 key pages manually submitted via GSC URL Inspection (homepage, E-E-A-T pages, `/bto`, `/check`, Nov 2026 BTO project pages — prioritised over town pages since BTO launch interest peaks pre-launch and competition on those names is ~zero)
- ✅ Sitemap resubmitted — Google re-downloaded within 1 second, replacing the stale May copy (426 URLs)
- ✅ IndexNow wired up (`scripts/indexnow-ping.js`, chained onto `deploy`/`deploy:frontend`) — all 426 URLs submitted to Bing/Yandex/DuckDuckGo/Naver/Seznam. Key file `public/a464a4c238872496dcaa8d33718f8e13.txt` **must never be deleted** (403 `SiteVerificationNotCompleted` without it). First submission 403s until IndexNow verifies the key file — it cleared in ~20s.
- ✅ Cloudflare Crawler Hints enabled (Caching → Configuration; independent Cloudflare-managed key, doesn't conflict). Note `cf-cache-status: DYNAMIC` on app HTML, so it may detect little — the deploy-chained ping is the reliable path.
- ✅ GSC Crawl Stats checked — clean, no Googlebot failures (Cloudflare is not blocking, unlike the earlier AI-bot incident)
- 🔲 **Recheck indexing ~2026-09-11** — did the requested crawls happen, did `Crawled – currently not indexed` flip?

**Querying GSC without the dashboard**: Composio CLI (`~/.local/bin/composio`) is logged in with Google Search Console + GitHub connected. Property `sc-domain:worthit.canlah.app`. Useful tools: `GOOGLE_SEARCH_CONSOLE_INSPECT_URL`, `..._SEARCH_ANALYTICS_QUERY`, `..._LIST_SITEMAPS`, `..._SUBMIT_SITEMAP`. No Bing toolkit exists in Composio — Bing Webmaster is dashboard-only (its bulk "Submit URLs" page is gone; IndexNow replaces it).

## TODO
Off-site backlinks are the single biggest ranking lever you have left, and unlike the on-page work it can't be automated — it's outreach and distribution. Here's a concrete playbook tailored to a Singapore property tool, ordered by effort-to-payoff.

Tier 1 — Do this week (easy, high-trust)

Free citation / directory links (foundational, every site should have these):
- 🔲 **data.gov.sg app showcase — OUTSTANDING, do this first.** WorthIt is built entirely on data.gov.sg's HDB resale dataset, which is exactly what their community/showcase listing exists for. A `.gov.sg` domain is the highest-trust backlink realistically available to this project, it's free, and the qualifying criteria are already met. Submit via the data.gov.sg site (look for the community/showcase or "built with our data" submission form); link the homepage plus a deep page such as `/hdb/tampines`.
- Product Hunt launch — schedule a Tuesday/Wednesday launch. Gets you a dofollow link + a traffic spike + often picked up by aggregators.
- BetaList, SaaSHub, AlternativeTo — list WorthIt as a free alternative to commercial property portals (PropertyGuru, 99.co, SRX). AlternativeTo in particular ranks well and sends qualified traffic.
- Google Business Profile isn't relevant (no physical location), skip it.

Your own footprint:
- Add the link to your GitHub profile/repo README, your LinkedIn, any personal site.

Tier 2 — Community seeding (where SG property buyers actually are)

These are nofollow mostly, but they drive real users + the discovery that leads to natural links:
- r/singaporefi and r/askSingapore — these communities constantly debate "is this flat overpriced." A genuinely helpful comment linking your Deal Score for a specific town reads as useful, not spammy. Don't drop-and-run; answer the actual question.
- HardwareZone EDMW / Money Mind forums — huge SG property-discussion threads.
- Seedly community (Singapore personal-finance) — they actively cover property tools and may feature you.
- Telegram SG property groups — share a specific town link, not the homepage.

Rule for all of these: link to the most relevant deep page (e.g. /hdb/tampines/4-room), never just the homepage. Deep links spread your crawl equity and convert better.

Tier 3 — Content/PR (slower, strongest links)

- HDB-questions Quora / SG finance blogs — offer a free data snapshot ("Cheapest towns by Deal Score, June 2026"). Bloggers like Seedly, Dollars and Sense, MoneySmart, Stacked Homes cover property data and cite tools that give them a story.
- Original-data angle — you're sitting on a unique asset: median PSF + your Deal Score across every town. Publish a short monthly "SG resale price index" post (could be one of the ranking/best-of pages in your backlog, task #5). Journalists and bloggers link to data sources, and your /data-sources E-E-A-T page makes you look citeable.
- HARO / Featured / journalist requests — respond to SG property/cost-of-living queries with a stat from your data + link.

What actually moves the needle

If I had to pick: ship the "best-of" ranking pages (backlog #5), then pitch that data to 2-3 SG finance blogs. A single link from Seedly or Stacked Homes outweighs 50 directory listings, and the ranking pages give people a concrete reason to link.

Two things to avoid: paid link farms / Fiverr backlink gigs (Google penalty risk), and mass-posting the same link across forums (gets you banned and flagged as spam).

Want me to draft (a) a Product Hunt listing, (b) a Reddit-ready comment template, or (c) start on the ranking/best-of pages that give bloggers something to cite?