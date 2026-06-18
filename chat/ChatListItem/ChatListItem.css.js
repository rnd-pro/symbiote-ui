export default /*css*/ `
:host,
chat-list-item {
  display: block;
}

.chat-list-item {
  padding: var(--sn-chat-list-item-padding, 10px 14px);
  background: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--sn-chat-list-item-gap, 4px);
  border-bottom: 1px solid var(--sn-node-hover);
  transition: background var(--sn-transition-fast) var(--sn-transition-easing);
}

.chat-list-item:hover {
  background: var(--sn-node-hover);
}

:host([active]) .chat-list-item,
chat-list-item[active] .chat-list-item {
  background: var(--sn-node-bg);
  border-left: var(--sn-chat-list-item-active-border-width, 3px) solid var(--sn-node-selected);
  padding-left: var(--sn-chat-list-item-active-padding-left, 11px);
}

.chat-item-top {
  display: flex;
  align-items: center;
  gap: var(--sn-chat-list-item-top-gap, 6px);
}

:host([nested]) .chat-list-item,
chat-list-item[nested] .chat-list-item {
  margin-left: var(--sn-chat-list-item-nested-margin, 16px);
  border-left: var(--sn-chat-list-item-nested-border-width, 2px) solid var(--sn-node-border);
  position: relative;
}

:host([nested]) .chat-list-item::before,
chat-list-item[nested] .chat-list-item::before {
  content: '';
  position: absolute;
  top: var(--sn-chat-list-item-branch-top, 14px);
  left: calc(-1 * var(--sn-chat-list-item-nested-border-width, 2px));
  width: var(--sn-chat-list-item-branch-width, 10px);
  height: var(--sn-chat-list-item-nested-border-width, 2px);
  background: var(--sn-node-border);
}

.chat-project-badge {
  font-size: var(--sn-chat-list-badge-size, 9px);
  font-weight: 600;
  padding: var(--sn-chat-list-badge-padding, 1px 5px);
  border-radius: var(--sn-chat-list-badge-radius, 3px);
  background: color-mix(in oklab, var(--sn-node-selected) 18%, transparent);
  color: var(--sn-node-selected);
  text-transform: uppercase;
  letter-spacing: 0;
  white-space: nowrap;
}

.chat-name {
  font-size: var(--sn-chat-list-name-size, 12px);
  font-weight: 500;
  color: var(--sn-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-adapter {
  font-size: var(--sn-chat-list-adapter-size, 10px);
  color: var(--sn-text-dim);
  font-family: var(--sn-font-mono, monospace);
}

.chat-preview {
  font-size: var(--sn-chat-list-preview-size, 11px);
  color: var(--sn-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.chat-meta {
  display: flex;
  align-items: center;
  gap: var(--sn-chat-list-meta-gap, 6px);
  font-size: var(--sn-chat-list-meta-size, 10px);
  color: var(--sn-text-dim);
}

.chat-delete {
  display: none;
  background: none;
  border: none;
  color: var(--sn-text-dim);
  cursor: pointer;
  font-size: var(--sn-chat-list-delete-size, 14px);
  padding: var(--sn-chat-list-delete-padding, 0 2px);
  margin-left: auto;
  transition: color var(--sn-transition-fast) var(--sn-transition-easing);
}

.chat-list-item:hover .chat-delete {
  display: inline;
}

.chat-delete:hover {
  color: var(--sn-danger-color);
}
`;
