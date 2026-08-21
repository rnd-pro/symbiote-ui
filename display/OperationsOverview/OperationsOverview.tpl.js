import { html } from '@symbiotejs/symbiote';

export default html`
<section class="sn-operations-overview" aria-labelledby="sn-operations-overview-title">
  <header class="sn-operations-overview-header">
    <div class="sn-operations-overview-heading">
      <span class="sn-operations-overview-eyebrow" ref="eyebrow"></span>
      <h2 id="sn-operations-overview-title" ref="title"></h2>
      <p ref="summary"></p>
    </div>
    <span class="sn-operations-overview-updated" ref="updated"></span>
  </header>
  <div class="sn-operations-overview-metrics" ref="metrics"></div>
  <div class="sn-operations-overview-charts" ref="charts"></div>
</section>
`;
