# 🏠 WorthIt — Singapore Property Value Detective

Instantly check if a Singapore HDB resale flat or private property is fairly priced based on real transaction data from data.gov.sg and URA.

### 🔗 Live site: **[worthit.canlah.app](https://worthit.canlah.app)**

A free tool for Singapore homeowners and buyers — check HDB resale prices, condo transaction history, price trends, and fair-value estimates for any town, district, or project.

**Check My Price**: search any HDB postal code, enter an asking price, and get a 0–100 Deal Score with a fair-value range from storey-adjusted comparable sales nearby — flat type, size, floor, and remaining lease are inferred automatically from the block's transaction history.

## Architecture

WorthIt uses a **split architecture**:

- **Frontend**: Static files (`public/`) served via Cloudflare Pages (or `node server/index.js` locally)
- **API Server**: Node.js/Express on [Fly.io](https://fly.io) with SQLite database
- The SPA always calls same-origin `/api/*` (`public/config.js` sets `API_BASE = ''`): locally Express serves it; in production the Cloudflare Pages Function (`functions/[[path]].js`) proxies it to Fly.io

## Quick Start (Local Development)

### 1. Install Dependencies

```bash
npm install
npm run setup                 # Python venv + requirements.txt for the data scripts
```

### 2. Download Data

```bash
npm run download              # HDB (data.gov.sg) then URA private (needs URA_API_ACCESS_KEY in .env)
# npm run download-hdb         # HDB only — rebuilds the DB from scratch
# npm run download-ura         # URA only — replaces the private rows in an existing DB
```

This builds `server/db/resale.db`. `download-hdb` deletes and recreates the DB, so always run
`download-ura` after it (or use `npm run download`) or private-property data will be missing.

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
```

### Deploy

```bash
npm run deploy        # API + frontend (runs npm test first, bumps ?v=N, pings IndexNow)
npm run deploy:api    # API only (npm test && fly deploy)
```

### Seed the Database

The Fly.io machine (256MB RAM) is too small to run the Python download scripts. Instead, **build the database locally and upload it**:

```bash
npm run download      # build server/db/resale.db (HDB + URA)
npm run deploy:data   # WAL checkpoint → gzip → SFTP → atomic swap on /data → restart
```

Don't upload with a bare `fly ssh sftp put`: without `PRAGMA wal_checkpoint(TRUNCATE)` first,
rows still in the WAL file are silently lost.

### Verify

```bash
curl https://<your-app>.fly.dev/api/status
# Expected: {"status":"ok","total_transactions":<count>,"latest_month":"<YYYY-MM>",...}
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

### Update Data

Automatic: the **Refresh Data** GitHub Action (`.github/workflows/refresh-data.yml`) runs daily at
03:00 SGT — `npm run download`, a row-count guard, then `npm run deploy:data`. It can also be
triggered manually from the Actions tab.

Manual: `npm run download && npm run deploy:data`. Never upload an HDB-only DB — it would wipe the
private-property data in production.

## Deploy Frontend to Cloudflare Pages

```bash
npm run deploy:frontend
```

This runs `npm test`, bumps the `?v=N` cache-bust in `index.html` (`scripts/bump-version.js`),
uploads `public/` + `functions/` with wrangler (`scripts/deploy-frontend.js`, uses
`CLOUDFLARE_API_TOKEN` from `.env`), then submits the sitemap to IndexNow. Avoid a bare
`wrangler pages deploy` — it skips the tests, the version bump and the IndexNow ping.

The SPA calls same-origin `/api/*`; the edge function (`functions/[[path]].js`) proxies it to Fly.io.

## Custom Domain Setup

The frontend is live at [worthit.canlah.app](https://worthit.canlah.app). Here's how it was configured:

### Step 1: Add domain to Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site**
2. Enter your root domain (e.g., `canlah.app`) → Continue
3. Select **Free plan** → Continue
4. Review DNS records → Continue
5. Note the two nameservers Cloudflare provides

### Step 2: Update nameservers at domain registrar

1. At Porkbun (or your registrar) → Domain Management → **Authoritative Nameservers**
2. Replace with Cloudflare's nameservers
3. Wait for propagation (minutes to a few hours)
4. Cloudflare emails you when active

### Step 3: Add custom domain in Cloudflare Pages

1. Go to **Cloudflare Dashboard → Pages → worthit → Custom domains**
2. Click **Set up a custom domain**
3. Enter `worthit.canlah.app`
4. Cloudflare automatically creates the CNAME record and provisions SSL
5. SSL is automatic (Universal SSL) — no extra steps needed

### Verify

```bash
curl -I https://worthit.canlah.app
# Should return HTTP 200 with Cloudflare headers
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Database status and record count |
| `GET /api/towns` | List all HDB towns + district labels |
| `GET /api/flat-types` | List all flat types |
| `GET /api/resolve?q=` | Resolve town name or postal code |
| `GET /api/area-overview?town=` | Main HDB market overview endpoint (accepts `lat`/`lng` for 500m radius) |
| `GET /api/valuation?postal=&price=` | Deal Score + fair value from storey-adjusted nearby comps |
| `POST /api/feedback` | In-app feedback (5/IP/hour + 200/day global cap, separate feedback.db) |
| `GET /api/private/projects?q=` | Search private property projects |
| `GET /api/private/project-overview?project=` | Private project details |
| `GET /api/private/property-types` | List private property types |
| `GET /api/private/district-summary?districts=` | District aggregate stats |
| `GET /api/private/district-overview?district=` | Full district overview |
| `GET /api/nearby-hdb?lat=&lng=` | Nearby HDB transactions + private projects (800m) |
| `GET /api/bto/launches` | All BTO launches grouped by exercise |
| `GET /api/bto/projects?q=` | BTO project autocomplete |
| `GET /api/bto/project-overview?project=` | BTO project flats, nearby-resale comparison, and own resales once past MOP |
| `GET /api/seo/metadata?route=` | Bot metadata for edge-function injection |
| `GET /api/seo/sitemap` | Sitemap URLs (consumed by Cloudflare edge function) |

## Project Structure

```
WorthIt/
├── scripts/
│   ├── download_data.py         # HDB data download (data.gov.sg)
│   ├── download_ura_data.py     # URA private property data
│   ├── bto_launches.json        # Hand-curated BTO launch data
│   ├── fetch_bto_blocks.py      # BTO project → HDB blocks (OneMap)
│   ├── bto_project_blocks.json  # Output of fetch_bto_blocks.py
│   ├── hdb_blocks.csv           # HDB block coordinates (seeds hdb_block_coords)
│   ├── run-python.js            # venv wrapper for the Python scripts (npm run setup/download)
│   ├── read-feedback.js         # dump in-app feedback (npm run feedback)
│   ├── bump-version.js          # ?v=N cache-bust, run by deploy scripts
│   ├── deploy-frontend.js       # wrangler deploy wrapper
│   └── indexnow-ping.js         # sitemap → IndexNow after frontend deploy
├── server/
│   ├── index.js                 # Express API server
│   └── db/
│       ├── resale.db            # SQLite database (generated)
│       └── feedback.db          # In-app feedback (writable, generated)
├── functions/
│   └── [[path]].js              # Cloudflare edge: /api proxy, bot SEO injection, sitemap
├── public/
│   ├── index.html               # Main SPA
│   ├── config.js                # API base URL config (same-origin)
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── api.js               # API client
│       ├── app.js               # Main app logic
│       ├── charts.js            # Chart.js configs
│       └── map.js               # Leaflet map
│   └── data/mrt_stations.json   # MRT overlay + nearest-station labels
├── Dockerfile                   # Fly.io Docker config
├── fly.toml                     # Fly.io app config
├── tests/                       # Vitest + supertest (npm test); tests/python/ = pytest
├── memory-bank/                 # Project context docs (kept current per CLAUDE.md)
├── design.md                    # UI style guide
├── CLAUDE.md                    # Architecture + patterns for Claude Code
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