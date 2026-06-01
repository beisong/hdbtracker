# System Patterns: WorthIt

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
3. **Postal radius search**: `hdb_block_coords` SQLite bounding-box query — no external API; replaces old 9-point Nominatim reverse-geocoding approach

### SEO Architecture (Edge-Side Rendering for Bots)
Since WorthIt is a client-side SPA, search engines can't execute JS. The solution uses Cloudflare Pages Functions for edge-side meta injection:

```
User Request → Cloudflare Edge
  ├─ /robots.txt → Serve static text
  ├─ /sitemap.xml → Fetch from Fly.io API, transform to XML
  ├─ Bot detected? → Fetch SEO metadata from Fly.io → inject into HTML → serve
  └─ Normal user → Serve static SPA (index.html)
```

- **Bot detection**: Regex match on User-Agent (Googlebot, Bingbot, social crawlers, etc.)
- **Meta injection**: Server-side string replacement of `<title>`, `<meta>`, `<link rel="canonical">`, OG tags, JSON-LD
- **URL structure**: `/hdb/<town-slug>`, `/district/<code>`, `/private/<project-slug>`
- **Client-side routing**: `history.pushState()` + `popstate` listener for seamless SPA navigation
- **Sitemap**: Auto-generated from DB (26 towns + 28 districts + 200 projects), cached 24h
- **JSON-LD**: WebSite + SearchAction + FAQPage on homepage; BreadcrumbList + ResidentialProperty on detail pages

### Caching
- In-memory `Map` for geocode results (no TTL, grows indefinitely — known memory leak risk)
- Sitemap cache with 24-hour TTL on server
- No external cache (Redis, etc.)
- Nearby streets cache removed (replaced by `hdb_block_coords` synchronous DB query)

### Frontend Cache Busting
No build step means no content-hashed filenames. Strategy:
- `public/_headers`: sets `index.html` to `Cache-Control: no-cache, must-revalidate` so browsers always fetch fresh HTML; JS/CSS set to `max-age=31536000, immutable`
- `?v=N` query strings on all local asset `<script>`/`<link>` tags in `index.html` — increment N on every deploy where JS or CSS changes
- Current version: `v=9` (Jun 2026)

## Component Relationships

### Server (`server/index.js` — monolithic ~2200+ lines)
All routes and helpers in a single file:
- **Helpers**: `median()`, `percentile()`, `monthsAgoStr()`, `resolvePostalCode()`, `matchRoadToTown()`, `findDbStreets()`, `compressStreetName()`, `expandStreetName()`, `findNearbyHdbBlocks()`, `seedHdbBlockCoords()`, `fmtPrice()`, `fmtPsf()`, `trendPct()`
- **HDB Routes**: `/api/towns`, `/api/flat-types`, `/api/resolve`, `/api/area-overview`, `/api/nearby-hdb`
- **Geocoding**: `POST /api/geocode`
- **Private Property Routes**: `/api/private/projects`, `/api/private/project-overview`, `/api/private/district-overview`, `/api/private/district-summary`
- **SEO Routes**: `/api/seo/metadata`, `/api/seo/sitemap`
- **Removed**: `/api/nearby-streets` (replaced by `hdb_block_coords` approach)

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
- Geocode cache has no size limit (potential memory leak on long-running server)
- No database indexes — performance may degrade on large result sets