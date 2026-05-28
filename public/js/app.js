/**
 * WorthIt — Main App Logic (Area Market Overview)
 */

const App = {
  selectedFlatTypes: new Set(),
  currentTown: null,
  currentStreet: null,  // street filter for postal code searches
  allTransactions: [],
  lastResolvedData: null,
  // Autocomplete state
  _acItems: [],
  _acIndex: -1,
  _acDebounce: null,

  /** GA4 custom event tracking helper */
  track(name, params = {}) {
    if (typeof gtag === 'function') gtag('event', name, params);
  },


  async init() {
    Charts.initDefaults();
    this.initTheme();
    this.setupEventListeners();
    this.setupTransactionFilters();

    try {
      this.setLoadingProgress(20);

      // Run both API calls in parallel — towns data only needed for autocomplete
      const [status, townsData] = await Promise.all([
        API.getStatus(),
        API.getTowns(),
      ]);
      this.setLoadingProgress(100);

      if (status.total_transactions === 0) {
        this.showError('No transaction data found. Please run the download script first.');
        return;
      }

      document.getElementById('last-updated').textContent = `Data as of ${this.formatMonth(status.latest_month)}`;

      // Store for autocomplete
      this._towns = townsData.towns || [];
      this._districts = townsData.districts || [];

      // Dismiss overlay immediately — no artificial delay
      const overlay = document.getElementById('loading-overlay');
      overlay.classList.add('loading-fade-out');
      setTimeout(() => overlay.style.display = 'none', 500);

      // Handle URL-based routing (e.g. /hdb/bedok, /private/sky-habitat)
      await this.handleUrlRoute();
      // Listen for back/forward navigation
      window.addEventListener('popstate', () => {
        this.handleUrlRoute();
        // Track SPA pageview for back/forward navigation in Google Analytics
        if (typeof gtag === 'function') gtag('event', 'page_view', { page_path: window.location.pathname });
      });

    } catch (err) {
      console.error('Init error:', err);
      this.showError(`Failed to load: ${err.message}`);
    }
  },

  /** Read URL path and trigger appropriate search */
  async handleUrlRoute() {
    const path = window.location.pathname;

    // /hdb/<town-slug>
    const hdbMatch = path.match(/^\/hdb\/(.+)$/);
    if (hdbMatch) {
      const slug = hdbMatch[1];
      // Try to match slug to a known town
      const townSlug = slug.toUpperCase().replace(/-/g, ' ');
      const town = this._towns.find(t =>
        t === townSlug ||
        t.replace(/[^A-Z0-9]/g, ' ') === townSlug.replace(/[^A-Z0-9]/g, ' ') ||
        t.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug
      );
      if (town) {
        document.getElementById('search-input').value = town.replace(/\w\S*/g, w => w.charAt(0) + w.slice(1).toLowerCase());
        await this.search();
        return;
      }
    }

    // /district/<code>
    const distMatch = path.match(/^\/district\/(\d{1,2})$/);
    if (distMatch) {
      const code = distMatch[1].padStart(2, '0');
      document.getElementById('search-input').value = `D${code}`;
      await this.search();
      return;
    }

    // /private/<project-slug>
    const privMatch = path.match(/^\/private\/(.+)$/);
    if (privMatch) {
      const slug = privMatch[1];
      // Try searching as a project name (replace hyphens with spaces)
      const projectName = slug.replace(/-/g, ' ');
      document.getElementById('search-input').value = projectName.replace(/\w\S*/g, w => w.charAt(0) + w.slice(1).toLowerCase());
      await this.search();
      return;
    }

    // /?q=<query> — search parameter
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      document.getElementById('search-input').value = q;
      await this.search();
    }
  },

  /** Update the browser URL and document meta tags after a search */
  updateSeoForSearch(type, data) {
    const baseUrl = 'https://worthit.canlah.app';
    let path = '/';
    let title = 'WorthIt — Singapore HDB Resale Prices & Property Transaction Checker';
    let description = 'Check HDB resale prices, property transaction history, and fair value estimates for Singapore flats and condos.';

    if (type === 'hdb' && data?.town) {
      const slug = data.town.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      path = `/hdb/${slug}`;
      const townDisplay = data.town.replace(/\w\S*/g, w => w.charAt(0) + w.slice(1).toLowerCase());
      const ts = data.town_summary;
      title = `${townDisplay} HDB Resale Prices & Transaction History | WorthIt`;
      description = `Check ${townDisplay} HDB resale flat prices and transaction history. ${ts?.total_transactions_12m?.toLocaleString() || 0} recent transactions. Compare Deal Scores from data.gov.sg records.`;
    } else if (type === 'district' && data?.district) {
      path = `/district/${data.district}`;
      title = `${data.district_label || 'D' + data.district} — Private Property Prices | WorthIt`;
      description = `Check private property resale prices in ${data.district_label || 'District ' + data.district}. View top projects, price trends, and URA transaction data.`;
    } else if (type === 'private' && data?.project) {
      const slug = data.project.project.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      path = `/private/${slug}`;
      title = `${data.project.project} Resale Transaction Prices | WorthIt`;
      description = `View ${data.project.project} resale prices and history. ${data.project.total_transactions?.toLocaleString() || 0} transactions in District ${data.project.district}.`;
    }

    // Update browser URL (no reload)
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== path) {
      history.pushState({ type, path }, '', path);
      // Track SPA pageview in Google Analytics
      if (typeof gtag === 'function') gtag('event', 'page_view', { page_path: path });
    }

    // Update document title and meta tags
    document.title = title;
    this._updateMeta('description', description);
    this._updateLink('canonical', baseUrl + path);
    this._updateOgMeta('og:title', title);
    this._updateOgMeta('og:description', description);
    this._updateOgMeta('og:url', baseUrl + path);
  },

  _updateMeta(name, content) {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (el) el.setAttribute('content', content);
  },

  _updateOgMeta(property, content) {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (el) el.setAttribute('content', content);
  },

  _updateLink(rel, href) {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (el) el.setAttribute('href', href);
  },

  setupEventListeners() {
    // Flat type buttons — multi-select; ALL clears selection
    document.querySelectorAll('.flat-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.value;
        if (value === 'ALL') {
          this.selectedFlatTypes.clear();
        } else if (this.selectedFlatTypes.has(value)) {
          this.selectedFlatTypes.delete(value);
        } else {
          this.selectedFlatTypes.add(value);
        }
        // GA4 Event 5: select_flat_type
        this.track('select_flat_type', { flat_types: this._getFlatTypeParam() });
        this._updateFlatTypeUI();
        if (this.currentTown) this.search();
      });
    });
    this._updateFlatTypeUI();

    // Search button
    document.getElementById('search-btn').addEventListener('click', () => { this.hideAc(); this.search(); });

    // Autocomplete: input, keyboard nav, blur
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => this.onAcInput());
    searchInput.addEventListener('keydown', (e) => this.onAcKeydown(e));
    searchInput.addEventListener('blur', () => setTimeout(() => this.hideAc(), 200));
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length >= 1) this.onAcInput();
      // On mobile, scroll the input into view after the keyboard opens (300ms delay)
      if (window.innerWidth < 640) setTimeout(() => searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    });

    // MRT toggle
    document.getElementById('mrt-toggle-btn').addEventListener('click', () => MrtOverlay.toggle(TransactionMap.map));

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

    // Share button
    document.getElementById('share-btn').addEventListener('click', () => this.share());

    // GA4 Event 3: click_outbound — event delegation for Google Maps links in transactions
    document.getElementById('results-section').addEventListener('click', (e) => {
      const link = e.target.closest('a[href*="google.com/maps"]');
      if (link) {
        const row = link.closest('tr, .tx-card');
        const priceEl = row?.querySelector('.font-semibold, .text-lg');
        const isPrivate = row?.querySelector('[class*="purple"]') !== null;
        this.track('click_outbound', {
          address: link.textContent.trim().replace(/\s+/g, ' '),
          property_type: isPrivate ? 'private' : 'HDB',
        });
      }
    });

    // Floating "New Search" FAB — scroll to search + focus
    document.getElementById('new-search-fab').addEventListener('click', () => {
      const input = document.getElementById('search-input');
      input.value = '';
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => input.focus(), 400);
    });
  },

  _updateFlatTypeUI() {
    document.querySelectorAll('.flat-type-btn').forEach(b => {
      const val = b.dataset.value;
      if (val === 'ALL') {
        b.classList.toggle('active', this.selectedFlatTypes.size === 0);
      } else {
        b.classList.toggle('active', this.selectedFlatTypes.has(val));
      }
    });
  },

  _getFlatTypeParam() {
    return this.selectedFlatTypes.size === 0 ? 'ALL' : [...this.selectedFlatTypes].join(',');
  },

  _onResultsShown() {
    // Show section jump bar and floating FAB (mobile only — hidden via CSS on sm+)
    const jumpBar = document.getElementById('section-jump-bar');
    const fab = document.getElementById('new-search-fab');
    if (jumpBar) jumpBar.classList.remove('hidden');
    if (fab) fab.classList.remove('hidden');
  },

  share() {
    const url = window.location.href;
    const title = document.getElementById('town-title')?.textContent?.trim() || 'WorthIt';
    const text = `${title} — Singapore property prices on WorthIt`;
    // GA4 Event 8: share
    if (navigator.share) {
      this.track('share', { method: 'web_share_api', page_path: window.location.pathname });
      navigator.share({ title, text, url }).catch(() => {});
    } else {
      this.track('share', { method: 'clipboard', page_path: window.location.pathname });
      navigator.clipboard.writeText(url).then(() => this.showToast('Link copied!')).catch(() => this.showToast('Copy failed'));
    }
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
  },

  clearTransactionFilters() {
    document.getElementById('tx-search').value = '';
    document.getElementById('tx-filter-type').value = '';
    document.getElementById('tx-filter-storey').value = '';
    document.getElementById('tx-filter-lease').value = '';
    document.getElementById('tx-sort').value = 'date-desc';
    this.setupTransactionFilters();
    this.renderTransactionsTable(this.allTransactions);
  },

  initTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    this.updateThemeIcons(isDark);
  },

  toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    this.updateThemeIcons(isDark);
    // Re-render charts and map tiles
    Charts.rerender();
    TransactionMap.updateTheme();
  },

  updateThemeIcons(isDark) {
    const sun = document.getElementById('theme-icon-sun');
    const moon = document.getElementById('theme-icon-moon');
    if (isDark) {
      sun.classList.remove('hidden');
      moon.classList.add('hidden');
    } else {
      sun.classList.add('hidden');
      moon.classList.remove('hidden');
    }
  },

  async search() {
    const input = document.getElementById('search-input').value.trim();
    if (!input) { this.showAlert('Please enter a town name, postal code, or project name.'); return; }

    // GA4 Event 1: search — determine search type for tracking
    const _isPostal = /^\d{6}$/.test(input);
    const _isDistrict = /^(?:D(?:ISTRICT)?\s*)(\d{1,2})$/i.test(input);
    const _searchType = _isPostal ? 'postal' : _isDistrict ? 'district' : 'town';
    this.track('search', { search_type: _searchType, query: input });

    const btn = document.getElementById('search-btn');
    const btnText = document.getElementById('search-btn-text');
    const btnLoading = document.getElementById('search-btn-loading');
    btn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');

    try {
      const isPostalCode = /^\d{6}$/.test(input);

      // Check if input is a district code (e.g., "D01", "D22", "District 22")
      const districtMatch = input.match(/^(?:D(?:ISTRICT)?\s*)(\d{1,2})$/i);
      if (districtMatch) {
        const districtCode = districtMatch[1].padStart(2, '0');
        const data = await API.getDistrictOverview(districtCode);
        if (data.found) {
          this.currentTown = null;
          this.lastResolvedData = {
            lat: null,
            lng: null,
            town: null,
            isDistrict: true,
            district: data.district,
          };
          this.renderDistrictResults(data);
          return;
        }
        this.track('search_failed', { query: input, failure_reason: 'no_district_data' });
        this.showAlert(`No data found for District ${districtCode}.`);
        return;
      }

      // First, try to resolve as HDB town/postal code (prioritize town names over private projects)
      const resolved = await API.resolve(input);
      if (resolved.resolved) {
        // Successfully matched as HDB town — show HDB results
      } else if (!isPostalCode) {
        // Not a known HDB town and not a postal code — try matching private property projects
        const projectResults = await API.searchPrivateProjects(input, 5);
        if (projectResults.projects && projectResults.projects.length > 0) {
          const exact = projectResults.projects.find(p =>
            p.project.toUpperCase() === input.toUpperCase()
          );
          const privateProject = exact || projectResults.projects[0];
          const data = await API.getPrivateProjectOverview(privateProject.project);
          if (data.found) {
            this.currentTown = null;
            this.lastResolvedData = {
              lat: data.coordinates?.lat || null,
              lng: data.coordinates?.lng || null,
              town: null,
              projectName: data.project?.project,
              isPrivate: true,
            };
            this.renderPrivateResults(data, '');
            return;
          }
        }

        // Also try private project match from building name if postal code resolved partially
        if (isPostalCode && resolved.building) {
          const buildingResults = await API.searchPrivateProjects(resolved.building, 3);
          if (buildingResults.projects && buildingResults.projects.length > 0) {
            const data = await API.getPrivateProjectOverview(buildingResults.projects[0].project);
            if (data.found) {
              this.lastResolvedData = { lat: resolved.lat, lng: resolved.lng, town: null };
              this.renderPrivateResults(data, ` (${resolved.address})`);
              return;
            }
          }
        }

        this.track('search_failed', { query: input, failure_reason: 'no_hdb_no_private' });
        this.showAlert(resolved.message || 'Could not find a matching location.');
        return;
      } else {
        // Postal code didn't resolve as HDB — try private project from building name
        if (resolved.building) {
          const buildingResults = await API.searchPrivateProjects(resolved.building, 3);
          if (buildingResults.projects && buildingResults.projects.length > 0) {
            const data = await API.getPrivateProjectOverview(buildingResults.projects[0].project);
            if (data.found) {
              this.lastResolvedData = { lat: resolved.lat, lng: resolved.lng, town: null };
              this.renderPrivateResults(data, ` (${resolved.address})`);
              return;
            }
          }
        }
        this.track('search_failed', { query: input, failure_reason: 'postal_no_match' });
        this.showAlert(resolved.message || 'Could not find a matching location.');
        return;
      }

      this.currentTown = resolved.town;
      this.lastResolvedData = resolved;

      // If postal code search, find nearby streets via Nominatim reverse geocoding
      let nearbyStreets = null;
      if (isPostalCode && resolved.lat && resolved.lng) {
        try {
          const nearby = await API.getNearbyStreets(resolved.lat, resolved.lng, resolved.town);
          if (nearby.streets && nearby.streets.length > 0) {
            nearbyStreets = nearby.streets.join(",");
          }
        } catch (err) {
          console.warn("Nearby streets lookup failed, falling back to single street:", err.message);
        }

        // Also try to match building name to private projects
        if (resolved.building && resolved.building !== 'NIL') {
          try {
            const buildingResults = await API.searchPrivateProjects(resolved.building, 3);
            if (buildingResults.projects && buildingResults.projects.length > 0) {
              // Load HDB data as primary, but note private data is available
              this.nearbyPrivateProject = buildingResults.projects[0];
            }
          } catch (err) {
            // Ignore private project search errors
          }
        }
      }
      this.currentStreet = (isPostalCode && resolved.road) ? resolved.road : null;

      // Fetch area overview (with nearby streets for postal codes)
      const data = await API.getAreaOverview(resolved.town, this._getFlatTypeParam(), this.currentStreet, nearbyStreets);
      const addressInfo = resolved.address ? ` (${resolved.address})` : '';
      this.renderResults(data, addressInfo);

    } catch (err) {
      console.error('Search error:', err);
      this.track('search_failed', { query: input, failure_reason: 'error', error_message: err.message });
      this.showAlert(`Search failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
    }
  },

  renderResults(data, addressInfo) {
    // GA4 Event 2: view_results
    this.track('view_results', {
      result_type: 'hdb',
      location: data.town,
      transaction_count: data.town_summary?.total_transactions_12m || 0,
    });

    const section = document.getElementById('results-section');
    section.classList.remove('hidden');
    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    this._onResultsShown();

    // Town header
    const title = data.town;
    document.getElementById('town-title').textContent = title + addressInfo;

    const ts = data.town_summary;

    // Show proximity badge if street-filtered
    const subtitleParts = [];
    if (data.street_filtered && data.street_names.length > 0) {
      subtitleParts.push(`📍 Near ${data.street_names[0]} — ${ts.total_transactions_12m.toLocaleString()} nearby transactions`);
    } else {
      const flatLabel = data.flat_type === 'ALL' ? 'All Types' : data.flat_type.split(',').join(' + ');
      subtitleParts.push(`${flatLabel} • ${ts.total_transactions_12m.toLocaleString()} transactions in last 12 months`);
    }
    subtitleParts.push(`Data as of ${this.formatMonth(data.data_as_of)}`);
    document.getElementById('town-subtitle').textContent = subtitleParts.join(' • ');

    // Trend badge
    const trend = data.price_trend;
    const trendBadge = document.getElementById('badge-trend');
    const trendIcon = trend.direction === 'rising' ? '📈' : trend.direction === 'falling' ? '📉' : '➡️';
    const trendClass = trend.direction === 'rising' ? 'text-green-400' : trend.direction === 'falling' ? 'text-red-400' : 'text-amber-400';
    trendBadge.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-dark-700 ${trendClass}`;
    trendBadge.innerHTML = `${trendIcon} ${trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)} ${trend['1y_change'] >= 0 ? '+' : ''}${trend['1y_change']}% YoY`;

    // Volume badge
    document.getElementById('badge-volume').innerHTML = `<span class="w-2 h-2 rounded-full bg-brand-400"></span> ${ts.total_transactions_12m.toLocaleString()} transactions/yr`;

    // Stats cards
    document.getElementById('stat-median').textContent = `$${this.formatNumber(ts.median_price)}`;
    document.getElementById('stat-psm').textContent = `$${this.formatNumber(this.psmToPsf(ts.median_psm))}/sqft`;
    document.getElementById('stat-range').textContent = ts.min_price ? `$${this.formatNumber(ts.min_price / 1000)}k - $${this.formatNumber(ts.max_price / 1000)}k` : '--';
    document.getElementById('stat-popular').textContent = ts.most_popular_type || '--';

    // Price by flat type cards
    const container = document.getElementById('price-type-cards');
    container.innerHTML = '';
    data.prices_by_type.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-gray-100 dark:bg-dark-700 rounded-xl border border-gray-200 dark:border-white/5 p-3 hover:border-brand-500/30 transition-colors cursor-default';
      card.innerHTML = `
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">${item.flat_type}</div>
        <div class="text-base font-bold">$${this.formatNumber(item.median_price)}</div>
        <div class="text-xs text-gray-400 mt-0.5">$${this.formatNumber(this.psmToPsf(item.median_psm))}/sqft</div>
        <div class="text-xs text-gray-600 dark:text-gray-500 mt-1">${item.count} sales</div>
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

    // Charts — HDB primary, private secondary (if available for related districts)
    Charts.renderTrendChart(data.trend_data || [], data.private_trend_data || null);
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

    // Hide private summary section (HDB view)
    const privateSummaryEl = document.getElementById('private-summary-section');
    if (privateSummaryEl) privateSummaryEl.classList.add('hidden');

    // Load map
    TransactionMap.load(this.allTransactions, this.lastResolvedData);

    // Update URL and meta for HDB search
    this.updateSeoForSearch('hdb', data);

    // Fetch private property summary for this town's districts
    this.loadPrivateSummaryForTown(data.town);

    // Also fetch nearby private projects and add them to the map
    const resolved = this.lastResolvedData;
    if (resolved && resolved.lat && resolved.lng) {
      API.getNearbyHDB(resolved.lat, resolved.lng).then(hdbData => {
        if (hdbData.nearby_projects && hdbData.nearby_projects.length > 0) {
          TransactionMap.addNearbyProjects(hdbData.nearby_projects, null);
        }
      }).catch(err => {
        console.warn('Failed to load nearby private projects:', err.message);
      });
    }
  },

  // Town → district mapping (mirrors server-side TOWN_TO_DISTRICTS)
  TOWN_TO_DISTRICTS: {
    'ANG MO KIO': ['20'], 'BEDOK': ['16'], 'BISHAN': ['11', '20'],
    'BUKIT BATOK': ['23'], 'BUKIT MERAH': ['04'], 'BUKIT PANJANG': ['23'],
    'BUKIT TIMAH': ['10', '21'], 'CENTRAL AREA': ['01', '02', '06', '07'],
    'CHOA CHU KANG': ['23', '24'], 'CLEMENTI': ['05', '21'],
    'GEYLANG': ['14'], 'HOUGANG': ['19', '28'],
    'JURONG EAST': ['22'], 'JURONG WEST': ['22', '24'],
    'KALLANG/WHAMPOA': ['08', '12', '13'], 'MARINE PARADE': ['15'],
    'PASIR RIS': ['17', '18'], 'PUNGGOL': ['19', '28'],
    'QUEENSTOWN': ['03', '05'], 'SEMBAWANG': ['27'],
    'SENGKANG': ['19', '28'], 'SERANGOON': ['19'],
    'TAMPINES': ['18'], 'TOA PAYOH': ['11', '12'],
    'WOODLANDS': ['25', '26'], 'YISHUN': ['27'],
  },

  async loadPrivateSummaryForTown(town) {
    const districts = this.TOWN_TO_DISTRICTS[town];
    if (!districts || districts.length === 0) return;

    try {
      const data = await API.getDistrictSummary(districts);
      if (data.found) {
        this.renderPrivateSummary(data);
      }
    } catch (err) {
      console.warn('Failed to load private property summary:', err.message);
    }
  },

  renderPrivateSummary(data) {
    const section = document.getElementById('private-summary-section');
    if (!section) return;
    section.classList.remove('hidden');

    const s = data.summary;
    document.getElementById('private-summary-stats').innerHTML = `
      <div class="flex items-center gap-4 flex-wrap">
        <div>
          <div class="text-xs text-purple-500 dark:text-purple-300/60 uppercase tracking-wider">Avg Price</div>
          <div class="text-lg font-bold text-purple-700 dark:text-purple-200">$${this.formatNumber(s.avg_price)}</div>
        </div>
        <div>
          <div class="text-xs text-purple-500 dark:text-purple-300/60 uppercase tracking-wider">Avg $/sqft</div>
          <div class="text-lg font-bold text-purple-700 dark:text-purple-200">$${this.formatNumber(this.psmToPsf(s.avg_psm))}</div>
        </div>
        <div>
          <div class="text-xs text-purple-500 dark:text-purple-300/60 uppercase tracking-wider">Transactions (12m)</div>
          <div class="text-lg font-bold text-purple-700 dark:text-purple-200">${s.total_transactions.toLocaleString()}</div>
        </div>
        <div>
          <div class="text-xs text-purple-500 dark:text-purple-300/60 uppercase tracking-wider">Price Range</div>
          <div class="text-sm font-medium text-purple-700 dark:text-purple-200">$${this.formatNumber(s.min_price / 1000)}k – $${this.formatNumber(s.max_price / 1000)}k</div>
        </div>
      </div>
    `;

    // Top projects list
    const projectsEl = document.getElementById('private-summary-projects');
    if (data.top_projects && data.top_projects.length > 0) {
      projectsEl.innerHTML = `
        <div class="text-xs text-gray-500 mb-2">Top Projects</div>
        <div class="flex flex-wrap gap-2">
          ${data.top_projects.slice(0, 8).map(p => `
            <button onclick="document.getElementById('search-input').value='${p.project.replace(/'/g, "\\'")}';App.search();"
              class="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs hover:bg-purple-200 dark:hover:bg-purple-500/20 hover:border-purple-300 dark:hover:border-purple-500/40 transition-colors cursor-pointer">
              ${p.project} <span class="text-purple-500 dark:text-purple-300/50">${p.tx_count}</span>
            </button>
          `).join('')}
        </div>
      `;
    } else {
      projectsEl.innerHTML = '';
    }

    // Build project_coords lookup for attaching lat/lng to transactions
    const projectGeoMap = {};
    if (data.project_coords) {
      for (const pc of data.project_coords) {
        if (pc.latitude && pc.longitude) {
          projectGeoMap[pc.project.toUpperCase()] = { lat: pc.latitude, lng: pc.longitude };
        }
      }
    }

    // Merge private transactions into the main transaction list
    if (data.recent_transactions && data.recent_transactions.length > 0) {
      const privateTxs = data.recent_transactions.map(tx => {
        const coords = projectGeoMap[(tx.project || '').toUpperCase()];
        return {
          month: tx.month,
          town: 'PRIVATE',
          flat_type: tx.property_type || tx.flat_type,
          block: tx.project || '--',
          street_name: tx.project || '--',
          storey_range: tx.storey_range || '--',
          floor_area_sqm: tx.floor_area_sqm,
          flat_model: tx.tenure || '--',
          remaining_lease_years: tx.remaining_lease_years,
          resale_price: tx.resale_price,
          price_per_sqm: tx.price_per_sqm,
          is_private: true,
          is_freehold: tx.tenure === 'FREEHOLD',
          // Attach coordinates from project_coords if available
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        };
      });
      // Prepend private transactions (sorted by date) to existing HDB transactions
      this.allTransactions = [...privateTxs, ...this.allTransactions];
      this.populateTypeFilter(this.allTransactions);
      this.applyTransactionFilters();

      // Re-load map with combined transactions (HDB + private with coordinates)
      TransactionMap.load(this.allTransactions, this.lastResolvedData);
    }
  },

  renderDistrictResults(data) {
    // GA4 Event 2: view_results
    this.track('view_results', {
      result_type: 'district',
      location: `D${data.district}`,
      transaction_count: data.summary?.total_transactions || 0,
    });

    const section = document.getElementById('results-section');
    section.classList.remove('hidden');
    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    this._onResultsShown();

    // District header with label
    document.getElementById('town-title').innerHTML =
      `<span class="inline-flex items-center gap-2">` +
      `<span class="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold uppercase tracking-wider">District</span>` +
      `${data.district_label}</span>`;

    const s = data.summary;
    const subtitleParts = [];
    if (data.related_hdb_towns && data.related_hdb_towns.length > 0) {
      subtitleParts.push(`HDB Towns: ${data.related_hdb_towns.join(', ')}`);
    }
    subtitleParts.push(`${s.total_transactions.toLocaleString()} private transactions in 12 months`);
    document.getElementById('town-subtitle').textContent = subtitleParts.join(' • ');

    // Trend badge
    const trend = data.price_trend;
    const trendBadge = document.getElementById('badge-trend');
    const trendIcon = trend.direction === 'rising' ? '📈' : trend.direction === 'falling' ? '📉' : '➡️';
    const trendClass = trend.direction === 'rising' ? 'text-green-400' : trend.direction === 'falling' ? 'text-red-400' : 'text-amber-400';
    trendBadge.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-dark-700 ${trendClass}`;
    trendBadge.innerHTML = `${trendIcon} ${trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)} ${trend['1y_change'] >= 0 ? '+' : ''}${trend['1y_change']}% YoY`;

    // Volume badge
    document.getElementById('badge-volume').innerHTML = `<span class="w-2 h-2 rounded-full bg-purple-400"></span> ${s.total_transactions.toLocaleString()} transactions/yr`;

    // Stats cards
    document.getElementById('stat-median').textContent = `$${this.formatNumber(s.avg_price)}`;
    document.getElementById('stat-psm').textContent = `$${this.formatNumber(this.psmToPsf(s.avg_psm))}/sqft`;
    document.getElementById('stat-range').textContent = s.min_price ? `$${this.formatNumber(s.min_price / 1000)}k - $${this.formatNumber(s.max_price / 1000)}k` : '--';
    document.getElementById('stat-popular').textContent = data.related_hdb_towns ? data.related_hdb_towns[0] : '--';

    // Price by property type cards
    const container = document.getElementById('price-type-cards');
    container.innerHTML = '';
    data.prices_by_type.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-gray-100 dark:bg-dark-700 rounded-xl border border-purple-500/10 p-3 hover:border-purple-500/30 transition-colors cursor-default';
      const bedEst = this.estimateBedrooms(item.avg_area, item.property_type);
      card.innerHTML = `
        <div class="text-xs text-purple-500 dark:text-purple-300 mb-1">${item.property_type} <span class="text-purple-400/60 dark:text-purple-300/60">~${bedEst}</span></div>
        <div class="text-base font-bold">$${this.formatNumber(item.avg_price)}</div>
        <div class="text-xs text-gray-400 mt-0.5">$${this.formatNumber(this.psmToPsf(item.avg_psm))}/sqft • ${this.sqmToSqft(item.avg_area)} sqft</div>
        <div class="text-xs text-gray-600 dark:text-gray-500 mt-1">${item.count} sales</div>
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

    // Charts — private primary, HDB secondary (if related towns have data)
    Charts.renderTrendChart(data.hdb_trend_data || null, data.trend_data || []);
    if (data.distribution && data.distribution.bins.length > 0) {
      Charts.renderDistributionChart(data.distribution.bins, data.distribution.counts);
    }

    // Transactions table
    this.allTransactions = (data.recent_transactions || []).map(tx => {
      // Detect transaction type: HDB has flat_type, private has project
      const isHDB = tx.flat_type && !tx.project;

      return {
        ...tx,
        // Set flat_type for display (HDB uses actual flat_type, private uses property_type)
        flat_type: isHDB ? tx.flat_type : (tx.property_type || '--'),
        // Set block/street for display (HDB uses actual, private uses project name)
        block: isHDB ? tx.block : (tx.project || '--'),
        street_name: isHDB ? tx.street_name : (tx.project || '--'),
        remaining_lease_years: tx.remaining_lease_years,
        is_freehold: tx.tenure === 'FREEHOLD',
        // Mark transaction type for filtering/styling
        transaction_type: isHDB ? 'HDB' : 'PRIVATE',
        is_private: !isHDB,
      };
    });
    this.populateTypeFilter(this.allTransactions);
    this.applyTransactionFilters();

    // Reset filter inputs
    document.getElementById('tx-search').value = '';
    document.getElementById('tx-filter-type').value = '';
    document.getElementById('tx-filter-storey').value = '';
    document.getElementById('tx-filter-lease').value = '';
    document.getElementById('tx-sort').value = 'date-desc';

    // Hide private summary (already showing district data)
    const privateSummaryEl = document.getElementById('private-summary-section');
    if (privateSummaryEl) privateSummaryEl.classList.add('hidden');

    // Update URL and meta for district search
    this.updateSeoForSearch('district', data);

    // Build project_coords lookup for map rendering
    const districtGeoMap = {};
    if (data.project_coords) {
      for (const pc of data.project_coords) {
        if (pc.latitude && pc.longitude) {
          districtGeoMap[pc.project.toUpperCase()] = { lat: pc.latitude, lng: pc.longitude };
        }
      }
    }

    // Attach lat/lng to private transactions for map rendering
    this.allTransactions = this.allTransactions.map(tx => {
      if (tx.is_private) {
        const coords = districtGeoMap[(tx.block || '').toUpperCase()];
        if (coords) return { ...tx, lat: coords.lat, lng: coords.lng };
      }
      return tx;
    });

    // Load map with transactions (private ones now have coordinates)
    TransactionMap.load(this.allTransactions, this.lastResolvedData);
  },

  setupTransactionFilters() {
    // GA4 Event 6: filter_transactions — debounced tracking helper
    const _trackFilter = (filterType, filterValue) => {
      this.track('filter_transactions', { filter_type: filterType, filter_value: filterValue });
    };
    document.getElementById('tx-search').addEventListener('input', (e) => { _trackFilter('search', e.target.value.trim() || 'text'); this.applyTransactionFilters(); });
    document.getElementById('tx-filter-type').addEventListener('change', (e) => { _trackFilter('type', e.target.value || 'all'); this.applyTransactionFilters(); });
    document.getElementById('tx-filter-storey').addEventListener('change', (e) => { _trackFilter('storey', e.target.value || 'all'); this.applyTransactionFilters(); });
    document.getElementById('tx-filter-lease').addEventListener('change', (e) => { _trackFilter('lease', e.target.value || 'all'); this.applyTransactionFilters(); });
    document.getElementById('tx-sort').addEventListener('change', (e) => { _trackFilter('sort', e.target.value); this.applyTransactionFilters(); });
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
    // Desktop table
    const tbody = document.getElementById('transactions-table');
    tbody.innerHTML = '';

    // Mobile cards
    const cardsContainer = document.getElementById('transactions-cards');
    cardsContainer.innerHTML = '';

    if (!transactions || transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-gray-500 text-sm">No transactions match your filters<br><button onclick="App.clearTransactionFilters()" class="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 transition-colors">Clear filters</button></td></tr>`;
      cardsContainer.innerHTML = `<div class="text-center text-gray-500 py-8 text-sm">No transactions match your filters<br><button onclick="App.clearTransactionFilters()" class="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 transition-colors">Clear filters</button></div>`;
      return;
    }

    // Compute median $/sqm per flat type for deal score coloring
    const _psmGroups = {};
    for (const tx of this.allTransactions) {
      const t = tx.flat_type || 'UNKNOWN';
      if (!_psmGroups[t]) _psmGroups[t] = [];
      if (tx.price_per_sqm) _psmGroups[t].push(tx.price_per_sqm);
    }
    const _typeMedian = {};
    for (const [t, vals] of Object.entries(_psmGroups)) {
      const s = [...vals].sort((a, b) => a - b);
      _typeMedian[t] = s[Math.floor(s.length / 2)];
    }
    const _dealDot = (psm, type) => {
      const med = _typeMedian[type] || 0;
      if (!med) return '';
      const ratio = psm / med;
      let color;
      if (ratio <= 1.0) {
        const t = Math.max(0, Math.min(1, (ratio - 0.70) / 0.30));
        const r = Math.round(34 + (96 - 34) * t), g = Math.round(197 + (165 - 197) * t), b = Math.round(94 + (250 - 94) * t);
        color = `rgb(${r},${g},${b})`;
      } else {
        const t = Math.max(0, Math.min(1, (ratio - 1.0) / 0.30));
        const r = Math.round(96 + (239 - 96) * t), g = Math.round(165 + (68 - 165) * t), b = Math.round(250 + (68 - 250) * t);
        color = `rgb(${r},${g},${b})`;
      }
      return `<span class="inline-block w-2 h-2 rounded-full shrink-0 mt-0.5" style="background:${color}" title="Deal score vs similar ${type} flats"></span>`;
    };

    const mobileCards = [];

    transactions.forEach(tx => {
      const address = `${tx.block} ${tx.street_name || ''} Singapore`.trim();
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      const leaseDisplay = tx.is_freehold ? '∞' : (tx.remaining_lease_years ? `${Math.round(tx.remaining_lease_years)}y` : '--');
      const addrKey = `${tx.block} ${tx.street_name || ''}`.trim().toUpperCase();

      // Desktop row
      const tr = document.createElement('tr');
      tr.className = 'border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors';
      tr.addEventListener('mouseenter', () => TransactionMap.highlightAddress(addrKey));
      tr.addEventListener('mouseleave', () => TransactionMap.unhighlight());
      tr.innerHTML = `
        <td class="py-2.5 pr-2 text-gray-400 text-xs">${this.formatMonth(tx.month)}</td>
        <td class="py-2.5 pr-2">
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
             class="block text-brand-400 hover:text-brand-300 text-xs underline decoration-brand-400/30 hover:decoration-brand-300 transition-colors"
             title="${tx.block} ${tx.street_name || ''} — View on Google Maps">
            ${tx.block} ${tx.street_name || ''}
            <svg class="w-3 h-3 inline -mt-0.5 ml-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
        </td>
        <td class="py-2.5 pr-2 text-xs">
          ${tx.is_private ? '<span class="px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs mr-1">🏢</span>' : ''}
          <span class="px-1.5 py-0.5 rounded ${tx.is_private ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-200' : 'bg-gray-200 dark:bg-dark-600/50 text-gray-600 dark:text-gray-300'}">${tx.flat_type}</span>
          ${tx.is_freehold !== undefined ? `<span class="ml-1 text-purple-600 dark:text-purple-300 text-xs">~${this.estimateBedrooms(tx.floor_area_sqm, tx.flat_type)}</span>` : ''}
        </td>
        <td class="py-2.5 pr-2 text-right text-gray-400 text-xs">${tx.storey_range || '--'}</td>
        <td class="py-2.5 pr-2 text-right text-xs">${this.sqmToSqft(tx.floor_area_sqm)} sqft</td>
        <td class="py-2.5 pr-2 text-right text-gray-400 text-xs">${leaseDisplay}</td>
        <td class="py-2.5 pr-2 text-right font-semibold text-xs">$${this.formatNumber(tx.resale_price)}</td>
        <td class="py-2.5 text-right text-gray-400 text-xs">$${this.formatNumber(this.psmToPsf(tx.price_per_sqm))}</td>
      `;
      tbody.appendChild(tr);

      // Mobile card — collect into array for pagination
      const card = document.createElement('div');
      card.className = 'tx-card';
      card.addEventListener('mouseenter', () => TransactionMap.highlightAddress(addrKey));
      card.addEventListener('mouseleave', () => TransactionMap.unhighlight());
      card.addEventListener('click', (e) => { if (!e.target.closest('a')) TransactionMap.highlightAddress(addrKey); });
      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
             class="text-brand-400 hover:text-brand-300 text-sm font-medium underline decoration-brand-400/30 hover:decoration-brand-300 transition-colors leading-tight">
            ${tx.block} ${tx.street_name || ''}
            <svg class="w-3 h-3 inline -mt-0.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
          <span class="text-xs text-gray-500 whitespace-nowrap">${this.formatMonth(tx.month)}</span>
        </div>
        <div class="flex items-center justify-between mt-2 gap-2">
          <span class="text-lg font-bold">$${this.formatNumber(tx.resale_price)}</span>
          <span class="flex items-center gap-1.5 text-xs text-gray-400">${_dealDot(tx.price_per_sqm, tx.flat_type || 'UNKNOWN')}$${this.formatNumber(this.psmToPsf(tx.price_per_sqm))}/sqft</span>
        </div>
        <div class="flex items-center gap-2 mt-2 text-xs text-gray-400 flex-wrap">
          ${tx.is_private ? '<span class="px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs">🏢 Private</span>' : ''}
          <span class="px-1.5 py-0.5 rounded ${tx.is_private ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-200' : 'bg-gray-200 dark:bg-dark-600/50 text-gray-600 dark:text-gray-300'}">${tx.flat_type}</span>
          ${tx.is_freehold !== undefined ? `<span class="text-purple-600 dark:text-purple-300">~${this.estimateBedrooms(tx.floor_area_sqm, tx.flat_type)}</span>` : ''}
          <span>·</span>
          <span>${this.sqmToSqft(tx.floor_area_sqm)}sqft</span>
          <span>·</span>
          <span>Floor ${tx.storey_range || '--'}</span>
          <span>·</span>
          <span>Lease ${leaseDisplay}</span>
        </div>
      `;
      mobileCards.push(card);
    });

    // Paginate mobile cards: show first 25, then "Show more" button
    const MOBILE_PAGE = 25;
    mobileCards.slice(0, MOBILE_PAGE).forEach(card => cardsContainer.appendChild(card));
    if (mobileCards.length > MOBILE_PAGE) {
      const btn = document.createElement('button');
      btn.className = 'w-full py-3 mt-1 text-sm font-medium text-brand-500 bg-gray-50 dark:bg-dark-700/50 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors';
      btn.textContent = `Show ${mobileCards.length - MOBILE_PAGE} more transactions`;
      btn.onclick = () => {
        btn.remove();
        mobileCards.slice(MOBILE_PAGE).forEach(card => cardsContainer.appendChild(card));
      };
      cardsContainer.appendChild(btn);
    }
  },

  renderPrivateResults(data, addressInfo) {
    // GA4 Event 2: view_results
    this.track('view_results', {
      result_type: 'private',
      location: data.project?.project || '',
      transaction_count: data.project?.total_transactions || 0,
    });

    const section = document.getElementById('results-section');
    section.classList.remove('hidden');
    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    this._onResultsShown();

    const proj = data.project;
    const segmentLabels = { CCR: 'Core Central', RCR: 'Rest of Central', OCR: 'Outside Central' };
    const segmentColors = { CCR: 'text-amber-400', RCR: 'text-blue-400', OCR: 'text-green-400' };

    // Title with private badge
    document.getElementById('town-title').innerHTML =
      `<span class="inline-flex items-center gap-2">` +
      `<span class="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold uppercase tracking-wider">Private</span>` +
      `${proj.project}${addressInfo}</span>`;

    // Subtitle
    const subtitleParts = [];
    subtitleParts.push(`${proj.street_name}`);
    subtitleParts.push(`District ${proj.district}`);
    if (proj.market_segment) {
      subtitleParts.push(`${segmentLabels[proj.market_segment] || proj.market_segment} (${proj.market_segment})`);
    }
    subtitleParts.push(`${proj.total_transactions.toLocaleString()} transactions`);
    subtitleParts.push(`Data as of ${this.formatMonth(proj.latest)}`);
    document.getElementById('town-subtitle').textContent = subtitleParts.join(' • ');

    // Trend badge
    const trend = data.price_trend;
    const trendBadge = document.getElementById('badge-trend');
    const trendIcon = trend.direction === 'rising' ? '📈' : trend.direction === 'falling' ? '📉' : '➡️';
    const trendClass = trend.direction === 'rising' ? 'text-green-400' : trend.direction === 'falling' ? 'text-red-400' : 'text-amber-400';
    trendBadge.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-dark-700 ${trendClass}`;
    trendBadge.innerHTML = `${trendIcon} ${trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)} ${trend['1y_change'] >= 0 ? '+' : ''}${trend['1y_change']}% YoY`;

    // Volume badge
    document.getElementById('badge-volume').innerHTML = `<span class="w-2 h-2 rounded-full bg-purple-400"></span> ${proj.total_transactions.toLocaleString()} total transactions`;

    // Stats cards
    document.getElementById('stat-median').textContent = `$${this.formatNumber(proj.avg_price)}`;
    document.getElementById('stat-psm').textContent = `$${this.formatNumber(this.psmToPsf(proj.avg_psm))}/sqft`;
    document.getElementById('stat-range').textContent = proj.tenure || '--';
    document.getElementById('stat-popular').textContent = `D${proj.district} • ${segmentLabels[proj.market_segment] || proj.market_segment || ''}`;

    // Price by property type cards
    const container = document.getElementById('price-type-cards');
    container.innerHTML = '';
    data.prices_by_type.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-gray-100 dark:bg-dark-700 rounded-xl border border-purple-500/10 p-3 hover:border-purple-500/30 transition-colors cursor-default';
      const bedEst = this.estimateBedrooms(item.avg_area, item.property_type);
      card.innerHTML = `
        <div class="text-xs text-purple-500 dark:text-purple-300 mb-1">${item.property_type} <span class="text-purple-400/60 dark:text-purple-300/60">~${bedEst}</span></div>
        <div class="text-base font-bold">$${this.formatNumber(item.avg_price)}</div>
        <div class="text-xs text-gray-400 mt-0.5">$${this.formatNumber(this.psmToPsf(item.avg_psm))}/sqft • ${this.sqmToSqft(item.avg_area)} sqft</div>
        <div class="text-xs text-gray-600 dark:text-gray-500 mt-1">${item.count} sales</div>
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
    document.getElementById('trend-5y').innerHTML = '--';

    // Charts — private project only, single line
    Charts.renderTrendChart(null, data.trend_data || []);
    if (data.distribution && data.distribution.bins.length > 0) {
      Charts.renderDistributionChart(data.distribution.bins, data.distribution.counts);
    }

    // Transactions table — private format
    this.allTransactions = (data.recent_transactions || []).map(tx => ({
      ...tx,
      flat_type: tx.property_type || tx.flat_type,
      block: proj.project,
      street_name: proj.street_name,
      remaining_lease_years: tx.remaining_lease_years,
      is_freehold: tx.tenure === 'FREEHOLD',
    }));
    this.populateTypeFilter(this.allTransactions);
    this.applyTransactionFilters();

    // Reset filter inputs
    document.getElementById('tx-search').value = '';
    document.getElementById('tx-filter-type').value = '';
    document.getElementById('tx-filter-storey').value = '';
    document.getElementById('tx-filter-lease').value = '';
    document.getElementById('tx-sort').value = 'date-desc';

    // Update URL and meta for private search
    this.updateSeoForSearch('private', data);

    // Show transactions on map: private project + nearby HDB
    const coords = this.lastResolvedData;
    if (coords && coords.lat && coords.lng) {
      // Start with private project transactions
      TransactionMap.loadPreGeocoded(this.allTransactions, coords.lat, coords.lng, coords);

      // Also fetch nearby HDB transactions + private projects and add them to the map
      API.getNearbyHDB(coords.lat, coords.lng).then(hdbData => {
        if (hdbData.transactions && hdbData.transactions.length > 0) {
          TransactionMap.addNearbyHDB(hdbData.transactions);
        }
        if (hdbData.nearby_projects && hdbData.nearby_projects.length > 0) {
          TransactionMap.addNearbyProjects(hdbData.nearby_projects, coords.projectName);
        }
      }).catch(err => {
        console.warn('Failed to load nearby transactions:', err.message);
      });
    } else {
      // No pre-geocoded coords — fall back to geocoding via project street address
      TransactionMap.load(this.allTransactions, this.lastResolvedData);
    }
  },

  estimateBedrooms(areaSqm, propertyType) {
    if (!areaSqm) return '--';
    const a = parseFloat(areaSqm);
    if (isNaN(a)) return '--';
    // Landed properties have different space usage
    const isLanded = ['TERRACE', 'SEMI-DETACHED', 'DETACHED', 'STRATA TERRACE', 'STRATA SEMI-DETACHED', 'STRATA DETACHED'].includes(propertyType);
    if (isLanded) {
      if (a < 100) return '2-bed';
      if (a < 150) return '3-bed';
      if (a < 200) return '4-bed';
      if (a < 300) return '5-bed';
      return '6+ bed';
    }
    // Condo/Apartment
    if (a < 45) return 'Studio';
    if (a < 65) return '1-bed';
    if (a < 85) return '2-bed';
    if (a < 110) return '3-bed';
    if (a < 140) return '4-bed';
    if (a < 180) return '5-bed';
    return 'Penthouse';
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

  sqmToSqft(sqm) {
    if (!sqm) return '--';
    return Math.round(parseFloat(sqm) * 10.7639);
  },

  psmToPsf(psm) {
    if (!psm) return null;
    return Math.round(parseFloat(psm) / 10.7639);
  },

  setLoadingProgress(pct) {
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = pct + '%';
  },

  // ===== AUTOCOMPLETE =====
  onAcInput() {
    const input = document.getElementById('search-input').value.trim();
    if (input.length === 0) { this.hideAc(); return; }

    clearTimeout(this._acDebounce);
    this._acDebounce = setTimeout(() => this.fetchAcResults(input), input.length >= 3 ? 200 : 0);
  },

  async fetchAcResults(query) {
    const q = query.toUpperCase();
    const items = [];

    // 1. Match towns
    for (const town of (this._towns || [])) {
      if (town.includes(q) || q.includes(town)) {
        items.push({ type: 'town', label: town.replace(/\w\S*/g, w => w.charAt(0) + w.slice(1).toLowerCase()), value: town, icon: '🏘️' });
      }
      if (items.filter(i => i.type === 'town').length >= 5) break;
    }

    // 2. Match districts
    for (const label of (this._districts || [])) {
      if (label.toUpperCase().includes(q)) {
        const code = label.match(/D(\d+)/)?.[1]?.padStart(2, '0');
        items.push({ type: 'district', label, value: `D${code}`, icon: '📍' });
      }
      if (items.filter(i => i.type === 'district').length >= 3) break;
    }

    // 3. Search private projects (only if 3+ chars)
    if (query.length >= 3) {
      try {
        const results = await API.searchPrivateProjects(query, 5);
        for (const p of (results.projects || [])) {
          items.push({ type: 'project', label: p.project, sub: `D${p.district} · ${p.market_segment || ''}`, value: p.project, icon: '🏢' });
        }
      } catch (e) { /* ignore */ }
    }

    this._acItems = items;
    this._acIndex = -1;
    this.renderAc();
  },

  renderAc() {
    const dd = document.getElementById('autocomplete-dropdown');
    if (this._acItems.length === 0) { dd.classList.add('hidden'); return; }

    dd.classList.remove('hidden');
    dd.innerHTML = this._acItems.map((item, i) => `
      <div class="ac-item flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors ${i === this._acIndex ? 'bg-gray-100 dark:bg-white/5' : ''}"
          data-index="${i}" onmousedown="App.selectAc(${i})">
        <span class="text-sm shrink-0">${item.icon}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm text-gray-900 dark:text-white truncate">${item.label}</div>
          ${item.sub ? `<div class="text-xs text-gray-500 truncate">${item.sub}</div>` : ''}
        </div>
        <span class="text-[10px] px-1.5 py-0.5 rounded ${item.type === 'town' ? 'bg-brand-500/10 text-brand-400' : item.type === 'district' ? 'bg-amber-500/10 text-amber-400' : 'bg-purple-500/10 text-purple-400'}">${item.type}</span>
      </div>
    `).join('');
  },

  onAcKeydown(e) {
    const dd = document.getElementById('autocomplete-dropdown');
    if (dd.classList.contains('hidden') || this._acItems.length === 0) {
      if (e.key === 'Enter') { this.hideAc(); this.search(); }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._acIndex = Math.min(this._acIndex + 1, this._acItems.length - 1);
      this.renderAc();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._acIndex = Math.max(this._acIndex - 1, -1);
      this.renderAc();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this._acIndex >= 0) {
        this.selectAc(this._acIndex);
      } else {
        this.hideAc();
        this.search();
      }
    } else if (e.key === 'Escape') {
      this.hideAc();
    }
  },

  selectAc(index) {
    const item = this._acItems[index];
    if (!item) return;
    document.getElementById('search-input').value = item.value;
    this.hideAc();
    this.search();
  },

  hideAc() {
    const dd = document.getElementById('autocomplete-dropdown');
    dd.classList.add('hidden');
    this._acItems = [];
    this._acIndex = -1;
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
    alert.className = 'app-alert fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-dark-800 border border-red-500/30 text-red-600 dark:text-red-300 px-6 py-3 rounded-xl shadow-lg text-sm font-medium';
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