import { createXRPanelContentViewport } from './layout-projection.js';
import { createXRPanelPointerTarget } from './pointer.js';

function defaultComponentResolver(name) {
  return name;
}

function defaultPropsResolver(node = {}, panel = {}) {
  return {
    ...(panel.state || {}),
    ...(node.props || {}),
  };
}

function toKebabName(value) {
  return String(value || '').trim();
}

function applyAttributes(element, attrs = {}) {
  for (let [name, value] of Object.entries(attrs || {})) {
    if (value === false || value == null) continue;
    if (value === true) {
      element.setAttribute(name, '');
    } else {
      element.setAttribute(name, String(value));
    }
  }
}

function applyProps(element, props = {}) {
  for (let [name, value] of Object.entries(props || {})) {
    element[name] = value;
  }
}

function applyThemeScope(element, node = {}, panel = {}) {
  let scope = node.theme?.name || node.themeScope || panel.themeScope;
  if (scope) {
    element.dataset.themeScope = scope;
    element.setAttribute('data-theme-scope', scope);
  }
}

function setStyleProperty(element, name, value) {
  if (!element?.style) return;
  if (typeof element.style.setProperty === 'function') {
    element.style.setProperty(name, value);
    return;
  }
  element.style[name] = value;
}

function applyPanelViewport(element, panel) {
  let viewport = panel.contentViewport || createXRPanelContentViewport(panel);
  setStyleProperty(element, '--sn-xr-content-width', `${viewport.width}px`);
  setStyleProperty(element, '--sn-xr-content-height', `${viewport.height}px`);
  setStyleProperty(element, '--sn-xr-content-scale', String(viewport.scale));
  setStyleProperty(element, '--sn-xr-panel-meter-width', `${panel.size?.[0] || 0}m`);
  setStyleProperty(element, '--sn-xr-panel-meter-height', `${panel.size?.[1] || 0}m`);
  setStyleProperty(element, 'width', `${viewport.width}px`);
  setStyleProperty(element, 'height', `${viewport.height}px`);
  return viewport;
}

function appendChildren(host, node, context) {
  for (let child of node.children || []) {
    host.append(createComponentElement(child, context));
  }
}

function fallbackElement(documentRef, panel, reason) {
  let element = documentRef.createElement('section');
  element.className = 'sn-xr-panel-fallback';
  element.dataset.reason = reason;
  element.textContent = `XR panel fallback: ${reason}`;
  element.setAttribute('role', 'note');
  return element;
}

function resolveComponentTarget(node, panel, context) {
  let requested = node.component || panel.component || panel.panelType;
  let resolved = context.componentResolver(requested, node, panel);
  if (typeof resolved === 'string') {
    return { tagName: toKebabName(resolved), ComponentClass: null };
  }
  if (typeof resolved === 'function') {
    return { tagName: toKebabName(resolved.tagName || node.component || panel.component), ComponentClass: resolved };
  }
  if (resolved && typeof resolved === 'object') {
    return {
      tagName: toKebabName(resolved.tagName || resolved.name || node.component || panel.component),
      ComponentClass: typeof resolved.ComponentClass === 'function' ? resolved.ComponentClass : null,
    };
  }
  return { tagName: '', ComponentClass: null };
}

function createComponentElement(node, context, panel = node) {
  let documentRef = context.document;
  let target = resolveComponentTarget(node, panel, context);
  if (!target.tagName) {
    return fallbackElement(documentRef, panel, 'component-unresolved');
  }
  if (
    target.ComponentClass &&
    typeof context.customElements?.define === 'function' &&
    !context.customElements.get(target.tagName)
  ) {
    context.customElements.define(target.tagName, target.ComponentClass);
  }

  let element = documentRef.createElement(target.tagName);
  applyProps(element, context.propsResolver(node, panel));
  applyAttributes(element, node.attrs);
  applyThemeScope(element, node, panel);
  if (Array.isArray(node.children) && node.children.length) {
    appendChildren(element, node, context);
  }
  return element;
}

function createContext(options = {}) {
  let documentRef = options.document || globalThis.document;
  if (!documentRef?.createElement) {
    throw new Error('createXRPanelHost requires a document with createElement().');
  }
  return {
    document: documentRef,
    globalThis: options.globalThis || documentRef.defaultView || globalThis,
    customElements: options.customElements || documentRef.defaultView?.customElements || globalThis.customElements,
    componentResolver: options.componentResolver || defaultComponentResolver,
    propsResolver: options.propsResolver || defaultPropsResolver,
  };
}

function createHostEvent(context, type, detail) {
  let EventCtor = context.globalThis?.CustomEvent;
  if (typeof EventCtor === 'function') {
    return new EventCtor(type, { bubbles: true, composed: true, detail });
  }
  return {
    type,
    bubbles: true,
    composed: true,
    detail,
  };
}

function createPointerDomEvent(context, pointerEvent, target) {
  let EventCtor = context.globalThis?.PointerEvent;
  if (typeof EventCtor !== 'function') return null;
  return new EventCtor(pointerEvent.type || 'pointermove', {
    bubbles: false,
    composed: false,
    clientX: target.contentPoint.x,
    clientY: target.contentPoint.y,
    buttons: pointerEvent.buttons?.primary ? 1 : 0,
    button: pointerEvent.buttons?.primary ? 0 : -1,
    pointerType: pointerEvent.source === 'mouse-fallback' ? 'mouse' : 'xr',
    isPrimary: true,
  });
}

export function createXRPanelHost(options = {}) {
  let context = createContext(options);
  let panels = new Map();
  let scene = null;
  let themeSnapshot = options.themeSnapshot || null;
  let dispatchDepth = 0;

  function getState() {
    return {
      scene,
      themeSnapshot,
      mounted: panels.size,
      panelIds: [...panels.keys()],
    };
  }

  function setScene(nextScene, sceneOptions = {}) {
    scene = nextScene || null;
    themeSnapshot = sceneOptions.themeSnapshot || themeSnapshot || null;
    panels.clear();
    return getState();
  }

  function mountPanel(panel, container) {
    if (!panel || !container?.replaceChildren) {
      throw new Error('mountPanel(panel, container) requires a panel and a DOM container.');
    }

    let node = panel.layoutNode || panel;
    let element = createComponentElement(node, context, panel);
    element.dataset.xrPanelId = panel.id;
    element.classList.add('sn-xr-panel-live-root');
    let contentViewport = applyPanelViewport(element, panel);
    applyPanelViewport(container, { ...panel, contentViewport });
    container.replaceChildren(element);
    panels.set(panel.id, { panel, container, element, contentViewport });
    return element;
  }

  function unmountPanel(panelId) {
    let record = panels.get(panelId);
    if (!record) return false;
    if (record.element?._snObserver) {
      record.element._snObserver.disconnect();
      if (record.element._snDebounceTimeout) clearTimeout(record.element._snDebounceTimeout);
    }
    record.container.replaceChildren();
    panels.delete(panelId);
    return true;
  }

  function getPanelElement(panelId) {
    return panels.get(panelId)?.element || null;
  }

  function dispatchPointerEvent(pointerEvent, options = {}) {
    if (!pointerEvent) return { ok: false, reason: 'missing-pointer-event' };
    let panelId = pointerEvent.targetId || pointerEvent.panelId;
    if (dispatchDepth > 0) {
      return { ok: false, reason: 'pointer-dispatch-reentrant', panelId };
    }
    let record = panels.get(panelId);
    if (!record?.element?.dispatchEvent) {
      return { ok: false, reason: 'panel-not-mounted', panelId };
    }
    let target = createXRPanelPointerTarget({
      panelId,
      point: pointerEvent.point,
      panel: record.panel,
    }, {
      ...options,
      contentViewport: record.contentViewport,
      source: pointerEvent.source,
    });
    let detail = {
      ...pointerEvent,
      targetId: panelId,
      contentPoint: target.contentPoint,
      contentViewport: target.contentViewport,
    };
    let domEvent = createPointerDomEvent(context, detail, target);
    dispatchDepth += 1;
    try {
      if (domEvent) {
        domEvent.xrPanelPointer = detail;
        record.element.dispatchEvent(domEvent);
      }
      record.element.dispatchEvent(createHostEvent(context, 'xr-panel-pointer', detail));
    } finally {
      dispatchDepth -= 1;
    }
    return {
      ok: true,
      panelId,
      target,
      dispatched: domEvent ? [detail.type, 'xr-panel-pointer'] : ['xr-panel-pointer'],
    };
  }

  return {
    setScene,
    mountPanel,
    unmountPanel,
    getPanelElement,
    dispatchPointerEvent,
    getState,
  };
}
