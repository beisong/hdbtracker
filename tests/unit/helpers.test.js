'use strict';
const { _test } = require('../../server/index.js');

const { median, percentile, trendPct, compressStreetName, expandStreetName, haversineM, dealScore, computeStoreyFactor, monthsBetween } = _test;

describe('median', () => {
  it('returns null for empty array', () => expect(median([])).toBeNull());
  it('returns null for null input', () => expect(median(null)).toBeNull());
  it('returns the value for a single-element array', () => expect(median([500])).toBe(500));
  it('returns the middle value for odd-length arrays', () => expect(median([100, 300, 200])).toBe(200));
  it('returns the average of the two middle values for even-length arrays', () => expect(median([100, 200, 300, 400])).toBe(250));
  it('handles duplicate values', () => expect(median([100, 100, 100])).toBe(100));
  it('sorts before computing', () => expect(median([500, 100, 300])).toBe(300));
});

describe('percentile', () => {
  it('returns null for empty array', () => expect(percentile([], 50)).toBeNull());
  it('returns null for null input', () => expect(percentile(null, 50)).toBeNull());
  it('p0 returns min element', () => expect(percentile([10, 20, 30, 40, 50], 0)).toBe(10));
  it('p100 returns max element', () => expect(percentile([10, 20, 30, 40, 50], 100)).toBe(50));
  it('p50 on odd-length sorted array returns middle', () => expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3));
  it('p25 interpolates correctly', () => {
    const result = percentile([10, 20, 30, 40], 25);
    expect(result).toBeGreaterThanOrEqual(10);
    expect(result).toBeLessThanOrEqual(20);
  });
  it('p75 interpolates correctly', () => {
    const result = percentile([10, 20, 30, 40], 75);
    expect(result).toBeGreaterThanOrEqual(30);
    expect(result).toBeLessThanOrEqual(40);
  });
});

describe('trendPct', () => {
  it('returns 0 for null input', () => expect(trendPct(null, 'val')).toBe(0));
  it('returns 0 for empty array', () => expect(trendPct([], 'val')).toBe(0));
  it('returns 0 for single element', () => expect(trendPct([{ val: 100 }], 'val')).toBe(0));
  it('returns positive % for rising data', () => {
    const data = [
      { val: 100 }, { val: 105 }, { val: 110 }, { val: 115 }, { val: 120 }, { val: 125 },
    ];
    expect(trendPct(data, 'val')).toBeGreaterThan(0);
  });
  it('returns negative % for falling data', () => {
    const data = [
      { val: 125 }, { val: 120 }, { val: 115 }, { val: 110 }, { val: 105 }, { val: 100 },
    ];
    expect(trendPct(data, 'val')).toBeLessThan(0);
  });
  it('returns ~0 for flat data', () => {
    const data = Array.from({ length: 6 }, () => ({ val: 100 }));
    expect(trendPct(data, 'val')).toBe(0);
  });
  it('uses 1-element window when array is short', () => {
    const data = [{ val: 100 }, { val: 120 }];
    const result = trendPct(data, 'val');
    expect(result).toBeCloseTo(20, 0);
  });
});

describe('compressStreetName', () => {
  it('compresses STREET to ST', () => expect(compressStreetName('ANG MO KIO AVENUE 3')).toBe('ANG MO KIO AVE 3'));
  it('compresses ROAD to RD', () => expect(compressStreetName('UPPER SERANGOON ROAD')).toBe('UPP SERANGOON RD'));
  it('compresses BUKIT to BT', () => expect(compressStreetName('BUKIT TIMAH ROAD')).toBe('BT TIMAH RD'));
  it('compresses multiple words in one pass', () => expect(compressStreetName('LORONG BUKIT BATOK')).toBe('LOR BT BATOK'));
  it('is case-insensitive (converts to uppercase)', () => expect(compressStreetName('tampines street 21')).toBe('TAMPINES ST 21'));
  it('leaves already-compressed form unchanged', () => expect(compressStreetName('ANG MO KIO AVE 3')).toBe('ANG MO KIO AVE 3'));
  it('handles empty string', () => expect(compressStreetName('')).toBe(''));
});

describe('expandStreetName', () => {
  it('expands ST to STREET', () => expect(expandStreetName('ANG MO KIO AVE 3')).toBe('ANG MO KIO AVENUE 3'));
  it('expands RD to ROAD', () => expect(expandStreetName('SERANGOON RD')).toBe('SERANGOON ROAD'));
  it('expands BT to BUKIT', () => expect(expandStreetName('BT TIMAH RD')).toBe('BUKIT TIMAH ROAD'));
  it('expands UPP to UPPER', () => expect(expandStreetName('UPP SERANGOON RD')).toBe('UPPER SERANGOON ROAD'));
  it('leaves already-expanded form unchanged', () => expect(expandStreetName('ANG MO KIO AVENUE 3')).toBe('ANG MO KIO AVENUE 3'));
});

describe('haversineM', () => {
  it('returns 0 for identical points', () => expect(haversineM(1.35, 103.9, 1.35, 103.9)).toBe(0));
  it('~111km per degree of latitude', () => {
    const d = haversineM(1.0, 103.9, 2.0, 103.9);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
  it('measures a known short distance (~157m for 0.001° lat + 0.001° lng near the equator)', () => {
    const d = haversineM(1.3250, 103.9300, 1.3260, 103.9310);
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(165);
  });
});

describe('dealScore', () => {
  it('fair price → 50', () => expect(dealScore(0)).toBe(50));
  it('10% below fair → 75', () => expect(dealScore(-0.1)).toBe(75));
  it('10% above fair → 25', () => expect(dealScore(0.1)).toBe(25));
  it('clamps deep discounts at 100', () => expect(dealScore(-0.5)).toBe(100));
  it('clamps heavy premiums at 0', () => expect(dealScore(0.5)).toBe(0));
});

describe('computeStoreyFactor', () => {
  const buckets = {
    '01 TO 03': { avg_psm: 6000, c: 50 },
    '10 TO 12': { avg_psm: 6600, c: 40 },
    '16 TO 18': { avg_psm: 9000, c: 12 },
    '19 TO 21': { avg_psm: 6300, c: 3 },
  };
  it('returns the psm ratio between well-populated buckets', () =>
    expect(computeStoreyFactor(buckets, '10 TO 12', '01 TO 03')).toBeCloseTo(1.1));
  it('returns 1 when subject and comp share a bucket', () =>
    expect(computeStoreyFactor(buckets, '01 TO 03', '01 TO 03')).toBe(1));
  it('returns 1 when subject storey is unknown', () =>
    expect(computeStoreyFactor(buckets, null, '01 TO 03')).toBe(1));
  it('returns 1 when a bucket is missing', () =>
    expect(computeStoreyFactor(buckets, '25 TO 27', '01 TO 03')).toBe(1));
  it('returns 1 when a bucket is too thin', () =>
    expect(computeStoreyFactor(buckets, '19 TO 21', '01 TO 03')).toBe(1));
  it('clamps implausible ratios to ±10%', () =>
    expect(computeStoreyFactor(buckets, '16 TO 18', '01 TO 03')).toBe(1.1));
});

describe('monthsBetween', () => {
  it('same month → 0', () => expect(monthsBetween('2025-05', '2025-05')).toBe(0));
  it('across a year boundary', () => expect(monthsBetween('2024-11', '2025-02')).toBe(3));
  it('a full year → 12', () => expect(monthsBetween('2024-05', '2025-05')).toBe(12));
});
