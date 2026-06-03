import { html } from '@symbiotejs/symbiote';

export default html`
<div class="tab-bar">
  <button class="tab" ${{ '@active': '!activeId', onclick: 'onHomeClick' }}>
    <span class="material-symbols-outlined" ${{ textContent: 'homeIcon' }}></span>
    <span ${{ textContent: 'homeLabel' }}></span>
  </button>
  <div class="tab-items" itemize="tabs" item-tag="project-tab-item"></div>
  <button class="tab-add" ${{ title: 'addTitle', onclick: 'onAddClick' }}>
    <span class="material-symbols-outlined">add</span>
  </button>
  <div class="tab-filler"></div>
</div>
`;
