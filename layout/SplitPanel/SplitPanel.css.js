export default /*css*/ `
sn-split-panel {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.sn-split-container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.sn-split-container[data-orientation="horizontal"] {
  flex-direction: row;
}

.sn-split-container[data-orientation="vertical"] {
  flex-direction: column;
}

.sn-split-panel-primary,
.sn-split-panel-secondary {
  overflow: auto;
}

.sn-split-divider {
  background-color: var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  position: relative;
  z-index: 10;
  user-select: none;
  transition: background-color var(--sn-transition-fast, 120ms);
}

.sn-split-divider:hover,
.sn-split-divider[data-active] {
  background-color: var(--sn-node-selected, #2e90fa);
}

.sn-split-container[data-orientation="horizontal"] > .sn-split-divider {
  width: 6px;
  cursor: col-resize;
  height: 100%;
}

.sn-split-container[data-orientation="vertical"] > .sn-split-divider {
  height: 6px;
  cursor: row-resize;
  width: 100%;
}
`;
