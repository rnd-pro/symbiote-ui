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
  font-size: var(--sn-breadcrumb-separator-size, 1.1em);
  user-select: none;
}

.bc-label {
  display: inline-flex;
  align-items: center;
  gap: var(--sn-step-2);
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: color var(--sn-transition-fast, 120ms);
}

button.bc-label:hover {
  color: var(--sn-breadcrumb-hover-color, var(--sn-text, #ffffff));
}

button.bc-label:focus-visible {
  outline: 2px solid var(--sn-focus-ring-color, currentColor);
  outline-offset: var(--sn-focus-outline-offset, 2px);
  border-radius: var(--sn-radius-xs, 3px);
}

sn-breadcrumb-item[data-active] .bc-label {
  font-weight: 500;
  color: var(--sn-breadcrumb-active-color, var(--sn-text, #ffffff));
  cursor: default;
  pointer-events: none;
}

.bc-label .material-symbols-outlined {
  font-size: var(--sn-text-xl);
}
`;
