# Product & Feature Proposal — WorthIt

*Prepared July 2026 — based on an independent exploration of the codebase (no code changed).*

## What the app is

WorthIt ([worthit.canlah.app](https://worthit.canlah.app)) is a Singapore resale property price tracker: ~370K HDB transactions from data.gov.sg plus 138K URA private-property records in one SQLite DB, served by an Express API on Fly.io behind a static SPA on Cloudflare Pages. Users search by **town, postal code, district, or private project name** and get an area overview (median, $psf, range), dual-line HDB/private trend charts, a price-distribution histogram, a deal-score-colored transaction map, and a filterable comparables table. Data auto-refreshes daily via GitHub Actions.

**Personas**: (1) HDB resale *buyers* validating an asking price, (2) *sellers* benchmarking their flat, (3) *upgraders/browsers* comparing areas and watching trends. All three converge on one question the app's own product brief states: *"is this price fair?"*

## Current user journeys

1. **Postal-code check** — enter 6-digit code → OneMap resolves → 500m-radius block query → nearby comparables, pinned block, map. The most "personal" journey today.
2. **Town/district research** — browse a whole town's stats, per-flat-type cards, trends, and transactions; multi-select flat types.
3. **Private project lookup** — project overview with district context, EC/MOP detection.
4. **Share/return** — deep links (`/hdb/tampines/4-room`, `/postal/523876`), share button, SEO pages for organic entry.

The notable gap: every journey ends at *"here is the market data."* None ends at *"here is your answer."* The user still does the last mile of judgment — comparing, computing, and remembering — in their head.

**Key discovery**: the DB build (`scripts/download_data.py`) precomputes `town_stats`, `monthly_medians`, and `storey_adjustments` tables, but `server/index.js` never queries any of them. That is planned-but-unshipped valuation machinery, which shapes the first recommendation.

---

## Feature Proposals

### 1. "Check My Price" — a true Deal Score & Fair Value calculator ⭐ highest value

**What it is**: A form (asking price, postal code/block, flat type, floor area, storey range, remaining lease) that returns a **fair-value estimate, a 0–100 Deal Score, and the percentile** the asking price sits at among adjusted comparables — e.g. *"$685K is ~4% above fair value for a mid-floor 4-room here; 68th percentile of the last 12 months within 500m."*

**Pain point**: This is the app's founding promise — `memory-bank/projectbrief.md` lists "Deal Score (0–100)" and "Fair Market Value estimation" as key features — but today the deal score only exists as *relative map-marker coloring*. A buyer holding a specific asking price still has to eyeball the histogram and mentally adjust for floor and lease.

**Implementation**:
- The data layer already exists: `download_data.py` precomputes `town_stats`, `monthly_medians`, and `storey_adjustments` (storey-premium multipliers per town × flat type × storey range), and **the server never uses them** — wire them up.
- New `GET /api/valuation` in `server/index.js`: select comparables via the existing `findNearbyHdbBlocks()` 500m pipeline + flat type + lease band; adjust each comp's $psm by `storey_adjustments`; median × subject area = fair value; percentile from the same array (percentile code already exists in `/api/area-overview`).
- Frontend: a collapsible "Check a price" panel in `public/index.html` under the search card; result card in `public/js/app.js` reusing the existing green→blue→red scale from `map.js`'s `getValueStyle()`. New route `/check` for shareability.
- Tests follow the existing pattern in `tests/integration/` against the fixture DB.

### 2. Town & flat-type comparison view

**What it is**: Compare 2–3 towns (or town×flat-type combos) side by side — median, $psf, YoY, lease profile, volume — with both trend lines on one chart. URL: `/compare/tampines-vs-bedok/4-room`.

**Pain point**: Deciding between areas is the core upgrader journey, but today it means two searches in two tabs and memorizing numbers. (The SEO backlog already lists "comparison pages" — this is that, done as a real feature, and each comparison URL becomes an indexable long-tail page: "tampines vs bedok 4 room resale price".)

**Implementation**:
- No new server aggregation needed for v1: client calls the existing `/api/area-overview` once per town in parallel (`Promise.all`, same pattern as `App.init()`).
- `app.js`: a "+ Compare" button on town results; new `renderCompareResults()`; `charts.js` `renderTrendChart()` already handles two datasets — generalize to N labeled lines.
- SEO: add a `/compare/` branch to `/api/seo/metadata` and the sitemap (top ~50 adjacent-town pairs), same structure as the town×flat-type branch shipped in June 2026.

### 3. Budget-first search — "What can I afford?"

**What it is**: Enter a budget (e.g. $600K) and optional flat type → ranked table of towns where the 12-month median fits, with median, $psf, typical lease, and volume, each row linking to the existing `/hdb/<town>/<flat-type>` page; optionally a color-coded map of Singapore.

**Pain point**: Real buyers start from a budget, not a town. The app currently has no entry point for "where *can* I buy?" — the single highest-intent question for first-timers, and one no free SG tool answers well.

**Implementation**:
- New `GET /api/affordability?budget=&flat_type=` — one GROUP BY town query over the last 12 months (or read the currently-unused `town_stats` table). Trivial with existing indexes (`idx_transactions_town_flat_month`).
- Frontend: a third search mode — a small "By budget" toggle near the flat-type buttons; results reuse the price-type-cards grid style. Route `/budget/600k/4-room` → also a strong programmatic-SEO surface ("what HDB can I buy with 600k").

### 4. Lease-decay explorer & remaining-lease filter

**What it is**: (a) a "Remaining lease" filter (e.g. 90+, 70–90, <70 yrs) alongside the flat-type buttons and in the transaction table; (b) a new chart: $psf vs remaining lease for the searched area, making lease decay visible.

**Pain point**: Lease decay is *the* HDB valuation question (CPF/loan restrictions kick in below ~60 years; older flats look deceptively "cheap"). `remaining_lease_years` is already in every row and shown in map popups, but users can't filter or analyze by it — a 60-year and a 95-year flat are averaged together in every median shown today, which quietly distorts the app's headline numbers for older towns.

**Implementation**:
- Server: add `lease_min`/`lease_max` params to `/api/area-overview`, threaded through the same clause-builder pattern as `addFlatClause()`.
- Frontend: filter pills in `index.html`; one new Chart.js scatter (bucketed line) in `charts.js` fed by a small `lease_curve` aggregation added to the area-overview response.
- Bonus: sharpens the valuation comps in Feature 1.

### 5. Search by MRT station + "nearest MRT" on every result

**What it is**: (a) type an MRT station name ("Bishan MRT") and get the same nearby-blocks analysis as a postal search, centered on the station; (b) every transaction card/map popup shows "6 min walk to Bishan (450m)".

**Pain point**: "Near which MRT" is a top-3 buyer criterion in Singapore. The app already ships `public/data/mrt_stations.json` and an MRT map overlay — but stations are display-only; you can't search by one, and comparables don't tell you transit distance.

**Implementation**:
- Search: add a station branch to `/api/resolve` (load the stations JSON server-side, name-match) returning the station's lat/lng — from there it flows through the **exact existing postal-code pipeline** (`/api/area-overview?lat=&lng=` → `findNearbyHdbBlocks()`). Very little new code.
- Nearest-MRT labels: client-side haversine in `map.js`/`app.js` against the already-loaded stations JSON — zero server or DB changes.
- Autocomplete: append stations to the existing dropdown source in `app.js` with an "MRT" badge (badge pattern already exists for private projects).

### 6. Price alerts — "Watch this area"

**What it is**: On any town/flat-type/project page, "Notify me" + email → a monthly (or on-data-refresh) email: new median, MoM/YoY change, notable transactions, deep link back.

**Pain point**: Property research spans months; today WorthIt is fire-and-forget with no reason to return. Alerts convert one-time SEO visitors into recurring users — and data already refreshes daily via GitHub Actions, so freshness is sitting there unexploited.

**Implementation**:
- Storage: a `subscriptions` table in the **existing writable `feedback.db`** (deliberately kept out of read-only, wholesale-replaced `resale.db` — same reasoning as feedback). New `POST /api/subscribe` cloned from `/api/feedback` (honeypot + rate limit + validation), plus a signed unsubscribe link.
- Delivery: a step appended to `.github/workflows/refresh-data.yml` (or a small Fly cron) that diffs medians and sends via a transactional email API; Cloudflare Email Service or Resend's free tier fits the $0/month constraint.
- UI: a small bell button next to the existing share button; modal reuses the feedback modal's structure.

---

## Suggested priority

| # | Feature | Why this order |
|---|---------|----------------|
| 1 | Check My Price | Fulfills the product's stated core promise; hard data plumbing (nearby-blocks radius query, storey adjustments, percentiles) already exists |
| 2 | Lease-decay filter (#4) | Small change; improves data honesty and Feature 1's comp accuracy |
| 3 | Comparison view (#2) | Doubles as the comparison SEO pages already in the backlog |
| 4 | Budget search (#3) | High-intent new entry point + programmatic SEO surface |
| 5 | MRT search (#5) | Mostly reuses the postal-code pipeline; assets already shipped |
| 6 | Price alerts (#6) | Retention play — worth it once traffic justifies it |

---

# Deep Dive: Check My Price (#1) & MRT Search (#5)

*Added July 2026 after code-level investigation.*

## #1 Check My Price — killing the form

### Core insight: the block is the unit of truth — and block-level data already exists

The 6-field form is almost entirely inferable from `resale.db`:

| Form field | Inferable? | How |
|---|---|---|
| Postal code / block | User already types this — it's the existing search box | `hdb_block_coords` has a `postal` column |
| Remaining lease | **Yes, exactly — zero input** | Every flat in a block shares `lease_commence_date`; `99 − (year − lease_commence_date)` |
| Flat type | Yes → 1–3 chips | `SELECT DISTINCT flat_type FROM transactions WHERE block=? AND street_name=?`; if one, preselect |
| Floor area | Yes → standard-size chips | Distinct `floor_area_sqm` per block+type; default = most common |
| Storey | Only true unknown | Low/Mid/High chips from the block's actual `storey_range` values; default Mid + show sensitivity ("high floor ≈ +$18K") |
| Asking price | The only required keystroke | Accept `685k`, `$685,000`, `0.685m` |

**Real UX: postal code + price. Two inputs.** Everything else is pre-filled, tappable chips — never a blank field.

### Three entry points, lowest friction first

1. **Inline on postal-search results (primary)** — the app already knows block, lease, types, and has 500m comps loaded. Slim card above the charts: *"💰 Seen an asking price for this block?"* with one price input.
2. **From any transaction row/card** — "Check a price like this" prefills everything from that row; user overrides only the price.
3. **Standalone `/check` route** — smart form where typing a postal code live-fetches block facts and morphs remaining fields into chips.

Rejected option: pasting a PropertyGuru/99.co listing URL and scraping — brittle, ToS-hostile; the postal code on every listing is the stable identifier anyway.

### Valuation engine — `GET /api/valuation?postal=&price=&flat_type=&storey=&area_sqm=`

1. **Resolve block** via `hdb_block_coords` by postal (lookup pattern exists at `server/index.js:1969`); pull block facts in one query.
2. **Select comps** — `findNearbyHdbBlocks(lat, lng, 500)` → same flat type, last 12 months, remaining lease ±10 years (extract shared logic from `/api/area-overview` into a helper).
3. **Storey-adjust** with the unused `storey_adjustments` table: factor = `avg_psm(town, type, subject_storey) / avg_psm(town, type, comp_storey)`.
4. **Fair value** = median adjusted $psm × subject area; report a **p25–p75 range**, not a single number.
5. **Deal Score**: deviation `d = (asking − fair)/fair`; v1 `score = clamp(50 − 250×d, 0, 100)` (−20% → 100, fair → 50, +20% → 0). Bands: ≥70 Good deal, 45–69 Fair, <45 Premium. Plus percentile of asking price among adjusted comps.
6. **Confidence**: <8 comps → widen to 1km → else fall back to `town_stats` + "Low confidence" label. Return `comps[]` so the UI shows its work.

### Result UI

Verdict card: colored score + label (same green→blue→red scale as `map.js` `getValueStyle()` so map and score agree), fair-value range, plain-English basis sentence, expandable comps list (reuses transaction-card markup), not-financial-advice disclaimer linking `/methodology`. Shareable `/check/<postal>?price=685000&type=4-room`; GA4 `valuation_check` / `valuation_result`.

### Build order

1. `/api/valuation` + integration tests (fixture DB already has block/storey/lease data)
2. Inline card on postal results — the 90% win
3. Row-level "check similar" + standalone `/check` + SEO metadata branch

## #5 MRT search + nearest-MRT labels

### Deployment gotcha found up front

`public/data/mrt_stations.json` is frontend-only and **`.dockerignore` excludes `public/`** — the Fly.io API container can't read it. Fix: canonical copy at `server/data/mrt_stations.json` (`require()`d at boot), keep the `public/data/` copy for the map overlay, with a sync-check test guarding drift.

### Phase A — nearest-MRT labels everywhere (ship first: zero server changes)

- `map.js` already loads stations for the overlay. Add `nearestStation(lat, lng)` — brute-force haversine over ~180 stations × ≤200 markers is trivial.
- Show `🚇 450m to Bishan (NS17) · ~6 min walk` (80m/min) in all 4 popup types and on mobile transaction cards (nearby-HDB transactions now carry `lat`/`lng`).
- v2 only if sort/filter by MRT distance is wanted: precompute `nearest_mrt`/`mrt_dist_m` onto `hdb_block_coords` in `download_data.py`.

### Phase B — search by station

- **Resolve** (`server/index.js:523`): MRT branch after exact town match, before fuzzy matching. Disambiguation (many stations share town names — Bishan, Tampines…): bare `bishan` → town (no regression); `bishan mrt` / `bishan station` / code `NS17` → station. Response `{ resolved: true, type: 'mrt', station, lines, lat, lng }`.
- **Autocomplete** (`app.js:1387`): append stations to `_acItems` with 🚇 icon + `mrt` badge; item value `"Bishan MRT"` so `selectAc()` → `search()` hits the disambiguated path. Typing "bishan" shows both town and station — ambiguity becomes a visible choice.
- **Search flow** (`app.js:406`): `resolved.type === 'mrt'` branch mirrors the postal path — set `searchLat`/`searchLng` → existing `/api/area-overview?lat=&lng=` pipeline. Server tweak: optional `radius` param (capped ≤1000m); use **800m** for MRT (walkable ≈ 10 min). Station-styled map pin, MRT overlay auto-on; nearby private projects free via `addNearbyProjects`.
- **URL + SEO**: `/mrt/<station-slug>` — `handleUrlRoute()` addition, `/api/seo/metadata` branch (same shape as `/postal/`), ~180 sitemap entries. "hdb resale price near <station> mrt" is high-intent, uncontested long-tail.
- **Tests**: resolve disambiguation, radius validation, SEO branch, stations-JSON sync check.

**Effort**: Phase A ~half a day; Phase B ~1–2 days (~80% reuses the postal-code plumbing).
