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

let App, TransactionMap, MrtNearest, ctx;

beforeAll(() => {
  ctx = vm.createContext(makeBrowserContext());

  // Load map.js — append globalThis assignment to expose const TransactionMap
  const mapSrc = fs.readFileSync(path.join(__dirname, '../../public/js/map.js'), 'utf8');
  vm.runInContext(mapSrc + '\nglobalThis.TransactionMap = TransactionMap; globalThis.MrtNearest = MrtNearest;', ctx);
  TransactionMap = ctx.TransactionMap;
  MrtNearest = ctx.MrtNearest;

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

// ─── TransactionMap.load plots only transactions that carry coords ─────────
describe('TransactionMap.load — no geocoding fallback', () => {
  it('renders only transactions with lat/lng and never calls the network', async () => {
    let rendered = null;
    const origRender = TransactionMap.render;
    TransactionMap.render = (markerData) => { rendered = markerData; };
    try {
      const txs = [
        { block: '1', street_name: 'A ST', lat: 1.3, lng: 103.8 },
        { block: '2', street_name: 'B ST' },
        { block: '3', street_name: 'C ST', lat: 1.31, lng: 103.81 },
      ];
      await TransactionMap.load(txs, {});
      expect(rendered.map(t => t.block)).toEqual(['1', '3']);
    } finally {
      TransactionMap.render = origRender;
    }
  });
});

describe('TransactionMap.addNearbyHDB — pre-attached coords (no geocoding)', () => {
  // Transactions carry lat/lng from the server.
  function makeTx(i) {
    return {
      block: String(i + 1), street_name: `STREET ${Math.floor(i / 5) + 1}`,
      month: '2025-01', resale_price: 500000, price_per_sqm: 5000,
      flat_type: '4 ROOM', floor_area_sqm: 90, storey_range: '07 TO 09',
      lat: 1.3 + i * 0.0001, lng: 103.8 + i * 0.0001,
    };
  }

  it('uses coords attached to transactions', () => {
    TransactionMap.map = { on: () => {}, setView: () => {}, addLayer: () => {}, getBounds: () => ({ extend: () => {} }), fitBounds: () => {} };
    const transactions = Array.from({ length: 10 }, (_, i) => makeTx(i));
    expect(() => TransactionMap.addNearbyHDB(transactions)).not.toThrow();
  });

  it('caps at 200 transactions even when given more', () => {
    const addedMarkers = [];
    TransactionMap.map = {
      on: () => {}, setView: () => {}, addLayer: () => {},
      getBounds: () => ({ extend: () => {} }), fitBounds: () => {},
    };
    // Patch circleMarker to count how many markers are created
    const origCircleMarker = ctx.L.circleMarker;
    ctx.L.circleMarker = (...args) => {
      const m = origCircleMarker(...args);
      addedMarkers.push(m);
      return m;
    };
    // 250 transactions, all with coords
    const transactions = Array.from({ length: 250 }, (_, i) => makeTx(i));
    TransactionMap.addNearbyHDB(transactions);
    ctx.L.circleMarker = origCircleMarker;
    // At most 200 transactions fed into address groups → at most 200 markers
    expect(addedMarkers.length).toBeLessThanOrEqual(200);
  });
});

// ─── App.parsePrice ──────────────────────────────────────────────────────
describe('App.parsePrice', () => {
  it('parses a plain number', () => expect(App.parsePrice('685000')).toBe(685000));
  it('parses commas and dollar sign', () => expect(App.parsePrice('$685,000')).toBe(685000));
  it('parses k shorthand', () => expect(App.parsePrice('685k')).toBe(685000));
  it('parses decimal k shorthand', () => expect(App.parsePrice('685.5k')).toBe(685500));
  it('parses m shorthand', () => expect(App.parsePrice('0.685m')).toBe(685000));
  it('is case-insensitive and ignores spaces', () => expect(App.parsePrice(' 685 K ')).toBe(685000));
  it('returns null for empty input', () => expect(App.parsePrice('')).toBe(null));
  it('returns null for garbage', () => expect(App.parsePrice('abc')).toBe(null));
  it('returns null for zero/negative', () => expect(App.parsePrice('-5')).toBe(null));
});

// ─── App.init — non-fatal startup failures ─────────────────────────────────
describe('App.init — startup failures are non-fatal', () => {
  // A DOM stub that remembers elements by id and supports createElement/appendChild,
  // so the init notice can be found, clicked and removed.
  function makeInitContext({ pathname = '/', getStatus, getTowns }) {
    const base = makeBrowserContext();
    const byId = new Map();
    const makeEl = (id) => {
      const listeners = {};
      const el = {
        id: id || '',
        children: [],
        attrs: {},
        className: '',
        innerHTML: '',
        textContent: '',
        value: '',
        placeholder: '',
        style: {},
        dataset: {},
        classList: {
          _s: new Set(),
          contains(c) { return this._s.has(c); },
          add(c) { this._s.add(c); },
          remove(c) { this._s.delete(c); },
          toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
        },
        addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
        click: () => (listeners.click || []).forEach(fn => fn({ preventDefault() {} })),
        setAttribute(k, v) { el.attrs[k] = v; },
        appendChild(child) {
          el.children.push(child);
          child.parentNode = el;
          if (child.id) byId.set(child.id, child);
          return child;
        },
        remove() {
          if (el.parentNode) el.parentNode.children = el.parentNode.children.filter(c => c !== el);
          if (byId.get(el.id) === el) byId.delete(el.id);
        },
        focus() {},
        scrollIntoView() {},
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      return el;
    };
    const body = makeEl('body');
    base.document = {
      documentElement: makeEl('html'),
      body,
      // Unknown ids are created on demand (the real page has them); the notice must be
      // added via appendChild before getElementById sees it.
      getElementById: (id) => {
        if (id === 'init-notice') return byId.get(id) || null;
        if (!byId.has(id)) byId.set(id, makeEl(id));
        return byId.get(id);
      },
      createElement: () => makeEl(),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      title: '',
      head: { querySelector: () => null, appendChild: () => {} },
    };
    base.location = { href: `http://localhost${pathname}`, pathname, search: '' };
    base.URLSearchParams = URLSearchParams;
    base.API = { ...base.API, getStatus, getTowns };
    base.MrtOverlay = { toggle: () => {} };
    base.addEventListener = () => {};
    base.innerWidth = 1024;
    base.window = base;
    const c = vm.createContext(base);
    const appSrc = fs.readFileSync(path.join(__dirname, '../../public/js/app.js'), 'utf8');
    vm.runInContext(appSrc + '\nglobalThis.App = App;', c);
    const app = c.App;
    app._initRetryDelayMs = 20;
    app.updateThemeIcons = () => {};
    app.search = vi.fn(() => Promise.resolve());
    return { app, doc: base.document };
  }

  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const STATUS = { total_transactions: 100, latest_month: '2026-09' };
  const TOWNS = { towns: ['BEDOK', 'ANG MO KIO'], districts: [] };

  it('getTowns rejects → overlay dismissed, retryable notice instead of full-screen error', async () => {
    const getTowns = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(TOWNS);
    const { app, doc } = makeInitContext({ getStatus: () => Promise.resolve(STATUS), getTowns });
    const showError = vi.spyOn(app, 'showError');

    await app.init();

    expect(showError).not.toHaveBeenCalled();
    const overlay = doc.getElementById('loading-overlay');
    expect(overlay.classList.contains('loading-fade-out')).toBe(true);
    expect(overlay.innerHTML).toBe('');
    const notice = doc.getElementById('init-notice');
    expect(notice).not.toBeNull();
    expect(notice.children.some(c => c.textContent === 'Retry')).toBe(true);

    // Automatic retry (~3s in production, shortened here) loads the towns and clears the notice
    await wait(60);
    expect(getTowns).toHaveBeenCalledTimes(2);
    expect(app._towns).toEqual(['BEDOK', 'ANG MO KIO']);
    expect(doc.getElementById('init-notice')).toBeNull();
  });

  it('/hdb/<town> opened before towns load waits for them, then routes once retry succeeds', async () => {
    const getTowns = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(TOWNS);
    const { app, doc } = makeInitContext({
      pathname: '/hdb/ang-mo-kio/4-room',
      getStatus: () => Promise.resolve(STATUS),
      getTowns,
    });

    const initDone = app.init();
    await wait(5);
    expect(app.search).not.toHaveBeenCalled(); // waiting, not falling through
    await initDone;

    expect(app.search).toHaveBeenCalledTimes(1);
    expect(doc.getElementById('search-input').value).toBe('Ang Mo Kio');
    expect(app.selectedFlatTypes.has('4 ROOM')).toBe(true);
  });

  it('Retry button re-fetches after the automatic retry also fails; dismiss removes the notice', async () => {
    const getStatus = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(STATUS);
    const getTowns = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(TOWNS);
    const { app, doc } = makeInitContext({ getStatus, getTowns });
    const showError = vi.spyOn(app, 'showError');

    await app.init();
    await wait(60); // auto-retry fails
    expect(getTowns).toHaveBeenCalledTimes(2);
    expect(showError).not.toHaveBeenCalled();

    const retryBtn = doc.getElementById('init-notice').children.find(c => c.textContent === 'Retry');
    retryBtn.click();
    await wait(10);
    expect(getTowns).toHaveBeenCalledTimes(3);
    expect(app._towns).toEqual(['BEDOK', 'ANG MO KIO']);
    expect(doc.getElementById('last-updated').textContent).toMatch(/^Data as of/);
    expect(doc.getElementById('init-notice')).toBeNull();
  });

  it('dismiss (×) removes the notice', async () => {
    const { app, doc } = makeInitContext({
      getStatus: () => Promise.reject(new Error('down')),
      getTowns: () => Promise.reject(new Error('down')),
    });
    app._initRetryDelayMs = 10000;
    await app.init();
    const notice = doc.getElementById('init-notice');
    notice.children.find(c => c.attrs['aria-label'] === 'Dismiss').click();
    expect(doc.getElementById('init-notice')).toBeNull();
  });

  it('still shows the full-screen error when the DB has no transactions', async () => {
    const { app } = makeInitContext({
      getStatus: () => Promise.resolve({ total_transactions: 0 }),
      getTowns: () => Promise.resolve(TOWNS),
    });
    const showError = vi.spyOn(app, 'showError').mockImplementation(() => {});
    await app.init();
    expect(showError).toHaveBeenCalledWith(expect.stringMatching(/No transaction data/));
  });
});

// ─── MrtNearest.nearestStation ────────────────────────────────────────────
describe('MrtNearest.nearestStation', () => {
  const stations = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/mrt_stations.json'), 'utf8'));

  it('returns null before stations are loaded / with no data', () => {
    expect(MrtNearest.nearestStation(1.35, 103.85, null)).toBeNull();
    expect(MrtNearest.nearestStation(1.35, 103.85, [])).toBeNull();
  });

  it('returns null for missing or non-numeric coords', () => {
    expect(MrtNearest.nearestStation(null, null, stations)).toBeNull();
    expect(MrtNearest.nearestStation(undefined, 103.85, stations)).toBeNull();
    expect(MrtNearest.nearestStation('abc', 103.85, stations)).toBeNull();
  });

  it('exact station coords → that station, 0m, 1 min walk', () => {
    const n = MrtNearest.nearestStation(1.3506, 103.8489, stations);
    expect(n.name).toBe('Bishan');
    expect(n.distanceM).toBe(0);
    expect(n.walkMin).toBe(1);
  });

  it('uses only the first code of an interchange', () => {
    const n = MrtNearest.nearestStation(1.3506, 103.8489, stations);
    expect(n.code).toBe('NS17');
    expect(n.codes).toEqual(['NS17', 'CC15']);
  });

  it('Bishan HDB block (~450m away) → Bishan, 400–500m band, walk = ceil(m / 80)', () => {
    // 0.004° of latitude ≈ 445m due north of Bishan station
    const n = MrtNearest.nearestStation(1.3546, 103.8489, stations);
    expect(n.name).toBe('Bishan');
    expect(n.distanceM).toBeGreaterThanOrEqual(400);
    expect(n.distanceM).toBeLessThan(500);
    expect(n.walkMin).toBe(Math.ceil(n.distanceM / 80));
    expect(n.walkMin).toBe(6);
  });

  it('Tampines Central → Tampines within 300m', () => {
    const n = MrtNearest.nearestStation(1.3530, 103.9440, stations);
    expect(n.name).toBe('Tampines');
    expect(n.distanceM).toBeLessThan(300);
  });

  it('defaults to the loaded station list', () => {
    const prev = MrtNearest.stations;
    MrtNearest.stations = stations;
    try {
      expect(MrtNearest.nearestStation(1.2836, 103.8517).name).toBe('Raffles Place');
    } finally {
      MrtNearest.stations = prev;
    }
  });
});

describe('MrtNearest.label', () => {
  const stations = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/mrt_stations.json'), 'utf8'));

  it('formats "🚇 <dist> to <name> (<code>) · ~N min walk"', () => {
    const prev = MrtNearest.stations;
    MrtNearest.stations = stations;
    try {
      expect(MrtNearest.label(1.3546, 103.8489)).toBe('🚇 450m to Bishan (NS17) · ~6 min walk');
    } finally {
      MrtNearest.stations = prev;
    }
  });

  it('is empty when coords are unknown or stations are not loaded', () => {
    const prev = MrtNearest.stations;
    MrtNearest.stations = stations;
    try {
      expect(MrtNearest.label(null, null)).toBe('');
    } finally {
      MrtNearest.stations = prev;
    }
    MrtNearest.stations = null;
    try {
      expect(MrtNearest.label(1.3546, 103.8489)).toBe('');
    } finally {
      MrtNearest.stations = prev;
    }
  });

  it('formatDistance switches to km at 1000m', () => {
    expect(MrtNearest.formatDistance(449)).toBe('450m');
    expect(MrtNearest.formatDistance(1234)).toBe('1.2km');
  });
});

describe('App.fetchAcResults — stale response guard', () => {
  it('does not let a slower older query overwrite the dropdown for a newer one', async () => {
    const resolvers = {};
    ctx.API.searchPrivateProjects = (query) => new Promise(res => { resolvers[query] = res; });
    ctx.API.searchBtoProjects = () => Promise.resolve({ projects: [] });
    App._towns = [];
    App._districts = [];
    const rendered = [];
    const origRender = App.renderAc;
    App.renderAc = function () { rendered.push(this._acItems.map(i => i.value)); };
    try {
      const older = App.fetchAcResults('SKY');
      const newer = App.fetchAcResults('SKYLINE');
      // Newer resolves first, then the slower older one arrives.
      resolvers['SKYLINE']({ projects: [{ project: 'SKYLINE RESIDENCES', district: '10' }] });
      await newer;
      resolvers['SKY']({ projects: [{ project: 'SKY HABITAT', district: '20' }] });
      await older;
      expect(rendered).toEqual([['SKYLINE RESIDENCES']]);
      expect(App._acItems.map(i => i.value)).toEqual(['SKYLINE RESIDENCES']);
    } finally {
      App.renderAc = origRender;
    }
  });
});

// ─── BTO exact-slug routing (/bto/<slug> deep links + autocomplete picks) ──
describe('BTO slug routing', () => {
  const PATCHED = ['track', 'search', '_showBtoProject', 'hideAc'];
  let saved, calls;

  beforeEach(() => {
    saved = { app: Object.fromEntries(PATCHED.map(k => [k, App[k]])), api: ctx.API.getBtoProjectOverviewBySlug, path: ctx.location.pathname, items: App._acItems };
    calls = { track: [], search: 0, shown: [], slugs: [] };
    App.track = (name, params) => calls.track.push({ name, params });
    App.search = async () => { calls.search++; App.track('search', { search_type: 'town' }); };
    App._showBtoProject = (data) => calls.shown.push(data);
    App.hideAc = () => {};
  });

  afterEach(() => {
    Object.assign(App, saved.app);
    ctx.API.getBtoProjectOverviewBySlug = saved.api;
    ctx.location.pathname = saved.path;
    App._acItems = saved.items;
  });

  const hit = { project: 'JADE SPRING @ YISHUN', display_name: 'Jade Spring @ Yishun (Phase 2)', town: 'YISHUN' };
  const stubLookup = (result) => {
    ctx.API.getBtoProjectOverviewBySlug = async (slug) => { calls.slugs.push(slug); if (result instanceof Error) throw result; return result; };
  };
  const btoItem = { type: 'bto', label: hit.display_name, value: hit.display_name, slug: 'jade-spring-yishun-phase-2' };
  const searchEvents = () => calls.track.filter(t => t.name === 'search');

  it('/bto/<slug> opens the exact project without calling search()', async () => {
    stubLookup(hit);
    ctx.location.pathname = '/bto/jade-spring-yishun-phase-2';
    await App.handleUrlRoute();
    expect(calls.slugs).toEqual(['jade-spring-yishun-phase-2']);
    expect(calls.shown).toEqual([hit]);
    expect(calls.search).toBe(0);
  });

  it('/bto/<slug> falls back to search() when the slug is not found', async () => {
    stubLookup(null);
    ctx.location.pathname = '/bto/no-such-bto';
    await App.handleUrlRoute();
    expect(calls.shown).toHaveLength(0);
    expect(calls.search).toBe(1);
  });

  it('/bto/<slug> falls back to search() when the lookup throws', async () => {
    stubLookup(new Error('network'));
    ctx.location.pathname = '/bto/jade-spring-yishun-phase-2';
    const origErr = console.error; console.error = () => {};
    try { await App.handleUrlRoute(); } finally { console.error = origErr; }
    expect(calls.search).toBe(1);
  });

  it('autocomplete BTO pick opens by slug and tracks exactly one search event', async () => {
    stubLookup(hit);
    App._acItems = [btoItem];
    await App.selectAc(0);
    expect(calls.slugs).toEqual(['jade-spring-yishun-phase-2']);
    expect(calls.shown).toEqual([hit]);
    expect(calls.search).toBe(0);
    expect(searchEvents()).toHaveLength(1);
    expect(searchEvents()[0].params.search_type).toBe('bto');
  });

  it('autocomplete BTO pick that misses falls back to search() with no double-counted search event', async () => {
    stubLookup(null);
    App._acItems = [btoItem];
    await App.selectAc(0);
    expect(calls.search).toBe(1);
    expect(searchEvents()).toHaveLength(1);
  });

  it('non-BTO autocomplete pick skips the slug lookup', async () => {
    stubLookup(hit);
    App._acItems = [{ type: 'town', label: 'Yishun', value: 'YISHUN' }];
    await App.selectAc(0);
    expect(calls.slugs).toHaveLength(0);
    expect(calls.search).toBe(1);
  });
});
