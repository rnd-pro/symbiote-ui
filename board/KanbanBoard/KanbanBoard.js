import Symbiote from '@symbiotejs/symbiote';
import '../../display/EmptyState/EmptyState.js';
import template from './KanbanBoard.tpl.js';
import css from './KanbanBoard.css.js';

function normalizeText(value, fallback = '') {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function normalizeId(value, fallback = '') {
  let text = normalizeText(value, fallback);
  return text.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleFromId(value) {
  return normalizeText(value)
    .split(/[-_:/]+/)
    .filter(Boolean)
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function normalizeChip(value) {
  if (value && typeof value === 'object') {
    let label = normalizeText(value.label ?? value.title ?? value.text ?? value.value);
    if (!label) return null;
    return {
      label,
      kind: normalizeText(value.kind ?? value.variant ?? value.status),
      title: normalizeText(value.title),
    };
  }
  let label = normalizeText(value);
  return label ? { label, kind: '', title: '' } : null;
}

function normalizeAction(value, index = 0) {
  let action = value && typeof value === 'object' ? value : { label: value };
  let id = normalizeText(action.id ?? action.action ?? action.name, `action-${index + 1}`);
  let label = normalizeText(action.label ?? action.title);
  return {
    id,
    label,
    icon: normalizeText(action.icon),
    title: normalizeText(action.title, label || titleFromId(id)),
    disabled: Boolean(action.disabled),
    kind: normalizeText(action.kind ?? action.variant),
    raw: action,
  };
}

export function normalizeKanbanCard(raw = {}, index = 0, fallbackColumnId = '') {
  let card = raw && typeof raw === 'object' ? raw : { title: raw };
  let title = normalizeText(card.title ?? card.label ?? card.name, `Card ${index + 1}`);
  let id = normalizeText(card.id ?? card.cardId ?? card.key);
  if (!id) id = normalizeId(`${fallbackColumnId}-${title}`, `card-${index + 1}`);
  let columnId = normalizeId(card.columnId ?? card.column_id ?? card.laneId ?? card.stage, fallbackColumnId);
  return {
    id,
    columnId,
    title,
    summary: normalizeText(card.summary ?? card.description ?? card.body),
    meta: asArray(card.meta ?? card.badges ?? card.labels).map(normalizeChip).filter(Boolean),
    footer: asArray(card.footer ?? card.statuses ?? card.flags).map(normalizeChip).filter(Boolean),
    actions: asArray(card.actions).map(normalizeAction),
    draggable: card.draggable !== false,
    raw: card,
  };
}

export function normalizeKanbanColumn(raw = {}, index = 0, rootCards = []) {
  let column = raw && typeof raw === 'object' ? raw : { title: raw };
  let id = normalizeId(column.id ?? column.columnId ?? column.key ?? column.name, `column-${index + 1}`);
  let cards = asArray(column.cards).length
    ? asArray(column.cards)
    : rootCards.filter(card => normalizeId(card.columnId ?? card.column_id ?? card.laneId ?? card.stage) === id);
  let normalizedCards = cards.map((card, cardIndex) => normalizeKanbanCard(card, cardIndex, id));
  return {
    id,
    title: normalizeText(column.title ?? column.label ?? column.name, titleFromId(id)),
    description: normalizeText(column.description ?? column.summary ?? column.gate),
    count: Number.isFinite(Number(column.count)) ? Number(column.count) : normalizedCards.length,
    cards: normalizedCards,
    raw: column,
  };
}

export function normalizeKanbanBoardModel(input = {}) {
  let board = input && typeof input === 'object' ? input : {};
  let rootCards = asArray(board.cards);
  let columns = asArray(board.columns).map((column, index) => normalizeKanbanColumn(column, index, rootCards));
  return {
    id: normalizeText(board.id ?? board.boardId ?? board.key),
    title: normalizeText(board.title ?? board.label ?? board.name),
    columns,
    raw: board,
  };
}

function makeElement(tagName, className = '', textContent = '') {
  let element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

function appendNodes(parent, value) {
  let nodes = Array.isArray(value) ? value : [value];
  for (let node of nodes) {
    if (!node) continue;
    if (typeof node === 'string') {
      parent.append(document.createTextNode(node));
    } else {
      parent.append(node);
    }
  }
}

export class KanbanBoard extends Symbiote {
  static observedAttributes = ['empty-text', 'label'];

  init$ = {
    emptyText: 'No board columns.',
  };

  #board = normalizeKanbanBoardModel();
  #selectedCardId = '';
  #dragCardId = '';
  #headerSyncId = 0;
  #resizeHandler = null;

  renderCard = null;
  renderColumnBody = null;
  renderColumnHeader = null;

  initCallback() {
    this.ref.columns.addEventListener('click', (event) => this.#onClick(event));
    this.ref.columns.addEventListener('click', (event) => this.#onColumnHeaderInteraction(event));
    this.ref.columns.addEventListener('keydown', (event) => this.#onKeyDown(event));
    this.ref.columns.addEventListener('dragstart', (event) => this.#onDragStart(event));
    this.ref.columns.addEventListener('dragend', () => this.#clearDropState());
    this.ref.columns.addEventListener('dragover', (event) => this.#onDragOver(event));
    this.ref.columns.addEventListener('dragleave', (event) => this.#onDragLeave(event));
    this.ref.columns.addEventListener('drop', (event) => this.#onDrop(event));
    this.ref.columns.addEventListener('toggle', () => this.#syncColumnHeaderHeights(), true);
    this.#resizeHandler = () => this.#syncColumnHeaderHeights();
    globalThis.addEventListener?.('resize', this.#resizeHandler);
    this.#syncAttributes();
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    if (this.#resizeHandler) {
      globalThis.removeEventListener?.('resize', this.#resizeHandler);
      this.#resizeHandler = null;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'empty-text') {
      this.$.emptyText = normalizeText(newValue, 'No board columns.');
      return;
    }
    if (name === 'label') {
      this.setAttribute('aria-label', normalizeText(newValue, 'Kanban board'));
      return;
    }
    super.attributeChangedCallback?.(name, oldValue, newValue);
  }

  setBoard(board = {}, options = {}) {
    if ('renderCard' in options) this.renderCard = options.renderCard;
    if ('renderColumnBody' in options) this.renderColumnBody = options.renderColumnBody;
    if ('renderColumnHeader' in options) this.renderColumnHeader = options.renderColumnHeader;
    this.#board = normalizeKanbanBoardModel(board);
    this.#ensureSelection();
    this.#render();
    return this.#board;
  }

  setColumns(columns = [], options = {}) {
    return this.setBoard({ columns }, options);
  }

  getBoard() {
    return this.#board;
  }

  getSelectedCard() {
    return this.#cardById(this.#selectedCardId);
  }

  selectCard(cardId = '') {
    let card = this.#cardById(cardId);
    if (!card) return null;
    this.#selectedCardId = card.id;
    this.#syncCardSelection();
    this.#dispatch('sn-board-card-select', { card, column: this.#columnById(card.columnId) });
    return card;
  }

  #syncAttributes() {
    this.$.emptyText = normalizeText(this.getAttribute('empty-text'), this.$.emptyText);
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', normalizeText(this.getAttribute('label'), this.#board.title || 'Kanban board'));
  }

  #ensureSelection() {
    if (this.#cardById(this.#selectedCardId)) return;
    this.#selectedCardId = this.#board.columns.flatMap(column => column.cards)[0]?.id || '';
  }

  #cardById(cardId = '') {
    let id = normalizeText(cardId);
    if (!id) return null;
    for (let column of this.#board.columns) {
      let card = column.cards.find(item => item.id === id);
      if (card) return card;
    }
    return null;
  }

  #columnById(columnId = '') {
    let id = normalizeId(columnId);
    return this.#board.columns.find(column => column.id === id) || null;
  }

  #render() {
    this.#syncAttributes();
    let columns = this.#board.columns;
    this.ref.empty.hidden = columns.length > 0;
    this.ref.columns.replaceChildren(...columns.map(column => this.#renderColumn(column)));
    this.#syncColumnHeaderHeights();
  }

  #renderColumn(column) {
    let lane = makeElement('section', 'sn-kanban-column');
    lane.dataset.columnId = column.id;
    lane.setAttribute('aria-label', column.title);

    let header = makeElement('header', 'sn-kanban-column-header');
    let customHeader = typeof this.renderColumnHeader === 'function'
      ? this.renderColumnHeader(column, { board: this.#board, host: this })
      : null;
    if (customHeader) {
      appendNodes(header, customHeader);
    } else {
      let copy = makeElement('div');
      copy.append(
        makeElement('div', 'sn-kanban-column-title', column.title),
        makeElement('div', 'sn-kanban-column-description', column.description || 'No description.'),
      );
      header.append(copy, makeElement('span', 'sn-kanban-column-count', String(column.count)));
    }

    let body = makeElement('div', 'sn-kanban-column-body');
    let customBody = typeof this.renderColumnBody === 'function'
      ? this.renderColumnBody(column, { board: this.#board, host: this })
      : null;
    if (customBody) {
      appendNodes(body, customBody);
    } else {
      body.append(this.#renderCardList(column));
    }
    lane.append(header, body);
    return lane;
  }

  #renderCardList(column) {
    let list = makeElement('div', 'sn-kanban-card-list');
    list.dataset.columnId = column.id;
    if (!column.cards.length) {
      list.append(makeElement('div', 'sn-kanban-column-empty', 'No cards in this column.'));
      return list;
    }
    list.replaceChildren(...column.cards.map(card => this.#renderCard(card, column)));
    return list;
  }

  #renderCard(card, column) {
    let custom = typeof this.renderCard === 'function'
      ? this.renderCard(card, { column, board: this.#board, host: this })
      : null;
    if (custom) return custom;

    let cardEl = makeElement('article', 'sn-kanban-card');
    cardEl.dataset.snBoardCardId = card.id;
    cardEl.draggable = card.draggable;
    cardEl.tabIndex = 0;
    cardEl.setAttribute('role', 'button');
    cardEl.setAttribute('aria-selected', String(card.id === this.#selectedCardId));
    cardEl.setAttribute('aria-label', card.title);

    let meta = makeElement('div', 'sn-kanban-card-meta');
    for (let chip of card.meta) meta.append(this.#renderChip(chip));
    let title = makeElement('div', 'sn-kanban-card-title', card.title);
    let summary = makeElement('div', 'sn-kanban-card-summary', card.summary || '');
    let footer = makeElement('div', 'sn-kanban-card-footer');
    for (let chip of card.footer) footer.append(this.#renderChip(chip));
    if (card.actions.length) footer.append(this.#renderActionMenu(card));
    cardEl.append(meta, title, summary, footer);
    return cardEl;
  }

  #renderChip(chip) {
    let node = makeElement('span', 'sn-kanban-chip', chip.label);
    if (chip.kind) node.dataset.kind = chip.kind;
    if (chip.title) node.title = chip.title;
    return node;
  }

  #renderActionMenu(card) {
    let details = makeElement('details', 'sn-kanban-card-actions');
    let summary = makeElement('summary', 'sn-kanban-card-menu');
    summary.title = 'Card actions';
    summary.setAttribute('aria-label', 'Card actions');
    summary.append(makeElement('span', 'material-symbols-outlined', 'more_horiz'));
    let menu = makeElement('div', 'sn-kanban-card-menu-list');
    for (let action of card.actions) menu.append(this.#renderAction(card, action));
    details.append(summary, menu);
    return details;
  }

  #renderAction(card, action) {
    let button = makeElement('button', 'sn-kanban-card-action');
    button.type = 'button';
    button.dataset.snBoardAction = action.id;
    button.dataset.snBoardCardId = card.id;
    button.disabled = action.disabled;
    button.title = action.title;
    button.setAttribute('aria-label', action.title);
    if (action.kind) button.dataset.kind = action.kind;
    if (action.icon) {
      button.append(makeElement('span', 'material-symbols-outlined', action.icon));
    }
    button.append(makeElement('span', 'sn-kanban-card-action-label', action.label || action.title));
    return button;
  }

  #onClick(event) {
    let action = event.target.closest?.('[data-sn-board-action]');
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      let card = this.#cardById(action.dataset.snBoardCardId);
      if (!card) return;
      this.#dispatch('sn-board-card-action', {
        actionId: action.dataset.snBoardAction,
        card,
        column: this.#columnById(card.columnId),
      });
      return;
    }
    if (event.target.closest?.('.sn-kanban-card-actions')) return;
    let cardEl = event.target.closest?.('[data-sn-board-card-id]');
    if (cardEl) this.selectCard(cardEl.dataset.snBoardCardId);
  }

  #onKeyDown(event) {
    if (event.target.closest?.('.sn-kanban-card-actions')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    let cardEl = event.target.closest?.('[data-sn-board-card-id]');
    if (!cardEl) return;
    event.preventDefault();
    this.selectCard(cardEl.dataset.snBoardCardId);
  }

  #onDragStart(event) {
    let cardEl = event.target.closest?.('[data-sn-board-card-id]');
    if (!cardEl) return;
    this.#dragCardId = cardEl.dataset.snBoardCardId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', this.#dragCardId);
  }

  #onDragOver(event) {
    if (!this.#dragCardId) return;
    let column = event.target.closest?.('.sn-kanban-column');
    if (!column) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    column.dataset.dropActive = 'true';
  }

  #onDragLeave(event) {
    let column = event.target.closest?.('.sn-kanban-column');
    if (!column || (event.relatedTarget && column.contains(event.relatedTarget))) return;
    delete column.dataset.dropActive;
  }

  #onDrop(event) {
    if (!this.#dragCardId) return;
    let columnEl = event.target.closest?.('.sn-kanban-column');
    let toColumnId = columnEl?.dataset.columnId;
    let card = this.#cardById(this.#dragCardId);
    this.#clearDropState();
    if (!card || !toColumnId || card.columnId === toColumnId) return;
    event.preventDefault();
    this.#dispatch('sn-board-card-drop', {
      card,
      fromColumnId: card.columnId,
      toColumnId,
      column: this.#columnById(toColumnId),
    });
  }

  #clearDropState() {
    this.#dragCardId = '';
    this.ref.columns.querySelectorAll('.sn-kanban-column[data-drop-active]')
      .forEach(column => delete column.dataset.dropActive);
  }

  #onColumnHeaderInteraction(event) {
    let header = event.target.closest?.('.sn-kanban-column-header');
    if (!header || !this.ref.columns.contains(header)) return;
    this.#syncColumnHeaderHeights();
  }

  #syncCardSelection() {
    this.ref.columns.querySelectorAll('[data-sn-board-card-id]').forEach((cardEl) => {
      if (cardEl.classList.contains('sn-kanban-card')) {
        cardEl.setAttribute('aria-selected', String(cardEl.dataset.snBoardCardId === this.#selectedCardId));
      }
    });
  }

  #syncColumnHeaderHeights() {
    let syncId = ++this.#headerSyncId;
    let schedule = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout?.(callback, 0));
    schedule?.(() => {
      if (syncId !== this.#headerSyncId || !this.isConnected) return;
      let headers = [...this.querySelectorAll('.sn-kanban-column-header')];
      for (let header of headers) header.style.height = 'auto';
      let maxHeight = Math.ceil(Math.max(0, ...headers.map((header) => {
        let rectHeight = header.getBoundingClientRect?.().height || 0;
        return rectHeight || header.offsetHeight || 0;
      })));
      if (!maxHeight) return;
      for (let header of headers) header.style.height = `${maxHeight}px`;
    });
  }

  #dispatch(type, detail = {}) {
    let event = new CustomEvent(type, {
      bubbles: true,
      composed: true,
      detail: { board: this.#board, ...detail },
    });
    this.dispatchEvent(event);
    return event;
  }
}

KanbanBoard.template = template;
KanbanBoard.rootStyles = css;
KanbanBoard.reg('sn-kanban-board');

export default KanbanBoard;
