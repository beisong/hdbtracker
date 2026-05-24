# Active Context: WorthIt

## Current State
The project is fully deployed and functional:
- **Backend API**: Running on Fly.io at `worthit-api.fly.dev` — 370K transactions, data through May 2026
- **Frontend**: ✅ Live at [worthit.canlah.app](https://worthit.canlah.app) via Cloudflare Pages (DNS on Cloudflare, domain from Porkbun)
- **Database**: SQLite on Fly.io persistent volume (`/data/resale.db`), built locally and uploaded via SFTP
- **Local dev**: `node server/index.js` serves both frontend and API on port 3000

## Deployment Architecture
- **Frontend**: Cloudflare Pages (`npx wrangler pages deploy public --project-name=worthit`) — ✅ LIVE
- **Backend API**: Fly.io (`worthit-api`) with 1GB persistent volume
- **Database**: SQLite on Fly.io volume, seeded locally and uploaded via `fly ssh sftp put`
- **Config**: `public/config.js` auto-detects localhost → same-origin, else → `https://worthit-api.fly.dev`
- **Cost**: $0/month (Fly.io free tier + Cloudflare Pages free)

## Completed Infrastructure
- ✅ `Dockerfile` — Node.js + Python container (public/ excluded)
- ✅ `fly.toml` — Fly.io config with volume mount at `/data`
- ✅ `.dockerignore` — excludes `public/`, `node_modules/`, `.history/`
- ✅ Server graceful startup without database (shows `no_database` status)
- ✅ `/api/status` health check bypasses DB middleware
- ✅ CORS configured for Cloudflare Pages + Fly.io origins
- ✅ DB seeded (local build + SFTP upload — avoids Fly.io 256MB RAM limit)
- ✅ README updated with deployment guide and debugging commands
- ✅ `.gitignore` updated with `fly.ssh*` files

## Remaining Steps
- ✅ Push to GitHub
- ✅ Configure custom domain — `worthit.canlah.app` (DNS on Cloudflare, domain from Porkbun)

## Custom Domain Setup
- **Domain**: `canlah.app` registered at Porkbun
- **Subdomain**: `worthit.canlah.app` → Cloudflare Pages
- **DNS**: Nameservers transferred to Cloudflare (Universal SSL, automatic)
- **API**: Still at `worthit-api.fly.dev` (CORS allows all origins)

## Key Commands
- **Deploy API**: `fly deploy`
- **Deploy Frontend**: `npx wrangler pages deploy public --project-name=worthit`
- **Seed DB**: Build locally → `fly ssh sftp put server/db/resale.db /data/resale.db` → `fly machine restart <id>`
- **Update data monthly**: Re-run `python scripts/download_data.py` locally → re-upload via SFTP
- **Debug**: `fly logs`, `fly ssh console`, `fly ssh sftp`

## Recent Changes
- Custom domain configured: `worthit.canlah.app` (DNS on Cloudflare, domain from Porkbun)
- README updated with custom domain setup instructions
- Frontend deployed to Cloudflare Pages via wrangler CLI
- README updated with Cloudflare Pages CLI deployment instructions
- Fixed server crash on missing database (graceful startup)
- Removed duplicate `/api/status` route
- `/api/status` now shows transaction count and latest month
- DB middleware rejects other API calls with 503 when DB is missing
- Added `fly.ssh*` to `.gitignore`
- Comprehensive README with deployment and debugging guide

## Active Decisions & Considerations
- Database is opened in `readonly: true` mode — data only changes via Python scripts
- In-memory caches for geocoding and nearby streets (no persistence)
- Nominatim rate limiting: 1 req/sec with 1.1s delays
- Street matching uses multi-strategy: exact → compressed → expanded → keyword fallback
- Fly.io free tier (256MB RAM) can't run Python download scripts — use local build + SFTP upload

## Important Patterns
- All town matching is case-insensitive (`.toUpperCase()`)
- Month format: `YYYY-MM` strings
- Price percentiles calculated in JS, not SQL
- `dataset_source` column distinguishes HDB vs URA_PRIVATE records