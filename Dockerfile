# WorthIt - Fly.io Dockerfile
# Node.js + Python for data pipeline scripts

FROM node:20-slim

# Install Python 3, pip, and build tools (needed for better-sqlite3 native addon)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node.js dependencies first (better Docker layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

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