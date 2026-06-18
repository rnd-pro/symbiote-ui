export default /*css*/ `
sn-badge {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  gap: var(--sn-badge-gap);
  min-width: 0;
  padding: var(--sn-badge-padding);
  border: 1px solid var(--sn-badge-border);
  border-radius: var(--sn-badge-radius);
  background: var(--sn-badge-bg);
  color: var(--sn-badge-color);
  font-family: var(--sn-font);
  font-size: var(--sn-badge-font-size);
  font-weight: var(--sn-badge-font-weight);
  line-height: var(--sn-badge-line-height);
  white-space: nowrap;
}

sn-badge[hidden] {
  display: none !important;
}

sn-badge[variant="success"] {
  border-color: var(--sn-badge-success-border);
  color: var(--sn-badge-success-color);
}

sn-badge[variant="info"] {
  border-color: var(--sn-badge-info-border);
  color: var(--sn-badge-info-color);
}

sn-badge[variant="warning"] {
  border-color: var(--sn-badge-warning-border);
  color: var(--sn-badge-warning-color);
}

sn-badge[variant="error"] {
  border-color: var(--sn-badge-error-border);
  color: var(--sn-badge-error-color);
}
`;
