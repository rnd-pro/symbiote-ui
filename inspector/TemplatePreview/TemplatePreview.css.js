/**
 * TemplatePreview styles
 * @module symbiote-node/inspector/TemplatePreview.css
 */
import { css } from '@symbiotejs/symbiote';

export let styles = css`
  template-preview {
    display: block;
    padding-top: 8px;

    & .tpl-preview-section {
      margin-bottom: 10px;
    }

    & .tpl-chips-label,
    & .tpl-preview-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--sn-text-dim);
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }

    & .tpl-chips-label .material-symbols-outlined,
    & .tpl-preview-label .material-symbols-outlined {
      font-size: 14px;
      opacity: 0.6;
    }

    & .tpl-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    & .tpl-chips-empty {
      font-size: 11px;
      color: var(--sn-text-dim);
      font-style: italic;
      padding: 4px 0;

      &[hidden] {
        display: none;
      }
    }

    & .tpl-test-data {
      width: 100%;
      padding: 6px 8px;
      font-size: 11px;
      font-family: var(--sn-font-mono);
      color: var(--sn-text);
      background: color-mix(in srgb, currentColor 6%, transparent);
      border: 1px solid var(--sn-node-border);
      border-radius: 4px;
      outline: none;
      resize: vertical;
      min-height: 50px;
      box-sizing: border-box;
      line-height: 1.4;
      transition: border-color 0.15s;

      &:focus {
        border-color: var(--sn-node-selected);
      }
    }

    & .tpl-preview-result {
      font-size: 12px;
      font-family: var(--sn-font-mono);
      color: var(--sn-text);
      background: color-mix(in srgb, currentColor 4%, transparent);
      border: 1px solid var(--sn-node-border);
      border-radius: 4px;
      padding: 8px;
      white-space: pre-wrap;
      word-break: break-word;
      min-height: 30px;
      line-height: 1.4;
    }
  }

  .tpl-chip {
    display: inline-block;
    padding: 2px 8px;
    font-size: 11px;
    font-family: var(--sn-font-mono);
    border-radius: 10px;
    background: var(--sn-success-bg);
    color: var(--sn-success-color);
    border: 1px solid var(--sn-success-border);

    &[data-missing] {
      background: var(--sn-danger-bg);
      color: var(--sn-danger-color);
      border-color: var(--sn-danger-border);
    }
  }
`;
