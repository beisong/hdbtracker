# WorthIt — feature suggestions (2026-11-13)

Proposals only. Nothing here is built.

**Goal these are ranked against:** make the site more useful and friendly for the people who use
it — first-time buyers, sellers, owners upgrading or downgrading, owners watching prices in their
area, and buyers of a new project researching past prices nearby. Getting found on Google is
secondary but still counted.

Effort: S = under a day, M = a few days, L = a week or more. Estimates come from reading the code,
not from prototypes.

## Summary

| # | Feature | Who it serves | Effort |
|---|---------|---------------|--------|
| 1 | "What's my flat worth?" — fair-value range without an asking price | Sellers, owners | S–M |
| 2 | Full sale history for one block | Owners, sellers, buyers | S–M |
| 3 | Budget finder — towns where $X buys a given flat type | First-time buyers | S–M |
| 4 | New sale vs sub-sale vs resale on private pages | New-project buyers, upgraders | S–M |
| 5 | Upgrade / downgrade gap within a town | Upgraders, downgraders | M |
| 6 | "My places" with new sales since last visit | Owners watching an area | S–M |
| 7 | Primary schools within 1 km | First-time buyers, families | M |
| 8 | HDB rents and gross yield | Owners, downgraders, investors | M |

Suggested build order: 1 and 2 together (same card, same endpoint), then 3, then 4–8 as ranked.

**Fix first (from `fable-audit.md`):** finding 1 (postal search returns nothing for about 13% of
HDB blocks) should be fixed before features 1, 2 and 6, because their card sits on the postal
results page. Finding 2 (landed sales stored 2–3 times) skews the private medians used by
features 4 and 5.

---

## 1. "What's my flat worth?" (S–M)

**What and why.** Show a fair-value range for a flat as soon as its block is known, with no asking
price typed in. Today the "Check an Asking Price" card shows nothing until a price is entered,
which suits buyers but not sellers or curious owners.

**How I'd build it.**
- Server, `/api/valuation` (`server/index.js:1830`): the handler returns early at `:1927` when
  `price` is missing, before the comps ladder runs. Move that check below the fair-value maths
  (`:2014-2018`) so a no-price call also returns `valuation` with `fair_value`, `fair_low`,
  `fair_high`, `confidence` and `comps`, and with `asking_price`, `deal_score`, `verdict` and
  `percentile_rank` set to null. One code path, no new endpoint.
- Frontend, `app.js`: `loadValuationCard()` (`:1431`) renders the range into `#val-result`
  straight away. Chip clicks in `_renderValChips()` (`:1480`) re-fetch instead of only clearing the
  result. `renderValuationResult()` (`:1575`) skips the score circle when `deal_score` is null.
- Copy, `index.html:240-248`: retitle the card "What's this flat worth?" and make the price box
  an optional second step ("Seen an asking price? Compare it").
- Tests: extend `tests/integration/valuation.test.js` — the "block facts (no price)" group now
  also expects a fair range.

**Risks.** It reads like an appraisal, so the existing "indicative estimate" line must stay. Every
card load now runs the comps query (cheap, but it was free before).

## 2. Full sale history for one block (S–M)

**What and why.** Every sale in a block since 2017, with a trend per flat type. A postal search
shows only the latest 3 sales per block (`server/index.js:1051-1066`), so owners cannot see their
own block's history.

**How I'd build it.**
- Server: `/api/valuation` already loads the block's full history as `blockTxs` (`:1852`) to work
  out flat types and lease, then throws it away. Return it as `block_history`. No new query.
- Frontend: in the same card as feature 1, add a collapsed "All N sales in this block" list (same
  row markup as the comps list at `app.js:1589`) and a small yearly-median line per flat type
  using `Charts.renderTrendChart({ canvasId, series })`, which the compare page already uses.
- Tests: one assertion in `valuation.test.js` that `block_history` holds every fixture row for the
  block, newest first.

**Risks.** A busy block adds a few hundred rows to the response; cap at 500 if it matters.

## 3. Budget finder (S–M)

**What and why.** "Where can I buy a 4-room for $600k?" First-time buyers start with a budget, but
the search box assumes they already know a town or postal code.

**How I'd build it.**
- Server: new `GET /api/budget?max=&flat_type=&min_lease=`. One query for the last 12 months of
  HDB sales of that flat type (`monthsAgoStr(12)`, optional `remaining_lease_years >= ?`), grouped
  by town in JS with the existing `median()`. Per town: median price, number of sales, and share
  of sales at or under the budget. Sort by that share. Validate `max` with the same 50k–5m range
  as `/api/valuation`.
- Frontend: a section under the search box in `index.html` with a budget input, flat-type select
  and minimum-lease select. Each result row links to the existing `/hdb/<town>/<flat-type>` page.
  Hide it in `_onResultsShown()` (`app.js:491`) with the other home-page sections.
- Tests: new `tests/integration/budget.test.js` (validation, ordering, lease filter).

**Risks.** Without the lease filter it recommends very old flats as bargains, so default it to
60+ years. No `/budget` URL in the first pass; add one later if it is worth indexing.

## 4. New sale vs sub-sale vs resale on private pages (S–M)

**What and why.** Label and filter private sales by sale type, and show the medians separately.
The database already stores this (`type_of_sale`: 45,755 / 5,039 / 81,130 rows for codes 1 / 2 /
3) but the site never shows it. A new-project buyer can then see what developers charged nearby
and how those units later resold.

**How I'd build it.**
- First confirm against URA's API documentation that 1 = new sale, 2 = sub-sale, 3 = resale.
- Server: only the project-overview query selects `type_of_sale` today (`server/index.js:1295`).
  Add it to the other private transaction selects (district summary, district overview, nearby
  projects), and add a per-sale-type median $/sqm to `/api/private/project-overview`.
- Frontend, `app.js`: a small badge on private rows in `renderTransactionsTable()` (`:1240`), a
  "Sale type" option in the existing filter row (private results only), and one line on project
  pages: "New sale median $X psf (n) · Resale median $Y psf (n)".
- Tests: `tests/integration/private.test.js`; add fixture rows of each type to
  `tests/fixtures/seed.js` and update the count in `status.test.js`.

**Risks.** Headline private medians currently mix all three types. I would leave them alone in
this pass and show the split beside them; changing them moves every private number on the site.

## 5. Upgrade / downgrade gap within a town (M)

**What and why.** One card answering "if I sell my 4-room here, how much more is a 5-room or a
condo nearby?", and the reverse for downgraders.

**How I'd build it.**
- No new endpoint. `/api/area-overview` already returns `prices_by_type` for the town, and
  `/api/private/district-summary` returns `prices_by_type` for the related districts
  (`TOWN_TO_DISTRICTS`, `server/index.js:554`, mirrored at `app.js:886`). The town page already
  fetches both (`renderResults()` and `loadPrivateSummaryForTown()`, `app.js:901`).
- Frontend: a card under the flat-type price cards with "I own" chips (flat types). It lists every
  other rung — smaller flats, bigger flats, EC, condo — with its median and the gap in dollars.
  The gap maths goes in one pure helper.
- Show the card only when no flat-type filter is active, since a filtered search does not carry
  the other types' medians.
- Tests: unit test for the helper in `tests/unit/frontend.test.js`.

**Risks.** It shows price gaps only, not cash needed (loan, CPF, stamp duty are out of scope), and
the card must say so. Condo medians cover a whole district, which is coarser than a town.

## 6. "My places" with new sales since last visit (S–M)

**What and why.** Save a block or town on the device; the home page then shows "3 new sales since
you last looked". It gives owners a reason to come back without accounts or email.

**How I'd build it.**
- Frontend only (`app.js`, `index.html`). A "Save" button beside the share button
  (`index.html:200`) stores `{ path, label, seenCount, seenMonth }` in `localStorage`, every read
  and write wrapped in try/catch like the theme code.
- A "Your places" strip on the home page lists saved links, capped at 5. On home load, fetch each
  place's current count and compare it with `seenCount` to show the badge. Start by reusing
  `/api/area-overview` (`town_summary.total_transactions_12m`, or `block_history.length` from
  feature 2 for a block); add a slim count endpoint only if that proves slow.
- Tests: unit test for the pure "what's new" comparison.

**Risks.** Saved places live on one device and vanish if browser data is cleared. Sales are dated
by month only, so "new" means newly published rows, not exact dates. A 12-month count can drop as
old sales age out, so the badge must never show a negative number.

## 7. Primary schools within 1 km (M)

**What and why.** "3 primary schools within 1 km" in map popups and on the block card. School
distance is a major price driver for families.

**How I'd build it.**
- Data: a one-off `scripts/fetch_schools.py` modelled on `scripts/fetch_bto_blocks.py` (same
  OneMap throttle and backoff). It reads MOE's school list from data.gov.sg, keeps primary
  schools, geocodes each postal code and writes `public/data/schools.json` as
  `[{ name, lat, lng }]`. Re-run yearly.
- Frontend, `map.js`: a `SchoolsNearby` helper beside `MrtNearest` (`:571`) — same fetch-once
  pattern, same haversine. Add its line to the existing `popupopen` hook and to the block card.
  List names within 1 km and a count for 1–2 km.
- Tests: pytest for the script's filtering with mocked HTTP; unit test for the distance helper.

**Risks.** MOE measures from the school's boundary to the block, so the result must be labelled
approximate with a link to OneMap's School Query. I have not checked the MOE dataset's current
format. Schools merge and move, so the file goes stale if nobody re-runs the script.

## 8. HDB rents and gross yield (M)

**What and why.** Median rent and gross yield per town and flat type, beside the resale medians.
Useful to owners thinking of renting out and to downgraders weighing rent against buying.

**How I'd build it.**
- First confirm that data.gov.sg's "Renting Out of Flats" dataset exists with town, block, street,
  flat type, month and monthly rent.
- Pipeline, `scripts/download_data.py`: a `download_rentals()` step reusing `download_dataset()`,
  writing `hdb_rentals(month, town, block, street_name, flat_type, monthly_rent)` with an index on
  `(town, flat_type, month)`. A rental failure should log and skip, not block the nightly resale
  refresh; the server treats a missing table as "no rent data".
- Server: `/api/area-overview` adds a 12-month median rent per flat type; gross yield = median
  rent × 12 ÷ median resale price for the same type.
- Frontend: one extra line on each flat-type price card ("Rent ~$3,200/mo · 5.1% yield").
- Tests: pytest for the download step, fixture rows plus the `status.test.js` count, one
  integration assertion.

**Risks.** Rental rows carry no floor area or storey, so yield is only meaningful per town and flat
type. It lengthens the nightly job and adds a second data.gov.sg dataset to rate limits.

---

## Considered and left out

- **Related-links block (S).** Cheap and worth doing for Google (820 URLs are "Discovered – not
  indexed"), but it adds little for users. Already noted in `memory-bank/activeContext.md`.
- **Million-dollar flat tracker, monthly report pages.** Mainly traffic plays.
- **Check My Price for private property (M–L).** Useful for upgraders, but URA gives only a floor
  range, so the fair range would be wide for a lot of work. Feature 4 gives private buyers more
  for less.
- **Email alerts (L).** Needs a writable store, an email sender and unsubscribe handling, against
  a read-only database that is replaced nightly. Feature 6 covers most of the need.
- **Stamp duty, grant and loan calculator.** Policy numbers change, and a wrong figure does real
  harm.

## Not verified

- URA sale-type code meanings (feature 4).
- The data.gov.sg rental dataset and the MOE school list (features 7 and 8).
- Whether the valuation card still loads when a postal search returns an empty page (audit
  finding 1) — relevant to features 1, 2 and 6.
