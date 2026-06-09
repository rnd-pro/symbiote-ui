import { html } from '@symbiotejs/symbiote';

export default html`
  <div class="sn-ctx-backdrop" ${{ onclick: 'onBackdropClick' }}></div>
  <div class="sn-ctx-menu" role="menu" ${{ onkeydown: 'onKeydown' }}>
    <div class="ctx-items" ${{ itemize: 'items', 'item-tag': 'ctx-item' }}></div>
  </div>
`;

export let ctxItemTemplate = html`
  <div class="sn-ctx-divider" ${{ '@hidden': '!divider' }}></div>
  <button class="sn-ctx-btn" ${{ onclick: 'onclick', '@hidden': 'divider' }}>
    <span class="material-symbols-outlined sn-ctx-icon" ${{ '@hidden': '!icon' }}>{{icon}}</span>
    <span class="material-symbols-outlined sn-ctx-check-mark" ${{ '@hidden': '!checked' }}>check</span>
    <span class="sn-ctx-label">{{label}}</span>
    <span class="sn-ctx-detail" ${{ '@hidden': '!detail' }}>{{detail}}</span>
  </button>
`;
