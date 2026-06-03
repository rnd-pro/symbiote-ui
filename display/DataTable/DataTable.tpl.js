import { html } from '@symbiotejs/symbiote';

export default html`
<section class="sn-data-table">
  <div class="sn-data-table-empty" ${{ textContent: 'emptyText', '@hidden': '!isEmpty' }}></div>
  <div class="sn-data-table-scroll" ${{ '@hidden': 'isEmpty' }}>
    <table>
      <thead ${{ innerHTML: 'headHtml' }}></thead>
      <tbody ${{ innerHTML: 'bodyHtml' }}></tbody>
    </table>
  </div>
</section>
`;
