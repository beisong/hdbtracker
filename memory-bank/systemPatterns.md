# System Patterns: WorthOrNot

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Python Scripts  │────▶│   SQLite DB      │◀────│  Express.js  │
│  (Data Pipeline) │     │   (resale.db)     │     │   Server      │
└─────────────────┘     └──────────────────┘     └──────┬───────┘
                                                         │ REST API
┌─────────────────────────────────────────────────────────▼──────┐
│                    Vanilla JS SPA (public/)                     │
│  index.html + Tailwind CSS + Chart.js + Map (map.js)           │
└────────────────────────────────────────────────────────────────┘
```

## Key Technical Decisions

### Data Layer
- **SQLite** with WAL mode for concurrent read access
- Single `transactions` table for both HDB and URA_PRIVATE records (distinguished by `dataset_source` column)
- Pre-computed `price_per_sqm` stored in DB
- `project_coords` table for private property coordinates
- DB opened in `readonly: true` mode from server

### Street Name Matching (Multi-Strategy)
Singapore street names have many abbreviation variants (e.g., "ST" vs "STREET", "BT" vs "BUKIT"). The matching system uses:
1. **Exact match**: road name as-is against DB
2. **Compressed**: full words → DB abbreviations (STREET→ST, BUKIT→BT)
3. **Expanded**: DB abbreviations → full words (ST→STREET, BT→BUKIT)
4. **Keyword fallback**: strip stop words, try meaningful keywords individually and in pairs

### Road → Town Resolution
1. Check if any DB town name appears in the road name
2. Check against hardcoded `roadPrefixMap` (70+ mappings)
3. Query DB street names with LIKE patterns using meaningful keywords

### Geocoding Pipeline
1. **Primary**: OneMap SG API (block + expanded street name)
2. **Fallback**: Nominatim OpenStreetMap (for addresses OneMap can't find)
3. **Nearby streets**: Reverse-geocode 9 points (center + 8 compass at ~200m) via Nominatim

### Caching
- In-memory `Map` for geocode results (no TTL, grows indefinitely)
- In-memory nearby streets cache with 24-hour TTL
- No external cache (Redis, etc.)

## Component Relationships

### Server (`server/index.js` — monolithic ~1164 lines)
All routes and helpers in a single file:
- **Helpers**: `median()`, `percentile()`, `monthsAgoStr()`, `resolvePostalCode()`, `matchRoadToTown()`, `matchRoadToTownViaDB()`, `findDbStreets()`, `findNearbyStreets()`, `compressStreetName()`, `expandStreetName()`
- **HDB Routes**: `/api/towns`, `/api/flat-types`, `/api/resolve`, `/api/nearby-streets`, `/api/area-overview`
- **Geocoding**: `POST /api/geocode`
- **Private Property Routes**: `/api/private/projects`, `/api/private/project-overview`

### Frontend Files
- `public/js/api.js` — API client functions
- `public/js/app.js` — Main app logic, UI interactions
- `public/js/charts.js` — Chart.js configurations
- `public/js/map.js` — Map visualization (likely Leaflet or similar)
- `public/css/styles.css` — Custom styles
- `public/data/mrt_stations.json` — Static MRT station data

## Critical Implementation Paths

1. **Postal code → Market data**: `POSTAL → OneMap → road → town → area-overview → charts`
2. **Private property search**: `project name → /api/private/projects → /api/private/project-overview`
3. **Map markers**: `transactions → /api/geocode → lat/lng → map markers`

## Known Issues
- SQL injection vulnerability in `/api/private/project-overview` (string interpolation for property type filter)
- No database indexes mentioned — performance may degrade with large result sets
- Geocode cache has no size limit (potential memory leak)