# Technical Context: WorthIt

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
- **HTML**: Single `index.html` page
- **CSS**: Tailwind CSS (CDN) + custom `styles.css`
- **JS**: Vanilla JavaScript (no framework)
- **Charts**: Chart.js
- **Fonts**: Inter (Google Fonts)
- **Map**: Leaflet.js

### External APIs
- **OneMap SG API**: Postal code → address/coordinates lookup, geocoding. Use 0.4s delay between requests in batch geocoding scripts
- **Nominatim (OpenStreetMap)**: Reverse geocoding, fallback geocoding (map display only — no longer used for postal search radius)
- **data.gov.sg**: HDB resale transaction data download
- **URA API**: Private property transaction data

## Deployment

### Hosting
- **API**: Fly.io (`worthit-api.fly.dev`) — Docker container with persistent volume
- **Frontend**: Cloudflare Pages (`worthit.canlah.app`) — static files from `public/`, deployed via `npx wrangler pages deploy public --project-name=worthit`, DNS on Cloudflare (domain from Porkbun)
- **Cost**: $0/month on free tiers

### Fly.io Configuration
- **Dockerfile**: Node.js 20 + Python 3 slim
- **Volume**: 1GB persistent at `/data` — stores `resale.db`
- **Env vars**: `DB_PATH=/data/resale.db`, `ONEMAP_TOKEN`, `URA_API_ACCESS_KEY` (via `fly secrets`)
- **Machine ID**: Set in `fly.toml`

### Database Seeding
- Fly.io free tier (256MB RAM) too small for Python download scripts (OOM)
- Build database locally, upload via `fly ssh sftp put`
- Monthly updates: re-download locally → re-upload

## Development Setup

### Prerequisites
- Node.js (for server)
- Python 3 with pip (for data download scripts)
- Internet connection (for API calls)

### Commands
```bash
npm install              # Install Node.js dependencies
pip install requests pyproj  # Python dependencies
npm run download-hdb     # Download HDB data
npm run download-ura     # Download URA data (requires URA_API_ACCESS_KEY)
npm start                # Start server on port 3000
npm run dev              # Start with --watch for auto-reload
```

### Environment Variables (.env)
- `PORT` — Server port (default: 3000)
- `DB_PATH` — SQLite database path (default: `server/db/resale.db`)
- `ONEMAP_TOKEN` — OneMap API bearer token
- `URA_API_ACCESS_KEY` — URA API access key

## Database Schema

### Table: `transactions`
| Column | Description |
|--------|-------------|
| month | YYYY-MM format |
| town | HDB town name (uppercase) |
| flat_type | e.g., "4-ROOM", "5-ROOM" |
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

## Technical Constraints
- **Cross-platform npm scripts**: `scripts/run-python.js` detects OS and uses correct venv path
- **No build step**: Vanilla JS served directly
- **No tests**: No test framework configured
- **Single server file**: All routes in `server/index.js` (~900+ lines)
- **SQLite limitations**: Not suitable for concurrent writes (acceptable since DB is readonly from server)
- **Fly.io RAM**: 256MB free tier — can't run Python data scripts on the machine