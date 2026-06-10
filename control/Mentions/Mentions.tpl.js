import { html } from '@symbiotejs/symbiote';

export default html`
  <div class="sn-mentions-container">
    <slot ref="inputSlot"></slot>
    <div ref="dropdown" class="sn-mentions-dropdown" role="listbox" tabindex="-1">
      <ul ref="optionsList" class="sn-mentions-list"></ul>
    </div>
  </div>
`;
