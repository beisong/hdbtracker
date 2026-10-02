# Technical Context: WorthIt

> Scope: technology versions, hosting/config, environment variables, DB schema, external APIs.
> Architecture, commands, deploy/data-update steps and code patterns live in **CLAUDE.md** (single
> source) — don't duplicate them here.

## Technologies

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 4.21
- **Database driver**: better-sqlite3 11.7 (synchronous SQLite3 binding)
- **HTTP client**: node-fetch 2.7 (CommonJS compatible)
- **CORS**: cors 2.8
- **Config**: dotenv 17.4

### Data Pipeline
- **Language**: Python 3
- **HTTP**: requests library
- **Geo**: pyproj (coordinate conversion)
- **Database**: SQLite3 (via Python stdlib)
- **Data sources**:
  - HDB resale data: data.gov.sg API
  - URA private property data: URA API

### Frontend
- **HTML**: Single `index.html` SPA
- **CSS**: Tailwind CSS (Play CDN) + custom `styles.css`
- **JS**: Vanilla JavaScript (no framework)
- **Charts**: Chart.js 4
- **Fonts**: Inter (Google Fonts)
- **Map**: Leaflet.js 1.9.4
- **Analytics**: Google Analytics 4 (`G-WGC8D0FRSQ`) with SPA pageview tracking + custom events (`App.track()`)
- **Edge functions**: `functions/[[path]].js` — Cloudflare Pages Function: same-origin `/api/*` proxy to Fly, bot SEO injection, robots/sitemap, static E-E-A-T pages

### External APIs
- **OneMap SG API**: Postal code → address/coordinates lookup, geocoding, BTO block names (`BUILDING` field). Silently rate-limits — keep ≥0.35s between geocode calls in batch scripts and ~1.5s for search-heavy scripts like `fetch_bto_blocks.py`
- **Nominatim (OpenStreetMap)**: Reverse geocoding, fallback geocoding (map display only — no longer used for postal search radius)
- **data.gov.sg**: HDB resale transaction data download
- **URA API**: Private property transaction data

## Deployment

### Hosting
- **API**: Fly.io (`worthit-api.fly.dev`) — Docker container with persistent volume
- **Frontend**: Cloudflare Pages (`worthit.canlah.app`) — static files from `public/` + `functions/`, deployed via `node scripts/deploy-frontend.js` (loads `.env` cross-platform, then runs wrangler), DNS on Cloudflare (domain from Porkbun)
- **Data refresh**: GitHub Actions `refresh-data.yml`, daily 03:00 SGT (`npm run download` → `npm run deploy:data`); secrets `URA_API_ACCESS_KEY` + `FLY_API_TOKEN` (org token, expires ~Jun 2027)
- **Cost**: $0/month on free tiers

### Fly.io Configuration
- **Dockerfile**: Node.js 20 + Python 3 slim
- **Volume**: 1GB persistent at `/data` — stores `resale.db`
- **Env vars**: `DB_PATH=/data/resale.db`, `ONEMAP_TOKEN`, `URA_API_ACCESS_KEY` (via `fly secrets`)
- **Machine ID**: Set in `fly.toml`

### Data updates
The Python pipeline can't run on Fly (256MB RAM → OOM): the DB is built in GitHub Actions (daily) or locally and uploaded — steps in CLAUDE.md.

## Development Setup

### Prerequisites
- Node.js (for server)
- Python 3 with pip (for data download scripts)
- Internet connection (for API calls)

Python dependencies: `pip install -r requirements.txt` (venv managed by `scripts/run-python.js`). npm commands: see CLAUDE.md.

### Environment Variables (.env)
- `PORT` — Server port (default: 3000)
- `DB_PATH` — SQLite database path (default: `server/db/resale.db`)
- `ONEMAP_TOKEN` — OneMap API bearer token
- `URA_API_ACCESS_KEY` — URA API access key
- `CLOUDFLARE_API_TOKEN` — Wrangler auth token for frontend deploys (avoids `wrangler login` expiry; works cross-platform via `scripts/deploy-frontend.js`)

## Database Schema

### Table: `transactions`
| Column | Description |
|--------|-------------|
| month | YYYY-MM format |
| town | HDB town name (uppercase) |
| flat_type | e.g., "4 ROOM", "5 ROOM", "EXECUTIVE" (private: property type) |
| block | Block number |
| street_name | Street name (abbreviated) |
| storey_range | e.g., "04 TO 06" |
| floor_area_sqm | Floor area in sqm |
| flat_model | Flat model type |
| remaining_lease_years | Years of lease remaining |
| resale_price | Transaction price (SGD) |
| price_per_sqm | Pre-computed price per sqm |
| dataset_source | "HDB" or "URA_PRIVATE" |
| project | Private property project name (URA only) |
| district | District code (URA only) |
| market_segment | Market segment (URA only) |
| type_of_sale | Sale type (URA only) |
| type_of_area | Area type (URA only) |

### Table: `project_coords`
| Column | Description |
|--------|-------------|
| project | Project name |
| latitude | Latitude |
| longitude | Longitude |
| district | District code |
| street_name | Street name |
| market_segment | CCR/RCR/OCR |

### Table: `hdb_block_coords`
| Column | Description |
|--------|-------------|
| block | Block number |
| street_name | Street name |
| lat | Latitude |
| lng | Longitude |
| postal | Postal code |

12,442 rows covering 100% of HDB addresses in the transactions DB. Seeded from `scripts/hdb_blocks.csv`. Used for postal code radius search — replaces old Nominatim 9-point reverse geocoding. Index on `(lat, lng)` for bounding-box queries.

### Table: `bto_projects`
One row per BTO project × flat type, seeded from `scripts/bto_launches.json` (schema in
`.claude/skills/seed-bto-launch/references/schema.md`). Never mixed into `transactions`.

### Other data files
- `scripts/bto_project_blocks.json` — BTO project → HDB blocks (from `scripts/fetch_bto_blocks.py`),
  loaded in memory by the server for post-MOP resale.
- `feedback.db` — separate writable SQLite (`FEEDBACK_DB_PATH`, default next to `resale.db`) for
  in-app feedback; survives data refreshes.
- `town_stats`, `monthly_medians`, `storey_adjustments` — precomputed by `download_data.py` but
  currently unused by the server.

## Technical Constraints
- **Cross-platform npm scripts**: `scripts/run-python.js` detects OS and uses correct venv path; `scripts/deploy-frontend.js` loads `.env` before wrangler for cross-platform auth
- **Single server file**: All routes in `server/index.js` (~3,400 lines) — refactor into modules is a known backlog item
- **SQLite limitations**: Not suitable for concurrent writes (acceptable since DB is readonly from server)
- **No build step / tests / cache busting**: see CLAUDE.md.
