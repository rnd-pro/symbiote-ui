import { html } from '@symbiotejs/symbiote';

export default html`
<div class="sn-kanban-columns" ref="columns"></div>
<sn-empty-state class="sn-kanban-empty" ref="empty" hidden>{{emptyText}}</sn-empty-state>
`;
