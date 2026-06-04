import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import '../ProjectTabs/ProjectTabs.js';
import css from './LayoutShellMenu.css.js';
import tpl from './LayoutShellMenu.tpl.js';

const ICONS = ['add', 'folder_open', 'home', 'hub'];

function attr(el, name, fallback) {
  let value = el.getAttribute(name);
  return value === null || value === '' ? fallback : value;
}

export class LayoutShellMenu extends Symbiote {
  init$ = {
    title: 'Agent Portal',
    titleIcon: 'hub',
    pathLabel: '',
    pathIcon: 'folder_open',
    activeId: null,
    tabs: [],
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
    ensureMaterialSymbols([this.$.titleIcon, this.$.pathIcon, ...ICONS]);
  }

  renderCallback() {
    this.sub('tabs', () => this._syncTabs());
    this.sub('activeId', () => this._syncTabs());
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
