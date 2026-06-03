export default /*css*/ `
:host,
chat-list {
  display: block;
}

.chat-list {
  width: 100%;
  border-right: none;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sn-node-bg);
  color: var(--sn-text);
  overflow: hidden;
}

.chat-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--sn-node-border);
  flex-shrink: 0;
}

.chat-list-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--sn-text);
}

.chat-list-content {
  min-height: 0;
  overflow: auto;
}

.chat-list-icon {
  font-size: 16px;
}

.chat-list-empty-icon {
  display: block;
  margin-block-end: 8px;
  font-size: 32px;
  opacity: 0.3;
}

.chat-list-title {
  flex: none;
}

.chat-list-new-btn {
  margin-left: auto;
}

.chat-list-new-btn-icon {
  font-size: 14px;
}

.chat-list-items {
  padding: 4px 0;
}

.chat-list-filter-bar {
  display: flex;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--sn-node-border);
  flex-shrink: 0;
}

.chat-list-filter-btn {
  --sn-button-bg: transparent;
  --sn-button-border: transparent;
  --sn-button-color: var(--sn-text-dim);
  --sn-button-hover-bg: transparent;
  --sn-button-hover-border: transparent;
  --sn-button-padding: 3px 8px;
  --sn-button-radius: 4px;
  --sn-button-min-height: 24px;
  --sn-button-font-size: 11px;
  --sn-button-font-weight: 500;
  color: var(--sn-text-dim);
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}

.chat-list-filter-btn:hover {
  color: var(--sn-text);
}

.chat-list-filter-btn[active] {
  --sn-button-bg: var(--sn-node-bg);
  --sn-button-border: var(--sn-node-border);
  color: var(--sn-text);
}
`;
