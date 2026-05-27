# Active Context: WorthIt

## Current State
The project is fully deployed and functional:
- **Backend API**: Running on Fly.io at `worthit-api.fly.dev` — 370K transactions, data through May 2026
- **Frontend**: ✅ Live at [worthit.canlah.app](https://worthit.canlah.app) via Cloudflare Pages (DNS on Cloudflare, domain from Porkbun)
- **Database**: SQLite on Fly.io persistent volume (`/data/resale.db`), built locally and uploaded via SFTP
- **Local dev**: `node server/index.js` serves both frontend and API on port 3000

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

## Recent Changes
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