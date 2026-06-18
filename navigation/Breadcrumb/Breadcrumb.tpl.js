import { html } from '@symbiotejs/symbiote';

export let breadcrumbTemplate = html`
  <slot></slot>
`;

export let breadcrumbItemTemplate = html`
  <span class="bc-sep" ${{ '@hidden': 'isFirst' }}>&rsaquo;</span>
  <span class="bc-label" ${{ onclick: '^onItemClick' }}>
    <span class="material-symbols-outlined" ${{ textContent: 'icon', '@hidden': '!icon' }}></span>
    <span ${{ textContent: 'label' }}></span>
  </span>
`;
