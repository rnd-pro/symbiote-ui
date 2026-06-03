export default /*css*/ `
sn-banner {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  gap: var(--sn-banner-gap);
  width: 100%;
  min-width: 0;
  margin-block-end: var(--sn-banner-margin-block-end);
  padding: var(--sn-banner-padding);
  border: 1px solid var(--sn-banner-border);
  border-radius: var(--sn-banner-radius);
  background: var(--sn-banner-bg);
  color: var(--sn-banner-color);
  font-family: var(--sn-font);
  font-size: var(--sn-banner-font-size);
  font-weight: var(--sn-banner-font-weight);
  line-height: var(--sn-banner-line-height);
}

sn-banner[hidden] {
  display: none !important;
}

sn-banner[variant="running"],
sn-banner[variant="info"] {
  border-color: var(--sn-banner-info-border);
  color: var(--sn-banner-info-color);
}

sn-banner[variant="success"] {
  border-color: var(--sn-banner-success-border);
  color: var(--sn-banner-success-color);
}

sn-banner[variant="warning"] {
  border-color: var(--sn-banner-warning-border);
  color: var(--sn-banner-warning-color);
}

sn-banner[variant="error"] {
  border-color: var(--sn-banner-error-border);
  color: var(--sn-banner-error-color);
}

sn-banner .material-symbols-outlined {
  flex: 0 0 auto;
  font-size: var(--sn-banner-icon-size);
  line-height: 1;
}

sn-banner[variant="running"] .material-symbols-outlined {
  animation: sn-banner-spin var(--sn-banner-running-spin-duration) linear infinite;
}

@keyframes sn-banner-spin {
  to {
    transform: rotate(360deg);
  }
}
`;
