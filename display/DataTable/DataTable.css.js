export default /*css*/ `
sn-data-table {
  display: block;
  min-width: 0;
  color: var(--sn-data-table-color, var(--sn-text));
  font-family: var(--sn-font-ui, inherit);
  position: relative;
}

sn-data-table[hidden] {
  display: none !important;
}

.sn-data-table {
  box-sizing: border-box;
  min-width: 0;
  border: 1px solid var(--sn-data-table-border);
  border-radius: var(--sn-data-table-radius);
  background: var(--sn-data-table-bg);
  overflow: hidden;
  position: relative;
}

.sn-data-table-scroll {
  min-width: 0;
  overflow: auto;
}

.sn-data-table table {
  width: 100%;
  min-width: var(--sn-data-table-min-width);
  border-collapse: collapse;
}

.sn-data-table th,
.sn-data-table td {
  box-sizing: border-box;
  min-width: 0;
  padding: var(--sn-data-table-cell-padding);
  text-align: start;
  vertical-align: middle;
}

.sn-data-table th {
  border-block-end: 1px solid var(--sn-data-table-header-border);
  background: var(--sn-data-table-header-bg);
  color: var(--sn-data-table-header-color);
  font-size: var(--sn-data-table-header-size);
  font-weight: var(--sn-data-table-header-weight);
  line-height: var(--sn-data-table-line-height);
  text-transform: var(--sn-data-table-header-transform);
  white-space: nowrap;
}

.sn-data-table td {
  border-block-end: 1px solid var(--sn-data-table-row-border);
  color: var(--sn-data-table-color);
  font-size: var(--sn-data-table-cell-size);
  line-height: var(--sn-data-table-line-height);
}

.sn-data-table tbody tr {
  cursor: pointer;
  transition: background 0.1s ease;
}

.sn-data-table tbody tr:hover {
  background: var(--sn-data-table-row-hover-bg, rgba(255, 255, 255, 0.04));
}

.sn-data-table tbody tr[aria-selected="true"] {
  background: var(--sn-data-table-row-selected-bg, rgba(0, 122, 204, 0.15));
}

.sn-data-table tr:last-child td {
  border-block-end: 0;
}

.sn-data-table [data-align="end"] {
  text-align: end;
}

.sn-data-table [data-align="center"] {
  text-align: center;
}

.sn-data-table-cell {
  display: inline-flex;
  align-items: center;
  gap: var(--sn-data-table-cell-gap);
  max-width: 100%;
  min-width: 0;
}

.sn-data-table-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sn-data-table-marker {
  flex: 0 0 auto;
  width: var(--sn-data-table-marker-size);
  height: var(--sn-data-table-marker-size);
  border-radius: var(--sn-data-table-marker-radius);
  background: var(--sn-data-table-marker-color, var(--sn-node-selected));
}

.sn-data-table-error {
  padding: var(--sn-data-table-empty-padding, 16px);
  color: var(--sn-status-error, #f85149);
  font-size: var(--sn-data-table-cell-size);
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid var(--sn-status-error, #f85149);
  border-radius: var(--sn-data-table-radius, 4px);
  margin: 8px;
}

.sn-data-table-empty {
  padding: var(--sn-data-table-empty-padding);
  color: var(--sn-data-table-empty-color);
  font-size: var(--sn-data-table-cell-size);
  line-height: var(--sn-data-table-line-height);
  text-align: center;
}

.sn-data-table-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--sn-data-table-loading-bg, rgba(30, 30, 30, 0.7));
  backdrop-filter: blur(1px);
  z-index: 10;
  color: var(--sn-text);
  font-size: var(--sn-data-table-cell-size);
}

.sn-data-table-spinner {
  display: inline-block;
  width: 1.5em;
  height: 1.5em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: sn-data-table-spin 0.6s linear infinite;
}

@keyframes sn-data-table-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .sn-data-table-spinner {
    animation-duration: 2s;
  }
}

.sn-data-table-header-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sn-data-table-sort-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--sn-text-dim, #888);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  outline: none;
  transition: color 0.1s, background 0.1s;
}

.sn-data-table-sort-btn:hover,
.sn-data-table-sort-btn:focus-visible {
  color: var(--sn-text);
  background: rgba(255, 255, 255, 0.1);
}

.sn-data-table-sort-btn .material-symbols-outlined {
  font-size: 14px;
}

[aria-sort="ascending"] .sn-data-table-sort-btn,
[aria-sort="descending"] .sn-data-table-sort-btn {
  color: var(--sn-tabs-accent, #007acc);
}

.sn-data-table-expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--sn-text-dim, #888);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  outline: none;
  transition: color 0.1s, background 0.1s;
}

.sn-data-table-expand-btn:hover,
.sn-data-table-expand-btn:focus-visible {
  color: var(--sn-text);
  background: rgba(255, 255, 255, 0.1);
}

.sn-data-table-expand-btn .material-symbols-outlined {
  font-size: 16px;
  transition: transform var(--sn-transition-fast, 120ms);
}

tr[aria-expanded="true"] .sn-data-table-expand-btn .material-symbols-outlined {
  transform: rotate(90deg);
}

.sn-data-table-details-row td {
  padding: 12px 16px 12px 36px;
  background: var(--sn-data-table-details-bg, rgba(255, 255, 255, 0.02));
  border-block-end: 1px solid var(--sn-data-table-row-border);
}

.sn-data-table tbody tr:focus {
  outline: 2px solid var(--sn-focus-ring-color, currentColor);
  outline-offset: -2px;
}
`;
