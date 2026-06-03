export default /*css*/ `
:host,
project-tabs {
  display: block;
  height: var(--sn-tabs-height);
  background: var(--sn-tabs-bg);
  flex-shrink: 0;
  user-select: none;
  position: relative;
}

:host::after,
project-tabs::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--sn-tabs-border);
  z-index: 1;
}

.tab-bar {
  display: flex;
  align-items: flex-end;
  height: 100%;
  padding: 0 12px;
  overflow-x: auto;
  scrollbar-width: none;
  position: relative;
  z-index: 2;
}

.tab-bar::-webkit-scrollbar {
  display: none;
}

.tab,
project-tab-item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 0 12px;
  height: var(--sn-tabs-item-height);
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  color: var(--sn-text-dim);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
  position: relative;
  border-radius: var(--sn-tabs-radius);
  margin: 0 2px;
}

.tab .material-symbols-outlined,
project-tab-item .material-symbols-outlined {
  font-size: 15px;
  color: var(--tab-accent, var(--sn-tabs-accent));
}

.tab:hover,
project-tab-item:hover {
  background: var(--sn-tabs-hover-bg);
  color: var(--sn-text);
}

.tab[active],
project-tab-item[active] {
  background: var(--sn-tabs-active-bg);
  color: var(--sn-text);
}

.tab[active]::before,
project-tab-item[active]::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: calc(-1 * var(--sn-tabs-corner-size));
  width: var(--sn-tabs-corner-size);
  height: var(--sn-tabs-corner-size);
  pointer-events: none;
  background: radial-gradient(circle at 0 0, transparent var(--sn-tabs-corner-cut), var(--sn-tabs-active-bg) var(--sn-tabs-corner-size));
}

.tab[active]::after,
project-tab-item[active]::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: calc(-1 * var(--sn-tabs-corner-size));
  width: var(--sn-tabs-corner-size);
  height: var(--sn-tabs-corner-size);
  pointer-events: none;
  background: radial-gradient(circle at 100% 0, transparent var(--sn-tabs-corner-cut), var(--sn-tabs-active-bg) var(--sn-tabs-corner-size));
}

.tab:not([active]):not(:hover)::after,
project-tab-item:not([active]):not(:hover)::after {
  content: '';
  position: absolute;
  right: -2px;
  top: 25%;
  height: 50%;
  width: 1px;
  background: var(--sn-tabs-divider);
}

.tab:not([active]):not(:hover):has(+ .tab[active])::after,
.tab:not([active]):not(:hover):has(+ project-tab-item[active])::after,
.tab:not([active]):not(:hover):has(+ .tab:hover)::after,
.tab:not([active]):not(:hover):has(+ project-tab-item:hover)::after,
project-tab-item:not([active]):not(:hover):has(+ project-tab-item[active])::after,
project-tab-item:not([active]):not(:hover):has(+ project-tab-item:hover)::after,
.tab:not([active]):not(:hover):has(+ div > project-tab-item:first-child[active])::after,
.tab:not([active]):not(:hover):has(+ div > project-tab-item:first-child:hover)::after,
.tab:not([active]):not(:hover):last-child::after,
project-tab-item:not([active]):not(:hover):last-child::after,
.tab:not([active]):not(:hover):has(+ div:empty)::after {
  content: none;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--sn-text-dim);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}

.tab:hover .tab-close,
.tab[active] .tab-close,
project-tab-item:hover .tab-close,
project-tab-item[active] .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: color-mix(in srgb, var(--sn-text) 20%, transparent);
  color: var(--sn-text);
}

.tab-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--sn-text-dim);
  cursor: pointer;
  font-size: 18px;
  transition: background 0.15s, color 0.15s;
  margin-left: 4px;
  margin-bottom: 2px;
}

.tab-add:hover {
  background: color-mix(in srgb, var(--sn-text) 10%, transparent);
  color: var(--sn-text);
}

.tab-filler {
  flex: 1;
}

.tab-items {
  display: flex;
  align-items: stretch;
}
`;
