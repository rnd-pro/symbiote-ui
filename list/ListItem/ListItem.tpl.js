import { html } from '@symbiotejs/symbiote';

export default html`
<div
  class="sn-list-item"
  ref="item"
  role="button"
  tabindex="0"
  ${{ onclick: 'onSelect', onkeydown: 'onKeydown' }}
>
  <span class="sn-list-item-icon" ${{ textContent: 'icon', '@hidden': '!icon' }}></span>
  <span class="sn-list-item-body">
    <span class="sn-list-item-label" ${{ textContent: 'label' }}></span>
    <span class="sn-list-item-description" ${{ textContent: 'description', '@hidden': '!description' }}></span>
  </span>
  <span class="sn-list-item-meta" ${{ textContent: 'meta', '@hidden': '!meta' }}></span>
</div>
`;
