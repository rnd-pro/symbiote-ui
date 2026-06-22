export default /*css*/ `
sn-data-table {
  display: block;
  min-width: var(--sn-data-table-min-width);
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
  border: 1px solid var(--sn-data-table-border, var(--sn-outline-color-soft));
  border-radius: var(--sn-data-table-radius, 6px);
  background: var(--sn-data-table-bg, var(--sn-panel-bg));
  overflow: hidden;
  position: relative;
}

.sn-data-table-scroll {
  min-width: 0;
  overflow: auto;
}

.sn-data-table table {
  width: 100%;
  min-width: var(--sn-data-table-min-width, 100%);
  border-collapse: separate;
  border-spacing: 0;
}

.sn-data-table th,
.sn-data-table td {
  box-sizing: border-box;
  min-width: 0;
  padding: var(--sn-data-table-cell-padding, 8px 12px);
  text-align: start;
  vertical-align: middle;
}

.sn-data-table th {
  border-block-end: 1px solid var(--sn-data-table-header-border, var(--sn-outline-color-soft));
  background: var(--sn-data-table-header-bg, var(--sn-surface));
  color: var(--sn-data-table-header-color, var(--sn-text-dim));
  font-size: var(--sn-data-table-header-size, 12px);
  font-weight: var(--sn-data-table-header-weight, 500);
  line-height: var(--sn-data-table-line-height, 1.4);
  text-transform: var(--sn-data-table-header-transform, none);
  white-space: nowrap;
}

.sn-data-table td {
  border-block-end: 1px solid var(--sn-data-table-row-border, var(--sn-outline-color-soft));
  color: var(--sn-data-table-color, var(--sn-text));
  font-size: var(--sn-data-table-cell-size, 13px);
  line-height: var(--sn-data-table-line-height, 1.4);
}

/* Sticky pinned columns styling */
.sn-data-table th[style*="position: sticky"] {
  background: var(--sn-data-table-header-bg, var(--sn-surface));
  z-index: 3;
}

.sn-data-table td[style*="position: sticky"] {
  background: var(--sn-data-table-bg, var(--sn-panel-bg));
  z-index: 2;
}

.sn-data-table tbody tr[aria-selected="true"] td[style*="position: sticky"] {
  background: var(--sn-data-table-row-selected-bg, rgba(0, 122, 204, 0.15));
}

.sn-data-table tbody tr:hover td[style*="position: sticky"] {
  background: var(--sn-data-table-row-hover-bg, rgba(255, 255, 255, 0.04));
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
  gap: var(--sn-data-table-cell-gap, 6px);
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
  width: var(--sn-data-table-marker-size, 8px);
  height: var(--sn-data-table-marker-size, 8px);
  border-radius: var(--sn-data-table-marker-radius, 50%);
  background: var(--sn-data-table-marker-color, var(--sn-node-selected));
}

.sn-data-table-error {
  padding: var(--sn-data-table-empty-padding, 16px);
  color: var(--sn-status-error, #f85149);
  font-size: var(--sn-data-table-cell-size, 13px);
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid var(--sn-status-error, #f85149);
  border-radius: var(--sn-data-table-radius, 4px);
  margin: var(--sn-space-sm);
}

.sn-data-table-empty {
  padding: var(--sn-data-table-empty-padding, 32px);
  color: var(--sn-data-table-empty-color, var(--sn-text-dim));
  font-size: var(--sn-data-table-cell-size, 13px);
  line-height: var(--sn-data-table-line-height, 1.4);
  text-align: center;
}

.sn-data-table-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sn-space-md);
  background: var(--sn-data-table-loading-bg, rgba(30, 30, 30, 0.7));
  backdrop-filter: blur(1px);
  z-index: 10;
  color: var(--sn-text);
  font-size: var(--sn-data-table-cell-size, 13px);
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
  font-size: var(--sn-text-lg);
}

[aria-sort="ascending"] .sn-data-table-sort-btn,
[aria-sort="descending"] .sn-data-table-sort-btn {
  color: var(--sn-tabs-accent, #007acc);
}

.sn-data-table-expand-btn,
.sn-data-table-tree-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--sn-text-dim, #888);
  cursor: pointer;
  padding: var(--sn-space-xs);
  border-radius: 4px;
  outline: none;
  transition: color 0.1s, background 0.1s;
  vertical-align: middle;
}

.sn-data-table-expand-btn:hover,
.sn-data-table-expand-btn:focus-visible,
.sn-data-table-tree-btn:hover,
.sn-data-table-tree-btn:focus-visible {
  color: var(--sn-text);
  background: rgba(255, 255, 255, 0.1);
}

.sn-data-table-expand-btn .material-symbols-outlined,
.sn-data-table-tree-btn .material-symbols-outlined {
  font-size: var(--sn-text-xl);
  transition: transform var(--sn-transition-fast, 120ms);
}

tr[aria-expanded="true"] .sn-data-table-expand-btn .material-symbols-outlined {
  transform: rotate(90deg);
}

.sn-data-table-details-row td {
  padding: 12px 16px 12px 36px;
  background: var(--sn-data-table-details-bg, rgba(255, 255, 255, 0.02));
  border-block-end: 1px solid var(--sn-data-table-row-border, var(--sn-outline-color-soft));
}

.sn-data-table tbody tr:focus {
  outline: 2px solid var(--sn-focus-ring-color, var(--sn-tabs-accent, #007acc));
  outline-offset: -2px;
}
`;
