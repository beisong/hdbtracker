# Active Context: WorthIt

> Condensed 2026-10-02 from a ~2,240-line session log (full history is in git: `git log -p -- memory-bank/activeContext.md`).
> Keep this file a high-level overview: current focus, recent changes, then one short entry per
> shipped feature. Per-launch BTO curation detail lives in each launch's `_curation_note` in
> `scripts/bto_launches.json` and in `bto_launches_info/`, not here.

## Current Focus & Next Steps

- **Search indexing (the main open problem)** — Google: sitemap 856 submitted / **0 indexed**,
  every inspected page "Crawled – currently not indexed", 0 impressions in Sept. Bing: indexing a
  little (Jun 50 / Jul 75 / Aug 4 / Sep 11 impressions, 0 clicks ever).
  - **Re-checked 2026-10-24** (after the 2026-09-26 proxy fix): still 856 / **0 indexed** (12/15
    sampled "Crawled – currently not indexed"), only 30 lifetime impressions. Bing meanwhile has
    **384 URLs indexed**, 0 crawl errors. So the render bug wasn't the blocker — but a cold-start
    bug was serving `<title>undefined</title>` + homepage content on deep URLs; fixed and deployed
    2026-10-24 (frontend `v=31`; edge cache + 8s timeout + 503 for crawlers). **Next: manually
    "Request indexing" in GSC for the top ~20 URLs** (not scriptable — the Indexing API is
    job-posting-only), then re-check coverage in ~2 weeks, and continue backlinks.
  - Bing URL submission quota is **100/day, 2,500/month** (API now reports 2,500, not 3,100).
    Submitted 2026-10-01 (home, `/bto`, 26 town pages, top 72 BTO by resale count), 2026-10-02
    (BTO ranks 73–172), and 2026-10-07 (all 28 district + 72 highest-volume private pages, to
    recrawl after the `df0947b` fixes). Remaining: ~128 private + 51 post-MOP BTO (ranks 173–223)
    (IndexNow still pings all 856 on deploy).
  - Off-site backlinks remain the biggest lever — see `progress.md` § Backlink playbook
    (data.gov.sg showcase first).
- **BTO post-MOP resale** — re-run `python scripts/fetch_bto_blocks.py` every few months to pick
  up projects reaching MOP (incremental; then `npm run deploy:api`). Next new BTO launch: seed it
  with the `seed-bto-launch` skill.
- **GSC Request Indexing (~10–12/day quota)** — 2026-11-04 requested (11): `/`, `/bto`,
  `/hdb/tampines`, `/hdb/woodlands`, `/hdb/sengkang`, `/hdb/yishun`, `/hdb/punggol`,
  `/hdb/sengkang/4-room`, `/hdb/tampines/4-room`, `/compare/punggol-vs-sengkang`, `/hdb/jurong-west`.
  **Next**: `/hdb/hougang`, `/hdb/bukit-batok`, `/hdb/woodlands/4-room`, `/hdb/punggol/4-room`,
  `/hdb/yishun/4-room`, `/compare/pasir-ris-vs-tampines`, `/compare/ang-mo-kio-vs-bishan`,
  `/methodology`, `/check`. GSC coverage 2026-11-04: 820 "Discovered – not indexed", 36 "Crawled –
  not indexed" (validation not started). Bing 2026-11-04: submitted 48 `/compare/` + BTO ranks
  173–223; remaining 128 `/private/` (by URA volume, ranks 73–200) then 124 town × flat-type pages.
- **Internal-linking gap (proposed, not built)**: bot HTML — town pages don't link `/compare/` or
  `/private/`, BTO project pages link only the nav, compare pages link only each other.
- **Nov 2026 BTO now official** (2026-11-06): 7 projects seeded from HDB Annex A/B — the 7
  provisional `/bto/<slug>` URLs (e.g. `bedok-bayshore-ii`) now noindex and drop out of the sitemap,
  replaced by `sembawang-anchor`, `plantation-dew`, `chencharu-acres`, `bayshore-sails`,
  `bayshore-oasis`, `merpati-meadow`, `toa-payoh-hillside`. Live after API deploy + nightly rebuild.
- **Fly is always-on since 2026-11-04** (`min_machines_running = 1`, ~US$2–3/month) — watch Bing's
  crawl-stats `all_other_codes` (cold-start 503s) stop growing.
- **Not done (deliberately deferred)**: MRT
  search phase B (`/mrt/<station>` pages); split `server/index.js`; remove the unused aggregation
  tables in `download_data.py`.
- **Watch**: the first nightly refresh after 2026-11-04 is the first run with the fail-loudly
  download scripts (PR #5) — if it goes red, check which page/batch failed rather than re-running blindly.
- **Ops reminder**: the GitHub Actions `FLY_API_TOKEN` (org token) expires ~**Jun 2027** — renew
  with `fly tokens create org`.

## Recent Changes (Sep–Nov 2026)

### Audit fixes + town comparison + MRT labels — DEPLOYED 2026-11-04 (API + frontend, `v=32`)
A `/ponytail-audit` (14 findings) was implemented as 10 parallel claude.ai/code cloud PRs (#1–#10,
merged to main; workflow rules in CLAUDE.md § Cloud / PR sessions).
- **#1 edge**: sitemap returns 503 (not an empty sitemap) when the API 503s / returns no URLs;
  `"` in meta really escaped to `&quot;`.
- **#2** `/api/area-overview` `median_price` is a true median (was AVG: Central Area $862k → $669k).
- **#3** `/bto/<slug>` uses exact `slugToBtoProject()` via `/api/bto/project-overview?slug=`
  (111 of 474 deep links used to fail for humans; all 473 sitemap BTO slugs now open).
- **#4** `fmtPrice` no longer prints "$1000k"; autocomplete ignores stale responses; Dockerfile
  drops pip/requirements (python3 + build-essential kept only for the better-sqlite3 build fallback).
- **#5** `download_data.py` / `download_ura_data.py` exit 1 and keep the old DB/URA rows on any
  failed page/batch or short count; workflow also has a min-row-count guard before `deploy:data`.
- **#6** `/api/geocode` removed (open proxy + unbounded cache); feedback ≤4000 chars, 5/IP/h +
  200/day global cap; `cors` and `node-fetch` dependencies removed.
- **#7** 133 pytest tests in `tests/python/` (`pip install pytest pyproj`).
- **#8** nearest-MRT label in all map popups + mobile cards (`MrtNearest` in `map.js`).
- **#9** startup `status`/`towns` failures show a retryable notice instead of a full-screen error.
- **#10** town comparison `/compare/<a>-vs-<b>[-vs-<c>][/<flat-type>]` with SEO branch + 48
  adjacent-pair sitemap URLs (sitemap now 904 URLs).
- Tests 276 → **356** Vitest (+133 pytest). Verified locally (all 904 sitemap routes return a
  title/description without noindex) and on production (19/19 smoke tests).
- Known, harmless: unknown `/api/*` paths fall through to the SPA catch-all (200 + `index.html`).


### Cold-start SEO fallback fix — DEPLOYED 2026-10-24 (frontend `v=31`)
Re-checked GSC + Bing. **Google: 856 submitted / 0 indexed**; 12 of 15 sampled URLs "Crawled –
currently not indexed", 3 "URL is unknown to Google"; **30 lifetime impressions, 0 clicks** (homepage
+ 4 `/private/*`, faded to zero by Aug). **Bing is healthy**: 384 URLs in index (6 in June), 1,131
pages crawled, 0 crawl errors / 4xx / 5xx. Technical layer verified clean (200s, robots allowed,
self-canonical, no noindex) — so the block is quality/authority, aggravated by a real bug.
- **Root cause**: the edge fallback called `injectMeta(html, { canonical })` with no `title`, and
  `injectMeta` rewrote `<title>` unconditionally → **`<title>undefined</title>`** plus homepage
  content on every deep URL whenever the Fly machine was asleep (reproduced live twice). Bot-facing
  duplicate pages are exactly what "crawled – currently not indexed" describes.
- **Fix** (`functions/[[path]].js`): (1) title only rewritten when `meta.title` exists; (2) metadata
  timeout 5s → **8s**; (3) new `fetchSeoMetadata()` memoizes the payload in the **edge Cache API**
  (24h TTL, `waitUntil`, complete payloads only) so a sleeping machine costs one crawl per route per
  data centre; (4) on failure, search/AI crawlers get **503 + `Retry-After: 300`** (`no-store`)
  instead of a broken duplicate, while link-preview bots (Twitter/Slack/Facebook/WhatsApp/Discord/…)
  still receive the real page with the static title intact.
- **Deliberately unchanged**: `min_machines_running = 1` (billing) — the edge cache makes it optional.
- **Tests 271 → 276** (5 new in `tests/unit/edge.test.js`).
- **Live verification**: Fly machine stopped → cached bot request returned in **0.165s** with the
  correct title and never woke the machine. Uncached route on a cold machine → **503 + `Retry-After:
  300` at 8.15s** (no `undefined` title, no duplicate), then **200** once warm. Note: a fully cold
  boot now measures ~8s+, so an uncached route usually 503s on its first crawl — `min_machines_running
  = 1` remains the way to remove that, if the billing is acceptable.

### Bing crawl-control fixes (A+B+C) — DEPLOYED 2026-10-07 (API + frontend, `v=30`)
Bing's "crawl more URLs / exclude useless URLs / limit parameters / boost crawl quota" recommendation
turned out to be a generic canned message (Bing crawl diagnostics showed no issues), but it exposed
real crawl-budget leaks:
- **Edge 404** (`functions/[[path]].js`): unknown extension-less paths (`/foo/bar/baz`, `/_headers`)
  now return a real **404** instead of the SPA shell 200. Whitelist = `SPA_ROUTE_PATTERNS`; deep
  routes that fail to *resolve* are left alone (still 200 + server `noindex`).
- **`/api/*` noindex header**: `X-Robots-Tag: noindex, nofollow` on all API responses (edge
  `proxyApi()` + new Express middleware). Deliberately a header, **not** a robots `Disallow` —
  Googlebot's renderer fetches `/api/*` same-origin, so blocking it would re-trigger the
  `showError()`-covers-content regression fixed 2026-09-26. Bingbot-scoped `Disallow: /api/` was
  considered and declined.
- **robots.txt**: `Disallow: /_headers` (both `public/robots.txt` and the edge generator); deleted
  stray `public/.DS_Store`. No dotfile-wide rule, no parameter rules (param URLs already
  canonicalise to clean paths).
- **Tests 252 → 271**: new `tests/unit/edge.test.js` (edge 404 whitelist, robots body) + API
  `X-Robots-Tag` and robots-content assertions in `tests/integration/seo.test.js`.
- **Deferred by choice**: data-unresolved deep-route 404s (`/hdb/not-a-town`), trimming the 473
  BTO sitemap URLs, and the manual Bing Webmaster **Crawl Control** rate boost (dashboard-only).
- **IndexNow**: `scripts/indexnow-ping.js` now retries the sitemap fetch (5× / 5s) — the first run
  after this deploy hit a transient 404 while the Pages alias propagated and silently skipped the
  submit; re-run submitted all 856. Live-verified: valid routes 200, junk 404, `/api/*` header,
  robots.txt, 19/19 smoke tests.

### Bing SEO report fixes — DEPLOYED 2026-10-07 (API + frontend, `v=29`), commit `df0947b`
Bing Webmaster flagged duplicate titles, duplicate meta descriptions, short titles, and no
backlinks (0 inbound links per the Bing API).
- **Diagnosis**: server-generated bot metadata was already ~unique (8/856 dupes). The main
  duplicate source is likely **Fly cold starts** — the edge waits 5s for `/api/seo/metadata`, then
  falls back to the homepage title/description (a cold bingbot request measured 5.1s). Cold-start
  fix (edge cache of metadata + 503 Retry-After fallback, or `min_machines_running = 1`) proposed
  then; **implemented 2026-10-24** (see the cold-start entry above) — it also stopped the fallback
  writing literal `<title>undefined</title>`.
- **Private slugs**: `slugToProject()` now tries an exact slug → project map (cached per DB
  handle; collisions → most transactions) before the fuzzy LIKE fallback. 85 of 2,989 projects
  used to resolve to another project (ECO → ECOPOLITAN, THE GARDEN RESIDENCES → THE LAKEGARDEN
  RESIDENCES, WATERBAY → KINGSFORD WATERBAY…). `/api/private/project-overview?slug=` added; the
  SPA's `/private/<slug>` route uses it (also fixes D'LEEDON, LIV @ MB deep links).
- **One title per page**: SPA `updateSeoForSearch()` now only computes the path; title,
  description, og tags come from `/api/seo/metadata?route=&head=1` (`head=1` drops
  `content_html`/`json_ld`), applied only if the user hasn't navigated on. The `/check/` price
  title (`_pushCheckUrl`) is unchanged.
- **Lengths**: `fmtPsf()` adds thousands commas; short private titles get `, District NN`;
  private descriptions add "sales since YYYY" + price range; town × flat-type add price range;
  town pages add YoY; postal title "… HDB Resale Prices & Recent Sales". BTO descriptions pick
  the longest variant ≤160 chars, and no longer print "BTO TBD"/"TBD excl. grants, flat" for
  unpriced historical launches. Result over the 856 sitemap URLs: titles <50 chars 17 → 0,
  descriptions >160 chars 83 → 10 (homepage-family + 5 combined-name BTOs), descriptions <120 chars
  317 → 5.

### BTO project resale after MOP — DEPLOYED 2026-09-27 (API + frontend, v=27), commit `2bdfe2a`
Each post-MOP BTO page shows the project's *own* resale transactions.
- Block mapping from OneMap search's `BUILDING` field (exact HDB precinct name). Researched
  alternatives — housingmap.sg paid DB (~$972, unclear licence), SRX/99.co/StackProperty portals
  (no API, ToS), data.gov.sg (no project names) — none usable. A radius + lease-year heuristic was
  tried first and mis-assigned blocks in dense estates (Punggol Regalia 39 blocks vs 10 real).
- `scripts/fetch_bto_blocks.py` → `scripts/bto_project_blocks.json` (262 projects, all matched;
  Pinnacle @ Duxton is a manual entry). Name splitting (`A & B`, `X I & II`, `A, B & C @ Town`),
  `ST`→`SAINT` and `THE ` fallbacks, lease-year filter drops reused precinct names (Cheng San
  Court's 1979 blocks); shared names split only when launches ≥3y apart (Segar Meadows) — close
  phases (Coralinus / Fernvale Vista / Jade Spring / The Coris Phase 1+2) share the whole precinct.
- Server: in-memory `BTO_PROJECT_BLOCKS`, `btoProjectResale()` → `project_resale` on
  `/api/bto/project-overview`; MOP gate = remaining lease **< 95 years** (user's suggestion).
  Bot SEO for post-MOP projects: title "<Project> Resale Prices — N Sales Since MOP", resale FAQ,
  latest-10 table.
- Frontend: `renderBtoProjectResale()` → `#bto-resale-container` (per-type 12-month median vs
  launch-price midpoint, latest 10 + "Show all"). `_onResultsShown()` now clears both BTO
  containers (fixed a stale "BTO vs Nearby Resale" table lingering on later searches).
- Result: 219/262 projects show resales. The rest are pre-MOP (Nov 2016+ launches) or the 14
  studio-only projects (Golden ___ series + Kampung Admiralty) — 30-year lease, no open-market
  resale (confirmed via PropertyGuru Mar 2015), which show an explanatory note instead.

### Same-origin API proxy for Googlebot rendering — DEPLOYED 2026-09-26 (v=26), commit `207e6de`
GSC Live Test showed Googlebot rendering a full-screen "Something went wrong — Failed to fetch":
the SPA's startup `Promise.all([getStatus, getTowns])` failed fetching cross-origin from
`worthit-api.fly.dev`, and `showError()` covers the server-injected SEO content.
- `functions/[[path]].js` `proxyApi()` forwards `/api/*` to Fly; overwrites `X-Forwarded-For` with
  `CF-Connecting-IP` (feedback rate limiter keys on it); strips upstream `Content-Encoding` /
  `Content-Length` (otherwise `br` was served to clients that didn't accept it).
- `public/config.js` → `API_BASE = ''` always. User confirmed GSC Live Test now renders the page.

### Search indexing diagnosis + IndexNow — DEPLOYED (v=24)
GSC (via Composio CLI) showed the problem is **non-indexing, not on-page SEO**: Google's last crawl
predated the whole June SEO batch; 0 indexed; zero backlinks. Added `scripts/indexnow-ping.js`
(chained onto `deploy`/`deploy:frontend`, deliberately non-fatal; key file
`public/a464a4c238872496dcaa8d33718f8e13.txt` must never be deleted — first submission may 403
`SiteVerificationNotCompleted` for ~20s), enabled Cloudflare Crawler Hints (dashboard-only, not in
the API), manually requested indexing for key pages. GSC Crawl Stats clean.

### BTO historical backfill — DONE (Aug–Sep 2026)
Dataset now covers **121 launches / 474 projects, April 2001 → Nov 2026** (see § BTO dataset below).

## Feature History (high level)

### BTO Launches (Aug 2026)
- Hand-curated `scripts/bto_launches.json` (never scrape `homes.hdb.gov.sg` — bot-blocked) seeds a
  `bto_projects` table, dual-seeded like `hdb_block_coords` (Python `seed_bto_projects()` drops +
  recreates on every rebuild; server `seedBtoProjects()` only when the table is missing).
- Endpoints `/api/bto/launches`, `/api/bto/projects` (autocomplete), `/api/bto/project-overview`
  (flats + BTO-vs-nearby-resale comps ladder 1000m → 2000m → town, `MIN_COMPS=5`).
- `/api/resolve` does an **exact-match-only** BTO check between exact-town and partial-town
  matching, so "SEMBAWANG PORTICO" → BTO but "SEMBAWANG" → town. Partial discovery is via
  autocomplete.
- Frontend `renderBtoResults()` / `renderBtoIndex()`, routes `/bto` and `/bto/<slug>`, orange map
  pin via `map.js` `loadBtoSite()`. SEO branches use their own exact `slugToBtoProject()` (not the
  fuzzy `slugToProject()`).
- Implementation gotchas: a temporal-dead-zone `ReferenceError` (the JSON `require()` must run
  before the DB-open `try` block that calls `seedBtoProjects()`); an unnamed percentiles `<div>`
  needed `id="percentiles-section"` to hide on BTO pages.
- Provisional (upcoming) launches come from third-party trackers, show an amber "Provisional"
  notice, and have null prices/classification — four null-handling bugs (`NaN` discount, literal
  `"null"` in titles, `$--–$--` cards, blank comparison rows) were fixed when the first one was added.

### Check My Price — Deal Score & Fair Value (Jul 2026, v=20)
- `GET /api/valuation`: subject block by `postal` or `block`+`street`; without `price` returns
  inferred `block_facts`; with `price` runs a comps ladder (500m lease ±10y → 1000m → drop lease →
  town, `MIN_COMPS=8`), storey adjustment computed live with **lease-banded** town×type buckets
  (without the band, high floors were overstated: Tampines 5R +19% → +5.9%), clamped ±10%.
- `deal_score = clamp(50 − 250×deviation, 0, 100)`; ≥70 Good deal / 45–69 Fair / <45 Premium.
- One `#valuation-section` card, three entry points: after postal searches, 💰 buttons on
  transaction rows, `/check/<postal>?price=` deep links (noindex, canonical → `/check`).
- `findNearbyHdbBlocks()` became true-radius (bounding box only prefilters; haversine decides).
- Note: the precomputed `town_stats` / `monthly_medians` / `storey_adjustments` tables built by
  `download_data.py` are still unused by the server.

### Map & postal search
- **Distance-based postal search (Jun 2026)**: `hdb_block_coords` (12,442 blocks, seeded from
  `scripts/hdb_blocks.csv`, incrementally geocoded via OneMap) replaced the Nominatim 9-point
  reverse-geocode pipeline; `/api/area-overview?lat=&lng=` filters exact `(block|street_name)`
  pairs. Postal searches get their own `/postal/<code>` URL; the searched block is pinned to the top.
- **Map completeness (Jul 2026)**: coords attached server-side to every transaction (no geocode
  round-trip); postal/street searches return the latest 3 transactions per block (cap 400) so every
  block gets a marker; condo markers load only after `TransactionMap.load()` resolves (fixed a
  race); nearby private projects use a true 800m radius, cap 40.
- **`/api/nearby-hdb` fix (Aug 2026)**: radius ladder 500 → 1000 → 2000m (was fixed 500m with an
  early return), and the private-project lookup now runs even when no HDB blocks are found
  (Bedok Bayshore went from 0 to 68 HDB + 28 private markers).
- Deal-score marker colours (`getValueStyle()`, green → blue → red vs nearby median) on HDB and
  private markers; HDB vs private distinguished by border. Lease shown in all popups.

### SEO (May–Jun 2026)
- Edge-side rendering for bots: `functions/[[path]].js` detects crawlers (incl. AI crawlers) and
  injects `/api/seo/metadata` title/meta/OG/JSON-LD plus page-specific `content_html`.
- Data-driven pages: towns, town × flat-type (`/hdb/<town>/<flat-type>`, sitemap only for combos
  with ≥5 sales in 24 months), private projects, districts, BTO; freshness notes + `dateModified`;
  visible Q&A prose (FAQ rich results were deprecated May 2026, prose still helps snippets/AI).
- E-E-A-T static pages `/about`, `/methodology`, `/data-sources` (served via `STATIC_PAGES` in the
  edge function, fetching the clean URL to avoid a 308 loop; `/data` was taken by `public/data/`).
- Soft-404 guard (`noindex, follow` for unresolved deep routes), meta descriptions ≤160 chars,
  keyword H1, internal links to all towns and districts, sitemap `lastmod`, 503 + `Retry-After` on
  sitemap failure, 5s `AbortController` on the edge metadata fetch.
- Cloudflare's "Block AI Bots" rule was 403-ing ClaudeBot/PerplexityBot — user set AI Crawl
  Control → "Do not block".

### Data pipeline & automated refresh
- HDB (data.gov.sg) + URA private data → one SQLite `transactions` table (`dataset_source`
  distinguishes). Built locally / in CI, never on Fly (256MB RAM → OOM).
- GitHub Actions `refresh-data.yml` runs daily 03:00 SGT: `npm run download` → `npm run deploy:data`
  (WAL checkpoint → gzip → SFTP → gunzip → atomic `mv` → restart).
- It was wedged 2026-07-04 → 2026-08-26: a dropped SFTP left a stale `/data/resale.db.new.gz`
  that flyctl refuses to overwrite. Fixed by `rm -f` of the staging files before upload.
- Private projects missing URA coords are geocoded via OneMap (`geocode_missing_projects()`).

### UI & frontend
- Units displayed in sqft / $psf (`sqmToSqft()` / `psmToPsf()`, ×10.7639); DB stays sqm.
- Dual-line $/sqm trend chart (blue HDB + purple private); trend % = 3-month rolling average at
  each end of the window.
- Multi-select flat types (empty Set = All; comma-separated `flat_type` param).
- Light/dark theme (anti-FOUC script, CARTO tile swap, chart re-render, CSS variables for popups).
- Mobile pass: section jump bar, "New Search" FAB, card-based transaction list with "Show more",
  share (Web Share API → clipboard fallback), map scroll-zoom off on mobile.
- In-app feedback → `POST /api/feedback` → separate writable `feedback.db` (not `resale.db`, which
  is replaced wholesale on refresh); honeypot + 5/hr per-IP limit.
- GA4 `G-WGC8D0FRSQ` with SPA page views + custom events (search, view_results, valuation_*, …).

### Quality & safety
- 247 Vitest + supertest tests against a fixture SQLite DB; 19 smoke tests against the live API;
  every deploy script gates on `npm test`.
- SQL injection fix in `/api/private/project-overview`; input validation on all endpoints (length
  caps, Singapore lat/lng bounds, geocode batch ≤100 — the client must cap at 100 too, or the map
  fails silently).
- `/api/resolve` routing fix: project names containing a town name ("BEDOK RESIDENCES") no longer
  resolve to the town (word-boundary partial matching).

## BTO Dataset

| Era | Launches | Projects | Notes |
|---|---|---|---|
| 2001–2009 | 40 | 59 | Sparsest. Often min-only prices, approximate application dates, combined-type rows; 4 projects with null coords (cancelled / never built). |
| 2010–2015 | 41 | 169 | From Apr 2010 the brochures have no price table — unit counts from Maps&Plans block tables, prices from secondary sources. |
| 2016–2020 | 19 | 99 | Mostly housingmap.sg brochures (Annex A often unrecoverable). Aug 2020 `price_max` values are estimated (flagged in its `_curation_note`). |
| 2021–2026 | 21 | 147 | Official HDB Annex A press releases. Nov 2026 official since 2026-11-06 (7,964 flats incl. 256 CCA; replaced the provisional entry). |
| **Total** | **121** | **474** | `bto_launches_info/` archives 695 source PDFs + per-project reference notes. |

Conventions (full detail in CLAUDE.md and the `seed-bto-launch` skill):
- Pre-Oct-2024 projects keep the old classification labels (Non-Mature/Mature/PLH) — the badge
  falls back to neutral styling.
- Reused project names get a `(MONTH YEAR)` / `(PHASE N)` suffix on the `project` key (Redhill
  Peaks, Alexandra Peaks, Tanjong Tree Residences, Coralinus, Segar Meadows, …) because `project`
  is a global unique key.
- Same-month separate exercises use `launch_id` letter suffixes (`2008-12a` / `2008-12b`), never
  day numbers (string sort).
- "Offered vs built" cases (Sembawang RiverLodge, Corporation Tiara) record only units actually
  offered. Community Care Apartments are excluded from `flats[]`.
- Sources, in order: HDB Annex A PDF → housingmap.sg brochures (rasterized unit-mix tables, read
  as images) → HDB's legacy VSF microsite via Wayback (pre-2010) → secondary press. Don't trust
  housingmap.sg unit totals blindly — cross-check.
- Annex lettering and URL suffixes aren't stable across launches (e.g. `Annex-A-20250723.pdf`,
  admin details in Annex C for Oct 2025).

## Still-Relevant Gotchas

- **WAL checkpoint** before any DB upload (`PRAGMA wal_checkpoint(TRUNCATE)`), or data still in
  the WAL is silently lost; delete stale `-wal`/`-shm` on the server when swapping DBs.
- **Fly**: free machines auto-stop and SSH doesn't wake them (`fly machines start` + sleep first);
  `fly ssh console --command` doesn't run a shell — wrap multi-step commands in `sh -c '...'`;
  large SFTP uploads drop, so gzip first; the CI token must be an **org** token (deploy tokens
  can't issue SSH certs).
- **GitHub**: pushing workflow files needs the `workflow` OAuth scope + `gh auth setup-git`;
  `npm ci` needs an in-sync `package-lock.json`; cron auto-disables after 60 days of inactivity.
- **Cache busting**: `bump-version.js` (run by `deploy`/`deploy:frontend`) bumps `?v=N`
  automatically — don't hand-edit unless deploying another way.
- **OneMap**: silently rate-limits (empty / non-JSON responses) — keep ~1–1.5s between requests;
  road names are unabbreviated vs the DB's abbreviated streets.
- **Composio CLI** (`~/.local/bin/composio`): GSC property `sc-domain:worthit.canlah.app`; Bing site
  `https://worthit.canlah.app/`. If every run is `zsh: killed`, the binary is corrupted — reinstall
  with `curl -fsSL https://composio.dev/install | bash`.
- **Deploy permission**: never deploy unless asked; the user manages commits.

## Important Patterns
- `resale.db` is opened `readonly: true`; data only changes via the Python pipeline.
- Town matching is case-insensitive; months are `YYYY-MM` strings; percentiles are computed in JS.
- Street matching cascade: exact → compressed → expanded → keyword fallback (`findDbStreets()`).
- Writable state (feedback) lives in `feedback.db`, never in `resale.db`.
