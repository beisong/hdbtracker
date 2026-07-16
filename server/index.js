require('dotenv').config();

const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// OneMap API token (from .env file)
const ONEMAP_TOKEN = process.env.ONEMAP_TOKEN || '';

// CORS — allow frontend origins (Cloudflare Pages, localhost, custom domains)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://hdbtracker.pages.dev',       // Cloudflare Pages default
  // Add your custom domain when ready, e.g.:
  // 'https://yourdomain.com',
  // 'https://www.yourdomain.com',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Also allow any Fly.io or Cloudflare Pages subdomain
    if (origin.endsWith('.fly.dev') || origin.endsWith('.pages.dev')) return callback(null, true);
    callback(null, true); // Allow all for now; tighten later
  },
  credentials: true,
}));

// Serve static files (only works in local dev; public/ not included in Docker image)
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// URA API config
const URA_ACCESS_KEY = process.env.URA_API_ACCESS_KEY || '';
let uraToken = null;
let uraTokenExpiry = 0;

// Open database
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db', 'resale.db');
let db = null;

try {
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = WAL');
  console.log(`✅ Connected to database: ${DB_PATH}`);
  seedHdbBlockCoords(DB_PATH);
} catch (err) {
  console.warn(`⚠️  Database not found at ${DB_PATH}`);
  console.warn(`   Run download scripts via SSH to populate it.`);
  console.warn(`   Server will start but API endpoints will return errors until DB is ready.`);
}

function seedHdbBlockCoords(dbPath) {
  const tableExists = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='hdb_block_coords'"
  ).get();
  if (tableExists) return;

  console.log('⏳ hdb_block_coords missing — seeding from hdb_blocks.csv...');
  const csvPath = path.join(__dirname, '..', 'scripts', 'hdb_blocks.csv');
  if (!require('fs').existsSync(csvPath)) {
    console.warn('⚠️  hdb_blocks.csv not found, skipping seed');
    return;
  }

  const writable = new Database(dbPath);
  try {
    writable.exec(`
      CREATE TABLE IF NOT EXISTS hdb_block_coords (
        block       TEXT NOT NULL,
        street_name TEXT NOT NULL,
        lat         REAL NOT NULL,
        lng         REAL NOT NULL,
        postal      TEXT,
        PRIMARY KEY (block, street_name)
      )
    `);
    writable.exec('CREATE INDEX IF NOT EXISTS idx_hdb_coords_latln ON hdb_block_coords(lat, lng)');

    const lines = require('fs').readFileSync(csvPath, 'utf8').trim().split('\n');
    const insert = writable.prepare(
      'INSERT OR IGNORE INTO hdb_block_coords (block, street_name, lat, lng, postal) VALUES (?, ?, ?, ?, ?)'
    );
    const insertMany = writable.transaction((rows) => { for (const r of rows) insert.run(r); });

    const rows = lines.filter(l => l && !l.startsWith('#') && !l.startsWith('blk_no')).map(line => {
      const [blk, street, lat, lng, postal] = line.split(',');
      return [blk.trim().toUpperCase(), street.trim().toUpperCase(), parseFloat(lat), parseFloat(lng), postal.trim()];
    }).filter(r => r[2] && r[3]);

    insertMany(rows);
    console.log(`✅ Seeded ${rows.length.toLocaleString()} HDB block coordinates`);
  } finally {
    writable.close();
  }
}

// ------------------------------------------------------------
// Feedback store — SEPARATE writable DB, NOT resale.db.
// resale.db is opened read-only and is replaced wholesale on every
// data refresh (mv resale.db.new resale.db), which would wipe feedback.
// feedback.db lives on the same volume but survives those refreshes.
// ------------------------------------------------------------
const FEEDBACK_DB_PATH = process.env.FEEDBACK_DB_PATH || path.join(path.dirname(DB_PATH), 'feedback.db');
let feedbackDb = null;
try {
  feedbackDb = new Database(FEEDBACK_DB_PATH);
  feedbackDb.pragma('journal_mode = WAL');
  feedbackDb.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      message    TEXT NOT NULL,
      email      TEXT,
      route      TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log(`✅ Feedback DB ready: ${FEEDBACK_DB_PATH}`);
} catch (err) {
  console.warn(`⚠️  Could not open feedback DB at ${FEEDBACK_DB_PATH}: ${err.message}`);
}

// Simple in-memory rate limit: max 5 feedback submissions per IP per hour
const feedbackRate = new Map();
function feedbackRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const hits = (feedbackRate.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= 5) { feedbackRate.set(ip, hits); return true; }
  hits.push(now);
  feedbackRate.set(ip, hits);
  return false;
}

// Health check (always responds, even without DB — must be before the DB middleware)
app.get('/api/status', (req, res) => {
  if (db) {
    try {
      const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
      const latestMonth = db.prepare('SELECT MAX(month) as m FROM transactions').get().m;
      res.json({ status: 'ok', total_transactions: count, latest_month: latestMonth, db_path: DB_PATH });
    } catch (err) {
      res.json({ status: 'error', db_path: DB_PATH, message: err.message });
    }
  } else {
    res.json({ status: 'no_database', db_path: DB_PATH, message: 'Run download scripts via SSH' });
  }
});

// Feedback submission — writes to the separate feedback.db (registered before
// the DB-guard middleware so it works even while resale.db is missing/refreshing).
app.post('/api/feedback', (req, res) => {
  if (!feedbackDb) return res.status(503).json({ error: 'Feedback store unavailable' });

  const body = req.body || {};
  // Honeypot: a hidden field humans never see — bots fill it. Pretend success.
  if (body.website) return res.json({ ok: true });

  const message = String(body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (message.length > 4000) return res.status(400).json({ error: 'Message too long' });

  const email = String(body.email || '').trim().slice(0, 200) || null;
  const route = String(body.route || '').trim().slice(0, 300) || null;
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 400) || null;

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  if (feedbackRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many submissions — please try again later.' });
  }

  try {
    feedbackDb
      .prepare('INSERT INTO feedback (message, email, route, user_agent) VALUES (?, ?, ?, ?)')
      .run(message, email, route, userAgent);
    res.json({ ok: true });
  } catch (err) {
    console.error('Feedback insert failed:', err.message);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Middleware: reject API requests if database isn't loaded
app.use('/api/', (req, res, next) => {
  if (!db) {
    return res.status(503).json({
      error: 'Database not ready',
      message: 'Run download scripts via SSH: python3 /app/scripts/download_data.py',
    });
  }
  next();
});

// ============================================================
// HELPERS
// ============================================================

function median(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (idx - low);
}

// Great-circle distance in metres (haversine)
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Compare avg of first N months vs avg of last N months to smooth single-month noise.
// Falls back to 1-month comparison when the window is too small.
function trendPct(arr, key, n = 3) {
  if (!arr || arr.length < 2) return 0;
  const take = Math.min(n, Math.floor(arr.length / 2));
  const early = arr.slice(0, take).reduce((s, m) => s + m[key], 0) / take;
  const late = arr.slice(-take).reduce((s, m) => s + m[key], 0) / take;
  if (!early || early === 0) return 0;
  return Math.round((late - early) / early * 1000) / 10;
}

// Whole months between two 'YYYY-MM' strings (b - a)
function monthsBetween(a, b) {
  const ya = parseInt(a.substring(0, 4)), ma = parseInt(a.substring(5, 7));
  const yb = parseInt(b.substring(0, 4)), mb = parseInt(b.substring(5, 7));
  return (yb - ya) * 12 + (mb - ma);
}

// Deal Score: linear map of deviation from fair value.
// d = (asking − fair) / fair. Fair → 50; every +1% above fair −2.5 pts.
// −20% → 100 (great deal), +20% → 0 (heavy premium).
function dealScore(d) {
  return Math.max(0, Math.min(100, Math.round(50 - 250 * d)));
}

// Storey premium factor from a { storey_range: { avg_psm, c } } bucket map.
// Returns subject/comp psm ratio only when both buckets are well-populated; else 1.
// Clamped to ±10% — buckets are lease-banded to control vintage bias, but thin
// data in some towns can still produce implausible ratios.
function computeStoreyFactor(buckets, subjectRange, compRange, minCount = 10) {
  if (!subjectRange || !compRange || subjectRange === compRange) return 1;
  const s = buckets[subjectRange];
  const c = buckets[compRange];
  if (!s || !c || s.c < minCount || c.c < minCount || !s.avg_psm || !c.avg_psm) return 1;
  return Math.max(0.9, Math.min(1.1, s.avg_psm / c.avg_psm));
}

function monthsAgoStr(months) {
  const latestMonth = db.prepare('SELECT MAX(month) as m FROM transactions').get().m;
  const y = parseInt(latestMonth.substring(0, 4));
  const m = parseInt(latestMonth.substring(5, 7));
  let ry = y;
  let rm = m - months;
  while (rm <= 0) { rm += 12; ry--; }
  return `${ry}-${String(rm).padStart(2, '0')}`;
}

// OneMap SG postal code → road name + lat/lng lookup
async function resolvePostalCode(postalCode) {
  try {
    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postalCode}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const resp = await fetch(url, { timeout: 5000 });
    const data = await resp.json();
    if (data.results && data.results.length > 0) {
      const r = data.results[0];
      return {
        address: r.ADDRESS,
        road: r.ROAD_NAME,
        building: r.BUILDING,
        lat: parseFloat(r.LATITUDE) || null,
        lng: parseFloat(r.LONGITUDE) || null,
      };
    }
    return null;
  } catch (err) {
    console.error('OneMap API error:', err.message);
    return null;
  }
}

// Road name → HDB town matching
function matchRoadToTown(roadName) {
  if (!roadName) return null;
  const road = roadName.toUpperCase();
  const towns = db.prepare('SELECT DISTINCT town FROM transactions').all().map(r => r.town);

  // Try to find a town name in the road name
  for (const town of towns) {
    if (road.includes(town)) return town;
  }

  // Common road prefix → town mappings
  const roadPrefixMap = {
    'ANG MO KIO': 'ANG MO KIO',
    'BEDOK': 'BEDOK',
    'BIJOU': 'BEDOK',
    'BISHAN': 'BISHAN',
    'BRADDELL': 'TOA PAYOH',
    'BUKIT BATOK': 'BUKIT BATOK',
    'BUKIT MERAH': 'BUKIT MERAH',
    'BUKIT PANJANG': 'BUKIT PANJANG',
    'BUKIT TIMAH': 'BUKIT TIMAH',
    'CENTRAL': 'CENTRAL AREA',
    'CLEMENTI': 'CLEMENTI',
    'CHOA CHU KANG': 'CHOA CHU KANG',
    'GEYLANG': 'GEYLANG',
    'HOUGANG': 'HOUGANG',
    'JURONG EAST': 'JURONG EAST',
    'JURONG WEST': 'JURONG WEST',
    'KALLANG': 'KALLANG/WHAMPOA',
    'LIM CHU KANG': 'CHOA CHU KANG',
    'MARINE PARADE': 'MARINE PARADE',
    'MARSILING': 'WOODLANDS',
    'PASIR RIS': 'PASIR RIS',
    'PUNGGOL': 'PUNGGOL',
    'QUEENSTOWN': 'QUEENSTOWN',
    'SEMBAWANG': 'SEMBAWANG',
    'SENGKANG': 'SENGKANG',
    'SERANGOON': 'SERANGOON',
    'TAMPINES': 'TAMPINES',
    'SIMEI': 'TAMPINES',
    'TENGAH': 'JURONG WEST',
    'TOA PAYOH': 'TOA PAYOH',
    'WOODLANDS': 'WOODLANDS',
    'YISHUN': 'YISHUN',
    'PASIR PANJANG': 'QUEENSTOWN',
    'ALEXANDRA': 'QUEENSTOWN',
    'MEI LING': 'QUEENSTOWN',
    'MEI CHIN': 'QUEENSTOWN',
    'COMMONWEALTH': 'QUEENSTOWN',
    'HOLLAND': 'BUKIT TIMAH',
    'TANJONG': 'CENTRAL AREA',
    'SHENTON': 'CENTRAL AREA',
    'ROBINSON': 'CENTRAL AREA',
    'CECIL': 'CENTRAL AREA',
    'OUTRAM': 'CENTRAL AREA',
    'TELOK BLANGAH': 'BUKIT MERAH',
    'TIONG BAHRU': 'BUKIT MERAH',
    'JOO CHIAT': 'MARINE PARADE',
    'KATONG': 'MARINE PARADE',
    'CHANGI': 'TAMPINES',
    'LOYANG': 'PASIR RIS',
    'UPPER SERANGOON': 'SERANGOON',
    'UPPER THOMSON': 'BISHAN',
    'THOMSON': 'BISHAN',
    'LORONG': 'GEYLANG',
    'BUANGKOK': 'HOUGANG',
    'DEFU': 'HOUGANG',
    'RIVER VALLEY': 'CENTRAL AREA',
    'ORCHARD': 'CENTRAL AREA',
    'BENCOOLEN': 'CENTRAL AREA',
    'BEACH': 'KALLANG/WHAMPOA',
    'NICHOLL': 'KALLANG/WHAMPOA',
    'BALESTIER': 'KALLANG/WHAMPOA',
    'MOULMEIN': 'KALLANG/WHAMPOA',
  };

  for (const [prefix, town] of Object.entries(roadPrefixMap)) {
    if (road.startsWith(prefix) || road.includes(prefix)) {
      if (towns.includes(town)) return town;
    }
  }

  return null;
}

// Fallback: match road name to town via database street names
// Handles abbreviation mismatches (e.g. "JALAN TENAGA" vs DB's "JLN TENAGA")
function matchRoadToTownViaDB(roadName) {
  if (!roadName) return null;
  const road = roadName.toUpperCase();

  // Common Singapore road type words to strip — keep only the meaningful part
  const stopWords = [
    'JALAN', 'LORONG', 'STREET', 'ROAD', 'AVENUE', 'DRIVE', 'CRESCENT',
    'COURT', 'PLACE', 'TERRACE', 'BUKIT', 'UPPER', 'LOWER', 'CENTRAL',
    'PARK', 'SQUARE', 'GARDENS', 'HEIGHTS', 'CLOSE', 'WALK', 'LINK',
    'RISE', 'VIEW', 'WAY', 'LANE', 'LOOP', 'NORTH', 'SOUTH', 'EAST', 'WEST',
  ];

  // Split road name into words, remove stop words and common connectors
  const words = road.split(/\s+/).filter(w =>
    w.length > 1 &&
    !stopWords.includes(w) &&
    !['THE', 'OF', 'AND', 'BLK', 'BLOCK'].includes(w)
  );

  if (words.length === 0) return null;

  // Try each meaningful word as a LIKE query against street_name
  for (const word of words) {
    if (word.length < 3) continue; // Skip very short words
    const result = db.prepare(`
      SELECT DISTINCT town FROM transactions
      WHERE UPPER(street_name) LIKE ?
      LIMIT 1
    `).get(`%${word}%`);
    if (result) return result.town;
  }

  // Try pairs of words for better accuracy
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]}%${words[i + 1]}`;
    const result = db.prepare(`
      SELECT DISTINCT town FROM transactions
      WHERE UPPER(street_name) LIKE ?
      LIMIT 1
    `).get(`%${pair}%`);
    if (result) return result.town;
  }

  return null;
}

// ============================================================
// API ROUTES
// ============================================================

// ============================================================
// DISTRICT ↔ TOWN MAPPINGS
// ============================================================

const TOWN_TO_DISTRICTS = {
  'ANG MO KIO': ['20'],
  'BEDOK': ['16'],
  'BISHAN': ['11', '20'],
  'BUKIT BATOK': ['23'],
  'BUKIT MERAH': ['04'],
  'BUKIT PANJANG': ['23'],
  'BUKIT TIMAH': ['10', '21'],
  'CENTRAL AREA': ['01', '02', '06', '07'],
  'CHOA CHU KANG': ['23', '24'],
  'CLEMENTI': ['05', '21'],
  'GEYLANG': ['14'],
  'HOUGANG': ['19', '28'],
  'JURONG EAST': ['22'],
  'JURONG WEST': ['22', '24'],
  'KALLANG/WHAMPOA': ['08', '12', '13'],
  'MARINE PARADE': ['15'],
  'PASIR RIS': ['17', '18'],
  'PUNGGOL': ['19', '28'],
  'QUEENSTOWN': ['03', '05'],
  'SEMBAWANG': ['27'],
  'SENGKANG': ['19', '28'],
  'SERANGOON': ['19'],
  'TAMPINES': ['18'],
  'TOA PAYOH': ['11', '12'],
  'WOODLANDS': ['25', '26'],
  'YISHUN': ['27'],
};

// Reverse mapping: district number → HDB towns
const DISTRICT_TO_TOWNS = {};
for (const [town, districts] of Object.entries(TOWN_TO_DISTRICTS)) {
  for (const d of districts) {
    if (!DISTRICT_TO_TOWNS[d]) DISTRICT_TO_TOWNS[d] = [];
    if (!DISTRICT_TO_TOWNS[d].includes(town)) DISTRICT_TO_TOWNS[d].push(town);
  }
}

// District descriptions for autocomplete
const DISTRICT_LABELS = {
  '01': 'D01 — Raffles Place, Marina',
  '02': 'D02 — Tanjong Pagar, Shenton',
  '03': 'D03 — Queenstown, Tiong Bahru',
  '04': 'D04 — Telok Blangah, Harbourfront',
  '05': 'D05 — Clementi, Dover',
  '06': 'D06 — City Hall, Clarke Quay',
  '07': 'D07 — Beach Road, Bugis',
  '08': 'D08 — Farrer Park, Little India',
  '09': 'D09 — Orchard, Cairnhill',
  '10': 'D10 — Bukit Timah, Holland',
  '11': 'D11 — Newton, Novena, Thomson',
  '12': 'D12 — Balestier, Toa Payoh',
  '13': 'D13 — Kallang, Macpherson',
  '14': 'D14 — Geylang, Sims',
  '15': 'D15 — Katong, Marine Parade, Joo Chiat',
  '16': 'D16 — Bedok, Upper East Coast',
  '17': 'D17 — Changi, Loyang',
  '18': 'D18 — Tampines, Pasir Ris',
  '19': 'D19 — Serangoon, Hougang, Punggol',
  '20': 'D20 — Ang Mo Kio, Bishan',
  '21': 'D21 — Upper Bukit Timah, Clementi Park',
  '22': 'D22 — Jurong, Boon Lay, Tuas',
  '23': 'D23 — Bukit Batok, Bukit Panjang, Choa Chu Kang',
  '24': 'D24 — Lim Chu Kang, Tengah',
  '25': 'D25 — Woodlands, Admiralty',
  '26': 'D26 — Mandai, Upper Thomson',
  '27': 'D27 — Yishun, Sembawang',
  '28': 'D28 — Seletar, Sengkang',
};

// Singapore bounding box — rejects obviously wrong coordinates before hitting Nominatim/OneMap
function isSgCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= 1.1 && lat <= 1.5 && lng >= 103.5 && lng <= 104.1;
}

/**
 * GET /api/towns — List all HDB towns + district labels for autocomplete
 */
app.get('/api/towns', (req, res) => {
  try {
    const towns = db.prepare(`
      SELECT DISTINCT town FROM transactions
      WHERE dataset_source != 'URA_PRIVATE'
      ORDER BY town
    `).all().map(r => r.town);
    const districts = Object.values(DISTRICT_LABELS);
    res.json({ towns, districts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch towns' });
  }
});

/**
 * GET /api/flat-types — List all flat types
 */
app.get('/api/flat-types', (req, res) => {
  try {
    const types = db.prepare(`
      SELECT DISTINCT flat_type FROM transactions
      WHERE flat_type != '' ORDER BY flat_type
    `).all().map(r => r.flat_type);
    res.json({ flat_types: types });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch flat types' });
  }
});

/**
 * GET /api/resolve — Resolve town name or postal code to HDB town
 */
app.get('/api/resolve', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query parameter q' });
    if (q.length > 200) return res.status(400).json({ error: 'Query too long' });

    const input = q.trim();
    const isPostalCode = /^\d{6}$/.test(input);

    if (isPostalCode) {
      // 6-digit postal code → OneMap API
      const result = await resolvePostalCode(input);
      if (!result) {
        return res.json({ resolved: false, input, message: 'Postal code not found' });
      }

      let town = matchRoadToTown(result.road);
      if (!town) town = matchRoadToTownViaDB(result.road);
      console.log(`[resolve] postal=${input} road="${result.road}" town=${town || 'NOT FOUND'}`);
      return res.json({
        resolved: !!town,
        input,
        town: town || null,
        address: result.address,
        road: result.road,
        building: result.building,
        lat: result.lat,
        lng: result.lng,
      });
    } else {
      // Town name — fuzzy match (exclude NULL towns from private records)
      const towns = db.prepare("SELECT DISTINCT town FROM transactions WHERE town IS NOT NULL AND dataset_source != 'URA_PRIVATE'").all().map(r => r.town);
      const inputUpper = input.toUpperCase();

      // Exact match
      if (towns.includes(inputUpper)) {
        return res.json({ resolved: true, input, town: inputUpper });
      }

      // Partial match — input is a prefix/substring of a town name, with word-boundary check.
      // e.g. "ANG MO" → "ANG MO KIO", "KALLANG" → "KALLANG/WHAMPOA"
      // "QUEENS" must NOT match "QUEENSTOWN" (no word boundary after the match).
      // Intentionally NOT matching the reverse ("BEDOK RESIDENCES" contains "BEDOK") —
      // that causes private project names with town names in them to misroute to HDB pages.
      const matches = towns.filter(t => {
        const idx = t.indexOf(inputUpper);
        if (idx === -1) return false;
        const after = t[idx + inputUpper.length];
        return after === undefined || !/[A-Z0-9]/.test(after);
      });
      if (matches.length > 0) {
        return res.json({ resolved: true, input, town: matches[0] });
      }

      return res.json({ resolved: false, input, message: 'Town not found' });
    }
  } catch (err) {
    console.error('Error in /api/resolve:', err);
    res.status(500).json({ error: 'Failed to resolve: ' + err.message });
  }
});

// Compress street names: full words → DB abbreviations
function compressStreetName(name) {
  const compressions = {
    'STREET': 'ST', 'AVENUE': 'AVE', 'ROAD': 'RD', 'DRIVE': 'DR',
    'CRESCENT': 'CRES', 'COURT': 'CRT', 'PLACE': 'PL', 'TERRACE': 'TERR',
    'LORONG': 'LOR', 'BUKIT': 'BT', 'KAMPONG': 'KG', 'JALAN': 'JLN',
    'UPPER': 'UPP', 'LOWER': 'LOW', 'CENTRAL': 'CTRL', 'PARK': 'PK',
    'SQUARE': 'SQ', 'GARDENS': 'GDNS', 'HEIGHTS': 'HTS', 'CLOSE': 'CL',
    'NORTH': 'NTH', 'SOUTH': 'STH',
    // Note: EAST and WEST stay as-is in DB, not abbreviated
    'FARMWAY': 'FWY',
  };
  let result = ' ' + name.toUpperCase() + ' ';
  for (const [full, abbr] of Object.entries(compressions)) {
    result = result.replace(new RegExp(' ' + full + ' ', 'g'), ' ' + abbr + ' ');
  }
  return result.trim();
}

// Find matching DB street name(s) from a OneMap road name
function findDbStreets(roadName, town) {
  if (!roadName) return [];
  const road = roadName.toUpperCase().trim();
  const townUpper = town ? town.toUpperCase() : null;

  // Helper: try a pattern against the DB (with or without town filter)
  const tryMatch = (pattern) => {
    if (!pattern) return [];
    const likePattern = '%' + pattern.replace(/\s+/g, '%') + '%';
    if (townUpper) {
      return db.prepare(`
        SELECT DISTINCT street_name FROM transactions
        WHERE town = ? AND UPPER(street_name) LIKE ?
      `).all(townUpper, likePattern).map(r => r.street_name);
    } else {
      return db.prepare(`
        SELECT DISTINCT street_name FROM transactions
        WHERE UPPER(street_name) LIKE ? AND dataset_source != 'URA_PRIVATE'
        LIMIT 5
      `).all(likePattern).map(r => r.street_name);
    }
  };

  // 1. Try the road name as-is
  let matches = tryMatch(road);
  if (matches.length > 0) return matches;

  // 2. Try compressed form (STREET→ST, NORTH→NTH, BUKIT→BT, etc.)
  const compressed = compressStreetName(road);
  if (compressed !== road) {
    matches = tryMatch(compressed);
    if (matches.length > 0) return matches;
  }

  // 3. Try expanded form (ST→STREET, AVE→AVENUE, etc.)
  const expanded = expandStreetName(road);
  if (expanded !== road) {
    matches = tryMatch(expanded);
    if (matches.length > 0) return matches;
  }

  // 4. Keyword fallback — extract meaningful words, strip road type words
  const stopWords = ['STREET', 'ST', 'AVENUE', 'AVE', 'ROAD', 'RD', 'DRIVE', 'DR',
    'CRESCENT', 'CRES', 'COURT', 'CRT', 'PLACE', 'PL', 'TERRACE', 'TERR',
    'JALAN', 'JLN', 'LORONG', 'LOR', 'BUKIT', 'BT', 'UPPER', 'UPP', 'LOWER',
    'CENTRAL', 'CTRL', 'PARK', 'PK', 'GARDENS', 'GDNS', 'CLOSE', 'CL',
    'NORTH', 'NTH', 'SOUTH', 'STH', 'EAST', 'EST', 'WEST', 'WST',
    'HEIGHTS', 'HTS', 'SQUARE', 'SQ', 'KAMPONG', 'KG', 'THE', 'OF'];
  const keywords = road.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

  for (const kw of keywords) {
    matches = tryMatch(kw);
    if (matches.length > 0) return matches;
  }

  return [];
}

/**
 * Return distinct (block, street_name, lat, lng, postal, dist_m) rows from
 * hdb_block_coords within radiusM metres of the given point, nearest first.
 * Bounding box is only the index-friendly pre-filter; exact haversine distance
 * decides inclusion (a box alone admits corner blocks up to ~1.41 × radiusM).
 */
function findNearbyHdbBlocks(lat, lng, radiusM = 500) {
  // 1 degree lat ≈ 111 000 m; 1 degree lng ≈ 111 000 * cos(lat_rad) m
  const dLat = radiusM / 111000;
  const dLng = radiusM / (111000 * Math.cos(lat * Math.PI / 180));
  const candidates = db.prepare(`
    SELECT block, street_name, lat, lng, postal
    FROM hdb_block_coords
    WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
  `).all(lat - dLat, lat + dLat, lng - dLng, lng + dLng);
  return candidates
    .map(b => ({ ...b, dist_m: Math.round(haversineM(lat, lng, b.lat, b.lng)) }))
    .filter(b => b.dist_m <= radiusM)
    .sort((a, b) => a.dist_m - b.dist_m);
}


/**
 * GET /api/area-overview — Main endpoint for area market overview
 */
app.get('/api/area-overview', (req, res) => {
  try {
    const { town, flat_type, street, lat, lng } = req.query;
    if (!town) return res.status(400).json({ error: 'Missing town parameter' });
    if (town.length > 100) return res.status(400).json({ error: 'town parameter too long' });
    if (street && street.length > 200) return res.status(400).json({ error: 'street parameter too long' });

    const townUpper = town.toUpperCase();
    const flatTypeList = (flat_type && flat_type !== 'ALL')
      ? flat_type.toUpperCase().split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const addFlatClause = (query, params) => {
      if (flatTypeList.length === 1) {
        query += ' AND flat_type = ?'; params.push(flatTypeList[0]);
      } else if (flatTypeList.length > 1) {
        query += ` AND flat_type IN (${flatTypeList.map(() => '?').join(',')})`; params.push(...flatTypeList);
      }
      return query;
    };

    // Build block filter — distance-based (lat/lng) or single-street fallback
    let streetClause = '';
    let streetParams = [];
    let streetNames = [];  // for response metadata only
    let coordByKey = null; // block|street → { lat, lng } for marker coords (distance path)

    if (lat && lng) {
      const latF = parseFloat(lat);
      const lngF = parseFloat(lng);
      if (isSgCoord(latF, lngF)) {
        const blocks = findNearbyHdbBlocks(latF, lngF);
        if (blocks.length > 0) {
          // Filter by exact (block, street_name) pairs — no cross-street contamination
          const keys = blocks.map(b => `${b.block}|${b.street_name}`);
          streetClause = ` AND (block || '|' || street_name) IN (${keys.map(() => '?').join(',')})`;
          streetParams = keys;
          streetNames = [...new Set(blocks.map(b => b.street_name))];
          coordByKey = {};
          for (const b of blocks) coordByKey[`${b.block}|${b.street_name}`] = { lat: b.lat, lng: b.lng };
          console.log(`[area-overview] distance filter: ${blocks.length} blocks across ${streetNames.length} streets near (${latF},${lngF})`);
        }
      }
    }

    // Fallback to single street name if no lat/lng or hdb_block_coords returned nothing
    if (streetClause === '' && street) {
      const matched = findDbStreets(street, townUpper);
      if (matched.length > 0) {
        streetClause = ` AND street_name IN (${matched.map(() => '?').join(',')})`;
        streetParams = matched;
        streetNames = matched;
        console.log(`[area-overview] street fallback: "${street}" → ${matched.length} streets`);
      }
    }

    const latestMonth = db.prepare('SELECT MAX(month) as m FROM transactions').get().m;

    // 1. Median prices by flat type (last 12 months) — apply street + flat_type filter
    const monthsAgo12 = monthsAgoStr(12);
    let pricesByTypeQuery = `
      SELECT
        flat_type,
        COUNT(*) as count,
        ROUND(AVG(resale_price)) as median_price,
        ROUND(AVG(price_per_sqm), 0) as median_psm
      FROM transactions
      WHERE town = ? AND resale_price IS NOT NULL AND month >= ?
    `;
    const pricesByTypeParams = [townUpper, monthsAgo12];
    pricesByTypeQuery = addFlatClause(pricesByTypeQuery, pricesByTypeParams);
    if (streetClause) { pricesByTypeQuery += streetClause; pricesByTypeParams.push(...streetParams); }
    pricesByTypeQuery += ' GROUP BY flat_type ORDER BY median_price';
    const pricesByType = db.prepare(pricesByTypeQuery).all(...pricesByTypeParams);

    // 2. Town summary (last 12 months) — apply street filter if present
    let townSummaryQuery = `
      SELECT
        COUNT(*) as total_transactions,
        ROUND(AVG(resale_price)) as median_price,
        ROUND(AVG(price_per_sqm), 0) as median_psm,
        MIN(resale_price) as min_price,
        MAX(resale_price) as max_price
      FROM transactions
      WHERE town = ? AND resale_price IS NOT NULL AND month >= ?
    `;
    const townSummaryParams = [townUpper, monthsAgo12];
    townSummaryQuery = addFlatClause(townSummaryQuery, townSummaryParams);
    if (streetClause) { townSummaryQuery += streetClause; townSummaryParams.push(...streetParams); }
    const townSummary = db.prepare(townSummaryQuery).get(...townSummaryParams);

    // Most popular type
    const popularType = db.prepare(`
      SELECT flat_type, COUNT(*) as c
      FROM transactions
      WHERE town = ? AND month >= ?
      GROUP BY flat_type ORDER BY c DESC LIMIT 1
    `).get(townUpper, monthsAgo12);

    // 3. Price percentiles — apply street + flat_type filter
    let priceQuery = `
      SELECT resale_price FROM transactions
      WHERE town = ? AND resale_price IS NOT NULL AND month >= ?
    `;
    const priceParams = [townUpper, monthsAgo12];
    priceQuery = addFlatClause(priceQuery, priceParams);
    if (streetClause) { priceQuery += streetClause; priceParams.push(...streetParams); }
    priceQuery += ' ORDER BY resale_price ASC LIMIT 10000';
    const allPrices = db.prepare(priceQuery).all(...priceParams).map(r => r.resale_price);

    const pricePercentiles = {
      p10: percentile(allPrices, 10),
      p25: percentile(allPrices, 25),
      p50: percentile(allPrices, 50),
      p75: percentile(allPrices, 75),
      p90: percentile(allPrices, 90),
    };

    // 4. Price trend (last 60 months)
    const monthsAgo60 = monthsAgoStr(60);
    let trendQuery = `
      SELECT
        month,
        COUNT(*) as count,
        ROUND(AVG(resale_price)) as median_price,
        ROUND(AVG(price_per_sqm), 0) as avg_psm,
        MIN(resale_price) as min_price,
        MAX(resale_price) as max_price
      FROM transactions
      WHERE town = ? AND resale_price IS NOT NULL AND month >= ?
    `;
    const trendParams = [townUpper, monthsAgo60];
    trendQuery = addFlatClause(trendQuery, trendParams);
    trendQuery += ' GROUP BY month ORDER BY month ASC';
    const trendData = db.prepare(trendQuery).all(...trendParams);

    // Private property trend for related districts (dual-line chart)
    const relatedDistricts = TOWN_TO_DISTRICTS[townUpper] || [];
    let privateTrendData = [];
    if (relatedDistricts.length > 0) {
      const distPlaceholders = relatedDistricts.map(() => '?').join(',');
      privateTrendData = db.prepare(`
        SELECT month, COUNT(*) as count, ROUND(AVG(price_per_sqm), 0) as avg_psm
        FROM transactions
        WHERE dataset_source = 'URA_PRIVATE'
          AND district IN (${distPlaceholders})
          AND resale_price IS NOT NULL AND month >= ?
        GROUP BY month ORDER BY month ASC
      `).all(...relatedDistricts, monthsAgo60);
    }

    // Calculate trend direction — compare 3-month rolling avg at start vs end of each window
    let priceTrend = { '6m_change': 0, '1y_change': 0, '3y_change': 0, '5y_change': 0, direction: 'stable' };
    if (trendData.length >= 2) {
      const monthsAgo6 = monthsAgoStr(6);
      const monthsAgo12m = monthsAgoStr(12);
      const monthsAgo36 = monthsAgoStr(36);

      const recent6m = trendData.filter(m => m.month >= monthsAgo6);
      const recent12m = trendData.filter(m => m.month >= monthsAgo12m);
      const recent36m = trendData.filter(m => m.month >= monthsAgo36);

      priceTrend['6m_change'] = trendPct(recent6m, 'avg_psm');
      priceTrend['1y_change'] = trendPct(recent12m, 'avg_psm');
      priceTrend['3y_change'] = trendPct(recent36m, 'avg_psm');
      priceTrend['5y_change'] = trendPct(trendData, 'avg_psm');

      if (priceTrend['1y_change'] > 2) priceTrend.direction = 'rising';
      else if (priceTrend['1y_change'] < -2) priceTrend.direction = 'falling';
      else priceTrend.direction = 'stable';
    }

    // 5. Price distribution
    const minPrice = allPrices.length > 0 ? allPrices[0] : 0;
    const maxPrice = allPrices.length > 0 ? allPrices[allPrices.length - 1] : 0;
    const binCount = 20;
    const binWidth = Math.max(10000, Math.ceil((maxPrice - minPrice) / binCount / 10000) * 10000);
    const bins = [];
    const counts = [];
    for (let i = 0; i <= binCount; i++) {
      const binStart = Math.floor(minPrice / binWidth) * binWidth + i * binWidth;
      bins.push(binStart);
      const count = allPrices.filter(p => p >= binStart && p < binStart + binWidth).length;
      counts.push(count);
    }

    // 6. Recent transactions — apply street + flat_type filter
    let recentTransactions;
    if (streetClause) {
      // Block-filtered search: latest 3 per block so EVERY block in the radius
      // gets a map marker — plain "newest 200" lets busy blocks crowd out quiet ones.
      let innerQuery = `
        SELECT month, town, flat_type, block, street_name, storey_range,
               floor_area_sqm, flat_model, remaining_lease_years, resale_price, price_per_sqm,
               ROW_NUMBER() OVER (
                 PARTITION BY block, street_name
                 ORDER BY month DESC, resale_price DESC
               ) AS rn
        FROM transactions
        WHERE town = ? AND resale_price IS NOT NULL
      `;
      const txParams = [townUpper];
      innerQuery = addFlatClause(innerQuery, txParams);
      innerQuery += streetClause;
      txParams.push(...streetParams);
      recentTransactions = db.prepare(`
        SELECT month, town, flat_type, block, street_name, storey_range,
               floor_area_sqm, flat_model, remaining_lease_years, resale_price, price_per_sqm
        FROM (${innerQuery})
        WHERE rn <= 3
        ORDER BY month DESC, resale_price DESC
        LIMIT 400
      `).all(...txParams);
    } else {
      let txQuery = `
        SELECT month, town, flat_type, block, street_name, storey_range,
               floor_area_sqm, flat_model, remaining_lease_years, resale_price, price_per_sqm
        FROM transactions
        WHERE town = ? AND resale_price IS NOT NULL
      `;
      const txParams = [townUpper];
      txQuery = addFlatClause(txQuery, txParams);
      txQuery += ' ORDER BY month DESC, resale_price DESC LIMIT 200';
      recentTransactions = db.prepare(txQuery).all(...txParams);
    }

    // Attach lat/lng so the client can place markers without geocoding.
    // Distance path already has coords from findNearbyHdbBlocks; other paths
    // look up the returned blocks in hdb_block_coords (misses stay null and
    // fall back to client-side geocoding).
    if (!coordByKey) {
      const keys = [...new Set(recentTransactions.map(t => `${t.block}|${t.street_name}`))];
      coordByKey = {};
      if (keys.length > 0) {
        const rows = db.prepare(`
          SELECT block, street_name, lat, lng FROM hdb_block_coords
          WHERE (block || '|' || street_name) IN (${keys.map(() => '?').join(',')})
        `).all(...keys);
        for (const b of rows) coordByKey[`${b.block}|${b.street_name}`] = { lat: b.lat, lng: b.lng };
      }
    }
    for (const tx of recentTransactions) {
      const c = coordByKey[`${tx.block}|${tx.street_name}`];
      tx.lat = c?.lat ?? null;
      tx.lng = c?.lng ?? null;
    }

    res.json({
      town: townUpper,
      flat_type: flatTypeList.length > 0 ? flatTypeList.join(',') : 'ALL',
      street_filtered: streetNames.length > 0,
      street_names: streetNames,
      data_as_of: latestMonth,
      prices_by_type: pricesByType,
      private_trend_data: privateTrendData,
      town_summary: {
        median_price: townSummary?.median_price || 0,
        median_psm: townSummary?.median_psm || 0,
        min_price: townSummary?.min_price || 0,
        max_price: townSummary?.max_price || 0,
        total_transactions_12m: townSummary?.total_transactions || 0,
        most_popular_type: popularType?.flat_type || null,
      },
      price_percentiles: pricePercentiles,
      price_trend: priceTrend,
      trend_data: trendData,
      distribution: { bins, counts },
      recent_transactions: recentTransactions,
    });
  } catch (err) {
    console.error('Error in /api/area-overview:', err);
    res.status(500).json({ error: 'Failed to get overview: ' + err.message });
  }
});

// In-memory caches
const geocodeCache = new Map();

// Expand HDB street abbreviations for better OneMap matching
const streetAbbrevs = {
  ' ST ': ' STREET ', ' AVE ': ' AVENUE ', ' RD ': ' ROAD ',
  ' DR ': ' DRIVE ', ' CRES ': ' CRESCENT ', ' CRT ': ' COURT ',
  ' PL ': ' PLACE ', ' TERR ': ' TERRACE ', ' LOR ': ' LORONG ',
  ' BT ': ' BUKIT ', ' KG ': ' KAMPONG ', ' JLN ': ' JALAN ',
  ' UPP ': ' UPPER ', ' CTRL ': ' CENTRAL ', ' PK ': ' PARK ',
  ' SQ ': ' SQUARE ', ' GDNS ': ' GARDENS ', ' HTS ': ' HEIGHTS ',
  ' CL ': ' CLOSE ', ' WALK ': ' WALK ', ' LINK ': ' LINK ',
  ' RISE ': ' RISE ', ' VIEW ': ' VIEW ', ' WAY ': ' WAY ',
  ' LANE ': ' LANE ', ' LOOP ': ' LOOP ', ' WALK ': ' WALK ',
};
function expandStreetName(name) {
  let expanded = ' ' + name + ' ';
  for (const [abbr, full] of Object.entries(streetAbbrevs)) {
    expanded = expanded.replace(new RegExp(abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), full);
  }
  return expanded.trim();
}

/**
 * POST /api/geocode — Geocode a list of addresses via OneMap
 * Body: { addresses: [{ block, street_name }] }
 * Returns: { results: [{ query, lat, lng }] }
 */
app.post('/api/geocode', async (req, res) => {
  try {
    const { addresses } = req.body;
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Missing addresses array' });
    }
    if (addresses.length > 100) {
      return res.status(400).json({ error: 'addresses array exceeds limit of 100' });
    }

    // Deduplicate addresses
    const uniqueKeys = [...new Set(
      addresses.map(a => `${a.block} ${a.street_name}`.trim().toUpperCase())
    )];

    const results = [];
    const toFetch = [];

    // Check cache first
    for (const key of uniqueKeys) {
      if (geocodeCache.has(key)) {
        results.push({ query: key, ...geocodeCache.get(key) });
      } else {
        toFetch.push(key);
      }
    }

    // Step 1: Geocode via OneMap (parallel, 5 concurrent) with expanded street names
    const BATCH_SIZE = 5;
    const onemapResults = new Map(); // addr → { lat, lng } | null
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const batch = toFetch.slice(i, i + BATCH_SIZE);
      const batchResolved = await Promise.all(
        batch.map(async (addr) => {
          try {
            const expanded = expandStreetName(addr);
            const searchVal = encodeURIComponent(expanded);
            const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${searchVal}&returnGeom=Y&getAddrDetails=N&pageNum=1`;
            const resp = await fetch(url, {
              timeout: 5000,
              headers: { Authorization: `Bearer ${ONEMAP_TOKEN}` },
            });
            const data = await resp.json();
            if (data.results && data.results.length > 0) {
              const r = data.results[0];
              return { addr, lat: parseFloat(r.LATITUDE), lng: parseFloat(r.LONGITUDE), found: true };
            }
            return { addr, found: false };
          } catch (err) {
            console.error(`OneMap geocode error for "${addr}":`, err.message);
            return { addr, found: false };
          }
        })
      );
      for (const r of batchResolved) {
        if (r.found) {
          const coords = { lat: r.lat, lng: r.lng };
          onemapResults.set(r.addr, coords);
        } else {
          onemapResults.set(r.addr, null);
        }
      }
    }

    // Step 2: For addresses OneMap couldn't find, try Nominatim as fallback
    const nominatimNeeded = toFetch.filter(addr => onemapResults.get(addr) === null);
    for (const addr of nominatimNeeded) {
      try {
        const expanded = expandStreetName(addr);
        const searchVal = encodeURIComponent(expanded + ' SINGAPORE');
        const url = `https://nominatim.openstreetmap.org/search?q=${searchVal}&format=json&limit=1`;
        const resp = await fetch(url, {
          timeout: 8000,
          headers: { 'User-Agent': 'WorthIt/1.0 (HDB resale app)' },
        });
        const data = await resp.json();
        if (data && data.length > 0) {
          onemapResults.set(addr, { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
        // Rate limit: 1 req/sec for Nominatim
        if (nominatimNeeded.indexOf(addr) < nominatimNeeded.length - 1) {
          await new Promise(r => setTimeout(r, 1100));
        }
      } catch (err) {
        console.error(`Nominatim fallback error for "${addr}":`, err.message);
      }
    }

    // Build final results from cache
    for (const addr of toFetch) {
      const coords = onemapResults.get(addr);
      if (coords) {
        geocodeCache.set(addr, coords);
        results.push({ query: addr, ...coords });
      } else {
        geocodeCache.set(addr, { lat: null, lng: null });
        results.push({ query: addr, lat: null, lng: null });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('Error in /api/geocode:', err);
    res.status(500).json({ error: 'Failed to geocode: ' + err.message });
  }
});

/**
 * GET /api/private/projects — Search private property projects by name
 */
app.get('/api/private/projects', (req, res) => {
  try {
    const { q, limit } = req.query;
    const limitVal = Math.min(parseInt(limit) || 20, 50);

    if (!q || q.trim().length < 2) {
      return res.json({ projects: [] });
    }
    if (q.length > 200) return res.status(400).json({ error: 'Query too long' });

    const searchPattern = `%${q.toUpperCase().trim()}%`;

    const projects = db.prepare(`
      SELECT
        project,
        street_name,
        district,
        market_segment,
        flat_type as property_type,
        COUNT(*) as transaction_count,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm)) as avg_psm,
        ROUND(AVG(floor_area_sqm), 1) as avg_area,
        MIN(month) as earliest_transaction,
        MAX(month) as latest_transaction
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE'
        AND UPPER(project) LIKE ?
      GROUP BY project, district
      ORDER BY transaction_count DESC
      LIMIT ?
    `).all(searchPattern, limitVal);

    res.json({ projects });
  } catch (err) {
    console.error('Error in /api/private/projects:', err);
    res.status(500).json({ error: 'Failed to search projects: ' + err.message });
  }
});

/**
 * GET /api/private/project-overview — Detailed stats for a private property project
 */
app.get('/api/private/project-overview', (req, res) => {
  try {
    const { project, property_type } = req.query;
    if (!project) return res.status(400).json({ error: 'Missing project parameter' });
    if (project.length > 200) return res.status(400).json({ error: 'project parameter too long' });

    const monthsAgo12 = monthsAgoStr(12);
    const monthsAgo60 = monthsAgoStr(60);

    // Build property type filter — use parameterized placeholder to avoid SQL injection
    const propTypeFilter = property_type ? ' AND flat_type = ?' : '';
    const propTypeParam = property_type ? [property_type.toUpperCase()] : [];

    // Project info
    const projectInfo = db.prepare(`
      SELECT
        project,
        street_name,
        district,
        market_segment,
        flat_model as tenure,
        COUNT(*) as total_transactions,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm)) as avg_psm,
        ROUND(AVG(floor_area_sqm), 1) as avg_area,
        MIN(month) as earliest,
        MAX(month) as latest
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND project = ? ${propTypeFilter}
      GROUP BY project
    `).get(project, ...propTypeParam);

    // Get project coordinates from project_coords table
    const projectCoords = db.prepare(`
      SELECT latitude, longitude FROM project_coords WHERE project = ?
    `).get(project);

    if (!projectInfo) {
      return res.json({ found: false, project });
    }

    // Prices by property type (last 12 months)
    const pricesByType = db.prepare(`
      SELECT
        flat_type as property_type,
        COUNT(*) as count,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm)) as avg_psm,
        ROUND(AVG(floor_area_sqm), 1) as avg_area
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND project = ? AND month >= ? ${propTypeFilter}
      GROUP BY flat_type
      ORDER BY avg_price
    `).all(project, monthsAgo12, ...propTypeParam);

    // Price trend (last 60 months)
    const trendData = db.prepare(`
      SELECT
        month,
        COUNT(*) as count,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm), 0) as avg_psm
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND project = ? AND month >= ? ${propTypeFilter}
      GROUP BY month ORDER BY month ASC
    `).all(project, monthsAgo60, ...propTypeParam);

    // Calculate trend
    let priceTrend = { '6m_change': 0, '1y_change': 0, '3y_change': 0, direction: 'stable' };
    if (trendData.length >= 2) {
      const monthsAgo6 = monthsAgoStr(6);
      const monthsAgo12m = monthsAgoStr(12);
      const monthsAgo36 = monthsAgoStr(36);

      const recent6m = trendData.filter(m => m.month >= monthsAgo6);
      const recent12m = trendData.filter(m => m.month >= monthsAgo12m);
      const recent36m = trendData.filter(m => m.month >= monthsAgo36);

      priceTrend['6m_change'] = trendPct(recent6m, 'avg_psm');
      priceTrend['1y_change'] = trendPct(recent12m, 'avg_psm');
      priceTrend['3y_change'] = trendPct(recent36m, 'avg_psm');

      if (priceTrend['1y_change'] > 2) priceTrend.direction = 'rising';
      else if (priceTrend['1y_change'] < -2) priceTrend.direction = 'falling';
    }

    // Recent transactions
    const recentTransactions = db.prepare(`
      SELECT
        month, flat_type as property_type, floor_area_sqm, resale_price,
        price_per_sqm, flat_model as tenure, remaining_lease_years, storey_range, type_of_sale, type_of_area
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND project = ? ${propTypeFilter}
      ORDER BY month DESC, resale_price DESC LIMIT 50
    `).all(project, ...propTypeParam);

    // Price distribution (last 12 months)
    const allPrices = db.prepare(`
      SELECT resale_price FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND project = ? AND month >= ? ${propTypeFilter}
      ORDER BY resale_price ASC LIMIT 5000
    `).all(project, monthsAgo12, ...propTypeParam).map(r => r.resale_price);

    const pricePercentiles = {
      p10: percentile(allPrices, 10),
      p25: percentile(allPrices, 25),
      p50: percentile(allPrices, 50),
      p75: percentile(allPrices, 75),
      p90: percentile(allPrices, 90),
    };

    const minPrice = allPrices.length > 0 ? allPrices[0] : 0;
    const maxPrice = allPrices.length > 0 ? allPrices[allPrices.length - 1] : 0;
    const binCount = 20;
    const binWidth = Math.max(50000, Math.ceil((maxPrice - minPrice) / binCount / 50000) * 50000);
    const bins = [];
    const counts = [];
    for (let i = 0; i <= binCount; i++) {
      const binStart = Math.floor(minPrice / binWidth) * binWidth + i * binWidth;
      bins.push(binStart);
      const count = allPrices.filter(p => p >= binStart && p < binStart + binWidth).length;
      counts.push(count);
    }

    // District summary for comparison
    const districtSummary = db.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        ROUND(AVG(price_per_sqm)) as avg_district_psm
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND district = ? AND month >= ?
    `).get(projectInfo.district, monthsAgo12);

    const is_private = true;

    res.json({
      found: true,
      is_private,
      project: projectInfo,
      coordinates: projectCoords ? { lat: projectCoords.latitude, lng: projectCoords.longitude } : null,
      prices_by_type: pricesByType,
      price_trend: priceTrend,
      trend_data: trendData,
      recent_transactions: recentTransactions,
      price_percentiles: pricePercentiles,
      distribution: { bins, counts },
      district_summary: districtSummary,
    });
  } catch (err) {
    console.error('Error in /api/private/project-overview:', err);
    res.status(500).json({ error: 'Failed to get project overview: ' + err.message });
  }
});

/**
 * GET /api/private/district-summary — Aggregate private property stats for districts
 * Used by HDB town pages to show "Private Properties in This Area"
 * Query: ?districts=16,17 (comma-separated district codes)
 */
app.get('/api/private/district-summary', (req, res) => {
  try {
    const { districts } = req.query;
    if (!districts) return res.json({ found: false });

    const districtList = districts.split(',').map(d => d.trim()).filter(d => d.length > 0).slice(0, 30);
    if (districtList.length === 0) return res.json({ found: false });

    const placeholders = districtList.map(() => '?').join(',');
    const monthsAgo12 = monthsAgoStr(12);

    // Aggregate stats for last 12 months
    const summary = db.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm), 0) as avg_psm,
        MIN(resale_price) as min_price,
        MAX(resale_price) as max_price
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE'
        AND district IN (${placeholders})
        AND resale_price IS NOT NULL
        AND month >= ?
    `).get(...districtList, monthsAgo12);

    if (!summary || summary.total_transactions === 0) {
      return res.json({ found: false });
    }

    // Top projects by transaction count (last 12 months)
    const topProjects = db.prepare(`
      SELECT
        project,
        street_name,
        district,
        market_segment,
        COUNT(*) as tx_count,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm)) as avg_psm
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE'
        AND district IN (${placeholders})
        AND resale_price IS NOT NULL
        AND month >= ?
      GROUP BY project
      ORDER BY tx_count DESC
      LIMIT 10
    `).all(...districtList, monthsAgo12);

    // Prices by property type
    const pricesByType = db.prepare(`
      SELECT
        flat_type as property_type,
        COUNT(*) as count,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm)) as avg_psm,
        ROUND(AVG(floor_area_sqm), 1) as avg_area
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE'
        AND district IN (${placeholders})
        AND resale_price IS NOT NULL
        AND month >= ?
      GROUP BY flat_type
      ORDER BY avg_price
    `).all(...districtList, monthsAgo12);

    // Recent private transactions (last 12 months, limited)
    const recentPrivateTx = db.prepare(`
      SELECT
        month, project, flat_type as property_type, floor_area_sqm,
        resale_price, price_per_sqm, flat_model as tenure,
        remaining_lease_years, storey_range, district, market_segment
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE'
        AND district IN (${placeholders})
        AND resale_price IS NOT NULL
        AND month >= ?
      ORDER BY month DESC, resale_price DESC
      LIMIT 50
    `).all(...districtList, monthsAgo12);

    // Get project coordinates for map
    const projectCoords = db.prepare(`
      SELECT project, latitude, longitude
      FROM project_coords
      WHERE district IN (${placeholders})
    `).all(...districtList);

    res.json({
      found: true,
      districts: districtList,
      summary: {
        total_transactions: summary.total_transactions,
        avg_price: summary.avg_price,
        avg_psm: summary.avg_psm,
        min_price: summary.min_price,
        max_price: summary.max_price,
      },
      top_projects: topProjects,
      prices_by_type: pricesByType,
      recent_transactions: recentPrivateTx,
      project_coords: projectCoords.filter(p => p.latitude && p.longitude),
    });
  } catch (err) {
    console.error('Error in /api/private/district-summary:', err);
    res.status(500).json({ error: 'Failed to get district summary: ' + err.message });
  }
});

/**
 * GET /api/private/district-overview — Full overview for a district search
 * Returns private property data + HDB town data for the district
 * Query: ?district=16
 */
app.get('/api/private/district-overview', (req, res) => {
  try {
    const { district } = req.query;
    if (!district) return res.status(400).json({ error: 'Missing district parameter' });
    if (!/^\d{1,2}$/.test(district)) return res.status(400).json({ error: 'district must be a 1 or 2 digit number' });

    const districtCode = district.padStart(2, '0');
    const monthsAgo12 = monthsAgoStr(12);
    const monthsAgo60 = monthsAgoStr(60);

    // Private property aggregate stats
    const privateSummary = db.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm), 0) as avg_psm,
        MIN(resale_price) as min_price,
        MAX(resale_price) as max_price
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE'
        AND district = ?
        AND resale_price IS NOT NULL
        AND month >= ?
    `).get(districtCode, monthsAgo12);

    if (!privateSummary || privateSummary.total_transactions === 0) {
      return res.json({ found: false, district: districtCode });
    }

    // Top projects
    const topProjects = db.prepare(`
      SELECT
        project, street_name, district, market_segment,
        COUNT(*) as tx_count,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm)) as avg_psm,
        ROUND(AVG(floor_area_sqm), 1) as avg_area,
        MIN(month) as earliest,
        MAX(month) as latest
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND district = ?
        AND resale_price IS NOT NULL AND month >= ?
      GROUP BY project
      ORDER BY tx_count DESC
      LIMIT 20
    `).all(districtCode, monthsAgo12);

    // Prices by property type
    const pricesByType = db.prepare(`
      SELECT
        flat_type as property_type,
        COUNT(*) as count,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm)) as avg_psm,
        ROUND(AVG(floor_area_sqm), 1) as avg_area
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND district = ?
        AND resale_price IS NOT NULL AND month >= ?
      GROUP BY flat_type ORDER BY avg_price
    `).all(districtCode, monthsAgo12);

    // Price trend (last 60 months)
    const trendData = db.prepare(`
      SELECT
        month, COUNT(*) as count,
        ROUND(AVG(resale_price)) as avg_price,
        ROUND(AVG(price_per_sqm), 0) as avg_psm
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND district = ?
        AND resale_price IS NOT NULL AND month >= ?
      GROUP BY month ORDER BY month ASC
    `).all(districtCode, monthsAgo60);

    // Calculate trend
    let priceTrend = { '6m_change': 0, '1y_change': 0, '3y_change': 0, '5y_change': 0, direction: 'stable' };
    if (trendData.length >= 2) {
      const monthsAgo6 = monthsAgoStr(6);
      const monthsAgo12m = monthsAgoStr(12);
      const monthsAgo36 = monthsAgoStr(36);

      const recent6m = trendData.filter(m => m.month >= monthsAgo6);
      const recent12m = trendData.filter(m => m.month >= monthsAgo12m);
      const recent36m = trendData.filter(m => m.month >= monthsAgo36);

      priceTrend['6m_change'] = trendPct(recent6m, 'avg_psm');
      priceTrend['1y_change'] = trendPct(recent12m, 'avg_psm');
      priceTrend['3y_change'] = trendPct(recent36m, 'avg_psm');
      priceTrend['5y_change'] = trendPct(trendData, 'avg_psm');

      if (priceTrend['1y_change'] > 2) priceTrend.direction = 'rising';
      else if (priceTrend['1y_change'] < -2) priceTrend.direction = 'falling';
    }

    // Price distribution
    const allPrices = db.prepare(`
      SELECT resale_price FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND district = ?
        AND resale_price IS NOT NULL AND month >= ?
      ORDER BY resale_price ASC LIMIT 10000
    `).all(districtCode, monthsAgo12).map(r => r.resale_price);

    const pricePercentiles = {
      p10: percentile(allPrices, 10),
      p25: percentile(allPrices, 25),
      p50: percentile(allPrices, 50),
      p75: percentile(allPrices, 75),
      p90: percentile(allPrices, 90),
    };

    const minPrice = allPrices.length > 0 ? allPrices[0] : 0;
    const maxPrice = allPrices.length > 0 ? allPrices[allPrices.length - 1] : 0;
    const binCount = 20;
    const binWidth = Math.max(50000, Math.ceil((maxPrice - minPrice) / binCount / 50000) * 50000);
    const bins = [];
    const counts = [];
    for (let i = 0; i <= binCount; i++) {
      const binStart = Math.floor(minPrice / binWidth) * binWidth + i * binWidth;
      bins.push(binStart);
      const count = allPrices.filter(p => p >= binStart && p < binStart + binWidth).length;
      counts.push(count);
    }

    // Recent transactions
    const recentTransactions = db.prepare(`
      SELECT
        month, project, flat_type as property_type, floor_area_sqm,
        resale_price, price_per_sqm, flat_model as tenure,
        remaining_lease_years, storey_range
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND district = ?
        AND resale_price IS NOT NULL
      ORDER BY month DESC, resale_price DESC LIMIT 200
    `).all(districtCode);

    // Project coordinates for map
    const projectCoords = db.prepare(`
      SELECT project, street_name, latitude, longitude
      FROM project_coords WHERE district = ?
    `).all(districtCode);

    // Related HDB towns
    const relatedTowns = DISTRICT_TO_TOWNS[districtCode] || [];

    // HDB trend for related towns (dual-line chart)
    let hdbTrendData = [];
    if (relatedTowns.length > 0) {
      const townPlaceholders = relatedTowns.map(() => '?').join(',');
      hdbTrendData = db.prepare(`
        SELECT month, COUNT(*) as count, ROUND(AVG(price_per_sqm), 0) as avg_psm
        FROM transactions
        WHERE dataset_source != 'URA_PRIVATE'
          AND town IN (${townPlaceholders})
          AND resale_price IS NOT NULL AND month >= ?
        GROUP BY month ORDER BY month ASC
      `).all(...relatedTowns, monthsAgo60);
    }

    // === HDB TRANSACTIONS FROM RELATED TOWNS ===
    let hdbTransactions = [];
    if (relatedTowns.length > 0) {
      const townClause = `AND town IN (${relatedTowns.map(() => '?').join(',')})`;
      const townParams = relatedTowns;

      hdbTransactions = db.prepare(`
        SELECT month, town, flat_type, block, street_name, storey_range,
               floor_area_sqm, flat_model, remaining_lease_years, resale_price, price_per_sqm
        FROM transactions
        WHERE dataset_source != 'URA_PRIVATE'
          ${townClause}
          AND resale_price IS NOT NULL
        ORDER BY month DESC, resale_price DESC
        LIMIT 500
      `).all(...townParams);
    }

    // Merge transactions: private and HDB, sorted by date then price
    const allTransactions = [...(recentTransactions || []), ...hdbTransactions]
      .sort((a, b) => {
        const dateCompare = (b.month || '').localeCompare(a.month || '');
        if (dateCompare !== 0) return dateCompare;
        return (b.resale_price || 0) - (a.resale_price || 0);
      });

    // District label
    const districtLabel = DISTRICT_LABELS[districtCode] || `D${districtCode}`;

    res.json({
      found: true,
      district: districtCode,
      district_label: districtLabel,
      related_hdb_towns: relatedTowns,
      summary: privateSummary,
      top_projects: topProjects,
      prices_by_type: pricesByType,
      price_trend: priceTrend,
      trend_data: trendData,
      hdb_trend_data: hdbTrendData,
      price_percentiles: pricePercentiles,
      distribution: { bins, counts },
      recent_transactions: allTransactions,
      project_coords: projectCoords.filter(p => p.latitude && p.longitude),
    });
  } catch (err) {
    console.error('Error in /api/private/district-overview:', err);
    res.status(500).json({ error: 'Failed to get district overview: ' + err.message });
  }
});

/**
 * GET /api/private/property-types — List all private property types
 */
app.get('/api/private/property-types', (req, res) => {
  try {
    const types = db.prepare(`
      SELECT flat_type, COUNT(*) as count
      FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND flat_type != ''
      GROUP BY flat_type ORDER BY count DESC
    `).all();
    res.json({ property_types: types });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch property types' });
  }
});

/**
 * GET /api/nearby-hdb — Get nearby HDB transactions given lat/lng coordinates
 * Used by private property searches to also show nearby HDB transactions on the map
 */
app.get('/api/nearby-hdb', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Missing lat or lng' });

    const latF = parseFloat(lat);
    const lngF = parseFloat(lng);
    if (!isSgCoord(latF, lngF)) {
      return res.status(400).json({ error: 'Invalid coordinates — must be within Singapore' });
    }

    // 1. Find nearby HDB blocks by distance from hdb_block_coords
    const nearbyBlocks = findNearbyHdbBlocks(latF, lngF);

    if (nearbyBlocks.length === 0) {
      return res.json({ transactions: [], streets: [] });
    }

    // Build coord lookup and exact block-pair keys (same pattern as /api/area-overview)
    const coordByKey = {};
    for (const b of nearbyBlocks) {
      coordByKey[`${b.block}|${b.street_name}`] = { lat: b.lat, lng: b.lng };
    }
    const blockKeys = Object.keys(coordByKey);
    const blockClause = blockKeys.map(() => '?').join(',');
    const nearbyStreets = [...new Set(nearbyBlocks.map(b => b.street_name))];

    const monthsAgo12 = monthsAgoStr(12);

    // 2. Get HDB transactions for exact nearby blocks, last 12 months
    const rawTransactions = db.prepare(`
      SELECT month, town, flat_type, block, street_name, storey_range,
             floor_area_sqm, flat_model, remaining_lease_years, resale_price, price_per_sqm
      FROM transactions
      WHERE dataset_source != 'URA_PRIVATE'
        AND (block || '|' || street_name) IN (${blockClause})
        AND resale_price IS NOT NULL
        AND month >= ?
      ORDER BY month DESC, resale_price DESC
      LIMIT 200
    `).all(...blockKeys, monthsAgo12);

    // Attach lat/lng from hdb_block_coords — no geocoding needed on the client
    const transactions = rawTransactions.map(tx => {
      const key = `${tx.block}|${tx.street_name}`;
      const coords = coordByKey[key] || {};
      return { ...tx, lat: coords.lat ?? null, lng: coords.lng ?? null };
    });

    // 4. Also get nearby private projects from project_coords — bounding box is
    // only the index prefilter; exact haversine ≤ 800m decides inclusion.
    const PROJECT_RADIUS_M = 800;
    const nearbyProjects = db.prepare(`
      SELECT pc.project, pc.street_name, pc.district, pc.market_segment, pc.latitude, pc.longitude,
             COUNT(t.rowid) as tx_count,
             ROUND(AVG(t.resale_price)) as avg_price,
             ROUND(AVG(t.price_per_sqm)) as avg_psm
      FROM project_coords pc
      JOIN transactions t ON t.project = pc.project AND t.dataset_source = 'URA_PRIVATE'
      WHERE pc.latitude BETWEEN ? AND ?
        AND pc.longitude BETWEEN ? AND ?
      GROUP BY pc.project
      ORDER BY tx_count DESC
    `).all(
      latF - 0.0072, latF + 0.0072,
      lngF - 0.0074, lngF + 0.0074
    )
      .map(p => ({ ...p, dist_m: Math.round(haversineM(latF, lngF, p.latitude, p.longitude)) }))
      .filter(p => p.dist_m <= PROJECT_RADIUS_M)
      .slice(0, 40);

    // Get top 10 recent transactions for each nearby project
    const projectNames = nearbyProjects.map(p => p.project);
    let nearbyProjectTxs = [];
    if (projectNames.length > 0) {
      const placeholders = projectNames.map(() => '?').join(',');
      nearbyProjectTxs = db.prepare(`
        SELECT project, month, flat_type as property_type, floor_area_sqm, resale_price, price_per_sqm,
               remaining_lease_years, flat_model as tenure, storey_range
        FROM transactions
        WHERE project IN (${placeholders}) AND dataset_source = 'URA_PRIVATE'
        ORDER BY month DESC, resale_price DESC
      `).all(...projectNames);

      // Group by project
      const txByProject = {};
      for (const tx of nearbyProjectTxs) {
        if (!txByProject[tx.project]) txByProject[tx.project] = [];
        if (txByProject[tx.project].length < 10) {
          txByProject[tx.project].push(tx);
        }
      }
      // Attach to each project
      for (const proj of nearbyProjects) {
        proj.recent_transactions = txByProject[proj.project] || [];
      }
    }

    res.json({ transactions, streets: nearbyStreets, nearby_projects: nearbyProjects });
  } catch (err) {
    console.error('Error in /api/nearby-hdb:', err);
    res.status(500).json({ error: 'Failed to get nearby HDB: ' + err.message });
  }
});

/**
 * GET /api/valuation — Fair value + Deal Score for a specific flat.
 * Subject block via ?postal=XXXXXX or ?block=&street=.
 * Without ?price: returns subject + block_facts only (powers the chip UI).
 * With ?price (and optional flat_type / storey_range / area_sqm overrides):
 * adds a valuation from storey-adjusted nearby comparables.
 */
app.get('/api/valuation', (req, res) => {
  try {
    const { postal, block, street, price, flat_type, storey_range, area_sqm } = req.query;

    // --- Resolve subject block ---
    let blockRow = null;
    if (postal) {
      if (!/^\d{6}$/.test(postal)) return res.status(400).json({ error: 'postal must be a 6-digit code' });
      blockRow = db.prepare(
        'SELECT block, street_name, lat, lng, postal FROM hdb_block_coords WHERE postal = ? LIMIT 1'
      ).get(postal);
    } else if (block && street) {
      if (block.length > 10 || street.length > 200) return res.status(400).json({ error: 'block or street too long' });
      blockRow = db.prepare(
        'SELECT block, street_name, lat, lng, postal FROM hdb_block_coords WHERE block = ? AND street_name = ? LIMIT 1'
      ).get(block.toUpperCase(), street.toUpperCase());
    } else {
      return res.status(400).json({ error: 'Provide postal, or block and street' });
    }
    if (!blockRow) return res.json({ found: false, message: 'Block not found' });

    // --- Block facts: full history for this exact block ---
    const blockTxs = db.prepare(`
      SELECT month, town, flat_type, floor_area_sqm, storey_range, remaining_lease_years,
             resale_price, price_per_sqm
      FROM transactions
      WHERE block = ? AND street_name = ? AND dataset_source != 'URA_PRIVATE'
        AND resale_price IS NOT NULL
      ORDER BY month DESC
    `).all(blockRow.block, blockRow.street_name);
    if (blockTxs.length === 0) {
      return res.json({ found: false, message: 'No transaction history for this block' });
    }

    const town = blockTxs[0].town;
    const latestMonth = db.prepare('SELECT MAX(month) as m FROM transactions').get().m;

    // Remaining lease today: latest transaction with lease data, minus elapsed time.
    // (One block = one lease start, so any row works; prefer the freshest.)
    let leaseNow = null;
    const leaseTx = blockTxs.find(t => t.remaining_lease_years != null);
    if (leaseTx) {
      leaseNow = Math.round((leaseTx.remaining_lease_years - monthsBetween(leaseTx.month, latestMonth) / 12) * 10) / 10;
    }

    // Group history by flat type for the chip UI
    const byType = {};
    for (const t of blockTxs) {
      if (!byType[t.flat_type]) byType[t.flat_type] = { flat_type: t.flat_type, count: 0, areas: new Set(), storey_ranges: new Set() };
      byType[t.flat_type].count++;
      if (t.floor_area_sqm != null) byType[t.flat_type].areas.add(t.floor_area_sqm);
      if (t.storey_range) byType[t.flat_type].storey_ranges.add(t.storey_range);
    }
    const storeyStart = r => parseInt(r) || 0;
    const flatTypes = Object.values(byType)
      .sort((a, b) => b.count - a.count)
      .map(t => ({
        flat_type: t.flat_type,
        count: t.count,
        areas: [...t.areas].sort((a, b) => a - b),
        storey_ranges: [...t.storey_ranges].sort((a, b) => storeyStart(a) - storeyStart(b)),
      }));

    // --- Subject: params override inferred defaults ---
    const subjectType = flat_type ? flat_type.toUpperCase().slice(0, 30) : flatTypes[0].flat_type;
    const typeFacts = flatTypes.find(t => t.flat_type === subjectType);
    // Most common area for the chosen type (mode over that type's rows)
    let subjectArea = null;
    if (area_sqm) {
      subjectArea = parseFloat(area_sqm);
      if (!(subjectArea >= 20 && subjectArea <= 350)) return res.status(400).json({ error: 'area_sqm out of range (20–350)' });
    } else if (typeFacts) {
      const areaCounts = {};
      for (const t of blockTxs) {
        if (t.flat_type === subjectType && t.floor_area_sqm != null) {
          areaCounts[t.floor_area_sqm] = (areaCounts[t.floor_area_sqm] || 0) + 1;
        }
      }
      const best = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0];
      subjectArea = best ? parseFloat(best[0]) : null;
    }
    const subjectStorey = storey_range ? storey_range.toUpperCase().slice(0, 20) : null;

    const subject = {
      block: blockRow.block,
      street_name: blockRow.street_name,
      town,
      postal: blockRow.postal,
      lat: blockRow.lat,
      lng: blockRow.lng,
      flat_type: subjectType,
      floor_area_sqm: subjectArea,
      storey_range: subjectStorey,
      remaining_lease_years: leaseNow,
    };
    const blockFacts = { flat_types: flatTypes, remaining_lease_years: leaseNow };

    if (price === undefined) {
      return res.json({ found: true, subject, block_facts: blockFacts });
    }

    // --- Valuation ---
    const askingPrice = parseFloat(price);
    if (!(askingPrice >= 50000 && askingPrice <= 5000000)) {
      return res.status(400).json({ error: 'price out of range (50,000–5,000,000)' });
    }
    if (!subjectArea) {
      return res.json({ found: true, subject, block_facts: blockFacts, valuation: null, valuation_message: 'No floor area known for this flat type — pass area_sqm' });
    }

    const monthsAgo12 = monthsAgoStr(12);

    // Comps: same flat type, last 12 months, within radius; optional lease band ±10y
    const fetchComps = (radiusM, useLease) => {
      const blocks = findNearbyHdbBlocks(blockRow.lat, blockRow.lng, radiusM);
      if (blocks.length === 0) return [];
      const distByKey = {};
      for (const b of blocks) distByKey[`${b.block}|${b.street_name}`] = b.dist_m;
      const keys = Object.keys(distByKey);
      let q = `
        SELECT month, block, street_name, storey_range, floor_area_sqm,
               remaining_lease_years, resale_price, price_per_sqm
        FROM transactions
        WHERE dataset_source != 'URA_PRIVATE' AND resale_price IS NOT NULL
          AND price_per_sqm IS NOT NULL AND flat_type = ? AND month >= ?
          AND (block || '|' || street_name) IN (${keys.map(() => '?').join(',')})
      `;
      const params = [subjectType, monthsAgo12, ...keys];
      if (useLease && leaseNow != null) {
        q += ' AND remaining_lease_years BETWEEN ? AND ?';
        params.push(leaseNow - 10, leaseNow + 10);
      }
      return db.prepare(q).all(...params)
        .map(c => ({ ...c, dist_m: distByKey[`${c.block}|${c.street_name}`] ?? null }));
    };

    const MIN_COMPS = 8;
    let comps = fetchComps(500, true);
    let radiusUsed = 500;
    let leaseFiltered = true;
    let townFallback = false;
    if (comps.length < MIN_COMPS) { comps = fetchComps(1000, true); radiusUsed = 1000; }
    if (comps.length < MIN_COMPS) { comps = fetchComps(1000, false); leaseFiltered = false; }
    if (comps.length < MIN_COMPS) {
      townFallback = true;
      radiusUsed = null;
      comps = db.prepare(`
        SELECT month, block, street_name, storey_range, floor_area_sqm,
               remaining_lease_years, resale_price, price_per_sqm
        FROM transactions
        WHERE dataset_source != 'URA_PRIVATE' AND resale_price IS NOT NULL
          AND price_per_sqm IS NOT NULL AND town = ? AND flat_type = ? AND month >= ?
      `).all(town, subjectType, monthsAgo12).map(c => ({ ...c, dist_m: null }));
    }
    if (comps.length === 0) {
      return res.json({ found: true, subject, block_facts: blockFacts, valuation: null, valuation_message: 'Not enough comparable sales to estimate a fair value' });
    }

    // Storey premium buckets for this town + type (last 24 months).
    // Lease-banded to the subject when possible — without it, "high floor" buckets
    // are dominated by newer (pricier, longer-lease) blocks and overstate the premium.
    const storeyBuckets = {};
    let bucketQuery = `
      SELECT storey_range, AVG(price_per_sqm) as avg_psm, COUNT(*) as c
      FROM transactions
      WHERE town = ? AND flat_type = ? AND month >= ?
        AND storey_range IS NOT NULL AND price_per_sqm IS NOT NULL
    `;
    const bucketParams = [town, subjectType, monthsAgoStr(24)];
    if (leaseNow != null) {
      bucketQuery += ' AND remaining_lease_years BETWEEN ? AND ?';
      bucketParams.push(leaseNow - 10, leaseNow + 10);
    }
    for (const r of db.prepare(bucketQuery + ' GROUP BY storey_range').all(...bucketParams)) {
      storeyBuckets[r.storey_range] = { avg_psm: r.avg_psm, c: r.c };
    }

    let storeyAdjusted = false;
    for (const c of comps) {
      const f = computeStoreyFactor(storeyBuckets, subjectStorey, c.storey_range);
      if (f !== 1) storeyAdjusted = true;
      c.adjusted_psm = Math.round(c.price_per_sqm * f);
    }

    const adjustedPsms = comps.map(c => c.adjusted_psm);
    const fairPsm = median(adjustedPsms);
    const fairValue = Math.round(fairPsm * subjectArea);
    const fairLow = Math.round(percentile(adjustedPsms, 25) * subjectArea);
    const fairHigh = Math.round(percentile(adjustedPsms, 75) * subjectArea);
    const askingPsm = askingPrice / subjectArea;
    const deviation = (askingPsm - fairPsm) / fairPsm;
    const score = dealScore(deviation);
    const verdict = score >= 70 ? 'Good deal' : score >= 45 ? 'Fair price' : 'Premium';
    const percentileRank = Math.round(adjustedPsms.filter(p => p <= askingPsm).length / adjustedPsms.length * 100);
    const confidence = (!townFallback && leaseFiltered && radiusUsed === 500 && comps.length >= 15) ? 'high'
      : !townFallback ? 'medium' : 'low';

    // Nearest + freshest comps first; cap payload at 20
    const compsOut = [...comps]
      .sort((a, b) => (a.dist_m ?? Infinity) - (b.dist_m ?? Infinity) || (a.month < b.month ? 1 : -1))
      .slice(0, 20);

    res.json({
      found: true,
      subject,
      block_facts: blockFacts,
      valuation: {
        asking_price: askingPrice,
        asking_psm: Math.round(askingPsm),
        fair_value: fairValue,
        fair_low: fairLow,
        fair_high: fairHigh,
        fair_psm: fairPsm,
        deal_score: score,
        verdict,
        percentile_rank: percentileRank,
        confidence,
        comps_used: comps.length,
        radius_m: radiusUsed,
        lease_filtered: leaseFiltered,
        storey_adjusted: storeyAdjusted,
        months_window: 12,
        data_as_of: latestMonth,
        comps: compsOut,
      },
    });
  } catch (err) {
    console.error('Error in /api/valuation:', err);
    res.status(500).json({ error: 'Failed to compute valuation: ' + err.message });
  }
});

// ============================================================
// SEO ENDPOINTS (for Cloudflare Pages Function / bot requests)
// ============================================================

const SEO_BASE_URL = process.env.SEO_BASE_URL || 'https://worthit.canlah.app';

// Slug helpers
function townToSlug(town) {
  return town.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function slugToTown(slug) {
  const s = slug.toUpperCase().replace(/-/g, ' ');
  if (!db) return null;
  const towns = db.prepare("SELECT DISTINCT town FROM transactions WHERE dataset_source != 'URA_PRIVATE'").all().map(r => r.town);
  // Exact match after normalization
  const exact = towns.find(t => t.replace(/[^A-Z0-9]/g, ' ') === s.replace(/[^A-Z0-9]/g, ' '));
  if (exact) return exact;
  // Try matching with slashes (KALLANG/WHAMPOA → kallang-whampoa)
  return towns.find(t => townToSlug(t) === slug) || null;
}

function slugToProject(slug) {
  if (!db) return null;
  const searchPattern = `%${slug.replace(/-/g, '%')}%`;
  return db.prepare(`
    SELECT project FROM transactions
    WHERE dataset_source = 'URA_PRIVATE' AND UPPER(project) LIKE ?
    GROUP BY project ORDER BY COUNT(*) DESC LIMIT 1
  `).get(searchPattern)?.project || null;
}

// Flat-type slug helpers — power /hdb/<town>/<flat-type> programmatic pages
const FLAT_TYPE_SLUGS = {
  '2 ROOM': '2-room',
  '3 ROOM': '3-room',
  '4 ROOM': '4-room',
  '5 ROOM': '5-room',
  'EXECUTIVE': 'executive',
};
const SLUG_TO_FLAT_TYPE = Object.fromEntries(Object.entries(FLAT_TYPE_SLUGS).map(([k, v]) => [v, k]));
// '4 ROOM' -> '4 Room', 'EXECUTIVE' -> 'Executive'
function flatTypeLabel(ft) {
  return titleCase(ft);
}

// 'YYYY-MM' -> 'Month YYYY' (freshness display)
function fmtMonthYear(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// Render a FAQ array (same shape used for FAQPage JSON-LD) as visible prose Q&A.
// FAQ rich results are deprecated, but the prose still wins featured snippets / AI Overviews.
function faqsToHtml(faqs) {
  if (!faqs || !faqs.length) return '';
  return `<h3 style="font-size:1rem;font-weight:600;margin:1.5rem 0 0.5rem">Frequently Asked Questions</h3>` +
    faqs.map(f => `<div style="margin-bottom:0.75rem">
    <p style="font-weight:600;margin-bottom:0.25rem">${f.name}</p>
    <p style="color:#4b5563;margin:0">${f.acceptedAnswer.text}</p>
  </div>`).join('');
}

function titleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0) + w.slice(1).toLowerCase());
}

function fmtPrice(p) {
  if (!p) return 'N/A';
  if (p >= 1000000) return `$${(p / 1000000).toFixed(2)}M`;
  if (p >= 1000) return `$${Math.round(p / 1000)}k`;
  return `$${Math.round(p)}`;
}

function fmtPsf(psm) {
  if (!psm) return 'N/A';
  return `$${Math.round(psm / 10.7639)} psf`;
}

/**
 * GET /api/seo/sitemap — Generate sitemap URLs
 */
let sitemapCache = { data: null, timestamp: 0 };
app.get('/api/seo/sitemap', (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not ready' });

    const now = Date.now();
    if (sitemapCache.data && now - sitemapCache.timestamp < 86400000) {
      return res.json(sitemapCache.data);
    }

    const latestMonth = db.prepare("SELECT MAX(month) as m FROM transactions").get()?.m;
    const lastmod = latestMonth ? latestMonth + '-01' : new Date().toISOString().slice(0, 10);

    const urls = [{ url: SEO_BASE_URL + '/', changefreq: 'weekly', priority: '1.0', lastmod }];

    // Static content pages (About / Methodology / Data Sources — E-E-A-T)
    for (const page of ['about', 'methodology', 'data-sources']) {
      urls.push({ url: `${SEO_BASE_URL}/${page}`, changefreq: 'monthly', priority: '0.5', lastmod });
    }

    // Check My Price tool page (per-postal variants are noindex)
    urls.push({ url: `${SEO_BASE_URL}/check`, changefreq: 'monthly', priority: '0.6', lastmod });

    // HDB towns
    const towns = db.prepare("SELECT DISTINCT town FROM transactions WHERE dataset_source != 'URA_PRIVATE' ORDER BY town").all();
    for (const t of towns) {
      urls.push({
        url: `${SEO_BASE_URL}/hdb/${townToSlug(t.town)}`,
        changefreq: 'weekly',
        priority: '0.9',
        lastmod,
      });
    }

    // Town × flat-type pages — only combos with enough recent data to avoid thin pages
    const townTypes = db.prepare(`
      SELECT town, flat_type, COUNT(*) as cnt
      FROM transactions
      WHERE dataset_source != 'URA_PRIVATE'
        AND flat_type IN ('2 ROOM','3 ROOM','4 ROOM','5 ROOM','EXECUTIVE')
        AND month >= ?
      GROUP BY town, flat_type HAVING cnt >= 5
    `).all(monthsAgoStr(24));
    for (const tt of townTypes) {
      urls.push({
        url: `${SEO_BASE_URL}/hdb/${townToSlug(tt.town)}/${FLAT_TYPE_SLUGS[tt.flat_type]}`,
        changefreq: 'weekly',
        priority: '0.6',
        lastmod,
      });
    }

    // District pages
    for (const d of Object.keys(DISTRICT_LABELS)) {
      urls.push({
        url: `${SEO_BASE_URL}/district/${d}`,
        changefreq: 'weekly',
        priority: '0.8',
        lastmod,
      });
    }

    // Top private projects (by transaction count, limited to keep sitemap reasonable)
    const projects = db.prepare(`
      SELECT project FROM transactions
      WHERE dataset_source = 'URA_PRIVATE'
      GROUP BY project ORDER BY COUNT(*) DESC LIMIT 200
    `).all();
    for (const p of projects) {
      urls.push({
        url: `${SEO_BASE_URL}/private/${townToSlug(p.project)}`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod,
      });
    }

    sitemapCache = { data: { urls }, timestamp: now };
    res.json({ urls });
  } catch (err) {
    console.error('Error in /api/seo/sitemap:', err);
    res.status(500).json({ error: 'Failed to generate sitemap' });
  }
});

/**
 * GET /api/seo/metadata — Generate SEO metadata for a route
 * Query: ?route=/hdb/bedok
 */
app.get('/api/seo/metadata', (req, res) => {
  try {
    const { route } = req.query;
    if (!route) return res.status(400).json({ error: 'Missing route parameter' });
    if (route.length > 500) return res.status(400).json({ error: 'route parameter too long' });

    let meta = {
      title: 'WorthIt — Singapore HDB Resale Prices & Property Transaction Checker',
      description: 'Check HDB resale prices, property transaction history, and fair value estimates for Singapore flats and condos. Analyze 370K+ transactions from data.gov.sg with price trends, distributions, and Deal Scores.',
      canonical: SEO_BASE_URL + '/',
      og_title: 'WorthIt — Singapore HDB & Condo Resale Price Tracker',
      og_description: 'Check HDB resale prices, condo transaction history, and fair market value for any Singapore property. Free tool powered by data.gov.sg.',
      json_ld: null,
      content_html: null,
      robots: null,
    };

    // Freshness signals (data refreshes daily; surface the data currency)
    const latestMonth = db ? db.prepare('SELECT MAX(month) as m FROM transactions').get()?.m : null;
    const dateModified = latestMonth ? latestMonth + '-01' : new Date().toISOString().slice(0, 10);
    const dataThrough = fmtMonthYear(latestMonth);
    const freshnessNote = dataThrough
      ? `<p style="font-size:0.8rem;color:#9ca3af;margin-top:1rem">Data updated through ${dataThrough}, sourced from HDB &amp; URA via data.gov.sg.</p>`
      : '';

    if (!route || route === '/') {
      // Homepage
      meta.json_ld = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': SEO_BASE_URL + '/#website',
            url: SEO_BASE_URL + '/',
            name: 'WorthIt',
            description: 'Singapore HDB & Property Resale Price Tracker',
            potentialAction: {
              '@type': 'SearchAction',
              target: SEO_BASE_URL + '/?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@type': 'Organization',
            '@id': SEO_BASE_URL + '/#organization',
            name: 'WorthIt',
            url: SEO_BASE_URL + '/',
            logo: SEO_BASE_URL + '/logo.png',
          },
          {
            '@type': 'SoftwareApplication',
            name: 'WorthIt',
            url: SEO_BASE_URL + '/',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description: 'Free Singapore HDB & private property resale price checker — search any town, postal code, or project to view transaction history, price trends, and Deal Scores from data.gov.sg and URA records.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'SGD' },
          },
          {
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How to check HDB resale prices in Singapore?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Use WorthIt to search any HDB town and instantly view median resale prices, price trends, and transaction history. Data sourced from data.gov.sg covering 370,000+ HDB resale transactions across all Singapore towns.',
                },
              },
              {
                '@type': 'Question',
                name: 'What is a fair price for an HDB flat in Singapore?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'A fair HDB price depends on town, flat type, floor level, remaining lease, and recent transactions. WorthIt shows price percentiles (10th to 90th), price per sqft benchmarks, and Deal Scores to help you assess fair value against comparable sales.',
                },
              },
              {
                '@type': 'Question',
                name: 'Where to find Singapore property transaction history?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'WorthIt provides free access to Singapore property transaction records from HDB and URA data. Search by town, postal code, or project name to see past resale prices, price trends over 5 years, and detailed transaction maps.',
                },
              },
              {
                '@type': 'Question',
                name: 'How to check condo resale transaction prices in Singapore?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Search any private property or condo project name on WorthIt to view resale transaction prices, price per sqft, unit mix, and market segment (CCR/RCR/OCR) data sourced from URA records.',
                },
              },
              {
                '@type': 'Question',
                name: 'What is the Deal Score for HDB flats?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Deal Score compares a transaction\'s price per sqft against similar flats (same type and remaining lease) in the same area. Green markers indicate good value, while red indicates premium pricing. This helps buyers quickly assess whether a listing is fairly priced.',
                },
              },
            ],
          },
        ],
      });
    } else if (route === '/check' || route.startsWith('/check/')) {
      meta.title = 'Check an HDB Asking Price — Free Deal Score | WorthIt';
      meta.description = 'Enter a postal code and asking price to get a fair-value estimate, Deal Score, and comparable sales from real HDB resale transactions.';
      meta.canonical = `${SEO_BASE_URL}/check`;
      meta.og_title = meta.title;
      meta.og_description = meta.description;
      meta.og_url = meta.canonical;
      // Per-postal check URLs are user-specific — keep them out of the index
      if (route.startsWith('/check/')) meta.robots = 'noindex, follow';
    } else if (route.startsWith('/postal/')) {
      const postal = route.replace('/postal/', '').trim();
      if (/^\d{6}$/.test(postal) && db) {
        const block = db.prepare(
          'SELECT block, street_name FROM hdb_block_coords WHERE postal = ? LIMIT 1'
        ).get(postal);
        if (block) {
          const addr = `Blk ${block.block} ${titleCase(block.street_name)}`;
          meta.title = `${addr} HDB Resale Prices | WorthIt`;
          meta.description = `Check HDB resale prices near ${addr}. View recent transactions, deal scores, and price trends for this location.`;
          meta.canonical = `${SEO_BASE_URL}/postal/${postal}`;
          meta.og_title = meta.title;
          meta.og_description = meta.description;
          meta.og_url = meta.canonical;
        }
      }
    } else if (/^\/hdb\/[^/]+\/[^/]+$/.test(route)) {
      // Town × flat-type page, e.g. /hdb/tampines/4-room
      const [, townSlug, ftSlug] = route.match(/^\/hdb\/([^/]+)\/([^/]+)$/);
      const town = slugToTown(townSlug);
      const flatType = SLUG_TO_FLAT_TYPE[ftSlug];
      if (town && flatType && db) {
        const townDisplay = titleCase(town);
        const ftLabel = flatTypeLabel(flatType);
        const year = new Date().getFullYear();
        const m12 = monthsAgoStr(12);
        const m24 = monthsAgoStr(24);

        const cur = db.prepare(`
          SELECT COUNT(*) as cnt, ROUND(AVG(resale_price)) as avg_price, ROUND(AVG(price_per_sqm), 0) as avg_psm,
            ROUND(MIN(resale_price)) as min_price, ROUND(MAX(resale_price)) as max_price, ROUND(AVG(floor_area_sqm)) as avg_area
          FROM transactions WHERE town = ? AND flat_type = ? AND resale_price IS NOT NULL AND month >= ? AND dataset_source != 'URA_PRIVATE'
        `).get(town, flatType, m12);

        const prev = db.prepare(`
          SELECT ROUND(AVG(price_per_sqm), 0) as avg_psm
          FROM transactions WHERE town = ? AND flat_type = ? AND month >= ? AND month < ? AND dataset_source != 'URA_PRIVATE'
        `).get(town, flatType, m24, m12);

        const cnt = cur?.cnt || 0;
        const avgPrice = cur?.avg_price || 0;
        const avgPsm = cur?.avg_psm || 0;
        const prevPsm = prev?.avg_psm || 0;
        const yoyDir = avgPsm && prevPsm ? (avgPsm > prevPsm ? 'up' : avgPsm < prevPsm ? 'down' : 'stable') : null;
        const yoyPct = avgPsm && prevPsm ? Math.round(Math.abs(avgPsm - prevPsm) / prevPsm * 100) : 0;

        meta.canonical = `${SEO_BASE_URL}/hdb/${townSlug}/${ftSlug}`;

        if (cnt > 0) {
          meta.title = `${ftLabel} HDB Resale Price in ${townDisplay} ${year} — ${fmtPsf(avgPsm)} | WorthIt`;
          meta.description = `${ftLabel} HDB flats in ${townDisplay}: ${cnt.toLocaleString()} sales in 12 months, avg ${fmtPrice(avgPrice)} (${fmtPsf(avgPsm)})${yoyDir ? `, ${yoyDir} ${yoyPct}% YoY` : ''}. See trends & recent sales.`;
          meta.og_title = `${ftLabel} HDB Resale Prices in ${townDisplay} — ${fmtPsf(avgPsm)} avg`;
          meta.og_description = `${cnt.toLocaleString()} ${ftLabel} transactions in ${townDisplay}.${yoyDir ? ` Prices ${yoyDir} ${yoyPct}% YoY.` : ''}`;

          // Sibling flat types in this town (cross-links)
          const siblings = db.prepare(`
            SELECT flat_type, COUNT(*) as cnt FROM transactions
            WHERE town = ? AND month >= ? AND dataset_source != 'URA_PRIVATE'
              AND flat_type IN ('2 ROOM','3 ROOM','4 ROOM','5 ROOM','EXECUTIVE')
            GROUP BY flat_type HAVING cnt >= 5 ORDER BY flat_type
          `).all(town, m24);

          const faqs = [
            {
              '@type': 'Question',
              name: `What is the average resale price of a ${ftLabel} HDB flat in ${townDisplay}?`,
              acceptedAnswer: { '@type': 'Answer', text: `${ftLabel} HDB flats in ${townDisplay} averaged ${fmtPrice(avgPrice)} (${fmtPsf(avgPsm)}) over the last 12 months, based on ${cnt.toLocaleString()} resale transactions${cur?.avg_area ? ` with an average floor area of ${Math.round(cur.avg_area * 10.7639)} sqft` : ''}.` },
            },
          ];
          if (cur?.min_price && cur?.max_price) {
            faqs.push({
              '@type': 'Question',
              name: `What is the price range for ${ftLabel} flats in ${townDisplay}?`,
              acceptedAnswer: { '@type': 'Answer', text: `In the past 12 months, ${ftLabel} resale flats in ${townDisplay} transacted between ${fmtPrice(cur.min_price)} and ${fmtPrice(cur.max_price)}, depending on floor level, remaining lease, and exact location.` },
            });
          }
          if (yoyDir && yoyPct > 0) {
            faqs.push({
              '@type': 'Question',
              name: `Are ${ftLabel} HDB prices in ${townDisplay} rising?`,
              acceptedAnswer: { '@type': 'Answer', text: `${ftLabel} HDB resale prices in ${townDisplay} are ${yoyDir} ${yoyPct}% year-on-year, comparing average price per sqft over the past 12 months to the prior 12 months.` },
            });
          }

          meta.json_ld = JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebPage',
                name: `${ftLabel} HDB Resale Prices in ${townDisplay}`,
                description: meta.description,
                url: meta.canonical,
                dateModified,
                breadcrumb: {
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: SEO_BASE_URL + '/' },
                    { '@type': 'ListItem', position: 2, name: `${townDisplay} HDB`, item: `${SEO_BASE_URL}/hdb/${townSlug}` },
                    { '@type': 'ListItem', position: 3, name: `${ftLabel}`, item: meta.canonical },
                  ],
                },
              },
              { '@type': 'FAQPage', mainEntity: faqs },
            ],
          });

          const siblingLinks = siblings
            .filter(s => s.flat_type !== flatType)
            .map(s => `<a href="/hdb/${townSlug}/${FLAT_TYPE_SLUGS[s.flat_type]}" style="color:#3b82f6;text-decoration:none;white-space:nowrap">${flatTypeLabel(s.flat_type)}</a>`)
            .join(' &middot; ');

          const relatedDistricts = (TOWN_TO_DISTRICTS[town] || [])
            .map(d => DISTRICT_LABELS[d] ? `<a href="/district/${d}" style="color:#3b82f6;text-decoration:none">${DISTRICT_LABELS[d]}</a>` : null)
            .filter(Boolean).join(' &middot; ');

          meta.content_html = `<section id="seo-content" style="padding:2rem 1rem;margin-top:1rem;border-top:1px solid #e5e7eb">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:0.75rem">${ftLabel} HDB Resale Prices in ${townDisplay}</h2>
  <p style="color:#4b5563;margin-bottom:1rem">
    Over the last 12 months, ${cnt.toLocaleString()} <strong>${ftLabel}</strong> HDB flats were resold in ${townDisplay} at an average of <strong>${fmtPrice(avgPrice)}</strong> (${fmtPsf(avgPsm)}).${cur?.min_price && cur?.max_price ? ` Prices ranged from ${fmtPrice(cur.min_price)} to ${fmtPrice(cur.max_price)}.` : ''}${yoyDir && yoyPct > 0 ? ` Prices are <strong>${yoyDir} ${yoyPct}%</strong> year-on-year.` : ''}
  </p>
  ${siblingLinks ? `<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Other Flat Types in ${townDisplay}</h3>
  <p style="font-size:0.9rem;line-height:2;margin-bottom:1rem">${siblingLinks}</p>` : ''}
  <p style="font-size:0.9rem;margin-bottom:1rem"><a href="/hdb/${townSlug}" style="color:#3b82f6;text-decoration:none">&larr; All ${townDisplay} HDB resale prices</a></p>
  ${relatedDistricts ? `<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Private Property Nearby</h3>
  <p style="font-size:0.9rem;line-height:1.9;margin-bottom:1rem">${relatedDistricts}</p>` : ''}
  ${faqsToHtml(faqs)}
  ${freshnessNote}
</section>`;
        } else {
          // No data for this combo — consolidate to the town page to avoid a thin/empty page
          meta.canonical = `${SEO_BASE_URL}/hdb/${townSlug}`;
          meta.title = `${ftLabel} HDB Resale Prices in ${townDisplay} | WorthIt`;
          meta.description = `Browse ${ftLabel} HDB resale prices and transaction history in ${townDisplay}, Singapore.`;
        }
      }
    } else if (route.startsWith('/hdb/')) {
      const slug = route.replace('/hdb/', '');
      const town = slugToTown(slug);
      if (town && db) {
        const townDisplay = titleCase(town);
        const monthsAgo12 = monthsAgoStr(12);
        const monthsAgo24 = monthsAgoStr(24);

        const summary = db.prepare(`
          SELECT COUNT(*) as tx_count, ROUND(AVG(resale_price)) as avg_price, ROUND(AVG(price_per_sqm), 0) as avg_psm
          FROM transactions WHERE town = ? AND resale_price IS NOT NULL AND month >= ? AND dataset_source != 'URA_PRIVATE'
        `).get(town, monthsAgo12);

        const byType = db.prepare(`
          SELECT flat_type, COUNT(*) as cnt, ROUND(AVG(resale_price)) as avg_price, ROUND(AVG(price_per_sqm), 0) as avg_psm
          FROM transactions WHERE town = ? AND month >= ? AND dataset_source != 'URA_PRIVATE'
            AND flat_type IN ('2 ROOM','3 ROOM','4 ROOM','5 ROOM','EXECUTIVE')
          GROUP BY flat_type ORDER BY flat_type
        `).all(town, monthsAgo12);

        const prevSummary = db.prepare(`
          SELECT ROUND(AVG(price_per_sqm), 0) as avg_psm
          FROM transactions WHERE town = ? AND month >= ? AND month < ? AND dataset_source != 'URA_PRIVATE'
        `).get(town, monthsAgo24, monthsAgo12);

        const txCount = summary?.tx_count || 0;
        const avgPrice = summary?.avg_price || 0;
        const avgPsm = summary?.avg_psm || 0;
        const prevAvgPsm = prevSummary?.avg_psm || 0;
        const yoyDir = avgPsm && prevAvgPsm ? (avgPsm > prevAvgPsm ? 'up' : avgPsm < prevAvgPsm ? 'down' : 'stable') : null;
        const yoyPct = avgPsm && prevAvgPsm ? Math.round(Math.abs(avgPsm - prevAvgPsm) / prevAvgPsm * 100) : 0;

        const otherTowns = db.prepare("SELECT DISTINCT town FROM transactions WHERE dataset_source != 'URA_PRIVATE' ORDER BY town").all().map(r => r.town).filter(t => t !== town);

        meta.title = `${townDisplay} HDB Resale Price ${new Date().getFullYear()} — ${fmtPsf(avgPsm)} Avg | WorthIt`;
        meta.description = `${townDisplay} HDB resale prices: ${txCount.toLocaleString()} sales in 12 months, avg ${fmtPrice(avgPrice)} (${fmtPsf(avgPsm)}). Compare flat types, trends & Deal Scores.`;
        meta.canonical = `${SEO_BASE_URL}/hdb/${slug}`;
        meta.og_title = `${townDisplay} HDB Resale Prices — ${fmtPsf(avgPsm)} avg psf`;
        meta.og_description = `${txCount.toLocaleString()} recent HDB transactions in ${townDisplay}.${yoyDir ? ` Prices ${yoyDir} ${yoyPct}% YoY.` : ''}`;

        const faqs = [
          {
            '@type': 'Question',
            name: `What is the average HDB resale price in ${townDisplay}?`,
            acceptedAnswer: { '@type': 'Answer', text: `The average HDB resale price in ${townDisplay} is ${fmtPrice(avgPrice)} (${fmtPsf(avgPsm)}) based on ${txCount.toLocaleString()} transactions in the past 12 months.` },
          },
        ];

        for (const t of byType.slice(0, 3)) {
          const label = t.flat_type.charAt(0) + t.flat_type.slice(1).toLowerCase();
          faqs.push({
            '@type': 'Question',
            name: `What is the resale price of a ${label} flat in ${townDisplay}?`,
            acceptedAnswer: { '@type': 'Answer', text: `${label} flats in ${townDisplay} averaged ${fmtPrice(t.avg_price)} (${fmtPsf(t.avg_psm)}) over the last 12 months based on ${t.cnt} transactions.` },
          });
        }

        if (yoyDir && yoyPct > 0) {
          faqs.push({
            '@type': 'Question',
            name: `Are HDB resale prices in ${townDisplay} going up or down?`,
            acceptedAnswer: { '@type': 'Answer', text: `HDB resale prices in ${townDisplay} are ${yoyDir} ${yoyPct}% year-on-year based on average price per sqft comparing the past 12 months to the prior 12 months.` },
          });
        }

        meta.json_ld = JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              name: `${townDisplay} HDB Resale Prices`,
              description: meta.description,
              url: meta.canonical,
              dateModified,
              breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: SEO_BASE_URL + '/' },
                  { '@type': 'ListItem', position: 2, name: `${townDisplay} HDB`, item: meta.canonical },
                ],
              },
            },
            { '@type': 'FAQPage', mainEntity: faqs },
          ],
        });

        // Flat-type rows link to the dedicated /hdb/<town>/<flat-type> page (programmatic SEO + crawl path)
        const typeRows = byType.map(t => {
          const label = t.flat_type.charAt(0) + t.flat_type.slice(1).toLowerCase();
          const ftSlug = FLAT_TYPE_SLUGS[t.flat_type];
          const nameCell = ftSlug
            ? `<a href="/hdb/${slug}/${ftSlug}" style="color:#3b82f6;text-decoration:none">${label}</a>`
            : label;
          return `
          <tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${nameCell}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtPrice(t.avg_price)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtPsf(t.avg_psm)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${t.cnt}</td>
          </tr>`;
        }).join('');

        const otherTownLinks = otherTowns.map(t =>
          `<a href="/hdb/${townToSlug(t)}" style="color:#3b82f6;text-decoration:none;white-space:nowrap">${titleCase(t)}</a>`
        ).join(' &middot; ');

        // Cross-link to the private-property districts that overlap this town
        const relatedDistricts = (TOWN_TO_DISTRICTS[town] || [])
          .map(d => DISTRICT_LABELS[d] ? `<a href="/district/${d}" style="color:#3b82f6;text-decoration:none">${DISTRICT_LABELS[d]}</a>` : null)
          .filter(Boolean).join(' &middot; ');

        meta.content_html = `<section id="seo-content" style="padding:2rem 1rem;margin-top:1rem;border-top:1px solid #e5e7eb">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:0.75rem">${townDisplay} HDB Resale Prices — Market Overview</h2>
  <p style="color:#4b5563;margin-bottom:1rem">
    Based on ${txCount.toLocaleString()} transactions in the last 12 months, the average HDB resale price in ${townDisplay} is <strong>${fmtPrice(avgPrice)}</strong> (${fmtPsf(avgPsm)}).${yoyDir && yoyPct > 0 ? ` Prices are <strong>${yoyDir} ${yoyPct}%</strong> year-on-year.` : ''}
  </p>
  ${byType.length > 0 ? `<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Resale Prices by Flat Type in ${townDisplay} (Last 12 Months)</h3>
  <table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-bottom:1.5rem">
    <thead><tr style="background:#f3f4f6">
      <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Flat Type</th>
      <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #e5e7eb">Avg Price</th>
      <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #e5e7eb">Avg PSF</th>
      <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #e5e7eb">Transactions</th>
    </tr></thead>
    <tbody>${typeRows}</tbody>
  </table>` : ''}
  ${relatedDistricts ? `<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Private Property Near ${townDisplay}</h3>
  <p style="font-size:0.9rem;line-height:1.9;margin-bottom:1.5rem">${relatedDistricts}</p>` : ''}
  <h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Compare HDB Resale Prices in Other Towns</h3>
  <p style="font-size:0.875rem;line-height:2">${otherTownLinks}</p>
  ${faqsToHtml(faqs)}
  ${freshnessNote}
</section>`;
      }
    } else if (route.startsWith('/private/')) {
      const slug = route.replace('/private/', '');
      const project = slugToProject(slug);
      if (project && db) {
        const info = db.prepare(`
          SELECT project, street_name, district, market_segment, COUNT(*) as tx_count,
            ROUND(AVG(resale_price)) as avg_price, ROUND(AVG(price_per_sqm), 0) as avg_psm,
            MIN(month) as earliest_month, MAX(month) as latest_month
          FROM transactions WHERE dataset_source = 'URA_PRIVATE' AND project = ?
          GROUP BY project
        `).get(project);
        if (info) {
          const typeRow = db.prepare(`
            SELECT flat_type FROM transactions WHERE dataset_source = 'URA_PRIVATE' AND project = ?
            GROUP BY flat_type ORDER BY COUNT(*) DESC LIMIT 1
          `).get(project);
          const primaryFlatType = typeRow?.flat_type;
          const isEC = primaryFlatType === 'EXECUTIVE CONDOMINIUM';

          // Detect new launch vs resale-after-MOP for ECs:
          // High avg monthly velocity = primary sales (new launch); low = resale market
          const dataMonths = Math.max(1,
            (parseInt(info.latest_month.substring(0, 4)) - parseInt(info.earliest_month.substring(0, 4))) * 12 +
            parseInt(info.latest_month.substring(5, 7)) - parseInt(info.earliest_month.substring(5, 7)) + 1
          );
          const avgTxPerMonth = info.tx_count / dataMonths;
          const isNewLaunch = isEC && avgTxPerMonth > 8;
          const isMOPReached = isEC && !isNewLaunch;
          // Only show MOP year if project started mid-range (not at our 2017-01 data start)
          const mopYear = isMOPReached && info.earliest_month > '2017-03'
            ? parseInt(info.earliest_month.substring(0, 4))
            : null;

          const propertyLabel = isEC ? 'EC' : 'Condo';
          let titleTag = '';
          if (isNewLaunch) titleTag = ' | New EC Launch';
          else if (isMOPReached && mopYear) titleTag = ` | MOP ${mopYear}`;

          meta.title = `${info.project} ${propertyLabel} Resale Price${titleTag} — ${fmtPsf(info.avg_psm)} | WorthIt`;
          meta.description = `${info.project} ${isEC ? 'EC' : 'condo'} resale prices, District ${info.district}${info.market_segment ? ` (${info.market_segment})` : ''}: ${info.tx_count.toLocaleString()} sales, avg ${fmtPrice(info.avg_price)} (${fmtPsf(info.avg_psm)}). URA history & trends.`;
          meta.canonical = `${SEO_BASE_URL}/private/${slug}`;
          meta.og_title = `${info.project} — ${propertyLabel} Resale Prices Singapore`;
          meta.og_description = `${info.tx_count.toLocaleString()} transactions. Average ${fmtPrice(info.avg_price)} (${fmtPsf(info.avg_psm)}).`;

          const faqs = [
            {
              '@type': 'Question',
              name: `What is the resale price of ${info.project}?`,
              acceptedAnswer: { '@type': 'Answer', text: `${info.project} has averaged ${fmtPrice(info.avg_price)} (${fmtPsf(info.avg_psm)}) across ${info.tx_count.toLocaleString()} resale transactions in District ${info.district}, Singapore.` },
            },
          ];

          if (isNewLaunch) {
            faqs.push({
              '@type': 'Question',
              name: `Is ${info.project} a new EC launch?`,
              acceptedAnswer: { '@type': 'Answer', text: `Yes, ${info.project} is a new Executive Condominium (EC) launch in District ${info.district}. EC units are subject to a 5-year Minimum Occupation Period (MOP) before they can be sold on the open resale market.` },
            });
          } else if (isMOPReached) {
            faqs.push({
              '@type': 'Question',
              name: `Has ${info.project} EC reached its MOP?`,
              acceptedAnswer: { '@type': 'Answer', text: `Yes, ${info.project} is an Executive Condominium (EC) that has passed its 5-year Minimum Occupation Period (MOP)${mopYear ? ` around ${mopYear}` : ''}. Units are now available for open market resale, with ${info.tx_count.toLocaleString()} transactions on record.` },
            });
          }

          if (info.market_segment) {
            const regionName = info.market_segment === 'CCR' ? 'Core Central Region' : info.market_segment === 'RCR' ? 'Rest of Central Region' : 'Outside Central Region';
            faqs.push({
              '@type': 'Question',
              name: `Which region is ${info.project} in?`,
              acceptedAnswer: { '@type': 'Answer', text: `${info.project} is in the ${info.market_segment} (${regionName}), District ${info.district}, Singapore.` },
            });
          }

          meta.json_ld = JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebPage',
                name: `${info.project} Resale Prices`,
                description: meta.description,
                url: meta.canonical,
                dateModified,
                breadcrumb: {
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: SEO_BASE_URL + '/' },
                    { '@type': 'ListItem', position: 2, name: `D${info.district}`, item: `${SEO_BASE_URL}/district/${info.district}` },
                    { '@type': 'ListItem', position: 3, name: info.project, item: meta.canonical },
                  ],
                },
                mainEntity: {
                  '@type': 'ResidentialProperty',
                  name: info.project,
                  address: { '@type': 'PostalAddress', streetAddress: info.street_name, addressLocality: 'Singapore' },
                },
              },
              { '@type': 'FAQPage', mainEntity: faqs },
            ],
          });

          const ecBadge = isEC
            ? `<span style="display:inline-block;padding:2px 8px;background:${isNewLaunch ? '#f59e0b' : '#10b981'};color:white;border-radius:4px;font-size:0.75rem;font-weight:600;margin-left:8px">${isNewLaunch ? 'New EC Launch' : `MOP ${mopYear || 'Reached'}`}</span>`
            : '';

          meta.content_html = `<section id="seo-content" style="padding:2rem 1rem;margin-top:1rem;border-top:1px solid #e5e7eb">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:0.75rem">${info.project} — Resale Prices${ecBadge}</h2>
  <p style="color:#4b5563;margin-bottom:1rem">
    <strong>${info.project}</strong>${isEC ? ' Executive Condominium (EC)' : ''} in District ${info.district}${info.market_segment ? ` (${info.market_segment})` : ''}.
    ${info.tx_count.toLocaleString()} transactions recorded, averaging <strong>${fmtPrice(info.avg_price)}</strong> (${fmtPsf(info.avg_psm)}).
    ${isMOPReached && mopYear ? `MOP was reached around ${mopYear} — units are eligible for open market resale.` : ''}
    ${isNewLaunch ? 'New EC launch — units are in primary sale phase and subject to a 5-year MOP before open market resale.' : ''}
  </p>
  <p style="font-size:0.875rem;color:#6b7280">
    Data sourced from URA Singapore. <a href="/district/${info.district}" style="color:#3b82f6;text-decoration:none">View all projects in District ${info.district} &rarr;</a>
  </p>
  ${faqsToHtml(faqs)}
  ${freshnessNote}
</section>`;
        }
      }
    } else if (route.startsWith('/district/')) {
      const dCode = route.replace('/district/', '').padStart(2, '0');
      const label = DISTRICT_LABELS[dCode];
      if (label) {
        const topProjects = db ? db.prepare(`
          SELECT project, flat_type, COUNT(*) as tx_count, ROUND(AVG(price_per_sqm), 0) as avg_psm
          FROM transactions WHERE district = ? AND dataset_source = 'URA_PRIVATE'
          GROUP BY project ORDER BY tx_count DESC LIMIT 6
        `).all(dCode) : [];

        const distSummary = db ? db.prepare(`
          SELECT COUNT(*) as tx_count, ROUND(AVG(price_per_sqm), 0) as avg_psm
          FROM transactions WHERE district = ? AND dataset_source = 'URA_PRIVATE' AND month >= ?
        `).get(dCode, monthsAgoStr(12)) : null;

        const txCount = distSummary?.tx_count || 0;
        const avgPsm = distSummary?.avg_psm || 0;

        meta.title = `${label} — Private Property Resale Prices${avgPsm ? ` ${fmtPsf(avgPsm)} Avg` : ''} | WorthIt`;
        meta.description = `Private property resale prices in ${label}.${txCount > 0 ? ` ${txCount.toLocaleString()} sales in 12 months, avg ${fmtPsf(avgPsm)}.` : ''} Top projects, trends & URA data.`;
        meta.canonical = `${SEO_BASE_URL}/district/${dCode}`;
        meta.og_title = `${label} — Singapore Property Tracker`;
        meta.og_description = `Private property prices and transactions in ${label}.${avgPsm ? ` Avg ${fmtPsf(avgPsm)}.` : ''}`;

        const faqs = [];
        if (avgPsm && txCount > 0) {
          faqs.push({
            '@type': 'Question',
            name: `What is the average private property price in ${label}?`,
            acceptedAnswer: { '@type': 'Answer', text: `The average private property price in ${label} is ${fmtPsf(avgPsm)} based on ${txCount.toLocaleString()} transactions in the past 12 months.` },
          });
        }
        if (topProjects.length > 0) {
          const topNames = topProjects.slice(0, 3).map(p => p.project).join(', ');
          faqs.push({
            '@type': 'Question',
            name: `What are the top projects in ${label}?`,
            acceptedAnswer: { '@type': 'Answer', text: `The most actively transacted projects in ${label} include ${topNames}. Browse full price history and trends for each project on WorthIt.` },
          });
        }

        meta.json_ld = JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              name: `${label} Property Prices`,
              description: meta.description,
              url: meta.canonical,
              dateModified,
              breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: SEO_BASE_URL + '/' },
                  { '@type': 'ListItem', position: 2, name: label, item: meta.canonical },
                ],
              },
            },
            ...(faqs.length > 0 ? [{ '@type': 'FAQPage', mainEntity: faqs }] : []),
          ],
        });

        // Cross-link to the HDB towns that overlap this district
        const relatedTownLinks = (DISTRICT_TO_TOWNS[dCode] || [])
          .map(t => `<a href="/hdb/${townToSlug(t)}" style="color:#3b82f6;text-decoration:none;white-space:nowrap">${titleCase(t)}</a>`)
          .join(' &middot; ');

        const projectRows = topProjects.map(p => {
          const isEC = p.flat_type === 'EXECUTIVE CONDOMINIUM';
          return `<tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">
              <a href="/private/${townToSlug(p.project)}" style="color:#3b82f6;text-decoration:none">${p.project}</a>${isEC ? '<span style="font-size:0.7rem;padding:1px 5px;background:#f3f4f6;border-radius:3px;margin-left:4px">EC</span>' : ''}
            </td>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtPsf(p.avg_psm)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${p.tx_count}</td>
          </tr>`;
        }).join('');

        meta.content_html = `<section id="seo-content" style="padding:2rem 1rem;margin-top:1rem;border-top:1px solid #e5e7eb">
  <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:0.75rem">${label} — Private Property Overview</h2>
  ${txCount > 0 ? `<p style="color:#4b5563;margin-bottom:1rem">${txCount.toLocaleString()} transactions in the last 12 months with an average of <strong>${fmtPsf(avgPsm)}</strong>.</p>` : ''}
  ${topProjects.length > 0 ? `<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">Top Projects in ${label}</h3>
  <table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-bottom:1.5rem">
    <thead><tr style="background:#f3f4f6">
      <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Project</th>
      <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #e5e7eb">Avg PSF</th>
      <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #e5e7eb">Transactions</th>
    </tr></thead>
    <tbody>${projectRows}</tbody>
  </table>` : ''}
  ${relatedTownLinks ? `<h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">HDB Towns in ${label}</h3>
  <p style="font-size:0.9rem;line-height:1.9;margin-bottom:1.5rem">${relatedTownLinks}</p>` : ''}
  ${faqsToHtml(faqs)}
  ${freshnessNote}
</section>`;
      }
    }

    // Soft-404 guard: a deep route that didn't resolve to real data still has the default
    // homepage canonical. Tell crawlers not to index these junk URLs. Only when the DB is
    // available (never deindex valid pages while the DB is mid-refresh).
    const isDeepRoute = /^\/(hdb|private|district|postal)(\/|$)/.test(route);
    if (isDeepRoute && db && meta.canonical === SEO_BASE_URL + '/') {
      meta.robots = 'noindex, follow';
    }

    res.json(meta);
  } catch (err) {
    console.error('Error in /api/seo/metadata:', err);
    res.status(500).json({ error: 'Failed to generate metadata' });
  }
});

// Standalone E-E-A-T content pages (extensionless URLs) — served on Cloudflare via the edge
// function in production; handled here for local dev and the Fly origin.
for (const page of ['about', 'methodology', 'data-sources']) {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', `${page}.html`));
  });
}

// Catch-all: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    if (db) {
      const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
      console.log(`\n🏠 WorthIt Server running at http://localhost:${PORT}`);
      console.log(`   Database has ${count.toLocaleString()} transactions\n`);
    } else {
      console.log(`\n🏠 WorthIt Server running at http://localhost:${PORT}`);
      console.log(`   ⚠️  No database — run download scripts via SSH\n`);
    }
  });
}

module.exports = { app, _test: { median, percentile, trendPct, compressStreetName, expandStreetName, haversineM, dealScore, computeStoreyFactor, monthsBetween } };
