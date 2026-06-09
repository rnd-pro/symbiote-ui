import Symbiote from '@symbiotejs/symbiote';
import { escapeHtml } from '../markdown-formatter.js';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import '../Badge/Badge.js';
import template from './DataTable.tpl.js';
import css from './DataTable.css.js';

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

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
      sortable: Boolean(column.sortable),
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

function renderHead(columns, sortColumn, sortDirection, hasExpand) {
  if (columns.length === 0) return '';
  let cells = columns.map((column) => {
    let ariaSort = '';
    let sortIndicator = '';

    if (column.sortable) {
      let isSorted = sortColumn === column.key;
      ariaSort = ` aria-sort="${isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}"`;
      let icon = 'unfold_more';
      if (isSorted) {
        icon = sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
      }
      sortIndicator = `<button class="sn-data-table-sort-btn" data-column-key="${escapeAttr(column.key)}" aria-label="Sort by ${escapeAttr(column.label)}">
        <span class="material-symbols-outlined">${icon}</span>
      </button>`;
    }

    return `<th scope="col" data-align="${column.align}"${ariaSort}>
      <div class="sn-data-table-header-content">
        <span>${escapeHtml(column.label)}</span>
        ${sortIndicator}
      </div>
    </th>`;
  }).join('');

  if (hasExpand) {
    return `<tr><th scope="col" style="width: 40px;"></th>${cells}</tr>`;
  }
  return `<tr>${cells}</tr>`;
}

function renderBody(columns, rows, selectedRowId, expandedRowIds, hasExpand) {
  return rows.map((row) => {
    let cells = columns.map((column) => {
      let cell = resolveCell(row, column);
      let align = cell.align === 'end' || cell.align === 'center' ? cell.align : column.align;
      return `<td data-align="${align}">${renderCellContent(cell)}</td>`;
    }).join('');

    let rowId = row.id ? ` data-row-id="${escapeAttr(row.id)}"` : '';
    let isSelected = row.id && String(row.id) === String(selectedRowId);
    let ariaSelected = isSelected ? ' aria-selected="true"' : '';
    let tabIndex = ' tabindex="-1"';
    let isExpanded = row.id && expandedRowIds.has(String(row.id));

    let expandCell = '';
    let expandRowHtml = '';

    if (hasExpand) {
      if (row.details) {
        expandCell = `<td>
          <button class="sn-data-table-expand-btn" data-row-id="${escapeAttr(row.id)}" aria-label="${isExpanded ? 'Collapse' : 'Expand'} row" aria-expanded="${isExpanded}">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </td>`;
        if (isExpanded) {
          expandRowHtml = `<tr class="sn-data-table-details-row">
            <td colspan="${columns.length + 1}">${row.details}</td>
          </tr>`;
        }
      } else {
        expandCell = '<td></td>';
      }
    }

    let ariaExpandedAttr = row.details ? ` aria-expanded="${isExpanded}"` : '';

    return `<tr${rowId}${ariaSelected}${tabIndex}${ariaExpandedAttr}>${expandCell}${cells}</tr>${expandRowHtml}`;
  }).join('');
}

export class DataTable extends Symbiote {
  static observedAttributes = ['loading', 'selected-row-id'];

  #columns = [];
  #rows = [];
  #expandedRowIds = new Set();

  init$ = {
    headHtml: '',
    bodyHtml: '',
    emptyText: 'No rows',
    loadingText: 'Loading...',
    errorText: '',
    loading: false,
    selectedRowId: '',
    sortColumn: '',
    sortDirection: 'none',
    isEmpty: true,
    showTable: false,
    hideTable: true,

    onHeadClick: (event) => {
      let sortBtn = event.target?.closest('.sn-data-table-sort-btn');
      if (!sortBtn) return;
      event.stopPropagation();
      let columnKey = sortBtn.dataset.columnKey;
      let currentDir = this.$.sortDirection;
      let nextDir = 'asc';
      if (this.$.sortColumn === columnKey) {
        if (currentDir === 'asc') nextDir = 'desc';
        else if (currentDir === 'desc') nextDir = 'none';
      }
      this.$.sortColumn = columnKey;
      this.$.sortDirection = nextDir;
      this.#render();
      emit(this, 'sn-data-table-sort', { columnKey, direction: nextDir });
    },

    onBodyClick: (event) => {
      let expandBtn = event.target?.closest('.sn-data-table-expand-btn');
      if (expandBtn) {
        event.stopPropagation();
        let rowId = expandBtn.dataset.rowId;
        this.toggleRowExpansion(rowId);
        return;
      }

      let tr = event.target?.closest('tr');
      if (!tr || tr.classList.contains('sn-data-table-details-row')) return;
      let rowId = tr.dataset.rowId;
      if (rowId) {
        this.selectedRowId = rowId;
        let rowData = this.#rows.find(r => String(r.id) === rowId);
        emit(this, 'sn-data-table-select', { rowId, row: rowData });
      }
    },

    onBodyKeyDown: (event) => {
      const tbody = this.querySelector('tbody');
      if (!tbody) return;
      const rows = Array.from(tbody.querySelectorAll('tr:not(.sn-data-table-details-row)'));
      if (rows.length === 0) return;

      const activeEl = document.activeElement;
      let index = rows.indexOf(activeEl);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (index < rows.length - 1) {
            rows[index].setAttribute('tabindex', '-1');
            rows[index + 1].setAttribute('tabindex', '0');
            rows[index + 1].focus();
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (index > 0) {
            rows[index].setAttribute('tabindex', '-1');
            rows[index - 1].setAttribute('tabindex', '0');
            rows[index - 1].focus();
          }
          break;
        case ' ':
        case 'Enter':
          event.preventDefault();
          if (index >= 0) {
            let tr = rows[index];
            let rowId = tr.dataset.rowId;
            if (rowId) {
              this.selectedRowId = rowId;
              let rowData = this.#rows.find(r => String(r.id) === rowId);
              emit(this, 'sn-data-table-select', { rowId, row: rowData });
            }
          }
          break;
        case 'ArrowRight': {
          if (index >= 0) {
            let tr = rows[index];
            let rowId = tr.dataset.rowId;
            if (rowId && tr.hasAttribute('aria-expanded') && tr.getAttribute('aria-expanded') === 'false') {
              event.preventDefault();
              this.toggleRowExpansion(rowId, true);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          if (index >= 0) {
            let tr = rows[index];
            let rowId = tr.dataset.rowId;
            if (rowId && tr.hasAttribute('aria-expanded') && tr.getAttribute('aria-expanded') === 'true') {
              event.preventDefault();
              this.toggleRowExpansion(rowId, false);
            }
          }
          break;
        }
      }
    }
  };

  toggleRowExpansion(rowId, forceState) {
    if (forceState === true) {
      this.#expandedRowIds.add(String(rowId));
    } else if (forceState === false) {
      this.#expandedRowIds.delete(String(rowId));
    } else {
      if (this.#expandedRowIds.has(String(rowId))) {
        this.#expandedRowIds.delete(String(rowId));
      } else {
        this.#expandedRowIds.add(String(rowId));
      }
    }
    this.#render();
  }

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

  get loading() { return this.hasAttribute('loading'); }
  set loading(val) {
    this.toggleAttribute('loading', Boolean(val));
    this.$.loading = Boolean(val);
  }

  get errorText() { return this.$.errorText; }
  set errorText(val) {
    this.$.errorText = String(val || '');
    this.#render();
  }

  get selectedRowId() { return this.$.selectedRowId; }
  set selectedRowId(val) {
    this.$.selectedRowId = String(val || '');
    this.setAttribute('selected-row-id', this.$.selectedRowId);
    this.#render();
  }

  get sortColumn() { return this.$.sortColumn; }
  set sortColumn(val) {
    this.$.sortColumn = String(val || '');
    this.#render();
  }

  get sortDirection() { return this.$.sortDirection; }
  set sortDirection(val) {
    this.$.sortDirection = String(val || '');
    this.#render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'loading') {
      this.$.loading = newValue !== null;
    } else if (name === 'selected-row-id') {
      this.$.selectedRowId = newValue || '';
      this.#render();
    } else {
      super.attributeChangedCallback?.(name, oldValue, newValue);
    }
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.$.loading = this.hasAttribute('loading');
    this.$.selectedRowId = this.getAttribute('selected-row-id') || '';
    this.#render();
  }

  #render() {
    let isEmpty = this.#columns.length === 0 || this.#rows.length === 0;
    let hasExpand = this.#rows.some(r => r.details);

    const iconNames = ['chevron_right'];
    const sortIcons = this.#columns.filter(c => c.sortable).map(() => 'unfold_more');
    if (sortIcons.length > 0) {
      iconNames.push('unfold_more', 'arrow_upward', 'arrow_downward');
    }
    ensureMaterialSymbols(iconNames);

    this.set$({
      headHtml: renderHead(this.#columns, this.$.sortColumn, this.$.sortDirection, hasExpand),
      bodyHtml: renderBody(this.#columns, this.#rows, this.$.selectedRowId, this.#expandedRowIds, hasExpand),
      isEmpty,
      showTable: !isEmpty && !this.$.errorText,
      hideTable: isEmpty || Boolean(this.$.errorText),
    });
    this.toggleAttribute('empty', isEmpty);

    // Apply roving focus defaults after rendering the rows
    setTimeout(() => {
      const tbody = this.querySelector('tbody');
      if (!tbody) return;
      const trs = Array.from(tbody.querySelectorAll('tr:not(.sn-data-table-details-row)'));
      if (trs.length > 0) {
        trs.forEach((tr) => {
          let isSelected = tr.dataset.rowId && String(tr.dataset.rowId) === String(this.$.selectedRowId);
          tr.setAttribute('tabindex', isSelected ? '0' : '-1');
        });
        if (!trs.some(t => t.getAttribute('tabindex') === '0')) {
          trs[0].setAttribute('tabindex', '0');
        }
      }
    }, 0);
  }
}

DataTable.template = template;
DataTable.rootStyles = css;
DataTable.reg('sn-data-table');

export default DataTable;
