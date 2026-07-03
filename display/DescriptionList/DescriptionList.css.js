export default /*css*/ `
sn-description-list {
  display: grid;
  grid-template-columns: var(--sn-description-list-columns, minmax(120px, auto) 1fr);
  gap: var(--sn-description-list-gap-y, 8px) var(--sn-description-list-gap-x, 16px);
  box-sizing: border-box;
  width: 100%;
}

sn-description-list[hidden] {
  display: none !important;
}

sn-description-item {
  display: contents;
}

.sn-description-label {
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-description-label-size, 12px);
  font-weight: 500;
  color: var(--sn-description-label-color, var(--sn-sys-on-surface-dim));
  align-self: start;
}

.sn-description-value {
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-description-value-size, 12px);
  color: var(--sn-description-value-color, var(--sn-sys-on-surface));
  margin: 0;
  align-self: start;
  min-width: 0;
  overflow-wrap: anywhere;
}
`;
