/**
 * CtrlItem styles
 * @module symbiote-node/node/CtrlItem.css
 */
import { css } from '@symbiotejs/symbiote';

export let styles = css`
  ctrl-item {
    display: flex;
    flex-direction: column;
    gap: var(--sn-control-gap, 2px);
    padding: var(--sn-control-padding, 4px 12px);

    & .sn-ctrl-label {
      font-size: var(--sn-control-label-size, 10px);
      text-transform: uppercase;
      color: var(--sn-text-dim);
      letter-spacing: 0.5px;
    }

    & .sn-ctrl-input {
      background: var(--sn-field-control-bg);
      border: 1px solid var(--sn-control-input-border, color-mix(in srgb, currentColor 10%, transparent));
      border-radius: var(--sn-control-input-radius, 4px);
      padding: var(--sn-control-input-padding, 4px 8px);
      color: var(--sn-text);
      font-size: var(--sn-control-input-size, 12px);
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
