import { html } from '@symbiotejs/symbiote';

export default html`
<div class="chat-list-shell chat-list">
  <div class="chat-list-header">
    <span class="material-symbols-outlined chat-list-icon">forum</span>
    <span class="chat-list-title" ${{ textContent: 'title' }}></span>
    <sn-button class="chat-list-new-btn" ${{ onclick: 'onNewChat' }}>
      <span class="material-symbols-outlined chat-list-new-btn-icon">add</span>
      <span ${{ textContent: 'newLabel' }}></span>
    </sn-button>
  </div>
  <div class="chat-list-filter-bar">
    <sn-button class="chat-list-filter-btn" active data-filter="all" ${{ onclick: 'onFilterClick', textContent: 'filterAllLabel' }}></sn-button>
    <sn-button class="chat-list-filter-btn" data-filter="project" ${{ onclick: 'onFilterClick', textContent: 'filterProjectLabel' }}></sn-button>
    <sn-button class="chat-list-filter-btn" data-filter="active" ${{ onclick: 'onFilterClick', textContent: 'filterActiveLabel' }}></sn-button>
  </div>
  <div class="chat-list-content chat-list-items" ref="items" ${{ itemize: 'chatItems', 'item-tag': 'chat-list-item' }}></div>
</div>
`;
