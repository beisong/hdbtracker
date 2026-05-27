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
    if (this._lastTrendData || this._lastPrivateTrendData) {
      this.renderTrendChart(this._lastTrendData, this._lastPrivateTrendData);
    }
    if (this._lastDistBins && this._lastDistCounts) {
      this.renderDistributionChart(this._lastDistBins, this._lastDistCounts);
    }
  },

  // hdbData = HDB monthly trend array, privateData = private monthly trend array
  // Either can be null for single-line mode.
  renderTrendChart(hdbData, privateData = null) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;

    this._lastTrendData = hdbData;
    this._lastPrivateTrendData = privateData;
    if (this.trendChart) this.trendChart.destroy();

    const tc = this.getThemeColors();
    const mobile = this.isMobile();
    const hasHdb = hdbData && hdbData.length > 0;
    const hasPrivate = privateData && privateData.length > 0;
    const hasBoth = hasHdb && hasPrivate;

    // Build union of months for a shared X-axis
    const allMonthsSet = new Set([
      ...(hasHdb ? hdbData.map(d => d.month) : []),
      ...(hasPrivate ? privateData.map(d => d.month) : []),
    ]);
    const allMonths = [...allMonthsSet].sort();
    const labels = allMonths.map(month => {
      const [y, m] = month.split('-');
      return new Date(parseInt(y), parseInt(m) - 1)
        .toLocaleDateString('en-SG', { month: 'short', year: '2-digit' });
    });

    const datasets = [];

    if (hasHdb) {
      const hdbMap = Object.fromEntries(hdbData.map(d => [d.month, d.avg_psm]));
      const hdbPrices = allMonths.map(m => hdbMap[m] ?? null);
      let hdbColor, hdbBg;
      if (hasBoth) {
        hdbColor = this.colors.brand;
        hdbBg = 'transparent';
      } else {
        const first = hdbPrices.find(p => p != null) || 0;
        const last = [...hdbPrices].reverse().find(p => p != null) || 0;
        hdbColor = last >= first ? this.colors.green : this.colors.red;
        hdbBg = last >= first ? this.colors.greenLight : this.colors.redLight;
      }
      datasets.push({
        label: 'HDB',
        data: hdbPrices,
        borderColor: hdbColor,
        backgroundColor: hdbBg,
        fill: !hasBoth,
        tension: 0.4,
        pointRadius: mobile ? 0 : 1.5,
        pointHoverRadius: 5,
        pointBackgroundColor: hdbColor,
        borderWidth: 2,
        spanGaps: true,
      });
    }

    if (hasPrivate) {
      const privMap = Object.fromEntries(privateData.map(d => [d.month, d.avg_psm]));
      const privPrices = allMonths.map(m => privMap[m] ?? null);
      let privColor, privBg;
      if (hasBoth) {
        privColor = '#a855f7';
        privBg = 'transparent';
      } else {
        const first = privPrices.find(p => p != null) || 0;
        const last = [...privPrices].reverse().find(p => p != null) || 0;
        privColor = last >= first ? this.colors.green : this.colors.red;
        privBg = last >= first ? this.colors.greenLight : this.colors.redLight;
      }
      datasets.push({
        label: 'Private',
        data: privPrices,
        borderColor: privColor,
        backgroundColor: privBg,
        fill: !hasBoth,
        tension: 0.4,
        pointRadius: mobile ? 0 : 1.5,
        pointHoverRadius: 5,
        pointBackgroundColor: privColor,
        borderWidth: 2,
        spanGaps: true,
      });
    }

    this.trendChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: hasBoth,
            labels: { color: tc.textColor, boxWidth: 12, padding: 12, font: { size: mobile ? 10 : 11 } },
          },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            titleColor: tc.tooltipTitle,
            bodyColor: tc.tooltipBody,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            displayColors: hasBoth,
            callbacks: {
              title: (items) => items[0]?.label || '',
              label: (item) => `${hasBoth ? item.dataset.label + ': ' : ''}$${this.formatNumber(item.raw)}/sqm`,
              afterLabel: (item) => {
                const month = allMonths[item.dataIndex];
                const src = item.dataset.label === 'Private' ? privateData : hdbData;
                const entry = src?.find(d => d.month === month);
                return entry ? `${entry.count} transactions` : '';
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: mobile ? 5 : 8 } },
          y: { grid: { color: tc.gridColor }, ticks: { callback: (val) => '$' + (val / 1000).toFixed(1) + 'k/sqm', maxTicksLimit: mobile ? 4 : 8 } },
        },
      },
    });
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