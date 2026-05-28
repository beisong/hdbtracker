'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Minimal stubs so app.js and map.js don't throw on load
function makeBrowserContext() {
  const mockEl = () => ({
    classList: { contains: () => false, add: () => {}, remove: () => {} },
    addEventListener: () => {},
    style: {},
    textContent: '',
    value: '',
    querySelectorAll: () => [],
    querySelector: () => null,
  });

  const ctx = {
    // Browser globals
    window: null,
    document: {
      documentElement: { classList: { contains: () => false, add: () => {}, remove: () => {} } },
      getElementById: () => mockEl(),
      querySelector: () => mockEl(),
      querySelectorAll: () => [],
      addEventListener: () => {},
      title: '',
      head: { querySelector: () => null, appendChild: () => {} },
    },
    navigator: { share: undefined, clipboard: { writeText: () => Promise.resolve() } },
    localStorage: { getItem: () => null, setItem: () => {} },
    history: { pushState: () => {}, replaceState: () => {} },
    location: { href: 'http://localhost/', pathname: '/', search: '' },
    gtag: () => {},
    // Third-party libs (stub them out)
    L: {
      map: () => ({ on: () => {}, setView: () => {}, addLayer: () => {} }),
      tileLayer: () => ({ addTo: () => {} }),
      circleMarker: () => ({ addTo: () => {}, bindPopup: () => {}, on: () => {}, setStyle: () => {}, setRadius: () => {} }),
      layerGroup: () => ({ addTo: () => {}, clearLayers: () => {} }),
      markerClusterGroup: () => ({ addLayer: () => {}, addTo: () => {} }),
      polyline: () => ({ addTo: () => {} }),
      CircleMarker: function() {},
    },
    Chart: function() { return { destroy: () => {}, update: () => {} }; },
    API: {
      getStatus: () => Promise.resolve({}),
      getTowns: () => Promise.resolve({ towns: [], districts: [] }),
      geocodeAddresses: () => Promise.resolve({ results: [] }),
    },
    Charts: {
      initDefaults: () => {},
      renderTrendChart: () => {},
      renderDistributionChart: () => {},
      rerender: () => {},
    },
    // Vitest can see console
    console,
    // Needed by app.js
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise,
    Set: Set,
    Map: Map,
    Array: Array,
    Object: Object,
    Math: Math,
    Date: Date,
    JSON: JSON,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    Number: Number,
    String: String,
    Boolean: Boolean,
    RegExp: RegExp,
    Error: Error,
  };
  ctx.window = ctx;
  return ctx;
}

let App, TransactionMap, ctx;

beforeAll(() => {
  ctx = vm.createContext(makeBrowserContext());

  // Load map.js — append globalThis assignment to expose const TransactionMap
  const mapSrc = fs.readFileSync(path.join(__dirname, '../../public/js/map.js'), 'utf8');
  vm.runInContext(mapSrc + '\nglobalThis.TransactionMap = TransactionMap;', ctx);
  TransactionMap = ctx.TransactionMap;

  // Load app.js — append globalThis assignment to expose const App
  const appSrc = fs.readFileSync(path.join(__dirname, '../../public/js/app.js'), 'utf8');
  vm.runInContext(appSrc + '\nglobalThis.App = App;', ctx);
  App = ctx.App;
});

// ─── App.formatNumber ──────────────────────────────────────────────────────
describe('App.formatNumber', () => {
  it('returns "--" for null', () => expect(App.formatNumber(null)).toBe('--'));
  it('returns "--" for undefined', () => expect(App.formatNumber(undefined)).toBe('--'));
  it('formats 500000 with commas', () => expect(App.formatNumber(500000)).toBe('500,000'));
  it('rounds 1234.7 to 1235', () => expect(App.formatNumber(1234.7)).toBe('1,235'));
  it('formats 0 as "0"', () => expect(App.formatNumber(0)).toBe('0'));
});

// ─── App.formatMonth ──────────────────────────────────────────────────────
describe('App.formatMonth', () => {
  it('returns "--" for null', () => expect(App.formatMonth(null)).toBe('--'));
  it('returns "--" for empty string', () => expect(App.formatMonth('')).toBe('--'));
  it('formats Jan 2025', () => expect(App.formatMonth('2025-01')).toBe('Jan 2025'));
  it('formats Dec 2024', () => expect(App.formatMonth('2024-12')).toBe('Dec 2024'));
  it('formats Jun 2023', () => expect(App.formatMonth('2023-06')).toBe('Jun 2023'));
});

// ─── App.estimateBedrooms ─────────────────────────────────────────────────
describe('App.estimateBedrooms', () => {
  it('returns "--" for null area', () => expect(App.estimateBedrooms(null, 'APARTMENT')).toBe('--'));
  it('returns "--" for NaN area', () => expect(App.estimateBedrooms('abc', 'APARTMENT')).toBe('--'));
  it('Studio for area < 45', () => expect(App.estimateBedrooms(40, 'APARTMENT')).toBe('Studio'));
  it('1-bed for area 45-64', () => expect(App.estimateBedrooms(60, 'CONDOMINIUM')).toBe('1-bed'));
  it('2-bed for area 65-84', () => expect(App.estimateBedrooms(80, 'APARTMENT')).toBe('2-bed'));
  it('3-bed for area 85-109', () => expect(App.estimateBedrooms(100, 'CONDOMINIUM')).toBe('3-bed'));
  it('Penthouse for area >= 180', () => expect(App.estimateBedrooms(200, 'APARTMENT')).toBe('Penthouse'));
  // Landed path
  it('2-bed for landed area < 100', () => expect(App.estimateBedrooms(90, 'TERRACE')).toBe('2-bed'));
  it('3-bed for landed area 100-149', () => expect(App.estimateBedrooms(120, 'SEMI-DETACHED')).toBe('3-bed'));
  it('5-bed for landed area 200-299', () => expect(App.estimateBedrooms(250, 'DETACHED')).toBe('5-bed'));
});

// ─── TransactionMap.getLeaseTier ──────────────────────────────────────────
describe('TransactionMap.getLeaseTier', () => {
  it('≥95 years → "fresh"', () => expect(TransactionMap.getLeaseTier(99)).toBe('fresh'));
  it('exactly 95 → "fresh"', () => expect(TransactionMap.getLeaseTier(95)).toBe('fresh'));
  it('94 → "newer"', () => expect(TransactionMap.getLeaseTier(94)).toBe('newer'));
  it('≥75 → "newer"', () => expect(TransactionMap.getLeaseTier(80)).toBe('newer'));
  it('exactly 75 → "newer"', () => expect(TransactionMap.getLeaseTier(75)).toBe('newer'));
  it('74 → "older"', () => expect(TransactionMap.getLeaseTier(74)).toBe('older'));
  it('0 → "older"', () => expect(TransactionMap.getLeaseTier(0)).toBe('older'));
});

// ─── TransactionMap.shortType ─────────────────────────────────────────────
describe('TransactionMap.shortType', () => {
  it('"CONDOMINIUM" → "Condo"', () => expect(TransactionMap.shortType('CONDOMINIUM')).toBe('Condo'));
  it('"APARTMENT" → "Apt"', () => expect(TransactionMap.shortType('APARTMENT')).toBe('Apt'));
  it('"3 ROOM" → "3RM"', () => expect(TransactionMap.shortType('3 ROOM')).toBe('3RM'));
  it('"EXECUTIVE" → "Exec"', () => expect(TransactionMap.shortType('EXECUTIVE')).toBe('Exec'));
  it('"EXECUTIVE CONDOMINIUM" → "EC"', () => expect(TransactionMap.shortType('EXECUTIVE CONDOMINIUM')).toBe('EC'));
  it('"SEMI-DETACHED" → "Semi-D"', () => expect(TransactionMap.shortType('SEMI-DETACHED')).toBe('Semi-D'));
  it('unknown type returned as-is', () => expect(TransactionMap.shortType('UNKNOWN TYPE')).toBe('UNKNOWN TYPE'));
  it('empty string returned as-is', () => expect(TransactionMap.shortType('')).toBe(''));
});

// ─── TransactionMap.getValueStyle ─────────────────────────────────────────
describe('TransactionMap.getValueStyle', () => {
  it('medianPsm=0 → default blue, radius 7', () => {
    const s = TransactionMap.getValueStyle(5000, 0);
    expect(s.color).toBe('#60a5fa');
    expect(s.radius).toBe(7);
  });

  it('ratio=1.0 (fair) → blue-ish color', () => {
    const s = TransactionMap.getValueStyle(5000, 5000);
    // Blue: rgb(96, 165, 250)
    expect(s.color).toBe('rgb(96, 165, 250)');
  });

  it('ratio < 0.70 (great deal) → fully green', () => {
    const s = TransactionMap.getValueStyle(3000, 5000); // ratio=0.6, clamped to 0.70 → t=0 → pure green
    expect(s.color).toBe('rgb(34, 197, 94)');
    expect(s.radius).toBeGreaterThanOrEqual(8); // big marker for good deal
  });

  it('ratio > 1.30 (overpriced) → fully red', () => {
    const s = TransactionMap.getValueStyle(8000, 5000); // ratio=1.6, clamped to 1.30 → t=1 → pure red
    expect(s.color).toBe('rgb(239, 68, 68)');
    expect(s.radius).toBeLessThanOrEqual(6); // small marker for overpriced
  });

  it('radius is always in range [5, 9]', () => {
    for (const ratio of [0.5, 0.7, 0.85, 1.0, 1.15, 1.30, 1.5]) {
      const s = TransactionMap.getValueStyle(5000 * ratio, 5000);
      expect(s.radius).toBeGreaterThanOrEqual(5);
      expect(s.radius).toBeLessThanOrEqual(9);
    }
  });
});

// ─── App.sqmToSqft ────────────────────────────────────────────────────────
describe('App.sqmToSqft', () => {
  it('returns "--" for null', () => expect(App.sqmToSqft(null)).toBe('--'));
  it('returns "--" for 0', () => expect(App.sqmToSqft(0)).toBe('--'));
  it('converts 100 sqm to 1076 sqft', () => expect(App.sqmToSqft(100)).toBe(1076));
  it('converts 65 sqm to 700 sqft', () => expect(App.sqmToSqft(65)).toBe(700));
  it('converts string input', () => expect(App.sqmToSqft('90')).toBe(969));
});

// ─── App.psmToPsf ─────────────────────────────────────────────────────────
describe('App.psmToPsf', () => {
  it('returns null for null', () => expect(App.psmToPsf(null)).toBeNull());
  it('returns null for 0', () => expect(App.psmToPsf(0)).toBeNull());
  it('converts 10764 psm to 1000 psf', () => expect(App.psmToPsf(10764)).toBe(1000));
  it('converts 5000 psm to 465 psf', () => expect(App.psmToPsf(5000)).toBe(465));
  it('converts string input', () => expect(App.psmToPsf('10764')).toBe(1000));
});

// ─── Geocode address cap (client-server contract) ──────────────────────────
// These tests guard the invariant: the client must never send more than 100
// addresses to /api/geocode (the server rejects >100 with HTTP 400).
// A violation causes silent map failure — the bug that shipped in commit 082d253.
describe('TransactionMap.load — geocode address cap', () => {
  function makeTx(i) {
    return { block: String(i + 1), street_name: `STREET ${i + 1}`, month: '2025-01', resale_price: 500000, price_per_sqm: 5000 };
  }

  it('sends ≤ 100 addresses even when given 150 unique-address transactions', async () => {
    let capturedAddresses = null;
    ctx.API.geocodeAddresses = (addresses) => {
      capturedAddresses = addresses;
      throw new Error('spy stop');
    };
    const transactions = Array.from({ length: 150 }, (_, i) => makeTx(i));
    await TransactionMap.load(transactions, {});
    expect(capturedAddresses).not.toBeNull();
    expect(capturedAddresses.length).toBeLessThanOrEqual(100);
  });
});

describe('TransactionMap.addNearbyHDB — geocode address cap', () => {
  function makeTx(i) {
    return { block: String(i + 1), street_name: `STREET ${i + 1}`, month: '2025-01', resale_price: 500000, price_per_sqm: 5000, flat_type: '4 ROOM', floor_area_sqm: 90, storey_range: '07 TO 09' };
  }

  it('sends ≤ 100 addresses even when given 150 unique-address transactions', async () => {
    let capturedAddresses = null;
    ctx.API.geocodeAddresses = (addresses) => {
      capturedAddresses = addresses;
      throw new Error('spy stop');
    };
    TransactionMap.map = { on: () => {}, setView: () => {}, addLayer: () => {}, getBounds: () => ({ extend: () => {} }), fitBounds: () => {} };
    const transactions = Array.from({ length: 150 }, (_, i) => makeTx(i));
    await TransactionMap.addNearbyHDB(transactions);
    expect(capturedAddresses).not.toBeNull();
    expect(capturedAddresses.length).toBeLessThanOrEqual(100);
  });
});
