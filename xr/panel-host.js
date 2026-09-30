import { createXRPanelContentViewport } from './layout-projection.js';
import { createXRPanelPointerTarget, resolveXRHitMap } from './pointer.js';
import { freezeSpatialValue } from './spatial-contract.js';

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

function resolveMountElement(panel, node, context) {
  let adopted = panel?.element;
  if (adopted && typeof adopted.dispatchEvent === 'function') return adopted;
  return createComponentElement(node, context, panel);
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

function createWheelDomEvent(context, scrollEvent, detail) {
  let EventCtor = context.globalThis?.WheelEvent;
  if (typeof EventCtor !== 'function') return null;
  return new EventCtor('wheel', {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: detail.contentPoint?.x ?? 0,
    clientY: detail.contentPoint?.y ?? 0,
    deltaX: detail.delta?.x ?? 0,
    deltaY: detail.delta?.y ?? 0,
    deltaMode: 0,
  });
}

const XR_EDITABLE_TAGS = new Set(['input', 'textarea', 'select']);
const XR_SCROLL_PHASES = ['begin', 'update', 'end', 'cancel'];
const XR_SCROLL_KINDS = ['wheel', 'drag'];

function isEditableElement(element) {
  let tagName = String(element?.tagName || '').toLowerCase();
  return XR_EDITABLE_TAGS.has(tagName)
    || element?.isContentEditable === true
    || element?.getAttribute?.('contenteditable') === 'true'
    || element?.getAttribute?.('contenteditable') === '';
}

function safeQuerySelector(element, selector) {
  if (!element || typeof element.querySelector !== 'function' || !selector) return null;
  try {
    return element.querySelector(selector) || null;
  } catch {
    return null;
  }
}

function resolveContentTarget(record, request = {}) {
  let element = record.element;
  if (request.element && typeof element.contains === 'function' && element.contains(request.element)) {
    return {
      target: request.element,
      targetId: request.element.getAttribute?.('data-xr-target-id') || request.element.id || null,
    };
  }
  if (typeof request.target === 'string' && request.target.trim()) {
    let target = safeQuerySelector(element, request.target.trim());
    return {
      target,
      targetId: target?.getAttribute?.('data-xr-target-id') || target?.id || null,
    };
  }
  if (request.targetId) {
    let targetId = String(request.targetId).replace(/"/g, '\\"');
    let target = safeQuerySelector(element, `[data-xr-target-id="${targetId}"]`)
      || safeQuerySelector(element, `[id="${targetId}"]`);
    return { target, targetId: String(request.targetId) };
  }
  return { target: null, targetId: null };
}

function detectFocused(context, target) {
  let documentRef = context.document;
  if (documentRef && 'activeElement' in documentRef) {
    return documentRef.activeElement === target;
  }
  return null;
}

function readScrollOffsets(target) {
  return {
    left: Number.isFinite(Number(target?.scrollLeft)) ? Number(target.scrollLeft) : 0,
    top: Number.isFinite(Number(target?.scrollTop)) ? Number(target.scrollTop) : 0,
  };
}

function applyScrollDelta(target, delta) {
  let before = readScrollOffsets(target);
  let deltaX = Number(delta?.x) || 0;
  let deltaY = Number(delta?.y) || 0;
  if (target && (deltaX !== 0 || deltaY !== 0)) {
    if (typeof target.scrollBy === 'function') {
      target.scrollBy({ left: deltaX, top: deltaY });
    } else {
      target.scrollLeft = Math.max(0, before.left + deltaX);
      target.scrollTop = Math.max(0, before.top + deltaY);
    }
  }
  let after = readScrollOffsets(target);
  return {
    before,
    after,
    applied: { x: after.left - before.left, y: after.top - before.top },
  };
}

function resolveScrollTarget(record, options = {}) {
  let element = record.element;
  let requested = options.scrollTarget;
  let target = null;
  if (requested && typeof requested === 'object' && typeof element.contains === 'function' && element.contains(requested)) {
    target = requested;
  } else if (typeof requested === 'string' && requested.trim()) {
    target = safeQuerySelector(element, requested.trim());
  }
  if (!target) target = safeQuerySelector(element, '[data-xr-scroll]');
  if (!target) target = element;
  let targetId = target.getAttribute?.('data-xr-target-id') || target.id || null;
  return {
    target,
    targetId: targetId || (target === element ? String(record.panel.id) : null),
  };
}

function clampNormalizedPoint(point) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  return {
    x: Math.min(Math.max(Number(point.x), 0), 1),
    y: Math.min(Math.max(Number(point.y), 0), 1),
  };
}

function roundScrollMetric(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function normalizeScrollDelta(delta, record) {
  if (!delta || typeof delta !== 'object') return null;
  let mode = delta.mode === 'normalized' || delta.mode === 'lines' ? delta.mode : 'content-pixels';
  let x = Number(delta.x) || 0;
  let y = Number(delta.y) || 0;
  if (mode === 'normalized') {
    x *= record.contentViewport.width;
    y *= record.contentViewport.height;
  } else if (mode === 'lines') {
    x *= 40;
    y *= 40;
  }
  return { x: roundScrollMetric(x), y: roundScrollMetric(y), mode };
}

function pointerCaptureKey(panelId, sourceId) {
  return `${panelId}:${sourceId || ''}`;
}

export function createXRPanelHost(options = {}) {
  let context = createContext(options);
  let panels = new Map();
  let scene = null;
  let themeSnapshot = options.themeSnapshot || null;
  let dispatchDepth = 0;
  let activeFocusPanelId = null;
  let pendingSelections = new Map();
  let activePointers = new Map();
  let activeScrolls = new Map();
  let contentFocuses = new Map();

  function getState() {
    return {
      scene,
      themeSnapshot,
      mounted: panels.size,
      panelIds: [...panels.keys()],
      activeFocusPanelId,
      pendingSelectionSourceIds: [...pendingSelections.keys()],
      activePointerSourceIds: [...activePointers.keys()],
      activeScrollSourceIds: [...activeScrolls.keys()],
      contentFocusPanelIds: [...contentFocuses.keys()],
    };
  }

  function setScene(nextScene, sceneOptions = {}) {
    scene = nextScene || null;
    themeSnapshot = sceneOptions.themeSnapshot || themeSnapshot || null;
    panels.clear();
    activeFocusPanelId = null;
    pendingSelections.clear();
    activePointers.clear();
    activeScrolls.clear();
    contentFocuses.clear();
    return getState();
  }

  function getPanelState(record) {
    return record.panel;
  }

  function mountPanel(panel, container) {
    if (!panel || !container?.replaceChildren) {
      throw new Error('mountPanel(panel, container) requires a panel and a DOM container.');
    }

    let node = panel.layoutNode || panel;
    let element = resolveMountElement(panel, node, context);
    element.dataset.xrPanelId = panel.id;
    element.classList.add('sn-xr-panel-live-root');
    let contentViewport = applyPanelViewport(element, panel);
    applyPanelViewport(container, { ...panel, contentViewport });
    if (element.parentNode !== container) container.replaceChildren(element);

    panels.set(panel.id, {
      panel,
      container,
      element,
      contentViewport,
      focused: panels.get(panel.id)?.focused === true,
    });
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
    for (let [sourceId, pending] of pendingSelections) {
      if (pending.panelId === panelId) pendingSelections.delete(sourceId);
    }
    for (let [key, capture] of activePointers) {
      if (capture.panelId === panelId) activePointers.delete(key);
    }
    for (let [key, capture] of activeScrolls) {
      if (capture.panelId === panelId) activeScrolls.delete(key);
    }
    contentFocuses.delete(panelId);
    if (activeFocusPanelId === panelId) {
      activeFocusPanelId = null;
    }
    return true;
  }

  function getPanelElement(panelId) {
    return panels.get(panelId)?.element || null;
  }

  function focusPanel(panelId) {
    let record = panels.get(panelId);
    if (!record) return false;

    if (activeFocusPanelId && activeFocusPanelId !== panelId) {
      let prevRecord = panels.get(activeFocusPanelId);
      if (prevRecord) {
        prevRecord.focused = false;
        prevRecord.element.classList.remove('sn-xr-panel-focused');
        prevRecord.container.classList.remove('sn-xr-panel-focused');
        prevRecord.element.dispatchEvent(createHostEvent(context, 'xr-panel-blur', {
          panelId: activeFocusPanelId,
        }));
      }
    }

    activeFocusPanelId = panelId;
    record.focused = true;
    record.element.classList.add('sn-xr-panel-focused');
    record.container.classList.add('sn-xr-panel-focused');

    record.element.dispatchEvent(createHostEvent(context, 'xr-panel-focus', {
      panelId,
    }));
    return true;
  }

  function cleanup() {
    for (let panelId of [...panels.keys()]) {
      unmountPanel(panelId);
    }
    panels.clear();
    activeFocusPanelId = null;
    pendingSelections.clear();
    activePointers.clear();
    activeScrolls.clear();
    contentFocuses.clear();
    scene = null;
  }

  function resolveInteraction(pointerEvent, record, options) {
    let hitMap = options.hitMap || record.panel.hitMap || null;
    let sourceId = pointerEvent.sourceId || null;
    let sessionId = pointerEvent.sessionId || options.sessionId || null;
    let frame = pointerEvent.frame || options.frame || null;
    if (!sourceId) return { ok: false, reason: 'missing-source-id', target: null, contentPoint: null };
    if (!sessionId) return { ok: false, reason: 'missing-session-id', target: null, contentPoint: null };
    return resolveXRHitMap(pointerEvent.point, hitMap, {
      panelId: record.panel.id,
      contentHash: options.contentHash || record.panel.contentHash,
      revision: options.revision ?? record.panel.revision,
      sessionId,
      frame,
      pointSpace: 'normalized',
      maximumFrameAge: options.maximumFrameAge,
      maximumAgeMs: options.maximumAgeMs,
    });
  }

  function beginSelection(pointerEvent, record, options) {
    let resolved = resolveInteraction(pointerEvent, record, options);
    if (!resolved.ok) return resolved;
    let receipt = freezeSpatialValue({
      sessionId: pointerEvent.sessionId || options.sessionId,
      sourceId: pointerEvent.sourceId,
      panelId: record.panel.id,
      targetId: resolved.target.id,
      action: resolved.target.action,
      contentHash: options.contentHash || record.panel.contentHash,
      revision: options.revision ?? record.panel.revision,
      startFrameId: (pointerEvent.frame || options.frame).id,
      startSequence: (pointerEvent.frame || options.frame).sequence,
      startTime: (pointerEvent.frame || options.frame).time,
    });
    pendingSelections.set(receipt.sourceId, receipt);
    return { ...resolved, receipt };
  }

  function endSelection(pointerEvent, record, options) {
    let sourceId = pointerEvent.sourceId || null;
    let pending = pendingSelections.get(sourceId);
    pendingSelections.delete(sourceId);
    if (!pending) return { ok: false, reason: 'selectstart-missing', target: null, contentPoint: null };
    let resolved = resolveInteraction(pointerEvent, record, options);
    if (!resolved.ok) return resolved;
    let frame = pointerEvent.frame || options.frame;
    let contentHash = options.contentHash || record.panel.contentHash;
    let revision = options.revision ?? record.panel.revision;
    let sessionId = pointerEvent.sessionId || options.sessionId;
    let duration = frame.time - pending.startTime;
    let maximumDurationMs = Number.isFinite(options.maximumInteractionDurationMs)
      ? options.maximumInteractionDurationMs
      : 1_000;
    if (
      pending.sessionId !== sessionId ||
      pending.sourceId !== sourceId ||
      pending.panelId !== record.panel.id ||
      pending.targetId !== resolved.target.id ||
      pending.contentHash !== contentHash ||
      pending.revision !== revision ||
      frame.sequence < pending.startSequence ||
      duration < 0 || duration > maximumDurationMs
    ) {
      return { ok: false, reason: 'selection-mismatch', target: null, contentPoint: resolved.contentPoint };
    }
    let receipt = freezeSpatialValue({
      ...pending,
      endFrameId: frame.id,
      endSequence: frame.sequence,
      endTime: frame.time,
      durationMs: duration,
    });
    record.element.dispatchEvent(createHostEvent(context, 'xr-panel-action', {
      panelId: record.panel.id,
      targetId: resolved.target.id,
      action: resolved.target.action,
      contentPoint: resolved.contentPoint,
      receipt,
    }));
    return { ...resolved, receipt };
  }

  function readPlatformSelection(record) {
    let documentRef = context.document;
    let getSelection = typeof documentRef?.getSelection === 'function'
      ? () => documentRef.getSelection()
      : typeof context.globalThis?.getSelection === 'function'
        ? () => context.globalThis.getSelection()
        : null;
    if (getSelection) {
      let selection = getSelection();
      if (selection) {
        let text = typeof selection.toString === 'function' ? String(selection) : String(selection.text || '');
        return {
          selection: {
            text,
            anchorOffset: Number.isFinite(Number(selection.anchorOffset)) ? Number(selection.anchorOffset) : null,
            focusOffset: Number.isFinite(Number(selection.focusOffset)) ? Number(selection.focusOffset) : null,
            rangeCount: Number.isFinite(Number(selection.rangeCount)) ? Number(selection.rangeCount) : (text ? 1 : 0),
          },
          reason: null,
        };
      }
    }
    let tracked = contentFocuses.get(record.panel.id)?.element || null;
    let activeElement = documentRef && 'activeElement' in documentRef ? documentRef.activeElement : null;
    let editable = tracked
      || (activeElement && typeof record.element.contains === 'function' && record.element.contains(activeElement) ? activeElement : null);
    if (
      editable &&
      Number.isFinite(Number(editable.selectionStart)) &&
      Number.isFinite(Number(editable.selectionEnd))
    ) {
      let value = typeof editable.value === 'string' ? editable.value : '';
      let start = Number(editable.selectionStart);
      let end = Number(editable.selectionEnd);
      return {
        selection: {
          text: value.slice(start, end),
          anchorOffset: start,
          focusOffset: end,
          rangeCount: start === end ? 0 : 1,
        },
        reason: null,
      };
    }
    return { selection: null, reason: 'selection-api-unavailable' };
  }

  function cancelActiveScroll(panelId, sourceId) {
    let key = pointerCaptureKey(panelId, sourceId);
    let capture = activeScrolls.get(key);
    if (!capture) return null;
    activeScrolls.delete(key);
    return {
      ok: true,
      panelId,
      phase: 'cancel',
      kind: capture.kind,
      point: capture.lastPoint,
      delta: null,
      capture: {
        sourceId: capture.sourceId,
        sessionId: capture.sessionId,
        pointerId: capture.pointerId,
      },
      scroll: {
        targetId: capture.targetId,
        before: capture.startOffsets,
        after: readScrollOffsets(capture.target),
        applied: { ...capture.totals },
      },
      totals: { ...capture.totals },
      cancelled: true,
    };
  }

  function dispatchScrollEvent(scrollEvent, options = {}) {
    if (!scrollEvent) return { ok: false, reason: 'missing-scroll-event' };
    let panelId = scrollEvent.targetId || scrollEvent.panelId;
    let record = panels.get(panelId);
    if (!record?.element) return { ok: false, reason: 'panel-not-mounted', panelId };
    let phase = XR_SCROLL_PHASES.includes(scrollEvent.phase) ? scrollEvent.phase : 'update';
    let kind = XR_SCROLL_KINDS.includes(scrollEvent.kind) ? scrollEvent.kind : 'wheel';
    let sourceId = scrollEvent.sourceId || null;
    if (!sourceId) return { ok: false, reason: 'missing-source-id', panelId };
    let key = pointerCaptureKey(panelId, sourceId);
    let capture = activeScrolls.get(key) || null;
    if (phase === 'begin' && capture) {
      return { ok: false, reason: 'scroll-already-active', panelId };
    }
    if (phase !== 'begin' && !capture) {
      return { ok: false, reason: 'scroll-not-active', panelId };
    }
    if (capture && scrollEvent.sessionId && capture.sessionId && scrollEvent.sessionId !== capture.sessionId) {
      return { ok: false, reason: 'scroll-capture-mismatch', panelId };
    }
    let point = clampNormalizedPoint(scrollEvent.point) || capture?.lastPoint || { x: 0.5, y: 0.5 };
    let resolvedTarget = capture ? { target: capture.target, targetId: capture.targetId } : resolveScrollTarget(record, options);

    let delta = null;
    if (phase === 'begin' || phase === 'update' || phase === 'end') {
      if (scrollEvent.delta) {
        delta = normalizeScrollDelta(scrollEvent.delta, record);
      } else if (capture?.lastPoint && scrollEvent.point && (phase === 'update' || phase === 'end')) {
        delta = {
          x: roundScrollMetric((capture.lastPoint.x - point.x) * record.contentViewport.width),
          y: roundScrollMetric((capture.lastPoint.y - point.y) * record.contentViewport.height),
          mode: 'content-pixels',
        };
      }
    }
    let gestureDelta = delta && (delta.x !== 0 || delta.y !== 0)
      ? delta
      : capture?.lastDelta || delta;

    let detail = {
      ...scrollEvent,
      targetId: panelId,
      contentPoint: {
        x: point.x * record.contentViewport.width,
        y: point.y * record.contentViewport.height,
      },
      delta,
      phase,
      kind,
    };
    let dispatched = ['xr-panel-scroll'];
    let domEvent = phase !== 'cancel' ? createWheelDomEvent(context, scrollEvent, detail) : null;
    let defaultPrevented = false;
    if (domEvent) {
      record.element.dispatchEvent(domEvent);
      dispatched.unshift(domEvent.type);
      defaultPrevented = domEvent.defaultPrevented === true;
    }

    let scroll = null;
    if (phase === 'cancel') {
      scroll = {
        before: capture.startOffsets,
        after: readScrollOffsets(capture.target),
        applied: { ...capture.totals },
      };
    } else if (delta && !defaultPrevented && (delta.x !== 0 || delta.y !== 0)) {
      scroll = applyScrollDelta(resolvedTarget.target, delta);
    } else {
      let offsets = readScrollOffsets(resolvedTarget.target);
      scroll = { before: offsets, after: { ...offsets }, applied: { x: 0, y: 0 } };
    }

    let totals = capture ? { ...capture.totals } : { x: 0, y: 0 };
    if (phase !== 'cancel') {
      totals.x = roundScrollMetric(totals.x + scroll.applied.x);
      totals.y = roundScrollMetric(totals.y + scroll.applied.y);
    }
    if (phase === 'end' && capture) {
      scroll = {
        before: capture.startOffsets,
        after: readScrollOffsets(capture.target),
        applied: { ...totals },
      };
    }
    if (phase === 'begin') {
      activeScrolls.set(key, {
        panelId,
        sourceId,
        sessionId: scrollEvent.sessionId || null,
        pointerId: scrollEvent.pointerId || sourceId,
        kind,
        target: resolvedTarget.target,
        targetId: resolvedTarget.targetId,
        startOffsets: { ...scroll.before },
        lastPoint: point,
        lastDelta: delta && (delta.x !== 0 || delta.y !== 0) ? delta : null,
        totals,
      });
    } else if (capture) {
      capture.lastPoint = point;
      capture.totals = totals;
      if (delta && (delta.x !== 0 || delta.y !== 0)) {
        capture.lastDelta = delta;
      }
    }
    if (phase === 'end' || phase === 'cancel') {
      activeScrolls.delete(key);
    }

    let result = {
      ok: true,
      panelId,
      phase,
      kind,
      point,
      delta: gestureDelta,
      capture: {
        sourceId,
        sessionId: capture?.sessionId || scrollEvent.sessionId || null,
        pointerId: capture?.pointerId || scrollEvent.pointerId || sourceId,
      },
      scroll: {
        targetId: resolvedTarget.targetId,
        ...scroll,
      },
      totals: phase === 'end' || phase === 'cancel' ? totals : null,
      defaultPrevented,
      dispatched,
    };
    record.element.dispatchEvent(createHostEvent(context, 'xr-panel-scroll', {
      panelId,
      phase,
      kind,
      scroll: result.scroll,
      capture: result.capture,
    }));
    return result;
  }

  function samplePreservationSnapshot(record) {
    let element = record.element;
    let editables = typeof element.querySelectorAll === 'function'
      ? [...element.querySelectorAll('input,textarea,select')]
      : [];
    let scrollStates = [];
    let visit = (node) => {
      if (!node || typeof node !== 'object') return;
      let top = Number(node.scrollTop) || 0;
      let left = Number(node.scrollLeft) || 0;
      if (top !== 0 || left !== 0) scrollStates.push(`${left},${top}`);
      for (let child of node.children || []) visit(child);
    };
    visit(element);
    let tracked = contentFocuses.get(record.panel.id)?.element || null;
    let documentRef = context.document;
    let activeElement = documentRef && 'activeElement' in documentRef ? documentRef.activeElement : null;
    let selectionData = readPlatformSelection(record);
    return {
      focus: tracked
        ? `tracked:${tracked.getAttribute?.('data-xr-target-id') || tracked.tagName}:${activeElement === tracked}`
        : activeElement && typeof element.contains === 'function' && element.contains(activeElement)
          ? `active:${activeElement.tagName}`
          : 'none',
      formValues: editables.map((editable) => String(editable?.value ?? '')).join(''),
      selection: JSON.stringify(selectionData.selection || null),
      scroll: scrollStates.join('|'),
    };
  }

  function updatePanelViewport(panelId, viewport, options = {}) {
    let record = panels.get(panelId);
    if (!record?.element) {
      return { ok: false, reason: 'panel-not-mounted', panelId };
    }
    let width = Math.round(Number(viewport?.width));
    let height = Math.round(Number(viewport?.height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return { ok: false, reason: 'invalid-viewport', panelId };
    }
    let nextViewport = { width, height };
    let previousViewport = {
      width: record.contentViewport.width,
      height: record.contentViewport.height,
    };
    let before = samplePreservationSnapshot(record);
    let panel = {
      ...record.panel,
      contentViewport: nextViewport,
      ...(options.sizeMeters ? { size: [...options.sizeMeters] } : {}),
    };
    applyPanelViewport(record.element, panel);
    applyPanelViewport(record.container, { ...panel, contentViewport: nextViewport });
    record.panel = panel;
    record.contentViewport = nextViewport;
    let paintRequested = typeof options.requestPaint === 'function'
      ? options.requestPaint(panelId) === true
      : false;
    let after = samplePreservationSnapshot(record);
    return {
      ok: true,
      panelId,
      viewport: nextViewport,
      previousViewport,
      preserved: {
        focus: before.focus === after.focus,
        formValues: before.formValues === after.formValues,
        selection: before.selection === after.selection,
        scroll: before.scroll === after.scroll,
      },
      remounted: false,
      paintRequested,
    };
  }

  function focusContent(panelId, request = {}) {
    let record = panels.get(panelId);
    if (!record?.element) {
      return { ok: false, reason: 'panel-not-mounted', panelId };
    }
    let { target, targetId } = resolveContentTarget(record, request);
    if (!target) {
      return {
        ok: false,
        reason: 'target-not-found',
        panelId,
        target: null,
        focused: null,
        ime: { mode: 'unavailable', reason: 'target-not-found', handoff: null },
      };
    }
    let editable = isEditableElement(target);
    let focusable = editable || typeof target.focus === 'function';
    for (let [otherPanelId, tracked] of [...contentFocuses.entries()]) {
      if (otherPanelId !== panelId || tracked.element !== target) {
        tracked.element?.blur?.();
        contentFocuses.delete(otherPanelId);
      }
    }
    let dispatchedFocus = false;
    if (typeof target.focus === 'function') {
      target.focus();
      dispatchedFocus = true;
    }
    let focused = detectFocused(context, target);
    let tagName = String(target.tagName || '').toLowerCase();
    let handoff = {
      targetId,
      editable,
      inputType: target.getAttribute?.('type') || tagName,
      multiline: tagName === 'textarea',
      hasValue: typeof target.value === 'string' ? target.value.length > 0 : false,
      valueLength: typeof target.value === 'string' ? target.value.length : 0,
    };
    let ime;
    if (!editable) {
      ime = { mode: 'dom-overlay', reason: 'target-not-editable', handoff };
    } else if (!dispatchedFocus) {
      ime = { mode: 'dom-overlay', reason: 'focus-unavailable', handoff };
    } else if (focused === false) {
      ime = { mode: 'dom-overlay', reason: 'focus-rejected', handoff };
    } else {
      ime = { mode: 'dom-focus', reason: focused === null ? 'focus-unverified' : null, handoff };
    }
    if (dispatchedFocus) {
      contentFocuses.set(panelId, {
        targetId,
        element: target,
        editable,
        sourceId: request.sourceId || null,
        sessionId: request.sessionId || null,
      });
    }
    record.element.dispatchEvent(createHostEvent(context, 'xr-panel-content-focus', {
      panelId,
      targetId,
      editable,
    }));
    return {
      ok: true,
      reason: null,
      panelId,
      target: { targetId, tagName, editable, focusable },
      focused,
      ime,
    };
  }

  function blurContent(panelId) {
    let record = panels.get(panelId);
    if (!record?.element) {
      return { ok: false, reason: 'panel-not-mounted', panelId };
    }
    let tracked = contentFocuses.get(panelId) || null;
    if (!tracked) {
      return { ok: true, reason: 'no-content-focus', panelId, target: null, focused: false, ime: null };
    }
    contentFocuses.delete(panelId);
    tracked.element?.blur?.();
    let focused = detectFocused(context, tracked.element);
    return {
      ok: true,
      reason: null,
      panelId,
      target: {
        targetId: tracked.targetId,
        tagName: String(tracked.element?.tagName || '').toLowerCase() || null,
        editable: tracked.editable,
        focusable: true,
      },
      focused: focused === true,
      ime: null,
    };
  }

  function cancelContentFocus(panelId, request = {}) {
    let blurResult = blurContent(panelId);
    if (blurResult.ok === false) return blurResult;
    let sourceId = request.sourceId || null;
    let selectionCancelled = false;
    if (sourceId && activePointers.delete(pointerCaptureKey(panelId, sourceId))) {
      selectionCancelled = true;
    }
    let scrollCancel = sourceId ? cancelActiveScroll(panelId, sourceId) : null;
    return {
      ...blurResult,
      reason: blurResult.reason === 'no-content-focus' && !selectionCancelled && !scrollCancel
        ? 'no-content-focus'
        : null,
      focused: false,
      releasedCapture: {
        selection: selectionCancelled,
        scroll: Boolean(scrollCancel),
      },
    };
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

    if (
      pointerEvent.type === 'pointerdown' ||
      pointerEvent.type === 'selectstart' ||
      pointerEvent.type === 'click' ||
      pointerEvent.buttons?.primary
    ) {
      focusPanel(panelId);
    }

    let currentPanel = getPanelState(record);
    let target = createXRPanelPointerTarget({
      panelId,
      point: pointerEvent.point,
      panel: currentPanel,
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

    let captureKey = pointerCaptureKey(panelId, pointerEvent.sourceId);
    let pointerCapture = null;
    if (pointerEvent.type === 'pointerdown' && pointerEvent.buttons?.primary && pointerEvent.sourceId) {
      pointerCapture = {
        panelId,
        sourceId: pointerEvent.sourceId,
        sessionId: pointerEvent.sessionId || options.sessionId || null,
        pointerId: pointerEvent.pointerId || pointerEvent.sourceId,
        startPoint: target.point,
        lastPoint: target.point,
      };
      activePointers.set(captureKey, pointerCapture);
      if (typeof record.element.setPointerCapture === 'function' && pointerCapture.pointerId != null) {
        try {
          record.element.setPointerCapture(pointerCapture.pointerId);
        } catch {
          // Capture refusal (inactive pointer) is platform data; provider tracking continues.
        }
      }
    } else if (pointerEvent.sourceId) {
      pointerCapture = activePointers.get(captureKey) || null;
    }
    if (pointerCapture && pointerEvent.type === 'pointermove') {
      pointerCapture.lastPoint = target.point;
    }

    let captureEvidence = null;
    if (pointerCapture) {
      let phase = pointerEvent.type === 'pointerdown'
        ? 'begin'
        : pointerEvent.type === 'pointermove'
          ? 'update'
          : pointerEvent.type === 'pointerup'
            ? 'end'
            : pointerEvent.type === 'pointercancel'
              ? 'cancel'
              : null;
      if (phase) {
        captureEvidence = {
          sourceId: pointerCapture.sourceId,
          sessionId: pointerCapture.sessionId,
          pointerId: pointerCapture.pointerId,
          phase,
        };
      }
    }

    let selectionEvidence = null;
    let scrollEvidence = null;
    if (pointerEvent.type === 'pointerup') {
      if (!pointerCapture) {
        selectionEvidence = {
          ok: false,
          reason: 'selection-not-active',
          phase: 'end',
          point: target.point,
          startPoint: null,
          capture: null,
          selection: null,
        };
      } else {
        activePointers.delete(captureKey);
        if (typeof record.element.releasePointerCapture === 'function' && pointerCapture.pointerId != null) {
          try {
            record.element.releasePointerCapture(pointerCapture.pointerId);
          } catch {
            // Release refusal mirrors platform capture state; receipt still reports the end phase.
          }
        }
        let selectionData = readPlatformSelection(record);
        selectionEvidence = {
          ok: true,
          reason: selectionData.reason,
          phase: 'end',
          point: target.point,
          startPoint: pointerCapture.startPoint,
          capture: {
            sourceId: pointerCapture.sourceId,
            sessionId: pointerCapture.sessionId,
            pointerId: pointerCapture.pointerId,
          },
          selection: selectionData.selection,
        };
      }
    } else if (pointerEvent.type === 'pointercancel') {
      if (pointerCapture) {
        activePointers.delete(captureKey);
        selectionEvidence = {
          ok: false,
          reason: 'selection-cancelled',
          phase: 'cancel',
          point: target.point,
          startPoint: pointerCapture.startPoint,
          capture: {
            sourceId: pointerCapture.sourceId,
            sessionId: pointerCapture.sessionId,
            pointerId: pointerCapture.pointerId,
          },
          selection: null,
        };
      }
      let scrollCancel = cancelActiveScroll(panelId, pointerEvent.sourceId);
      if (scrollCancel) scrollEvidence = scrollCancel;
    }

    let domEvent = createPointerDomEvent(context, detail, target);
    dispatchDepth += 1;
    try {
      if (domEvent) {
        domEvent.xrPanelPointer = detail;
        record.element.dispatchEvent(domEvent);
      }
      record.element.dispatchEvent(createHostEvent(context, 'xr-panel-pointer', detail));

      let interaction = null;
      if (pointerEvent.type === 'selectstart') interaction = beginSelection(pointerEvent, record, options);
      else if (pointerEvent.type === 'selectend') interaction = endSelection(pointerEvent, record, options);
      else if (pointerEvent.type === 'selectcancel' || pointerEvent.type === 'pointercancel') {
        pendingSelections.delete(pointerEvent.sourceId);
        interaction = { ok: false, reason: 'selection-cancelled', target: null, contentPoint: null };
      }
      detail.interaction = interaction;
    } finally {
      dispatchDepth -= 1;
    }

    if (selectionEvidence) {
      record.element.dispatchEvent(createHostEvent(context, 'xr-panel-selection', {
        panelId,
        phase: selectionEvidence.phase,
        capture: selectionEvidence.capture,
        selection: selectionEvidence.selection,
      }));
    }

    return {
      ok: true,
      panelId,
      target,
      dispatched: domEvent ? [detail.type, 'xr-panel-pointer'] : ['xr-panel-pointer'],
      interaction: detail.interaction || null,
      capture: captureEvidence,
      selection: selectionEvidence,
      scroll: scrollEvidence,
    };
  }

  return {
    setScene,
    mountPanel,
    unmountPanel,
    getPanelElement,
    dispatchPointerEvent,
    dispatchScrollEvent,
    focusContent,
    blurContent,
    cancelContentFocus,
    updatePanelViewport,
    focusPanel,
    cleanup,
    getState,
  };
}
