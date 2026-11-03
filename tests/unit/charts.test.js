'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Load charts.js with a Chart stub that records each config, so dataset styling can be asserted.
function loadCharts() {
  const configs = [];
  function Chart(canvas, config) { configs.push({ canvas, config }); return { destroy() {} }; }
  Chart.defaults = { font: {} };
  const ctx = vm.createContext({
    window: { innerWidth: 1024 },
    document: {
      documentElement: { classList: { contains: () => false } },
      getElementById: (id) => ({ id }),
    },
    App: { psmToPsf: (psm) => (psm ? Math.round(psm / 10.7639) : null) },
    Chart,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../public/js/charts.js'), 'utf8') + '\nglobalThis.Charts = Charts;', ctx);
  return { Charts: ctx.Charts, configs };
}

const up = [{ month: '2024-01', avg_psm: 5000, count: 3 }, { month: '2024-02', avg_psm: 5200, count: 4 }];
const down = [{ month: '2024-01', avg_psm: 5200, count: 3 }, { month: '2024-03', avg_psm: 5000, count: 2 }];

describe('Charts.renderTrendChart — legacy (hdbData, privateData) signature', () => {
  it('single HDB series: #trend-chart, filled, green when rising, no legend', () => {
    const { Charts, configs } = loadCharts();
    Charts.renderTrendChart(up, null);
    const { canvas, config } = configs[0];
    expect(canvas.id).toBe('trend-chart');
    expect(config.data.datasets).toHaveLength(1);
    const ds = config.data.datasets[0];
    expect(ds.label).toBe('HDB');
    expect(ds.fill).toBe(true);
    expect(ds.borderColor).toBe(Charts.colors.green);
    expect(config.options.plugins.legend.display).toBe(false);
  });

  it('single private series is labelled Private and red when falling', () => {
    const { Charts, configs } = loadCharts();
    Charts.renderTrendChart([], down);
    const ds = configs[0].config.data.datasets;
    expect(ds).toHaveLength(1);
    expect(ds[0].label).toBe('Private');
    expect(ds[0].borderColor).toBe(Charts.colors.red);
  });

  it('HDB + private: blue + purple unfilled lines on a shared month axis, with legend', () => {
    const { Charts, configs } = loadCharts();
    Charts.renderTrendChart(up, down);
    const { config } = configs[0];
    expect(config.data.labels).toHaveLength(3); // union of 2024-01..03
    const [hdb, priv] = config.data.datasets;
    expect([hdb.label, priv.label]).toEqual(['HDB', 'Private']);
    expect(hdb.borderColor).toBe('#3b82f6');
    expect(priv.borderColor).toBe('#a855f7');
    expect(hdb.fill).toBe(false);
    expect([...priv.data]).toEqual([483, null, 465]);
    expect(config.options.plugins.legend.display).toBe(true);
    const afterLabel = config.options.plugins.tooltip.callbacks.afterLabel;
    expect(afterLabel({ dataIndex: 2, datasetIndex: 1 })).toBe('2 transactions');
  });

  it('keeps the legacy fields used by theme re-render', () => {
    const { Charts } = loadCharts();
    Charts.renderTrendChart(up, down);
    expect(Charts._lastTrendData).toBe(up);
    expect(Charts._lastPrivateTrendData).toBe(down);
    expect(Charts.trendChart).toBeTruthy();
  });
});

describe('Charts.renderTrendChart — N labelled series', () => {
  it('draws one line per series on the given canvas without touching #trend-chart', () => {
    const { Charts, configs } = loadCharts();
    Charts.renderTrendChart({
      canvasId: 'compare-trend-chart',
      series: [{ label: 'Bedok', data: up }, { label: 'Tampines', data: down }, { label: 'Yishun', data: up }],
    });
    const { canvas, config } = configs[0];
    expect(canvas.id).toBe('compare-trend-chart');
    expect(config.data.datasets.map(d => d.label)).toEqual(['Bedok', 'Tampines', 'Yishun']);
    expect(config.data.datasets.map(d => d.borderColor)).toEqual(['#3b82f6', '#a855f7', '#f59e0b']);
    expect(Charts.trendChart).toBeNull();
  });

  it('re-renders every chart on theme change', () => {
    const { Charts, configs } = loadCharts();
    Charts.renderTrendChart(up, null);
    Charts.renderTrendChart({ canvasId: 'compare-trend-chart', series: [{ label: 'A', data: up }, { label: 'B', data: down }] });
    Charts.rerender();
    expect(configs.map(c => c.canvas.id)).toEqual(['trend-chart', 'compare-trend-chart', 'trend-chart', 'compare-trend-chart']);
  });
});
