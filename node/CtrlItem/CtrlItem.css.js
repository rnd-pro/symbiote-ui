/**
 * CtrlItem styles
 * @module symbiote-node/node/CtrlItem.css
 */
import { css } from '@symbiotejs/symbiote';

export let styles = css`
  ctrl-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 12px;

    & .sn-ctrl-label {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--sn-text-dim);
      letter-spacing: 0.5px;
    }

    & .sn-ctrl-input {
      background: var(--sn-field-control-bg);
      border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      border-radius: 4px;
      padding: 4px 8px;
      color: var(--sn-text);
      font-size: 12px;
      outline: none;
      font-family: inherit;

      &:focus {
        border-color: var(--sn-node-accent);
      }

      &[readonly] {
        opacity: 0.6;
        cursor: default;
      }
    }
  }
`;
