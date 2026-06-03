/**
 * ContextMenu template
 * @module symbiote-node/menu/ContextMenu.tpl
 */
import { html } from '@symbiotejs/symbiote';

export let template = html`
  <div class="sn-ctx-backdrop" ${{ onclick: 'onBackdropClick' }}></div>
  <div class="sn-ctx-menu">
    <div class="ctx-items" ${{ itemize: 'items', 'item-tag': 'ctx-item' }}></div>
  </div>
`;

export let ctxItemTemplate = html`
  <button class="sn-ctx-btn" ${{ onclick: 'onclick' }}>
    <span class="material-symbols-outlined sn-ctx-icon">{{icon}}</span>
    <span>{{label}}</span>
  </button>
`;
