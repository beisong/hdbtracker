# System Patterns: WorthIt

> Scope: how the code is organised — component map, endpoint inventory, request paths.
> Architecture overview and the detailed patterns (proxy, street matching, map markers, valuation,
> BTO, SEO for bots, IndexNow, cache busting, WAL checkpoint) live in **CLAUDE.md** (single source) —
> don't duplicate them here.

## Edge routing order (`functions/[[path]].js`)
1. `/api/*` → `proxyApi()` → Fly.io
2. `/robots.txt` (generated; keep in sync with `public/robots.txt`) and `/sitemap.xml` (built from `/api/seo/sitemap`)
3. `STATIC_PAGES` (`/about`, `/methodology`, `/data-sources`) → static HTML for everyone
4. Paths with a file extension → static asset (never bot-injected)
5. Bot User-Agent → `/api/seo/metadata` (5s timeout) → `injectMeta()` + `injectContent()`;
   on failure, inject only the path-based canonical
6. Everyone else → static asset or `index.html` (SPA fallback)

## Server (`server/index.js`, monolithic ~3,400 lines)
- **Startup**: load `bto_launches.json` (→ `HDB_QUOTED_RESALE`) and `bto_project_blocks.json`
  (→ `BTO_PROJECT_BLOCKS`) *before* opening the DB, then `seedHdbBlockCoords()` / `seedBtoProjects()`
  (only if those tables are missing). Separate writable `feedback.db`.
- **Middleware order**: `/api/status` and `POST /api/feedback` are registered before the DB guard,
  which returns 503 for other `/api/*` calls while `resale.db` is missing.
- **Endpoints**
  - HDB: `/api/status`, `/api/towns`, `/api/flat-types`, `/api/resolve`, `/api/area-overview`,
    `/api/nearby-hdb`, `/api/valuation`, `POST /api/geocode`
  - Private: `/api/private/projects`, `/api/private/project-overview`, `/api/private/property-types`,
    `/api/private/district-overview`, `/api/private/district-summary`
  - BTO: `/api/bto/launches`, `/api/bto/projects`, `/api/bto/project-overview`
  - Other: `POST /api/feedback`, `/api/seo/metadata`, `/api/seo/sitemap`
- **Key helpers**: `median()`, `percentile()`, `monthsAgoStr()`, `haversineM()`,
  `findNearbyHdbBlocks()`, `findDbStreets()`, `compressStreetName()` / `expandStreetName()`,
  `matchRoadToTown()` (town in road name → `roadPrefixMap` → LIKE on street names),
  `computeStoreyFactor()`, `dealScore()`, `launchStatus()`, `btoProjectResale()`, `trendPct()`,
  `fmtPrice()` / `fmtPsf()`, `slugToProject()` (fuzzy) vs `slugToBtoProject()` (exact).
  Test-only exports under `_test`.

## Frontend (`public/`)
- `config.js` — `API_BASE = ''` (always same-origin), CARTO tile key.
- `js/api.js` — API client.
- `js/app.js` — `App`: state, search + `/api/resolve` dispatch, `handleUrlRoute()` / `popstate`,
  renderers (`renderResults`, `renderDistrictResults`, `renderPrivateResults`, `renderBtoResults`,
  `renderBtoIndex`, `renderBtoProjectResale`), valuation card, `_onResultsShown()` (resets shared
  sections between result types), `updateSeoForSearch()` (URL + title + GA4 page view).
- `js/charts.js` — `Charts` (Chart.js trend + distribution).
- `js/map.js` — `TransactionMap` (Leaflet): `load()`, `addNearbyHDB()`, `addNearbyProjects()`,
  `loadBtoSite()`, MRT overlay, `getValueStyle()` deal-score colours.
- Static: `about.html`, `methodology.html`, `data-sources.html`, `data/mrt_stations.json`,
  `_headers`, `robots.txt`, IndexNow key file.

## Request Paths
1. **Postal search**: `/api/resolve` (OneMap) → `/api/area-overview?lat=&lng=` → charts + map + table
   → `/api/nearby-hdb` (after map load) → valuation card (`/api/valuation`).
2. **Town / town × flat type**: `/api/resolve` → `/api/area-overview?town=&flat_type=`.
3. **Private project / district**: `/api/private/projects` → `/api/private/project-overview` or
   `/api/private/district-overview`.
4. **BTO project**: `/api/resolve` exact match → `/api/bto/project-overview` (flats, nearby-resale
   comparison, `project_resale` when past MOP) → `loadBtoSite()` + `/api/nearby-hdb`.
5. **Bot page view**: edge → `/api/seo/metadata?route=` → injected HTML.
