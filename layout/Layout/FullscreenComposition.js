function structuralParent(layout) {
  let panel = null;
  for (let ancestor = layout.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.matches?.('layout-node[node-type="panel"]')) {
      panel = ancestor;
      break;
    }
    // An intervening layout owns its own composition boundary. A parent scope
    // must join the panel that structurally hosts it, never an outer layout.
    if (ancestor.matches?.('panel-layout')) return { panel: null, owner: null };
  }
  let owner = panel?.closest('panel-layout');
  return { panel, owner };
}

function collectLayouts(layout, layouts, entries) {
  layouts.push(layout);
  for (let panel of layout._ownedPanelNodes()) {
    let children = panel.hasAttribute('fullscreen-container')
      ? [...panel.querySelectorAll('panel-layout[fullscreen-scope="parent"]')]
        .filter((child) => {
          let parent = structuralParent(child);
          return parent.panel === panel && parent.owner === layout;
        })
      : [];
    if (children.length) {
      children.forEach((child) => collectLayouts(child, layouts, entries));
    } else if (panel.$.nodeData?.panelState?.closed !== true) {
      entries.push({ owner: layout, node: panel, key: `composition:${entries.length}` });
    }
  }
}

function visible(element) {
  return element?.isConnected && element.getClientRects().length > 0
    && !element.closest('[inert]');
}

export default class FullscreenComposition {
  static resolveRoot(layout) {
    let current = layout;
    while (current.getAttribute('fullscreen-scope') === 'parent') {
      let { panel, owner } = structuralParent(current);
      if (!panel?.hasAttribute('fullscreen-container') || !owner) return null;
      current = owner;
    }
    return current.getAttribute('fullscreen-scope') === 'composition' ? current : null;
  }

  #attributes = new Map();
  #styles = new Map();
  #properties = new Map();
  #observer;
  #opener;
  #closed = false;

  constructor(root) {
    this.root = root;
    this.layouts = [];
    this.entries = [];
    collectLayouts(root, this.layouts, this.entries);
    this.#opener = root.ownerDocument.activeElement;
    for (let layout of this.layouts) {
      layout._exitLocalFullscreen();
      layout._fullscreenComposition = this;
      layout._clearDrawerProjection();
      layout._syncFullscreenBounds();
    }
    this.#observer = new MutationObserver((records) => {
      if (this.#closed) return;
      let changed = records.some((record) => {
        if (record.type === 'attributes') {
          let target = record.target;
          return this.layouts.includes(target)
            || (target.localName === 'layout-node'
              && this.layouts.includes(target.closest('panel-layout')))
            || (target.localName === 'panel-layout'
              && FullscreenComposition.resolveRoot(target) === root);
        }
        return [...record.addedNodes, ...record.removedNodes].some((node) => {
          if (node.nodeType !== 1) return false;
          if (this.layouts.some((layout) => node === layout || node.contains(layout))) return true;
          if (this.entries.some((entry) => node === entry.node || node.contains(entry.node))) return true;
          let candidates = node.matches('panel-layout[fullscreen-scope="parent"]') ? [node] : [];
          candidates.push(...node.querySelectorAll('panel-layout[fullscreen-scope="parent"]'));
          return candidates.some((layout) => FullscreenComposition.resolveRoot(layout) === root);
        });
      });
      if (changed) this.exit();
    });
    this.#observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['fullscreen-scope', 'fullscreen-container'],
    });
  }

  matches(owner, node) {
    return this.active?.owner === owner && this.active?.node === node;
  }

  selectTab(key) {
    let entry = this.entries.find((item) => item.key === key);
    return entry ? this.select(entry.owner, entry.node) : false;
  }

  select(owner, node) {
    if (this.#closed) return false;
    let entry = this.entries.find((item) => item.owner === owner && item.node === node);
    if (!entry) return false;
    this.#restoreOverrides();
    this.active = entry;
    this.#attribute(this.root, 'fullscreen-composition-active', '');
    for (let layout of this.layouts) {
      for (let panel of layout._ownedPanelNodes()) {
        this.#style(panel, 'display', panel === node || panel.contains(node) ? '' : 'none');
      }
    }
    for (let ancestor = node.parentElement; ancestor && ancestor !== this.root;
      ancestor = ancestor.parentElement) {
      this.#attribute(ancestor, 'fullscreen-ancestor', '');
    }
    this.#attribute(node, 'collapsed', null);
    this.#attribute(node, 'collapse-dir', null);
    this.#attribute(node, 'auto-collapsed', null);
    this.#attribute(node, 'fullscreen', '');
    this.#property(node.$, 'isCollapsed', false);
    this.#property(node.$, 'isFullscreen', true);
    this.#property(node.$, 'fullscreenIcon', 'fullscreen_exit');
    this.root.$.tabItems = this.entries.map((item) => {
      let type = item.node.$.nodeData.panelType;
      let config = item.owner.$.panelTypes[type] || {};
      return {
        panelId: item.key,
        icon: config.icon || 'dashboard',
        title: config.title || type,
        isActive: item === entry,
      };
    });
    this.root.$.hasFullscreenTabs = true;
    queueMicrotask(() => {
      if (this.#closed || this.active !== entry) return;
      this.root.querySelector('.fullscreen-tab[active]')
        ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      let focused = this.root.ownerDocument.activeElement;
      if (!visible(focused)) node.querySelector('.fullscreen-btn')?.focus({ preventScroll: true });
    });
    return true;
  }

  exit() {
    if (this.#closed) return;
    this.#closed = true;
    this.#observer?.disconnect();
    this.#restoreOverrides();
    this.root.$.hasFullscreenTabs = false;
    this.root.$.tabItems = [];
    for (let layout of this.layouts) {
      if (layout._fullscreenComposition === this) layout._fullscreenComposition = null;
      layout._syncFullscreenBounds();
      if (layout.isConnected) layout._scheduleResponsiveLayout();
    }
    requestAnimationFrame(() => {
      if (this.root._fullscreenComposition) return;
      let focused = this.root.ownerDocument.activeElement;
      if (visible(focused) && focused !== this.root.ownerDocument.body
        && !this.root.contains(focused) && focused !== this.#opener) return;
      let target = visible(this.#opener) ? this.#opener
        : [...this.root.querySelectorAll('button')].find(visible);
      target?.focus({ preventScroll: true });
    });
  }

  #attribute(element, name, value) {
    let fields = this.#attributes.get(element);
    if (!fields) this.#attributes.set(element, fields = new Map());
    let state = fields.get(name) || { before: element.getAttribute(name) };
    state.after = value;
    fields.set(name, state);
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  #style(element, name, value) {
    let fields = this.#styles.get(element);
    if (!fields) this.#styles.set(element, fields = new Map());
    let state = fields.get(name) || {
      before: element.style.getPropertyValue(name),
      priority: element.style.getPropertyPriority(name),
    };
    state.after = value;
    fields.set(name, state);
    element.style.setProperty(name, value);
  }

  #property(object, name, value) {
    let fields = this.#properties.get(object);
    if (!fields) this.#properties.set(object, fields = new Map());
    let state = fields.get(name) || { before: object[name] };
    state.after = value;
    fields.set(name, state);
    object[name] = value;
  }

  #restoreOverrides() {
    for (let [element, fields] of this.#attributes) {
      for (let [name, state] of fields) {
        if (element.getAttribute(name) !== state.after) continue;
        if (state.before === null) element.removeAttribute(name);
        else element.setAttribute(name, state.before);
      }
    }
    for (let [element, fields] of this.#styles) {
      for (let [name, state] of fields) {
        if (element.style.getPropertyValue(name) === state.after
          && !element.style.getPropertyPriority(name)) {
          element.style.setProperty(name, state.before, state.priority);
        }
      }
    }
    for (let [object, fields] of this.#properties) {
      for (let [name, state] of fields) {
        if (object[name] === state.after) object[name] = state.before;
      }
    }
    this.#attributes.clear();
    this.#styles.clear();
    this.#properties.clear();
  }
}
