# Progress: WorthOrNot

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

## What's Left to Build / Improve
- 🔲 Automated tests (no test framework configured)
- 🔲 SQL injection fix in `/api/private/project-overview` (string interpolation)
- 🔲 Input validation/sanitization across all endpoints
- 🔲 Geocode cache size limits (prevent memory leak)
- 🔲 Database indexes for query performance
- 🔲 Server refactor (split monolithic `server/index.js` into modules)
- 🔲 Error handling improvements (consistent error responses)
- 🔲 Rate limiting on API endpoints
- 🔲 HTTPS support
- 🔲 Deployment configuration

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