export default /*css*/ `
sn-kanban-board {
  display: block;
  min-width: 0;
  min-height: 0;
  height: 100%;
  color: var(--sn-text);
  font-family: var(--sn-font);
}

sn-kanban-board[hidden] {
  display: none !important;
}

sn-kanban-board .sn-kanban-columns {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: var(--sn-kanban-column-width, minmax(232px, 286px));
  align-items: var(--sn-kanban-columns-align, stretch);
  gap: var(--sn-kanban-gap, 10px);
  min-width: 0;
  min-height: var(--sn-kanban-columns-min-height, 0);
  height: var(--sn-kanban-columns-height, 100%);
  overflow: auto;
  padding: var(--sn-kanban-padding, 0 0 4px);
}

sn-kanban-board .sn-kanban-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: var(--sn-kanban-column-min-height, 240px);
  height: var(--sn-kanban-column-height, auto);
  border: 1px solid var(--sn-kanban-border, var(--sn-node-border));
  border-radius: var(--sn-kanban-radius, var(--sn-card-radius));
  background: var(--sn-kanban-column-bg, var(--sn-node-bg));
  overflow: var(--sn-kanban-column-overflow, hidden);
}

sn-kanban-board .sn-kanban-column[data-drop-active="true"] {
  border-color: var(--sn-kanban-drop-border, var(--sn-node-selected));
  background: var(--sn-kanban-drop-bg, color-mix(in srgb, var(--sn-node-selected) 10%, var(--sn-node-bg)));
}

sn-kanban-board .sn-kanban-column-header {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--sn-space-sm);
  min-height: var(--sn-kanban-header-min-height, 54px);
  padding: var(--sn-kanban-header-padding, 9px 10px);
  border-block-end: 1px solid var(--sn-kanban-border, var(--sn-node-border));
  background: var(--sn-kanban-header-bg, var(--sn-node-header-bg));
}

sn-kanban-board .sn-kanban-column-title {
  min-width: 0;
  color: var(--sn-kanban-title-color, var(--sn-text));
  font-size: var(--sn-kanban-title-size, 13px);
  font-weight: var(--sn-kanban-title-weight, 650);
  line-height: 1.25;
}

sn-kanban-board .sn-kanban-column-description {
  margin-block-start: 3px;
  color: var(--sn-kanban-description-color, var(--sn-text-dim));
  font-size: var(--sn-kanban-description-size, 11px);
  line-height: 1.3;
}

sn-kanban-board .sn-kanban-column-count {
  align-self: start;
  min-width: 24px;
  padding: 2px 7px;
  border: 1px solid var(--sn-kanban-border, var(--sn-node-border));
  border-radius: 999px;
  color: var(--sn-kanban-count-color, var(--sn-text-dim));
  font-size: var(--sn-text-xs);
  line-height: 1.4;
  text-align: center;
}

sn-kanban-board .sn-kanban-column-body,
sn-kanban-board .sn-kanban-card-list {
  min-width: 0;
  min-height: 0;
}

sn-kanban-board .sn-kanban-column-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
}

sn-kanban-board .sn-kanban-card-list {
  display: flex;
  flex-direction: column;
  gap: var(--sn-kanban-card-gap, 8px);
  padding: var(--sn-kanban-card-list-padding, 8px);
  overflow: var(--sn-kanban-card-list-overflow, auto);
}

sn-kanban-board .sn-kanban-card {
  display: grid;
  flex: 0 0 auto;
  grid-template-rows: auto auto 1fr auto;
  gap: 7px;
  position: relative;
  width: 100%;
  min-height: var(--sn-kanban-card-min-height, 118px);
  padding: var(--sn-kanban-card-padding, 9px);
  border: 1px solid var(--sn-kanban-card-border, var(--sn-node-border));
  border-radius: var(--sn-kanban-card-radius, 7px);
  background: var(--sn-kanban-card-bg, var(--sn-panel-bg));
  color: var(--sn-text);
  font: inherit;
  text-align: start;
  cursor: pointer;
}

sn-kanban-board .sn-kanban-card:hover,
sn-kanban-board .sn-kanban-card:focus-visible {
  border-color: var(--sn-kanban-card-hover-border, var(--sn-node-selected));
  outline: none;
}

sn-kanban-board .sn-kanban-card[aria-selected="true"] {
  border-color: var(--sn-node-selected);
  box-shadow: inset 0 0 0 1px var(--sn-node-selected);
}

sn-kanban-board .sn-kanban-card-title {
  min-width: 0;
  color: var(--sn-text);
  font-size: var(--sn-kanban-card-title-size, 13px);
  font-weight: 650;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

sn-kanban-board .sn-kanban-card-summary {
  min-width: 0;
  color: var(--sn-text-dim);
  font-size: var(--sn-kanban-card-summary-size, 11px);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

sn-kanban-board .sn-kanban-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--sn-text-dim);
  font-size: var(--sn-text-xs);
  line-height: 1.35;
}

sn-kanban-board .sn-kanban-card-footer {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(24px, max-content));
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--sn-text-dim);
  font-size: var(--sn-text-xs);
  line-height: 1.35;
}

sn-kanban-board .sn-kanban-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 18px;
  padding: 1px 6px;
  border: 1px solid var(--sn-node-border);
  border-radius: 999px;
  color: var(--sn-text-dim);
  font-size: var(--sn-text-2xs);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

sn-kanban-board .sn-kanban-chip[data-kind="status"] {
  color: var(--sn-success-color);
  border-color: color-mix(in srgb, var(--sn-success-color) 40%, var(--sn-node-border));
}

sn-kanban-board .sn-kanban-chip[data-kind="warning"] {
  color: var(--sn-warning-color);
  border-color: color-mix(in srgb, var(--sn-warning-color) 46%, var(--sn-node-border));
}

sn-kanban-board .sn-kanban-chip[data-kind="error"] {
  color: var(--sn-danger-color);
  border-color: color-mix(in srgb, var(--sn-danger-color) 46%, var(--sn-node-border));
}

sn-kanban-board .sn-kanban-card-action {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: var(--sn-space-xs) var(--sn-space-sm);
  border: 1px solid var(--sn-node-border);
  border-radius: 6px;
  background: var(--sn-node-bg);
  color: var(--sn-text);
  font: inherit;
  font-size: var(--sn-text-xs);
  text-align: start;
  cursor: pointer;
}

sn-kanban-board .sn-kanban-card-actions {
  justify-self: end;
  min-width: 0;
}

sn-kanban-board .sn-kanban-card-actions[open] {
  grid-column: 1 / -1;
  display: grid;
  gap: 6px;
  width: 100%;
  margin-block-start: 2px;
  justify-self: stretch;
}

sn-kanban-board .sn-kanban-card-menu {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--sn-node-border);
  border-radius: 999px;
  background: var(--sn-node-bg);
  color: var(--sn-text);
  cursor: pointer;
  list-style: none;
}

sn-kanban-board .sn-kanban-card-menu::-webkit-details-marker {
  display: none;
}

sn-kanban-board .sn-kanban-card-menu-list {
  display: grid;
  gap: var(--sn-space-xs);
  width: 100%;
  padding: 6px;
  border: 1px solid var(--sn-node-border);
  border-radius: 7px;
  background: var(--sn-panel-bg);
}

sn-kanban-board .sn-kanban-card-actions[open] .sn-kanban-card-menu {
  justify-self: end;
}

sn-kanban-board .sn-kanban-card-action[data-kind="danger"] {
  color: var(--sn-danger-color);
  border-color: color-mix(in srgb, var(--sn-danger-color) 45%, var(--sn-node-border));
}

sn-kanban-board .sn-kanban-card-menu .material-symbols-outlined,
sn-kanban-board .sn-kanban-card-action .material-symbols-outlined {
  font-size: var(--sn-text-xl);
}

sn-kanban-board .sn-kanban-column-empty,
sn-kanban-board .sn-kanban-empty {
  display: grid;
  place-items: center;
  min-height: 96px;
  padding: var(--sn-space-md);
  border: 1px dashed var(--sn-node-border);
  border-radius: 7px;
  color: var(--sn-text-dim);
  font-size: var(--sn-text-xs);
  line-height: 1.4;
  text-align: center;
}

sn-kanban-board .sn-kanban-empty[hidden] {
  display: none !important;
}
`;
