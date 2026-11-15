# WorthIt code audit (Fable)

- **Date:** 2026-11-13
- **Commit audited:** `d96aeae` (main, clean working tree)
- **Auditor:** Claude (Fable 5.2), read-only — no code was changed
- **Brief:** real defects only — correctness bugs, concurrency / error-handling gaps, dead or
  duplicated code. Style nitpicks and anything that could not be substantiated are left out.

## Scope and method

**Read in full:** `server/index.js`, `functions/[[path]].js`, `public/js/app.js`, `public/js/api.js`,
`public/js/charts.js`, `public/js/map.js`, `scripts/download_data.py`, `scripts/download_ura_data.py`,
`scripts/fetch_bto_blocks.py`, the small deploy scripts, and `.github/workflows/refresh-data.yml`.

**Not audited:** the test suite, `index.html` markup, CSS.

**How findings were confirmed** — each finding states its level:

| Level | Meaning |
|---|---|
| **Live** | Reproduced against production (`https://worthit.canlah.app`) with read-only GET requests |
| **Data** | Measured in the local `server/db/resale.db` (URA rows downloaded 2026-11-12), opened immutable |
| **Simulation** | The server's own functions, extracted from `server/index.js`, run over real data |
| **Reading** | Traced in the code only; not executed |

Counts come from the local DB, not production, so production numbers may differ slightly.

## Summary

| # | Severity | Finding | Confirmed by |
|---|---|---|---|
| 1 | High | Postal search returns an empty page for about 13% of HDB blocks | Simulation + Live |
| 2 | High | Landed sales are stored two or three times | Data |
| 3 | Medium | EC pages claim "MOP 2021" for 1990s ECs | Data + Live |
| 4 | Medium | New search results are filtered by the previous search's filters | Reading |
| 5 | Medium | Private project pages show a "💰 Check" button that always fails | Reading + Live |
| 6 | Medium | Late responses from a previous search are applied to the current view | Reading |
| 7 | Medium | BTO index stays on screen after another search | Reading |
| 8 | Medium | An empty URA batch would pass both nightly guards | Reading + Data |
| 9 | Medium | Duplicate indexable URLs for the same page | Live |
| 10 | Low | BTO bot pages print "0 sqft" and "a 0-year wait" | Data + Live |
| 11 | Low | Duplicate `getSeoMetadata` drops `head=1` | Reading |
| 12 | Low | "Clear filters" re-registers all filter listeners | Reading |
| 13 | Low | BTO launch status uses UTC, not Singapore time | Reading |
| 14 | Low | A pending `/check` price can auto-submit on a later search | Reading |
| 15 | Low | Frontend deploy exits 0 if wrangler is killed | Reading |

---

## High

### 1. Postal search returns an empty page for about 13% of HDB blocks

**Where**
- `server/index.js:413-496` — `matchRoadToTown()` (road name → town, stage 1)
- `server/index.js:500-544` — `matchRoadToTownViaDB()` (fallback, stage 2; queries at `:524-528` and `:535-539`)
- `server/index.js:905`, `:959`, `:986`, `:1056` — `/api/area-overview` filters every query on `town = ?`

**Why it's a bug** — three things compound:
1. The fallback lookup searches street names across *all* transactions, including URA rows, whose
   `town` column holds the pseudo-towns `D01`–`D28`. It uses `LIMIT 1` with no `ORDER BY`, and SQLite
   scans via the town index (`SCAN transactions USING INDEX idx_transactions_town`), so the
   alphabetically first town with a matching street wins. `D19` sorts before `SENGKANG`.
2. Stage 1 has wrong heuristics: the prefix map sends any `LORONG …` road to Geylang and any
   `CHANGI` road to Tampines, and a road that contains another town's name matches that town
   (`GEYLANG BAHRU` → Geylang, though HDB files it under Kallang/Whampoa).
3. `/api/area-overview` then requires that town **and** the nearby-block filter. When the town is
   wrong, no row satisfies both, and the street fallback is skipped because the block filter is set.

The result is a results page with 0 transactions for a valid HDB postal code. This affects the main
postal search, `/postal/<code>` pages and `/check/<postal>` links.

**How confirmed**
- **Simulation:** ran `matchRoadToTown` + `matchRoadToTownViaDB` (source extracted from
  `server/index.js`) over all 577 HDB street/town groups, with road names made by expanding the DB's
  abbreviations the way OneMap spells them. **1,281 of 9,710 blocks (13.2%) resolve to the wrong
  town**: 1,141 through the fallback (955 of them to a `Dxx` pseudo-town) and 140 through stage 1.
- **Live:** every sampled postal code returned the predicted wrong town and no transactions.

| Postal | Block | Real HDB town | Resolved as | 12-month sales returned |
|---|---|---|---|---|
| 544188 | 188D Rivervale Dr | Sengkang | `D19` | 0 |
| 821670 | 670A Edgefield Plains | Punggol | `D19` | 0 |
| 400302 | 302 Ubi Ave 1 | Geylang | `D05` | 0 |
| 641181 | 181A Boon Lay Dr | Jurong West | Bukit Merah | 0 |
| 530139 | 139 Lor Ah Soo | Hougang | Geylang | 0 |
| 462027 | 27 New Upp Changi Rd | Bedok | Tampines | 0 |
| 330057 | 57 Geylang Bahru | Kallang/Whampoa | Geylang | 0 |
| 460100 (control) | 100 Bedok Nth Ave 4 | Bedok | Bedok | 179 |
| 466226 | landed house, Kew Crescent | (private, D16) | `D09` | 0 |

Each of the seven failing HDB blocks had 4–9 sales of its own in the last 12 months.

**Worst-hit streets (blocks affected):** Rivervale Dr 57, Edgefield Plains 52, Rivervale Cres 48,
Edgedale Plains 46, Ubi Ave 1 46, Boon Lay Dr 39, Fernvale Rd 37, Canberra Rd 31, Fernvale Link 31,
Potong Pasir Ave 1 31, Toh Guan Rd 28.

**Caveat:** the simulation's road names approximate OneMap's; all nine live samples matched it.

### 2. Landed sales are stored two or three times

**Where** — `scripts/download_ura_data.py:275` (`insert_transactions`): every entry in the URA
response is inserted as-is, with no check for a repeated entry.

**Why it's a bug** — for 252 landed streets, the street's whole list of sales is in the database 2 or
3 times, back to back. That inflates transaction counts, weights averages and trend lines towards
those streets, and shows the same sale two or three times in the transactions table.

**How confirmed (Data)**
- Kew Drive under `LANDED HOUSING DEVELOPMENT` has 33 rows: the same 11 sales three times, in
  consecutive row IDs (431549–431581).
- Land-title sales (`type_of_area = 'Land'`): **10,865 rows stored, 8,575 distinct — 2,290 surplus
  (21.1%)**. 2,274 of the surplus rows are under `LANDED HOUSING DEVELOPMENT`.
- 173 streets have sales stored twice and 79 three times. In 244 of those 252 streets every sale is
  repeated the same number of times.
- In 243 of the 252, the number of copies equals the number of property types sold on that street
  (terrace / semi-detached / detached).
- For contrast, only 1.1% of condo resale rows have an exact duplicate.

**Not confirmed:** the raw URA response was not inspected. "URA returns the street's entry once per
property type, each with the full list" is an inference from the pattern above.

---

## Medium

### 3. EC pages claim "MOP 2021" for 1990s ECs

**Where** — `server/index.js:3366`.

**Why it's a bug** — the MOP year shown in the page title and FAQ is the year of the project's
earliest sale in the data. The guard `info.earliest_month > '2017-03'` assumes data starts in 2017
(true for HDB), but URA data starts at 2021-11, so every EC older than that gets "MOP 2021".

**How confirmed**
- **Data:** 46 of 82 ECs have their first row at 2021-11, the start of the URA window.
- **Live:** titles for Chestervale, The Rivervale and Northoaks (leases from 1997) read
  `… EC Resale Price | MOP 2021 — …`.

### 4. New search results are filtered by the previous search's filters

**Where** — `public/js/app.js:840` vs `:843-847` (`renderResults`); same order at `:1752` vs
`:1755-1759` (`renderPrivateResults`) and in `renderDistrictResults`.

**Why it's a bug** — `applyTransactionFilters()` runs first and reads the filter inputs still holding
the previous search's values; the inputs are reset afterwards without a redraw. The table shows
filtered rows while the filter controls read "All".

**How confirmed** — Reading. Town searches self-correct when the private summary arrives and
re-applies the filters; postal, district and private-project searches do not.

### 5. Private project pages show a "💰 Check" button that always fails

**Where** — `public/js/app.js:1741-1750` (rows built without `is_private`); `server/index.js:1842`.

**Why it's a bug** — the HDB-only price-check button renders when `!tx.is_private`. District and town
views set `is_private`, but project-page rows do not, so the button appears on every row. Clicking it
sends the project name as an HDB block.

**How confirmed**
- **Reading:** the row mapping and the button condition.
- **Live:** `GET /api/valuation?block=SKY HABITAT&street=…` → HTTP 400 `block or street too long`;
  `block=ECO` → `{"found":false,"message":"Block not found"}`.

### 6. Late responses from a previous search are applied to the current view

**Where** — `public/js/app.js:901-913` (private summary, merged into the table and map by
`renderPrivateSummary`), `:1431-1468` (valuation card), `:867-876` (nearby projects on the map).

**Why it's a bug** — none of these checks that the view is still the one that started the request.
A slow response from town A merges its private transactions, valuation card or map markers into
whatever is showing by then (another town, a district, a BTO project).

**How confirmed** — Reading. `_applySeoMetadata` (`app.js:367`) and `fetchAcResults` (`:2358`) do
guard against this, which shows the pattern is known but not applied here.

### 7. BTO index stays on screen after another search

**Where** — `public/js/app.js:491-531` (`_onResultsShown`); the only place that hides
`#bto-index-section` is `:2112` (compare view).

**Why it's a bug** — after opening `/bto`, a town, postal, district or private search shows its
results but leaves the full BTO launch list on the page. The section sits after the results in the
DOM (`public/index.html:474` vs `:179`), so it appears below them.

**How confirmed** — Reading and grep.

### 8. An empty URA batch would pass both nightly guards

**Where** — `scripts/download_ura_data.py:98-104`; `.github/workflows/refresh-data.yml:68-82`.

**Why it's a bug** — a batch that returns `Status: Success` with an empty `Result` is accepted as
valid. The script then deletes all existing URA rows and inserts what it has. The workflow's second
guard only requires 100,000 URA rows in total.

**How confirmed**
- **Reading:** no check on an empty result.
- **Data:** batch sizes are 19,610 / 28,609 / 54,430 / 29,275 of 131,924. Losing batch 1, 2 or 4
  leaves 112k, 103k or 103k rows — all above the 100k threshold — so a DB missing 7 districts would
  deploy. The trigger (URA returning success with no data) has not been observed.

### 9. Duplicate indexable URLs for the same page

**Where** — `server/index.js:3381` (private), `:3229` and `:3095` (HDB town / town × flat type).

**Why it's a bug** — the canonical URL is built from the slug that was requested, not the page's
real slug. A partial slug that resolves by fuzzy match, or a town slug in a different case, becomes
its own indexable page with its own canonical.

**How confirmed (Live)**
- `/private/pinery` and `/private/pinery-residences` both return the Pinery Residences page, each
  with itself as canonical and no `noindex`.
- `/hdb/BEDOK`, `/hdb/Bedok` and `/hdb/bedok` each return themselves as canonical.

---

## Low

### 10. BTO bot pages print "0 sqft" and "a 0-year wait"

**Where** — `server/index.js:2991` (`Math.round(f.floor_area_sqm * 10.7639)`), `:2984`
(`Math.round(head.waiting_months / 12)`).

**Why it's a bug** — a null floor area or waiting time is formatted as zero in the HTML served to
crawlers.

**How confirmed**
- **Data:** 153 flat rows across 69 projects have a null area. Units are never null.
- **Live:** `/bto/yishun-natura` contains "0 sqft". Of 12 pages checked among 113 projects with a
  null waiting time and no resale data, 11 contain "a 0-year wait" (e.g. West Glades @ Bukit Batok).

### 11. Duplicate `getSeoMetadata` drops `head=1`

**Where** — `public/js/api.js:121` and `:151`.

**Why it's a bug** — the same key is defined twice in one object literal, so the second (without
`head: '1'`) wins. `App._applySeoMetadata` (`app.js:366`) therefore fetches the full bot payload,
including page HTML and JSON-LD, on every navigation.

**How confirmed** — Reading.

### 12. "Clear filters" re-registers all filter listeners

**Where** — `public/js/app.js:597`, called from the buttons at `:1250-1251`.

**Why it's a bug** — `clearTransactionFilters()` calls `setupTransactionFilters()` again, adding a
second set of listeners. Each click adds another, so later filter changes re-render the table and
send the `filter_transactions` analytics event several times. It also bypasses sorting, block
pinning and the "(x of y)" count.

**How confirmed** — Reading.

### 13. BTO launch status uses UTC, not Singapore time

**Where** — `server/index.js:2067-2072` (`launchStatus`).

**Why it's a bug** — it compares `new Date().toISOString().slice(0, 10)` (the UTC date) with
Singapore application dates, so "upcoming → open → closed" flips 8 hours late.

**How confirmed** — Reading.

### 14. A pending `/check` price can auto-submit on a later search

**Where** — `public/js/app.js:1435` vs `:1458-1463`.

**Why it's a bug** — the price from a `/check/<postal>?price=` link is only cleared when the
valuation card loads successfully. If the block isn't found, it stays set and is submitted on the
next postal search that does load.

**How confirmed** — Reading.

### 15. Frontend deploy exits 0 if wrangler is killed

**Where** — `scripts/deploy-frontend.js:10`.

**Why it's a bug** — `process.exit(result.status ?? 0)`: when wrangler is terminated by a signal,
`status` is null and the script reports success, so the deploy chain carries on to the IndexNow ping.

**How confirmed** — Reading.

---

## Dead code

| Where | What |
|---|---|
| `server/index.js:21-24` | `URA_ACCESS_KEY`, `uraToken`, `uraTokenExpiry` — defined, never used |
| `server/index.js:650`, `:1692` | `/api/flat-types` and `/api/private/property-types` — no frontend caller |
| `public/js/api.js:128`, `:157` | `API.getPrivatePropertyTypes`, `API.getSeoSitemap` — no callers |
| `public/js/map.js:472` | `TransactionMap.highlightProject` — no callers |
| `public/js/charts.js:8-9`, `:83-84` | `_lastTrendData`, `_lastPrivateTrendData` — written, never read |
| `scripts/download_ura_data.py:321-325` | `no_of_units` — parsed, never stored |
| `scripts/download_data.py:12`, `:474-476` | unused `datetime` import; a check that can never be true |

## Stale documentation

`memory-bank/progress.md:64`, `memory-bank/activeContext.md:253` and `memory-bank/techContext.md:131`
say `download_data.py` still builds the `town_stats`, `monthly_medians` and `storey_adjustments`
tables. The script no longer creates them; they only exist in older local DB files.

## Checked and dropped

| Suspicion | Result |
|---|---|
| Exact-name project search opens the wrong project (top-5 cut-off) | 0 projects affected |
| "null units" on BTO pages | Units are never null; narrowed to finding 10 |
| Pin popup shows one street for multi-street projects | No named project spans two streets |
| HDB blocks missing coordinates | None missing |
| MRT overlay drops stations outside hard-coded line ranges | Station data matches the ranges |
| `HDB_QUOTED_RESALE` lookup misses on key case | All keys are upper case |
| `scripts/fetch_bto_blocks.py` | Read in full; no defect found |

## How to re-check the two high findings

```bash
# Finding 1 — a Sengkang block that resolves to "D19" and returns nothing
curl -s "https://worthit.canlah.app/api/resolve?q=544188"

# Finding 1 — why: the fallback scans in town-index (alphabetical) order
sqlite3 server/db/resale.db "EXPLAIN QUERY PLAN SELECT DISTINCT town FROM transactions
  WHERE UPPER(street_name) LIKE '%RIVERVALE%' LIMIT 1;"

# Finding 2 — the same 11 Kew Drive sales stored three times
sqlite3 server/db/resale.db "SELECT id, month, floor_area_sqm, resale_price FROM transactions
  WHERE project='LANDED HOUSING DEVELOPMENT' AND street_name='KEW DRIVE' ORDER BY id;"
```
