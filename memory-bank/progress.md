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

## Known Issues
1. **SQL injection**: `/api/private/project-overview` builds SQL with string interpolation for `property_type` filter
2. **Memory leak potential**: Geocode cache (`Map`) has no size limit or eviction policy
3. **No DB indexes**: Large queries may be slow without proper indexing
4. **Windows-only scripts**: npm scripts use `venv\Scripts\python` (backslash)

## Evolution of Project Decisions
- Started as HDB-only tool, later expanded to include URA private property data
- Street matching evolved from simple prefix matching to multi-strategy system (exact → compressed → expanded → keyword)
- Geocoding started with OneMap only, added Nominatim as fallback for better coverage
- Added nearby streets feature using compass-point reverse geocoding for location-based filtering