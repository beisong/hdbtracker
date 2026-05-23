# Active Context: WorthOrNot

## Current State
The project is functional with core features working:
- HDB resale data download and storage pipeline
- URA private property data download
- REST API with full market analysis endpoints
- Single-page application UI with charts, maps, and tables
- Postal code resolution via OneMap API
- Street name matching with abbreviation expansion/compression
- Map visualization of transactions
- MRT station data available (`public/data/mrt_stations.json`)

## Recent Changes (based on codebase)
- Added district code search (e.g., "D22", "District 16") with private property overview
- Added `/api/private/district-summary` endpoint for showing private data on HDB town pages
- Added `/api/private/district-overview` endpoint for full district search results
- Added `TOWN_TO_DISTRICTS` / `DISTRICT_TO_TOWNS` mappings (26 towns, 28 districts)
- Added district labels in autocomplete (`DISTRICT_LABELS` object, e.g., "D10 — Bukit Timah, Holland")
- Private property summary card on HDB town pages (avg price, $/sqm, top projects)
- Private property project markers on map when viewing HDB towns
- Fixed `/api/towns` to properly filter out URA_PRIVATE records (uses `dataset_source != 'URA_PRIVATE'`)
- Added URA private property support (`scripts/download_ura_data.py`, `/api/private/*` endpoints)
- Added map feature (`public/js/map.js`)
- Added nearby streets feature via Nominatim reverse geocoding
- Added geocoding endpoint with OneMap primary + Nominatim fallback
- Street-level filtering for area overview queries

## Next Steps / Potential Improvements
- Performance optimization for large queries (some use LIMIT 10000)
- SQL injection risk in `/api/private/project-overview` (uses string interpolation for `propTypeFilter`)
- Add automated tests
- Add input validation/sanitization across endpoints
- Consider adding caching headers for static API responses
- Mobile responsiveness improvements

## Active Decisions & Considerations
- Database is opened in `readonly: true` mode — data only changes via Python scripts
- In-memory caches for geocoding and nearby streets (no persistence)
- Nominatim rate limiting: 1 req/sec with 1.1s delays
- Street matching uses a multi-strategy approach: exact → compressed → expanded → keyword fallback

## Important Patterns
- All town matching is case-insensitive (`.toUpperCase()`)
- Month format: `YYYY-MM` strings
- Price percentiles calculated in JS, not SQL
- `dataset_source` column distinguishes HDB vs URA_PRIVATE records