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
- **Database**: SQLite3 (via Python stdlib)
- **Data sources**:
  - HDB resale data: data.gov.sg API (d_8b84c4ee58e3cfc0ece0d773c8ca6abc)
  - URA private property data: URA API

### Frontend
- **HTML**: Single `index.html` page
- **CSS**: Tailwind CSS (CDN) + custom `styles.css`
- **JS**: Vanilla JavaScript (no framework)
- **Charts**: Chart.js
- **Fonts**: Inter (Google Fonts)
- **Map**: Likely Leaflet.js (based on `map.js`)

### External APIs
- **OneMap SG API**: Postal code → address/coordinates lookup, geocoding
- **Nominatim (OpenStreetMap)**: Reverse geocoding, fallback geocoding, nearby street discovery
- **data.gov.sg**: HDB resale transaction data download
- **URA API**: Private property transaction data

## Development Setup

### Prerequisites
- Node.js (for server)
- Python 3 with venv (for data download scripts)
- Internet connection (for API calls)

### Commands
```bash
npm install          # Install Node.js dependencies
npm run setup        # Create Python venv + install deps (cross-platform)
npm run download     # Download HDB data (~5-10 min, uses venv)
npm run download-ura # Download URA private property data
npm start            # Start server on port 3000
npm run dev          # Start with --watch for auto-reload
```

### Environment Variables (.env)
- `PORT` — Server port (default: 3000)
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

## Technical Constraints
- **Cross-platform npm scripts**: `scripts/run-python.js` detects OS and uses correct venv path
- **No build step**: Vanilla JS served directly
- **No tests**: No test framework configured
- **Single server file**: All ~1164 lines in `server/index.js`
- **SQLite limitations**: Not suitable for concurrent writes (acceptable since DB is readonly from server)