import { html } from '@symbiotejs/symbiote';

export default html`
  <panel-layout ref="layout" edge-collapse responsive-mode="drawer" swipe-control="rail"></panel-layout>
  <section class="agent-dock-source" ref="source" hidden aria-hidden="true">
    <slot name="main"></slot>
  </section>
`;
