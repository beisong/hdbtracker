/**
 * WorthOrNot — Chart.js Configurations
 */

const Charts = {
  trendChart: null,
  distributionChart: null,

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

  initDefaults() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  },

  renderTrendChart(data) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;

    if (this.trendChart) this.trendChart.destroy();

    const labels = data.map(d => {
      const [y, m] = d.month.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1);
      return date.toLocaleDateString('en-SG', { month: 'short', year: '2-digit' });
    });
    const prices = data.map(d => d.median_price);

    const firstPrice = prices[0] || 0;
    const lastPrice = prices[prices.length - 1] || 0;
    const trendColor = lastPrice >= firstPrice ? this.colors.green : this.colors.red;
    const trendBg = lastPrice >= firstPrice ? this.colors.greenLight : this.colors.redLight;

    this.trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Average Price',
          data: prices,
          borderColor: trendColor,
          backgroundColor: trendBg,
          fill: true,
          tension: 0.4,
          pointRadius: 1.5,
          pointHoverRadius: 5,
          pointBackgroundColor: trendColor,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#94a3b8',
            bodyColor: '#ffffff',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              title: (items) => items[0]?.label || '',
              label: (item) => `$${this.formatNumber(item.raw)}`,
              afterLabel: (item) => {
                const count = data[item.dataIndex]?.count || 0;
                return `${count} transactions`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { callback: (val) => '$' + (val / 1000) + 'k', font: { size: 11 } } },
        },
      },
    });
  },

  renderDistributionChart(bins, counts) {
    const canvas = document.getElementById('distribution-chart');
    if (!canvas) return;

    if (this.distributionChart) this.distributionChart.destroy();

    const labels = bins.slice(0, counts.length).map((b, i) => {
      if (i < bins.length - 1) return `$${this.formatNumber(b / 1000)}k`;
      return '';
    });

    const maxCount = Math.max(...counts);
    const barColors = counts.map(c =>
      c === maxCount ? this.colors.brand : 'rgba(255, 255, 255, 0.08)'
    );

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
            backgroundColor: '#1e293b',
            titleColor: '#94a3b8',
            bodyColor: '#ffffff',
            borderColor: 'rgba(255,255,255,0.1)',
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
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { font: { size: 11 } } },
        },
      },
    });
  },

  formatNumber(num) {
    if (num === null || num === undefined) return '--';
    return Math.round(num).toLocaleString('en-SG');
  },
};