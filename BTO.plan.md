# BTO Launches Feature — Implementation Plan

> **STATUS (Aug 2026): Built.** §1–4 and Appendices A/B below were followed as-is and are accurate.
> §5's implementation details were corrected during a plan-mode review before execution (most
> notably: `/api/resolve` has no district/private logic inside it, there's no shared slug helper,
> and BTO resolution ended up exact-match-only with no LIKE fallback). See
> `memory-bank/activeContext.md` for the full as-built account, including two bugs caught during
> implementation (a temporal-dead-zone `ReferenceError` in the BTO JSON seeding, and an unhidden
> "Percentiles + Town Summary" section that needed a new id). Treat this file as historical context
> for *why* the feature exists and its locked-in design decisions, not as an up-to-the-line
> implementation reference.

> **Audience note**: this plan is written to be executed by any coding agent without extra context.
> Before starting, read `CLAUDE.md` and all files in `memory-bank/` (mandatory project directive).
> Follow the steps in order. Each step lists the files to touch, exactly what to do, and how to verify.

---

## 1. Context — what is this feature?

HDB (Singapore's public housing authority) launches new **Build-To-Order (BTO)** flats 3–4 times a
year. These flats have **no resale transactions** (buyers must live in them ~5 years before selling,
the "MOP"), so they are invisible to WorthIt today. This feature adds BTO launch data so buyers can:

1. **Search a BTO project by name** (e.g. "Lakeview Cascadia") in the main search bar — **core requirement**.
2. See its details: town, classification (Standard/Plus/Prime), flat types, floor areas, unit
   counts, indicative price ranges, waiting time, application window.
3. See a **BTO vs nearby resale comparison**: HDB's indicative price range next to the median price
   of actual resale transactions of the same flat type near the project site — computed from the
   `transactions` table WorthIt already has. This is the differentiating feature; HDB itself
   publishes such comparisons in its press releases, which validates the approach.
4. See the project on a map with nearby resale blocks (reusing the existing `/api/nearby-hdb` machinery).

**Scope for this phase**: launches from **2025 and 2026 only** (Feb 2025, Jul 2025, Oct 2025,
Feb 2026, Jun 2026 — plus the announced-but-unpriced Nov 2026 launch as an "upcoming" teaser).

**Data acquisition is solved**: each launch has an official HDB press release with an "Annex A" PDF
containing per-project, per-flat-type supply and pricing. The June 2026 dataset is already extracted
in full (see Appendix A). Data volume is tiny (7 projects × ~5 flat types per launch), so the seed
is a **hand-curated JSON file committed to the repo** — no scraper.

---

## 2. Scope

### In scope (this phase)
- New `scripts/bto_launches.json` seed file (June 2026 complete; backfill Feb/Jul/Oct 2025 + Feb 2026; Nov 2026 as `upcoming`).
- New `bto_projects` table in `resale.db`, seeded from the JSON (same dual-seed pattern as `hdb_block_coords`).
- New API endpoints: `GET /api/bto/launches`, `GET /api/bto/projects` (autocomplete), `GET /api/bto/project-overview`.
- `/api/resolve` returns `type: 'bto'` for BTO project names → **main search bar works**.
- Autocomplete dropdown shows BTO projects with a `bto` badge.
- Frontend BTO project page (route `/bto/<project-slug>`) with details, comparison table, map, disclaimers.
- `/bto` index page listing all launches (also the SEO hub page).
- SEO: metadata branches for `/bto` and `/bto/<slug>`, sitemap entries.
- Tests: fixture table + rows, integration tests, resolve regression tests.

### Out of scope (do NOT build now)
- Scraping `homes.hdb.gov.sg` (it is bot-blocked; 503s non-browser clients — never fetch it from code).
- SBF (Sale of Balance Flats) / open booking exercises.
- Application-rate / subscription data (published after each exercise; possible later enhancement).
- Short-lease 2-room Flexi pricing tiers (15y–45y) — store 99-year prices only.
- BTO markers on existing postal/town search maps (good phase-2 candidate; see §9).
- Grant calculations (all prices shown "excluding grants", matching how HDB quotes them).

---

## 3. Key design decisions (already made — do not revisit)

| Decision | Rationale |
|---|---|
| Seed = committed JSON, curated by hand per launch | 3–4 launches/yr, ~10 projects each; a scraper of a government SPA is more fragile than 20 min of curation. |
| Data lives in a `bto_projects` table inside `resale.db` | Keeps the server read-only single-DB model. **Must be re-seeded on every data refresh** because `resale.db` is replaced wholesale (`mv resale.db.new resale.db`) — hence seeding in both `download_data.py` AND a server-startup fallback (pattern: `seedHdbBlockCoords`, `server/index.js:60`). |
| BTO rows are **never inserted into `transactions`** | Price ranges are not transactions. They must not pollute medians, trends, deal scores, or counts. |
| One denormalized table: one row per project × flat-type variant | Matches the project's existing style (the `transactions` table is denormalized); simplest for SQL. |
| Store both `bto_label` (display, e.g. "2-Room Flexi (Type 2)") and `resale_flat_type` (join key, e.g. `2 ROOM`) | `resale_flat_type` must exactly match values in `transactions.flat_type`: `2 ROOM`, `3 ROOM`, `4 ROOM`, `5 ROOM`, `EXECUTIVE`, `MULTI-GENERATION`. Mapping: 2-room Flexi (any type) → `2 ROOM`; 3Gen → `MULTI-GENERATION`. |
| Comparison ladder: comps within **1000m** → widen to **2000m** → fall back to whole town; 12-month window | BTO sites are often new estates where 500m has few resale blocks. Mirrors the existing valuation ladder concept (`/api/valuation`, `server/index.js:1795`) but simpler — no storey adjustment, no deal score. It's context, not a score. |
| Prices displayed "excluding grants" with explicit disclaimers | Matches HDB quoting convention; honest-copy requirement (this is a YMYL site — see the E-E-A-T pages). |
| `lat`/`lng` per project curated in the JSON (geocode via OneMap once, by hand or helper script) | ~40 points total; a manual override beats automated geocoding of vague "bounded by X and Y" strings. |

---

## 4. Data model

### 4.1 Seed file: `scripts/bto_launches.json`

```jsonc
{
  "launches": [
    {
      "launch_id": "2026-06",              // YYYY-MM of the sales exercise
      "label": "June 2026 BTO",
      "application_start": "2026-06-17",   // null for upcoming launches
      "application_end": "2026-06-24",
      "sources": ["<press release URL>", "<Annex A PDF URL>"],
      "projects": [
        {
          "project": "LAKEVIEW CASCADIA",         // UPPERCASE — matching convention of the app
          "display_name": "Lakeview Cascadia",
          "town": "BISHAN",                        // must match a transactions.town value exactly
          "classification": "Prime",               // Standard | Plus | Prime
          "location_desc": "Bounded by Upper Thomson Road",
          "lat": null,                             // curator fills (see step 5.1)
          "lng": null,
          "waiting_months": 51,                    // HDB "estimated waiting time"; use max if a range like "49/54"
          "flats": [
            { "bto_label": "2-Room Flexi (Type 1)", "resale_flat_type": "2 ROOM",
              "floor_area_sqm": 40, "units": 118, "price_min": 216000, "price_max": 287000 },
            { "bto_label": "4-Room", "resale_flat_type": "4 ROOM",
              "floor_area_sqm": 90, "units": 745, "price_min": 534000, "price_max": 742000 }
          ],
          // optional — HDB's own published resale comparables (from Annex A), for display next to ours
          "hdb_quoted_resale": [
            { "resale_flat_type": "4 ROOM", "min": 840000, "max": 950000, "note": "~71y lease, 102 sqm" }
          ]
        }
      ]
    },
    {
      "launch_id": "2026-11",
      "label": "November 2026 BTO (upcoming)",
      "application_start": null,
      "application_end": null,
      "sources": [],
      "projects": [ /* towns only, flats: [], prices unknown → page shows "details at launch" */ ]
    }
  ]
}
```

The **complete June 2026 data** to paste into this file is in **Appendix A**. Backfill sources for
the other launches are in **Appendix B**.

### 4.2 DB table (created by seeding, inside `resale.db`)

```sql
CREATE TABLE IF NOT EXISTS bto_projects (
  launch_id         TEXT NOT NULL,     -- '2026-06'
  launch_label      TEXT,
  application_start TEXT,              -- 'YYYY-MM-DD' or NULL
  application_end   TEXT,
  project           TEXT NOT NULL,     -- 'LAKEVIEW CASCADIA'
  display_name      TEXT,
  town              TEXT NOT NULL,     -- 'BISHAN'
  classification    TEXT,              -- 'Standard'|'Plus'|'Prime'
  location_desc     TEXT,
  lat               REAL,
  lng               REAL,
  waiting_months    INTEGER,
  bto_label         TEXT,              -- '' for upcoming projects with no flat data yet
  resale_flat_type  TEXT,              -- '2 ROOM' etc., or NULL for upcoming
  floor_area_sqm    REAL,
  units             INTEGER,
  price_min         INTEGER,
  price_max         INTEGER
);
CREATE INDEX IF NOT EXISTS idx_bto_project ON bto_projects(project);
```

One row per entry in `flats[]`; a project with an empty `flats[]` (upcoming) gets exactly one row
with `bto_label = ''` and NULL flat fields, so it still appears in listings/search.
`hdb_quoted_resale` is NOT stored in the DB — the server reads it straight from the JSON at startup
into an in-memory map keyed by project name (it's display-only garnish).

**Launch status is computed, not stored** (server-side helper):
`upcoming` if `application_start` is NULL or in the future; `open` if today is within start/end;
`closed` otherwise.

---

## 5. Implementation steps

Work through these in order. Run `npm test` after every step that touches `server/index.js` or tests.

### Step 5.1 — Create the seed JSON

**Files**: `scripts/bto_launches.json` (new)

1. Create the file with the June 2026 launch from **Appendix A** and skeleton entries (label +
   sources + towns) for the four backfill launches and Nov 2026, per Appendix B. It is acceptable
   to land June 2026 fully and leave the backfill launches as skeletons for a follow-up curation
   pass — the feature must work correctly with however many launches are present.
2. Fill `lat`/`lng` for each June 2026 project. Method: query OneMap search
   (`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=<street>&returnGeom=Y&getAddrDetails=Y`)
   with the most specific street from `location_desc` (e.g. "Berlayar Street", "Woodgrove Avenue",
   "Ang Mo Kio Avenue 2"), take the first result's `LATITUDE`/`LONGITUDE`, and sanity-check the
   point is in the right town (compare against nearby rows in `hdb_block_coords` for that town).
   A throwaway script is fine; do not build permanent tooling for this.

**Verify**: `node -e "const j=require('./scripts/bto_launches.json'); console.log(j.launches.length)"` parses; every
June 2026 project has non-null lat/lng inside Singapore bounds (lat 1.2–1.5, lng 103.6–104.1).

### Step 5.2 — Seeding (Python + server fallback)

**Files**: `scripts/download_data.py`, `server/index.js`

1. **Python** (runs on every full DB rebuild, which replaces `resale.db` nightly): add a
   `seed_bto_projects(conn)` function that reads `scripts/bto_launches.json`, executes the
   `CREATE TABLE`/`CREATE INDEX` from §4.2 (drop + recreate is fine — the JSON is the source of
   truth), and inserts all rows. Call it where `seed_hdb_block_coords()` is called.
2. **Server startup fallback** (protects a live DB that predates this feature): add
   `seedBtoProjects(DB_PATH)` next to `seedHdbBlockCoords` (`server/index.js:60`) following its
   exact pattern — check `sqlite_master` for the table; if missing, open a **separate writable**
   connection, create + insert from the JSON, close it. Call it right after `seedHdbBlockCoords(DB_PATH)`
   (`server/index.js:53`). Also load the `hdb_quoted_resale` map from the JSON here (plain
   `require`, module-level `const`).

**Gotchas**:
- `resale.db` is opened read-only (`server/index.js:50`) — writes must use a separate `new Database(dbPath)` like the existing seeder.
- The Python seeder must run **after** the table's data would be wiped, i.e. inside the normal rebuild flow — the whole DB file is rebuilt from scratch, so just call it once during build.
- Remember `PRAGMA wal_checkpoint(TRUNCATE)` is already part of `deploy:data` — no change needed there.

**Verify**: delete the local table (`DROP TABLE bto_projects`) → start server → table re-appears with the right row count logged.

### Step 5.3 — API endpoints

**Files**: `server/index.js`. Add the three handlers together, after `/api/valuation`
(`server/index.js:1795`) and before the SEO endpoints. All are GET, all behind the existing DB
middleware (register them normally; the middleware already guards `/api/`).

**A. `GET /api/bto/launches`** — the `/bto` index page payload.
Returns launches (newest first) with projects grouped and flat rows nested:
```jsonc
{ "launches": [ { "launch_id": "2026-06", "label": "...", "status": "closed",
    "application_start": "...", "application_end": "...",
    "projects": [ { "project": "...", "display_name": "...", "town": "...", "classification": "...",
        "location_desc": "...", "lat": ..., "lng": ..., "waiting_months": ...,
        "total_units": 1221,   // SUM(units)
        "flats": [ { "bto_label": "...", "resale_flat_type": "...", "floor_area_sqm": ..., "units": ..., "price_min": ..., "price_max": ... } ] } ] } ] }
```

**B. `GET /api/bto/projects?q=<text>&limit=10`** — autocomplete. Mirror
`/api/private/projects` (`server/index.js:1137`): validate `q` (trim, length ≤ 100, else 400),
`SELECT DISTINCT project, display_name, town, classification, launch_id FROM bto_projects WHERE project LIKE ?`
with `%q%` (uppercased), parameterized (**never** string-interpolate — see the SQL-injection fix
history in `memory-bank/progress.md`).

**C. `GET /api/bto/project-overview?project=<name>`** — the project page payload.
1. Fetch all `bto_projects` rows for the project (case-insensitive exact match on `project`); 404 `{ error: 'Project not found' }` if none.
2. For each distinct `resale_flat_type` in the project's flats, compute nearby resale comps:
   - `findNearbyHdbBlocks(lat, lng, 1000)` (`server/index.js:706`) → block/street pairs → query
     `transactions` (`dataset_source != 'URA_PRIVATE'`) for that `flat_type`, last 12 months
     (reuse `monthsAgoStr`), matching `(block || '|' || street_name) IN (...)` — copy the pair-matching
     pattern from `/api/nearby-hdb` (`server/index.js:1683`).
   - If < 5 comps → retry at 2000m → if still < 5, fall back to town+type (12 months). Record which
     rung was used as `comps_basis`: `'1000m' | '2000m' | 'town'`.
   - Output per flat type: `{ resale_flat_type, comps_count, comps_basis, resale_median, resale_p25, resale_p75, resale_median_psm, median_remaining_lease, discount_pct }`
     where `discount_pct = Math.round((1 - ((price_min+price_max)/2) / resale_median) * 100)` (null when no comps). Use the existing `median()`/`percentile()` helpers.
3. Response: `{ project, display_name, town, classification, launch_id, launch_label, status, application_start, application_end, location_desc, lat, lng, waiting_months, flats: [...], comparison: [...], hdb_quoted_resale: [...] }`.
   If lat/lng are null, return `comparison` computed via the town fallback only.

**Exports**: if any new pure helper is added (e.g. `launchStatus()`), export it via `_test` in
`module.exports` (`server/index.js:2845`).

**Verify**: `curl 'localhost:3000/api/bto/project-overview?project=LAKEVIEW%20CASCADIA' | python3 -m json.tool`
shows flats + a comparison array with plausible medians.

### Step 5.4 — Search bar resolution (CORE REQUIREMENT)

**Files**: `server/index.js` (`/api/resolve`, line 560), `public/js/app.js` (`search()`, line 438), `public/js/api.js`

Typing **"Lakeview Cascadia"** (any case) in the search bar must land on the BTO project page.

1. In `/api/resolve`: after the exact-town / district checks but **before** the partial-town match
   and private-project fallback, query `bto_projects` for a case-insensitive **exact** name match →
   return `{ resolved: true, type: 'bto', project, display_name, town }`. Then, only if nothing else
   matched at all, also try a BTO `LIKE %q%` match (single hit → resolve; multiple → prefer exact).
   ⚠️ **Ordering matters**: BTO names often *contain* town names ("SEMBAWANG PORTICO", "KEBUN BARU
   RIDGE"). The current town partial-match (`t.includes(inputUpper)` with word-boundary) should not
   swallow these, but write the regression tests in Step 5.7 to prove it: `SEMBAWANG PORTICO` → `bto`,
   plain `SEMBAWANG` → `town`.
2. In `app.js` `search()`: handle `resolved.type === 'bto'` → call `API.getBtoProjectOverview(name)`
   → `renderBtoResults(data)` (Step 5.5).
3. In `api.js`: add `getBtoLaunches()`, `searchBtoProjects(q, limit)`, `getBtoProjectOverview(project)` following the file's existing 5-line fetch pattern.
4. **Autocomplete**: in `app.js` `updateAc()` (the async lookups around line 1660–1684), add a
   `API.searchBtoProjects(q, 3)` lookup alongside the private-project one. Item shape:
   `{ icon: '🏗️', label: display_name, sub: '<TitleCase town> · <classification> BTO', value: display_name, type: 'bto' }`.
   In `renderAc()` (line 1694) the badge class ternary needs a `bto` case — use amber-like styling distinct from `town`/`district`/`project`.

**Verify** (manual, `npm run dev`): type "lakeview" → dropdown shows the BTO entry; Enter → BTO page renders; "sembawang" still resolves to the town.

### Step 5.5 — Frontend BTO pages

**Files**: `public/index.html`, `public/js/app.js`, `public/js/map.js` (likely no change), `public/css/styles.css` (only if needed)

**A. Project page — `renderBtoResults(data)`** (new method in `App`, modeled on
`renderPrivateResults`, `app.js:1457`). Reuse the existing results section skeleton; hide the
sections that don't apply (trend chart, distribution chart, transactions table, valuation card).
Content, top to bottom:

1. **Header**: display name; badges for classification (color-code: Standard = gray, Plus = blue, Prime = purple), town (link to `/hdb/<town-slug>`), launch label, computed status (`upcoming` = amber "Applications not open", `open` = green "Applications open <start>–<end>", `closed` = neutral "Applications closed <end>").
2. **Stat cards** (reuse existing stat-card markup): total units, waiting time ("~X yrs Y mo"), price range across flat types, classification.
3. **Flats table**: one row per flat variant — BTO label, floor area (**convert with `App.sqmToSqft()` — DB/JSON stores sqm, display is sqft**; same rule as everywhere in this app), units, indicative price range.
4. **"BTO vs nearby resale" comparison table** — the centerpiece. One row per flat type:
   BTO range | nearby resale median (+ p25–p75) | discount % (green badge when positive) | comps note
   ("N sales within 1km in last 12 mo, ~Yy lease left" — wording varies by `comps_basis`; for `town`
   basis say "across <town>"). If `hdb_quoted_resale` exists, add a muted footnote line per row:
   "HDB's quoted comparable at launch: $X–$Y".
5. **Mandatory disclaimer block** (verbatim or near-verbatim):
   > Indicative price ranges from HDB at launch, excluding grants; actual prices vary by unit.
   > Resale figures are actual transactions of nearby flats with older leases — a new BTO has a
   > full 99-year lease but a ~X-year wait. Not financial advice.
6. **Map**: reuse the private-project pattern — `TransactionMap.loadPreGeocoded`-style pin at
   project lat/lng + nearby resale markers via `API.getNearbyHDB(lat, lng)` chained **after** map
   load resolves (copy the ordering from `renderResults`; there was a race bug here before — see
   `memory-bank/activeContext.md` "Condo marker race fixed"). Skip the map entirely when lat/lng is null.
7. Call `this._onResultsShown()` and `this.updateSeoForSearch('bto', data)` at the end (see Step 5.6).

**B. Launch index page — route `/bto`**: simple render — for each launch (newest first): heading
with label + status, then a card grid of projects (name, town, classification badge, unit count,
price span, "~Xy wait") linking to `/bto/<slug>`. Entry link: add "BTO Launches" to the footer nav
in `index.html` next to About/Methodology/Data Sources, and a one-line link on the homepage near
the town-links SEO block.

**C. Routing** (`app.js`):
- `handleUrlRoute()` (line 72): add `/^\/bto$/` → render index; `/^\/bto\/([^/]+)$/` → slug →
  project name (slug = lowercase, spaces→`-`; resolve back by matching against `searchBtoProjects`
  results or a dedicated exact-slug lookup — simplest is to slugify `display_name` client-side and
  compare). Unknown slug → fall through to normal search of the de-slugged text.
- `updateSeoForSearch` (line 155): add a `bto` case pushing `/bto/<slug>` with title
  `<Display Name> BTO — <TitleCase Town> <classification> (<Launch Label>) | WorthIt`; GA4
  `page_view` fires automatically through the existing code path.
- Track GA4 events via the existing `App.track()`: `view_results` with `result_type: 'bto'`.

### Step 5.6 — SEO

**Files**: `server/index.js` (`/api/seo/metadata` line 2200, `/api/seo/sitemap` line 2112). The
Cloudflare edge function (`functions/[[path]].js`) needs **no changes** — it is path-agnostic and
already injects whatever the metadata API returns for any non-static route.

1. **Metadata branches** (add near the top of the route matching, before the `/hdb/` branches):
   - `/bto` → title "HDB BTO Launches 2025/2026 — Prices & Resale Comparison | WorthIt";
     description listing latest launch towns; `content_html` = brief intro + per-launch project link
     lists (same internal-linking style as town pages); WebPage + BreadcrumbList JSON-LD.
   - `/bto/<slug>` → match slug against `bto_projects` (slugify `display_name` the same way as the
     client). Found: title "<Display Name> BTO Price — <Flat types> from $Xk (<Launch Label>) | WorthIt",
     description with price span + town + classification; `content_html` with the flats table,
     the comparison summary (recompute or summarize cheaply — town-basis medians are fine here),
     links to the town page + sibling projects; JSON-LD WebPage + BreadcrumbList (Home → BTO →
     project) + FAQPage prose via `faqsToHtml()` (line 2083) — e.g. "How much does a 4-room flat at
     X cost?", "When will X be completed?" (answer with waiting time), "Is X cheaper than resale
     flats nearby?". Not found: keep canonical = `/bto` + `noindex, follow` (existing soft-404
     pattern, see the `meta.robots` handling).
   - Include `dateModified`/freshness note like other branches do (the `latestMonth` variable is already computed at the top of the handler).
2. **Sitemap**: add `/bto` (priority 0.7, weekly) + one URL per **priced** project (priority 0.6,
   monthly). Skip `upcoming` skeleton projects with no flats.

### Step 5.7 — Tests

**Files**: `tests/fixtures/seed.js`, `tests/integration/bto.test.js` (new),
`tests/integration/resolve.test.js`, `tests/integration/seo.test.js`, `tests/unit/helpers.test.js`

1. **Fixture** (`seed.js`): add the `bto_projects` CREATE TABLE (§4.2) and seed 2 projects:
   - `BEDOK VISTA CREST` (fictional, launch `2026-06`, town `BEDOK`, `Standard`, lat/lng
     `1.3253, 103.9303` — inside the existing BEDOK NORTH ST 1 cluster so the 1000m comps ladder
     finds the 3-ROOM fixture rows), flats: 3 ROOM 65 sqm 200 units $250k–$344k; 4 ROOM 93 sqm 300 units $320k–$437k.
   - `TOA PAYOH SUMMIT` (fictional, launch `2026-11`, town `TOA PAYOH`, `upcoming`: empty flat fields, null lat/lng).
   ⚠️ Adding a table + rows does NOT change any transaction counts, so existing count assertions
   (`status.test.js` total 42, `area-overview.test.js` BEDOK counts) must stay untouched — if they
   break, you did something wrong.
2. **`bto.test.js`** (~12 tests):
   - `/api/bto/launches`: 200; launches sorted newest-first; project nesting shape; `total_units` sum; upcoming project present with empty flats.
   - `/api/bto/projects?q=vista`: finds the project; `q` > 100 chars → 400.
   - `/api/bto/project-overview?project=BEDOK VISTA CREST`: 200; `comparison` has a `3 ROOM` entry
     with `comps_count ≥ 5`, `comps_basis: '1000m'`, `resale_median` between 279000 and 300000
     (the fixture 3-ROOM prices), and a positive `discount_pct`; case-insensitive lookup works;
     unknown project → 404. Upcoming project → 200 with town-fallback/empty comparison and no crash.
3. **`resolve.test.js` additions** (regression-critical):
   - `lakeview` equivalent for fixture: `BEDOK VISTA CREST` → `{ type: 'bto' }` (exact, case-insensitive).
   - `BEDOK` still → town; `BEDOK VISTA CREST` must NOT resolve as town BEDOK (name-contains-town guard).
   - `vista crest` (partial, unambiguous) → `bto`.
4. **`seo.test.js` additions**: `/bto` metadata 200 with title; `/bto/bedok-vista-crest` has
   project title + `content_html`; unknown `/bto/nope` → `noindex, follow`; sitemap contains `/bto`
   and the project URL but NOT the upcoming skeleton project.
5. **Unit**: `launchStatus()` (or equivalent) via `_test` exports — upcoming/open/closed boundaries.

**Verify**: `npm test` — all existing tests still pass (expected new total: 213 + ~20). Do not
run smoke tests (they hit production, which won't have the feature yet).

### Step 5.8 — Wrap-up (mandatory project conventions)

1. Run `npm test` one final time — must be fully green.
2. Update `memory-bank/activeContext.md` (new "Recent Changes" section describing what was built,
   marked **local only — user handles commit + deploy**) and `memory-bank/progress.md` (What Works
   additions + new test count).
3. Update `CLAUDE.md` Key Patterns with a short "BTO launches" paragraph (seed JSON → `bto_projects`
   table → endpoints → `/bto` routes) and the new test count.
4. **Do NOT deploy. Do NOT commit. Do NOT bump `?v=` manually** (`scripts/bump-version.js` handles
   the version bump automatically during deploy). The user does all of these.

---

## 6. Hard rules for the executing agent

- Read `memory-bank/*` before writing any code (project directive in CLAUDE.md).
- DB stores **sqm**; every displayed area/price-rate goes through `App.sqmToSqft()` / `App.psmToPsf()`.
- All SQL uses parameterized placeholders. No string interpolation of user input, ever.
- Never write to the read-only `db` connection; seeding opens its own writable connection and closes it.
- Never insert BTO rows into `transactions`.
- Never fetch `homes.hdb.gov.sg` from code.
- Match existing code style (vanilla JS object-literal "classes", Tailwind utility classes, `dark:` variants for every new UI element, existing toast/badge/card markup patterns).
- New UI must work in light **and** dark theme and on mobile (test at 375px width).

---

## 7. Acceptance checklist

- [ ] Typing "Lakeview Cascadia" (or fixture equivalent) in the search bar opens the BTO project page; autocomplete shows it with a `bto` badge while typing.
- [ ] "Sembawang" still resolves to the town, "Sembawang Portico" to the BTO project.
- [ ] Project page shows flats table (sqft), comparison vs nearby resale with discount %, map with project pin + nearby resale markers, status badge, disclaimer.
- [ ] `/bto` lists all seeded launches incl. Nov 2026 as upcoming; footer link exists.
- [ ] Direct navigation / refresh on `/bto` and `/bto/<slug>` works (SPA route handling).
- [ ] `/api/seo/metadata?route=/bto/<slug>` returns rich metadata; sitemap includes BTO URLs.
- [ ] `npm test` fully green; no existing assertion changed except where this plan says so (none expected).
- [ ] memory-bank + CLAUDE.md updated; nothing deployed or committed.

---

## 8. Curation runbook (for each future launch — ~20–30 min, 3–4×/year)

Battle-tested across 6 launches (Jun 2026, Nov 2026 provisional, Feb 2026, and the Feb/Jul/Oct
2025 backfill). Follow this in order; every gotcha below was hit for real at least once.

### 8.1 Quick checklist

- [ ] Find the press release; download the Annex A PDF (pricing) and the admin-details annex (dates).
- [ ] Extract both PDFs with `pypdf`.
- [ ] Resolve each project's HDB *town* (must match a value already in `transactions.town`).
- [ ] Geocode each project (try the project name itself first — see 8.4).
- [ ] Sanity-check every coordinate against existing `hdb_block_coords` for that town.
- [ ] Check for CCA (Community Care Apartment) rows — exclude from `flats[]` (see 8.5).
- [ ] Check for a **reused project name** against every other launch already in the file (see 8.6).
- [ ] Write the launch object into `scripts/bto_launches.json` (schema in §4 above).
- [ ] Verify: JSON parses, coords in bounds, unit totals match the press release headline, no
      duplicate `project` keys anywhere in the file (script in 8.7).
- [ ] `npm test` — must stay green with **no new test failures and no test file changes** (seeding
      is pure data; if a test breaks, the data is wrong, not the test).
- [ ] Reseed + verify live (8.8).
- [ ] Update `memory-bank/activeContext.md` with what was added (one section per seeding session
      is fine — don't rewrite prior sections).

### 8.2 Finding the press release and Annex A

Search: `HDB <Month> <Year> BTO sales exercise press release`. The canonical press release lives at
`https://www.hdb.gov.sg/hdb-pulse/news/<year>/<slug>` — grab the exact slug from the search result,
you'll need it for the Annex URL.

**Annex A URL pattern is not fully stable — try in this order, don't assume:**
1. `https://www.hdb.gov.sg/-/media/hdb-pulse/news/<year>/<press-release-slug>/Annex-A.pdf` (worked
   for Jun 2026, Feb 2026 — try this first, it's the common case).
2. If that 404s (comes back as an HTML page, not a PDF — always check with `file` after downloading,
   never assume a 200 status means you got the PDF), search
   `"hdb.gov.sg" <month> <year> BTO "Annex-A" site:hdb.gov.sg` — Google's index usually has the
   exact working filename. Two real variants hit during backfill:
   - Jul 2025 needed a **date suffix**: `Annex-A-20250723.pdf` (the publish date, `YYYYMMDD`).
   - Oct 2025 used a **completely different naming scheme**:
     `Annex-ABTO-sales-exercise-Oct-2025.pdf`, and its admin-details annex was **Annex C**, not
     Annex B (that launch had no concurrent SBF exercise, which seems to shift the lettering).
3. The admin-details annex (application dates) is usually **Annex B**, but check the search result
   title (e.g. "ANNEX B ADMINISTRATIVE DETAILS FOR ...") or "ANNEX C ..." — just search
   `"hdb.gov.sg" <month> <year> BTO "Annex-B" OR "Annex-C" site:hdb.gov.sg` if unsure.

Download both PDFs to the scratchpad directory and verify with `file <name>.pdf` before parsing —
a failed fetch silently returns an HTML error page with a `.pdf` extension.

### 8.3 Extracting the data

```bash
/Users/weisong/Video/WorthOrNot/venv/bin/python3 -c "
from pypdf import PdfReader
r = PdfReader('<path>.pdf')
for i, p in enumerate(r.pages):
    print(f'===== PAGE {i+1} =====')
    print(p.extract_text())
"
```
(Install `pypdf` into the venv first if missing: `venv/bin/python3 -m pip install --quiet pypdf`.)

Annex A gives you, per project: classification (Standard/Plus/Prime — it's a section header, not a
per-row column), waiting time, and a table of flat type × floor area × units × price range. It also
has a second section, "COMPARISON OF NEW FLATS AND RESALE COMPARABLES NEARBY" — that's the
`hdb_quoted_resale` data (HDB's own nearby-resale comparison, shown as a footnote on the project page).
The admin-details annex's "Submission of Application" paragraph gives `application_start`/`application_end`.

### 8.4 Determining towns

Every project's `town` field must **exactly match** a value already in the `transactions` table —
check with:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('server/db/resale.db', { readonly: true });
console.log(db.prepare(\"SELECT DISTINCT town FROM transactions WHERE town IS NOT NULL ORDER BY town\").all().map(r=>r.town));
"
```
Press releases and blogs use neighbourhood/estate names (e.g. "Simei", "Redhill", "Kim Keat",
"Chencharu") that don't always match the HDB *town* name directly — cross-reference against this
list. When in doubt, geocode the project (next step) and check which existing town's blocks are
physically nearby.

### 8.5 Geocoding

**Try the project name itself first** — most BTO project names resolve directly to a real
registered address via OneMap, often *more* precisely than any street search:
```bash
curl -s -G "https://www.onemap.gov.sg/api/common/elastic/search" \
  --data-urlencode "searchVal=<PROJECT NAME>" --data-urlencode "returnGeom=Y" \
  --data-urlencode "getAddrDetails=Y" --data-urlencode "pageNum=1" | python3 -m json.tool
```
This worked directly for the large majority of projects across all 6 launches seeded so far
(e.g. "SEMBAWANG PORTICO", "REDHILL PEAKS", "CHENCHARU VINES" all returned exact block addresses).
Only fall back to searching the location description's street/landmark name (from the press
release or a BTO preview blog) when the bare project name returns nothing.

**Always sanity-check** the result against existing HDB blocks in the same town:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('server/db/resale.db', { readonly: true });
const rows = db.prepare(\"SELECT hbc.lat, hbc.lng FROM hdb_block_coords hbc JOIN transactions tx ON tx.block=hbc.block AND tx.street_name=hbc.street_name WHERE tx.town=? LIMIT 5\").all('<TOWN>');
console.log(rows);
"
```
A new BTO site can legitimately be 1–2km from the nearest sampled existing block (new estates are
often at town edges — Bayshore, Woodlands North, Tengah, etc. all check out this way) — that's
normal, not a red flag. What *would* be a red flag: multiple kilometres off, or in the wrong general
region of the island entirely.

### 8.6 Reused project names (rare but confirmed real)

**HDB does sometimes reuse the exact same project name across two different launch exercises** —
confirmed with "Redhill Peaks" (Oct 2025 phase 1, 1,021 units, 2RF+4R only; Feb 2026 phase 2, 1,052
units, 2RF+3R+4R), split across two exercises due to site-prep timelines for separate land parcels
of the same estate. Before adding any project, **grep the whole file for its name**:
```bash
node -e "
const j = require('./scripts/bto_launches.json');
const seen = {};
for (const l of j.launches) for (const p of l.projects) {
  if (seen[p.project]) console.log('COLLISION:', p.project, 'in', l.launch_id, 'and', seen[p.project]);
  seen[p.project] = l.launch_id;
}
"
```
If a collision is found: **the app's schema treats `project` as a globally unique lookup key**
(`/api/resolve` and `/api/bto/project-overview` both do `WHERE UPPER(project) = ?` with no
`launch_id` filter) — two rows sharing that key silently conflate both launches' flats, prices, and
waiting times into one broken record. Disambiguate **both** entries (not just the new one — go back
and fix the earlier one too) as `project: "NAME (MONTH YEAR)"` / `display_name: "Name (Month Year)"`,
and add a one-line note in `location_desc` on both explaining the split.

### 8.7 Verification before reseeding

```bash
node -e "
const j = require('./scripts/bto_launches.json');
const l = j.launches.find(x => x.launch_id === '<YYYY-MM>');
let total = 0;
for (const p of l.projects) {
  const u = p.flats.reduce((s,f)=>s+(f.units||0),0);
  total += u;
  const inBounds = p.lat==null || (p.lat>=1.2 && p.lat<=1.5 && p.lng>=103.6 && p.lng<=104.1);
  console.log(p.project, p.town, 'inBounds='+inBounds, 'units='+u);
}
console.log('TOTAL:', total);
"
```
**Cross-check the total against the press release's headline unit count.** This has matched exactly
every single time so far (Feb 2025: 5,032; Jul 2025: 5,547; Feb 2026: 4,692) and is strong evidence
the extraction is correct. If it's off, the gap is usually a CCA row you correctly excluded (Oct
2025: 8,937 in `flats[]` + 207 excluded CCA units = 9,144 exactly) — reconcile the difference
explicitly in a `_curation_note` rather than silently absorbing it.

### 8.8 Reseed and verify live

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('server/db/resale.db');
db.exec('DROP TABLE IF EXISTS bto_projects');
db.close();
"
# then restart the dev server (npm run dev / node server/index.js) — it reseeds on startup.
```
Then spot-check a couple of the new projects live:
```bash
curl -s 'http://localhost:3000/api/bto/project-overview?project=<PROJECT NAME>' | python3 -m json.tool
curl -s 'http://localhost:3000/api/resolve?q=<project name>' | python3 -m json.tool   # exact-match resolve works
```
In production, the nightly refresh workflow rebuilds `resale.db` from scratch (Python's
`seed_bto_projects()` always drops+recreates the table from the JSON) and re-seeds automatically —
no manual step needed there once the JSON is committed and deployed.

### 8.9 Provisional / not-yet-launched exercises

For a launch that hasn't officially happened yet (no HDB press release or Annex A exists): only
add project rows if third-party BTO preview trackers report **firm, unambiguous per-flat-type unit
counts** for that specific project — if a source only gives an aggregate/combined figure for
multiple sites (e.g. two neighbouring projects reported as one combined total), do **not** invent a
per-type split; add a single aggregate `flats[]` entry with `resale_flat_type: null` instead (the
comparison-table logic already skips null types cleanly — see `/api/bto/project-overview`'s
`.filter(Boolean)` on the type `Set`). Set `price_min`/`price_max: null` on every flat (frontend
renders "Price TBD"), `classification: null` if not yet announced, `application_start/end: null`,
and add a `_provisional_note` per project naming the source type (never claim it's official). The
frontend's "upcoming" status (driven purely by `application_start` being null or in the future)
automatically shows the amber "Provisional" warning banner — no extra flag needed. **Replace this
data with the real thing** once HDB's official Annex A is published, following 8.1–8.8 normally.

---

## 9. Phase-2 candidates (explicitly deferred)

- `nearby_bto` in `/api/nearby-hdb` + dashed-ring BTO markers on postal/town search maps ("a BTO is launching 400m from this block") — highest-value follow-up.
- Application rates per project (demand signal) once published.
- "What did flats from the <year> launch resell for" pages as old launches pass MOP and enter the resale data.
- Launch-index SEO pages per exercise (`/bto/2026-june`).

---

## Appendix A — June 2026 launch data (extracted from official HDB Annex A, verified)

Sources:
- Press release: `https://www.hdb.gov.sg/hdb-pulse/news/2026/hdb-launches-6952-flats-across-7-projects-in-june-2026-bto-sales-exercise`
- Annex A (pricing): `https://www.hdb.gov.sg/-/media/hdb-pulse/news/2026/20260617-HDB-Launches-6952-Flats-Across-7-Projects-in-June-2026-BTO-Sales-Exercise/Annex-A.pdf`
- Locations: `https://www.mynicehome.gov.sg/get-started/hdb-bto-sales-launch/`

Launch: `launch_id: "2026-06"`, application 2026-06-17 → 2026-06-24. 6,952 units, 7 projects.
(2-room Flexi prices below are 99-year-lease prices, excluding grants.)

| project | town | class | location_desc | wait (mo) | flats: label / resale_flat_type / sqm / units / min–max |
|---|---|---|---|---|---|
| SEMBAWANG PORTICO | SEMBAWANG | Standard | Bounded by Admiralty Lane and Sembawang Drive | 31 | 2RF T1 / 2 ROOM / 40 / 50 / $142k–$184k · 2RF T2 / 2 ROOM / 48 / 150 / $157k–$225k · 3-Room / 3 ROOM / 69 / 100 / $250k–$344k · 4-Room / 4 ROOM / 93 / 300 / $320k–$437k · 5-Room / 5 ROOM / 113 / 275 / $465k–$579k |
| SEMBAWANG BROOK | SEMBAWANG | Standard | Bounded by Admiralty Street and Sungei Sembawang | 33 | 2RF T1 / 2 ROOM / 40 / 58 / $139k–$187k · 2RF T2 / 2 ROOM / 48 / 203 / $164k–$218k · 3-Room / 3 ROOM / 69 / 87 / $257k–$333k · 4-Room / 4 ROOM / 93 / 464 / $302k–$428k · 5-Room / 5 ROOM / 113 / 319 / $420k–$571k · 3Gen / MULTI-GENERATION / 120 / 29 / $468k–$567k |
| WOODGROVE ACRES | WOODLANDS | Standard | Along Woodgrove Avenue | 42 | 2RF T1 / 2 ROOM / 40 / 31 / $137k–$170k · 2RF T2 / 2 ROOM / 48 / 126 / $164k–$211k · 3-Room / 3 ROOM / 69 / 80 / $260k–$325k · 4-Room / 4 ROOM / 93 / 162 / $353k–$437k · 5-Room / 5 ROOM / 113 / 257 / $472k–$582k |
| KEBUN BARU RIDGE | ANG MO KIO | Plus | Along Ang Mo Kio Avenue 2 | 37 | 3-Room / 3 ROOM / 66 / 95 / $380k–$492k · 4-Room / 4 ROOM / 89 / 390 / $543k–$693k |
| KEBUN BARU BREEZE | ANG MO KIO | Plus | Bounded by Ang Mo Kio Avenue 1 and Ang Mo Kio Rise | 52 | 2RF T1 / 2 ROOM / 38 / 261 / $191k–$275k · 2RF T2 / 2 ROOM / 48 / 116 / $255k–$349k · 4-Room / 4 ROOM / 90 / 202 / $547k–$746k |
| LAKEVIEW CASCADIA | BISHAN | Prime | Bounded by Upper Thomson Road | 51 | 2RF T1 / 2 ROOM / 40 / 118 / $216k–$287k · 2RF T2 / 2 ROOM / 49 / 358 / $257k–$361k · 4-Room / 4 ROOM / 90 / 745 / $534k–$742k |
| BERLAYAR RISE | BUKIT MERAH | Prime | Bounded by Berlayar Street and Berlayar Drive (next to Telok Blangah MRT) | 54 | 2RF T1 / 2 ROOM / 40 / 172 / $247k–$341k · 2RF T2 / 2 ROOM / 48 / 644 / $296k–$406k · 3-Room / 3 ROOM / 67 / 172 / $435k–$591k · 4-Room / 4 ROOM / 90 / 988 / $592k–$810k |

`hdb_quoted_resale` (HDB's own published nearby-resale comparables, per project — optional field):
- SEMBAWANG PORTICO / SEMBAWANG BROOK: 2R $322k–$390k · 3R $500k–$528.9k · 4R $600k–$680k · 5R $685k–$820k (~93y lease)
- WOODGROVE ACRES: 2R $365k–$423k · 3R $510k–$556k · 4R $650k–$750k · 5R $777k–$815.2k (~92y lease)
- KEBUN BARU RIDGE / BREEZE: 4R $830k–$1,080k (~91y lease; no 2R/3R comparables quoted)
- LAKEVIEW CASCADIA: 4R $840k–$950k (~71y lease, 102 sqm; no 2R comparable quoted)
- BERLAYAR RISE: 3R $740k–$771k · 4R $938.9k–$1,068k (~91y lease; no 2R comparable quoted)

Note: Berlayar Rise waiting time was published as "49/54" (two phases) — store 54.

## Appendix B — Backfill sources (2025 + Feb 2026 + Nov 2026)

Same extraction recipe per launch (press release → Annex A PDF → tables like Appendix A):

| launch_id | exercise | starting point |
|---|---|---|
| 2025-02 | Feb 2025 BTO (~5,000+ flats) | search "HDB February 2025 BTO sales exercise press release" on hdb.gov.sg |
| 2025-07 | Jul 2025 BTO | search "HDB July 2025 BTO sales exercise press release" |
| 2025-10 | Oct 2025 BTO (9,144 flats, 10 projects) | `https://www.hdb.gov.sg/cs/infoweb/about-us/news-and-publications/press-releases/october-2025-bto-sales-exercise` |
| 2026-02 | Feb 2026 BTO (~4,600 flats; Bukit Merah, Sembawang, Tampines, Toa Payoh) | search "HDB February 2026 BTO sales exercise press release" |
| 2026-11 | Nov 2026 BTO (announced; towns from the Jun 2026 press release "upcoming supply" section) | skeleton entry only — `application_start: null`, no prices until launch |

Annex URL pattern (recent launches): `https://www.hdb.gov.sg/-/media/hdb-pulse/news/<year>/<date>-<press-release-slug>/Annex-A.pdf`.
Older 2025 releases live under `/cs/infoweb/about-us/news-and-publications/press-releases/…` with annex links in the page body.
The extracted Jun 2026 PDFs used to build Appendix A were parsed with `pypdf` — the same approach works for backfill.
