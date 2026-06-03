import { css } from '@symbiotejs/symbiote';

export let styles = css`
  layout-preview {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;

    &[hidden] {
      display: none;
    }

    .preview-overlay {
      position: absolute;
      background: var(--sn-layout-preview-join-bg);
      border: 2px solid var(--sn-layout-preview-join-border);
      display: none;
    }

    &[type='join'] .preview-overlay {
      display: block;
    }

    .preview-line {
      position: absolute;
      background: var(--sn-layout-preview-line);
      box-shadow: var(--sn-layout-preview-line-shadow);
      display: none;
    }

    &[type='split-h'] .preview-line,
    &[type='split-v'] .preview-line {
      display: block;
    }

    /* Hidden attribute overrides */
    .preview-overlay[hidden],
    .preview-line[hidden] {
      display: none !important;
    }
  }
`;
