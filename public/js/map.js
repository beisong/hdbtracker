/**
 * WorthOrNot — Map Module
 * Combines TransactionMap (transaction markers, geocoding)
 * and MrtOverlay (MRT/LRT lines and stations).
 */

// ============================================================
// Transaction Map
// ============================================================

const TransactionMap = {
  map: null,
  markers: [],

  async load(transactions, resolvedData) {
    const mapLoading = document.getElementById('map-loading');
    const mapCount = document.getElementById('map-count');

    if (mapLoading) mapLoading.style.display = 'flex';

    try {
      const seen = new Set();
      const uniqueAddresses = [];
      for (const tx of transactions) {
        const key = `${tx.block} ${tx.street_name}`.trim().toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          uniqueAddresses.push({ block: tx.block, street_name: tx.street_name });
          if (uniqueAddresses.length >= 200) break;
        }
      }

      const geoResult = await API.geocodeAddresses(uniqueAddresses);
      const geoMap = {};
      for (const r of geoResult.results) {
        if (r.lat && r.lng) geoMap[r.query] = { lat: r.lat, lng: r.lng };
      }

      const markerData = [];
      for (const tx of transactions) {
        const key = `${tx.block} ${tx.street_name}`.trim().toUpperCase();
        if (geoMap[key]) {
          markerData.push({ ...tx, lat: geoMap[key].lat, lng: geoMap[key].lng });
        }
        if (markerData.length >= 200) break;
      }

      if (mapCount) mapCount.textContent = `— ${markerData.length} transactions mapped`;

      this.render(markerData, resolvedData);

    } catch (err) {
      console.error('Map loading error:', err);
      const mapCount = document.getElementById('map-count');
      if (mapCount) mapCount.textContent = '— Map unavailable';
      const mapLoading = document.getElementById('map-loading');
      if (mapLoading) mapLoading.style.display = 'none';
    }
  },

  render(markerData, resolvedData) {
    const mapLoading = document.getElementById('map-loading');
    const container = document.getElementById('map-container');

    // Destroy existing map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.markers = [];

    // Initialize Leaflet map with dark tiles
    this.map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([1.3521, 103.8198], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.map);

    const bounds = [];

    // Calculate per-type+lease-tier median $/sqm for value-based coloring
    const tierPsm = {};
    const typePsm = {};
    for (const tx of markerData) {
      const t = tx.flat_type || 'UNKNOWN';
      const tier = this.getLeaseTier(tx.remaining_lease_years || 0);
      const key = `${t}|${tier}`;
      if (!tierPsm[key]) tierPsm[key] = [];
      tierPsm[key].push(tx.price_per_sqm || 0);
      if (!typePsm[t]) typePsm[t] = [];
      typePsm[t].push(tx.price_per_sqm || 0);
    }
    const tierMedianPsm = {};
    for (const [key, vals] of Object.entries(tierPsm)) {
      if (vals.length >= 5) {
        const sorted = [...vals].sort((a, b) => a - b);
        tierMedianPsm[key] = sorted[Math.floor(sorted.length / 2)];
      }
    }
    const typeMedianPsm = {};
    for (const [t, vals] of Object.entries(typePsm)) {
      const sorted = [...vals].sort((a, b) => a - b);
      typeMedianPsm[t] = sorted[Math.floor(sorted.length / 2)] || 0;
    }
    const overallPsm = markerData.map(m => m.price_per_sqm || 0).sort((a, b) => a - b);
    const overallMedianPsm = overallPsm[Math.floor(overallPsm.length / 2)] || 0;

    // Group transactions by address for combined popups
    const addressGroups = {};
    for (const tx of markerData) {
      const key = `${tx.block} ${tx.street_name}`.trim().toUpperCase();
      if (!addressGroups[key]) addressGroups[key] = [];
      addressGroups[key].push(tx);
    }

    // Add one marker per unique address with all transactions in popup
    for (const [addrKey, txList] of Object.entries(addressGroups)) {
      const first = txList[0];
      // Sort by date descending (newest first)
      txList.sort((a, b) => (b.month || '').localeCompare(a.month || ''));

      // Color based on most recent transaction
      const recent = txList[0];
      const tier = this.getLeaseTier(recent.remaining_lease_years || 0);
      const tierKey = `${recent.flat_type}|${tier}`;
      const medianPsm = tierMedianPsm[tierKey] || typeMedianPsm[recent.flat_type] || overallMedianPsm;
      const style = this.getValueStyle(recent.price_per_sqm || 0, medianPsm);

      // Size based on number of transactions
      const radius = Math.min(12, Math.max(style.radius, 6 + txList.length));

      const marker = L.circleMarker([first.lat, first.lng], {
        radius: radius,
        fillColor: style.color,
        color: '#fff',
        weight: 1,
        opacity: 0.6,
        fillOpacity: 0.85,
      }).addTo(this.map);

      // Build popup with all transactions
      const txRows = txList.map((tx, i) => {
        const priceColor = i === 0 ? '#60a5fa' : '#cbd5e1';
        return `
          <div style="padding:4px 0; ${i > 0 ? 'border-top:1px solid #334155;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:#94a3b8; font-size:11px;">${App.formatMonth(tx.month)}</span>
              <span style="font-weight:700; color:${priceColor}; font-size:13px;">$${App.formatNumber(tx.resale_price)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:2px;">
              <span>${tx.flat_type} · ${tx.floor_area_sqm}sqm</span>
              <span>$${App.formatNumber(tx.price_per_sqm)}/sqm</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b;">
              <span>Floor: ${tx.storey_range || '--'}</span>
              <span>Lease: ${tx.remaining_lease_years ? Math.round(tx.remaining_lease_years) + 'y' : '--'}</span>
            </div>
          </div>`;
      }).join('');

      const popupContent = `
        <div style="font-family:Inter,system-ui,sans-serif; font-size:12px; line-height:1.5; min-width:220px; max-height:300px; overflow-y:auto;">
          <div style="font-weight:700; font-size:13px; margin-bottom:2px;">${addrKey}</div>
          <div style="color:#94a3b8; font-size:11px; margin-bottom:6px;">${txList.length} transaction${txList.length > 1 ? 's' : ''}</div>
          ${txRows}
        </div>
      `;
      marker.bindPopup(popupContent, { className: 'dark-popup', maxHeight: 300 });
      this.markers.push(marker);
      bounds.push([first.lat, first.lng]);
    }

    // Add postal code pin if available
    if (resolvedData && resolvedData.lat && resolvedData.lng) {
      const postalMarker = L.marker([resolvedData.lat, resolvedData.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background: #ef4444;
            border: 3px solid #fff;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 8px rgba(239,68,68,0.5);
            position: relative;
            top: -10px;
            left: -10px;
          "></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(this.map);

      postalMarker.bindPopup(`
        <div style="font-family:Inter,system-ui,sans-serif; font-size:12px; line-height:1.5;">
          <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:#ef4444;">📍 Your Search Location</div>
          <div>${resolvedData.address || resolvedData.input}</div>
        </div>
      `, { className: 'dark-popup' });

      bounds.push([resolvedData.lat, resolvedData.lng]);
    }

    // Fit map to bounds
    if (bounds.length > 0) {
      this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }

    if (mapLoading) mapLoading.style.display = 'none';

    // Restore MRT layer if it was visible
    MrtOverlay.restoreIfNeeded(this.map);
  },

  getLeaseTier(remainingLeaseYears) {
    if (remainingLeaseYears >= 95) return 'fresh';
    if (remainingLeaseYears >= 75) return 'newer';
    return 'older';
  },

  /**
   * 3-color spectrum: Green → Blue → Red based on price-to-median ratio.
   * Green = good value, Blue = fair, Red = premium.
   * Also returns a suggested marker radius (bigger = better deal).
   */
  getValueStyle(pricePerSqm, medianPsm) {
    if (!medianPsm || medianPsm === 0) return { color: '#60a5fa', radius: 7 };
    const ratio = pricePerSqm / medianPsm;

    // Anchor colors as RGB
    const green = [34, 197, 94];   // #22c55e — good value
    const blue  = [96, 165, 250];  // #60a5fa — fair price
    const red   = [239, 68, 68];   // #ef4444 — premium

    let r, g, b;
    if (ratio <= 1.0) {
      // Green → Blue (interpolate from ratio 0.70→1.00)
      const t = Math.max(0, Math.min(1, (ratio - 0.70) / 0.30));
      r = Math.round(green[0] + (blue[0] - green[0]) * t);
      g = Math.round(green[1] + (blue[1] - green[1]) * t);
      b = Math.round(green[2] + (blue[2] - green[2]) * t);
    } else {
      // Blue → Red (interpolate from ratio 1.00→1.30)
      const t = Math.max(0, Math.min(1, (ratio - 1.0) / 0.30));
      r = Math.round(blue[0] + (red[0] - blue[0]) * t);
      g = Math.round(blue[1] + (red[1] - blue[1]) * t);
      b = Math.round(blue[2] + (red[2] - blue[2]) * t);
    }

    // Radius: bigger for good deals, smaller for overpriced
    const clamped = Math.max(0.70, Math.min(1.30, ratio));
    const tNorm = (clamped - 0.70) / 0.60;
    const radius = Math.max(5, Math.min(9, 9 - tNorm * 4));

    return {
      color: `rgb(${r}, ${g}, ${b})`,
      radius: radius,
    };
  },
};

// ============================================================
// MRT Overlay
// ============================================================

const MrtOverlay = {
  stations: null,
  layer: null,
  visible: false,

  lineColors: {
    'NS': '#D42E12', 'EW': '#009645', 'NE': '#9016B2',
    'CC': '#FA9E0D', 'DT': '#005EC4', 'TE': '#9D5B25',
    'CG': '#009645', 'CE': '#FA9E0D',
    'BP': '#7B7B7B', 'SE': '#9C8B7A', 'PE': '#7BA09C', 'PW': '#7B9C8B',
  },

  lineNames: {
    'NS': 'North-South', 'EW': 'East-West', 'NE': 'North East',
    'CC': 'Circle', 'DT': 'Downtown', 'TE': 'Thomson-East Coast',
    'CG': 'Changi Airport Br', 'CE': 'Circle Ext', 'BP': 'Bukit Panjang LRT',
    'SE': 'Sengkang LRT', 'PE': 'Punggol LRT', 'PW': 'Punggol LRT',
  },

  lineSegments: {
    'NS': [[1, 28]], 'EW': [[1, 33]], 'CG': [[0, 2]],
    'NE': [[1, 17]], 'CC': [[1, 30]], 'CE': [[1, 2]],
    'DT': [[1, 35]], 'TE': [[1, 29]],
    'BP': [[1, 14]], 'SE': [[1, 5]], 'PE': [[1, 7]], 'PW': [[1, 7]],
  },

  loopLines: new Set(['CC', 'BP', 'SE', 'PE', 'PW']),

  async toggle(map) {
    if (!map) return;

    if (!this.stations) {
      try {
        const resp = await fetch('data/mrt_stations.json');
        this.stations = await resp.json();
      } catch (err) {
        console.error('Failed to load MRT data:', err);
        return;
      }
    }

    this.visible = !this.visible;
    const label = document.getElementById('mrt-toggle-label');
    const dot = document.querySelector('#mrt-toggle-btn .w-2\\.5');

    if (this.visible) {
      this.addTo(map);
      if (label) label.textContent = 'Hide MRT';
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-brand-400';
    } else {
      this.remove();
      if (label) label.textContent = 'Show MRT';
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-green-500';
    }
  },

  restoreIfNeeded(map) {
    if (this.visible) this.addTo(map);
  },

  addTo(map) {
    this.remove();
    if (!map || !this.stations) return;

    this.layer = L.layerGroup();

    // Draw MRT line polylines with smooth curves
    for (const [lineCode, segments] of Object.entries(this.lineSegments)) {
      const lineColor = this.lineColors[lineCode];
      const isLoop = this.loopLines.has(lineCode);

      for (const [startNum, endNum] of segments) {
        const lineStations = [];
        for (const station of this.stations) {
          const idx = station.lines.indexOf(lineCode);
          if (idx === -1) continue;
          const num = parseInt(station.codes[idx].replace(/^[A-Z]+/, ''), 10);
          if (isNaN(num) || num < startNum || num > endNum) continue;
          lineStations.push({ ...station, sortKey: num });
        }
        lineStations.sort((a, b) => a.sortKey - b.sortKey);

        if (lineStations.length >= 2) {
          let latlngs = lineStations.map(s => [s.lat, s.lng]);
          if (isLoop) latlngs.push(latlngs[0]);
          const smooth = this.catmullRomSpline(latlngs, 12);
          const isLrt = ['BP', 'SE', 'PE', 'PW'].includes(lineCode);
          this.layer.addLayer(L.polyline(smooth, {
            color: lineColor, weight: isLrt ? 2.5 : 4, opacity: isLrt ? 0.6 : 0.7,
            lineJoin: 'round', lineCap: 'round', smoothFactor: 1,
            dashArray: isLrt ? '6 4' : null,
          }));
        }
      }
    }

    // Draw station markers
    for (const station of this.stations) {
      const color = this.lineColors[station.lines[0]] || '#7B7B7B';

      const marker = L.circleMarker([station.lat, station.lng], {
        radius: 4, fillColor: '#ffffff', color: color,
        weight: 2.5, opacity: 1, fillOpacity: 1,
      });

      const badges = station.lines.map(l => {
        const c = this.lineColors[l] || '#7B7B7B';
        return `<span style="display:inline-block;background:${c};color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;margin-right:3px;">${l}</span>`;
      }).join('');

      marker.bindPopup(`
        <div style="font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1.5;min-width:160px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;">🚇 ${station.name}</div>
          <div style="margin-bottom:6px;">${badges}</div>
          <div style="color:#94a3b8;font-size:11px;">Station codes: ${station.codes.join(' / ')}</div>
        </div>
      `, { className: 'dark-popup' });

      marker.bindTooltip(station.name, {
        permanent: false, direction: 'top', offset: [0, -6], className: 'mrt-tooltip',
      });

      this.layer.addLayer(marker);
    }

    this.layer.addTo(map);
  },

  remove() {
    if (this.layer) {
      this.layer.remove();
      this.layer = null;
    }
  },

  catmullRomSpline(points, segments = 16) {
    if (points.length < 2) return points;
    if (points.length === 2) return points;
    const result = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];
      for (let t = 0; t < segments; t++) {
        const tt = t / segments, tt2 = tt * tt, tt3 = tt2 * tt;
        const lat = 0.5 * ((2*p1[0])+(-p0[0]+p2[0])*tt+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*tt2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*tt3);
        const lng = 0.5 * ((2*p1[1])+(-p0[1]+p2[1])*tt+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*tt2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*tt3);
        result.push([lat, lng]);
      }
    }
    result.push(points[points.length - 1]);
    return result;
  },
};