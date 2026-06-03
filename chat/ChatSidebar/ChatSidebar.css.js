export default `
:host,
chat-sidebar-shell {
  display: flex;
  height: 100%;
  width: var(--chat-nav-width, 200px);
  min-width: var(--chat-nav-width, 200px);
  flex: 0 0 var(--chat-nav-width, 200px);
  position: relative;
  z-index: 10;
  transition: width 0.2s ease, min-width 0.2s ease, flex-basis 0.2s ease;
}

:host([resizing]),
chat-sidebar-shell[resizing]  {
  transition: none;
}

:host([resizing]) .chat-nav,
chat-sidebar-shell[resizing] .chat-nav  {
  transition: none;
}

.chat-nav {
  height: 100%;
  width: var(--chat-nav-width, 200px);
  min-width: var(--chat-nav-width, 200px);
  flex-shrink: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  border-right: none;
  background: var(--sn-node-bg);
  overflow: hidden;
  transition: width 0.2s ease, min-width 0.2s ease;
  user-select: none;
}

.chat-nav[collapsed]  {
  width: var(--chat-nav-width, 48px);
  min-width: var(--chat-nav-width, 48px);
  overflow: visible;
}

.chat-nav[resizing],
.chat-nav[resizing] + *  {
  user-select: none;
}

.chat-nav-resize-handle {
  position: absolute;
  top: 0;
  right: -1px;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  z-index: 20;
  transition: background 0.15s ease;
}

.chat-nav-resize-handle:hover,
.chat-nav-resize-handle.dragging,
.chat-nav[resizing] .chat-nav-resize-handle  {
  background: var(--sn-layout-resizer-hover-bg);
}

.chat-nav-header {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  min-height: 28px;
  background: var(--sn-node-bg);
  border-bottom: none;
  flex-shrink: 0;
}

.chat-nav[collapsed] .chat-nav-header  {
  flex-direction: column-reverse;
  justify-content: flex-start;
  padding: 4px 0;
  gap: 8px;
}

.chat-nav-header .nav-spacer {
  flex: 1;
}

.chat-nav[collapsed] .nav-spacer  {
  display: none;
}

.chat-nav-header .nav-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--sn-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
}

.chat-nav[collapsed] .nav-title  {
  display: none;
}

.chat-nav-collapse-icon {
  transition: transform 0.2s ease;
}

.chat-nav[collapsed] .chat-nav-collapse-icon  {
  transform: rotate(180deg);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--sn-text-dim);
  font-size: 0.75rem;
  transition: background 0.1s, color 0.1s;
  flex-shrink: 0;
}

.nav-btn .material-symbols-outlined {
  font-size: 16px;
}

.nav-btn:hover {
  background: var(--sn-node-hover);
  color: var(--sn-text);
}

.chat-items {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.chat-nav[collapsed] .chat-items  {
  overflow: visible;
}

`;
