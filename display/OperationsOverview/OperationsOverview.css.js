export default /*css*/ `
sn-operations-overview {
  display: block;
  min-width: 0;
  color: var(--sn-sys-on-surface);
  font-family: var(--sn-font);
}

.sn-operations-overview {
  display: grid;
  gap: var(--sn-operations-overview-gap, var(--sn-space-md, 16px));
  min-width: 0;
  padding: var(--sn-operations-overview-padding, var(--sn-space-md, 16px));
}

.sn-operations-overview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sn-space-md, 16px);
  box-sizing: border-box;
  padding: var(--sn-operations-overview-widget-padding, var(--sn-space-md, 16px));
  border: 1px solid var(--sn-operations-overview-widget-border, var(--sn-sys-outline-subtle));
  border-radius: var(--sn-operations-overview-widget-radius, var(--sn-card-radius, var(--sn-radius-md, 8px)));
  background: var(--sn-operations-overview-widget-bg, var(--sn-sys-surface-overlay));
  box-shadow: var(--sn-operations-overview-widget-shadow, none);
}

.sn-operations-overview-heading {
  min-width: 0;
}

.sn-operations-overview-eyebrow,
.sn-operations-overview-updated {
  color: var(--sn-sys-on-surface-dim);
  font-size: var(--sn-text-xs, 11px);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sn-operations-overview h2 {
  margin: 4px 0 0;
  color: var(--sn-sys-on-surface);
  font-size: calc(20px * var(--sn-theme-type-scale, 1));
  line-height: 1.2;
}

.sn-operations-overview p {
  max-width: 72ch;
  margin: 6px 0 0;
  color: var(--sn-sys-on-surface-dim);
  font-size: var(--sn-text-sm, 13px);
  line-height: 1.45;
}

.sn-operations-overview-updated {
  flex: 0 0 auto;
  padding-block-start: 4px;
  white-space: nowrap;
}

.sn-operations-overview-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: var(--sn-space-sm, 10px);
}

.sn-operations-overview-metric {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    "icon label"
    "icon value"
    "icon detail";
  align-items: center;
  gap: 2px var(--sn-space-sm, 10px);
  min-width: 0;
  padding: var(--sn-operations-overview-widget-padding, var(--sn-space-md, 14px));
  border: 1px solid var(--sn-operations-overview-widget-border, var(--sn-sys-outline-subtle));
  border-radius: var(--sn-operations-overview-widget-radius, var(--sn-card-radius, var(--sn-radius-md, 8px)));
  background: var(--sn-operations-overview-widget-bg, var(--sn-sys-surface-overlay));
  box-shadow: var(--sn-operations-overview-widget-shadow, none);
  color: inherit;
  font: inherit;
  text-align: start;
}

button.sn-operations-overview-metric {
  cursor: pointer;
}

button.sn-operations-overview-metric:hover {
  border-color: color-mix(in oklch, var(--sn-operations-overview-metric-accent, var(--sn-sys-accent)) 55%, var(--sn-sys-outline));
  background: color-mix(in oklch, var(--sn-operations-overview-metric-accent, var(--sn-sys-accent)) var(--sn-sys-state-hover-mix), var(--sn-operations-overview-widget-bg, var(--sn-sys-surface-overlay)));
}

button.sn-operations-overview-metric:focus-visible {
  outline: 2px solid var(--sn-sys-accent);
  outline-offset: 2px;
}

.sn-operations-overview-metric-icon {
  grid-area: icon;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: color-mix(in oklch, var(--sn-operations-overview-metric-accent, var(--sn-sys-accent)) 15%, transparent);
  color: var(--sn-operations-overview-metric-accent, var(--sn-sys-accent));
  font-family: var(--sn-icon-font, 'Material Symbols Outlined');
  font-size: 19px;
}

.sn-operations-overview-metric-label {
  grid-area: label;
  display: -webkit-box;
  min-width: 0;
  min-block-size: 2.6em;
  overflow: hidden;
  color: var(--sn-sys-on-surface-dim);
  font-size: var(--sn-text-xs, 11px);
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.sn-operations-overview-metric-value {
  grid-area: value;
  color: var(--sn-sys-on-surface);
  font-family: var(--sn-font-mono, monospace);
  font-size: calc(21px * var(--sn-theme-type-scale, 1));
  font-weight: 700;
  line-height: 1.1;
}

.sn-operations-overview-metric-detail {
  grid-area: detail;
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  color: var(--sn-operations-overview-metric-accent, var(--sn-sys-on-surface-dim));
  font-size: var(--sn-text-xs, 11px);
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.sn-operations-overview-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--sn-space-md, 16px);
  min-width: 0;
}

.sn-operations-overview-chart {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-width: 0;
  overflow: clip;
  border: 1px solid var(--sn-operations-overview-widget-border, var(--sn-sys-outline-subtle));
  border-radius: var(--sn-operations-overview-widget-radius, var(--sn-card-radius, var(--sn-radius-md, 8px)));
  background: var(--sn-operations-overview-widget-bg, var(--sn-sys-surface-overlay));
  box-shadow: var(--sn-operations-overview-widget-shadow, none);
  --sn-chart-bg: transparent;
  --sn-chart-border: transparent;
  --sn-chart-radius: 0;
}

.sn-operations-overview-chart[data-span="wide"] {
  grid-column: 1 / -1;
}

.sn-operations-overview-chart-description {
  margin: calc(-1 * var(--sn-space-sm, 10px)) 0 0;
  padding: 0 var(--sn-operations-overview-widget-padding, var(--sn-space-md, 16px)) var(--sn-operations-overview-widget-padding, var(--sn-space-md, 16px));
  color: var(--sn-sys-on-surface-dim);
  font-size: var(--sn-text-xs, 11px);
}

.sn-operations-overview-chart sn-chart {
  min-width: 0;
}

.sn-operations-overview-chart .sn-chart-container {
  height: 100%;
}

@media (max-width: 720px) {
  .sn-operations-overview-header {
    flex-direction: column;
  }

  .sn-operations-overview-updated {
    white-space: normal;
  }
}
`;
