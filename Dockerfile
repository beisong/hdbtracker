# WorthIt - Fly.io Dockerfile
# Node.js API (data pipeline runs in GitHub Actions, not here)

FROM node:20-slim

# Python 3 + build tools: only for the better-sqlite3 native build fallback (node-gyp).
# The data pipeline runs in GitHub Actions, never on Fly, so no pip/venv/requirements.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node.js dependencies first (better Docker layer caching)
COPY package.json package-lock.json ./

RUN npm install --omit=dev

# Copy application code (no public/ — frontend served by Cloudflare Pages)
COPY server/ ./server/
COPY scripts/ ./scripts/

# Create data directory (Fly.io volume mounts here)
RUN mkdir -p /data

# Environment defaults
ENV NODE_ENV=production
ENV DB_PATH=/data/resale.db
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]