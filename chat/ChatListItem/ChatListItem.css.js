export default /*css*/ `
:host,
chat-list-item {
  display: block;
}

.chat-list-item {
  padding: 10px 14px;
  background: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-bottom: 1px solid var(--sn-node-hover);
  transition: background 0.15s;
}

.chat-list-item:hover {
  background: var(--sn-node-hover);
}

:host([active]) .chat-list-item,
chat-list-item[active] .chat-list-item {
  background: var(--sn-node-bg);
  border-left: 3px solid var(--sn-node-selected);
  padding-left: 11px;
}

.chat-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

:host([nested]) .chat-list-item,
chat-list-item[nested] .chat-list-item {
  margin-left: 16px;
  border-left: 2px solid var(--sn-node-border);
  position: relative;
}

:host([nested]) .chat-list-item::before,
chat-list-item[nested] .chat-list-item::before {
  content: '';
  position: absolute;
  top: 14px;
  left: -2px;
  width: 10px;
  height: 2px;
  background: var(--sn-node-border);
}

.chat-project-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--sn-node-selected) 18%, transparent);
  color: var(--sn-node-selected);
  text-transform: uppercase;
  letter-spacing: 0;
  white-space: nowrap;
}

.chat-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--sn-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-adapter {
  font-size: 10px;
  color: var(--sn-text-dim);
  font-family: var(--sn-font-mono, monospace);
}

.chat-preview {
  font-size: 11px;
  color: var(--sn-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.chat-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--sn-text-dim);
}

.chat-delete {
  display: none;
  background: none;
  border: none;
  color: var(--sn-text-dim);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  margin-left: auto;
  transition: color 0.15s;
}

.chat-list-item:hover .chat-delete {
  display: inline;
}

.chat-delete:hover {
  color: var(--sn-danger-color);
}
`;
