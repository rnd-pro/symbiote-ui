import {
  closeUiPanel,
  openPanel,
  removeUiPanel,
} from '../layout/LayoutTree.js';

export const RUNTIME_UI_CONTRACT_VERSION = 'runtime-ui-v1';

export const RUNTIME_UI_CONTRACT = Object.freeze({
  version: RUNTIME_UI_CONTRACT_VERSION,
  ownership: 'host-owned state, persistence, routing, permissions, and transport',
  componentOwnership: 'symbiote-ui creates elements, applies presentation state, wires intent events, and tears down listeners',
  layoutActions: ['open-panel', 'close-ui-panel', 'remove-ui-panel'],
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRecord(value) {
  return isObject(value) ? { ...value } : {};
}

function normalizeChildren(children) {
  return Array.isArray(children)
    ? children.filter(isObject).map(normalizeRuntimeUiNode)
    : [];
}

export function normalizeRuntimeUiNode(node = {}) {
  let source = isObject(node) ? node : {};
  return {
    id: source.id || '',
    component: source.component || source.tagName || source.tag || '',
    componentRegistry: source.componentRegistry || '',
    props: normalizeRecord(source.props),
    attrs: normalizeRecord(source.attrs),
    state: normalizeRuntimeUiState(source.state),
    events: normalizeRecord(source.events),
    bindings: normalizeRecord(source.bindings),
    layout: normalizeRecord(source.layout),
    theme: isObject(source.theme) ? { ...source.theme } : undefined,
    children: normalizeChildren(source.children),
  };
}

export function normalizeRuntimeUiState(state = {}) {
  let source = isObject(state) ? state : {};
  return {
    props: normalizeRecord(source.props),
    attrs: normalizeRecord(source.attrs),
    methods: normalizeRecord(source.methods),
  };
}

function getDocument(options = {}) {
  let doc = options.document || globalThis.document;
  if (!doc?.createElement) {
    throw new Error('A DOM document with createElement() is required to create runtime UI elements.');
  }
  return doc;
}

function applyAttribute(element, name, value) {
  if (value === false || value === null || value === undefined) {
    element.removeAttribute?.(name);
    return;
  }
  element.setAttribute?.(name, value === true ? '' : String(value));
}

function methodAllowed(element, name, options = {}) {
  if (typeof options.allowMethod === 'function') {
    return Boolean(options.allowMethod(name, element));
  }
  if (Array.isArray(options.allowedMethods)) {
    return options.allowedMethods.includes(name);
  }
  return true;
}

export function applyRuntimeUiState(element, state = {}, options = {}) {
  if (!element) return element;
  let normalized = normalizeRuntimeUiState(state);
  for (let [name, value] of Object.entries(normalized.attrs)) {
    applyAttribute(element, name, value);
  }
  for (let [name, value] of Object.entries(normalized.props)) {
    element[name] = value;
  }
  for (let [name, value] of Object.entries(normalized.methods)) {
    if (typeof element[name] !== 'function') continue;
    if (!methodAllowed(element, name, options)) continue;
    let args = Array.isArray(value) ? value : [value];
    element[name](...args);
  }
  return element;
}

function applyRuntimeUiNodeState(element, node, options = {}) {
  applyRuntimeUiState(element, {
    attrs: node.attrs,
    props: node.props,
  });
  applyRuntimeUiState(element, node.state, options);
}

function appendChild(parent, child) {
  if (typeof parent.append === 'function') {
    parent.append(child);
  } else {
    parent.appendChild?.(child);
  }
}

function removeElement(element) {
  if (typeof element.remove === 'function') {
    element.remove();
  } else if (element.parentNode?.removeChild) {
    element.parentNode.removeChild(element);
  }
}

function wireIntentEvents(element, node, options = {}) {
  let subscriptions = [];
  let onIntent = typeof options.onIntent === 'function' ? options.onIntent : null;
  for (let [eventName, action] of Object.entries(node.events || {})) {
    if (!eventName || !action || !element.addEventListener) continue;
    let handler = (event) => {
      onIntent?.({
        version: RUNTIME_UI_CONTRACT_VERSION,
        action,
        eventName,
        component: node.component,
        componentId: node.id,
        detail: event?.detail,
        event,
        target: element,
      });
    };
    element.addEventListener(eventName, handler);
    subscriptions.push(() => element.removeEventListener?.(eventName, handler));
  }
  return () => {
    for (let unsubscribe of subscriptions.splice(0)) unsubscribe();
  };
}

export function createRuntimeUiInstance(node, options = {}) {
  let normalized = normalizeRuntimeUiNode(node);
  if (!normalized.component) {
    throw new Error('Runtime UI node requires a component tag name.');
  }

  let doc = getDocument(options);
  let element = doc.createElement(normalized.component);
  if (normalized.id) {
    element.dataset
      ? (element.dataset.runtimeUiId = normalized.id)
      : element.setAttribute?.('data-runtime-ui-id', normalized.id);
  }
  applyRuntimeUiNodeState(element, normalized, options);

  let childInstances = normalized.children.map((child) => {
    let instance = createRuntimeUiInstance(child, options);
    appendChild(element, instance.element);
    return instance;
  });
  let unsubscribe = wireIntentEvents(element, normalized, options);

  return {
    id: normalized.id,
    component: normalized.component,
    element,
    node: normalized,
    children: childInstances,
    update(nextState = {}) {
      applyRuntimeUiState(element, nextState, options);
      return element;
    },
    destroy({ remove = true } = {}) {
      unsubscribe();
      for (let child of childInstances.splice(0)) child.destroy({ remove });
      if (remove) removeElement(element);
    },
  };
}

export function createRuntimeUiController(options = {}) {
  let instances = new Map();
  let onIntent = typeof options.onIntent === 'function' ? options.onIntent : null;
  let indexInstance = (instance) => {
    if (instance.id) instances.set(instance.id, instance);
    for (let child of instance.children || []) indexInstance(child);
  };
  let collectInstanceTree = (instance, list = []) => {
    if (!instance) return list;
    list.push(instance);
    for (let child of instance.children || []) collectInstanceTree(child, list);
    return list;
  };
  let deleteInstanceTree = (tree) => {
    for (let instance of tree) {
      if (instance.id) instances.delete(instance.id);
    }
  };
  let destroyInstanceTree = (instance, destroyOptions) => {
    let tree = collectInstanceTree(instance);
    instance.destroy(destroyOptions);
    deleteInstanceTree(tree);
  };
  return {
    instances,
    create(node, createOptions = {}) {
      let instance = createRuntimeUiInstance(node, {
        ...options,
        ...createOptions,
        onIntent,
      });
      indexInstance(instance);
      return instance;
    },
    update(id, state = {}) {
      let instance = instances.get(id);
      if (!instance) return null;
      instance.update(state);
      return instance;
    },
    destroy(id, destroyOptions = {}) {
      let instance = instances.get(id);
      if (!instance) return false;
      destroyInstanceTree(instance, destroyOptions);
      return true;
    },
    clear(destroyOptions = {}) {
      for (let id of [...instances.keys()]) this.destroy(id, destroyOptions);
    },
  };
}

export function applyRuntimeLayoutAction(target, action = {}, options = {}) {
  let normalized = isObject(action) ? action : {};
  let type = normalized.type || normalized.action;
  let panelType = normalized.panelType || normalized.component || normalized.panel;
  if (!type || !panelType) {
    return { handled: false, reason: 'missing-action-or-panel-type' };
  }

  if (target && typeof target.openPanel === 'function') {
    if (type === 'open-panel') {
      return {
        handled: true,
        mode: 'element',
        panelId: target.openPanel(panelType, normalized.options || {}),
      };
    }
    if (type === 'close-ui-panel') {
      return { handled: true, mode: 'element', closed: target.closeUiPanel(panelType) };
    }
    if (type === 'remove-ui-panel') {
      return { handled: true, mode: 'element', removed: target.removeUiPanel(panelType) };
    }
  }

  let root = target || options.root || null;
  if (type === 'open-panel') {
    return { handled: true, mode: 'tree', ...openPanel(root, panelType, normalized.options || {}) };
  }
  if (type === 'close-ui-panel') {
    return { handled: true, mode: 'tree', ...closeUiPanel(root, panelType, normalized.options || {}) };
  }
  if (type === 'remove-ui-panel') {
    return { handled: true, mode: 'tree', ...removeUiPanel(root, panelType, normalized.options || {}) };
  }

  return { handled: false, reason: 'unsupported-action' };
}
