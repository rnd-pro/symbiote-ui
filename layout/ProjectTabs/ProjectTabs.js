import Symbiote, { html } from '@symbiotejs/symbiote';
import css from './ProjectTabs.css.js';
import tpl from './ProjectTabs.tpl.js';
import { translate } from '../../locale/index.js';

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

export class ProjectTabs extends Symbiote {
  init$ = {
    activeId: null,
    homeId: null,
    isHomeActive: true,
    tabs: [],
    homeIcon: 'home',
    homeLabel: translate('tabs.home'),
    addTitle: translate('tabs.openProject'),
    onHomeClick: () => emit(this, 'project-tabs-home'),
    onAddClick: () => emit(this, 'project-tabs-add'),
  };

  renderCallback() {
    this.sub('activeId', (id) => this.setAttribute('active-id', id || ''));
  }

  setTabs(tabs = [], activeId = this.$.activeId, options = {}) {
    if (Object.hasOwn(options, 'homeId')) {
      this.$.homeId = options.homeId || null;
    }
    this.$.activeId = activeId || null;
    this.$.isHomeActive = !this.$.activeId || this.$.activeId === this.$.homeId;
    this.$.tabs = tabs.map((tab, index) => ({
      ...tab,
      id: tab.id,
      name: tab.name || tab.id,
      color: tab.color || tab.accent || `var(--sn-tab-accent-${index % 6})`,
      icon: tab.icon || 'folder',
      closeable: tab.closeable === true,
      disabled: Boolean(tab.disabled),
      isActive: tab.id === this.$.activeId,
    }));
  }
}

class ProjectTabItem extends Symbiote {
  init$ = {
    id: '',
    name: '',
    color: '',
    icon: 'folder',
    closeable: true,
    disabled: false,
    isActive: false,
    closeTitle: translate('tabs.close'),
    onClick: (e) => {
      if (e.target.closest('.tab-close')) return;
      if (this.$.disabled) return;
      emit(this, 'project-tabs-select', { id: this.$.id });
    },
    onCloseClick: (e) => {
      e.stopPropagation();
      if (this.$.disabled || !this.$.closeable) return;
      emit(this, 'project-tabs-close', { id: this.$.id });
    },
  };

  renderCallback() {
    this.sub('color', (color) => {
      if (color) this.style.setProperty('--tab-accent', color);
      else this.style.removeProperty('--tab-accent');
    });
    this.sub('isActive', (value) => this.toggleAttribute('active', value));
    this.sub('disabled', (value) => {
      this.toggleAttribute('disabled', value);
      this.setAttribute('aria-disabled', value ? 'true' : 'false');
    });
    this.onclick = this.$.onClick;
  }
}

ProjectTabItem.template = html`
  <span class="material-symbols-outlined" ${{ textContent: 'icon' }}></span>
  <span ${{ textContent: 'name' }}></span>
  <button class="tab-close" ${{ title: 'closeTitle', onclick: 'onCloseClick', '@hidden': '!closeable' }}>×</button>
`;

ProjectTabItem.reg('project-tab-item');

ProjectTabs.template = tpl;
ProjectTabs.rootStyles = css;
ProjectTabs.reg('project-tabs');
