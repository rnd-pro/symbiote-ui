export default `
:host,
chat-sidebar-item,
chat-sidebar-sub-item {
  display: block;
  --sn-chat-compact-label-width: clamp(72px, calc(var(--sn-chat-compact-label-ch, 18) * 5px + 20px), 320px);
  --sn-chat-compact-delete-width: 44px;
  --sn-chat-compact-flyout-width: calc(var(--sn-chat-compact-label-width) + var(--sn-chat-compact-delete-width));
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  min-height: 28px;
  cursor: pointer;
  color: var(--sn-text-dim);
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
  overflow: hidden;
}

.chat-item:hover {
  background: var(--sn-node-hover);
  color: var(--sn-text);
}

:host([data-active]) > .chat-item,
:host([data-active]) > .chat-item-child,
chat-sidebar-item[data-active] > .chat-item,
chat-sidebar-sub-item[data-active] > .chat-item-child {
  color: var(--sn-text);
  background: color-mix(in srgb, var(--sn-chat-item-icon-color, var(--sn-cat-server)) 14%, var(--sn-node-hover));
  border-left: 2px solid var(--sn-chat-item-icon-color, var(--sn-cat-server));
  padding-left: 12px;
}

:host([data-group]) > .chat-item,
chat-sidebar-item[data-group] > .chat-item {
  color: var(--sn-text);
  font-weight: 600;
}

.chat-nav[data-group-dividers] chat-sidebar-item[data-group] + chat-sidebar-item[data-group] {
  position: relative;
  margin-block-start: 4px;
  padding-block-start: 4px;
}

.chat-nav[data-group-dividers] chat-sidebar-item[data-group] + chat-sidebar-item[data-group]::before {
  content: '';
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 16px;
  inline-size: 16px;
  block-size: 1px;
  background: var(--sn-tabs-divider);
}

:host([data-group]) > .chat-item .chat-item-label,
chat-sidebar-item[data-group] > .chat-item .chat-item-label {
  color: var(--sn-text);
}

:host([data-group]) > .chat-item .chat-item-delete,
chat-sidebar-item[data-group] > .chat-item .chat-item-delete {
  display: none;
}

.chat-item .material-symbols-outlined,
.chat-item-child .material-symbols-outlined {
  font-size: 16px;
  flex-shrink: 0;
}

.chat-item-icon-slot {
  position: relative;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chat-item-icon {
  color: var(--sn-chat-item-icon-color);
  transition: opacity 0.12s;
}

.chat-item-label {
  font-size: 11px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sn-text);
}

.chat-status-icon {
  margin-left: 4px;
  font-size: var(--sn-chat-status-icon-size);
}

.chat-status-icon[hidden] {
  display: none;
}

.chat-status-icon[data-status="running"] {
  color: var(--sn-node-selected);
}

.chat-status-icon[data-status="running"] {
  animation: spin 1s linear infinite;
}

.chat-status-icon[data-status="done"] {
  color: var(--sn-success-color);
}

.chat-status-icon[data-status="error"] {
  color: var(--sn-danger-color);
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.chat-item-adapter {
  font-size: 9px;
  color: var(--sn-text-dim);
  font-family: var(--sn-font-mono, monospace);
  margin-left: 6px;
}

.chat-item-adapter:empty,
.chat-item-type:empty {
  display: none;
}

.chat-item-type {
  font-size: 9px;
  color: var(--sn-cat-server);
  background: color-mix(in srgb, var(--sn-cat-server) 10%, transparent);
  font-family: var(--sn-font-mono, monospace);
  margin-left: auto;
  padding: 2px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chat-item-delete {
  position: absolute;
  inset: 0;
  display: flex;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: var(--sn-text-dim);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
  transition: color 0.12s, opacity 0.12s;
}

.chat-item-delete .material-symbols-outlined {
  font-size: 15px;
}

.chat-item:hover .chat-item-icon,
.chat-item-child:hover .chat-item-icon {
  opacity: 0;
}

.chat-item:hover .chat-item-delete,
.chat-item:has(.chat-item-delete:hover) .chat-item-delete,
.chat-item:has(.chat-item-delete:focus-visible) .chat-item-delete,
.chat-item-child:hover .chat-item-delete,
.chat-item-child:has(.chat-item-delete:hover) .chat-item-delete,
.chat-item-child:has(.chat-item-delete:focus-visible) .chat-item-delete {
  opacity: 1;
  pointer-events: auto;
}

.chat-item-delete:hover {
  opacity: 1;
  pointer-events: auto;
  color: var(--sn-danger-color);
}

.chat-expand-icon {
  margin-left: auto;
  font-size: 14px !important;
  transition: transform 0.15s ease, opacity 0.15s ease;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.2;
}

:host([data-has-sub]) .chat-expand-icon,
chat-sidebar-item[data-has-sub] > .chat-item .chat-expand-icon,
chat-sidebar-sub-item[data-has-sub] > .chat-item-child .chat-expand-icon {
  opacity: 0.5;
}

:host([data-has-sub]) .chat-expand-icon:hover,
chat-sidebar-item[data-has-sub] > .chat-item .chat-expand-icon:hover,
chat-sidebar-sub-item[data-has-sub] > .chat-item-child .chat-expand-icon:hover {
  opacity: 1;
}

:host([data-expanded]) .chat-expand-icon,
chat-sidebar-item[data-expanded] > .chat-item .chat-expand-icon,
chat-sidebar-sub-item[data-expanded] > .chat-item-child .chat-expand-icon {
  transform: rotate(90deg);
}

.chat-sub-items {
  width: 100%;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.2s ease;
}

:host([data-expanded]) .chat-sub-items,
chat-sidebar-item[data-expanded] > .chat-sub-items,
chat-sidebar-sub-item[data-expanded] > .chat-sub-items {
  max-height: 500px;
}

.chat-item-child {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 14px 4px 38px;
  font-size: 12px;
  min-height: 24px;
  position: relative;
  color: var(--sn-text-dim);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.chat-item-child:hover {
  background: var(--sn-node-hover);
  color: var(--sn-text);
}

.chat-item-child::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--sn-node-hover);
}

chat-sidebar-sub-item .chat-sub-items chat-sidebar-sub-item .chat-item-child {
  padding-left: 58px;
}

:host([data-active]) > .chat-item-child,
chat-sidebar-sub-item[data-active] > .chat-item-child {
  padding-left: 36px;
}

chat-sidebar-sub-item .chat-sub-items chat-sidebar-sub-item[data-active] > .chat-item-child {
  padding-left: 56px;
}

chat-sidebar-sub-item .chat-sub-items chat-sidebar-sub-item .chat-item-child::before {
  left: 40px;
}

:host-context(.chat-nav[collapsed]) .chat-item-child::before,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child::before {
  content: none;
}

:host-context(.chat-nav[collapsed]) .chat-sub-items,
.chat-nav[collapsed] chat-sidebar-item .chat-sub-items,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-sub-items {
  display: none;
  max-height: 0;
}

.chat-nav[collapsed] chat-sidebar-item[data-expanded] > .chat-sub-items,
.chat-nav[collapsed] chat-sidebar-sub-item[data-expanded] > .chat-sub-items {
  display: block;
  max-height: 500px;
  overflow: visible;
}

:host-context(.chat-nav[collapsed]) .chat-item-adapter,
:host-context(.chat-nav[collapsed]) .chat-expand-icon,
:host-context(.chat-nav[collapsed]) .chat-status-icon,
:host-context(.chat-nav[collapsed]) .chat-item-type,
.chat-nav[collapsed] chat-sidebar-item .chat-item-adapter,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-adapter,
.chat-nav[collapsed] chat-sidebar-item .chat-expand-icon,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-expand-icon,
.chat-nav[collapsed] chat-sidebar-item .chat-status-icon,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-status-icon,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-type {
  display: none;
}

:host-context(.chat-nav[collapsed]) .chat-item,
:host-context(.chat-nav[collapsed]) .chat-item-child,
.chat-nav[collapsed] chat-sidebar-item .chat-item,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child {
  position: relative;
  justify-content: center;
  padding: 0;
  overflow: visible;
}

:host-context(.chat-nav[collapsed]) .chat-item:hover,
:host-context(.chat-nav[collapsed]) .chat-item:focus-within,
:host-context(.chat-nav[collapsed]) .chat-item:has(.chat-item-delete:hover),
:host-context(.chat-nav[collapsed]) .chat-item:has(.chat-item-delete:focus-visible),
:host-context(.chat-nav[collapsed]) .chat-item-child:hover,
:host-context(.chat-nav[collapsed]) .chat-item-child:focus-within,
:host-context(.chat-nav[collapsed]) .chat-item-child:has(.chat-item-delete:hover),
:host-context(.chat-nav[collapsed]) .chat-item-child:has(.chat-item-delete:focus-visible),
.chat-nav[collapsed] chat-sidebar-item .chat-item:hover,
.chat-nav[collapsed] chat-sidebar-item .chat-item:focus-within,
.chat-nav[collapsed] chat-sidebar-item .chat-item:has(.chat-item-delete:hover),
.chat-nav[collapsed] chat-sidebar-item .chat-item:has(.chat-item-delete:focus-visible),
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:hover,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:focus-within,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:has(.chat-item-delete:hover),
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:has(.chat-item-delete:focus-visible),
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:hover,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:focus-within,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:has(.chat-item-delete:hover),
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:has(.chat-item-delete:focus-visible) {
  z-index: 30;
}

:host-context(.chat-nav[collapsed]) .chat-item-label,
.chat-nav[collapsed] chat-sidebar-item .chat-item-label,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-label {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 46px;
  inline-size: var(--sn-chat-compact-label-width);
  display: flex;
  align-items: center;
  padding-inline: 10px 0;
  background: var(--sn-node-bg);
  color: var(--sn-text);
  box-shadow: var(--sn-chat-item-child-shadow);
  z-index: 29;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-4px);
  transition: opacity 0.12s, transform 0.12s;
}

:host-context(.chat-nav[collapsed]) .chat-item:hover .chat-item-label,
:host-context(.chat-nav[collapsed]) .chat-item:focus-within .chat-item-label,
:host-context(.chat-nav[collapsed]) .chat-item:has(.chat-item-delete:hover) .chat-item-label,
:host-context(.chat-nav[collapsed]) .chat-item:has(.chat-item-delete:focus-visible) .chat-item-label,
:host-context(.chat-nav[collapsed]) .chat-item-child:hover .chat-item-label,
:host-context(.chat-nav[collapsed]) .chat-item-child:focus-within .chat-item-label,
:host-context(.chat-nav[collapsed]) .chat-item-child:has(.chat-item-delete:hover) .chat-item-label,
:host-context(.chat-nav[collapsed]) .chat-item-child:has(.chat-item-delete:focus-visible) .chat-item-label,
.chat-nav[collapsed] chat-sidebar-item .chat-item:hover .chat-item-label,
.chat-nav[collapsed] chat-sidebar-item .chat-item:focus-within .chat-item-label,
.chat-nav[collapsed] chat-sidebar-item .chat-item:has(.chat-item-delete:hover) .chat-item-label,
.chat-nav[collapsed] chat-sidebar-item .chat-item:has(.chat-item-delete:focus-visible) .chat-item-label,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:hover .chat-item-label,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:focus-within .chat-item-label,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:has(.chat-item-delete:hover) .chat-item-label,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:has(.chat-item-delete:focus-visible) .chat-item-label,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:hover .chat-item-label,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:focus-within .chat-item-label,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:has(.chat-item-delete:hover) .chat-item-label,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:has(.chat-item-delete:focus-visible) .chat-item-label {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

:host-context(.chat-nav[collapsed]) .chat-item-icon-slot,
.chat-nav[collapsed] chat-sidebar-item .chat-item-icon-slot,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-icon-slot {
  position: static;
}

:host-context(.chat-nav[collapsed]) .chat-item:hover .chat-item-icon,
:host-context(.chat-nav[collapsed]) .chat-item-child:hover .chat-item-icon,
.chat-nav[collapsed] chat-sidebar-item .chat-item:hover .chat-item-icon,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:hover .chat-item-icon,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:hover .chat-item-icon {
  opacity: 1;
}

:host-context(.chat-nav[collapsed]) .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-item .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-delete {
  inset: 0 auto 0 calc(46px + var(--sn-chat-compact-label-width));
  width: var(--sn-chat-compact-delete-width);
  height: 100%;
  background: var(--sn-node-bg);
  border-radius: 0 4px 4px 0;
  z-index: 31;
  transition: color 0.12s, opacity 0.12s;
}

:host-context(.chat-nav[collapsed]) .chat-item:hover .chat-item-delete,
:host-context(.chat-nav[collapsed]) .chat-item:focus-within .chat-item-delete,
:host-context(.chat-nav[collapsed]) .chat-item:has(.chat-item-delete:hover) .chat-item-delete,
:host-context(.chat-nav[collapsed]) .chat-item:has(.chat-item-delete:focus-visible) .chat-item-delete,
:host-context(.chat-nav[collapsed]) .chat-item-child:hover .chat-item-delete,
:host-context(.chat-nav[collapsed]) .chat-item-child:focus-within .chat-item-delete,
:host-context(.chat-nav[collapsed]) .chat-item-child:has(.chat-item-delete:hover) .chat-item-delete,
:host-context(.chat-nav[collapsed]) .chat-item-child:has(.chat-item-delete:focus-visible) .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-item .chat-item:hover .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-item .chat-item:focus-within .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-item .chat-item:has(.chat-item-delete:hover) .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-item .chat-item:has(.chat-item-delete:focus-visible) .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:hover .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:focus-within .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:has(.chat-item-delete:hover) .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-item .chat-item-child:has(.chat-item-delete:focus-visible) .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:hover .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:focus-within .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:has(.chat-item-delete:hover) .chat-item-delete,
.chat-nav[collapsed] chat-sidebar-sub-item .chat-item-child:has(.chat-item-delete:focus-visible) .chat-item-delete {
  opacity: 1;
  pointer-events: auto;
}
`;
