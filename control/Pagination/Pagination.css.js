export default /*css*/ `
sn-pagination {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  gap: var(--sn-pagination-gap, 4px);
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-pagination-font-size, 12px);
}

sn-pagination[hidden] {
  display: none !important;
}

.sn-pagination-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--sn-pagination-btn-size, 28px);
  height: var(--sn-pagination-btn-size, 28px);
  padding: 0 6px;
  box-sizing: border-box;
  background: var(--sn-pagination-btn-bg, transparent);
  border: 1px solid var(--sn-pagination-btn-border, var(--sn-outline-color-soft, rgba(255, 255, 255, 0.08)));
  border-radius: var(--sn-pagination-btn-radius, 4px);
  color: var(--sn-pagination-btn-color, var(--sn-text-dim, rgba(255, 255, 255, 0.7)));
  cursor: pointer;
  user-select: none;
  font: inherit;
  transition: background var(--sn-transition-fast, 120ms), border-color var(--sn-transition-fast, 120ms), color var(--sn-transition-fast, 120ms);
}

.sn-pagination-btn:hover:not([disabled]) {
  background: var(--sn-pagination-btn-hover-bg, var(--sn-node-hover, rgba(255, 255, 255, 0.05)));
  color: var(--sn-pagination-btn-hover-color, var(--sn-text, #ffffff));
}

.sn-pagination-btn[active] {
  background: var(--sn-pagination-btn-active-bg, var(--sn-node-selected, rgba(255, 255, 255, 0.15)));
  border-color: var(--sn-pagination-btn-active-border, var(--sn-node-selected, rgba(255, 255, 255, 0.3)));
  color: var(--sn-pagination-btn-active-color, var(--sn-text, #ffffff));
  font-weight: 600;
}

.sn-pagination-btn[disabled] {
  cursor: not-allowed;
  opacity: var(--sn-pagination-disabled-opacity, 0.4);
}

.sn-pagination-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--sn-pagination-btn-size, 28px);
  color: var(--sn-text-dim-extra, rgba(255, 255, 255, 0.4));
  user-select: none;
}

.sn-pagination-btn .material-symbols-outlined {
  font-size: var(--sn-text-xl);
}
`;
