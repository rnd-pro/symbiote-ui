export default /*css*/ `
sn-data-table {
  display: block;
  min-width: 0;
  color: var(--sn-data-table-color);
  font-family: var(--sn-font-ui);
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

.sn-data-table-empty {
  padding: var(--sn-data-table-empty-padding);
  color: var(--sn-data-table-empty-color);
  font-size: var(--sn-data-table-cell-size);
  line-height: var(--sn-data-table-line-height);
}
`;
