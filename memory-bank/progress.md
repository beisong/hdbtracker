# Progress: WorthIt

## What Works
- ✅ HDB resale data download pipeline (Python → SQLite)
- ✅ URA private property data download pipeline
- ✅ Express.js server with full REST API
- ✅ HDB area overview endpoint with town/street/flat-type filtering
- ✅ Postal code resolution (OneMap → road → town matching)
- ✅ Street name abbreviation/expansion matching system
- ✅ Nearby streets discovery via Nominatim reverse geocoding
- ✅ Geocoding with OneMap primary + Nominatim fallback
- ✅ Private property project search and overview
- ✅ Price trend analysis (6m, 1y, 3y, 5y changes)
- ✅ Price distribution histograms
- ✅ Price percentiles (p10, p25, p50, p75, p90)
- ✅ Map visualization with transaction markers
- ✅ SPA frontend with Tailwind CSS + Chart.js
- ✅ Cross-platform npm scripts (works on both Windows and macOS/Linux)
- ✅ Mobile-responsive design (card layout, scrollable filters, responsive map/charts)
- ✅ District code search (e.g., "D22", "District 16") showing private property overview
- ✅ Town ↔ district mapping (TOWN_TO_DISTRICTS, DISTRICT_TO_TOWNS)
- ✅ Private property summary on HDB town pages (avg price, $/sqm, top projects)
- ✅ District labels in autocomplete (e.g., "D10 — Bukit Timah, Holland")
- ✅ Private property markers on map when viewing HDB towns

## Deployment — Split Architecture (Frontend / Backend)

**Architecture:**
```
yourdomain.com       → Cloudflare Pages (static HTML/JS/CSS)
api.yourdomain.com   → Fly.io (Express API + SQLite)
```

**Infrastructure Setup (done):**
- ✅ Create `Dockerfile` (Node.js + Python for data scripts)
- ✅ Create `fly.toml` (Fly.io config with persistent volume mount)
- ✅ Create `.dockerignore`
- ✅ Make SQLite DB path configurable via env var (`DB_PATH`) in server + Python scripts
- ✅ URA access key reads from env var (works with `fly secrets`)

**Step 1 — Code Changes (done):**
- ✅ Add `API_BASE` config to frontend JS (auto-detects localhost vs production)
- ✅ Create `public/config.js` with environment-aware API URL
- ✅ Add config script to `index.html` (loads before `api.js`)
- ✅ Update `server/index.js` CORS for cross-origin requests (Cloudflare Pages, fly.dev, pages.dev)
- ✅ Update Dockerfile to not copy `public/` folder
- ✅ Update `.dockerignore` to exclude `public/`
- ✅ Rename Fly.io app to `worthit-api`

**Step 2 — Deploy Backend to Fly.io (user runs manually):**
- 🔲 `fly apps create worthit-api`
- 🔲 `fly volumes create data --size 1 --region sin`
- 🔲 `fly secrets set ONEMAP_TOKEN=... URA_API_ACCESS_KEY=...`
- 🔲 `fly deploy`
- 🔲 SSH in and run data download scripts
- 🔲 Verify: `curl https://worthit-api.fly.dev/api/status`

**Step 3 — Deploy Frontend to Cloudflare Pages (user via dashboard):**
- 🔲 Cloudflare → Pages → Create project → Connect GitHub repo
- 🔲 Set build output directory to `public`
- 🔲 No build command needed (static files)
- 🔲 Verify: `https://hdbtracker.pages.dev` works

**Step 4 — Custom Domain (user):**
- 🔲 Purchase domain on Porkbun
- 🔲 Porkbun DNS: `api.yourdomain.com` CNAME → `worthit-api.fly.dev`
- 🔲 Porkbun DNS: `yourdomain.com` CNAME → `hdbtracker.pages.dev`
- 🔲 `fly certs add api.yourdomain.com`
- 🔲 Cloudflare Pages → Custom domain → add `yourdomain.com`

## What's Left to Build / Improve
- 🔲 Automated tests (no test framework configured)
- 🔲 SQL injection fix in `/api/private/project-overview` (string interpolation)
- 🔲 Input validation/sanitization across all endpoints
- 🔲 Geocode cache size limits (prevent memory leak)
- 🔲 Database indexes for query performance
- 🔲 Server refactor (split monolithic `server/index.js` into modules)
- 🔲 Error handling improvements (consistent error responses)
- 🔲 Rate limiting on API endpoints

## Recent Changes
- Mobile responsiveness overhaul: transaction cards on mobile (replacing table), horizontally scrollable filter bar, responsive map height (280px mobile / 420px desktop), smaller chart tick limits on mobile, touch-friendly button sizes, safe-area-inset padding for footer, compact nav on mobile

## Known Issues
1. **SQL injection**: `/api/private/project-overview` builds SQL with string interpolation for `property_type` filter
2. **Memory leak potential**: Geocode cache (`Map`) has no size limit or eviction policy
3. **No DB indexes**: Large queries may be slow without proper indexing

## Evolution of Project Decisions
- Started as HDB-only tool, later expanded to include URA private property data
- Street matching evolved from simple prefix matching to multi-strategy system (exact → compressed → expanded → keyword)
- Geocoding started with OneMap only, added Nominatim as fallback for better coverage
- Added nearby streets feature using compass-point reverse geocoding for location-based filtering
- npm scripts converted from Windows-only paths to cross-platform via `scripts/run-python.js` wrapper