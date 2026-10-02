# Progress: WorthIt

> Restructured 2026-10-02. Detailed per-change history is in git and in `activeContext.md`
> § Feature History.

## What Works (all deployed — cache `v=27`)

**Search & analysis**
- ✅ Search by town, postal code (500m true-radius via `hdb_block_coords`), district (D01–D28),
  private project, or BTO project; autocomplete with type badges.
- ✅ Area overview: median, $psf, price range, per-flat-type cards, percentiles (p10–p90),
  multi-select flat types.
- ✅ Dual-line $/sqm trend chart (HDB + private) with 6m/1y/3y/5y trend % (3-month rolling avg).
- ✅ Price distribution histogram; filterable/sortable transactions (table on desktop, cards on mobile).
- ✅ Map: deal-score coloured markers (HDB + private), MRT overlay, lease in popups, every block in
  the radius gets a marker, nearby private projects within 800m.
- ✅ Check My Price: `/api/valuation` Deal Score + fair-value range from storey-adjusted nearby comps;
  entry via postal results card, 💰 buttons on transaction rows, `/check/<postal>?price=` links.
- ✅ Private projects: project overview, district context, EC / MOP detection.

**BTO**
- ✅ 121 launches / 474 projects (Apr 2001 → Nov 2026 provisional) from `scripts/bto_launches.json`;
  `/bto` index + `/bto/<slug>` pages with flats, prices, BTO-vs-nearby-resale comparison.
- ✅ Post-MOP projects show their own resale transactions (`scripts/bto_project_blocks.json`, 219/262
  projects; MOP gate = remaining lease < 95y); studio-only projects show a 30-year-lease note.

**SEO**
- ✅ Edge-side rendering for bots (incl. AI crawlers) with data-driven titles, JSON-LD, page content.
- ✅ Programmatic pages: towns, town × flat-type, districts, private projects, BTO projects; 856-URL sitemap.
- ✅ E-E-A-T pages `/about`, `/methodology`, `/data-sources`; soft-404 guard; freshness notes.
- ✅ Same-origin `/api/*` proxy so Googlebot can render pages (fixed 2026-09-26).
- ✅ IndexNow ping on every frontend deploy; Cloudflare Crawler Hints on.

**Platform**
- ✅ Cloudflare Pages frontend + Fly.io API + SQLite on a Fly volume; $0/month.
- ✅ Daily automated data refresh (GitHub Actions → build → gzip → SFTP → atomic swap → restart).
- ✅ Light/dark theme; mobile UX (jump bar, FAB, share, card tap → map highlight).
- ✅ In-app feedback → separate `feedback.db`; GA4 with SPA page views + custom events.
- ✅ 247 unit + integration tests + 19 smoke tests; every deploy gated on `npm test`.

## Outstanding

### Features
- 🔲 **Town comparison view** — compare 2–3 towns (or town × flat-type) side by side: median, $psf,
  YoY, lease profile, volume, with all trend lines on one chart. URL e.g.
  `/compare/tampines-vs-bedok/4-room`.
  - v1 needs no new server aggregation: call `/api/area-overview` per town in parallel.
  - `app.js`: "+ Compare" button on town results, new `renderCompareResults()`; generalise
    `charts.js` `renderTrendChart()` to N labelled lines.
  - SEO: `/compare/` metadata branch + sitemap entries for the top ~50 adjacent-town pairs
    ("tampines vs bedok 4 room resale price" long-tail).
- 🔲 **MRT search + nearest-MRT labels**
  - **Phase A (~half a day, no server change)**: `nearestStation(lat, lng)` in `map.js` (haversine over
    ~180 stations); show "🚇 450m to Bishan (NS17) · ~6 min walk" (80m/min) in all popups and on
    mobile transaction cards.
  - **Phase B (~1–2 days)**: search by station — MRT branch in `/api/resolve` after exact-town match
    (bare "bishan" → town; "bishan mrt" / "bishan station" / "NS17" → station), autocomplete entries
    with an MRT badge, then reuse the postal pipeline (`/api/area-overview?lat=&lng=`) with an
    optional `radius` param (800m for MRT, capped ≤1000m). Route `/mrt/<station-slug>` + SEO branch +
    ~180 sitemap entries.
  - **Gotcha**: `public/data/mrt_stations.json` is frontend-only and `.dockerignore` excludes
    `public/`, so the API can't read it — keep a canonical copy at `server/data/mrt_stations.json`
    with a sync-check test.

### Engineering
- 🔲 Geocode cache (`geocodeCache`) has no size limit — add eviction.
- 🔲 Split the monolithic `server/index.js` (~3,400 lines) into modules.
- 🔲 Remove unused precomputed tables (`town_stats`, `monthly_medians`, `storey_adjustments`) from
  `download_data.py`, or start using them.
- 🔲 Make the init `status`/`towns` failure non-fatal (dismiss the overlay instead of a full-screen
  error); consider Fly `min_machines_running = 1` to avoid cold starts.
- ⏭️ Deferred by choice: replace the Tailwind Play CDN with prebuilt static CSS (biggest Core Web
  Vitals win, higher regression risk).

### Search indexing & distribution
- 🔲 Re-check GSC + Bing ~mid-Oct 2026 (see `activeContext.md` § Current Focus for the baseline).
- 🔲 Submit the remaining ~150 post-MOP BTO pages + district/private pages to Bing (100/day quota).
- 🔲 Backlinks — see playbook below.

## Backlink Playbook

Google won't index a new subdomain nothing links to, so off-site links are the biggest remaining
lever. Link to the most relevant deep page (e.g. `/hdb/tampines/4-room`), never just the homepage.

1. **Citations (do first)**
   - 🔲 **data.gov.sg app showcase** — WorthIt is built on their HDB resale dataset; a `.gov.sg` link.
   - Product Hunt (Tue/Wed launch), BetaList, SaaSHub, AlternativeTo (as a free alternative to
     PropertyGuru / 99.co / SRX).
   - GitHub README, LinkedIn, any personal site.
2. **Community** — r/singaporefi, r/askSingapore, HardwareZone EDMW / Money Mind, Seedly community,
   SG property Telegram groups: genuinely helpful answers linking a specific town or BTO page.
3. **Content / PR** — pitch a data snapshot (e.g. "cheapest towns by Deal Score", BTO launch price vs
   today's resale) to Seedly, Dollars and Sense, MoneySmart, Stacked Homes; answer journalist
   requests with a stat + link.

Avoid paid link farms and mass-posting the same link (penalty / spam risk).

## Known Issues
1. Geocode cache has no size limit (see Engineering backlog).
2. GSC: 0 of 856 URLs indexed as of 2026-10-01.

## Evolution of Project Decisions
- Started HDB-only; added URA private property, then BTO launches, then post-MOP BTO resale.
- Nearby-block lookup: street names → Nominatim 9-point reverse geocoding → `hdb_block_coords`
  distance query (no external API).
- DB build: SSH + Python on Fly OOM'd → local/CI build + gzip SFTP upload with atomic swap.
- SEO: on-page work first (May–Jun 2026); GSC data in Sep showed the real blocker is indexing and
  backlinks, not on-page content.
- BTO project → block mapping: OneMap `BUILDING` names, not geometric heuristics.
