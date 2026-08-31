# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# System Instructions

You are executing inside a project that utilizes a standardized "Memory Bank" workflow framework. Your memory reset cycle is mitigated by keeping documentation updated in the `memory-bank/` directory. Do not deploy unless I asked you to do so.

### Core Directive
Before executing any tasks, you MUST read the existing memory bank files located at the root of the project to understand the current architecture, tech stack, and progress:
- `memory-bank/projectbrief.md`
- `memory-bank/productContext.md`
- `memory-bank/systemPatterns.md`
- `memory-bank/techContext.md`
- `memory-bank/activeContext.md`
- `memory-bank/progress.md`

### Maintenance Directive
When a task is completed, or when the user asks you to update the status, you are responsible for updating `activeContext.md` and `progress.md` to reflect the current state of the workspace, what was changed, and what next steps remain. Do not alter architecture or tech stack notes unless structural changes were deliberately made.

## Commands

```bash
npm start              # Run server (http://localhost:3000)
npm run dev            # Run with --watch (auto-restart on changes)
npm run download-hdb   # Download HDB transactions from data.gov.sg into resale.db
npm run download-ura   # Download URA private property data (requires URA_API_ACCESS_KEY in .env)
npm run deploy         # Deploy API to Fly.io + frontend to Cloudflare Pages
npm run deploy:api     # Deploy API only (fly deploy)
npm run deploy:frontend # Deploy frontend only (wrangler pages deploy public --project-name=worthit)
```

```bash
npm test                # Run unit + integration tests (213 tests, Vitest + supertest)
npm run test:smoke      # Smoke tests against live worthit-api.fly.dev (19 tests)
npm run test:smoke-local # Smoke tests against localhost:3000
```

To update data on production (zero-downtime):
```bash
python scripts/download_data.py        # Build DB locally (Fly.io has too little RAM)
# In Python/SQLite before uploading:
# PRAGMA wal_checkpoint(TRUNCATE);     # Flush WAL into main file first!
fly ssh sftp put server/db/resale.db /data/resale.db.new
fly ssh console -C "mv /data/resale.db.new /data/resale.db"
fly machines restart
```

## Architecture

Split deployment: static frontend on **Cloudflare Pages**, REST API on **Fly.io**.

```
Cloudflare Pages (public/)          Fly.io (server/)
┌──────────────────────────┐        ┌─────────────────────────────┐
│ functions/[[path]].js    │──bot──▶│ /api/seo/metadata           │
│ (Edge Function)          │        │ /api/seo/sitemap             │
│                          │        │                              │
│ index.html (SPA)         │──API──▶│ Express + better-sqlite3    │
│ js/app.js                │        │ server/db/resale.db (volume) │
│ js/api.js                │        └─────────────────────────────┘
│ js/charts.js             │
│ js/map.js                │
└──────────────────────────┘
```

**`public/config.js`** auto-detects environment: localhost → same-origin API, production → `https://worthit-api.fly.dev`.

## Database

Single SQLite file (`server/db/resale.db`), opened read-only in WAL mode. One `transactions` table holds both HDB and private property records, distinguished by `dataset_source` column (`'URA_PRIVATE'` vs HDB records). A `project_coords` table stores lat/lng for private property projects.

The DB is never bundled in Docker — it lives on a Fly.io persistent volume at `/data/resale.db`. Run `npm run download-hdb` locally to generate it.

## Key Patterns

**Street name matching** uses a 4-strategy cascade (server/index.js `findDbStreets()`):
1. Exact match
2. Compressed form (STREET→ST, BUKIT→BT via `compressStreetName()`)
3. Expanded form (ST→STREET, BT→BUKIT via `expandStreetName()`)
4. Keyword fallback — strip road-type stop words, LIKE-query meaningful words

**Map marker coords**: `/api/area-overview` attaches `lat`/`lng` to every transaction it returns (from `hdb_block_coords`), so `map.js` places HDB markers without geocoding. Block-filtered searches (postal/street) return the latest **3 transactions per block** (window function, cap 400) so every block in the radius gets a marker; town searches keep newest-200. Private markers come from `/api/nearby-hdb` `nearby_projects` (true 800m haversine radius, ≤40 projects, `dist_m` attached) and are added only after `TransactionMap.load()` resolves — `addNearbyProjects()` no-ops if the map isn't initialized.

**Geocoding pipeline** (`/api/geocode`): OneMap SG API primary → Nominatim fallback. Now only a fallback for blocks missing from `hdb_block_coords`. Server enforces a hard cap of 100 addresses per request; client (`map.js`) caps at 100 to match.

**SEO for bots** (`functions/[[path]].js`): Cloudflare edge function detects crawlers via User-Agent regex, fetches metadata from Fly.io (`/api/seo/metadata`), and injects `<title>`, `<meta>`, OpenGraph, and JSON-LD into the HTML before serving. Normal users get the SPA directly.

**URL routing**: `history.pushState()` SPA navigation with routes `/hdb/<town-slug>`, `/district/<code>`, `/private/<project-slug>`. `popstate` listener handles back/forward. GA4 `page_view` events fire on each route change.

**Units**: DB stores sqm/psm. All display values are converted to sqft/psf via `sqmToSqft()` / `psmToPsf()` helpers in `app.js` (factor: 1 sqm = 10.7639 sqft). DB schema and server SQL are unchanged.

**Flat type selection**: multi-select (empty Set = All). Server's `flat_type` param accepts comma-separated list; `addFlatClause()` builds `= ?` or `IN (?,?)` accordingly.

**Valuation / Check My Price** (`GET /api/valuation`): subject block by `postal` or `block`+`street` (from `hdb_block_coords`). Without `price` returns `block_facts` (flat types, standard areas, storey ranges, remaining lease — all inferred from the block's transaction history; lease = newest tx's `remaining_lease_years` minus elapsed time, NOT `lease_commence_date` which the test fixture lacks). With `price`: comps ladder 500m → 1000m → drop lease band → town fallback (12-month window, lease ±10y, `MIN_COMPS=8`); comps storey-adjusted via lease-banded town×type buckets (`computeStoreyFactor`, clamped ±10%); `deal_score = clamp(50 − 250×deviation, 0, 100)` (≥70 Good deal / 45–69 Fair / <45 Premium). Frontend: `#valuation-section` card (`index.html`), shown after postal searches and via 💰 buttons on transaction rows; deep link `/check/<postal>?price=` (noindex, canonical → `/check`).

**findNearbyHdbBlocks** is true-radius: SQL bounding box is only the index prefilter; exact haversine decides inclusion, and each row carries `dist_m`, sorted nearest first.

**BTO Launches**: `scripts/bto_launches.json` (hand-curated per launch from HDB's official Annex A press-release PDF — never scrape `homes.hdb.gov.sg`, it's bot-blocked) seeds a `bto_projects` table, dual-seeded like `hdb_block_coords` (Python `seed_bto_projects()` in `download_data.py` drops+recreates on every rebuild since the JSON is sole source of truth; server-side `seedBtoProjects()` fallback on startup). One row per project × flat-type variant; an upcoming/unpriced project gets one placeholder row (`bto_label=''`) so it still appears in listings. Never inserted into `transactions`. `GET /api/bto/launches` (grouped listing), `GET /api/bto/projects` (autocomplete, mirrors `/api/private/projects`), `GET /api/bto/project-overview` (flats + a standalone comps ladder — 1000m → 2000m → town, `MIN_COMPS=5` — reusing `findNearbyHdbBlocks`/`median`/`percentile`, NOT `/api/valuation`'s internals). `/api/resolve` does an **exact-match-only** BTO check (no LIKE fallback — BTO names often contain town names, e.g. "SEMBAWANG PORTICO", so partial matching there would risk shadowing the town). Frontend: `renderBtoResults()`/`renderBtoIndex()` in `app.js`, routes `/bto` + `/bto/<slug>`, `map.js` `loadBtoSite()` draws an orange pin via `render([], resolvedData)`.

**Trend charts**: dual-line (blue HDB + purple private) for town/district searches; single line for project search. Y-axis is $/sqm (`avg_psm`) — size-neutral. Trend % uses 3-month rolling avg at each end of the window.

**Frontend cache busting**: `public/_headers` sets `index.html` to `no-cache, must-revalidate`; JS/CSS to `max-age=31536000, immutable`. `?v=N` query strings on all local `<script>`/`<link>` tags. Bump `N` on every deploy where JS or CSS changes. Current: `v=22`.

**Light/Dark theme**: `App.initTheme()` / `App.toggleTheme()` toggle `.dark` class on `<html>`. Anti-FOUC inline script reads `localStorage('theme')` before first paint. Map tiles swap between CARTO light/dark. Charts re-render on toggle.

**Testing**: 239 unit + integration tests in `tests/` (Vitest + supertest + fixture SQLite). 19 smoke tests in `tests/smoke/` hitting live API. Deploy scripts (`deploy`, `deploy:api`, `deploy:frontend`) all prepend `npm test &&` — failing tests block deploys.

**WAL checkpoint**: always run `PRAGMA wal_checkpoint(TRUNCATE)` on the SQLite DB before uploading to Fly.io. Otherwise geocoded data in the WAL file is silently lost.

## Known Issues

- In-memory geocode cache (`geocodeCache`) has no size limit; long-running servers may accumulate unbounded memory.
- No DB indexes — performance may degrade on large result sets.
