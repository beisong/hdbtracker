# Active Context: WorthIt

## Recent Changes (Jul 2026 — Map completeness fixes for postal searches) — NOT YET DEPLOYED

User report: postal-code searches didn't show all houses (HDB or condo) on the map. Three root causes fixed; 217 tests pass (4 new).

- **Coords attached server-side** — `/api/area-overview` now attaches `lat`/`lng` to every `recent_transactions` row: distance path reuses the `findNearbyHdbBlocks()` result (`coordByKey`), town/street paths do one `hdb_block_coords` lookup for the returned keys (misses stay `null` → client geocode fallback). `map.js load()` unchanged — pre-attached coords flow through its existing `preGeocoded` branch, killing the 100-address geocode cap + OneMap round-trip for HDB searches.
- **Per-block marker guarantee** — when `streetClause` is active (postal/street search), recent transactions use `ROW_NUMBER() OVER (PARTITION BY block, street_name ORDER BY month DESC, resale_price DESC) <= 3`, cap 400 — every block with resale history within 500m gets a marker (verified: 54 unique blocks at 523876, was recency-crowded before). Town searches keep newest-200. Blocks with zero resale history intentionally never appear.
- **Condo marker race fixed** — `renderResults` chains `API.getNearbyHDB()` AFTER `TransactionMap.load()` resolves; previously they raced and `addNearbyProjects()` silently no-ops when `this.map` is null → intermittently vanishing private markers. (Private-project search path uses synchronous `loadPreGeocoded` — never raced.)
- **Nearby projects true radius** — `/api/nearby-hdb` `nearby_projects`: bounding box widened to prefilter only; haversine ≤ **800m** decides inclusion, `dist_m` attached, cap raised 20 → **40**.
- **NOT touched**: `findNearbyHdbBlocks` stays HDB-only by design (private coords live in `project_coords`).

## Recent Changes (Jul 2026 — Check My Price: Deal Score & Fair Value calculator) — NOT YET DEPLOYED

Feature #1 from the product proposal (`FEATURE_PROPOSALS.md`). 213 tests pass (42 new). **Local only — user handles commit + deploy; `?v=` bumps automatically via `bump-version.js`.**

- **`findNearbyHdbBlocks()` is now true-radius (global change)**: SQL bounding box kept as index prefilter, exact haversine (`haversineM`) decides inclusion; rows carry `dist_m`, sorted nearest first. Existing postal searches no longer include corner blocks 500–707m away.
- **New `GET /api/valuation`** (`server/index.js`, before SEO endpoints):
  - Subject by `postal` OR `block`+`street`; without `price` → `block_facts` (flat types + counts, standard `floor_area_sqm` values, storey ranges, remaining lease) inferred from the block's full transaction history. Lease = newest tx `remaining_lease_years` − elapsed (fixture has no `lease_commence_date` column — do not use it).
  - With `price` (50k–5M): comps ladder 500m (lease ±10y) → 1000m → drop lease → town+type fallback; `MIN_COMPS=8`. Confidence: high (≥15 @500m w/ lease) / medium / low (town fallback).
  - Storey adjustment computed live (NOT the unused `storey_adjustments` table): town×type buckets over 24 months, **lease-banded ±10y** — without the lease band, high-floor buckets are dominated by newer blocks and overstate the premium (Tampines 5R test: +19% biased → +5.9% banded). `computeStoreyFactor` requires both buckets ≥10 tx, clamps to ±10%.
  - `deal_score = clamp(50 − 250×deviation, 0, 100)`; ≥70 Good deal, 45–69 Fair price, <45 Premium. Fair range = p25–p75 × area. Response includes ≤20 comps with `dist_m`.
  - New `_test` exports: `haversineM`, `dealScore`, `computeStoreyFactor`, `monthsBetween`.
- **Frontend — one `#valuation-section` card, three entry points** (`index.html`, `app.js`, `api.js`):
  1. Auto-shown after postal-code searches (`loadValuationCard({postal})` in `renderResults`), price is the only required input; flat type / size / storey render as pre-filled chips (rows hidden when single option).
  2. 💰 "Check" buttons on desktop transaction rows (new 9th column; colspan 8→9) and mobile cards → `checkLikeThis(tx)` prefills everything from the row (HDB rows only).
  3. `/check/<postal>?price=` deep link — `handleUrlRoute` runs the postal search and auto-submits; bare `/check` focuses the search input. `_pushCheckUrl` pushes the shareable URL after each check.
  - `parsePrice()` accepts `685k` / `$685,000` / `0.685m`. Score badge colors reuse the map's green→blue→red anchors (`_valScoreColor`). GA4: `valuation_open`/`valuation_check`/`valuation_result`. Card resets in `_onResultsShown()`.
- **SEO**: `/check` branch in `/api/seo/metadata` (generic title; per-postal `noindex, follow`, canonical → `/check`); `/check` added to sitemap (priority 0.6).
- **Fixture** (`tests/fixtures/seed.js`): +12 BEDOK NORTH ST 1 3-ROOM rows (17 comps → exercises the high-confidence path). Deliberate assertion updates: BEDOK 12m count 10→22 (`area-overview.test.js`), total 30→42 (`status.test.js`).
- New `tests/integration/valuation.test.js` (16 tests) + unit tests for the new helpers and `App.parsePrice`.

## Current State
The project is fully deployed and functional:
- **Backend API**: Running on Fly.io at `worthit-api.fly.dev` — 370K transactions, data through May 2026
- **Frontend**: ✅ Live at [worthit.canlah.app](https://worthit.canlah.app) via Cloudflare Pages (DNS on Cloudflare, domain from Porkbun)
- **Database**: SQLite on Fly.io persistent volume (`/data/resale.db`), built locally and uploaded via SFTP
- **Local dev**: `node server/index.js` serves both frontend and API on port 3000

## DEPLOYED (Jun 2026) + Cloudflare AI-bot block finding

- **Deployed** the full SEO batch via `npm run deploy` (API to Fly + frontend to Cloudflare Pages); cache bumped to **v=19**; live `latest_month` now **2026-06**. Verified live: town×flat-type bot injection works (Googlebot gets correct title + FAQ prose on `/hdb/tampines/4-room`), E-E-A-T pages serve 200.
- **Bugfix during deploy**: E-E-A-T pages first 308-looped — the edge requested `/about.html` from ASSETS, which Cloudflare Pages 308-redirects to the clean `/about` (re-entering the function → loop). Fixed by fetching the **original clean URL** (`env.ASSETS.fetch(request)`) for `STATIC_PAGES`; redeployed frontend. Now 200.
- **✅ RESOLVED — Cloudflare was blocking ClaudeBot + PerplexityBot (403)** via AI Crawl Control's "Block AI Bots" managed rule. User set **AI Crawl Control → Block AI Bots Scope → "Do not block (allow crawlers)"** on the `canlah.app` zone. Now verified live: ClaudeBot, PerplexityBot, GPTBot, OAI-SearchBot, Googlebot, bingbot all → 200, and ClaudeBot receives the full injected title + FAQ prose on `/hdb/tampines/4-room`. The `BOT_PATTERNS` + robots.txt AI-bot work is now effective end-to-end. (If AI crawlers ever need re-blocking, that's the dashboard setting to revisit.)

## Recent Changes (Jun 2026 — E-E-A-T content pages: About / Methodology / Data Sources)

Three standalone static trust pages (important for a YMYL/financial topic). 171 tests pass (2 new in `tests/integration/seo.test.js`).

- **New files**: `public/about.html`, `public/methodology.html`, `public/data-sources.html` — self-contained (own head/meta/canonical/OG/JSON-LD, Tailwind CDN + brand config, anti-FOUC dark mode, GA4, minimal nav + footer; no app.js dependency). Honest copy — does NOT fabricate owner/credentials; methodology accurately describes the real Deal Score (ratio = sale $/sqm ÷ nearby comparable median; green ≤0.70, blue ≈1.0, red ≥1.30), $/sqm trend with 3-month rolling avg, percentiles, sqft conversion (×10.7639). data-sources has the **"Not financial advice" disclaimer** + source provenance (data.gov.sg/URA/OneMap) + refresh cadence + limitations. JSON-LD: AboutPage+Organization, TechArticle+BreadcrumbList, Dataset+BreadcrumbList.
- **URL = `/data-sources`, NOT `/data`** — `public/data/` already exists (holds `mrt_stations.json` used by `map.js`); `express.static` 301-redirects `/data`→`/data/`, so the page would never serve. Used `/data-sources` (also a better slug). Filename `data-sources.html`.
- **Serving**: Cloudflare edge (`functions/[[path]].js`) — added `STATIC_PAGES` map short-circuit (BEFORE bot detection + the extension check) → serves the page HTML to bots AND humans, bypassing SPA/index.html injection. Local dev / Fly origin — Express routes added for `/about`, `/methodology`, `/data-sources` just before the `app.get('*')` catch-all.
- **Discovery**: added to sitemap (priority 0.5, monthly); footer nav links on `index.html` (About · Methodology · Data Sources); the three pages cross-link each other + home.
- **Deployed** Jun 2026 (v=19) — verified live.

## Recent Changes (Jun 2026 — SEO micro quick-wins: H1, meta length, soft-404)

- **Homepage H1** (`public/index.html`) — changed generic "HDB Area Market Overview" → keyword-aligned **"Singapore HDB & Condo Resale Prices"** (h1 is a strong on-page signal; now matches the title/OG).
- **Meta description length** — trimmed all dynamic `/api/seo/metadata` descriptions (town, town×flat-type, private, district) from 189–236 chars to **108–134** (Google truncates ~155). Same data, terser phrasing ("X sales in 12 months, avg $Y (Z psf)…").
- **Soft-404 guard** — `/api/seo/metadata` now sets `meta.robots = 'noindex, follow'` for deep routes (`/hdb|/private|/district|/postal`) that don't resolve (detected via canonical still == homepage), but only when `db` is present (never deindex valid pages mid-refresh). Edge `injectMeta()` (`functions/[[path]].js`) now honors `meta.robots` by replacing the `<meta name="robots">` tag. Prevents indexing of junk URLs like `/hdb/notarealtown` (was 200 + homepage canonical, no noindex).
- 169 tests pass (3 new in `tests/integration/seo.test.js`: description ≤160, noindex on unresolved, no-noindex on valid/homepage). Deployed Jun 2026 (v=19).

## Recent Changes (Jun 2026 — SEO content expansion: town×flat-type, freshness, Q&A, cross-links)

Second SEO batch (items 1/5/6/7 from the audit follow-up). All in `server/index.js` `/api/seo/metadata` + `/api/seo/sitemap` and `public/js/app.js` routing; 166 tests pass (5 new in `tests/integration/seo.test.js`).

- **Town × flat-type pages** `/hdb/<town>/<flat-type>` (e.g. `/hdb/tampines/4-room`) — biggest new organic-traffic surface (long-tail "4 room resale price tampines" queries):
  - New helpers near slug helpers: `FLAT_TYPE_SLUGS` / `SLUG_TO_FLAT_TYPE` (`2 ROOM`↔`2-room` … `EXECUTIVE`↔`executive`), `flatTypeLabel()` (titleCase), `fmtMonthYear()`, `faqsToHtml()`.
  - New metadata branch (matched BEFORE the single-segment `/hdb/` branch via `/^\/hdb\/[^/]+\/[^/]+$/`): per-type median/psf/range/avg-area + YoY, unique title (`4 Room HDB Resale Price in Tampines 2026 — $X psf`), WebPage+BreadcrumbList(3-level)+FAQPage JSON-LD, content_html with sibling-type links + back-to-town + nearby-district links + FAQ prose. If `cnt===0`, canonical consolidates to the town page (no thin pages).
  - Sitemap: adds town×flat-type URLs but only combos with `cnt>=5` over a 24-month window (HAVING filter) — ~123 extra URLs on prod.
  - Client (`app.js`): `handleUrlRoute()` regex now `/^\/hdb\/([^/]+)(?:\/([^/]+))?$/` and pre-selects the flat type; `updateSeoForSearch()` emits `/hdb/<town>/<ft>` when exactly ONE flat type is selected (so toggling a single flat-type button changes the URL + is shareable/indexable). Multi-select or All → plain `/hdb/<town>`.
- **Freshness signals (#5)** — `dateModified` (= `MAX(month)+'-01'`) added to every WebPage JSON-LD node (town, town×type, private, district); visible `freshnessNote` ("Data updated through <Month Year>…") appended to each content_html. Computed once near the top of the metadata handler (`latestMonth`/`dateModified`/`dataThrough`).
- **Q&A prose for featured snippets / AI Overviews (#6)** — `faqsToHtml(faqs)` renders the existing FAQ arrays as visible `<h3>`+prose (FAQ rich results are dead, but prose still wins snippets + AI citations); appended to town, town×type, private, district content_html.
- **Cross-linking (#7)** — town pages now: flat-type table rows link to `/hdb/<town>/<ft>`, plus a "Private Property Near <town>" block linking overlapping `TOWN_TO_DISTRICTS` districts. District pages add an "HDB Towns in <label>" block linking `DISTRICT_TO_TOWNS`. (Private already linked to its district.)
- **Backlog tasks tracked** (not done this batch): ranking/best-of pages, comparison pages, About/methodology/data (E-E-A-T) pages, Tailwind CDN→static CSS + font-weight trim, off-site backlinks.
- **Note**: app.js changed → `?v=` must bump on deploy; `scripts/bump-version.js` (run by `deploy`/`deploy:frontend`) handles it automatically. Deployed Jun 2026 (v=19).

## Recent Changes (Jun 2026 — SEO quick-wins pass)

Differential SEO audit + safe, zero-regression fixes (Tailwind Play CDN migration was audited as the biggest CWV item but intentionally deferred — left in place by user choice):

- **AI/LLM crawler rendering** (`functions/[[path]].js`) — added AI/extended crawlers to `BOT_PATTERNS` (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, claude-web, anthropic-ai, PerplexityBot, Google-Extended, CCBot, Bytespider, Amazonbot, Applebot-Extended, cohere-ai, diffbot, meta-externalagent, youbot, petalbot). Previously they hit deep routes (`/hdb/*`, `/private/*`, `/district/*`), couldn't run JS, and got the empty SPA shell — now they receive the same server-injected metadata + `content_html` as Googlebot.
- **De-orphaned district pages** (`public/index.html` `#seo-content`) — added a "Singapore Property Districts" block with 28 crawlable `<a href="/district/NN">` links (real `DISTRICT_LABELS`). D01–D28 were in the sitemap but had zero internal links. Mirrors the existing town-links pattern.
- **robots.txt** — edge function (`functions/[[path]].js`, which shadows the static file) and `public/robots.txt` both updated with explicit `Allow: /` blocks for major AI crawlers (kept `User-agent: *` + Sitemap).
- **Resource hints** (`index.html` head) — `preconnect` to `worthit-api.fly.dev` (first data fetch); `dns-prefetch` to jsdelivr/unpkg/tailwindcss CDNs.
- **Deferred non-critical libs** — added `defer` to Chart.js + Leaflet `<script>` (head). Verified safe: `Chart` is first used in `App.init()`→`Charts.initDefaults()` on `DOMContentLoaded` (deferred scripts finish before it); `L` only on search. Leaflet CSS left blocking (avoids unstyled-map flash). Tailwind CDN unchanged.
- **Structured data** — homepage `@graph` (`server/index.js` `/api/seo/metadata`): added `Organization.logo` + a `SoftwareApplication` node (free `offers`, no fabricated rating). Static fallback JSON-LD in `index.html` upgraded from a bare `WebSite` stub to `WebSite` + `Organization` (with logo) `@graph`.
- **Meta polish** — added `og:image:alt`, two `theme-color` tags (light/dark). (`twitter:site` omitted — no real handle.)
- **Verification**: 162 tests pass; local server confirmed valid JSON-LD (homepage types: WebSite/Organization/SoftwareApplication/FAQPage; org.logo present) and bot metadata for `/hdb/bedok` (title + 6KB content_html). No `?v=` bump needed — only `index.html` (no-cache) markup, edge function, and API changed; JS/CSS untouched.

## Recent Changes (Jun 2026 — In-app feedback)

- **Feedback button + modal** — `#feedback-btn` in navbar (reuses `.theme-toggle` CSS, beside dark-mode toggle); opens `#feedback-modal` (one textarea + optional email + hidden honeypot field). Submit reuses `showToast('Thanks for the feedback 🙏')`. GA4 events `feedback_open` / `feedback_submit`. Auto-attaches `route` (`pathname + search`) as context; server also records `user_agent`.
- **`POST /api/feedback`** (`server/index.js`) — validates (message required, ≤4000 chars), honeypot (`website` field → silent `{ok:true}`, no write), per-IP rate limit (5/hour, in-memory `feedbackRate` Map). Registered **before** the `/api/` DB-guard middleware so it works even while `resale.db` is missing/refreshing.
- **Separate `feedback.db`** — feedback is written to its OWN SQLite file (`FEEDBACK_DB_PATH`, default `path.dirname(DB_PATH)/feedback.db` → `/data/feedback.db` in prod), opened read-write. **NOT inside `resale.db`** because resale.db is read-only AND replaced wholesale on every data refresh (`mv resale.db.new resale.db`), which would wipe a table inside it. Auto-created on boot; already covered by `.gitignore` (`server/db/*.db`).
- **Cache-bust** bumped `v=12` → `v=13` (HTML/JS changed).
- **Read feedback**: `node -e "const D=require('better-sqlite3');const db=new D('/data/feedback.db',{readonly:true});console.log(db.prepare('SELECT * FROM feedback ORDER BY id DESC').all())"` (run via `fly ssh console` in prod).

## Recent Changes (Jun 2026 — Map & Performance)

- **Lease shown at top of all map popups** — all 4 popup types now display `Xy lease` in the subtitle line (most recent transaction's `remaining_lease_years`): `addNearbyHDB` markers, main search markers, private project nearby markers (`addNearbyProjects`), and the private project pin popup
- **Distance-based nearby HDB for private project searches** — eliminated geocoding round-trip when viewing a private project's map:
  - **Before**: `addNearbyHDB()` collected unique addresses, posted to `/api/geocode` (OneMap/Nominatim HTTP calls), built `geoMap`, then placed markers
  - **After**: `/api/nearby-hdb` now attaches `lat`/`lng` from `hdb_block_coords` to each returned transaction; `addNearbyHDB()` is now synchronous and places markers directly from the pre-attached coords
  - **Server fix** (`/api/nearby-hdb`): replaced `street_name IN (...)` filter (whole streets, radius leak) with exact `(block || '|' || street_name) IN (...)` pairs — mirrors `/api/area-overview` pattern; dropped redundant `town` lookup query; attaches `lat`/`lng` to every returned transaction from `hdb_block_coords` via `coordByKey` map
  - **Client fix** (`map.js` `addNearbyHDB()`): removed `async`, removed all geocoding code; builds `markerData` from `transactions.filter(tx => tx.lat != null && tx.lng != null).slice(0, 200)` directly
  - **Tests**: added `tests/integration/nearby-hdb.test.js` (5 happy-path tests: 200 response, lat/lng on every tx, radius exclusion of BEDOK SOUTH AVE 1, nearby_projects array, empty result for no-HDB area); updated frontend unit test — removed stale geocode-cap test, added 2 new tests (no geocodeAddresses called, 200-tx cap)
  - **Test count**: 162 → 163 (net +1 after removing obsolete geocode-cap test)

## Recent Changes (Jun 2026 — UI & Infra)

- **Navbar share button** — `#nav-share-btn` added beside dark mode toggle; reuses `.theme-toggle` CSS class; always visible (not hidden behind results section)
- **Share icon** — both share buttons updated to upload-arrow icon (`path d="M4 12v8..." + polyline + line`)
- **Share function simplified** — removed `title`/`text` from `navigator.share()`; was showing `-- — Singapore property prices on WorthIt` on homepage; now passes `{ url }` only so OS/browser uses OG metadata for preview
- **`deploy:data` script hardened**:
  - Added `fly machines start e7845746c2d918 && sleep 5` prefix — Fly.io free tier auto-stops idle machines; SSH doesn't trigger wake-up like HTTP does
  - `mv + rm -f resale.db-wal resale.db-shm` in single SSH command — deletes stale WAL/SHM atomically before server restart to prevent corrupted reads
- **Production DB fixed** — live DB was missing all 138K URA_PRIVATE rows; stale WAL from old DB was making `COUNT(*) = 371`; re-uploaded local DB (107MB, 370,340 rows), deleted WAL/SHM, restarted — private project autocomplete now works on production

## Recent Changes (Jun 2026 — SEO / GSC fixes)

- **GSC "Alternate page with proper canonical tag" fix** — bot handler catch block now injects correct canonical from URL path (`SITE_URL + pathname`) when Fly.io is unreachable, instead of serving raw `index.html` with root canonical
- **GSC "Server error 5xx" fix** — sitemap fetch failure now returns 503 + `Retry-After: 3600` instead of 500; tells Google to retry rather than treating it as a hard error
- **AbortController 5s timeout on metadata fetch** — edge function aborts Fly.io call after 5s; prevents Googlebot from waiting 30s on cold starts before the fallback fires
- **Sitemap `lastmod` added** — server derives `MAX(month)` from DB and sets as `lastmod` on every sitemap entry; signals freshness to Google; cache TTL is 24h
- **Homepage town list → internal links** — 26 HDB town names in `index.html` SEO section converted from plain text to `<a href="/hdb/...">` links; improves crawl discovery and PageRank distribution
- **Twitter card image dimensions** — added `twitter:image:width/height` (1200×630) to `index.html` matching OG tags
- **og-image.png updated** — new OG image deployed; social platform caches need manual refresh via Facebook Sharing Debugger / LinkedIn Post Inspector

## Recent Changes (Jun 2026)

- **Map deal score coloring** — `addNearbyHDB()` and `addNearbyProjects()` were hardcoded blue/purple; now use `getValueStyle()` relative to nearby median
- **Postal code pinned block** — `pinnedBlock` parsed from `resolved.address` (e.g. "BLK 876C..." → "876C"); `applyTransactionFilters()` floats that block to top after sort
- **HDB block coordinates + distance-based postal search** — full pipeline replaced:
  - `scripts/hdb_blocks.csv` seeds `hdb_block_coords` table (12,442 blocks, 100% coverage)
  - `download_data.py` seeds on rebuild + incrementally geocodes new blocks via OneMap
  - Server seeds table on startup if missing (`seedHdbBlockCoords()`)
  - `findNearbyHdbBlocks(lat, lng)` — synchronous SQLite bounding-box query
  - `/api/area-overview` accepts `lat`/`lng`; filters by exact `(block|street_name)` pairs within 500m
  - Removed: `/api/nearby-streets` endpoint, `findNearbyStreets()`, `nearbyStreetsCache`, `getNearbyStreets()` in `api.js`, extra frontend round-trip
  - Test count: 158 → 155 (removed 3 obsolete `/api/nearby-streets` validation tests)
- **Distant private property markers fix** — root cause: postal code search resolved to town (e.g. TAMPINES), then `loadPrivateSummaryForTown` loaded ALL District 18 private transactions and rendered them on the map regardless of distance. Fix: postal code searches (where `lastResolvedData.lat/lng` is set) skip `loadPrivateSummaryForTown` entirely and use `addNearbyProjects` (bounded 550m bounding box via `/api/nearby-hdb`) instead; town-name searches keep the district-wide summary as before
- **Separate URL for postal code searches** — postal code searches now use `/postal/<code>` instead of `/hdb/<town>`, fixing the ambiguity where bookmarking/reloading `/hdb/tampines` would run a town search instead of the specific block search:
  - `app.js`: added `currentPostalCode` state; `updateSeoForSearch` pushes `/postal/<code>` with address-specific title when set; `handleUrlRoute()` handles `/postal/<6-digit>` by setting search input and calling `search()`
  - `server/index.js`: `/api/seo/metadata` handles `/postal/<code>` — looks up block+street from `hdb_block_coords`, returns address-specific title/description/canonical
  - Sitemap unchanged — postal codes not included (too many, not useful SEO targets)
- **Private property postal code fix** — two bugs fixed when a postal code resolves to a private property (not HDB):
  - `lastResolvedData` was missing `isPrivate: true`, causing project transactions to render as scattered circle markers instead of collapsing into the pin popup; fixed by setting full `{ lat, lng, projectName, isPrivate: true }` in the `else` branch
  - Dead code removed: `if (isPostalCode && resolved.building)` was inside `else if (!isPostalCode)` — could never fire; removed the unreachable block

## Deployment Architecture
- **Frontend**: Cloudflare Pages (`npx wrangler pages deploy public --project-name=worthit`) — ✅ LIVE
- **Backend API**: Fly.io (`worthit-api`) with 1GB persistent volume
- **Database**: SQLite on Fly.io volume, seeded locally and uploaded via `fly ssh sftp put`
- **Config**: `public/config.js` auto-detects localhost → same-origin, else → `https://worthit-api.fly.dev`
- **Cost**: $0/month (Fly.io free tier + Cloudflare Pages free)

## Completed Infrastructure
- ✅ `Dockerfile` — Node.js + Python container (public/ excluded)
- ✅ `fly.toml` — Fly.io config with volume mount at `/data`
- ✅ `.dockerignore` — excludes `public/`, `node_modules/`, `.history/`
- ✅ Server graceful startup without database (shows `no_database` status)
- ✅ `/api/status` health check bypasses DB middleware
- ✅ CORS configured for Cloudflare Pages + Fly.io origins
- ✅ DB seeded (local build + SFTP upload — avoids Fly.io 256MB RAM limit)
- ✅ README updated with deployment guide and debugging commands
- ✅ `.gitignore` updated with `fly.ssh*` files

## Remaining Steps
- ✅ Push to GitHub
- ✅ Configure custom domain — `worthit.canlah.app` (DNS on Cloudflare, domain from Porkbun)

## Custom Domain Setup
- **Domain**: `canlah.app` registered at Porkbun
- **Subdomain**: `worthit.canlah.app` → Cloudflare Pages
- **DNS**: Nameservers transferred to Cloudflare (Universal SSL, automatic)
- **API**: Still at `worthit-api.fly.dev` (CORS allows all origins)

## Key Commands
- **Deploy API**: `fly deploy`
- **Deploy Frontend**: `npx wrangler pages deploy public --project-name=worthit`
- **Seed DB**: Build locally → `fly ssh sftp put server/db/resale.db /data/resale.db` → `fly machine restart <id>`
- **Update data monthly**: Re-run `python scripts/download_data.py` locally → re-upload via SFTP
- **Debug**: `fly logs`, `fly ssh console`, `fly ssh sftp`

## SEO Enhancement — COMPLETE (2026-05-29)

### What was built
Enhanced `/api/seo/metadata` in `server/index.js` and `functions/[[path]].js` to inject rich, data-driven content for all bot-visible pages. All 158 tests pass.

### Changes made
- **`fmtPrice()` / `fmtPsf()`** helpers added to `server/index.js` (after `titleCase`)
- **HDB branch** (`/hdb/<town>`):
  - Title: `[Town] HDB Resale Price 2025 — $XXX psf Avg | WorthIt`
  - Flat-type breakdown query + YoY comparison query
  - `@graph: [WebPage, FAQPage]` JSON-LD with real price Q&As (overall avg, top 3 flat types, YoY direction)
  - `content_html`: heading + summary paragraph + prices-by-type table + "Compare Other HDB Towns" internal links (all 25 other towns)
- **Private branch** (`/private/<project>`):
  - Detects EC via `flat_type = 'EXECUTIVE CONDOMINIUM'`
  - Detects new launch vs MOP-reached via avg tx/month velocity (>8/month = new launch)
  - Title includes "New EC Launch" or "MOP YYYY" tag for ECs
  - `@graph: [WebPage, FAQPage]` JSON-LD with EC-specific MOP Q&As
  - `content_html`: summary with green "MOP YYYY" or amber "New EC Launch" badge
- **District branch** (`/district/<code>`):
  - Top 6 projects with avg PSF + tx count
  - Title includes avg PSF
  - FAQPage JSON-LD with avg price + top project names
  - `content_html`: summary + clickable top-projects table with EC labels
- **`functions/[[path]].js`**:
  - Added `injectContent(html, meta)` — regex-replaces `<section id="seo-content">` with `meta.content_html`
  - Called after `injectMeta()` in the bot handler

### Post-deploy fixes
- Added `Google-InspectionTool` to `BOT_PATTERNS` in `functions/[[path]].js` — Rich Results Test uses this UA, not `Googlebot`, so it was getting static HTML without JSON-LD injection
- Redeployed frontend to fix validation

### FAQ rich results deprecation (May 7, 2026)
Google deprecated FAQ rich results — they no longer appear in SERPs. FAQPage JSON-LD is kept (harmless, may still inform Google's understanding), but won't produce rich result cards. Remaining value of SEO work:
- ✅ `content_html` bot-visible content (prices table, internal links) — still indexed
- ✅ Real prices in page titles/descriptions — shows in search snippets  
- ✅ Internal town links — PageRank distribution unaffected
- ✅ `BreadcrumbList` JSON-LD — still supported, shows breadcrumbs in SERPs
- ❌ `FAQPage` JSON-LD — deprecated, no rich result cards

### Remaining steps
- ✅ Sitemap submitted to Google Search Console (Jun 2026)

## Recent Changes
- **Test suite expanded: 130 → 158 tests** (May 2026):
  - **`addNearbyHDB()` geocode cap bug fixed**: was collecting up to 200 unique addresses before sending to `/api/geocode`; server caps at 100 and returns 400. Silent failure — `catch` swallowed the error, no HDB markers shown on private project pages. Fixed to cap at 100, matching `load()`.
  - **Resolve regression tests** (`resolve.test.js`): "BEDOK RESIDENCES" → `resolved: false` (catches the `inputUpper.includes(t)` routing bug); partial prefix/suffix matching still works ("TOA" → TOA PAYOH, "PAYOH" → TOA PAYOH).
  - **API contract tests** (`area-overview.test.js`): `trend_data[*].avg_psm` field exists (charts.js reads this silently); `private_trend_data` is an array (dual-line chart); `prices_by_type[*].median_psm` exists; street filter returns `street_filtered: true`.
  - **Private endpoint contract tests** (`private.test.js`): `hdb_trend_data` is non-empty for district 11 (directly tests the dataset_source bug that shipped); `project_coords` has lat/lng in both district-overview and district-summary; `coordinates` present in project-overview; `price_per_sqm` on district-summary transactions (deal score coloring); `avg_psm` in trend_data for both project-overview and district-overview.
  - **`nearby-hdb` validation** (`validation.test.js`): missing lat → 400, missing lng → 400, non-SG coordinates → 400. Endpoint was completely untested.
  - **Unit conversion helpers** (`frontend.test.js`): `App.sqmToSqft()` and `App.psmToPsf()` — null/0/number/string inputs; catches wrong conversion factor or broken helper logic.
  - **Geocode cap tests** (`frontend.test.js`): `TransactionMap.load()` and `TransactionMap.addNearbyHDB()` both verified to send ≤ 100 addresses to the geocode API.
- **Private project search routing bug fixed** (May 2026):
  - Bug: Searching a private project name containing a town name (e.g. "THE EDEN AT TAMPINES", "BEDOK RESIDENCES", "AFFINITY AT SERANGOON") would route to the HDB town page instead of the private project page. 55 projects affected.
  - Root cause: `/api/resolve` partial-match check used `inputUpper.includes(t)` — any input containing a town name as a substring resolved as that town. Also, `t.includes(inputUpper)` lacked word-boundary protection, so "QUEENS" matched "QUEENSTOWN".
  - Fix in `server/index.js`: Removed `inputUpper.includes(t)` entirely; added word-boundary check to `t.includes(inputUpper)` (match must end at a non-alphanumeric character, not mid-word). e.g. "ANG MO" → "ANG MO KIO" ✓, "QUEENS" → NOT "QUEENSTOWN" ✓.
  - All 127 unit+integration tests pass.
- **psm→psf internal variable renaming** (May 2026):
  - Renamed internal JS variables (`_psmGroups`→`_psfGroups`, `tierPsm`→`tierPsf`, etc.) and HTML IDs (`stat-psm`→`stat-psf`) to match the display unit
  - Consolidated magic number `10.7639` to only appear in `sqmToSqft()` and `psmToPsf()` helper bodies; `charts.js` now delegates to `App.psmToPsf()` instead of inline division
  - Sort option values renamed (`psm-desc`→`psf-desc`, `psm-asc`→`psf-asc`) to match
  - No API or DB changes — server column names (`price_per_sqm`, `avg_psm`) are internal and unchanged
- **Units changed from sqm to sqft** (May 2026):
  - All display values converted: floor area (sqm → sqft), price rate ($/sqm → $/sqft)
  - Conversion factor: 1 sqm = 10.7639 sqft; price/sqft = price/sqm ÷ 10.7639
  - Added `sqmToSqft(sqm)` and `psmToPsf(psm)` helpers to `App` in `app.js`
  - Conversion is display-only — DB column names (`floor_area_sqm`, `price_per_sqm`) and server SQL are unchanged
  - Files updated: `public/js/app.js`, `public/js/charts.js`, `public/js/map.js`, `public/index.html`, `public/css/styles.css`
  - Chart data also converted: `avg_psm / 10.7639` applied before building datasets in `charts.js`
  - Chatbot FAQ text in `server/index.js` updated (3 occurrences of "price per sqm")
- **Frontend cache busting added** (May 2026):
  - Added `public/_headers`: `index.html` → `no-cache, must-revalidate`; JS/CSS → `max-age=31536000, immutable`
  - Added `?v=2` query strings to all local asset includes in `index.html`
  - Rule: bump `?v=N` on every deploy where JS or CSS changes
  - Created `CLAUDE.md` documenting commands, architecture, units, cache busting procedure, Dockerfile note, and testing gaps
- **Map unavailable bug fixed** (May 2026):
  - Symptom: Transaction Map showed "— Map unavailable" on every search
  - Root cause: client (`map.js`) collected up to 200 unique addresses but server (`/api/geocode`) enforced a hard limit of 100, returning 400 → client threw → caught as "Map unavailable"
  - Introduced by commit `082d253` ("Enhance input validation and sanitization") which added the server-side 100-address cap without updating the client
  - Fix: capped `uniqueAddresses` in `map.js` at 100 to match server limit
- **SQL injection fix** (May 2026):
  - `/api/private/project-overview`: `property_type` was string-interpolated into SQL — replaced with parameterized `?` placeholder + `propTypeParam` spread across all 5 queries in the handler
- **Smoke test suite** (May 2026):
  - `tests/smoke/api.smoke.test.js` — 19 tests hitting the live API at `https://worthit-api.fly.dev`
  - Covers: status, towns, flat-types, area-overview, resolve, private projects/project-overview/district-overview, SEO sitemap + metadata
  - `vitest.smoke.config.js` — separate Vitest config (no fixture DB / globalSetup needed)
  - `npm run test:smoke` — hits live API; `npm run test:smoke-local` — hits `http://localhost:3000`
  - Smoke tests excluded from default `npm test` via `exclude` in `vitest.config.js`
- **Pre-deploy test gate** (May 2026):
  - `deploy`, `deploy:api`, `deploy:frontend` npm scripts all prepend `npm test &&` — failing tests block deploys
- **Map deal score coloring + private marker differentiation** (May 2026):
  - Fixed HDB markers: `getValueStyle()` was computed but never used — markers were hardcoded blue. Now wired up to use tier+type median $/sqm for green→blue→red coloring.
  - Extended deal score coloring to private property markers too (was flat purple).
  - HDB vs private differentiation: fill color = deal score (both types); border = property type — HDB gets thin white border (`weight:1`), private gets thick purple ring (`color:'#a855f7', weight:4`) + radius +2.
  - `originalStyle` in `addressMarkers` updated to store `markerRadius` and correct `borderColor`/`borderWeight` so highlight/unhighlight restores correctly.
  - Updated map legend: added HDB vs Private key below the gradient bar.
- **Deal score dot on mobile transaction cards** (May 2026):
  - `renderTransactionsTable()` computes median $/sqm per flat type from `allTransactions` before the loop.
  - `_dealDot(psm, type)` inline helper interpolates same green→blue→red color as map markers.
  - Small colored `w-2 h-2` dot rendered next to the $/sqm value on each mobile card.
- **Mobile UX pass 2** (May 2026):
  - Section jump bar: sticky mobile-only pill strip (Charts / Map / Transactions) inside results section, hidden via `sm:hidden` — no desktop impact (`index.html`)
  - Floating "New Search" FAB: `hidden fixed` button revealed by `_onResultsShown()`, scrolls to search input on tap (`index.html`, `app.js`)
  - Share button: click handler uses `navigator.share()` with clipboard fallback; `showToast()` method for success feedback (`app.js`)
  - Toast element added to `index.html` for clipboard copy confirmation
  - Card tap → map highlight: added `click` handler to mobile cards (skips link taps) — `mouseenter`-only didn't fire on touch (`app.js`)
  - Map scroll-zoom disabled on mobile: `scrollWheelZoom: window.innerWidth >= 640` (`map.js`)
  - Empty state "Clear filters" button: inline `<button onclick="App.clearTransactionFilters()">` in both table and cards empty states; `clearTransactionFilters()` method resets all filter controls (`app.js`)
  - `text-[10px]` → `text-xs` for transaction type badges (lines ~894, 896, 925 in `app.js`); autocomplete dropdown badge at line ~1233 intentionally unchanged
  - `_onResultsShown()` helper called from all 3 render methods (`renderResults`, `renderDistrictResults`, `renderPrivateResults`) to show FAB and jump bar
  - `scroll-margin-top` CSS for `#charts-section`, `#map-section`, `#transactions-section`: 105px mobile (nav + jump bar), 64px desktop (`styles.css`)
- **Mobile UI improvements** (May 2026):
  - Fixed nested scroll trap in transaction cards: removed `max-h-[600px] overflow-y-auto`, now shows first 25 cards with a "Show more" button (`app.js`)
  - Restructured transaction filter bar: full-width search on own row + 4 selects in `grid-cols-2` on mobile; `sm:contents` on the grid wrapper preserves original single-row layout on desktop (`index.html`)
  - Increased mobile chart height: `h-48` → `h-56` for both trend and distribution charts (`index.html`)
  - Added `scrollIntoView` on search input focus (mobile only, `window.innerWidth < 640`) to keep input visible when keyboard opens (`app.js`)
  - Added right-edge fade on flat type buttons row via CSS `mask-image` at `max-width: 639px` to hint at horizontal scroll (`styles.css`)
  - Increased map height on mobile: `h-[280px]` → `h-[320px]` (`index.html`)
  - Fixed "Price Range" stat card overflow: `text-lg` → `text-sm` on mobile (`index.html`)
- **Map popup fixes** (May 2026):
  - Fixed element misalignment in popups: mobile CSS had `max-width: 200px` on wrapper but inner divs had `min-width: 220px` — conflict broke `justify-content: space-between` rows; fixed by raising wrapper to `240px` and reducing inner `min-width` to `180px`; added `flex-wrap: wrap` to detail rows (`styles.css`, `map.js`)
  - Added `shortType()` helper on `TransactionMap` to shorten long flat/property type names in all 4 popup locations — `EXECUTIVE CONDOMINIUM` → `EC`, `CONDOMINIUM` → `Condo`, `SEMI-DETACHED` → `Semi-D`, `STRATA SEMI-DETACHED` → `Strata Semi-D`, etc. (`map.js`)
- **OneMap geocoding fallback for missing private project coords** (May 2026):
  - 128 private projects lacked coordinates because URA API omits SVY21 coords for under-construction launches
  - Added `geocode_missing_projects(conn)` to `scripts/download_ura_data.py`: queries OneMap for each project missing from `project_coords`, 350ms between requests, 1 retry with 3s backoff on failure
  - `project_coords` is never cleared between runs — only truly new missing projects are queried on subsequent downloads
  - Result: 121/128 geocoded automatically; NEWPORT RESIDENCES (192 tx, 80 Anson Rd) inserted manually; 6 single-tx projects remain unmapped
  - Fixed private project map bug: `TransactionMap.load` was passing empty array `[]` → now passes `this.allTransactions`
  - **WAL checkpoint lesson**: geocoded data landed in `resale.db-wal`, not main `resale.db` — first upload silently missed new coords; fixed by running `PRAGMA wal_checkpoint(TRUNCATE)` before upload
  - Deploy flow updated: upload to `/data/resale.db.new` → atomic `mv` → restart (zero downtime during upload)
- **Dual-line price trend chart** (May 2026):
  - Town/postal search: blue HDB line + purple private line (related districts)
  - District search: blue HDB line (related towns) + purple private line
  - Project search: single line (green/red based on trend direction)
  - Server: `/api/area-overview` now returns `private_trend_data`; `/api/private/district-overview` now returns `hdb_trend_data`
  - `charts.js`: `renderTrendChart(hdbData, privateData)` — shared X-axis from union of months, legend shown only when both lines present
  - Fixed bug: `/api/private/district-overview` was querying `dataset_source = 'primary_2017_2026'` (wrong value, always returned 0 rows) — changed to `dataset_source != 'URA_PRIVATE'`
- **Price trend metric switched to $/sqm** (May 2026):
  - All trend charts now display `avg_psm` ($/sqm) instead of average resale price
  - Fixes compositional bias: raw price fluctuates when flat size mix changes month-to-month; $/sqm is size-neutral
  - `charts.js`: reads `d.avg_psm`, Y-axis shows `$X.Xk/sqm`, tooltip shows `$/sqm`
  - `server/index.js`: `trendPct()` now uses `'avg_psm'` in all 3 endpoints (area-overview, project-overview, district-overview) so trend badges (6m/1y/3y/5y %) are consistent with the chart
  - Applies to all search types: town, postal code, project name, district
  - No DB changes needed — `avg_psm` was already being fetched but unused for trend calculations
- **Trend chart fix for private/district** (May 2026):
  - `charts.js` was hardcoded to `d.median_price`; private/district data only has `d.avg_price` → flat line
  - Fixed with `d.median_price ?? d.avg_price` first, then superseded by the $/sqm switch above
- **Trend calculation fix** (May 2026):
  - Old: compared single first month vs single last month — wildly noisy in thin-volume areas (e.g. D01 showed +62.1% 1Y)
  - New: `trendPct(arr, key, n=3)` helper — averages first 3 months vs last 3 months of each window (falls back to 1 if window too small)
  - Fixed in all 3 endpoints: HDB `area-overview` (uses `median_price`), private `project-overview` and `district-overview` (use `avg_price`)
- **Flat Type Multi-Select** (May 2026):
  - Changed flat type toggle from single-select to multi-select
  - `selectedFlatType: 'ALL'` (string) → `selectedFlatTypes: new Set()` (empty = All)
  - New helpers: `_updateFlatTypeUI()` syncs button active states from Set; `_getFlatTypeParam()` returns comma-joined string for API
  - Clicking a type toggles it; clicking "All" clears the Set; any change triggers re-search if town is loaded
  - Server: `flat_type` query param now accepts comma-separated list (e.g. `4 ROOM,5 ROOM`)
  - `addFlatClause()` helper in `area-overview` handler builds `= ?` (single) or `IN (?,?)` (multiple) across all 5 query sites
  - Subtitle label renders `4 ROOM,5 ROOM` as `4 ROOM + 5 ROOM`
- **CLAUDE.md created** (May 2026):
  - Documents commands, split architecture, DB layout, key patterns, and known issues
  - Memory Bank workflow directives added by user config
- **Light/Dark Theme Toggle** (May 2026):
  - Added CSS custom properties for popup styles (leaflet popups now theme-aware)
  - Created `:root` (light mode) and `.dark` (dark mode) CSS variable overrides
  - Anti-FOUC inline script in `<head>` reads `localStorage('theme')` before first paint
  - Theme toggle button (sun/moon icons) in header, persisted to localStorage
  - `App.initTheme()` / `App.toggleTheme()` in `app.js` — toggles `dark` class, re-renders charts and swaps map tiles
  - Dynamic HTML in `app.js` uses `dark:` variants (e.g., `bg-gray-100 dark:bg-dark-700`)
  - `Charts.rerender()` re-draws trend and distribution charts with theme-appropriate colors
  - `TransactionMap.updateTheme()` swaps between CARTO light/dark tile layers
  - Map popups use CSS variables (`--popup-price`, `--popup-muted`, `--popup-border`) for theme-aware styling
  - All popup inline styles updated to use `var(--popup-*)` instead of hardcoded colors
  - Autocomplete dropdown, error alerts, table rows all support both themes
- **SEO Implementation** (May 2026):
  - Added SEO meta tags to `index.html`: description, keywords, canonical, Open Graph, Twitter cards, JSON-LD
  - Created `functions/[[path]].js` Cloudflare Pages Function for bot detection + edge-side meta injection
  - Added `/api/seo/metadata` and `/api/seo/sitemap` endpoints to `server/index.js`
  - Client-side URL routing in `app.js`: `/hdb/<town>`, `/district/<code>`, `/private/<project>`
  - Dynamic `<title>`, `<meta>`, canonical, OG tag updates on search
  - SEO content section at page bottom with keyword-rich text
  - `public/robots.txt` with sitemap reference
  - Sitemap auto-generated from DB (26 HDB towns + 28 districts + 200 private projects)
  - JSON-LD: WebSite + SearchAction + FAQPage (5 FAQs) on homepage; BreadcrumbList + ResidentialProperty on town/project pages
- **Google Analytics 4** (May 2026):
  - GA4 tag (`G-WGC8D0FRSQ`) added to `index.html` `<head>` (after anti-FOUC script)
  - SPA pageview tracking: `gtag('event', 'page_view')` fires on `history.pushState()` in `updateSeoForSearch()` and on `popstate` (back/forward)
  - Tracks all routes: `/hdb/<town>`, `/district/<code>`, `/private/<project>`
  - **Custom GA4 events** (8 events tracked via `App.track()` helper):
    1. `search` — every search with `search_type` (town/postal/district) and `query`
    2. `view_results` — results loaded with `result_type` (hdb/private/district), `location`, `transaction_count`
    3. `click_outbound` — Google Maps link clicks in transactions with `address`, `property_type`
    4. `search_failed` — failed searches with `query`, `failure_reason`
    5. `select_flat_type` — flat type toggle with `flat_types`
    6. `filter_transactions` — transaction filter/sort with `filter_type`, `filter_value`
    7. `toggle_mrt` — MRT overlay toggle with `visible` (boolean)
    8. `share` — share button with `method` (web_share_api/clipboard), `page_path`
- **Fixed SPA direct URL loading** (May 2026):
  - Bug: direct navigation to `/hdb/bedok` stuck at "Loading data..." — all JS/CSS 404'd because relative paths (`js/app.js`) resolved to `/hdb/js/app.js`
  - Fix: changed all relative asset paths in `index.html` to absolute (`/js/app.js`, `/css/styles.css`, `/config.js`)
- **Logo clickable → homepage** (May 2026):
  - Wrapped logo `<div>` in `<a href="/">` so clicking "WorthIt" navigates to homepage
- **Optimized initial page load** (May 2026):
  - `API.getStatus()` and `API.getTowns()` now run in parallel via `Promise.all` (was sequential)
  - Removed 300ms artificial `setTimeout` delay before dismissing overlay
  - Moved `setupEventListeners()` and `setupTransactionFilters()` before API calls
  - Result: ~1-2 seconds faster perceived load time
- **Removed "370k transactions" from navbar** (May 2026):
  - Removed `<span id="data-status">` from navbar HTML and JS that populated it — cleaner UI
  - Data freshness still shown in footer ("Data as of May 2026")
- Fixed server crash on missing database (graceful startup)
- DB middleware rejects other API calls with 503 when DB is missing

## Automated Data Refresh — Jun 2026 (WORKING)

- **GitHub Actions workflow**: `.github/workflows/refresh-data.yml` — verified working end-to-end
- Runs `npm run download` (full HDB + URA rebuild) → `npm run deploy:data` (WAL checkpoint + gzip + SFTP to Fly + gunzip + atomic swap + machine restart)
- Schedule: **daily 03:00 SGT** (cron `0 19 * * *` UTC); change to `0 19 * * 0` to switch to weekly (Mondays)
- `workflow_dispatch` trigger allows manual on-demand runs from the Actions tab
- Concurrency group `refresh-data` with `cancel-in-progress: false` prevents overlapping uploads
- Node 24, Python 3.x (venv created by `run-python.js`), timeout 30 min
- `superfly/flyctl-actions/setup-flyctl@v1` installs `flyctl`; workflow has an **"Alias flyctl as fly"** step (`ln -sf` to `/usr/local/bin/fly`) because npm scripts call `fly`, not `flyctl`

### Required repo secrets (Settings → Secrets → Actions → Repository secrets)
- `URA_API_ACCESS_KEY` — from local `.env`
- `FLY_API_TOKEN` — **must be an ORG token** (`fly tokens create org`), NOT a deploy token. A scoped deploy token CANNOT issue SSH certificates, so `fly ssh sftp`/`fly ssh console` fail with `create ssh certificate: ... 500`. Org token has SSH access. (Expiry ~1 year — set calendar reminder.)

### Gotchas hit while setting this up (don't re-debug these)
- **Pushing workflow files** requires the `workflow` OAuth scope (`gh auth refresh -s workflow`) AND `gh auth setup-git` so git uses gh's token. VS Code git widget caches its own token and may still fail — push from CLI.
- **`npm ci` requires `package-lock.json` in sync** — regenerate with `npm install` if it errors on missing transitive deps (e.g. `@emnapi/*` under better-sqlite3).
- **`fly ssh console --command` does NOT run a shell** — it shlex-splits and execs directly, so `&&` is passed as a literal arg. Multi-step remote commands MUST be wrapped in `sh -c '...'` for `&&` chaining to work. This is now in `deploy:data`.
- **Large DB SFTP drops mid-transfer** (`connection lost` at ~67MB on the 107MB file). Fixed by gzip-compressing before upload (107MB → ~21MB): `gzip -kf` locally, upload `.gz`, `gunzip -f` on server inside the `sh -c`.
- `sleep` after `fly machines start` bumped 5→10s for cold-start reliability.

### Limitations accepted
- Full DB rebuild + Fly restart every run even if source data unchanged (no skip-guard)
- GitHub cron auto-disables after 60 days repo inactivity
- Failure alerts via GitHub's default email only
- DB never committed — built on runner disk, shipped straight to Fly; GitHub's 100MB file limit does not apply

## Active Decisions & Considerations
- Database is opened in `readonly: true` mode — data only changes via Python scripts
- In-memory caches for geocoding and nearby streets (no persistence)
- Nominatim rate limiting: 1 req/sec with 1.1s delays
- Street matching uses multi-strategy: exact → compressed → expanded → keyword fallback
- Fly.io free tier (256MB RAM) can't run Python download scripts — use local build + SFTP upload

## Important Patterns
- All town matching is case-insensitive (`.toUpperCase()`)
- Month format: `YYYY-MM` strings
- Price percentiles calculated in JS, not SQL
- `dataset_source` column distinguishes HDB vs URA_PRIVATE records