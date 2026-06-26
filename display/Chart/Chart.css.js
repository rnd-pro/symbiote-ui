export default /*css*/ `
sn-chart {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
  box-sizing: border-box;
}

.sn-chart-container {
  display: flex;
  flex-direction: column;
  background: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 6px);
  padding: 16px;
  box-sizing: border-box;
}

.sn-chart-header {
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.sn-chart-title {
  font-size: calc(14px * var(--sn-theme-type-scale, 1));
  font-weight: 500;
  color: var(--sn-text);
}

.sn-chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--sn-text-dim, #888);
}

.sn-chart-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  transition: opacity var(--sn-transition-fast, 0.15s) ease;
}

.sn-chart-legend-item[data-hidden="true"] {
  opacity: 0.35;
}

.sn-chart-legend-color {
  display: inline-block;
  width: 12px;
  height: 8px;
  border-radius: 2px;
}

.sn-chart-svg-wrap {
  width: 100%;
  height: 220px;
  position: relative;
}

.sn-chart-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  user-select: none;
}

.sn-chart-axis {
  stroke: var(--sn-outline-color-soft, rgba(255,255,255,0.15));
  stroke-width: 1;
}

.sn-chart-grid-line {
  stroke: var(--sn-outline-color-soft, rgba(255,255,255,0.05));
  stroke-dasharray: 2 2;
  stroke-width: 1;
}

.sn-chart-bar {
  cursor: pointer;
  transition: fill var(--sn-transition-fast, 120ms);
}

.sn-chart-bar:hover {
  filter: brightness(1.2);
}

.sn-chart-line {
  fill: none;
  stroke-width: 2;
}

.sn-chart-area {
  stroke: none;
  opacity: 0.15;
}

.sn-chart-line-point {
  fill: var(--sn-panel-bg, #1e1e24);
  stroke-width: 2;
  cursor: pointer;
  transition: r var(--sn-transition-fast, 0.1s) ease, fill var(--sn-transition-fast, 0.1s) ease;
}

.sn-chart-line-point:hover {
  r: 6px;
}

.sn-chart-pie-slice {
  cursor: pointer;
  transition: transform var(--sn-transition-fast, 120ms);
}

.sn-chart-pie-slice:hover {
  transform: scale(1.03);
}

.sn-chart-threshold-line {
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.sn-chart-threshold-text {
  font-size: 9px;
  dominant-baseline: middle;
}

.sn-chart-brush-overlay {
  fill: rgba(0, 122, 204, 0.15);
  stroke: var(--sn-tabs-accent, #007acc);
  stroke-width: 1;
  pointer-events: none;
}

.sn-chart-tooltip {
  position: absolute;
  background-color: var(--sn-tooltip-bg, rgba(0, 0, 0, 0.85));
  color: var(--sn-tooltip-color, #fff);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  pointer-events: none;
  z-index: 100;
  box-shadow: var(--sn-shadow-md, 0 2px 8px rgba(0,0,0,0.5));
  line-height: 1.4;
}

.sn-chart-tooltip[hidden] {
  display: none;
}
`;
