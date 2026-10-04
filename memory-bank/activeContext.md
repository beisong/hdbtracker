# Active Context: WorthIt

> Condensed 2026-10-02 from a ~2,240-line session log (full history is in git: `git log -p -- memory-bank/activeContext.md`).
> Keep this file a high-level overview: current focus, recent changes, then one short entry per
> shipped feature. Per-launch BTO curation detail lives in each launch's `_curation_note` in
> `scripts/bto_launches.json` and in `bto_launches_info/`, not here.

## Current Focus & Next Steps

- **Search indexing (the main open problem)** — Google: sitemap 856 submitted / **0 indexed**,
  every inspected page "Crawled – currently not indexed", 0 impressions in Sept. Bing: indexing a
  little (Jun 50 / Jul 75 / Aug 4 / Sep 11 impressions, 0 clicks ever).
  - Re-check GSC + Bing **~mid-Oct 2026**. If pages recrawled after the 2026-09-26 proxy fix are
    still not indexed, the render bug wasn't the blocker — backlinks are.
  - Bing URL submission quota is only **100/day, 3,100/month**. Submitted 2026-10-01 (home, `/bto`,
    26 town pages, top 72 BTO pages by resale count) and 2026-10-02 (BTO ranks 73–172). Remaining:
    BTO ranks 173–223 (51 pages) + district/private pages (IndexNow still pings all 856 on deploy).
  - Off-site backlinks remain the biggest lever — see `progress.md` § Backlink playbook
    (data.gov.sg showcase first).
- **BTO post-MOP resale** — re-run `python scripts/fetch_bto_blocks.py` every few months to pick
  up projects reaching MOP (incremental; then `npm run deploy:api`). Next new BTO launch: seed it
  with the `seed-bto-launch` skill.
- **Not done (deliberately deferred)**: make the init `status`/`towns` failure non-fatal (dismiss
  overlay instead of full-screen error); Fly `min_machines_running = 1` to avoid cold starts.
- **Ops reminder**: the GitHub Actions `FLY_API_TOKEN` (org token) expires ~**Jun 2027** — renew
  with `fly tokens create org`.

## Recent Changes (Sep–Oct 2026)

### Bing SEO report fixes — CODE DONE 2026-10-05, NOT DEPLOYED (needs API + frontend deploy, bump `v=`)
Bing Webmaster flagged duplicate titles, duplicate meta descriptions, short titles, and no
backlinks (0 inbound links per the Bing API).
- **Diagnosis**: server-generated bot metadata was already ~unique (8/856 dupes). The main
  duplicate source is likely **Fly cold starts** — the edge waits 5s for `/api/seo/metadata`, then
  falls back to the homepage title/description (a cold bingbot request measured 5.1s). Cold-start
  fix (edge cache of metadata + 503 Retry-After fallback, or `min_machines_running = 1`) proposed
  but **not implemented** — user picked fixes 2–4 only.
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
| 2021–2026 | 21 | 147 | Official HDB Annex A press releases. Nov 2026 is provisional (third-party trackers). |
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

- **WAL checkpoint** before any DB upload (`PRAGMA wal_checkpoint(TRUNCATE)`), or geocoded data in
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
