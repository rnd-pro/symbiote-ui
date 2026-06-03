/**
 * InspectorPanel styles
 * @module symbiote-node/inspector/InspectorPanel.css
 */
import { css } from '@symbiotejs/symbiote';

export let styles = css`
  inspector-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 280px;
    background: var(--sn-node-bg);
    border-left: 1px solid var(--sn-node-border);
    display: flex;
    flex-direction: column;
    z-index: 100;
    font-family: var(--sn-font);
    color: var(--sn-text);
    overflow-y: auto;
    transition: transform 0.2s ease;

    &[hidden] {
      display: none;
    }

    & .insp-resize-handle {
      position: absolute;
      top: 0;
      left: -2px;
      width: 5px;
      height: 100%;
      cursor: col-resize;
      z-index: 110;
      transition: background 0.15s;

      &:hover,
      &.dragging {
        background: var(--sn-node-selected);
        opacity: 0.5;
      }
    }

    & .insp-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 600;
      border-bottom: 1px solid var(--sn-node-border);
      background: var(--sn-node-bg);
    }

    & .insp-header .material-symbols-outlined {
      font-size: 18px;
      opacity: 0.7;
    }

    & .insp-body {
      flex: 1;
      padding: 44px 16px 12px;
    }

    & .insp-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 0;
      color: var(--sn-text-dim);
      font-size: 13px;

      &[hidden] {
        display: none;
      }
    }

    & .insp-empty .material-symbols-outlined {
      font-size: 32px;
      opacity: 0.4;
    }

    & .insp-field {
      margin-bottom: 12px;
    }

    & .insp-field label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--sn-text-dim);
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }

    & .insp-value {
      font-size: 13px;
      padding: 6px 8px;
      background: color-mix(in srgb, currentColor 4%, transparent);
      border-radius: 4px;
    }

    & .insp-tag {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--sn-cat-server) 15%, transparent);
      color: var(--sn-cat-server);
    }

    & .insp-mono {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 11px;
      opacity: 0.6;
    }

    & .insp-section {
      margin-top: 16px;
    }

    & .insp-section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--sn-text-dim);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    & .insp-section-title .material-symbols-outlined {
      font-size: 16px;
      opacity: 0.6;
    }
  }

  .insp-port {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 4px;
    margin-bottom: 2px;
  }

  .insp-port:hover {
    background: color-mix(in srgb, currentColor 4%, transparent);
  }

  .insp-port-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--sn-cat-server);
    flex-shrink: 0;
  }

  .insp-port-label {
    flex: 1;
  }

  .insp-port-type {
    font-size: 10px;
    color: var(--sn-text-dim);
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .insp-ctrl {
    margin-bottom: 12px;
  }

  .insp-ctrl-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--sn-text-dim);
    margin-bottom: 4px;
    letter-spacing: 0.5px;
  }

  .insp-ctrl-input-el,
  .insp-ctrl-select {
    width: 100%;
    padding: 6px 8px;
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: var(--sn-text);
    background: color-mix(in srgb, currentColor 6%, transparent);
    border: 1px solid var(--sn-field-control-subtle-border);
    border-radius: 4px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;

    &:focus {
      border-color: var(--sn-node-selected);
    }
  }

  .insp-ctrl-textarea {
    width: 100%;
    padding: 6px 8px;
    font-size: 11px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: var(--sn-text);
    background: color-mix(in srgb, currentColor 6%, transparent);
    border: 1px solid var(--sn-field-control-subtle-border);
    border-radius: 4px;
    outline: none;
    resize: vertical;
    min-height: 80px;
    box-sizing: border-box;
    line-height: 1.4;
    transition: border-color 0.15s;

    &:focus {
      border-color: var(--sn-node-selected);
    }
  }

  .insp-ctrl-select {
    appearance: none;
    cursor: pointer;
    background-image: var(--sn-field-select-indicator);
    background-repeat: no-repeat;
    background-position:
      right 10px center,
      right 6px center;
    background-size:
      6px 6px,
      6px 6px;
    padding-right: 24px;

    & option {
      background: var(--sn-node-bg);
      color: var(--sn-text);
    }
  }

  .insp-ctrl-toggle {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    cursor: pointer;

    & input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    & .insp-ctrl-slider {
      position: absolute;
      inset: 0;
      background: var(--sn-field-toggle-bg);
      border-radius: 10px;
      transition: background 0.2s;

      &::before {
        content: '';
        position: absolute;
        width: 14px;
        height: 14px;
        left: 3px;
        bottom: 3px;
        background: var(--sn-field-toggle-thumb-bg);
        border-radius: 50%;
        transition:
          transform 0.2s,
          background 0.2s;
      }
    }

    & input:checked + .insp-ctrl-slider {
      background: var(--sn-node-selected);

      &::before {
        transform: translateX(16px);
        background: var(--sn-field-toggle-thumb-active-bg);
      }
    }
  }

  .insp-enter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    margin-top: 12px;
    border: 1px solid var(--sn-subgraph-border);
    border-radius: 8px;
    background: var(--sn-subgraph-bg);
    color: var(--sn-subgraph-accent);
    font-family: var(--sn-font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      transform 0.1s;
  }

  .insp-enter-btn:hover {
    background: var(--sn-subgraph-bg-hover);
    border-color: var(--sn-subgraph-border-hover);
  }

  .insp-enter-btn:active {
    transform: scale(0.97);
  }

  .insp-enter-btn .material-symbols-outlined {
    font-size: 18px;
  }

  .insp-fire {
    padding: 12px 16px;
  }

  .insp-fire-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 10px 16px;
    border: 1px solid var(--sn-success-border);
    border-radius: 8px;
    background: var(--sn-success-bg);
    color: var(--sn-success-color);
    font-family: var(--sn-font);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      transform 0.1s;

    &:hover {
      background: var(--sn-success-bg-hover);
      border-color: var(--sn-success-border-hover);
    }

    &:active {
      transform: scale(0.97);
    }

    .material-symbols-outlined {
      font-size: 20px;
    }
  }

  .insp-template-preview {
    padding: 0 16px 12px;
    border-top: 1px solid var(--sn-field-control-subtle-border);
    margin-top: 8px;

    &[hidden] {
      display: none;
    }
  }
`;
