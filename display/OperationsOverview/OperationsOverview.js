import Symbiote from '@symbiotejs/symbiote';
import '../Chart/Chart.js';
import template from './OperationsOverview.tpl.js';
import css from './OperationsOverview.css.js';

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeTarget(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null;
}

function normalizeModel(model = {}) {
  const source = model && typeof model === 'object' ? model : {};
  return {
    eyebrow: text(source.eyebrow),
    title: text(source.title, 'Operations overview'),
    summary: text(source.summary),
    updatedLabel: text(source.updatedLabel),
    metrics: Array.isArray(source.metrics) ? source.metrics.filter(Boolean).map((metric, index) => ({
      id: text(metric.id, `metric-${index + 1}`),
      label: text(metric.label),
      value: text(metric.value, '—'),
      detail: text(metric.detail),
      icon: text(metric.icon, 'monitoring'),
      accent: text(metric.accent),
      semanticTarget: normalizeTarget(metric.semanticTarget),
    })) : [],
    charts: Array.isArray(source.charts) ? source.charts.filter(Boolean).map((chart, index) => ({
      id: text(chart.id, `chart-${index + 1}`),
      description: text(chart.description),
      span: chart.span === 'wide' ? 'wide' : 'standard',
      spec: chart.spec && typeof chart.spec === 'object' ? chart.spec : {},
    })) : [],
  };
}

function emit(el, detail) {
  el.dispatchEvent(new CustomEvent('sn-analytics-select', {
    bubbles: true,
    composed: true,
    detail,
  }));
}

export class OperationsOverview extends Symbiote {
  #model = normalizeModel();

  connectedCallback() {
    super.connectedCallback?.();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'region');
    this.#render();
  }

  setModel(model = {}) {
    this.#model = normalizeModel(model);
    this.#render();
  }

  getModel() {
    return structuredClone(this.#model);
  }

  #render() {
    if (!this.ref.title) return;
    const model = this.#model;
    this.ref.eyebrow.textContent = model.eyebrow;
    this.ref.eyebrow.hidden = !model.eyebrow;
    this.ref.title.textContent = model.title;
    this.ref.summary.textContent = model.summary;
    this.ref.summary.hidden = !model.summary;
    this.ref.updated.textContent = model.updatedLabel;
    this.ref.updated.hidden = !model.updatedLabel;
    this.setAttribute('aria-label', model.title);

    this.ref.metrics.replaceChildren(...model.metrics.map((metric) => {
      const item = document.createElement(metric.semanticTarget ? 'button' : 'div');
      item.className = 'sn-operations-overview-metric';
      item.dataset.metricId = metric.id;
      if (metric.accent) item.style.setProperty('--sn-operations-overview-metric-accent', metric.accent);
      const icon = document.createElement('span');
      icon.className = 'sn-operations-overview-metric-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = metric.icon;
      const label = document.createElement('span');
      label.className = 'sn-operations-overview-metric-label';
      label.textContent = metric.label;
      const value = document.createElement('span');
      value.className = 'sn-operations-overview-metric-value';
      value.textContent = metric.value;
      const detail = document.createElement('span');
      detail.className = 'sn-operations-overview-metric-detail';
      detail.textContent = metric.detail;
      detail.hidden = !metric.detail;
      item.append(icon, label, value, detail);
      if (metric.semanticTarget) {
        item.type = 'button';
        item.addEventListener('click', () => emit(this, {
          source: 'metric',
          metricId: metric.id,
          semanticTarget: metric.semanticTarget,
        }));
      }
      return item;
    }));

    this.ref.charts.replaceChildren(...model.charts.map((chartModel) => {
      const section = document.createElement('section');
      section.className = 'sn-operations-overview-chart';
      section.dataset.chartId = chartModel.id;
      section.dataset.span = chartModel.span;
      const chart = document.createElement('sn-chart');
      chart.setSpec(chartModel.spec);
      chart.addEventListener('sn-chart-select', (event) => emit(this, {
        source: 'chart',
        chartId: chartModel.id,
        ...event.detail,
      }));
      section.append(chart);
      if (chartModel.description) {
        const description = document.createElement('p');
        description.className = 'sn-operations-overview-chart-description';
        description.textContent = chartModel.description;
        section.append(description);
      }
      return section;
    }));
  }
}

OperationsOverview.template = template;
OperationsOverview.rootStyles = css;
OperationsOverview.reg('sn-operations-overview');

export default OperationsOverview;
