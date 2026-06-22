export default /*css*/ `
sn-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  box-sizing: border-box;
  gap: var(--sn-breadcrumb-gap, 6px);
  padding: var(--sn-breadcrumb-padding, 4px 8px);
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-breadcrumb-font-size, 12px);
  color: var(--sn-breadcrumb-color, var(--sn-text-dim, rgba(255, 255, 255, 0.7)));
}

sn-breadcrumb[hidden] {
  display: none !important;
}

sn-breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: var(--sn-breadcrumb-item-gap, 6px);
}

.bc-sep {
  color: var(--sn-breadcrumb-separator-color, var(--sn-text-dim-extra, rgba(255, 255, 255, 0.4)));
  font-size: 1.1em;
  user-select: none;
}

.bc-label {
  display: inline-flex;
  align-items: center;
  gap: var(--sn-space-xs);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: color var(--sn-transition-fast, 120ms);
}

.bc-label:hover {
  color: var(--sn-breadcrumb-hover-color, var(--sn-text, #ffffff));
}

sn-breadcrumb-item[data-active] .bc-label {
  font-weight: 500;
  color: var(--sn-breadcrumb-active-color, var(--sn-text, #ffffff));
  cursor: default;
  pointer-events: none;
}

.bc-label .material-symbols-outlined {
  font-size: 16px;
}
`;
