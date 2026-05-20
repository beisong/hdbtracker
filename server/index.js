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

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(cors());
app.use(express.json());

// Open database
const DB_PATH = path.join(__dirname, 'db', 'hdb_resale.db');
let db;

try {
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = WAL');
  console.log(`✅ Connected to database: ${DB_PATH}`);
} catch (err) {
  console.error(`❌ Failed to open database: ${err.message}`);
  console.error(`   Run "npm run download" first to download data.`);
  process.exit(1);
}

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

/**
 * GET /api/towns — List all towns
 */
app.get('/api/towns', (req, res) => {
  try {
    const towns = db.prepare(`
      SELECT DISTINCT town FROM transactions ORDER BY town
    `).all().map(r => r.town);
    res.json({ towns });
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
  const townUpper = town.toUpperCase();

  // Helper: try a pattern against the DB
  const tryMatch = (pattern) => {
    if (!pattern) return [];
    const likePattern = '%' + pattern.replace(/\s+/g, '%') + '%';
    return db.prepare(`
      SELECT DISTINCT street_name FROM transactions
      WHERE town = ? AND UPPER(street_name) LIKE ?
    `).all(townUpper, likePattern).map(r => r.street_name);
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
 * GET /api/area-overview — Main endpoint for area market overview
 */
app.get('/api/area-overview', (req, res) => {
  try {
    const { town, flat_type, street } = req.query;
    if (!town) return res.status(400).json({ error: 'Missing town parameter' });

    const townUpper = town.toUpperCase();
    const flatTypeFilter = flat_type && flat_type !== 'ALL' ? flat_type.toUpperCase() : null;
    const streetFilter = street || null;

    // Build street filter clause
    let streetNames = [];
    if (streetFilter) {
      streetNames = findDbStreets(streetFilter, townUpper);
      console.log(`[area-overview] street filter: "${streetFilter}" → matched ${streetNames.length} streets: ${streetNames.slice(0, 5).join(', ')}`);
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
    if (flatTypeFilter) { pricesByTypeQuery += ' AND flat_type = ?'; pricesByTypeParams.push(flatTypeFilter); }
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
    if (flatTypeFilter) { townSummaryQuery += ' AND flat_type = ?'; townSummaryParams.push(flatTypeFilter); }
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
    if (flatTypeFilter) { priceQuery += ' AND flat_type = ?'; priceParams.push(flatTypeFilter); }
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
    if (flatTypeFilter) {
      trendQuery += ' AND flat_type = ?';
      trendParams.push(flatTypeFilter);
    }
    trendQuery += ' GROUP BY month ORDER BY month ASC';
    const trendData = db.prepare(trendQuery).all(...trendParams);

    // Calculate trend direction
    let priceTrend = { '6m_change': 0, '1y_change': 0, '3y_change': 0, '5y_change': 0, direction: 'stable' };
    if (trendData.length >= 2) {
      const monthsAgo6 = monthsAgoStr(6);
      const monthsAgo12m = monthsAgoStr(12);
      const monthsAgo36 = monthsAgoStr(36);

      const recent6m = trendData.filter(m => m.month >= monthsAgo6);
      const recent12m = trendData.filter(m => m.month >= monthsAgo12m);
      const recent36m = trendData.filter(m => m.month >= monthsAgo36);

      if (recent6m.length >= 2) {
        const first = recent6m[0].median_price;
        const last = recent6m[recent6m.length - 1].median_price;
        priceTrend['6m_change'] = Math.round((last - first) / first * 1000) / 10;
      }
      if (recent12m.length >= 2) {
        const first = recent12m[0].median_price;
        const last = recent12m[recent12m.length - 1].median_price;
        priceTrend['1y_change'] = Math.round((last - first) / first * 1000) / 10;
      }
      if (recent36m.length >= 2) {
        const first = recent36m[0].median_price;
        const last = recent36m[recent36m.length - 1].median_price;
        priceTrend['3y_change'] = Math.round((last - first) / first * 1000) / 10;
      }
      if (trendData.length >= 2) {
        const first = trendData[0].median_price;
        const last = trendData[trendData.length - 1].median_price;
        priceTrend['5y_change'] = Math.round((last - first) / first * 1000) / 10;
      }

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
    if (flatTypeFilter) { txQuery += ' AND flat_type = ?'; txParams.push(flatTypeFilter); }
    if (streetClause) { txQuery += streetClause; txParams.push(...streetNames); }
    txQuery += ' ORDER BY month DESC, resale_price DESC LIMIT 200';
    const recentTransactions = db.prepare(txQuery).all(...txParams);

    res.json({
      town: townUpper,
      flat_type: flatTypeFilter || 'ALL',
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

// In-memory geocode cache: "BLOCK STREET_NAME" → { lat, lng }
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
          headers: { 'User-Agent': 'WorthOrNot/1.0 (HDB resale app)' },
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
 * GET /api/status — Check if database is ready
 */
app.get('/api/status', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
    const latestMonth = db.prepare('SELECT MAX(month) as m FROM transactions').get().m;
    res.json({ status: 'ok', total_transactions: count, latest_month: latestMonth });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Catch-all: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
  console.log(`\n🏠 WorthOrNot Server running at http://localhost:${PORT}`);
  console.log(`   Database has ${count.toLocaleString()} transactions\n`);
});