import { html } from '@symbiotejs/symbiote';

export let accordionTemplate = html`
  <slot></slot>
`;

export let accordionItemTemplate = html`
  <details class="sn-accordion-details" ${{ '@open': 'open', ontoggle: 'onDetailsToggle' }}>
    <summary class="sn-accordion-summary">
      <span class="sn-accordion-header-text" ${{ textContent: 'header' }}></span>
      <span class="sn-accordion-icon material-symbols-outlined">chevron_right</span>
    </summary>
    <div class="sn-accordion-content">
      <slot></slot>
    </div>
  </details>
`;
