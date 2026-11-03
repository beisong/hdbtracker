/**
 * WorthIt — Chart.js Configurations
 */

const Charts = {
  trendChart: null,
  distributionChart: null,
  _lastTrendData: null,
  _lastPrivateTrendData: null,
  _lastDistBins: null,
  _lastDistCounts: null,

  colors: {
    brand: '#3b82f6',
    brandLight: 'rgba(59, 130, 246, 0.1)',
    green: '#10b981',
    greenLight: 'rgba(16, 185, 129, 0.1)',
    red: '#ef4444',
    redLight: 'rgba(239, 68, 68, 0.1)',
    amber: '#f59e0b',
    gray: '#64748b',
  },

  isMobile() {
    return window.innerWidth < 640;
  },

  isDark() {
    return document.documentElement.classList.contains('dark');
  },

  getThemeColors() {
    const dark = this.isDark();
    return {
      tooltipBg: dark ? '#1e293b' : '#ffffff',
      tooltipTitle: dark ? '#94a3b8' : '#6b7280',
      tooltipBody: dark ? '#ffffff' : '#111827',
      tooltipBorder: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      gridColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)',
      textColor: dark ? '#94a3b8' : '#6b7280',
      borderColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      inactiveBar: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    };
  },

  initDefaults() {
    const tc = this.getThemeColors();
    Chart.defaults.color = tc.textColor;
    Chart.defaults.borderColor = tc.borderColor;
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.font.size = this.isMobile() ? 10 : 11;
  },

  /** Re-render charts after theme change */
  rerender() {
    this.initDefaults();
    for (const args of Object.values(this._lastTrendArgs)) this.renderTrendChart(args);
    if (this._lastDistBins && this._lastDistCounts) {
      this.renderDistributionChart(this._lastDistBins, this._lastDistCounts);
    }
  },

  // Line colours for multi-series charts, in series order (HDB blue, private purple, then amber)
  seriesPalette: ['#3b82f6', '#a855f7', '#f59e0b'],
  _trendCharts: {},   // canvasId → Chart instance
  _lastTrendArgs: {}, // canvasId → { canvasId, series } (for theme re-render)

  /**
   * Monthly $/sqft trend line chart.
   *   renderTrendChart(hdbData, privateData = null)  — legacy: #trend-chart, "HDB" + "Private"
   *   renderTrendChart({ canvasId, series: [{ label, data, color? }] })  — N labelled series
   * Each data array holds { month, avg_psm, count }; empty/null series are skipped. A single
   * series is coloured green/red by direction with a fill; several get palette colours + legend.
   */
  renderTrendChart(hdbData, privateData = null) {
    let canvasId, series;
    if (hdbData && !Array.isArray(hdbData) && Array.isArray(hdbData.series)) {
      canvasId = hdbData.canvasId || 'trend-chart';
      series = hdbData.series;
    } else {
      canvasId = 'trend-chart';
      series = [{ label: 'HDB', data: hdbData }, { label: 'Private', data: privateData }];
      this._lastTrendData = hdbData;
      this._lastPrivateTrendData = privateData;
    }
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this._lastTrendArgs[canvasId] = { canvasId, series };
    if (this._trendCharts[canvasId]) this._trendCharts[canvasId].destroy();

    const tc = this.getThemeColors();
    const mobile = this.isMobile();
    // Colour by original slot, so an empty earlier series doesn't shift colours (private stays purple)
    const active = series
      .map((s, i) => ({ ...s, color: s.color || this.seriesPalette[i % this.seriesPalette.length] }))
      .filter(s => s.data && s.data.length > 0);
    const multi = active.length > 1;

    // Build union of months for a shared X-axis
    const allMonths = [...new Set(active.flatMap(s => s.data.map(d => d.month)))].sort();
    const labels = allMonths.map(month => {
      const [y, m] = month.split('-');
      return new Date(parseInt(y), parseInt(m) - 1)
        .toLocaleDateString('en-SG', { month: 'short', year: '2-digit' });
    });

    const datasets = active.map(s => {
      const byMonth = Object.fromEntries(s.data.map(d => [d.month, App.psmToPsf(d.avg_psm)]));
      const prices = allMonths.map(m => byMonth[m] ?? null);
      let color, bg;
      if (multi) {
        color = s.color;
        bg = 'transparent';
      } else {
        const first = prices.find(p => p != null) || 0;
        const last = [...prices].reverse().find(p => p != null) || 0;
        color = last >= first ? this.colors.green : this.colors.red;
        bg = last >= first ? this.colors.greenLight : this.colors.redLight;
      }
      return {
        label: s.label,
        data: prices,
        borderColor: color,
        backgroundColor: bg,
        fill: !multi,
        tension: 0.4,
        pointRadius: mobile ? 0 : 1.5,
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        borderWidth: 2,
        spanGaps: true,
      };
    });

    const chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: multi,
            labels: { color: tc.textColor, boxWidth: 12, padding: 12, font: { size: mobile ? 10 : 11 } },
          },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            titleColor: tc.tooltipTitle,
            bodyColor: tc.tooltipBody,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            displayColors: multi,
            callbacks: {
              title: (items) => items[0]?.label || '',
              label: (item) => `${multi ? item.dataset.label + ': ' : ''}$${this.formatNumber(item.raw)}/sqft`,
              afterLabel: (item) => {
                const month = allMonths[item.dataIndex];
                const entry = active[item.datasetIndex]?.data.find(d => d.month === month);
                return entry ? `${entry.count} transactions` : '';
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: mobile ? 5 : 8 } },
          y: { grid: { color: tc.gridColor }, ticks: { callback: (val) => '$' + (val / 1000).toFixed(1) + 'k/sqft', maxTicksLimit: mobile ? 4 : 8 } },
        },
      },
    });
    this._trendCharts[canvasId] = chart;
    if (canvasId === 'trend-chart') this.trendChart = chart;
  },

  renderDistributionChart(bins, counts) {
    const canvas = document.getElementById('distribution-chart');
    if (!canvas) return;

    this._lastDistBins = bins;
    this._lastDistCounts = counts;
    if (this.distributionChart) this.distributionChart.destroy();

    const tc = this.getThemeColors();
    const labels = bins.slice(0, counts.length).map((b, i) => {
      if (i < bins.length - 1) return `$${this.formatNumber(b / 1000)}k`;
      return '';
    });

    const maxCount = Math.max(...counts);
    const barColors = counts.map(c =>
      c === maxCount ? this.colors.brand : tc.inactiveBar
    );

    const mobile = this.isMobile();

    this.distributionChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Transactions',
          data: counts,
          backgroundColor: barColors,
          borderWidth: 0,
          borderRadius: 3,
          maxBarThickness: 35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            titleColor: tc.tooltipTitle,
            bodyColor: tc.tooltipBody,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                if (idx !== undefined && idx < bins.length - 1) {
                  return `$${this.formatNumber(bins[idx])} - $${this.formatNumber(bins[idx + 1])}`;
                }
                return '';
              },
              label: (item) => `${item.raw} transactions`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: mobile ? 5 : 10, font: { size: mobile ? 9 : 10 } } },
          y: { grid: { color: tc.gridColor }, ticks: { maxTicksLimit: mobile ? 4 : 8 } },
        },
      },
    });
  },

  formatNumber(num) {
    if (num === null || num === undefined) return '--';
    return Math.round(num).toLocaleString('en-SG');
  },
};