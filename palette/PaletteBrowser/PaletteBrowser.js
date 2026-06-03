/**
 * PaletteBrowser — Component library browser panel
 *
 * Displays categorized node types that can be dragged onto the canvas.
 * Similar to TouchDesigner's Component Palette concept.
 * Shows grouped node templates with icons, descriptions, and drag support.
 *
 * @module symbiote-node/palette/PaletteBrowser
 */

import Symbiote, { html } from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { template } from './PaletteBrowser.tpl.js';
import { styles } from './PaletteBrowser.css.js';
import { translate } from '../../locale/index.js';

class PalItem extends Symbiote {
  init$ = {
    name: '',
    icon: 'radio_button_checked',
    desc: '',
    type: '',
    color: '',
    category: '',
    isHeader: false,
  };

  renderCallback() {
    ensureMaterialSymbols([this.$.icon]);
    this.sub('icon', (icon) => ensureMaterialSymbols([icon]));
  }
}

PalItem.template = html`
  <span class="pal-item-icon material-symbols-outlined" ${{ textContent: 'icon' }}></span>
  <span class="pal-item-label" ${{ textContent: 'name' }}></span>
  <span class="pal-item-desc" ${{ textContent: 'desc' }}></span>
`;

PalItem.reg('pal-item');

class PalCategory extends Symbiote {
  init$ = {
    category: '',
    catItems: [],
  };

  onToggle() {
    this.toggleAttribute('data-collapsed');
  }

  renderCallback() {
    ensureMaterialSymbols(['expand_more']);
  }
}

PalCategory.template = html`
  <div class="pal-cat-header" ${{ onclick: 'onToggle' }}>
    <span class="material-symbols-outlined">expand_more</span>
    <span ${{ textContent: 'category' }}></span>
  </div>
  <div class="pal-cat-items" ${{ itemize: 'catItems', 'item-tag': 'pal-item' }}></div>
`;

PalCategory.reg('pal-category');

export class PaletteBrowser extends Symbiote {
  init$ = {
    categories: [],
    title: translate('palette.title'),
    searchPlaceholder: translate('palette.searchPlaceholder'),
  };

  /** @type {Array<{ category: string, color: string, items: Array<{ name: string, icon: string, type: string, desc: string, factory: function }> }>} */
  #rawCategories = [];

  /** @type {function|null} */
  #onSelect = null;

  /** @type {Map<string, function>} */
  #factoryMap = new Map();

  renderCallback() {
    ensureMaterialSymbols(['widgets']);
  }

  /**
   * Register palette categories and items
   * @param {Array<{ category: string, color: string, items: Array<{ name: string, icon: string, type: string, desc: string, factory: function }> }>} categories
   */
  setCategories(categories) {
    this.#rawCategories = categories;
    this.#syncList();
  }

  /**
   * Set callback for item selection
   * @param {function} callback - (factory, name) => void
   */
  onSelect(callback) {
    this.#onSelect = callback;
  }

  #syncList(filter = '') {
    let lowerFilter = filter.toLowerCase();
    this.#factoryMap.clear();
    ensureMaterialSymbols(this.#rawCategories.flatMap((cat) => cat.items.map((it) => it.icon)));

    this.$.categories = this.#rawCategories
      .map((cat) => {
        let filtered = lowerFilter
          ? cat.items.filter(
              (it) =>
                it.name.toLowerCase().includes(lowerFilter) ||
                it.desc.toLowerCase().includes(lowerFilter)
            )
          : cat.items;

        if (filtered.length === 0) return null;

        let catItems = filtered.map((it) => {
          this.#factoryMap.set(it.name, it.factory);
          return {
            name: it.name,
            icon: it.icon,
            desc: it.desc,
            type: it.type,
            color: cat.color,
          };
        });

        return { category: cat.category, catItems };
      })
      .filter(Boolean);
  }

  onSearchInput(e) {
    this.#syncList(e.target.value);
  }

  onItemClick(e) {
    let item = e.target.closest('pal-item');
    if (!item) return;
    let name = item.$.name;
    let factory = this.#factoryMap.get(name);
    if (this.#onSelect && factory) this.#onSelect(factory, name);
  }
}

PaletteBrowser.template = template;
PaletteBrowser.rootStyles = styles;
PaletteBrowser.reg('palette-browser');
