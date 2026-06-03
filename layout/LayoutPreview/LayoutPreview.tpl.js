import { html } from '@symbiotejs/symbiote';

export let template = html`
  <div class="preview-overlay" ${{ '@style': 'overlayStyle', '@hidden': '!visible' }}></div>
  <div class="preview-line" ${{ '@style': 'lineStyle', '@hidden': '!visible' }}></div>
`;
