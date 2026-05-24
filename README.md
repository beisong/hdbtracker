# 🏠 WorthIt — Singapore Property Value Detective

Instantly check if a Singapore HDB resale flat or private property is fairly priced based on real transaction data from data.gov.sg and URA.

## Architecture

WorthIt uses a **split architecture**:

- **Frontend**: Static files (`public/`) served via Cloudflare Pages (or `node server/index.js` locally)
- **API Server**: Node.js/Express on [Fly.io](https://fly.io) with SQLite database
- `public/config.js` auto-detects environment and points API calls to the right backend

## Quick Start (Local Development)

### 1. Install Dependencies

```bash
npm install
pip install requests pyproj   # for data download scripts
```

### 2. Download Data

```bash
npm run download-hdb           # HDB transactions (~230K records)
# npm run download-ura         # Optional: URA private property data (requires URA_API_ACCESS_KEY)
```

This downloads HDB resale transaction records from data.gov.sg into `server/db/resale.db`.

### 3. Start the Server

```bash
npm start
```

Open http://localhost:3000 in your browser. Express serves both the frontend and API.

## Deploy to Fly.io (API Server)

### Prerequisites

```bash
npm install -g flyctl
fly auth login
```

### First-time Setup

```bash
fly launch           # Follow prompts (choose region, set app name)
fly secrets set ONEMAP_TOKEN=your_token_here   # optional, for geocoding
```

### Deploy

```bash
fly deploy
```

### Seed the Database

The Fly.io free tier (256MB RAM) is too small to run the Python download scripts. Instead, **build the database locally and upload it**:

```bash
# 1. Build database locally
python scripts/download_data.py
python scripts/download_ura_data.py   # optional

# 2. Upload to Fly.io volume
fly ssh sftp put server/db/resale.db /data/resale.db

# 3. Restart the machine to pick up the new DB
fly machine restart <machine-id>
```

### Verify

```bash
curl https://<your-app>.fly.dev/api/status
# Expected: {"status":"ok","total_transactions":370252,"latest_month":"2026-05",...}
```

## Debugging Commands

### Check server logs

```bash
fly logs                  # live log stream
fly logs --no-tail        # recent logs only
```

### Check machine status

```bash
fly machines list         # list all machines and their states
fly machine status <id>   # detailed status of a machine
```

### SSH into the machine

```bash
fly ssh issue             # one-time: create SSH certificate
fly ssh console           # open a shell on the machine
```

Inside the SSH shell:

```bash
ls -la /data/             # check database file exists
ls -la /app/              # check deployed files
curl localhost:8080/api/status   # test API from inside the machine
cat /app/server/index.js | head  # verify deployed code
```

### Upload / Download files

```bash
fly ssh sftp put local_file.txt /data/remote_file.txt    # upload
fly ssh sftp get /data/resale.db ./downloaded.db          # download
```

### Restart

```bash
fly machine restart <machine-id>    # restart a specific machine
fly machines restart                # restart all machines
```

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `503 Database not ready` | No DB file on volume | Run download scripts locally, then `fly ssh sftp put` |
| OOM kill on SSH | Not enough RAM for Python | Build DB locally and upload via SFTP |
| SSH auth failed | No SSH certificate | Run `fly ssh issue` then `fly ssh establish` |
| `no_database` status | DB missing at `/data/resale.db` | Upload via SFTP |

### Update Data (Monthly)

```bash
# Re-download latest data locally
python scripts/download_data.py

# Re-upload to Fly.io
fly ssh sftp put server/db/resale.db /data/resale.db
fly machine restart <machine-id>
```

## Deploy Frontend to Cloudflare Pages

### CLI Deploy (Recommended)

```bash
npx wrangler pages deploy public --project-name=worthit
```

First run will prompt browser authentication. This uploads `public/` and gives you a live URL (e.g., `https://worthit.pages.dev`).

### Alternative: GitHub-connected (Auto-deploys on push)

1. Push code to GitHub
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create
3. Connect your GitHub repo
4. Settings:
   - **Framework preset**: None
   - **Build command**: leave empty
   - **Build output directory**: `public`
5. Deploy

### Update Frontend

```bash
# Re-deploy after changes
npx wrangler pages deploy public --project-name=worthit
```

The frontend auto-connects to the Fly.io API via `config.js`.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Database status and record count |
| `GET /api/towns` | List all HDB towns + district labels |
| `GET /api/flat-types` | List all flat types |
| `GET /api/resolve?q=` | Resolve town name or postal code |
| `GET /api/area-overview?town=` | Main HDB market overview endpoint |
| `GET /api/nearby-streets?lat=&lng=&town=` | Find nearby DB streets |
| `POST /api/geocode` | Batch geocode addresses |
| `GET /api/private/projects?q=` | Search private property projects |
| `GET /api/private/project-overview?project=` | Private project details |
| `GET /api/private/district-summary?districts=` | District aggregate stats |
| `GET /api/private/district-overview?district=` | Full district overview |
| `GET /api/nearby-hdb?lat=&lng=` | Nearby HDB + private transactions |

## Project Structure

```
WorthIt/
├── scripts/
│   ├── download_data.py         # HDB data download (data.gov.sg)
│   └── download_ura_data.py     # URA private property data
├── server/
│   ├── index.js                 # Express API server
│   └── db/
│       └── resale.db            # SQLite database (generated)
├── public/
│   ├── index.html               # Main SPA
│   ├── config.js                # API base URL config
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── api.js               # API client
│       ├── app.js               # Main app logic
│       ├── charts.js            # Chart.js configs
│       └── map.js               # Leaflet map
├── Dockerfile                   # Fly.io Docker config
├── fly.toml                     # Fly.io app config
├── package.json
├── requirements.txt
└── README.md
```

## Tech Stack

- **Data**: data.gov.sg HDB Resale Flat Prices + URA private property transactions
- **Pipeline**: Python 3 + SQLite
- **Backend**: Node.js + Express + better-sqlite3
- **Frontend**: Vanilla JS + Tailwind CSS + Chart.js + Leaflet
- **Hosting**: Fly.io (API) + Cloudflare Pages (frontend)

## Data Sources

- [HDB Resale Flat Prices](https://data.gov.sg/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc) via data.gov.sg
- [URA Real Estate Transactions](https://www.ura.gov.sg/maps/api/) via URA

## Disclaimer

Prices shown are indicative and based on historical transaction data. They should not be considered as professional valuations. Always consult a licensed valuer or property agent for formal advice.