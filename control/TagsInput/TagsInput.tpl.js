import { html } from '@symbiotejs/symbiote';

export default html`
  <div class="sn-tags-container" ref="container">
    <ul class="sn-tags-list" ref="tagsList"></ul>
    <input type="text" ref="input" class="sn-tags-input-field" placeholder="{{placeholder}}">
  </div>
`;
