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
  padding: var(--sn-tabs-bar-padding, 0 12px);
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
  gap: var(--sn-tabs-item-gap, 6px);
  padding: var(--sn-tabs-item-padding, 0 10px 0 12px);
  height: var(--sn-tabs-item-height);
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  color: var(--sn-text-dim);
  cursor: pointer;
  font-size: var(--sn-tabs-item-font-size, 12px);
  font-family: inherit;
  white-space: nowrap;
  transition: background var(--sn-transition-fast) var(--sn-transition-easing), color var(--sn-transition-fast) var(--sn-transition-easing);
  position: relative;
  border-radius: var(--sn-tabs-radius);
  margin: 0 var(--sn-tabs-item-margin-inline, 2px);
}

.tab .material-symbols-outlined,
project-tab-item .material-symbols-outlined {
  font-size: var(--sn-tabs-icon-size, 15px);
  color: var(--tab-accent, var(--sn-tabs-accent));
}

.tab:hover,
project-tab-item:hover {
  background: var(--sn-tabs-hover-bg);
  color: var(--sn-text);
}

project-tab-item[disabled] {
  cursor: not-allowed;
  opacity: 0.46;
}

project-tab-item[disabled]:hover {
  background: transparent;
  color: var(--sn-text-dim);
}

.tab[active],
project-tab-item[active] {
  background: var(--sn-tabs-active-bg);
  border-color: color-mix(in oklab, var(--tab-accent, var(--sn-tabs-accent)) 44%, transparent);
  border-bottom: none;
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
  right: var(--sn-step-0, -2px);
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

.tab-lead {
  display: grid;
  place-items: center;
  width: var(--sn-tabs-close-size, 16px);
  height: var(--sn-tabs-close-size, 16px);
}

.tab-lead > * {
  grid-area: 1 / 1;
}

.tab-lead .material-symbols-outlined {
  opacity: 1;
  pointer-events: none;
  transition: opacity var(--sn-transition-fast) var(--sn-transition-easing);
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--sn-text-dim);
  cursor: pointer;
  font-size: var(--sn-tabs-close-font-size, 14px);
  padding: 0;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--sn-transition-fast) var(--sn-transition-easing), background var(--sn-transition-fast) var(--sn-transition-easing), color var(--sn-transition-fast) var(--sn-transition-easing);
}

.tab-close[hidden] {
  display: none;
}

project-tab-item:hover .tab-lead:has(.tab-close:not([hidden])) .material-symbols-outlined {
  opacity: 0;
}

project-tab-item:hover .tab-close:not([hidden]) {
  opacity: 1;
  pointer-events: auto;
}

.tab-close:hover {
  background: color-mix(in oklab, var(--sn-text) 20%, transparent);
  color: var(--sn-text);
}

.tab-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--sn-tabs-add-size, 28px);
  height: var(--sn-tabs-add-size, 28px);
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--sn-text-dim);
  cursor: pointer;
  font-size: var(--sn-tabs-add-font-size, 18px);
  transition: background var(--sn-transition-fast) var(--sn-transition-easing), color var(--sn-transition-fast) var(--sn-transition-easing);
  margin-left: var(--sn-tabs-add-margin-left, 4px);
  margin-bottom: var(--sn-tabs-add-margin-bottom, 2px);
}

.tab-add:hover {
  background: color-mix(in oklab, var(--sn-text) 10%, transparent);
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
