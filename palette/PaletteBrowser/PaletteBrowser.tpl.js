/**
 * PaletteBrowser template
 * @module symbiote-node/palette/PaletteBrowser.tpl
 */
import { html } from '@symbiotejs/symbiote';

export let template = html`
  <div class="pal-header">
    <span class="material-symbols-outlined">widgets</span>
    <span ${{ textContent: 'title' }}></span>
  </div>
  <div class="pal-search">
    <input
      ref="palSearch"
      type="text"
      ${{ placeholder: 'searchPlaceholder', oninput: 'onSearchInput' }}
    />
  </div>
  <div
    class="pal-list"
    ${{ itemize: 'categories', 'item-tag': 'pal-category', onclick: 'onItemClick' }}
  ></div>
`;
