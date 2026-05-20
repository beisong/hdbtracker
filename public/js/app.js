/**
 * WorthOrNot — Main App Logic (Area Market Overview)
 */

const App = {
  selectedFlatType: 'ALL',
  currentTown: null,
  currentStreet: null,  // street filter for postal code searches
  allTransactions: [],
  lastResolvedData: null,


  async init() {
    Charts.initDefaults();

    try {
      this.setLoadingProgress(20);
      const status = await API.getStatus();
      this.setLoadingProgress(60);

      if (status.total_transactions === 0) {
        this.showError('No transaction data found. Please run the download script first.');
        return;
      }

      document.getElementById('data-status').textContent = `${(status.total_transactions / 1000).toFixed(0)}k transactions`;
      document.getElementById('last-updated').textContent = `Data as of ${this.formatMonth(status.latest_month)}`;

      const townsData = await API.getTowns();
      this.setLoadingProgress(90);

      const townList = document.getElementById('town-list');
      townsData.towns.forEach(town => {
        const option = document.createElement('option');
        option.value = town;
        townList.appendChild(option);
      });

      this.setupEventListeners();
      this.setupTransactionFilters();
      this.setLoadingProgress(100);

      setTimeout(() => {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('loading-fade-out');
        setTimeout(() => overlay.style.display = 'none', 500);
      }, 300);

    } catch (err) {
      console.error('Init error:', err);
      this.showError(`Failed to load: ${err.message}`);
    }
  },

  setupEventListeners() {
    // Flat type buttons
    document.querySelectorAll('.flat-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.flat-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedFlatType = btn.dataset.value;
        // Re-search if we have a town
        if (this.currentTown) {
          this.selectedFlatType = btn.dataset.value;
          this.search();
        }
      });
    });
    document.querySelector('.flat-type-btn[data-value="ALL"]').classList.add('active');

    // Search button
    document.getElementById('search-btn').addEventListener('click', () => this.search());

    // Enter key
    document.getElementById('search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.search();
    });

    // MRT toggle
    document.getElementById('mrt-toggle-btn').addEventListener('click', () => MrtOverlay.toggle(TransactionMap.map));
  },

  async search() {
    const input = document.getElementById('search-input').value.trim();
    if (!input) { this.showAlert('Please enter a town name or 6-digit postal code.'); return; }

    const btn = document.getElementById('search-btn');
    const btnText = document.getElementById('search-btn-text');
    const btnLoading = document.getElementById('search-btn-loading');
    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');

    try {
      // Resolve input to town
      const resolved = await API.resolve(input);
      if (!resolved.resolved) {
        this.showAlert(resolved.message || 'Could not find a matching HDB town.');
        return;
      }

      this.currentTown = resolved.town;
      this.lastResolvedData = resolved;

      // If postal code search, filter by nearby street
      const isPostalCode = /^\d{6}$/.test(input);
      this.currentStreet = (isPostalCode && resolved.road) ? resolved.road : null;

      // Fetch area overview (with street filter for postal codes)
      const data = await API.getAreaOverview(resolved.town, this.selectedFlatType, this.currentStreet);
      const addressInfo = resolved.address ? ` (${resolved.address})` : '';
      this.renderResults(data, addressInfo);

    } catch (err) {
      console.error('Search error:', err);
      this.showAlert(`Search failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
    }
  },

  renderResults(data, addressInfo) {
    const section = document.getElementById('results-section');
    section.classList.remove('hidden');
    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

    // Town header
    const title = data.town;
    document.getElementById('town-title').textContent = title + addressInfo;

    const ts = data.town_summary;

    // Show proximity badge if street-filtered
    const subtitleParts = [];
    if (data.street_filtered && data.street_names.length > 0) {
      subtitleParts.push(`📍 Near ${data.street_names[0]} — ${ts.total_transactions_12m.toLocaleString()} nearby transactions`);
    } else {
      const flatLabel = data.flat_type === 'ALL' ? 'All Types' : data.flat_type;
      subtitleParts.push(`${flatLabel} • ${ts.total_transactions_12m.toLocaleString()} transactions in last 12 months`);
    }
    subtitleParts.push(`Data as of ${this.formatMonth(data.data_as_of)}`);
    document.getElementById('town-subtitle').textContent = subtitleParts.join(' • ');

    // Trend badge
    const trend = data.price_trend;
    const trendBadge = document.getElementById('badge-trend');
    const trendIcon = trend.direction === 'rising' ? '📈' : trend.direction === 'falling' ? '📉' : '➡️';
    const trendClass = trend.direction === 'rising' ? 'text-green-400' : trend.direction === 'falling' ? 'text-red-400' : 'text-amber-400';
    trendBadge.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-dark-700 ${trendClass}`;
    trendBadge.innerHTML = `${trendIcon} ${trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)} ${trend['1y_change'] >= 0 ? '+' : ''}${trend['1y_change']}% YoY`;

    // Volume badge
    document.getElementById('badge-volume').innerHTML = `<span class="w-2 h-2 rounded-full bg-brand-400"></span> ${ts.total_transactions_12m.toLocaleString()} transactions/yr`;

    // Stats cards
    document.getElementById('stat-median').textContent = `$${this.formatNumber(ts.median_price)}`;
    document.getElementById('stat-psm').textContent = `$${this.formatNumber(ts.median_psm)}/sqm`;
    document.getElementById('stat-range').textContent = ts.min_price ? `$${this.formatNumber(ts.min_price / 1000)}k - $${this.formatNumber(ts.max_price / 1000)}k` : '--';
    document.getElementById('stat-popular').textContent = ts.most_popular_type || '--';

    // Price by flat type cards
    const container = document.getElementById('price-type-cards');
    container.innerHTML = '';
    data.prices_by_type.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-dark-700 rounded-xl border border-white/5 p-3 hover:border-brand-500/30 transition-colors cursor-default';
      card.innerHTML = `
        <div class="text-xs text-gray-500 mb-1">${item.flat_type}</div>
        <div class="text-base font-bold">$${this.formatNumber(item.median_price)}</div>
        <div class="text-xs text-gray-400 mt-0.5">$${this.formatNumber(item.median_psm)}/sqm</div>
        <div class="text-xs text-gray-600 mt-1">${item.count} sales</div>
      `;
      container.appendChild(card);
    });

    // Percentiles
    const pp = data.price_percentiles;
    document.getElementById('p10').textContent = pp.p10 ? `$${this.formatNumber(pp.p10)}` : '--';
    document.getElementById('p25').textContent = pp.p25 ? `$${this.formatNumber(pp.p25)}` : '--';
    document.getElementById('p50').textContent = pp.p50 ? `$${this.formatNumber(pp.p50)}` : '--';
    document.getElementById('p75').textContent = pp.p75 ? `$${this.formatNumber(pp.p75)}` : '--';
    document.getElementById('p90').textContent = pp.p90 ? `$${this.formatNumber(pp.p90)}` : '--';

    // Trend values
    const fmtPct = (v) => {
      if (v === 0 || v === null || v === undefined) return '--';
      const cls = v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
      return `<span class="${cls}">${v >= 0 ? '+' : ''}${v}%</span>`;
    };
    document.getElementById('trend-6m').innerHTML = fmtPct(trend['6m_change']);
    document.getElementById('trend-1y').innerHTML = fmtPct(trend['1y_change']);
    document.getElementById('trend-3y').innerHTML = fmtPct(trend['3y_change']);
    document.getElementById('trend-5y').innerHTML = fmtPct(trend['5y_change']);

    // Charts
    Charts.renderTrendChart(data.trend_data || []);
    if (data.distribution && data.distribution.bins.length > 0) {
      Charts.renderDistributionChart(data.distribution.bins, data.distribution.counts);
    }

    // Transactions table
    this.allTransactions = data.recent_transactions || [];
    this.populateTypeFilter(this.allTransactions);
    this.applyTransactionFilters();

    // Reset filter inputs
    document.getElementById('tx-search').value = '';
    document.getElementById('tx-filter-type').value = '';
    document.getElementById('tx-filter-storey').value = '';
    document.getElementById('tx-filter-lease').value = '';
    document.getElementById('tx-sort').value = 'date-desc';

    // Load map
    TransactionMap.load(this.allTransactions, this.lastResolvedData);
  },

  setupTransactionFilters() {
    document.getElementById('tx-search').addEventListener('input', () => this.applyTransactionFilters());
    document.getElementById('tx-filter-type').addEventListener('change', () => this.applyTransactionFilters());
    document.getElementById('tx-filter-storey').addEventListener('change', () => this.applyTransactionFilters());
    document.getElementById('tx-filter-lease').addEventListener('change', () => this.applyTransactionFilters());
    document.getElementById('tx-sort').addEventListener('change', () => this.applyTransactionFilters());
  },

  populateTypeFilter(transactions) {
    const select = document.getElementById('tx-filter-type');
    const currentVal = select.value;
    // Keep "All Types" option, remove others
    while (select.options.length > 1) select.remove(1);
    const types = [...new Set(transactions.map(tx => tx.flat_type))].sort();
    types.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      select.appendChild(opt);
    });
    select.value = currentVal;
  },

  applyTransactionFilters() {
    const searchTerm = (document.getElementById('tx-search').value || '').toUpperCase().trim();
    const typeFilter = document.getElementById('tx-filter-type').value;
    const storeyFilter = document.getElementById('tx-filter-storey').value;
    const leaseFilter = document.getElementById('tx-filter-lease').value;
    const sortBy = document.getElementById('tx-sort').value;

    let filtered = [...this.allTransactions];

    // Text search: match block, street_name, flat_model
    if (searchTerm) {
      filtered = filtered.filter(tx => {
        const haystack = `${tx.block} ${tx.street_name} ${tx.flat_model} ${tx.flat_type} ${tx.storey_range}`.toUpperCase();
        return haystack.includes(searchTerm);
      });
    }

    // Type filter
    if (typeFilter) {
      filtered = filtered.filter(tx => tx.flat_type === typeFilter);
    }

    // Storey filter
    if (storeyFilter) {
      filtered = filtered.filter(tx => {
        const sr = tx.storey_range || '';
        if (storeyFilter === 'low') return sr.match(/^(0[1-6])/);
        if (storeyFilter === 'mid') return sr.match(/^(0[7-9]|1[0-8])/);
        if (storeyFilter === 'high') return sr.match(/^(19|2[0-9]|3[0-9]|4[0-9]|5[0-9])/);
        return true;
      });
    }

    // Lease filter
    if (leaseFilter) {
      filtered = filtered.filter(tx => {
        const lease = tx.remaining_lease_years || 0;
        if (leaseFilter === 'short') return lease < 60;
        if (leaseFilter === 'med') return lease >= 60 && lease < 80;
        if (leaseFilter === 'long') return lease >= 80 && lease < 95;
        if (leaseFilter === 'fresh') return lease >= 95;
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return b.month.localeCompare(a.month) || b.resale_price - a.resale_price;
        case 'date-asc': return a.month.localeCompare(b.month) || a.resale_price - b.resale_price;
        case 'price-desc': return b.resale_price - a.resale_price;
        case 'price-asc': return a.resale_price - b.resale_price;
        case 'psm-desc': return (b.price_per_sqm || 0) - (a.price_per_sqm || 0);
        case 'psm-asc': return (a.price_per_sqm || 0) - (b.price_per_sqm || 0);
        case 'area-desc': return (b.floor_area_sqm || 0) - (a.floor_area_sqm || 0);
        case 'area-asc': return (a.floor_area_sqm || 0) - (b.floor_area_sqm || 0);
        case 'lease-desc': return (b.remaining_lease_years || 0) - (a.remaining_lease_years || 0);
        case 'lease-asc': return (a.remaining_lease_years || 0) - (b.remaining_lease_years || 0);
        default: return 0;
      }
    });

    // Update count
    const countEl = document.getElementById('tx-count');
    if (countEl) {
      countEl.textContent = `(${filtered.length} of ${this.allTransactions.length})`;
    }

    this.renderTransactionsTable(filtered);
  },

  renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-table');
    tbody.innerHTML = '';

    if (!transactions || transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-gray-500">No transactions match your filters</td></tr>`;
      return;
    }

    transactions.forEach(tx => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-white/5 hover:bg-white/[0.02] transition-colors';

      const address = `${tx.block} ${tx.street_name || ''} Singapore`.trim();
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      const leaseDisplay = tx.remaining_lease_years ? `${Math.round(tx.remaining_lease_years)}y` : '--';

      tr.innerHTML = `
        <td class="py-2.5 pr-3 text-gray-400 whitespace-nowrap text-xs">${this.formatMonth(tx.month)}</td>
        <td class="py-2.5 pr-3 whitespace-nowrap">
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
             class="text-brand-400 hover:text-brand-300 text-xs underline decoration-brand-400/30 hover:decoration-brand-300 transition-colors"
             title="View on Google Maps">
            ${tx.block} ${tx.street_name || ''}
            <svg class="w-3 h-3 inline -mt-0.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
        </td>
        <td class="py-2.5 pr-3 whitespace-nowrap text-xs">
          <span class="px-1.5 py-0.5 rounded bg-dark-600/50 text-gray-300">${tx.flat_type}</span>
        </td>
        <td class="py-2.5 pr-3 text-right text-gray-400 whitespace-nowrap text-xs">${tx.storey_range || '--'}</td>
        <td class="py-2.5 pr-3 text-right whitespace-nowrap text-xs">${tx.floor_area_sqm} sqm</td>
        <td class="py-2.5 pr-3 text-right text-gray-400 whitespace-nowrap text-xs">${leaseDisplay}</td>
        <td class="py-2.5 pr-3 text-right font-semibold text-xs">$${this.formatNumber(tx.resale_price)}</td>
        <td class="py-2.5 text-right text-gray-400 text-xs">$${this.formatNumber(tx.price_per_sqm)}</td>
      `;

      tbody.appendChild(tr);
    });
  },

  formatMonth(monthStr) {
    if (!monthStr) return '--';
    const [y, m] = monthStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
  },

  formatNumber(num) {
    if (num === null || num === undefined) return '--';
    return Math.round(num).toLocaleString('en-SG');
  },

  setLoadingProgress(pct) {
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = pct + '%';
  },

  showError(message) {
    const overlay = document.getElementById('loading-overlay');
    overlay.innerHTML = `
      <div class="text-center px-4">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 mb-4">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
        </div>
        <h2 class="text-xl font-bold mb-2">Something went wrong</h2>
        <p class="text-gray-400 mb-4 max-w-md">${message}</p>
        <button onclick="location.reload()" class="px-4 py-2 bg-brand-600 rounded-lg text-sm font-medium hover:bg-brand-500 transition-colors">Try Again</button>
      </div>
    `;
  },

  showAlert(message) {
    document.querySelectorAll('.app-alert').forEach(el => el.remove());
    const alert = document.createElement('div');
    alert.className = 'app-alert fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-dark-800 border border-red-500/30 text-red-300 px-6 py-3 rounded-xl shadow-lg text-sm font-medium';
    alert.textContent = message;
    document.body.appendChild(alert);
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.3s';
      setTimeout(() => alert.remove(), 300);
    }, 4000);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());