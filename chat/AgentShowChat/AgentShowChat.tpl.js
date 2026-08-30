import { html } from '@symbiotejs/symbiote';

export default html`
  <chat-workspace ref="workspace" sidebar="hidden"></chat-workspace>
  <section class="agent-show-player-region" ref="playerRegion" aria-label="Show player" ${{ '@hidden': '!showInlinePlayer' }}></section>
`;
