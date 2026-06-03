/**
 * LayoutSidebar styles
 * @module symbiote-node/layout/LayoutSidebar
 */
import { css } from '@symbiotejs/symbiote';

export let sidebarStyles = css`
  layout-sidebar {
    display: flex;
    flex-direction: column;
    width: var(--sn-sidebar-width);
    min-width: var(--sn-sidebar-width);
    background: var(--sn-bg);
    border-right: 1px solid var(--sn-layout-border);
    overflow: hidden;
    transition:
      width 0.2s ease,
      min-width 0.2s ease;
    user-select: none;
    position: relative;

    &[collapsed] {
      width: var(--sn-sidebar-collapsed-width);
      min-width: var(--sn-sidebar-collapsed-width);
    }
  }

  /* Resize handle — right edge */
  layout-sidebar .sb-resize-handle {
    position: absolute;
    top: 0;
    right: calc(-1 * var(--sn-sidebar-resize-offset));
    width: var(--sn-sidebar-resize-width);
    height: 100%;
    cursor: col-resize;
    z-index: 10;
    transition: background 0.15s;

    &:hover,
    &.dragging {
      background: var(--sn-layout-resizer-hover-bg);
    }

    layout-sidebar[collapsed] & {
      display: none;
    }
  }

  /* ═══════════════════════ Header — same as panel headers ═══════════════════════ */
  layout-sidebar .sb-header {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 4px;
    min-height: 28px;
    background: var(--sn-node-header-bg);
    border-bottom: none;
    flex-shrink: 0;

    /* Collapsed: center the collapse button */
    layout-sidebar[collapsed] & {
      justify-content: center;
      padding: 2px 0;
    }
  }

  layout-sidebar .sb-header-spacer {
    flex: 1;

    layout-sidebar[collapsed] & {
      display: none;
    }
  }

  /* Header buttons — same style as panel header-btn */
  layout-sidebar .sb-header-btn {
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
    transition:
      background 0.1s,
      color 0.1s;

    &:hover {
      background: var(--sn-node-hover);
      color: var(--sn-text);
    }

    & .material-symbols-outlined {
      font-size: 16px;
    }

    /* Active tune button in edit mode */
    layout-sidebar[edit-mode] &:first-child {
      color: var(--sn-cat-server);
      background: color-mix(in srgb, var(--sn-cat-server) 10%, transparent);
    }
  }

  /* Reset button — visible only in edit mode */
  layout-sidebar .sb-reset-btn {
    display: none;

    layout-sidebar[edit-mode] & {
      display: flex;
    }

    layout-sidebar[collapsed] & {
      display: none;
    }

    &:hover {
      color: var(--sn-accent-warn);
    }
  }

  /* Hide tune button when collapsed */
  layout-sidebar[collapsed] .sb-header-btn:first-child {
    display: none;
  }

  /* Collapse icon rotation */
  layout-sidebar .sb-collapse-icon {
    transition: transform 0.2s ease;
  }

  layout-sidebar[collapsed] .sb-collapse-icon {
    transform: rotate(180deg);
  }

  /* ═══════════════════════ Sections container ═══════════════════════ */
  layout-sidebar .sb-sections {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
  }

  /* ═══════════════════════ SidebarSection ═══════════════════════ */
  sidebar-section {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    position: relative;

    /* Hidden section in normal mode */
    &[data-hidden] {
      display: none;
    }

    /* Disabled section — shown but not interactive */
    &[data-disabled] {
      opacity: 0.35;
      pointer-events: none;
      filter: grayscale(0.5);
    }

    /* In edit mode, show disabled sections normally (admin might want to toggle visibility) */
    layout-sidebar[edit-mode] &[data-disabled] {
      opacity: 0.5;
      pointer-events: auto;
      filter: none;
    }

    /* In edit mode, hidden sections are dimmed */
    layout-sidebar[edit-mode] &[data-hidden] {
      display: flex;
      opacity: 0.35;
    }

    /* Drag states */
    &[data-dragging] {
      opacity: 0.4;
    }

    &[data-dragover] {
      border-top: 2px solid var(--sn-cat-server);
    }
  }

  /* Drag handle — edit mode only */
  sidebar-section .sec-drag-handle {
    display: none;
    align-items: center;
    padding: 0 2px;
    cursor: grab;
    color: var(--sn-text-dim);

    &:active {
      cursor: grabbing;
    }

    & .material-symbols-outlined {
      font-size: 16px;
    }

    layout-sidebar[edit-mode] & {
      display: flex;
    }

    layout-sidebar[collapsed] & {
      display: none;
    }
  }

  /* Section row */
  sidebar-section .sec-item {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    padding: 6px 14px;
    min-height: 28px;
    cursor: pointer;
    color: var(--sn-text-dim);
    transition:
      background 0.12s,
      color 0.12s;
    white-space: nowrap;
    overflow: hidden;

    layout-sidebar[edit-mode] & {
      padding-left: 4px;
    }

    &:hover {
      background: var(--sn-node-hover);
      color: var(--sn-text);
    }
  }

  sidebar-section .sec-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  sidebar-section .sec-label {
    font-size: 13px;
    font-weight: 500;

    layout-sidebar[collapsed] & {
      display: none;
    }
  }

  /* Expand chevron */
  sidebar-section .sec-expand {
    margin-left: auto;
    font-size: 16px;
    transition:
      transform 0.15s,
      opacity 0.15s;

    layout-sidebar[collapsed] & {
      display: none;
    }

    layout-sidebar[edit-mode] & {
      display: none;
    }

    /* Inactive state when no sub-panels */
    sidebar-section:not([data-has-sub]) & {
      opacity: 0.2;
      cursor: default;
    }
  }

  /* Active section */
  sidebar-section[data-active] > .sec-item {
    color: var(--sn-text);
    background: var(--sn-node-bg);
    border-left: 2px solid var(--sn-cat-server);
    padding-left: 12px;

    layout-sidebar[edit-mode] & {
      padding-left: 2px;
    }
  }

  /* Eye visibility button — edit mode only */
  sidebar-section .sec-eye {
    display: none;
    align-items: center;
    justify-content: center;
    padding: 4px 6px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--sn-text-dim);
    transition:
      color 0.15s,
      background 0.15s;
    flex-shrink: 0;

    &:hover {
      background: var(--sn-node-hover);
      color: var(--sn-text);
    }

    & .material-symbols-outlined {
      font-size: 16px;
    }

    layout-sidebar[edit-mode] & {
      display: flex;
    }

    layout-sidebar[collapsed] & {
      display: none;
    }

    sidebar-section[data-hidden] & {
      opacity: 0.5;
    }
  }

  /* ═══════════════════════ Sub-panels ═══════════════════════ */
  sidebar-section .sec-sub-panels {
    width: 100%;
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.2s ease;

    layout-sidebar[collapsed] & {
      display: none;
    }

    layout-sidebar[edit-mode] & {
      display: none;
    }
  }

  sidebar-section[data-expanded] .sec-sub-panels {
    max-height: 300px;
  }

  sidebar-section[data-expanded] .sec-expand {
    transform: rotate(90deg);
  }

  sidebar-section .sub-panel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 14px 4px 38px;
    min-height: 24px;
    font-size: 12px;
    color: var(--sn-text-dim);
    cursor: default;
    transition:
      background 0.12s,
      color 0.12s;

    &:hover {
      background: var(--sn-node-hover);
      color: var(--sn-text);
    }

    & .material-symbols-outlined {
      font-size: 14px;
      opacity: 0.6;
    }
  }

  /* Close button on sub-panel items */
  sidebar-section .sub-panel-close {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    padding: 2px;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    color: var(--sn-text-dim);
    opacity: 0;
    transition:
      opacity 0.12s,
      background 0.12s,
      color 0.12s;

    & .material-symbols-outlined {
      font-size: 14px;
    }

    &:hover {
      background: color-mix(in srgb, var(--sn-danger-color) 15%, transparent);
      color: var(--sn-danger-color);
    }
  }

  /* Show close only on hover of non-master items */
  sidebar-section .sub-panel-item:hover .sub-panel-close {
    opacity: 1;
  }

  /* Hide close button on master panel items */
  sidebar-sub-item[data-master] .sub-panel-close {
    display: none;
  }
`;
