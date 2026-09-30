import Symbiote from '@symbiotejs/symbiote';
import template from './Chart.tpl.js';
import css from './Chart.css.js';

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

const CHART_TYPES = new Set(['bar', 'line', 'area', 'scatter', 'pie', 'donut', 'mixed']);
const SERIES_TYPES = new Set(['bar', 'line', 'area', 'scatter', 'pie']);

function normalizeNumber(value, fallback = 0) {
  let number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeAxis(axis, fallbackType = 'value') {
  let data = axis && typeof axis === 'object' ? axis : {};
  let type = data.type === 'category' || data.type === 'value' ? data.type : fallbackType;
  let result = { type };
  if (Array.isArray(data.data)) result.data = data.data.map((item) => String(item));
  if (data.min != null) result.min = normalizeNumber(data.min);
  if (data.max != null) result.max = normalizeNumber(data.max);
  if (data.label != null) result.label = String(data.label);
  return result;
}

function normalizeSemanticTarget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const target = {};
  for (const key of ['id', 'type', 'resourceType', 'resourceId', 'surfaceId', 'action']) {
    if (value[key] != null && String(value[key]).trim()) target[key] = String(value[key]).trim();
  }
  return Object.keys(target).length ? target : null;
}

export function normalizeChartColor(value, fallback = '') {
  let color = String(value ?? '').trim();
  if (!color) return fallback;
  if (/[;"'<>\\]/.test(color) || /url\s*\(/i.test(color) || /expression\s*\(/i.test(color)) {
    return fallback;
  }
  if (/^var\(--sn-[a-z0-9-]+(?:,\s*(#[0-9a-f]{3,8}|[a-z]+|rgba?\([0-9%.,\s/+-]+\)|hsla?\([0-9%.,\s/+-]+\)))?\)$/i.test(color)) {
    return color;
  }
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  if (/^(?:rgb|rgba|hsl|hsla)\([0-9%.,\s/+-]+\)$/i.test(color)) return color;
  if (/^[a-z]+$/i.test(color)) return color;
  return fallback;
}

function normalizeSeries(series, index, chartType) {
  let data = series && typeof series === 'object' ? series : {};
  let fallbackType = chartType === 'mixed' ? 'line' : chartType;
  let type = SERIES_TYPES.has(data.type) ? data.type : fallbackType;
  if (!SERIES_TYPES.has(type)) type = 'bar';
  let normalized = {
    name: String(data.name || `Series ${index + 1}`),
    type,
    data: Array.isArray(data.data) ? data.data.map((item) => normalizeNumber(item)) : [],
  };
  if (data.stack != null && String(data.stack).trim()) normalized.stack = String(data.stack).trim();
  if (Array.isArray(data.semanticTargets)) {
    normalized.semanticTargets = data.semanticTargets.map(normalizeSemanticTarget);
  }
  if (Array.isArray(data.colors)) {
    normalized.colors = data.colors.map((value) => normalizeChartColor(value));
  }
  let color = normalizeChartColor(data.color);
  if (color) normalized.color = color;
  return normalized;
}

export function normalizeChartSpec(spec = {}) {
  let data = spec && typeof spec === 'object' ? spec : {};
  let type = CHART_TYPES.has(data.type) ? data.type : 'bar';
  let series = Array.isArray(data.series)
    ? data.series.map((item, index) => normalizeSeries(item, index, type))
    : [];
  let categories = Array.isArray(data.xAxis?.data)
    ? data.xAxis.data.map((item) => String(item))
    : [];
  let maxLength = Math.max(categories.length, ...series.map((item) => item.data.length), 0);
  if (categories.length === 0 && maxLength > 0) {
    categories = Array.from({ length: maxLength }, (_, index) => `Index ${index}`);
  }

  return {
    title: String(data.title || ''),
    type,
    xAxis: { ...normalizeAxis(data.xAxis, 'category'), data: categories },
    yAxis: normalizeAxis(data.yAxis, 'value'),
    series,
    thresholds: Array.isArray(data.thresholds)
      ? data.thresholds.map((threshold) => ({
          value: normalizeNumber(threshold?.value),
          label: threshold?.label != null ? String(threshold.label) : '',
          color: normalizeChartColor(threshold?.color, 'var(--sn-chart-threshold-color, var(--sn-sys-danger))'),
        }))
      : [],
    legend: {
      show: data.legend?.show !== false,
      position: data.legend?.position === 'bottom' ? 'bottom' : 'top',
    },
    tooltip: {
      show: data.tooltip?.show !== false,
    },
    donut: {
      innerRadiusRatio: Math.min(0.78, Math.max(0.2, normalizeNumber(data.donut?.innerRadiusRatio, 0.58))),
      centerLabel: data.donut?.centerLabel != null ? String(data.donut.centerLabel) : '',
      centerValue: data.donut?.centerValue != null ? String(data.donut.centerValue) : '',
    },
  };
}

export class Chart extends Symbiote {
  static observedAttributes = ['title', 'type'];

  #spec = {};
  #hiddenSeries = new Set();
  #brushStart = null;
  #brushElement = null;

  constructor() {
    super();
    this.init$ = {
      title: 'Data Visualizer',
      onPointerDown: (e) => this._handlePointerDown(e),
      onPointerMove: (e) => this._handlePointerMove(e),
      onPointerUp: (e) => this._handlePointerUp(e),
      onDblClick: (e) => this._handleDblClick(e),
    };
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.$.title = this.getAttribute('title') || 'Data Visualizer';
    this.#renderChart();
  }

  get title() {
    return this.getAttribute('title') || 'Data Visualizer';
  }

  set title(val) {
    this.setAttribute('title', String(val));
    this.$.title = String(val);
  }

  get type() {
    return this.getAttribute('type') || 'bar';
  }

  set type(val) {
    this.setAttribute('type', String(val));
  }

  setData(data) {
    if (!Array.isArray(data)) return;
    let normalized = data.map((item, idx) => {
      if (typeof item === 'number') {
        return { label: `Index ${idx}`, value: item };
      }
      return {
        label: String(item.label || ''),
        value: Number(item.value || 0),
      };
    });

    this.setSpec({
      type: this.type,
      xAxis: {
        type: 'category',
        data: normalized.map(d => d.label),
      },
      series: [
        {
          name: this.title || 'Data',
          type: this.type,
          data: normalized.map(d => d.value),
        }
      ]
    });
  }

  setSpec(spec = {}) {
    this.#spec = normalizeChartSpec(spec);
    if (this.#spec.title) {
      this.title = this.#spec.title;
    }
    this.#hiddenSeries.clear();
    this.#renderChart();
  }

  getSpec() {
    return this.#spec;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'title') {
      this.$.title = newValue || 'Data Visualizer';
    } else if (name === 'type') {
      if (this.#spec.series) {
        let nextType = CHART_TYPES.has(newValue) ? newValue : 'bar';
        this.#spec = normalizeChartSpec({ ...this.#spec, type: nextType });
        this.#renderChart();
      }
    }
  }

  #createSvgElement(type, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', type);
    Object.entries(attrs).forEach(([name, value]) => {
      el.setAttribute(name, String(value));
    });
    return el;
  }

  _handlePointerDown(event) {
    const svg = this.ref.svg;
    if (!svg || !this.#spec.series) return;
    
    // Check if it's a left button click
    if (event.button !== 0) return;
    
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.#brushStart = { x, y };

    if (!this.#brushElement) {
      this.#brushElement = this.#createSvgElement('rect', {
        class: 'sn-chart-brush-overlay',
      });
    }
    this.#brushElement.setAttribute('x', String(x));
    this.#brushElement.setAttribute('y', String(0));
    this.#brushElement.setAttribute('width', String(0));
    this.#brushElement.setAttribute('height', String(rect.height));
    svg.appendChild(this.#brushElement);

    svg.setPointerCapture?.(event.pointerId);
  }

  _handlePointerMove(event) {
    if (!this.#brushStart || !this.#brushElement) return;

    const svg = this.ref.svg;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;

    const xStart = Math.min(this.#brushStart.x, x);
    const width = Math.abs(this.#brushStart.x - x);

    this.#brushElement.setAttribute('x', String(xStart));
    this.#brushElement.setAttribute('width', String(width));
  }

  _handlePointerUp(event) {
    if (!this.#brushStart) return;

    const svg = this.ref.svg;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;

    const xStart = Math.min(this.#brushStart.x, x);
    const xEnd = Math.max(this.#brushStart.x, x);

    if (this.#brushElement && this.#brushElement.parentNode) {
      this.#brushElement.parentNode.removeChild(this.#brushElement);
    }

    if (xEnd - xStart > 5) {
      // Meaningful drag / selection
      emit(this, 'sn-chart-zoom', {
        startX: xStart,
        endX: xEnd,
        spec: this.#spec,
      });
      emit(this, 'sn-chart-brush', {
        startX: xStart,
        endX: xEnd,
        spec: this.#spec,
      });
    }

    this.#brushStart = null;
    if (svg && event.pointerId != null) {
      try {
        svg.releasePointerCapture?.(event.pointerId);
      } catch {}
    }
  }

  _handleDblClick() {
    emit(this, 'sn-chart-zoom-reset', { spec: this.#spec });
    this.#renderChart();
  }

  #renderChart() {
    const svg = this.ref.svg;
    if (!svg) return;

    svg.innerHTML = '';

    const seriesList = (this.#spec.series || []).filter(s => s && !this.#hiddenSeries.has(s.name));
    const categories = this.#spec.xAxis?.data || [];

    // Accessible description setup
    const titleEl = this.#createSvgElement('title');
    titleEl.textContent = this.$.title;
    svg.appendChild(titleEl);

    const descEl = this.#createSvgElement('desc');
    descEl.textContent = `A Spec V1 Chart Visualizer displaying series data.`;
    svg.appendChild(descEl);

    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Chart: ${this.$.title}`);

    // Render legend in header
    this.#renderLegend();

    if (seriesList.length === 0) {
      const emptyText = this.#createSvgElement('text', {
        x: '50%',
        y: '50%',
        'text-anchor': 'middle',
        fill: 'var(--sn-sys-on-surface-dim)',
        'font-size': '12px',
      });
      emptyText.textContent = 'No active series to display';
      svg.appendChild(emptyText);
      return;
    }

    const width = svg.clientWidth || 300;
    const height = svg.clientHeight || 220;
    const padding = 40;

    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const isPie = this.#spec.type === 'pie' || this.#spec.type === 'donut' || seriesList.some(s => s.type === 'pie');

    if (isPie) {
      this.#renderPieChart(svg, seriesList, categories, width, height, padding);
      return;
    }

    // Determine overall Min/Max values
    let allValues = [];
    seriesList.forEach((s) => {
      if (Array.isArray(s.data)) {
        s.data.forEach(v => allValues.push(Number(v || 0)));
      }
    });
    (this.#spec.thresholds || []).forEach(t => allValues.push(Number(t.value || 0)));
    const stackedTotals = new Map();
    seriesList.filter((series) => series.type === 'bar' && series.stack).forEach((series) => {
      series.data.forEach((value, index) => {
        const key = `${series.stack}\u0000${index}`;
        stackedTotals.set(key, (stackedTotals.get(key) || 0) + Math.max(0, Number(value || 0)));
      });
    });
    allValues.push(...stackedTotals.values());

    let maxVal = this.#spec.yAxis?.max != null ? Number(this.#spec.yAxis.max) : Math.max(...allValues, 1);
    let minVal = this.#spec.yAxis?.min != null ? Number(this.#spec.yAxis.min) : Math.min(...allValues, 0);
    const range = maxVal - minVal || 1;

    const yForValue = (value) => height - padding - ((value - minVal) / range) * chartHeight;
    const baselineY = yForValue(Math.max(minVal, 0));

    // Draw Grid Lines & Axes
    const xAxis = this.#createSvgElement('line', {
      x1: padding,
      y1: height - padding,
      x2: width - padding,
      y2: height - padding,
      class: 'sn-chart-axis',
    });
    const yAxis = this.#createSvgElement('line', {
      x1: padding,
      y1: padding,
      x2: padding,
      y2: height - padding,
      class: 'sn-chart-axis',
    });
    svg.appendChild(xAxis);
    svg.appendChild(yAxis);

    // Integer count charts should not produce duplicate rounded labels (for
    // example 3, 2, 2, 1, 0). Continuous charts retain the usual four bands.
    const usesIntegerScale = Number.isInteger(minVal)
      && Number.isInteger(maxVal)
      && allValues.every((value) => Number.isInteger(Number(value)));
    const gridLinesCount = usesIntegerScale
      ? Math.max(1, Math.min(4, Math.ceil(range)))
      : 4;
    for (let i = 0; i <= gridLinesCount; i++) {
      const y = padding + (chartHeight / gridLinesCount) * i;
      const val = maxVal - (range / gridLinesCount) * i;

      const gridLine = this.#createSvgElement('line', {
        x1: padding,
        y1: y,
        x2: width - padding,
        y2: y,
        class: 'sn-chart-grid-line',
      });
      svg.appendChild(gridLine);

      // Y Axis labels
      const label = this.#createSvgElement('text', {
        x: padding - 8,
        y: y + 4,
        'text-anchor': 'end',
        fill: 'var(--sn-sys-on-surface-dim)',
        'font-size': '10px',
      });
      label.textContent = String(Math.round(val));
      svg.appendChild(label);
    }

    // Draw Thresholds / Reference Bands
    (this.#spec.thresholds || []).forEach((t) => {
      const y = yForValue(t.value);
      const color = normalizeChartColor(t.color, 'var(--sn-chart-threshold-color, var(--sn-sys-danger))');
      const line = this.#createSvgElement('line', {
        x1: padding,
        y1: y,
        x2: width - padding,
        y2: y,
        class: 'sn-chart-threshold-line',
        stroke: color,
      });
      svg.appendChild(line);

      const label = this.#createSvgElement('text', {
        x: width - padding + 5,
        y: y,
        fill: color,
        class: 'sn-chart-threshold-text',
      });
      label.textContent = t.label || String(t.value);
      svg.appendChild(label);
    });

    // Render X Axis Labels
    const categoryCount = categories.length || 1;
    const catStep = chartWidth / (categoryCount - 1 || 1);
    categories.forEach((cat, index) => {
      const x = padding + (chartWidth / categoryCount) * (index + 0.5);
      const label = this.#createSvgElement('text', {
        x,
        y: height - padding + 15,
        'text-anchor': 'middle',
        fill: 'var(--sn-sys-on-surface-dim)',
        'font-size': '10px',
      });
      label.textContent = String(cat);
      svg.appendChild(label);
    });

    // Render Series Elements
    const barSeriesList = seriesList.filter(s => s.type === 'bar');
    const barGroups = [...new Set(barSeriesList.map((series) => series.stack ? `stack:${series.stack}` : `series:${series.name}`))];
    const stackedOffsets = new Map();

    seriesList.forEach((series, sIndex) => {
      const color = normalizeChartColor(series.color, `var(--sn-tab-accent-${sIndex % 6}, #2e90fa)`);
      const data = series.data || [];

      if (series.type === 'bar') {
        const barGroup = series.stack ? `stack:${series.stack}` : `series:${series.name}`;
        const barSeriesIndex = barGroups.indexOf(barGroup);
        const groupWidth = chartWidth / categoryCount;
        const barWidth = (groupWidth * 0.7) / (barGroups.length || 1);
        const gap = groupWidth * 0.3;

        data.forEach((val, idx) => {
          if (idx >= categoryCount) return;
          const x = padding + gap / 2 + groupWidth * idx + barWidth * barSeriesIndex;
          const stackKey = series.stack ? `${series.stack}\u0000${idx}` : '';
          const previousValue = stackKey ? (stackedOffsets.get(stackKey) || 0) : 0;
          const nextValue = previousValue + Number(val || 0);
          if (stackKey) stackedOffsets.set(stackKey, nextValue);
          const y = yForValue(Math.max(nextValue, minVal));
          const previousY = stackKey ? yForValue(Math.max(previousValue, minVal)) : baselineY;
          const valHeight = Math.max(1, Math.abs(previousY - y));

          const rect = this.#createSvgElement('rect', {
            x,
            y: Math.min(y, previousY),
            width: barWidth,
            height: valHeight,
            class: 'sn-chart-bar',
            fill: color,
          });

          this.#addTooltipEvents(rect, series.name, categories[idx] || `Index ${idx}`, val, idx, series.semanticTargets?.[idx]);
          svg.appendChild(rect);
        });
      } else if (series.type === 'line' || series.type === 'area') {
        let points = [];
        data.forEach((val, idx) => {
          if (idx >= categoryCount) return;
          const x = padding + (chartWidth / (categoryCount - 1 || 1)) * idx;
          const y = yForValue(Number(val));
          points.push(`${x},${y}`);
        });

        if (series.type === 'area' && points.length > 0) {
          const firstX = points[0].split(',')[0];
          const lastX = points[points.length - 1].split(',')[0];
          const areaPoints = `${firstX},${baselineY} ` + points.join(' ') + ` ${lastX},${baselineY}`;
          const polygon = this.#createSvgElement('polygon', {
            points: areaPoints,
            class: 'sn-chart-area',
            fill: color,
          });
          svg.appendChild(polygon);
        }

        if (points.length > 0) {
          const polyline = this.#createSvgElement('polyline', {
            points: points.join(' '),
            class: 'sn-chart-line',
            stroke: color,
          });
          svg.appendChild(polyline);
        }

        // Render line nodes / points
        data.forEach((val, idx) => {
          if (idx >= categoryCount) return;
          const [x, y] = points[idx].split(',');
          const circle = this.#createSvgElement('circle', {
            cx: x,
            cy: y,
            r: 4,
            class: 'sn-chart-line-point',
            stroke: color,
            fill: 'var(--sn-sys-surface-panel)',
          });
          this.#addTooltipEvents(circle, series.name, categories[idx] || `Index ${idx}`, val, idx, series.semanticTargets?.[idx]);
          svg.appendChild(circle);
        });
      } else if (series.type === 'scatter') {
        data.forEach((val, idx) => {
          if (idx >= categoryCount) return;
          const x = padding + (chartWidth / (categoryCount - 1 || 1)) * idx;
          const y = yForValue(Number(val));

          const circle = this.#createSvgElement('circle', {
            cx: String(x),
            cy: String(y),
            r: 5,
            class: 'sn-chart-line-point',
            stroke: color,
            fill: color,
          });
          this.#addTooltipEvents(circle, series.name, categories[idx] || `Index ${idx}`, val, idx, series.semanticTargets?.[idx]);
          svg.appendChild(circle);
        });
      }
    });
  }

  #renderPieChart(svg, seriesList, categories, width, height, padding) {
    const centerX = width / 2;
    const centerY = height / 2 + 10;
    const radius = Math.min(width, height) / 2 - padding;
    const isDonut = this.#spec.type === 'donut';
    const innerRadius = isDonut ? radius * this.#spec.donut.innerRadiusRatio : 0;

    // Sum values for category items
    let data = [];
    const series = seriesList[0];
    const seriesData = series?.data || [];
    let total = 0;
    seriesData.forEach((val, index) => {
      let num = Number(val || 0);
      data.push({
        label: categories[index] || `Item ${index}`,
        value: num,
      });
      total += num;
    });

    if (total === 0) total = 1;

    let accumulatedAngle = -Math.PI / 2; // Start from top
    data.forEach((item, index) => {
      const angle = (item.value / total) * Math.PI * 2;
      const x1 = centerX + radius * Math.cos(accumulatedAngle);
      const y1 = centerY + radius * Math.sin(accumulatedAngle);
      const x2 = centerX + radius * Math.cos(accumulatedAngle + angle);
      const y2 = centerY + radius * Math.sin(accumulatedAngle + angle);

      const largeArc = angle > Math.PI ? 1 : 0;
      const innerX2 = centerX + innerRadius * Math.cos(accumulatedAngle + angle);
      const innerY2 = centerY + innerRadius * Math.sin(accumulatedAngle + angle);
      const innerX1 = centerX + innerRadius * Math.cos(accumulatedAngle);
      const innerY1 = centerY + innerRadius * Math.sin(accumulatedAngle);
      const pathData = isDonut
        ? [
            `M ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${innerX2} ${innerY2}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerX1} ${innerY1}`,
            'Z',
          ].join(' ')
        : [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            'Z',
          ].join(' ');

      const color = normalizeChartColor(series.colors?.[index], `var(--sn-tab-accent-${index % 6}, #2e90fa)`);
      const path = this.#createSvgElement('path', {
        d: pathData,
        fill: color,
        class: 'sn-chart-pie-slice',
      });

      this.#addTooltipEvents(path, series.name, item.label, item.value, index, series.semanticTargets?.[index]);
      svg.appendChild(path);

      accumulatedAngle += angle;
    });

    if (isDonut) {
      const value = this.#createSvgElement('text', {
        x: centerX,
        y: centerY - 1,
        'text-anchor': 'middle',
        class: 'sn-chart-donut-value',
      });
      value.textContent = this.#spec.donut.centerValue || String(seriesData.reduce((sum, item) => sum + Number(item || 0), 0));
      svg.appendChild(value);
      if (this.#spec.donut.centerLabel) {
        const label = this.#createSvgElement('text', {
          x: centerX,
          y: centerY + 17,
          'text-anchor': 'middle',
          class: 'sn-chart-donut-label',
        });
        label.textContent = this.#spec.donut.centerLabel;
        svg.appendChild(label);
      }
    }
  }

  #renderLegend() {
    const legendContainer = this.ref.legend;
    if (!legendContainer) return;

    legendContainer.innerHTML = '';

    if (this.#spec.legend?.show === false) return;

    if ((this.#spec.type === 'pie' || this.#spec.type === 'donut') && this.#spec.series?.[0]) {
      const series = this.#spec.series[0];
      (this.#spec.xAxis?.data || []).forEach((labelText, index) => {
        const item = document.createElement('div');
        item.className = 'sn-chart-legend-item';
        item.setAttribute('data-chart-category', String(index));
        const marker = document.createElement('span');
        marker.className = 'sn-chart-legend-color';
        marker.style.backgroundColor = normalizeChartColor(series.colors?.[index], `var(--sn-tab-accent-${index % 6}, #2e90fa)`);
        const label = document.createElement('span');
        label.textContent = String(labelText);
        item.append(marker, label);
        item.addEventListener('click', () => this.#emitPointSelection(series, index, labelText, series.data?.[index]));
        legendContainer.appendChild(item);
      });
      return;
    }

    (this.#spec.series || []).forEach((series, sIndex) => {
      if (!series) return;
      const color = normalizeChartColor(series.color, `var(--sn-tab-accent-${sIndex % 6}, #2e90fa)`);
      const isHidden = this.#hiddenSeries.has(series.name);

      const item = document.createElement('div');
      item.className = 'sn-chart-legend-item';
      item.setAttribute('data-hidden', isHidden ? 'true' : 'false');

      const marker = document.createElement('span');
      marker.className = 'sn-chart-legend-color';
      marker.style.backgroundColor = color;

      const label = document.createElement('span');
      label.textContent = series.name;

      item.append(marker, label);

      item.addEventListener('click', () => {
        if (this.#hiddenSeries.has(series.name)) {
          this.#hiddenSeries.delete(series.name);
        } else {
          this.#hiddenSeries.add(series.name);
        }
        this.#renderChart();
      });

      legendContainer.appendChild(item);
    });
  }

  #emitPointSelection(series, index, label, value) {
    emit(this, 'sn-chart-select', {
      seriesName: String(series?.name || ''),
      categoryIndex: Number(index),
      label: String(label || ''),
      value: normalizeNumber(value),
      semanticTarget: series?.semanticTargets?.[index] || null,
      spec: this.#spec,
    });
  }

  #addTooltipEvents(el, seriesName, label, value, index, semanticTarget = null) {
    const series = (this.#spec.series || []).find((item) => item?.name === seriesName) || { name: seriesName, semanticTargets: [] };
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${seriesName}, ${label}: ${value}`);
    el.addEventListener('click', () => this.#emitPointSelection({ ...series, semanticTargets: series.semanticTargets || [semanticTarget] }, index, label, value));
    el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.#emitPointSelection({ ...series, semanticTargets: series.semanticTargets || [semanticTarget] }, index, label, value);
    });
    el.addEventListener('mousemove', (event) => {
      let tooltip = this.ref.tooltip;
      if (!tooltip) return;

      let rect = this.getBoundingClientRect();
      let x = event.clientX - rect.left + 10;
      let y = event.clientY - rect.top - 40;

      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      tooltip.hidden = false;
      tooltip.replaceChildren();
      let title = document.createElement('strong');
      title.textContent = seriesName;
      let details = document.createElement('span');
      details.textContent = `${label}: ${value}`;
      tooltip.append(title, document.createElement('br'), details);
    });

    el.addEventListener('mouseleave', () => {
      if (this.ref.tooltip) {
        this.ref.tooltip.hidden = true;
      }
    });
  }
}

Chart.template = template;
Chart.rootStyles = css;
Chart.reg('sn-chart');

export default Chart;
