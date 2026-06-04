import { css } from '@symbiotejs/symbiote';
import { themedScrollbarStyles } from '../../themes/scrollbar-styles.js';

export let styles = css`
  layout-node {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    position: relative;

    /* Panel mode */
    &[node-type='panel'] {
      flex-direction: column;
      background: var(--sn-node-bg);
      border: 1px solid var(--sn-layout-border);
    }

    .panel-view {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      position: relative;
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: var(--sn-layout-header-gap, 2px);
      padding: var(--sn-layout-header-padding, 2px 4px);
      background: var(--sn-node-header-bg);
      border-bottom: 1px solid var(--sn-layout-border);
      flex-shrink: 0;
      min-height: var(--sn-layout-header-min-height, 28px);
    }

    &[panel-chrome='none'] {
      .panel-header,
      action-zone {
        display: none !important;
      }
    }

    .header-btn {
      display: flex;
      align-items: center;
      gap: var(--sn-layout-header-button-gap, 4px);
      padding: var(--sn-layout-header-button-padding, 4px 6px);
      background: transparent;
      border: none;
      border-radius: var(--sn-layout-header-button-radius, 4px);
      cursor: pointer;
      color: var(--sn-text-dim);
      font-size: var(--sn-layout-header-button-size, 0.75rem);
      transition:
        background 0.1s,
        color 0.1s;

      &[hidden] {
        display: none;
      }

      &:hover {
        background: var(--sn-node-hover);
        color: var(--sn-text);
      }

      .material-symbols-outlined {
        font-size: var(--sn-layout-header-icon-size, 16px);
      }
    }

    .type-btn {
      .dropdown-arrow {
        font-size: var(--sn-layout-header-dropdown-size, 18px);
        margin-left: -2px;
        opacity: 0.6;
      }
    }

    .header-spacer {
      flex: 1;
    }

    .panel-title {
      font-weight: 500;
      white-space: nowrap;
    }

    .panel-content {
      flex: 1;
      overflow: auto;
      position: relative;
      ${themedScrollbarStyles}
    }

    /* Collapsed state - vertical (bottom/top panels) */
    &[collapsed][collapse-dir='vertical'] {
      flex: 0 0 auto !important;
      height: var(--sn-layout-collapsed-vertical-size, 28px) !important;
      min-height: var(--sn-layout-collapsed-vertical-size, 28px) !important;
      max-height: var(--sn-layout-collapsed-vertical-size, 28px) !important;

      .panel-content,
      action-zone {
        display: none !important;
      }

      .panel-header {
        position: relative;
      }

      /* Hide fullscreen button, dropdown, and spacer */
      .fullscreen-btn,
      .dropdown-arrow,
      .panel-title,
      .header-spacer {
        display: none !important;
      }

      /* Panel icon at left */
      .type-btn {
        padding: var(--sn-layout-collapsed-type-padding, 4px 8px);
        background: none;
        cursor: default;
        pointer-events: none;

        .panel-icon {
          font-size: var(--sn-layout-collapsed-icon-size, 18px);
        }
      }

      /* Expand button centered */
      .collapse-btn {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        padding: var(--sn-layout-collapsed-button-padding, 4px);
      }
    }

    /* Collapsed state - horizontal (side panels) */
    &[collapsed][collapse-dir='horizontal'] {
      width: var(--sn-layout-collapsed-horizontal-size, 32px) !important;
      min-width: var(--sn-layout-collapsed-horizontal-size, 32px) !important;
      max-width: var(--sn-layout-collapsed-horizontal-size, 32px) !important;

      .panel-view {
        width: var(--sn-layout-collapsed-horizontal-size, 32px);
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .panel-content,
      action-zone {
        display: none !important;
      }

      .panel-header {
        flex-direction: column;
        writing-mode: horizontal-tb;
        padding: 0;
        height: 100%;
        gap: 0;
        align-items: center;
        justify-content: flex-start;
        width: var(--sn-layout-collapsed-horizontal-size, 32px);
      }

      /* Hide fullscreen button, dropdown, and spacer */
      .fullscreen-btn,
      .dropdown-arrow,
      .panel-title,
      .header-spacer {
        display: none !important;
      }

      /* Panel icon at top */
      .type-btn {
        order: 1;
        padding: var(--sn-layout-collapsed-horizontal-type-padding, 6px 4px);
        background: none;
        cursor: default;
        pointer-events: none;
        flex: 0 0 auto;

        .panel-icon {
          font-size: var(--sn-layout-collapsed-horizontal-icon-size, 20px);
        }
      }

      /* Expand button centered via flex-grow */
      .collapse-btn {
        order: 2;
        padding: var(--sn-layout-collapsed-horizontal-button-padding, 8px 4px);
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }

    /* Fullscreen state */
    &[fullscreen] {
      position: fixed !important;
      inset: 0 !important;
      top: 28px !important;
      z-index: 10001 !important;
      box-shadow: 0 0 40px var(--sn-shadow-color);
    }

    /* Fullscreen: hide panel type selector, collapse btn, action zones */
    &[fullscreen] .type-btn,
    &[fullscreen] .collapse-btn,
    &[fullscreen] action-zone {
      display: none !important;
    }

    /* Fullscreen: remove header bottom border */
    &[fullscreen] .panel-header {
      border-bottom: none !important;
    }

    /* Split mode */
    &[node-type='split'] {
      background: transparent;
      border: none;
    }

    .split-view {
      display: flex;
      width: 100%;
      height: 100%;

      &[direction='horizontal'] {
        flex-direction: row;
      }

      &[direction='vertical'] {
        flex-direction: column;
      }
    }

    .split-first,
    .split-second {
      display: flex;
      overflow: hidden;
      min-width: 0;
      min-height: 0;
    }

    /* Collapsed child handling */
    .split-first[collapsed-child] + .split-resizer + .split-second {
      flex: 1 1 auto !important;
      width: auto !important;
      height: auto !important;
    }

    .split-first:has(+ .split-resizer + .split-second[collapsed-child]) {
      flex: 1 1 auto !important;
      width: auto !important;
      height: auto !important;
    }

    .split-resizer {
      flex-shrink: 0;
      background: var(--sn-layout-gap-bg);
      transition: background 0.15s ease;
      z-index: 10;
    }

    .split-view[direction='horizontal'] > .split-resizer {
      width: var(--sn-layout-resizer-thickness, 2px);
      cursor: col-resize;
    }

    .split-view[direction='vertical'] > .split-resizer {
      height: var(--sn-layout-resizer-thickness, 2px);
      cursor: row-resize;
    }

    .split-resizer:hover {
      background: var(--sn-layout-resizer-hover-bg);
    }

    &[resizing] .split-resizer {
      background: var(--sn-layout-resizer-hover-bg);
    }

    &[resizing] {
      user-select: none;
    }

    /* Hidden state */
    .panel-view[hidden],
    .split-view[hidden] {
      display: none;
    }
  }
`;
