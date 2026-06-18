export default /*css*/ `
sn-tag {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  padding: var(--sn-tag-padding, 2px 8px);
  gap: var(--sn-tag-gap, 6px);
  border-radius: var(--sn-tag-radius, 12px);
  background: var(--sn-tag-bg, var(--sn-outline-color-soft, rgba(255, 255, 255, 0.08)));
  border: 1px solid var(--sn-tag-border, var(--sn-outline-color, rgba(255, 255, 255, 0.12)));
  color: var(--sn-tag-color, var(--sn-text-dim, rgba(255, 255, 255, 0.7)));
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-tag-font-size, 11px);
  font-weight: 500;
  line-height: 1.2;
}

sn-tag[hidden] {
  display: none !important;
}

sn-tag[variant="success"] {
  background: var(--sn-tag-success-bg, color-mix(in oklab, var(--sn-success-color, #4caf50) 15%, transparent));
  border-color: var(--sn-tag-success-border, color-mix(in oklab, var(--sn-success-color, #4caf50) 30%, transparent));
  color: var(--sn-tag-success-color, var(--sn-success-color, #4caf50));
}

sn-tag[variant="warning"] {
  background: var(--sn-tag-warning-bg, color-mix(in oklab, var(--sn-warning-color, #ff9800) 15%, transparent));
  border-color: var(--sn-tag-warning-border, color-mix(in oklab, var(--sn-warning-color, #ff9800) 30%, transparent));
  color: var(--sn-tag-warning-color, var(--sn-warning-color, #ff9800));
}

sn-tag[variant="error"] {
  background: var(--sn-tag-error-bg, color-mix(in oklab, var(--sn-danger-color, #f44336) 15%, transparent));
  border-color: var(--sn-tag-error-border, color-mix(in oklab, var(--sn-danger-color, #f44336) 30%, transparent));
  color: var(--sn-tag-error-color, var(--sn-danger-color, #f44336));
}

sn-tag[variant="info"] {
  background: var(--sn-tag-info-bg, color-mix(in oklab, var(--sn-node-selected, #2196f3) 15%, transparent));
  border-color: var(--sn-tag-info-border, color-mix(in oklab, var(--sn-node-selected, #2196f3) 30%, transparent));
  color: var(--sn-tag-info-color, var(--sn-node-selected, #2196f3));
}

.sn-tag-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0 -4px 0 0;
  cursor: pointer;
  color: inherit;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  opacity: 0.6;
  transition: opacity var(--sn-transition-fast, 120ms), background-color var(--sn-transition-fast, 120ms);
}

.sn-tag-close-btn:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.sn-tag-close-btn .material-symbols-outlined {
  font-size: 12px;
}
`;
