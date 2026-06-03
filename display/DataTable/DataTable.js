import Symbiote from '@symbiotejs/symbiote';
import { escapeHtml } from '../markdown-formatter.js';
import '../Badge/Badge.js';
import template from './DataTable.tpl.js';
import css from './DataTable.css.js';

function escapeAttr(value) {
  return escapeHtml(String(value ?? '')).replaceAll('`', '&#96;');
}

function normalizeMarker(value) {
  let marker = String(value ?? '').trim();
  if (/^var\(--sn-[a-z0-9-]+\)$/i.test(marker)) return marker;
  return '';
}

function normalizeVariant(value) {
  let variant = String(value ?? '').trim();
  if (['success', 'info', 'warning', 'error'].includes(variant)) return variant;
  return '';
}

function normalizeColumns(columns) {
  if (!Array.isArray(columns)) return [];
  return columns
    .filter((column) => column && typeof column === 'object' && column.key)
    .map((column) => ({
      key: String(column.key),
      label: String(column.label ?? column.key),
      align: column.align === 'end' || column.align === 'center' ? column.align : 'start',
    }));
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
}

function resolveCell(row, column) {
  let source = row.cells && typeof row.cells === 'object'
    ? row.cells[column.key]
    : row[column.key];
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    return source;
  }
  return { text: source };
}

function renderCellContent(cell) {
  let markerValue = normalizeMarker(cell.marker);
  let marker = markerValue
    ? `<span class="sn-data-table-marker" style="--sn-data-table-marker-color: ${escapeAttr(markerValue)}"></span>`
    : '';
  let content = cell.badge && typeof cell.badge === 'object'
    ? renderBadge(cell.badge)
    : `<span class="sn-data-table-text">${escapeHtml(cell.text ?? '')}</span>`;
  return `<span class="sn-data-table-cell">${marker}${content}</span>`;
}

function renderBadge(badge) {
  let label = escapeHtml(badge.label ?? badge.text ?? '');
  let variant = normalizeVariant(badge.variant);
  let variantAttr = variant ? ` variant="${variant}"` : '';
  return `<sn-badge${variantAttr}>${label}</sn-badge>`;
}

function renderHead(columns) {
  if (columns.length === 0) return '';
  let cells = columns.map((column) => {
    return `<th scope="col" data-align="${column.align}">${escapeHtml(column.label)}</th>`;
  }).join('');
  return `<tr>${cells}</tr>`;
}

function renderBody(columns, rows) {
  return rows.map((row) => {
    let cells = columns.map((column) => {
      let cell = resolveCell(row, column);
      let align = cell.align === 'end' || cell.align === 'center' ? cell.align : column.align;
      return `<td data-align="${align}">${renderCellContent(cell)}</td>`;
    }).join('');
    let rowId = row.id ? ` data-row-id="${escapeAttr(row.id)}"` : '';
    return `<tr${rowId}>${cells}</tr>`;
  }).join('');
}

export class DataTable extends Symbiote {
  init$ = {
    headHtml: '',
    bodyHtml: '',
    emptyText: 'No rows',
    isEmpty: true,
  };

  #columns = [];
  #rows = [];

  setColumns(columns = []) {
    this.#columns = normalizeColumns(columns);
    this.#render();
  }

  setRows(rows = []) {
    this.#rows = normalizeRows(rows);
    this.#render();
  }

  setData({ columns = this.#columns, rows = this.#rows, emptyText = this.$.emptyText } = {}) {
    this.#columns = normalizeColumns(columns);
    this.#rows = normalizeRows(rows);
    this.set$({ emptyText: String(emptyText ?? 'No rows') });
    this.#render();
  }

  getData() {
    return {
      columns: [...this.#columns],
      rows: [...this.#rows],
    };
  }

  #render() {
    let isEmpty = this.#columns.length === 0 || this.#rows.length === 0;
    this.set$({
      headHtml: renderHead(this.#columns),
      bodyHtml: renderBody(this.#columns, this.#rows),
      isEmpty,
    });
    this.toggleAttribute('empty', isEmpty);
  }
}

DataTable.template = template;
DataTable.rootStyles = css;
DataTable.reg('sn-data-table');

export default DataTable;
