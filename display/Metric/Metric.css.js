export default /*css*/ `
sn-metric {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: var(--sn-metric-gap);
  min-width: 0;
  padding: var(--sn-metric-padding);
  border-block-end: 1px solid var(--sn-metric-border);
  color: var(--sn-metric-color);
  font-family: var(--sn-font);
  font-size: var(--sn-metric-label-size);
}

sn-metric[hidden] {
  display: none !important;
}

sn-metric:last-child {
  border-block-end: 0;
}

sn-metric[variant="stacked"] {
  align-items: flex-start;
  flex-direction: column;
}

.sn-metric-label {
  min-width: 0;
  color: var(--sn-metric-label-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sn-metric-value {
  min-width: 0;
  color: var(--sn-metric-value-color);
  font-family: var(--sn-metric-value-font);
  font-size: var(--sn-metric-value-size);
  font-weight: var(--sn-metric-value-weight);
  text-align: end;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

sn-metric[status="success"] .sn-metric-value {
  color: var(--sn-metric-success-color);
}

sn-metric[status="warning"] .sn-metric-value {
  color: var(--sn-metric-warning-color);
}

sn-metric[status="error"] .sn-metric-value {
  color: var(--sn-metric-error-color);
}
`;
