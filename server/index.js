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
} catch (err) {
  console.warn(`⚠️  Database not found at ${DB_PATH}`);
  console.warn(`   Run download scripts via SSH to populate it.`);
  console.warn(`   Server will start but API endpoints will return errors until DB is ready.`);
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
      // Town name — fuzzy match
      const towns = db.prepare('SELECT DISTINCT town FROM transactions').all().map(r => r.town);
      const inputUpper = input.toUpperCase();

      // Exact match
      if (towns.includes(inputUpper)) {
        return res.json({ resolved: true, input, town: inputUpper });
      }

      // Partial match
      const matches = towns.filter(t =>
        t.includes(inputUpper) || inputUpper.includes(t)
      );
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
 * GET /api/nearby-streets — Find nearby DB streets using Nominatim reverse geocoding
 */
app.get('/api/nearby-streets', async (req, res) => {
  try {
    const { lat, lng, town } = req.query;
    if (!lat || !lng || !town) {
      return res.status(400).json({ error: 'Missing lat, lng, or town parameter' });
    }
    const streets = await findNearbyStreets(parseFloat(lat), parseFloat(lng), town);
    res.json({ streets, town, lat: parseFloat(lat), lng: parseFloat(lng) });
  } catch (err) {
    console.error('Error in /api/nearby-streets:', err);
    res.status(500).json({ error: 'Failed to find nearby streets: ' + err.message });
  }
});

/**
 * GET /api/area-overview — Main endpoint for area market overview
 */
app.get('/api/area-overview', (req, res) => {
  try {
    const { town, flat_type, street, streets } = req.query;
    if (!town) return res.status(400).json({ error: 'Missing town parameter' });

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

    // Build street filter — support both single street name or pre-resolved list
    let streetNames = [];
    if (streets) {
      // Comma-separated list of DB street names (from nearby-streets)
      streetNames = streets.split(',').map(s => s.trim()).filter(s => s.length > 0);
      console.log(`[area-overview] pre-resolved streets: ${streetNames.length} streets: ${streetNames.slice(0, 5).join(', ')}`);
    } else if (street) {
      streetNames = findDbStreets(street, townUpper);
      console.log(`[area-overview] street filter: "${street}" → matched ${streetNames.length} streets: ${streetNames.slice(0, 5).join(', ')}`);
    }

    const streetClause = streetNames.length > 0
      ? ` AND street_name IN (${streetNames.map(() => '?').join(',')})`
      : '';

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
    if (streetClause) { pricesByTypeQuery += streetClause; pricesByTypeParams.push(...streetNames); }
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
    if (streetClause) { townSummaryQuery += streetClause; townSummaryParams.push(...streetNames); }
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
    if (streetClause) { priceQuery += streetClause; priceParams.push(...streetNames); }
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

    // Calculate trend direction — compare 3-month rolling avg at start vs end of each window
    let priceTrend = { '6m_change': 0, '1y_change': 0, '3y_change': 0, '5y_change': 0, direction: 'stable' };
    if (trendData.length >= 2) {
      const monthsAgo6 = monthsAgoStr(6);
      const monthsAgo12m = monthsAgoStr(12);
      const monthsAgo36 = monthsAgoStr(36);

      const recent6m = trendData.filter(m => m.month >= monthsAgo6);
      const recent12m = trendData.filter(m => m.month >= monthsAgo12m);
      const recent36m = trendData.filter(m => m.month >= monthsAgo36);

      priceTrend['6m_change'] = trendPct(recent6m, 'median_price');
      priceTrend['1y_change'] = trendPct(recent12m, 'median_price');
      priceTrend['3y_change'] = trendPct(recent36m, 'median_price');
      priceTrend['5y_change'] = trendPct(trendData, 'median_price');

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
    let txQuery = `
      SELECT month, town, flat_type, block, street_name, storey_range,
             floor_area_sqm, flat_model, remaining_lease_years, resale_price, price_per_sqm
      FROM transactions
      WHERE town = ? AND resale_price IS NOT NULL
    `;
    const txParams = [townUpper];
    txQuery = addFlatClause(txQuery, txParams);
    if (streetClause) { txQuery += streetClause; txParams.push(...streetNames); }
    txQuery += ' ORDER BY month DESC, resale_price DESC LIMIT 200';
    const recentTransactions = db.prepare(txQuery).all(...txParams);

    res.json({
      town: townUpper,
      flat_type: flatTypeList.length > 0 ? flatTypeList.join(',') : 'ALL',
      street_filtered: streetNames.length > 0,
      street_names: streetNames,
      data_as_of: latestMonth,
      prices_by_type: pricesByType,
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
const nearbyStreetsCache = new Map(); // "lat,lng" → { streets: [...], timestamp }

// Find nearby streets by reverse-geocoding 8 compass points at ~200m radius via Nominatim
async function findNearbyStreets(lat, lng, town) {
  const cacheKey = `${lat},${lng}`;
  const cached = nearbyStreetsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 86400000) { // 24 hour cache
    return cached.streets;
  }

  const townUpper = town ? town.toUpperCase() : null;
  // 200m in degrees: ~0.0018 lat, ~0.00184 lng at Singapore's latitude
  const offset = 0.0018;
  const offsetLng = 0.00184;
  const diagLat = offset / Math.SQRT2;
  const diagLng = offsetLng / Math.SQRT2;

  const directions = [
    { label: 'N',  dlat: offset,   dlng: 0 },
    { label: 'NE', dlat: diagLat,  dlng: diagLng },
    { label: 'E',  dlat: 0,        dlng: offsetLng },
    { label: 'SE', dlat: -diagLat, dlng: diagLng },
    { label: 'S',  dlat: -offset,  dlng: 0 },
    { label: 'SW', dlat: -diagLat, dlng: -diagLng },
    { label: 'W',  dlat: 0,        dlng: -offsetLng },
    { label: 'NW', dlat: diagLat,  dlng: -diagLng },
  ];

  // Run all 9 reverse geocodes in parallel (8 directions + center)
  const allPoints = [
    { label: 'center', dlat: 0, dlng: 0 },
    ...directions,
  ];
  const results = await Promise.all(
    allPoints.map(async (pt) => {
      try {
        const rlat = (lat + pt.dlat).toFixed(6);
        const rlng = (lng + pt.dlng).toFixed(6);
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${rlat}&lon=${rlng}&format=json&zoom=18`;
        const resp = await fetch(url, {
          timeout: 8000,
          headers: { 'User-Agent': 'WorthIt/1.0 (HDB resale app)' },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data.address?.road || null;
      } catch (err) {
        return null;
      }
    })
  );
  const roadNames = new Set(results.filter(Boolean));

  // Match each road name to DB street names
  const matchedStreets = new Set();
  for (const road of roadNames) {
    const dbMatches = findDbStreets(road, townUpper);
    for (const s of dbMatches) {
      matchedStreets.add(s);
    }
  }

  const result = [...matchedStreets].slice(0, 5);
  nearbyStreetsCache.set(cacheKey, { streets: result, timestamp: Date.now() });
  console.log(`[nearby-streets] lat=${lat} lng=${lng} town=${town} → ${roadNames.size} Nominatim roads → ${result.length} DB matches: ${result.join(', ')}`);
  return result;
}

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

    const monthsAgo12 = monthsAgoStr(12);
    const monthsAgo60 = monthsAgoStr(60);

    // Build property type filter
    const propTypeFilter = property_type ? ` AND flat_type = '${property_type.toUpperCase()}'` : '';

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
    `).get(project);

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
    `).all(project, monthsAgo12);

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
    `).all(project, monthsAgo60);

    // Calculate trend
    let priceTrend = { '6m_change': 0, '1y_change': 0, '3y_change': 0, direction: 'stable' };
    if (trendData.length >= 2) {
      const monthsAgo6 = monthsAgoStr(6);
      const monthsAgo12m = monthsAgoStr(12);
      const monthsAgo36 = monthsAgoStr(36);

      const recent6m = trendData.filter(m => m.month >= monthsAgo6);
      const recent12m = trendData.filter(m => m.month >= monthsAgo12m);
      const recent36m = trendData.filter(m => m.month >= monthsAgo36);

      priceTrend['6m_change'] = trendPct(recent6m, 'avg_price');
      priceTrend['1y_change'] = trendPct(recent12m, 'avg_price');
      priceTrend['3y_change'] = trendPct(recent36m, 'avg_price');

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
    `).all(project);

    // Price distribution (last 12 months)
    const allPrices = db.prepare(`
      SELECT resale_price FROM transactions
      WHERE dataset_source = 'URA_PRIVATE' AND project = ? AND month >= ? ${propTypeFilter}
      ORDER BY resale_price ASC LIMIT 5000
    `).all(project, monthsAgo12).map(r => r.resale_price);

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

    const districtList = districts.split(',').map(d => d.trim()).filter(d => d.length > 0);
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

      priceTrend['6m_change'] = trendPct(recent6m, 'avg_price');
      priceTrend['1y_change'] = trendPct(recent12m, 'avg_price');
      priceTrend['3y_change'] = trendPct(recent36m, 'avg_price');
      priceTrend['5y_change'] = trendPct(trendData, 'avg_price');

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
      price_percentiles: pricePercentiles,
      distribution: { bins, counts },
      recent_transactions: recentTransactions,
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

    // 1. Reverse geocode to get road names via Nominatim
    const nearbyStreets = await findNearbyStreets(latF, lngF, null);

    if (!nearbyStreets || nearbyStreets.length === 0) {
      return res.json({ transactions: [], streets: [] });
    }

    // 2. Find which town(s) these streets belong to
    const streetClause = nearbyStreets.map(() => '?').join(',');
    const townRow = db.prepare(`
      SELECT DISTINCT town FROM transactions
      WHERE dataset_source != 'URA_PRIVATE'
        AND street_name IN (${streetClause})
      LIMIT 1
    `).get(...nearbyStreets);

    if (!townRow) {
      return res.json({ transactions: [], streets: nearbyStreets });
    }

    const town = townRow.town;
    const monthsAgo12 = monthsAgoStr(12);

    // 3. Get HDB transactions for those streets, last 12 months
    const transactions = db.prepare(`
      SELECT month, town, flat_type, block, street_name, storey_range,
             floor_area_sqm, flat_model, remaining_lease_years, resale_price, price_per_sqm
      FROM transactions
      WHERE dataset_source != 'URA_PRIVATE'
        AND town = ?
        AND street_name IN (${streetClause})
        AND resale_price IS NOT NULL
        AND month >= ?
      ORDER BY month DESC, resale_price DESC
      LIMIT 200
    `).all(town, ...nearbyStreets, monthsAgo12);

    // 4. Also get nearby private projects from project_coords
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
      LIMIT 20
    `).all(
      latF - 0.005, latF + 0.005,
      lngF - 0.0055, lngF + 0.0055
    );

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

    res.json({ transactions, streets: nearbyStreets, town, nearby_projects: nearbyProjects });
  } catch (err) {
    console.error('Error in /api/nearby-hdb:', err);
    res.status(500).json({ error: 'Failed to get nearby HDB: ' + err.message });
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

function titleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0) + w.slice(1).toLowerCase());
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

    const urls = [{ url: SEO_BASE_URL + '/', changefreq: 'weekly', priority: '1.0' }];

    // HDB towns
    const towns = db.prepare("SELECT DISTINCT town FROM transactions WHERE dataset_source != 'URA_PRIVATE' ORDER BY town").all();
    for (const t of towns) {
      urls.push({
        url: `${SEO_BASE_URL}/hdb/${townToSlug(t.town)}`,
        changefreq: 'weekly',
        priority: '0.9',
      });
    }

    // District pages
    for (const d of Object.keys(DISTRICT_LABELS)) {
      urls.push({
        url: `${SEO_BASE_URL}/district/${d}`,
        changefreq: 'weekly',
        priority: '0.8',
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

    let meta = {
      title: 'WorthIt — Singapore HDB Resale Prices & Property Transaction Checker',
      description: 'Check HDB resale prices, property transaction history, and fair value estimates for Singapore flats and condos. Analyze 370K+ transactions from data.gov.sg with price trends, distributions, and Deal Scores.',
      canonical: SEO_BASE_URL + '/',
      og_title: 'WorthIt — Singapore HDB & Condo Resale Price Tracker',
      og_description: 'Check HDB resale prices, condo transaction history, and fair market value for any Singapore property. Free tool powered by data.gov.sg.',
      json_ld: null,
    };

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
                  text: 'A fair HDB price depends on town, flat type, floor level, remaining lease, and recent transactions. WorthIt shows price percentiles (10th to 90th), price per sqm benchmarks, and Deal Scores to help you assess fair value against comparable sales.',
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
                  text: 'Search any private property or condo project name on WorthIt to view resale transaction prices, price per sqm, unit mix, and market segment (CCR/RCR/OCR) data sourced from URA records.',
                },
              },
              {
                '@type': 'Question',
                name: 'What is the Deal Score for HDB flats?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Deal Score compares a transaction\'s price per sqm against similar flats (same type and remaining lease) in the same area. Green markers indicate good value, while red indicates premium pricing. This helps buyers quickly assess whether a listing is fairly priced.',
                },
              },
            ],
          },
        ],
      });
    } else if (route.startsWith('/hdb/')) {
      const slug = route.replace('/hdb/', '');
      const town = slugToTown(slug);
      if (town && db) {
        const townDisplay = titleCase(town);
        const monthsAgo12 = monthsAgoStr(12);
        const summary = db.prepare(`
          SELECT COUNT(*) as tx_count, ROUND(AVG(resale_price)) as avg_price, ROUND(AVG(price_per_sqm), 0) as avg_psm
          FROM transactions WHERE town = ? AND resale_price IS NOT NULL AND month >= ? AND dataset_source != 'URA_PRIVATE'
        `).get(town, monthsAgo12);
        const txCount = summary?.tx_count || 0;
        const avgPrice = summary?.avg_price || 0;

        meta.title = `${townDisplay} HDB Resale Prices & Transaction History in Singapore | WorthIt`;
        meta.description = `Check ${townDisplay} HDB resale flat prices, past transaction history, and fair market value. ${txCount.toLocaleString()} recent transactions with average price $${Math.round(avgPrice).toLocaleString()}. Compare Deal Scores from data.gov.sg records for ${townDisplay} Singapore.`;
        meta.canonical = `${SEO_BASE_URL}/hdb/${slug}`;
        meta.og_title = `${townDisplay} HDB Resale Prices — Singapore Property Tracker`;
        meta.og_description = `${txCount.toLocaleString()} recent HDB transactions in ${townDisplay}. Check prices, trends, and fair value.`;
        meta.json_ld = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `${townDisplay} HDB Resale Prices`,
          description: meta.description,
          url: meta.canonical,
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: SEO_BASE_URL + '/' },
              { '@type': 'ListItem', position: 2, name: `${townDisplay} HDB`, item: meta.canonical },
            ],
          },
          mainEntity: {
            '@type': 'ResidentialProperty',
            name: `${townDisplay} HDB Estate`,
            address: { '@type': 'PostalAddress', addressLocality: townDisplay, addressRegion: 'Singapore' },
          },
        });
      }
    } else if (route.startsWith('/private/')) {
      const slug = route.replace('/private/', '');
      const project = slugToProject(slug);
      if (project && db) {
        const info = db.prepare(`
          SELECT project, street_name, district, market_segment, COUNT(*) as tx_count, ROUND(AVG(resale_price)) as avg_price
          FROM transactions WHERE dataset_source = 'URA_PRIVATE' AND project = ?
          GROUP BY project
        `).get(project);
        if (info) {
          meta.title = `${info.project} Resale Transaction Prices Singapore | WorthIt`;
          meta.description = `View ${info.project} resale transaction prices and history in Singapore. ${info.tx_count.toLocaleString()} transactions in District ${info.district} (${info.market_segment || 'Singapore'}). Check fair value, price trends, and URA transaction data.`;
          meta.canonical = `${SEO_BASE_URL}/private/${slug}`;
          meta.og_title = `${info.project} — Singapore Condo Price Tracker`;
          meta.og_description = `${info.tx_count.toLocaleString()} transactions. Check ${info.project} resale prices and trends.`;
          meta.json_ld = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${info.project} Resale Prices`,
            description: meta.description,
            url: meta.canonical,
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SEO_BASE_URL + '/' },
                { '@type': 'ListItem', position: 2, name: info.project, item: meta.canonical },
              ],
            },
            mainEntity: {
              '@type': 'ResidentialProperty',
              name: info.project,
              address: { '@type': 'PostalAddress', streetAddress: info.street_name, addressLocality: 'Singapore' },
            },
          });
        }
      }
    } else if (route.startsWith('/district/')) {
      const dCode = route.replace('/district/', '').padStart(2, '0');
      const label = DISTRICT_LABELS[dCode];
      if (label) {
        meta.title = `${label} — Private Property Resale Prices Singapore | WorthIt`;
        meta.description = `Check private property resale prices and transaction history in Singapore ${label}. View top projects, price trends, and URA transaction data for District ${dCode}.`;
        meta.canonical = `${SEO_BASE_URL}/district/${dCode}`;
        meta.og_title = `${label} — Singapore Property Tracker`;
        meta.og_description = `Private property prices and transactions in ${label}.`;
        meta.json_ld = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `${label} Property Prices`,
          description: meta.description,
          url: meta.canonical,
        });
      }
    }

    res.json(meta);
  } catch (err) {
    console.error('Error in /api/seo/metadata:', err);
    res.status(500).json({ error: 'Failed to generate metadata' });
  }
});

// Catch-all: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
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
