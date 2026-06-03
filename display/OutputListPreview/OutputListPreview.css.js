export default /*css*/ `
:host,
output-list-preview {
  display: block;
  color: var(--sn-text);
  font-family: var(--sn-font-ui, inherit);
}

:host([hidden]),
output-list-preview[hidden] {
  display: none !important;
}

.output-list-preview {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--sn-output-preview-gap);
  min-width: 0;
  padding: var(--sn-output-preview-padding);
  border: 1px solid var(--sn-output-preview-border);
  border-radius: var(--sn-output-preview-radius);
  background: var(--sn-output-preview-bg);
}

.output-list-preview-head,
.output-list-preview-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 18px;
  color: var(--sn-output-preview-muted, var(--sn-text-dim));
  font-size: 11px;
}

.output-list-preview-title {
  overflow: hidden;
  color: var(--sn-output-preview-title, var(--sn-text));
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.output-list-preview-count,
.output-list-preview-foot {
  font-family: var(--sn-font-mono, monospace);
}

.output-list-preview-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.output-list-preview-empty {
  padding: 8px 0;
  color: var(--sn-output-preview-muted, var(--sn-text-dim));
  font-size: 12px;
}

.output-list-preview-item {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 3px 10px;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--sn-output-preview-item-border);
  border-radius: var(--sn-output-preview-item-radius);
  background: var(--sn-output-preview-item-bg);
}

.output-list-preview-label,
.output-list-preview-description,
.output-list-preview-meta,
.output-list-preview-status {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.output-list-preview-label {
  color: var(--sn-output-preview-label, var(--sn-text));
  font-size: 12px;
  font-weight: 500;
}

.output-list-preview-description {
  grid-column: 1 / -1;
  color: var(--sn-output-preview-muted, var(--sn-text-dim));
  font-size: 11px;
  line-height: 1.35;
}

.output-list-preview-meta,
.output-list-preview-status {
  color: var(--sn-output-preview-muted, var(--sn-text-dim));
  font-family: var(--sn-font-mono, monospace);
  font-size: 10px;
}

.output-list-preview-status {
  justify-self: end;
  max-width: 120px;
}
`;
