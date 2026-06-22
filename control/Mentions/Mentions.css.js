export default /*css*/ `
sn-mentions {
  display: block;
  font-family: var(--sn-font, sans-serif);
  position: relative;
  width: 100%;
}

.sn-mentions-container {
  position: relative;
  width: 100%;
}

.sn-mentions-dropdown {
  display: none;
  position: absolute;
  z-index: 1000;
  margin-top: var(--sn-space-xs);
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 6px);
  box-shadow: var(--sn-panel-shadow, 0 10px 25px rgba(0,0,0,0.35));
  overflow-y: auto;
  max-height: 180px;
  min-width: 150px;
  box-sizing: border-box;
  padding: var(--sn-space-xs);
}

.sn-mentions-dropdown[data-visible] {
  display: block;
}

.sn-mentions-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sn-mentions-option {
  display: flex;
  align-items: center;
  padding: calc(6px * var(--sn-theme-density, 1)) calc(10px * var(--sn-theme-density, 1));
  font-size: calc(12px * var(--sn-theme-type-scale, 1));
  color: var(--sn-text);
  border-radius: var(--sn-radius-sm);
  cursor: pointer;
  user-select: none;
}

.sn-mentions-option:hover,
.sn-mentions-option[data-focused] {
  background-color: var(--sn-node-hover, rgba(255,255,255,0.04));
}
`;
