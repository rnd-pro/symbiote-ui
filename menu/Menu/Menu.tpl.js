import { html } from '@symbiotejs/symbiote';

export let menuTemplate = html`
  <slot></slot>
`;

export let menuItemTemplate = html`
  <span class="sn-menu-item-icon material-symbols-outlined" ${{ textContent: 'icon', '@hidden': '!icon' }}></span>
  <span class="sn-menu-item-icon material-symbols-outlined" ${{ textContent: '"check"', '@hidden': '!checked' }}></span>
  <span class="sn-menu-item-icon" ${{ '@hidden': 'hasIconOrCheck' }}></span>
  <span class="sn-menu-item-label">
    <slot></slot>
  </span>
  <span class="sn-menu-item-shortcut" ${{ textContent: 'shortcut', '@hidden': '!shortcut' }}></span>
`;

export let menuSeparatorTemplate = html``;

export let menuGroupTemplate = html`
  <div class="sn-menu-group-label" ${{ textContent: 'label', '@hidden': '!label' }}></div>
  <slot></slot>
`;

export let dropdownTemplate = html`
  <div class="sn-dropdown-trigger" style="display: contents;" ${{ onclick: 'onTriggerClick' }}>
    <slot name="trigger"></slot>
  </div>
  <sn-popover style="display: contents;" class="sn-dropdown-popover" placement="bottom-start">
    <slot></slot>
  </sn-popover>
`;
