export default /*css*/ `
sn-accordion {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  border: 1px solid var(--sn-accordion-border, var(--sn-outline-color-soft, rgba(255, 255, 255, 0.08)));
  border-radius: var(--sn-accordion-radius, 4px);
  overflow: hidden;
  background: var(--sn-accordion-bg, var(--sn-panel-bg, #1e1e24));
}

sn-accordion[hidden] {
  display: none !important;
}

sn-accordion-item {
  display: block;
  box-sizing: border-box;
  border-bottom: 1px solid var(--sn-accordion-border, var(--sn-outline-color-soft, rgba(255, 255, 255, 0.08)));
}

sn-accordion-item:last-child {
  border-bottom: none;
}

.sn-accordion-details {
  display: block;
  width: 100%;
}

.sn-accordion-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sn-accordion-header-padding, 10px 14px);
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-accordion-header-size, 12px);
  font-weight: 500;
  color: var(--sn-accordion-header-color, var(--sn-text, #ffffff));
  cursor: pointer;
  user-select: none;
  list-style: none;
  outline: none;
  background: var(--sn-accordion-header-bg, transparent);
  transition: background var(--sn-transition-fast, 120ms);
}

.sn-accordion-summary::-webkit-details-marker {
  display: none;
}

.sn-accordion-summary:hover,
.sn-accordion-summary:focus-visible {
  background: var(--sn-accordion-header-hover-bg, var(--sn-node-hover, rgba(255, 255, 255, 0.05)));
}

.sn-accordion-summary:focus-visible {
  outline: 2px solid var(--sn-focus-ring-color, currentColor);
  outline-offset: -2px;
}

.sn-accordion-header-text {
  flex: 1;
}

.sn-accordion-icon {
  font-size: var(--sn-text-xl);
  color: var(--sn-text-dim, rgba(255, 255, 255, 0.6));
  transition: transform var(--sn-transition-normal, 240ms);
  user-select: none;
}

.sn-accordion-details[open] .sn-accordion-icon {
  transform: rotate(90deg);
}

.sn-accordion-content {
  padding: var(--sn-accordion-content-padding, 12px 14px);
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-accordion-content-size, 12px);
  color: var(--sn-accordion-content-color, var(--sn-text-dim, rgba(255, 255, 255, 0.7)));
  border-top: 1px solid var(--sn-accordion-border, var(--sn-outline-color-soft, rgba(255, 255, 255, 0.08)));
  background: var(--sn-accordion-content-bg, transparent);
}

sn-accordion-item[disabled] .sn-accordion-summary {
  cursor: not-allowed;
  opacity: var(--sn-accordion-disabled-opacity, 0.5);
  pointer-events: none;
}
`;
