import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import '../ProjectTabs/ProjectTabs.js';
import css from './LayoutShellMenu.css.js';
import tpl from './LayoutShellMenu.tpl.js';

const ICONS = ['add', 'folder_open', 'home', 'hub', 'keyboard_arrow_down', 'keyboard_arrow_up'];

function attr(el, name, fallback) {
  let value = el.getAttribute(name);
  return value === null || value === '' ? fallback : value;
}

function boolAttr(el, name) {
  let value = el.getAttribute(name);
  return value !== null && value !== 'false';
}

export class LayoutShellMenu extends Symbiote {
  init$ = {
    title: 'Agent Portal',
    titleIcon: 'hub',
    pathLabel: '',
    pathIcon: 'folder_open',
    menuTitle: 'Layout menu',
    menuIcon: 'keyboard_arrow_down',
    isMenuOpen: false,
    activeId: null,
    tabs: [],
    onMenuToggle: () => this.toggleMenu(),
  };

  constructor() {
    super();
    this.templateProcessors.add(slotProcessor);
  }

  initCallback() {
    this.$.title = attr(this, 'title', this.$.title);
    this.$.titleIcon = attr(this, 'title-icon', this.$.titleIcon);
    this.$.pathLabel = attr(this, 'path-label', attr(this, 'project-path', this.$.pathLabel));
    this.$.pathIcon = attr(this, 'path-icon', this.$.pathIcon);
    this.$.menuTitle = attr(this, 'menu-title', this.$.menuTitle);
    this.$.isMenuOpen = boolAttr(this, 'menu-open');
    ensureMaterialSymbols([this.$.titleIcon, this.$.pathIcon, this.$.menuIcon, ...ICONS]);
  }

  renderCallback() {
    this.sub('isMenuOpen', (isOpen) => {
      let open = Boolean(isOpen);
      this.toggleAttribute('menu-open', open);
      this.$.menuIcon = open ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
      if (this._menuStateInitialized) {
        this.dispatchEvent(new CustomEvent('layout-shell-menu-toggle', {
          bubbles: true,
          composed: true,
          detail: { open },
        }));
      }
      this._menuStateInitialized = true;
    });
    this.sub('tabs', () => this._syncTabs());
    this.sub('activeId', () => this._syncTabs());
  }

  toggleMenu(open = !this.$.isMenuOpen) {
    this.$.isMenuOpen = Boolean(open);
  }

  openMenu() {
    this.toggleMenu(true);
  }

  closeMenu() {
    this.toggleMenu(false);
  }

  setTabs(tabs = [], activeId = this.$.activeId) {
    this.$.activeId = activeId || null;
    this.$.tabs = Array.isArray(tabs) ? tabs : [];
    this._syncTabs();
  }

  _syncTabs() {
    this.ref.tabs?.setTabs?.(this.$.tabs, this.$.activeId);
  }
}

LayoutShellMenu.template = tpl;
LayoutShellMenu.rootStyles = css;
LayoutShellMenu.reg('layout-shell-menu');

export default LayoutShellMenu;
