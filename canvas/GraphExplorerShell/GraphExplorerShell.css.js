export default /*css*/ `
graph-explorer-shell {
  display: block;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--sn-bg);
  contain: strict;
}

graph-explorer-shell .graph-explorer-canvas-layer,
graph-explorer-shell node-canvas,
graph-explorer-shell canvas-graph {
  width: 100%;
  height: 100%;
}

graph-explorer-shell > [slot="canvas"],
graph-explorer-shell > .graph-explorer-canvas-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

graph-explorer-shell > [slot="overlay"] {
  position: absolute;
  inset: 0;
  z-index: var(--sn-graph-explorer-overlay-z);
  pointer-events: none;
}

graph-explorer-shell > dialog[slot="overlay"][open],
graph-explorer-shell > [slot="overlay"][data-interactive] {
  pointer-events: auto;
}

graph-explorer-shell node-canvas[hidden],
graph-explorer-shell canvas-graph[hidden] {
  display: none;
}

graph-explorer-shell .graph-explorer-toolbar {
  position: absolute;
  top: var(--sn-graph-explorer-toolbar-top);
  right: var(--sn-graph-explorer-toolbar-right);
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sn-graph-explorer-toolbar-gap);
  z-index: var(--sn-graph-explorer-toolbar-z);
  max-width: calc(100% - 16px);
}

graph-explorer-shell .graph-explorer-btn {
  min-width: 0;
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--sn-node-border);
  border-radius: 3px;
  background: var(--sn-node-bg);
  color: var(--sn-text);
  cursor: pointer;
  font-family: var(--sn-font);
  font-size: 10px;
  white-space: nowrap;
  transition: background 150ms, border-color 150ms;
}

graph-explorer-shell .graph-explorer-btn:focus-visible,
graph-explorer-shell .graph-explorer-icon-btn:focus-visible {
  outline: 2px solid var(--sn-node-selected);
  outline-offset: 2px;
}

graph-explorer-shell .graph-explorer-btn:hover {
  background: var(--sn-node-hover);
}

graph-explorer-shell .graph-explorer-btn[data-active] {
  border-color: var(--sn-node-selected);
  background: var(--sn-accent-bg-subtle);
}

graph-explorer-shell .graph-explorer-btn .material-symbols-outlined {
  font-size: 14px;
}

graph-explorer-shell .graph-explorer-toolbar-sep {
  width: 1px;
  align-self: stretch;
  margin: 0 4px;
  background: var(--sn-node-border);
}

graph-explorer-shell .graph-explorer-layer-btn {
  padding: 3px 6px;
  font-size: 9px;
  opacity: 0.7;
}

graph-explorer-shell .graph-explorer-layer-btn[data-active] {
  opacity: 1;
}

graph-explorer-shell .graph-explorer-layer-btn[data-hidden] {
  opacity: 0.3;
  text-decoration: line-through;
}

graph-explorer-shell .graph-explorer-stats {
  position: absolute;
  bottom: var(--sn-graph-explorer-stats-bottom);
  left: var(--sn-graph-explorer-stats-left);
  display: flex;
  gap: 12px;
  z-index: var(--sn-graph-explorer-stats-z);
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 10px;
  border: 1px solid var(--sn-node-border);
  border-radius: 3px;
  background: var(--sn-bg-overlay);
  color: var(--sn-text-dim);
  font-family: var(--sn-font);
  font-size: 10px;
}

graph-explorer-shell .graph-explorer-stat-val {
  color: var(--sn-text);
  font-weight: 600;
}
`;
