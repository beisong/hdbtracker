# Progress: WorthIt

> Restructured 2026-10-02. Detailed per-change history is in git and in `activeContext.md`
> § Feature History.

## What Works (all deployed — cache `v=32`)

**Search & analysis**
- ✅ Search by town, postal code (500m true-radius via `hdb_block_coords`), district (D01–D28),
  private project, or BTO project; autocomplete with type badges.
- ✅ Area overview: median, $psf, price range, per-flat-type cards, percentiles (p10–p90),
  multi-select flat types.
- ✅ Dual-line $/sqm trend chart (HDB + private) with 6m/1y/3y/5y trend % (3-month rolling avg).
- ✅ Price distribution histogram; filterable/sortable transactions (table on desktop, cards on mobile).
- ✅ Map: deal-score coloured markers (HDB + private), MRT overlay, lease in popups, every block in
  the radius gets a marker, nearby private projects within 800m, nearest-MRT distance + walk time
  in every popup and mobile card.
- ✅ Town comparison: `/compare/<a>-vs-<b>[-vs-<c>][/<flat-type>]` — 2–3 towns side by side
  (median, $psf, 1y change, volume, most popular type) with one trend line per town.
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
- ✅ Programmatic pages: towns, town × flat-type, districts, private projects, BTO projects, 48
  adjacent-town comparisons; 904-URL sitemap.
- ✅ E-E-A-T pages `/about`, `/methodology`, `/data-sources`; soft-404 guard; freshness notes.
- ✅ Same-origin `/api/*` proxy so Googlebot can render pages (fixed 2026-09-26).
- ✅ IndexNow ping on every frontend deploy; Cloudflare Crawler Hints on.

**Platform**
- ✅ Cloudflare Pages frontend + Fly.io API + SQLite on a Fly volume; $0/month.
- ✅ Daily automated data refresh (GitHub Actions → build → gzip → SFTP → atomic swap → restart).
- ✅ Light/dark theme; mobile UX (jump bar, FAB, share, card tap → map highlight).
- ✅ In-app feedback → separate `feedback.db`; GA4 with SPA page views + custom events.
- ✅ 356 unit + integration tests + 133 pytest tests (data scripts) + 19 smoke tests; every deploy
  gated on `npm test`.
- ✅ Nightly refresh fails loudly on partial downloads and refuses to deploy a short DB.

## Outstanding

### Features
- ✅ **Town comparison view** — deployed 2026-11-04 (PR #10).
- **MRT search + nearest-MRT labels**
  - ✅ **Phase A** (nearest-MRT labels in popups + mobile cards) — deployed 2026-11-04 (PR #8).
  - 🔲 **Phase B (~1–2 days)**: search by station — MRT branch in `/api/resolve` after exact-town match
    (bare "bishan" → town; "bishan mrt" / "bishan station" / "NS17" → station), autocomplete entries
    with an MRT badge, then reuse the postal pipeline (`/api/area-overview?lat=&lng=`) with an
    optional `radius` param (800m for MRT, capped ≤1000m). Route `/mrt/<station-slug>` + SEO branch +
    ~180 sitemap entries.
  - **Gotcha**: `public/data/mrt_stations.json` is frontend-only and `.dockerignore` excludes
    `public/`, so the API can't read it — keep a canonical copy at `server/data/mrt_stations.json`
    with a sync-check test.

### Engineering
- 🔲 Split the monolithic `server/index.js` (~3,400 lines) into modules.
- 🔲 Remove unused precomputed tables (`town_stats`, `monthly_medians`, `storey_adjustments`) from
  `download_data.py`, or start using them.
- ✅ Init `status`/`towns` failure is non-fatal (PR #9). 🔲 Consider Fly `min_machines_running = 1`
  to avoid cold starts.
- ✅ 2026-11-04 audit fixes deployed (PRs #1–#7): true medians, exact BTO slugs, fail-loud refresh,
  geocode proxy removed, feedback caps, `cors`/`node-fetch` dropped, slimmer Dockerfile, pytest suite.
- 🔲 Audit leftovers: cache the town list and `/api/status` counts; `(block, street_name)` index for
  `/api/valuation`; JSON 404 for unknown `/api/*` paths (currently fall through to `index.html`).
- ⏭️ Deferred by choice: replace the Tailwind Play CDN with prebuilt static CSS (biggest Core Web
  Vitals win, higher regression risk).

### Search indexing & distribution
- ✅ **Bing SEO report fixes deployed** 2026-10-07 (API + frontend, `v=29`, commit `df0947b`) —
  private exact slugs, server-sourced SPA titles, title/description lengths.
- 🔲 Re-submit affected URLs to Bing after the 2026-10-07 deploy.
- ✅ **Fly cold-start SEO fallback fixed + deployed** 2026-10-24 (frontend `v=31`) — the edge fallback was
  writing literal `<title>undefined</title>` + homepage content on deep URLs whenever the API machine
  was asleep. Now: title guarded, metadata memoized in the edge Cache API (24h), timeout 5s → 8s,
  crawlers get 503 + `Retry-After` while link-preview bots still get the real page. 276 tests pass.
- 🔲 Manually "Request indexing" in GSC for the top ~20 URLs (the Indexing API is
  job-posting-only, so this can't be scripted).
- 🔲 Re-check GSC + Bing coverage in ~2 weeks (edge fix shipped 2026-10-24; see
  `activeContext.md` § Current Focus).
- ✅ Submitted 2026-10-07 (100/100 quota): all 28 district pages + 72 highest-volume private
  project pages (Bing `SUBMIT_URLS`, `submitted: true`). Remaining: ~128 private pages + 51
  post-MOP BTO pages (ranks 173–223), 100/day.
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
1. GSC: 0 of 856 URLs indexed (sitemap 856 submitted / 0 indexed, no page impressions);
   re-checked 2026-10-24 — 12/15 sampled pages "Crawled – currently not indexed", 3 "URL is unknown
   to Google", only 30 lifetime impressions / 0 clicks (crawl OK, canonical OK, indexing allowed →
   authority/backlinks, plus the now-fixed cold-start duplicate-content bug). Bing, by contrast,
   had 384 URLs indexed with 0 crawl errors.

## Evolution of Project Decisions
- Started HDB-only; added URA private property, then BTO launches, then post-MOP BTO resale.
- Nearby-block lookup: street names → Nominatim 9-point reverse geocoding → `hdb_block_coords`
  distance query (no external API).
- DB build: SSH + Python on Fly OOM'd → local/CI build + gzip SFTP upload with atomic swap.
- SEO: on-page work first (May–Jun 2026); GSC data in Sep showed the real blocker is indexing and
  backlinks, not on-page content.
- BTO project → block mapping: OneMap `BUILDING` names, not geometric heuristics.
