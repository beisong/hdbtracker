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

**`public/config.js`** sets `API_BASE = ''` — the SPA always calls same-origin `/api/*`. Locally Express serves it; in production `functions/[[path]].js` (`proxyApi()`) proxies `/api/*` to `https://worthit-api.fly.dev`. This is deliberate: Googlebot's renderer failed to fetch from the separate Fly host ("Failed to fetch" full-screen error in GSC Live Test), so don't point the browser back at Fly directly. The proxy overwrites `X-Forwarded-For` with `CF-Connecting-IP` (feedback rate limiter keys on it) and strips upstream `Content-Encoding`/`Content-Length` so Cloudflare negotiates compression per client.

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

**IndexNow** (`scripts/indexnow-ping.js`, chained onto `deploy` / `deploy:frontend`): after each frontend deploy, every sitemap URL is submitted to IndexNow (Bing, Yandex, DuckDuckGo, Naver, Seznam). **`public/a464a4c238872496dcaa8d33718f8e13.txt` must never be deleted** — IndexNow re-validates that key file on every submission and returns `403 SiteVerificationNotCompleted` without it. The script is deliberately non-fatal (logs a warning, exits 0) so a search-engine outage can't block a deploy. Cloudflare's own Crawler Hints toggle (Caching → Configuration) pings IndexNow independently with a separate Cloudflare-managed key; the two don't conflict.

**URL routing**: `history.pushState()` SPA navigation with routes `/hdb/<town-slug>`, `/district/<code>`, `/private/<project-slug>`. `popstate` listener handles back/forward. GA4 `page_view` events fire on each route change.

**Units**: DB stores sqm/psm. All display values are converted to sqft/psf via `sqmToSqft()` / `psmToPsf()` helpers in `app.js` (factor: 1 sqm = 10.7639 sqft). DB schema and server SQL are unchanged.

**Flat type selection**: multi-select (empty Set = All). Server's `flat_type` param accepts comma-separated list; `addFlatClause()` builds `= ?` or `IN (?,?)` accordingly.

**Valuation / Check My Price** (`GET /api/valuation`): subject block by `postal` or `block`+`street` (from `hdb_block_coords`). Without `price` returns `block_facts` (flat types, standard areas, storey ranges, remaining lease — all inferred from the block's transaction history; lease = newest tx's `remaining_lease_years` minus elapsed time, NOT `lease_commence_date` which the test fixture lacks). With `price`: comps ladder 500m → 1000m → drop lease band → town fallback (12-month window, lease ±10y, `MIN_COMPS=8`); comps storey-adjusted via lease-banded town×type buckets (`computeStoreyFactor`, clamped ±10%); `deal_score = clamp(50 − 250×deviation, 0, 100)` (≥70 Good deal / 45–69 Fair / <45 Premium). Frontend: `#valuation-section` card (`index.html`), shown after postal searches and via 💰 buttons on transaction rows; deep link `/check/<postal>?price=` (noindex, canonical → `/check`).

**findNearbyHdbBlocks** is true-radius: SQL bounding box is only the index prefilter; exact haversine decides inclusion, and each row carries `dist_m`, sorted nearest first.

**BTO Launches**: `scripts/bto_launches.json` (hand-curated per launch from HDB's official Annex A press-release PDF — never scrape `homes.hdb.gov.sg`, it's bot-blocked) seeds a `bto_projects` table, dual-seeded like `hdb_block_coords` (Python `seed_bto_projects()` in `download_data.py` drops+recreates on every rebuild since the JSON is sole source of truth; server-side `seedBtoProjects()` fallback on startup, but only when the table is missing — a plain code deploy does *not* refresh BTO data, only the full nightly data-rebuild workflow does). One row per project × flat-type variant; an upcoming/unpriced project gets one placeholder row (`bto_label=''`) so it still appears in listings. Never inserted into `transactions`. `GET /api/bto/launches` (grouped listing), `GET /api/bto/projects` (autocomplete, mirrors `/api/private/projects`), `GET /api/bto/project-overview` (flats + a standalone comps ladder — 1000m → 2000m → town, `MIN_COMPS=5` — reusing `findNearbyHdbBlocks`/`median`/`percentile`, NOT `/api/valuation`'s internals; gracefully falls through to the town-level basis when a project's `lat`/`lng` is null). `/api/resolve` does an **exact-match-only** BTO check (no LIKE fallback — BTO names often contain town names, e.g. "SEMBAWANG PORTICO", so partial matching there would risk shadowing the town). Frontend: `renderBtoResults()`/`renderBtoIndex()` in `app.js`, routes `/bto` + `/bto/<slug>`, `map.js` `loadBtoSite()` draws an orange pin via `render([], resolvedData)` (a project with null `lat`/`lng` — see below — simply renders with no pin, guarded by existing `resolvedData.lat && resolvedData.lng` checks). **`bto_launches_info/`** (repo root) archives every launch's source PDFs (`<launch_id>-annex-<letter>-<desc>.pdf` or `<launch_id>-brochure-<project>.pdf`) plus one human-readable `<launch_id>-<project-slug>.md` reference summary per project — see the `seed-bto-launch` skill for the full curation runbook, including the `housingmap.sg/bto/` fallback used when a launch's official Annex A is unrecoverable, and (for pre-2010 launches) HDB's legacy VSF microsite archive (`www.hdb.gov.sg`/`www69`/`www101.hdb.gov.sg/hdbvsf/...`, captured in Wayback back to 2001) which often has richer plain-text price tables than either the official Annex A or housingmap.sg's brochures.

**Historical dataset coverage**: `bto_launches.json` spans **April 2001** (HDB's first-ever BTO pilot exercise) through the present/near-future upcoming launches — the full housingmap.sg roadmap has been worked through exactly once; re-verify against a fresh `housingmap.sg/bto/` fetch (month-by-month, cross-referencing project *counts* not just names, since WebFetch summarization can silently drop rows) before assuming it's still complete after a long gap. Pre-2010 entries are progressively more sparse by design — many rows use `resale_flat_type: null` with `price_min`/`price_max` still populated for unresellable types (Studio Apartments, 5-Room Lofts: intentional, not a bug), or a combined `"<Type A> / <Type B> (split unrecoverable)"` placeholder row when even the per-type split couldn't be sourced. Two data quirks specific to this era, both deliberately supported (not accidental nulls) and confirmed safe against the actual server/frontend code before use, not just assumed: **(a) `application_start`/`application_end` can be `null`** when no source gave an exact date — `launchStatus()` in `server/index.js` reports `'closed'` only when `application_start` is set, so a handful of very old entries use a documented *approximate* start date (first-of-month, or ~2 weeks before a confirmed close date) purely to avoid a false `'upcoming'` status; this is safe because the frontend never displays `application_start` for a closed launch, only `application_end`. **(b) a project's `lat`/`lng` can be `null`** for a handful of pre-2010 projects that no longer resolve in OneMap under any name — most often because HDB's own roadmap marks them **cancelled and never built** (e.g. two of the four April 2001 pilot sites). **Project-naming disambiguation**: when the same informal project name covers two genuinely distinct BTO exercises months or years apart on the same site (common pre-2010 — e.g. `CORALINUS (PHASE 1)` Jun 2005 vs `CORALINUS (PHASE 2)` Feb 2006; also `JADE SPRING @ YISHUN`, `FERNVALE VISTA`, `THE CORIS`), the `project` key itself carries a `(PHASE N)` or `(<MONTH YEAR>)` suffix — same convention as the already-established `TANJONG TREE RESIDENCES @ HOUGANG (FEB 2024)` / `(NOV 2021)` pair — so `/api/resolve`'s exact-match lookup and `bto_launches_info/` filenames stay unambiguous; check for an existing OneMap collision before adding a project name that might already exist under a different date. **Same-month multiple exercises**: on the rare occasion two genuinely separate BTO exercises fall in the same calendar month (e.g. Dec 2008: Dew Spring 18th vs Sunshine Court/Punggol Regalia 30th), suffix `launch_id` with a same-length letter (`2008-12a` earlier, `2008-12b` later) — **never** a day number (`2008-12-18`), because `/api/bto/launches`' `ORDER BY launch_id DESC` sorts as a plain string and a day-suffixed id sorts *after* its bare `YYYY-MM` sibling regardless of actual date order. **Don't trust housingmap.sg's own unit totals blindly**: several pre-2010 rows have been found to disagree with the actual built development (a genuine 4-digit/mis-split error, not just an OCR artifact) — cross-check against an independent source (a contemporaneous press article, or a current real-estate listing's per-block unit count) before treating housingmap's number as ground truth, and note the discrepancy in the launch's `_curation_note` either way.

**Trend charts**: dual-line (blue HDB + purple private) for town/district searches; single line for project search. Y-axis is $/sqm (`avg_psm`) — size-neutral. Trend % uses 3-month rolling avg at each end of the window.

**Frontend cache busting**: `public/_headers` sets `index.html` to `no-cache, must-revalidate`; JS/CSS to `max-age=31536000, immutable`. `?v=N` query strings on all local `<script>`/`<link>` tags. Bump `N` on every deploy where JS or CSS changes. Current: `v=26`.

**Light/Dark theme**: `App.initTheme()` / `App.toggleTheme()` toggle `.dark` class on `<html>`. Anti-FOUC inline script reads `localStorage('theme')` before first paint. Map tiles swap between CARTO light/dark. Charts re-render on toggle.

**Testing**: 239 unit + integration tests in `tests/` (Vitest + supertest + fixture SQLite). 19 smoke tests in `tests/smoke/` hitting live API. Deploy scripts (`deploy`, `deploy:api`, `deploy:frontend`) all prepend `npm test &&` — failing tests block deploys.

**WAL checkpoint**: always run `PRAGMA wal_checkpoint(TRUNCATE)` on the SQLite DB before uploading to Fly.io. Otherwise geocoded data in the WAL file is silently lost.

## Known Issues

- In-memory geocode cache (`geocodeCache`) has no size limit; long-running servers may accumulate unbounded memory.
- No DB indexes — performance may degrade on large result sets.
