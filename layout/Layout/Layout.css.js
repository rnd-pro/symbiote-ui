import { css } from '@symbiotejs/symbiote';
import { themedScrollbarStyles } from '../../themes/scrollbar-styles.js';

export let styles = css`
  panel-layout {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    font-family: var(--sn-font);
    ${themedScrollbarStyles}

    &[hidden] {
      display: none;
    }

    .layout-root {
      box-sizing: border-box;
      display: flex;
      width: 100%;
      height: 100%;
      padding: var(--sn-frame-gap, 0);
      background: var(--sn-layout-gap-bg);
    }

    &[scroll-inline-active] {
      overflow-x: auto;

      .layout-root {
        min-width: var(--sn-layout-overflow-inline-size, 960px);
      }
    }

    &[scroll-inline-active]:not([scroll-block-active]) {
      overflow-y: hidden;
    }

    &[scroll-block-active] {
      overflow-y: auto;

      .layout-root {
        min-height: var(--sn-layout-overflow-block-size, 720px);
      }
    }

    &[scroll-block-active]:not([scroll-inline-active]) {
      overflow-x: hidden;
    }

    &[scroll-inline-active][scroll-block-active] {
      overflow: auto;

      .layout-root {
        min-width: var(--sn-layout-overflow-inline-size, 960px);
        min-height: var(--sn-layout-overflow-block-size, 720px);
      }
    }

    &[responsive-active][responsive-mode='stack'] {
      .layout-root {
        display: block;
        height: auto;
        min-height: 100%;
      }

      layout-node[node-type='split'] {
        display: block;
        height: auto !important;
        min-height: 0;
        overflow: visible;
      }

      layout-node[node-type='split'] > .split-view {
        display: block;
        height: auto;
      }

      layout-node[node-type='split'] > .split-view > .split-first,
      layout-node[node-type='split'] > .split-view > .split-second {
        display: block;
        width: 100% !important;
        height: auto !important;
        min-height: var(--sn-layout-responsive-panel-min-block-size, 260px);
      }

      layout-node[node-type='split'] > .split-view > .split-resizer {
        display: none;
      }

      layout-node[node-type='panel'] {
        min-height: var(--sn-layout-responsive-panel-min-block-size, 260px);
      }
    }

    .layout-drawer-backdrop,
    .layout-drawer-handle-stack,
    .layout-drawer-handle {
      display: none;
    }

    &[drawer-mode-active] {
      --sn-layout-drawer-size: min(
        var(--sn-layout-drawer-inline-size, 86vw),
        var(--sn-layout-drawer-max-inline-size, 360px)
      );
      --sn-layout-drawer-rail-peek-distance: 20px;
      min-block-size: var(--sn-layout-drawer-min-block-size, inherit);
      overflow: hidden;

      .layout-root {
        position: absolute;
        inset: 0;
        min-block-size: inherit;
        overflow: hidden;
        background: var(--sn-layout-bg, var(--sn-bg));
      }

      layout-node[node-type='split'],
      layout-node[node-type='split'] > .split-view,
      layout-node[node-type='split'] > .split-view > .split-first,
      layout-node[node-type='split'] > .split-view > .split-second {
        display: contents !important;
        width: auto !important;
        height: auto !important;
        min-width: 0;
        min-height: 0;
        overflow: visible;
      }

      layout-node[node-type='split'] > .split-view > .split-resizer {
        display: none;
      }

      layout-node[node-type='panel'] {
        position: absolute;
        inset-block: 0;
        box-sizing: border-box;
        background: var(--sn-layout-drawer-bg, var(--sn-panel-bg, var(--sn-node-bg)));
        background-clip: padding-box;
        isolation: isolate;
        touch-action: pan-y;
        overscroll-behavior: contain;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        transform: translate3d(var(--sn-layout-drawer-translate, 0), 0, 0);
        transition:
          transform var(--sn-layout-drawer-transition-duration, var(--sn-transition-normal, 180ms))
            var(--sn-layout-drawer-transition-easing, var(--sn-transition-easing, ease)),
          box-shadow var(--sn-layout-drawer-transition-duration, var(--sn-transition-normal, 180ms))
            var(--sn-layout-drawer-transition-easing, var(--sn-transition-easing, ease));

        .panel-content {
          overscroll-behavior: contain;
        }
      }

      layout-node .type-btn {
        display: none !important;
      }

      layout-node[mobile-dock='primary'] {
        inset: 0;
        z-index: var(--sn-layout-drawer-primary-z, 1);
        width: 100% !important;
        height: 100% !important;
        transform: none !important;
      }

      &[drawer-start-rail] layout-node[mobile-dock='primary'] {
        inset-inline-start: var(--sn-layout-collapsed-horizontal-size, 32px);
        width: auto !important;
      }

      &[drawer-end-rail] layout-node[mobile-dock='primary'] {
        inset-inline-end: var(--sn-layout-collapsed-horizontal-size, 32px);
        width: auto !important;
      }

      layout-node[mobile-dock='start'],
      layout-node[mobile-dock='end'] {
        z-index: var(--sn-layout-drawer-z, 3);
        inline-size: var(--sn-layout-drawer-size);
        width: var(--sn-layout-drawer-size) !important;
        min-inline-size: min(var(--sn-layout-drawer-size), 100%) !important;
        block-size: 100% !important;
        min-block-size: 100% !important;
        max-inline-size: calc(100% - var(--sn-layout-drawer-edge-size, 34px));
        border-color: var(--sn-layout-drawer-border, var(--sn-layout-border));
        box-shadow: none;
        contain: layout paint style;
        will-change: transform;
      }

      layout-node[drawer-expanded] {
        .panel-view {
          inline-size: 100% !important;
          block-size: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          background: inherit;
          isolation: isolate;
        }

        .panel-header {
          box-sizing: border-box !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
          align-items: center !important;
          inline-size: 100% !important;
          block-size: var(--sn-layout-header-block-size, calc(var(--sn-layout-header-min-height, 28px) + 3px)) !important;
          min-block-size: var(--sn-layout-header-block-size, calc(var(--sn-layout-header-min-height, 28px) + 3px)) !important;
          padding: var(--sn-layout-header-padding, 2px 4px) !important;
        }

        &:not([drawer-rail]) {
          .type-btn,
          .collapse-btn {
            display: none !important;
          }
        }

        .panel-content {
          display: block !important;
          flex: 1 1 auto !important;
          min-block-size: 0 !important;
          background: inherit;
        }
      }

      layout-node[drawer-rail][drawer-rail-collapsed] {
        inline-size: var(--sn-layout-collapsed-horizontal-size, 32px) !important;
        width: var(--sn-layout-collapsed-horizontal-size, 32px) !important;
        min-inline-size: var(--sn-layout-collapsed-horizontal-size, 32px) !important;
        max-inline-size: var(--sn-layout-collapsed-horizontal-size, 32px) !important;
        transform: translate3d(0, 0, 0) !important;
        cursor: ew-resize;
        user-select: none;

        .panel-view {
          inline-size: var(--sn-layout-collapsed-horizontal-size, 32px);
          width: var(--sn-layout-collapsed-horizontal-size, 32px);
          display: flex;
          flex-direction: column;
          block-size: 100%;
          height: 100%;
        }

        .panel-content,
        .panel-menu-drawer {
          display: none !important;
        }

        .panel-header {
          display: flex;
          flex-direction: column;
          writing-mode: horizontal-tb;
          padding: 0;
          height: 100%;
          gap: 0;
          align-items: center;
          justify-content: flex-start;
          width: var(--sn-layout-collapsed-horizontal-size, 32px);
        }

        .fullscreen-btn,
        .panel-menu-toggle,
        .dropdown-arrow,
        .panel-title,
        .header-spacer {
          display: none !important;
        }

        .type-btn {
          order: 1;
          position: relative;
          z-index: 1;
          inline-size: 100%;
          block-size: var(--sn-layout-header-block-size, calc(var(--sn-layout-header-min-height, 28px) + 3px));
          min-block-size: var(--sn-layout-header-block-size, calc(var(--sn-layout-header-min-height, 28px) + 3px));
          justify-content: center;
          padding: var(--sn-layout-header-button-padding, 4px 6px);
          background: none;
          cursor: default;
          pointer-events: none;
          flex: 0 0 auto;

          .panel-icon {
            font-size: var(--sn-layout-header-icon-size, 16px);
          }
        }

        .panel-actions {
          order: 2;
          position: absolute;
          inset: 0;
          z-index: 0;
          display: block;
          align-items: center;
          justify-content: center;
          inline-size: 100%;
          block-size: 100%;
        }

        .collapse-btn {
          padding: var(--sn-layout-collapsed-horizontal-button-padding, 8px 4px);
          flex: 0 0 auto;
          display: flex;
          inline-size: 100%;
          block-size: 100%;
          min-block-size: 0;
          align-items: center;
          justify-content: center;
        }
      }

      layout-node[mobile-dock='start'] {
        inset-inline-start: 0;
        inset-inline-end: auto;
        --sn-layout-drawer-translate: -100%;
        transform: translate3d(var(--sn-layout-drawer-translate), 0, 0);
      }

      layout-node[mobile-dock='end'] {
        inset-inline-start: auto;
        inset-inline-end: 0;
        --sn-layout-drawer-translate: 100%;
        transform: translate3d(var(--sn-layout-drawer-translate), 0, 0);
      }

      layout-node[mobile-dock='start'][drawer-open],
      layout-node[mobile-dock='end'][drawer-open] {
        transform: translate3d(0, 0, 0);
        box-shadow: var(--sn-layout-drawer-shadow, var(--sn-shadow-xl));
      }

      layout-node[fullscreen] {
        inline-size: auto !important;
        block-size: auto !important;
        width: auto !important;
        height: auto !important;
        min-inline-size: 0 !important;
        min-block-size: 0 !important;
        max-inline-size: none !important;
        max-block-size: none !important;
        transform: none !important;
      }

      layout-node[drawer-dragging] {
        transition: none;
        will-change: transform;
      }

      .layout-drawer-handle-stack {
        display: flex;
        position: absolute;
        inset-block-start: 50%;
        z-index: var(--sn-layout-drawer-handle-z, 4);
        flex-direction: column;
        gap: var(--sn-layout-drawer-handle-gap, 6px);
        pointer-events: none;
        transform: translateY(-50%);
        transition:
          inset-inline-start var(--sn-layout-drawer-transition-duration, var(--sn-transition-normal, 180ms))
            var(--sn-layout-drawer-transition-easing, var(--sn-transition-easing, ease)),
          inset-inline-end var(--sn-layout-drawer-transition-duration, var(--sn-transition-normal, 180ms))
            var(--sn-layout-drawer-transition-easing, var(--sn-transition-easing, ease)),
          transform var(--sn-layout-drawer-transition-duration, var(--sn-transition-normal, 180ms))
            var(--sn-layout-drawer-transition-easing, var(--sn-transition-easing, ease));

        &[hidden] {
          display: none;
        }
      }

      .layout-drawer-handle-stack-start {
        inset-inline-start: 0;
      }

      .layout-drawer-handle-stack-end {
        inset-inline-end: 0;
      }

      .layout-drawer-handle-stack[data-swipe-control='island'] {
        inset-block-start: auto;
        inset-block-end: var(--sn-layout-swipe-island-offset, 14px);
        inset-inline-start: var(--sn-layout-swipe-island-offset, 14px);
        inset-inline-end: auto;
        flex-direction: row;
        gap: var(--sn-layout-swipe-island-gap, 8px);
        transform: none !important;
      }

      .layout-drawer-handle {
        display: inline-flex;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
        inline-size: var(--sn-layout-drawer-handle-inline-size, 32px);
        block-size: var(--sn-layout-drawer-handle-block-size, 52px);
        padding: 0;
        border: 1px solid var(--sn-layout-drawer-border, var(--sn-layout-border));
        background: var(
          --sn-layout-drawer-handle-bg,
          var(--sn-layout-drawer-bg, var(--sn-panel-bg, var(--sn-node-bg)))
        );
        color: var(--sn-layout-drawer-handle-color, var(--sn-text));
        box-shadow: var(--sn-layout-drawer-handle-shadow, none);
        cursor: ew-resize;
        pointer-events: auto;
        touch-action: pan-y;
        user-select: none;

        &[hidden] {
          display: none;
        }

        &:focus-visible {
          outline: var(--sn-focus-outline, 2px solid var(--sn-node-selected));
          outline-offset: var(--sn-focus-outline-offset, 2px);
        }

        .material-symbols-outlined {
          font-size: var(--sn-layout-drawer-handle-icon-size, 20px);
        }
      }

      .layout-drawer-handle-stack[data-swipe-control='island'] .layout-drawer-handle {
        inline-size: var(--sn-layout-swipe-island-size, 48px);
        block-size: var(--sn-layout-swipe-island-size, 48px);
        border: 1px solid var(--sn-layout-drawer-border, var(--sn-layout-border));
        border-radius: var(--sn-layout-swipe-island-radius, var(--sn-radius-md, 8px));
        box-shadow: var(
          --sn-layout-swipe-island-shadow,
          var(--sn-layout-drawer-handle-shadow, var(--sn-shadow-lg))
        );
        cursor: grab;
        touch-action: none;
      }

      .layout-drawer-handle-stack[data-swipe-control='island'] .layout-drawer-handle:active {
        cursor: grabbing;
      }

      .layout-drawer-handle-start {
        border-inline-start-width: 0;
        border-radius: 0 var(--sn-layout-drawer-handle-radius, 8px)
          var(--sn-layout-drawer-handle-radius, 8px) 0;
        box-shadow: var(
          --sn-layout-drawer-handle-shadow-start,
          var(--sn-layout-drawer-handle-shadow, none)
        );
      }

      .layout-drawer-handle-end {
        border-inline-end-width: 0;
        border-radius: var(--sn-layout-drawer-handle-radius, 8px) 0 0
          var(--sn-layout-drawer-handle-radius, 8px);
        box-shadow: var(
          --sn-layout-drawer-handle-shadow-end,
          var(--sn-layout-drawer-handle-shadow, none)
        );
      }

      .layout-drawer-handle-stack[data-swipe-control='island'] .layout-drawer-handle-start,
      .layout-drawer-handle-stack[data-swipe-control='island'] .layout-drawer-handle-end {
        border-inline-start-width: 1px;
        border-inline-end-width: 1px;
        border-radius: var(--sn-layout-swipe-island-radius, var(--sn-radius-md, 8px));
      }

      .layout-drawer-backdrop {
        position: absolute;
        inset: 0;
        z-index: var(--sn-layout-drawer-backdrop-z, 2);
        display: none;
        padding: 0;
        border: 0;
        background: var(--sn-layout-drawer-backdrop-bg, transparent);
        backdrop-filter: var(--sn-layout-drawer-backdrop-filter, none);
      }

      &[drawer-start-open],
      &[drawer-end-open] {
        .layout-drawer-backdrop {
          display: block;
        }
      }

      &[drawer-dragging] {
        .layout-drawer-handle-stack,
        .layout-drawer-handle,
        layout-node[mobile-dock='start'],
        layout-node[mobile-dock='end'] {
          transition: none;
        }
      }
    }

    &[drawer-mode-active][drawer-start-open] layout-node[mobile-dock='start'] {
      transform: translate3d(0, 0, 0);
      box-shadow: var(--sn-layout-drawer-shadow, var(--sn-shadow-xl));
    }

    &[drawer-mode-active][drawer-end-open] layout-node[mobile-dock='end'] {
      transform: translate3d(0, 0, 0);
      box-shadow: var(--sn-layout-drawer-shadow, var(--sn-shadow-xl));
    }

    &[fullscreen-active] {
      .layout-drawer-backdrop,
      .layout-drawer-handle-stack,
      .layout-drawer-handle {
        display: none !important;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      &[drawer-mode-active] {
        layout-node[node-type='panel'],
        .layout-drawer-handle-stack,
        .layout-drawer-handle {
          transition-duration: 0ms;
        }
      }
    }

    /* Fullscreen tab bar */
    .fullscreen-tab-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--sn-fullscreen-tab-bar-height, 32px);
      background: var(--sn-bg);
      display: flex;
      align-items: stretch;
      gap: 0;
      z-index: var(--sn-fullscreen-tab-bar-z, 30020);
      padding: 0;

      &[hidden] {
        display: none;
      }
    }

    .tab-list {
      display: contents;
    }

    .fullscreen-tab {
      display: flex;
      align-items: center;
      gap: var(--sn-fullscreen-tab-gap, 6px);
      padding: var(--sn-fullscreen-tab-padding, 0 12px);
      height: var(--sn-fullscreen-tab-height, 32px);
      border: none;
      border-left: none;
      border-right: none;
      background: var(--sn-bg);
      color: var(--sn-text-dim);
      cursor: pointer;
      font-size: var(--sn-fullscreen-tab-size, 12px);
      font-family: inherit;
      transition:
        background var(--sn-transition-fast) var(--sn-transition-easing),
        color var(--sn-transition-fast) var(--sn-transition-easing);

      .material-symbols-outlined {
        font-size: var(--sn-fullscreen-tab-icon-size, 16px);
      }

      &:hover {
        background: var(--sn-node-header-bg);
        color: var(--sn-text);
      }

      &[active] {
        height: var(--sn-fullscreen-tab-active-height, 33px);
        margin-bottom: var(--sn-step-0, -1px);
        position: relative;
        z-index: 1;
        background: var(--sn-node-header-bg);
        color: var(--sn-text);
        border-left: 1px solid var(--sn-layout-border);
        border-right: 1px solid var(--sn-layout-border);
      }
    }

    .tab-filler {
      flex: 1;
      height: var(--sn-fullscreen-tab-bar-height, 32px);
      background: var(--sn-bg);
    }
  }
`;
