/**
 * @fileoverview ActionZone styles
 */

import { css } from '@symbiotejs/symbiote';

/**
 * Size of the triangular zone (px)
 */
export let ZONE_SIZE = 16;

export let styles = css`
  action-zone {
    position: absolute;
    width: var(--sn-action-zone-size, ${ZONE_SIZE}px);
    height: var(--sn-action-zone-size, ${ZONE_SIZE}px);
    z-index: 100;
    cursor: crosshair;
    opacity: 0;
    transition: opacity 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      opacity: 1 !important;
    }

    &[dragging] {
      opacity: 1 !important;
    }

    /* Corner positioning */
    &[corner='tl'] {
      top: 0;
      left: 0;
    }

    &[corner='tr'] {
      top: 0;
      right: 0;
    }

    &[corner='bl'] {
      bottom: 0;
      left: 0;
    }

    &[corner='br'] {
      bottom: 0;
      right: 0;
    }

    .zone-icon {
      width: 100%;
      height: 100%;
      color: var(--sn-node-selected);
      opacity: 0.6;
    }

    /* Rotate triangle based on corner */
    &[corner='tl'] .zone-icon {
      transform: rotate(0deg);
    }

    &[corner='tr'] .zone-icon {
      transform: rotate(90deg);
    }

    &[corner='br'] .zone-icon {
      transform: rotate(180deg);
    }

    &[corner='bl'] .zone-icon {
      transform: rotate(270deg);
    }

    &[dragging] .zone-icon {
      color: var(--sn-text);
      opacity: 1;
    }
  }

  /* Parent hover rule */
  layout-node[node-type='panel']:hover action-zone {
    opacity: 0.5;
  }
`;
