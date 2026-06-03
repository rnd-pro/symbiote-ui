export default /*css*/ `
:host,
sn-tree-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  font-family: var(--sn-font);
  font-size: var(--sn-tree-panel-font-size);
}

:host([hidden]),
sn-tree-panel[hidden] {
  display: none !important;
}

.sn-tree-panel-title {
  display: flex;
  align-items: center;
  gap: var(--sn-tree-panel-title-gap);
  padding: var(--sn-tree-panel-title-padding);
  border-bottom: 1px solid var(--sn-node-border);
  color: var(--sn-text-dim);
  font-size: var(--sn-tree-panel-title-size);
  font-weight: var(--sn-tree-panel-title-weight);
  text-transform: uppercase;
}

.sn-tree-panel-title-icon,
.sn-tree-panel-toolbar-icon {
  font-size: var(--sn-tree-panel-icon-size);
}

.sn-tree-panel-toolbar {
  display: flex;
  gap: var(--sn-tree-panel-toolbar-gap);
  padding: var(--sn-tree-panel-toolbar-padding);
  border-bottom: 1px solid var(--sn-node-border);
}

.sn-tree-panel-filter {
  flex: 1;
  min-width: 0;
  padding: var(--sn-tree-panel-input-padding);
  border: 1px solid var(--sn-node-border);
  border-radius: var(--sn-tree-panel-input-radius);
  outline: none;
  background: var(--sn-bg);
  color: var(--sn-text);
  font-family: inherit;
  font-size: var(--sn-tree-panel-input-size);
}

.sn-tree-panel-filter:focus {
  border-color: var(--sn-node-selected);
}

.sn-tree-panel-collapse {
  --sn-button-icon-size: auto;
  --sn-button-icon-font-size: var(--sn-tree-panel-icon-size);
  --sn-button-padding: var(--sn-tree-panel-collapse-padding);
  --sn-button-border: var(--sn-node-border);
  --sn-button-radius: var(--sn-tree-panel-input-radius);
  --sn-button-bg: var(--sn-bg);
  --sn-button-hover-bg: var(--sn-node-hover);
  --sn-button-hover-border: var(--sn-node-border);
  --sn-button-color: var(--sn-text);
  --sn-button-focus-ring: var(--sn-effect-focus-ring);
  color: var(--sn-text);
  transition: background 100ms ease;
}

.sn-tree-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--sn-tree-panel-content-padding);
}

.sn-tree-panel-placeholder {
  padding: var(--sn-tree-panel-placeholder-padding);
  color: var(--sn-text-dim);
  font-size: var(--sn-tree-panel-placeholder-size);
}

.sn-tree-panel-placeholder[hidden] {
  display: none;
}

sn-tree-view {
  --sn-tree-gap: var(--sn-tree-panel-gap, var(--sn-tree-gap));
  --sn-tree-indent: var(--sn-tree-panel-indent, var(--sn-tree-indent));
  --sn-tree-row-min-height: var(--sn-tree-panel-row-min-height, var(--sn-tree-row-height));
  --sn-tree-row-padding-block: var(--sn-tree-panel-row-padding-block, var(--sn-tree-row-padding-block));
  --sn-tree-row-radius: var(--sn-tree-panel-row-radius, var(--sn-tree-row-radius));
  --sn-tree-row-hover-bg: var(--sn-node-hover);
  --sn-tree-row-selected-bg: var(--sn-node-selected-soft, var(--sn-node-hover));
  --sn-tree-row-selected-border: transparent;
  --sn-tree-label-color: var(--sn-text-dim);
  --sn-tree-label-size: var(--sn-tree-panel-label-size, var(--sn-tree-label-size));
  --sn-tree-label-weight: var(--sn-tree-panel-label-weight, var(--sn-tree-label-weight));
  --sn-tree-muted-color: var(--sn-text-dim);
  --sn-tree-icon-size: var(--sn-tree-panel-icon-size, var(--sn-tree-icon-size));
  --sn-tree-badge-radius: var(--sn-tree-panel-badge-radius, var(--sn-tree-badge-radius));
  --sn-tree-badge-bg: var(--sn-node-hover);
  --sn-tree-badge-color: var(--sn-text-dim);
  --sn-tree-badge-size: var(--sn-tree-panel-badge-size, var(--sn-tree-badge-size));
}

sn-tree-view[hidden] {
  display: none;
}
`;
