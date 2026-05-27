/**
 * WorthIt — Map Module
 * Combines TransactionMap (transaction markers, geocoding)
 * and MrtOverlay (MRT/LRT lines and stations).
 */

// ============================================================
// Transaction Map
// ============================================================

const TransactionMap = {
  map: null,
  markers: [],
  addressMarkers: {},  // address key → { marker, originalStyle }
  _highlightedMarker: null,
  _tileLayer: null,

  isDark() {
    return document.documentElement.classList.contains('dark');
  },

  /** Get CSS variable value for use in inline styles */
  cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  },

  /** Swap map tiles when theme changes */
  updateTheme() {
    if (!this.map) return;
    if (this._tileLayer) {
      this.map.removeLayer(this._tileLayer);
    }
    const dark = this.isDark();
    const tileUrl = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    this._tileLayer = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.map);
    // Move tile layer to bottom
    this._tileLayer.bringToBack();
  },

  loadPreGeocoded(transactions, lat, lng, resolvedData) {
    // For private projects: transactions all at same lat/lng, skip geocoding
    const markerData = transactions.map(tx => ({ ...tx, lat, lng }));
    const mapCount = document.getElementById('map-count');
    if (mapCount) mapCount.textContent = `— ${markerData.length} transactions mapped`;
    this.render(markerData, resolvedData);
  },

  async addNearbyHDB(transactions) {
    // Add nearby HDB transactions to an existing map (after private project render)
    if (!this.map || !transactions || transactions.length === 0) return;

    // Geocode HDB addresses
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

    try {
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

      // Group by address
      const addressGroups = {};
      for (const tx of markerData) {
        const key = `${tx.block} ${tx.street_name}`.trim().toUpperCase();
        if (!addressGroups[key]) addressGroups[key] = [];
        addressGroups[key].push(tx);
      }

      const popupBg = this.cssVar('--popup-border');

      // Add markers for each HDB address
      const bounds = [];
      for (const [addrKey, txList] of Object.entries(addressGroups)) {
        const first = txList[0];
        txList.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
        const recent = txList[0];

        const marker = L.circleMarker([first.lat, first.lng], {
          radius: Math.min(10, 6 + txList.length * 0.3),
          fillColor: '#60a5fa',
          color: '#fff',
          weight: 1,
          opacity: 0.5,
          fillOpacity: 0.75,
        }).addTo(this.map);

        const txRows = txList.slice(0, 10).map((tx, i) => `
          <div style="padding:3px 0; ${i > 0 ? 'border-top:1px solid var(--popup-border);' : ''}">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--popup-muted); font-size:10px;">${App.formatMonth(tx.month)}</span>
              <span style="font-weight:600; color:var(--popup-price); font-size:11px;">$${App.formatNumber(tx.resale_price)}</span>
            </div>
            <div style="font-size:10px; color:var(--popup-muted);">${this.shortType(tx.flat_type)} · ${tx.floor_area_sqm}sqm · $${App.formatNumber(tx.price_per_sqm)}/sqm</div>
          </div>`).join('');

        marker.bindPopup(`
          <div style="font-family:Inter,system-ui,sans-serif; font-size:11px; line-height:1.4; min-width:160px; max-height:250px; overflow-y:auto;">
            <div style="font-weight:700; font-size:12px; margin-bottom:2px;">🏠 ${addrKey}</div>
            <div style="color:var(--popup-muted); font-size:10px; margin-bottom:4px;">HDB · ${txList.length} transaction${txList.length > 1 ? 's' : ''}</div>
            ${txRows}
          </div>
        `, { maxHeight: 250 });

        this.markers.push(marker);
        bounds.push([first.lat, first.lng]);
      }

      // Expand map bounds to include HDB markers
      if (bounds.length > 0 && this.map) {
        const existingBounds = this.map.getBounds();
        for (const b of bounds) existingBounds.extend(b);
        this.map.fitBounds(existingBounds, { padding: [30, 30], maxZoom: 16 });
      }

      // Update count
      const mapCount = document.getElementById('map-count');
      if (mapCount) {
        const currentText = mapCount.textContent || '';
        mapCount.textContent = `${currentText} (+${markerData.length} HDB nearby)`;
      }

    } catch (err) {
      console.warn('Failed to add nearby HDB markers:', err.message);
    }
  },

  addNearbyProjects(projects, currentProject) {
    // Add nearby private project markers (coordinates already known)
    if (!this.map || !projects || projects.length === 0) return;

    const bounds = [];
    for (const proj of projects) {
      // Skip the currently-viewed project
      if (currentProject && proj.project === currentProject) continue;
      if (!proj.latitude || !proj.longitude) continue;

      const marker = L.circleMarker([proj.latitude, proj.longitude], {
        radius: Math.min(10, 5 + Math.sqrt(proj.tx_count || 1)),
        fillColor: '#a855f7',
        color: '#c084fc',
        weight: 1.5,
        opacity: 0.7,
        fillOpacity: 0.7,
      }).addTo(this.map);

      // Build popup with recent transactions
      let popupHtml = `
        <div style="font-family:Inter,system-ui,sans-serif; font-size:11px; line-height:1.4; min-width:180px; max-height:280px; overflow-y:auto;">
          <div style="font-weight:700; font-size:12px; margin-bottom:2px; color:#a855f7;">🏢 ${proj.project}</div>
          <div style="color:var(--popup-muted); font-size:10px; margin-bottom:4px;">${proj.street_name} · D${proj.district} · ${proj.market_segment}</div>
          <div style="display:flex; justify-content:space-between;">
            <span style="font-size:11px;">${proj.tx_count} transactions</span>
            <span style="font-weight:600; font-size:11px; color:#a855f7;">$${App.formatNumber(proj.avg_psm)}/sqm</span>
          </div>
          <div style="font-size:10px; color:var(--popup-muted); margin-top:2px;">Avg: $${App.formatNumber(proj.avg_price)}</div>`;

      if (proj.recent_transactions && proj.recent_transactions.length > 0) {
        popupHtml += `<div style="margin-top:6px; border-top:1px solid var(--popup-border); padding-top:6px;">`;
        proj.recent_transactions.forEach((tx, i) => {
          popupHtml += `
            <div style="padding:3px 0; ${i > 0 ? 'border-top:1px solid var(--popup-border);' : ''}">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--popup-muted); font-size:10px;">${App.formatMonth(tx.month)}</span>
                <span style="font-weight:600; color:#a855f7; font-size:11px;">$${App.formatNumber(tx.resale_price)}</span>
              </div>
              <div style="font-size:10px; color:var(--popup-muted);">${this.shortType(tx.property_type || '')} · ${tx.floor_area_sqm}sqm · $${App.formatNumber(tx.price_per_sqm)}/sqm</div>
            </div>`;
        });
        popupHtml += `</div>`;
      }

      popupHtml += `</div>`;
      marker.bindPopup(popupHtml, { maxHeight: 280 });

      this.markers.push(marker);
      this.addressMarkers[proj.project.toUpperCase()] = {
        marker,
        originalStyle: {
          radius: Math.min(10, 5 + Math.sqrt(proj.tx_count || 1)),
          fillColor: '#a855f7',
          color: '#c084fc',
          weight: 1.5,
          opacity: 0.7,
          fillOpacity: 0.7,
        }
      };
      bounds.push([proj.latitude, proj.longitude]);
    }

    // Expand bounds
    if (bounds.length > 0 && this.map) {
      const existingBounds = this.map.getBounds();
      for (const b of bounds) existingBounds.extend(b);
      this.map.fitBounds(existingBounds, { padding: [30, 30], maxZoom: 16 });
    }
  },

  async load(transactions, resolvedData) {
    const mapLoading = document.getElementById('map-loading');
    const mapCount = document.getElementById('map-count');

    if (mapLoading) mapLoading.style.display = 'flex';

    try {
      // Separate transactions with pre-existing coordinates from those needing geocoding
      const preGeocoded = [];
      const needsGeocoding = [];
      for (const tx of transactions) {
        if (tx.lat && tx.lng) {
          preGeocoded.push(tx);
        } else {
          needsGeocoding.push(tx);
        }
      }

      const seen = new Set();
      const uniqueAddresses = [];
      for (const tx of needsGeocoding) {
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

      const markerData = [...preGeocoded];
      for (const tx of needsGeocoding) {
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
    this.addressMarkers = {};
    this._highlightedMarker = null;
    this._tileLayer = null;

    // Initialize Leaflet map
    this.map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: window.innerWidth >= 640,
    }).setView([1.3521, 103.8198], 13);

    // Add themed tiles
    this.updateTheme();

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
    // For private projects, skip circle markers at the same location as the search pin
    const isPrivatePinned = resolvedData && resolvedData.isPrivate && resolvedData.lat && resolvedData.lng;
    let privateProjectTxs = null;
    for (const [addrKey, txList] of Object.entries(addressGroups)) {
      const first = txList[0];
      // Skip if this is a private project marker at the pin location — save txs for pin popup
      if (isPrivatePinned &&
          Math.abs(first.lat - resolvedData.lat) < 0.0001 &&
          Math.abs(first.lng - resolvedData.lng) < 0.0001) {
        txList.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
        privateProjectTxs = txList;
        continue;
      }

      // Sort by date descending (newest first)
      txList.sort((a, b) => (b.month || '').localeCompare(a.month || ''));

      const recent = txList[0];
      // Deal score coloring (both HDB and private): green → blue → red
      const t = recent.flat_type || 'UNKNOWN';
      const tier = this.getLeaseTier(recent.remaining_lease_years || 0);
      const key = `${t}|${tier}`;
      const medianPsm = tierMedianPsm[key] || typeMedianPsm[t] || overallMedianPsm;
      const style = this.getValueStyle(recent.price_per_sqm || 0, medianPsm);
      const markerColor = style.color;
      const radius = style.radius;
      // Border: purple ring for private, white for HDB
      const isPrivate = recent.is_private;
      const borderColor = isPrivate ? '#a855f7' : '#fff';
      const borderWeight = isPrivate ? 4 : 1;
      const markerRadius = isPrivate ? radius + 2 : radius;

      const marker = L.circleMarker([first.lat, first.lng], {
        radius: markerRadius,
        fillColor: markerColor,
        color: borderColor,
        weight: borderWeight,
        opacity: 0.9,
        fillOpacity: 0.85,
      }).addTo(this.map);

      // Build popup with all transactions using CSS variables
      const txRows = txList.map((tx, i) => {
        const priceColor = i === 0 ? 'var(--popup-price)' : 'var(--popup-price-secondary)';
        return `
          <div style="padding:4px 0; ${i > 0 ? 'border-top:1px solid var(--popup-border);' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--popup-muted); font-size:11px;">${App.formatMonth(tx.month)}</span>
              <span style="font-weight:700; color:${priceColor}; font-size:13px;">$${App.formatNumber(tx.resale_price)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:2px; font-size:11px; margin-top:2px;">
              <span>${this.shortType(tx.flat_type)} · ${tx.floor_area_sqm}sqm</span>
              <span>$${App.formatNumber(tx.price_per_sqm)}/sqm</span>
            </div>
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:2px; font-size:11px; color:var(--popup-muted);">
              <span>Floor: ${tx.storey_range || '--'}</span>
              <span>Lease: ${tx.remaining_lease_years ? Math.round(tx.remaining_lease_years) + 'y' : '--'}</span>
            </div>
          </div>`;
      }).join('');

      const popupContent = `
        <div style="font-family:Inter,system-ui,sans-serif; font-size:12px; line-height:1.5; min-width:180px; max-height:300px; overflow-y:auto;">
          <div style="font-weight:700; font-size:13px; margin-bottom:2px;">${addrKey}</div>
          <div style="color:var(--popup-muted); font-size:11px; margin-bottom:6px;">${txList.length} transaction${txList.length > 1 ? 's' : ''}</div>
          ${txRows}
        </div>
      `;
      marker.bindPopup(popupContent, { maxHeight: 300 });
      this.markers.push(marker);
      this.addressMarkers[addrKey] = { marker, originalStyle: { radius: markerRadius, fillColor: markerColor, color: borderColor, weight: borderWeight, opacity: 0.9, fillOpacity: 0.85 } };
      bounds.push([first.lat, first.lng]);
    }

    // Add pin for search location or private project
    if (resolvedData && resolvedData.lat && resolvedData.lng) {
      const isPrivate = resolvedData.isPrivate;
      const pinColor = isPrivate ? '#a855f7' : '#ef4444';
      const pinShadow = isPrivate ? 'rgba(168,85,247,0.5)' : 'rgba(239,68,68,0.5)';
      const pinLabel = isPrivate ? '🏢 Project Location' : '📍 Your Search Location';

      const postalMarker = L.marker([resolvedData.lat, resolvedData.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background: ${pinColor};
            border: 3px solid #fff;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 8px ${pinShadow};
            position: relative;
            top: -10px;
            left: -10px;
          "></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(this.map);

      const locationName = resolvedData.projectName || resolvedData.address || resolvedData.input || '';
      let pinPopupHtml = `
        <div style="font-family:Inter,system-ui,sans-serif; font-size:12px; line-height:1.5; min-width:180px; max-height:300px; overflow-y:auto;">
          <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:${pinColor};">${pinLabel}</div>
          <div>${locationName}</div>`;

      // If we saved private project transactions, show them in the pin popup
      if (privateProjectTxs && privateProjectTxs.length > 0) {
        pinPopupHtml += `
          <div style="color:var(--popup-muted); font-size:11px; margin-top:4px; margin-bottom:6px;">${privateProjectTxs.length} transaction${privateProjectTxs.length > 1 ? 's' : ''}</div>`;
        privateProjectTxs.slice(0, 10).forEach((tx, i) => {
          const priceColor = i === 0 ? '#a855f7' : 'var(--popup-price-secondary)';
          pinPopupHtml += `
            <div style="padding:4px 0; ${i > 0 ? 'border-top:1px solid var(--popup-border);' : ''}">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:var(--popup-muted); font-size:11px;">${App.formatMonth(tx.month)}</span>
                <span style="font-weight:700; color:${priceColor}; font-size:13px;">$${App.formatNumber(tx.resale_price)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:2px; font-size:11px; margin-top:2px;">
                <span>${this.shortType(tx.flat_type)} · ${tx.floor_area_sqm}sqm</span>
                <span>$${App.formatNumber(tx.price_per_sqm)}/sqm</span>
              </div>
            </div>`;
        });
      }

      pinPopupHtml += `</div>`;
      postalMarker.bindPopup(pinPopupHtml, { maxHeight: 300 });

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

  highlightAddress(addressKey) {
    this.unhighlight();
    const entry = this.addressMarkers[addressKey];
    if (!entry || !this.map) return;
    const { marker, originalStyle } = entry;
    // Enlarge and brighten
    marker.setStyle({
      radius: originalStyle.radius + 6,
      fillColor: '#fbbf24',
      color: '#fef08a',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    });
    marker.bringToFront();
    marker.openPopup();
    this._highlightedMarker = entry;
  },

  highlightProject(projectName) {
    // For private projects stored by project name (block field)
    this.unhighlight();
    const key = projectName.toUpperCase();
    const entry = this.addressMarkers[key];
    if (!entry || !this.map) return;
    const { marker, originalStyle } = entry;
    marker.setStyle({
      radius: originalStyle.radius + 6,
      fillColor: '#fbbf24',
      color: '#fef08a',
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    });
    marker.bringToFront();
    marker.openPopup();
    this._highlightedMarker = entry;
  },

  unhighlight() {
    if (!this._highlightedMarker) return;
    const { marker, originalStyle } = this._highlightedMarker;
    marker.setStyle(originalStyle);
    marker.closePopup();
    this._highlightedMarker = null;
  },

  shortType(type) {
    const map = {
      'EXECUTIVE CONDOMINIUM': 'EC',
      'STRATA SEMI-DETACHED': 'Strata Semi-D',
      'STRATA DETACHED': 'Strata Detached',
      'STRATA TERRACE': 'Strata Terrace',
      'MULTI-GENERATION': 'Multi-Gen',
      'SEMI-DETACHED': 'Semi-D',
      'CONDOMINIUM': 'Condo',
      'EXECUTIVE': 'Exec',
      'APARTMENT': 'Apt',
      '1 ROOM': '1RM',
      '2 ROOM': '2RM',
      '3 ROOM': '3RM',
      '4 ROOM': '4RM',
      '5 ROOM': '5RM',
    };
    return map[type] || type;
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
    'BP': '#7B7B7B', 'SE': '#9C8B7A', 'SW': '#A89B8A', 'PE': '#7BA09C', 'PW': '#7B9C8B',
  },

  lineNames: {
    'NS': 'North-South', 'EW': 'East-West', 'NE': 'North East',
    'CC': 'Circle', 'DT': 'Downtown', 'TE': 'Thomson-East Coast',
    'CG': 'Changi Airport Br', 'CE': 'Circle Ext', 'BP': 'Bukit Panjang LRT',
    'SE': 'Sengkang LRT East', 'SW': 'Sengkang LRT West', 'PE': 'Punggol LRT East', 'PW': 'Punggol LRT West',
  },

  lineSegments: {
    'NS': [[1, 28]], 'EW': [[1, 33]], 'CG': [[0, 2]],
    'NE': [[1, 17]], 'CC': [[1, 30]], 'CE': [[1, 2]],
    'DT': [[1, 35]], 'TE': [[1, 29]],
    'BP': [[1, 13]], 'SE': [[0, 5]], 'SW': [[0, 8]], 'PE': [[0, 7]], 'PW': [[0, 7]],
  },

  loopLines: new Set(['CC', 'SE', 'SW', 'PE', 'PW']),

  async toggle(map) {
    if (!map) return;

    if (!this.stations) {
      try {
        const resp = await fetch('/data/mrt_stations.json');
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
          const isLrt = ['BP', 'SE', 'SW', 'PE', 'PW'].includes(lineCode);
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
          <div style="color:var(--popup-muted);font-size:11px;">Station codes: ${station.codes.join(' / ')}</div>
        </div>
      `);

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