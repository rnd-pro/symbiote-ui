/**
 * @file xr/dom-raster-frame.js
 * @description Browser-side preparation of one rendered DOM layout for an
 * isolated raster capture worker. The worker receives a static, cascade-aware
 * document and returns one image; this module never creates a texture or a
 * renderer loop.
 * @module symbiote-ui/xr/dom-raster-frame
 */

import { DOM_RASTER_INACTIVE_ATTRIBUTE } from './dom-raster-source-deck.js';

export const DOM_RASTER_FRAME_VERSION = 'dom-raster-frame-v1';

const ROUNDING_PRECISION = 1_000_000;
const FRAME_SETTLE_FALLBACK_MS = 50;
let rasterCaptureAttempt = 0;

function roundMetric(value) {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

function requireElement(value, name) {
  if (!value?.ownerDocument || typeof value.cloneNode !== 'function' || value.isConnected === false) {
    throw new Error(`${name} requires a connected DOM element.`);
  }
  return value;
}

function abortError(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  return new DOMException('DOM raster capture aborted.', 'AbortError');
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError(signal);
}

function raceAbort(promise, signal) {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let abort = () => reject(abortError(signal));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

function combinedSignal(...signals) {
  let active = signals.filter(Boolean);
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];
  if (typeof globalThis.AbortSignal?.any === 'function') return globalThis.AbortSignal.any(active);
  let controller = new AbortController();
  for (let signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

/**
 * Normalizes the CSS viewport owned by an isolated raster frame.
 *
 * @param {Array<number>} value
 * @returns {Array<number>}
 */
export function normalizeDomRasterFrameSize(value) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`normalizeDomRasterFrameSize requires [width, height], got ${JSON.stringify(value)}.`);
  }
  let size = value.map(Number);
  if (!size.every((entry) => Number.isFinite(entry) && entry > 0)) {
    throw new Error(`normalizeDomRasterFrameSize requires positive finite dimensions, got ${JSON.stringify(value)}.`);
  }
  return size.map(roundMetric);
}

function nextFrame(win, signal) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    let frameHandle = null;
    let timerHandle = null;
    let setTimer = typeof win?.setTimeout === 'function'
      ? win.setTimeout.bind(win)
      : globalThis.setTimeout.bind(globalThis);
    let clearTimer = typeof win?.clearTimeout === 'function'
      ? win.clearTimeout.bind(win)
      : globalThis.clearTimeout.bind(globalThis);
    let cleanup = () => {
      if (timerHandle !== null) {
        clearTimer(timerHandle);
        timerHandle = null;
      }
      if (frameHandle !== null && typeof win?.cancelAnimationFrame === 'function') {
        win.cancelAnimationFrame(frameHandle);
        frameHandle = null;
      }
      signal?.removeEventListener?.('abort', abort);
    };
    let finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    let complete = () => finish(resolve);
    let abort = () => finish(reject, abortError(signal));
    signal?.addEventListener?.('abort', abort, { once: true });
    timerHandle = setTimer(complete, FRAME_SETTLE_FALLBACK_MS);
    if (typeof win?.requestAnimationFrame === 'function') {
      frameHandle = win.requestAnimationFrame(complete);
      if (settled && frameHandle !== null && typeof win.cancelAnimationFrame === 'function') {
        win.cancelAnimationFrame(frameHandle);
        frameHandle = null;
      }
    } else {
      queueMicrotask(complete);
    }
    if (signal?.aborted) abort();
  });
}

async function settleImage(image, signal) {
  let sourceAttribute = image?.getAttribute?.('src');
  if (!String(sourceAttribute ?? '').trim()) return;
  if (!image.complete) {
    await raceAbort(new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', () => reject(new Error(`DOM raster image failed to load: ${image.currentSrc || image.src || 'unknown source'}.`)), { once: true });
    }), signal);
  }
  if (typeof image.decode === 'function') {
    await raceAbort(image.decode(), signal);
  }
  if (!(Number(image.naturalWidth) > 0) || !(Number(image.naturalHeight) > 0)) {
    throw new Error(`DOM raster image has no decoded pixels: ${image.currentSrc || image.src || 'unknown source'}.`);
  }
}

function rasterImages(root) {
  let images = new Set();
  let visit = (node) => {
    if (!node) return;
    if (node.matches?.('img[src]')) images.add(node);
    for (let image of node.querySelectorAll?.('img[src]') || []) images.add(image);
    for (let element of node.querySelectorAll?.('*') || []) {
      if (element.shadowRoot) visit(element.shadowRoot);
    }
    if (node.shadowRoot) visit(node.shadowRoot);
  };
  visit(root);
  return [...images];
}

async function settleDocument(doc, signal, root = doc) {
  throwIfAborted(signal);
  await raceAbort(doc.fonts?.ready || Promise.resolve(), signal);
  await Promise.all(rasterImages(root).map((image) => settleImage(image, signal)));
  await nextFrame(doc.defaultView, signal);
  await nextFrame(doc.defaultView, signal);
  throwIfAborted(signal);
}

const EXECUTABLE_TAGS = new Set(['script', 'iframe', 'object', 'embed']);

function copySafeAttributes(source, target) {
  let isImage = String(source.localName || source.tagName || '').toLowerCase() === 'img';
  for (let attribute of source.attributes || []) {
    if (/^on/i.test(attribute.name)) continue;
    if (attribute.name === DOM_RASTER_INACTIVE_ATTRIBUTE) continue;
    if (isImage
      && String(attribute.name).toLowerCase() === 'src'
      && !String(attribute.value).trim()) continue;
    target.setAttribute(attribute.name, attribute.value);
  }
}

function synchronizeFormControl(source, target) {
  let tag = String(source.tagName || '').toLowerCase();
  if (tag === 'textarea') {
    target.textContent = String(source.value ?? '');
    return;
  }
  if (tag === 'select') {
    for (let [index, option] of [...(target.options || [])].entries()) {
      option.toggleAttribute?.('selected', Boolean(source.options?.[index]?.selected));
    }
    return;
  }
  if (tag === 'input') {
    target.setAttribute?.('value', String(source.value ?? ''));
    target.toggleAttribute?.('checked', Boolean(source.checked));
  }
}

function copiedCanvas(source, targetDoc, report) {
  let image = targetDoc.createElement('img');
  copySafeAttributes(source, image);
  image.alt = '';
  image.setAttribute('data-dom-raster-canvas', 'true');
  let computed = source.ownerDocument.defaultView?.getComputedStyle?.(source);
  if (computed) {
    image.style.cssText = [...computed]
      .map((name) => `${name}:${computed.getPropertyValue(name)};`)
      .join('');
  }
  try {
    let dataUrl = source.toDataURL?.('image/png') || '';
    if (!dataUrl) throw new Error('canvas-data-unavailable');
    image.src = dataUrl;
    report.copied += 1;
  } catch (error) {
    report.unreadable += 1;
    throw new Error(`DOM raster capture could not read required canvas pixels: ${error?.message || error}.`);
  }
  return image;
}

function appendAdoptedStyles(sourceRoot, targetFragment, targetDoc, baseUrl, report) {
  for (let sheet of sourceRoot.adoptedStyleSheets || []) {
    let text = stylesheetText(sheet);
    if (!text) {
      report.inaccessible += 1;
      continue;
    }
    let style = targetDoc.createElement('style');
    style.setAttribute('data-dom-raster-static-support', 'adopted-style');
    style.textContent = rebaseStylesheetUrls(text, baseUrl);
    targetFragment.append(style);
    report.adopted += 1;
  }
}

/**
 * Copies the rendered tree without connecting another custom-element instance.
 * Open shadow roots are represented as declarative shadow DOM, which Chromium
 * parses into inert static shadow trees in the isolated capture document.
 */
function cloneStaticNode(source, targetDoc, report, baseUrl) {
  if (source?.nodeType !== 1) return targetDoc.importNode(source, false);
  let tag = String(source.localName || source.tagName || '').toLowerCase();
  if (EXECUTABLE_TAGS.has(tag)) return targetDoc.createComment(`dom-raster-removed:${tag}`);
  if (tag === 'canvas') return copiedCanvas(source, targetDoc, report.canvases);
  let clone = source.namespaceURI && source.namespaceURI !== 'http://www.w3.org/1999/xhtml'
    ? targetDoc.createElementNS(source.namespaceURI, source.localName)
    : targetDoc.createElement(source.localName || source.tagName);
  copySafeAttributes(source, clone);
  for (let child of source.childNodes || []) {
    clone.append(cloneStaticNode(child, targetDoc, report, baseUrl));
  }
  synchronizeFormControl(source, clone);
  let shadow = source.shadowRoot;
  if (shadow) {
    let template = targetDoc.createElement('template');
    template.setAttribute('shadowrootmode', shadow.mode || 'open');
    if (shadow.delegatesFocus) template.setAttribute('shadowrootdelegatesfocus', '');
    appendAdoptedStyles(shadow, template.content, targetDoc, baseUrl, report.stylesheets);
    for (let child of shadow.childNodes || []) {
      template.content.append(cloneStaticNode(child, targetDoc, report, baseUrl));
    }
    clone.append(template);
  }
  return clone;
}

function captureDocumentAttributes(source) {
  let sourceDoc = source.ownerDocument;
  let safeAttributes = (element) => [...(element?.attributes || [])]
    .filter((attribute) => !/^on/i.test(attribute.name) && attribute.name !== DOM_RASTER_INACTIVE_ATTRIBUTE)
    .map((attribute) => [attribute.name, attribute.value]);
  let customProperties = [];
  let computed = sourceDoc.defaultView?.getComputedStyle?.(source);
  for (let name of computed || []) {
    if (String(name).startsWith('--')) customProperties.push([name, computed.getPropertyValue(name)]);
  }
  return {
    documentAttributes: safeAttributes(sourceDoc.documentElement),
    bodyAttributes: safeAttributes(sourceDoc.body),
    customProperties,
  };
}

function applyDocumentAttributes(snapshot, targetDoc) {
  for (let [name, value] of snapshot.documentAttributes) targetDoc.documentElement.setAttribute(name, value);
  for (let [name, value] of snapshot.bodyAttributes) targetDoc.body.setAttribute(name, value);
  for (let [name, value] of snapshot.customProperties) targetDoc.documentElement.style.setProperty(name, value);
}

function captureContextAncestors(source) {
  let ancestors = [];
  for (let node = source?.parentElement; node && node !== source.ownerDocument?.body; node = node.parentElement) {
    ancestors.unshift(node);
  }
  return ancestors.map((element) => ({
    tagName: String(element.localName || element.tagName || 'div').toLowerCase(),
    attributes: [...(element.attributes || [])]
      .filter((attribute) => !/^on/i.test(attribute.name) && attribute.name !== DOM_RASTER_INACTIVE_ATTRIBUTE)
      .map((attribute) => [attribute.name, attribute.value]),
  }));
}

function appendCaptureContext(targetDoc, root, context) {
  let parent = root;
  for (let record of context || []) {
    let wrapper = targetDoc.createElement(record.tagName || 'div');
    for (let [name, value] of record.attributes || []) wrapper.setAttribute(name, value);
    // Context wrappers exist only so ancestor-aware cascade selectors retain
    // their original semantics. They must not add a second layout system or
    // geometry around the captured source.
    wrapper.style.setProperty('display', 'contents', 'important');
    parent.append(wrapper);
    parent = wrapper;
  }
  return parent;
}

function stylesheetText(sheet) {
  try {
    return [...(sheet?.cssRules || [])].map((rule) => rule.cssText).join('\n');
  } catch {
    return '';
  }
}

function rebaseStylesheetUrls(text, baseUrl) {
  return String(text || '').replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, value) => {
    let source = String(value || '').trim();
    if (!source || /^(?:data:|blob:|#|var\()/i.test(source)) return match;
    try {
      return `url(${quote}${new URL(source, baseUrl).href}${quote})`;
    } catch {
      return match;
    }
  });
}

function sanitizedBaseUrl(doc) {
  let value;
  try {
    value = new URL(doc?.baseURI || 'about:blank');
  } catch {
    throw new Error('DOM raster capture requires a valid document base URL.');
  }
  value.username = '';
  value.password = '';
  value.search = '';
  value.hash = '';
  return value.href;
}

function stylesheetSnapshot(node) {
  let media = String(node.media || '').trim();
  let text = stylesheetText(node.sheet);
  if (text) return { type: 'style', text: rebaseStylesheetUrls(text, node.href), media };
  return { type: 'link', href: node.href, media };
}

function captureDocumentStyles(sourceDoc) {
  let nodes = [];
  for (let node of sourceDoc.querySelectorAll('head style, head link[rel="stylesheet"]')) {
    if (node.tagName.toLowerCase() === 'style') {
      nodes.push({ type: 'style', text: node.textContent || '', media: String(node.media || '').trim() });
    } else {
      nodes.push(stylesheetSnapshot(node));
    }
  }
  let adopted = [];
  let inaccessible = 0;
  for (let sheet of sourceDoc.adoptedStyleSheets || []) {
    try {
      adopted.push([...sheet.cssRules].map((rule) => rule.cssText).join('\n'));
    } catch {
      inaccessible += 1;
    }
  }
  return { nodes, adopted, inaccessible };
}

function appendStyleSnapshot(targetDoc, snapshot) {
  if (snapshot.type === 'style') {
    let style = targetDoc.createElement('style');
    style.textContent = snapshot.text;
    if (snapshot.media) style.media = snapshot.media;
    targetDoc.head.append(style);
    return;
  }
  let link = targetDoc.createElement('link');
  link.rel = 'stylesheet';
  link.href = snapshot.href;
  if (snapshot.media) link.media = snapshot.media;
  targetDoc.head.append(link);
}

function appendStaticDocumentStyles(snapshot, targetDoc, baseUrl) {
  let base = targetDoc.createElement('base');
  base.setAttribute('href', baseUrl);
  targetDoc.head.append(base);
  for (let node of snapshot.nodes) {
    appendStyleSnapshot(targetDoc, node);
  }
  for (let text of snapshot.adopted) {
    let style = targetDoc.createElement('style');
    style.setAttribute('data-dom-raster-static-support', 'document-adopted-style');
    style.textContent = rebaseStylesheetUrls(text, baseUrl);
    targetDoc.head.append(style);
  }
  let freezeMotion = targetDoc.createElement('style');
  freezeMotion.textContent = '*{animation:none!important;transition:none!important;caret-color:transparent!important;}';
  targetDoc.head.append(freezeMotion);
  return {
    linked: snapshot.nodes.filter((node) => node.type === 'link').length,
    adopted: snapshot.adopted.length,
    inaccessible: snapshot.inaccessible,
  };
}

function createStaticCaptureHtml(source, sourceCssSize, attributes, styles, surfaceBackground, context) {
  let sourceDoc = source.ownerDocument;
  let baseUrl = sanitizedBaseUrl(sourceDoc);
  let targetDoc = sourceDoc.implementation?.createHTMLDocument?.('DOM raster frame capture');
  if (!targetDoc) throw new Error('DOM raster frame needs document.implementation.createHTMLDocument().');
  applyDocumentAttributes(attributes, targetDoc);
  let stylesheets = appendStaticDocumentStyles(styles, targetDoc, baseUrl);
  targetDoc.documentElement.style.cssText += ';width:100%;height:100%;overflow:hidden;';
  targetDoc.body.style.cssText += `;margin:0;width:100%;height:100%;overflow:hidden;${surfaceBackground.color ? `background-color:${surfaceBackground.color};` : ''}`;
  let root = targetDoc.createElement('div');
  root.id = 'dom-raster-frame-root';
  root.style.cssText = 'position:relative;display:block;box-sizing:border-box;width:100%;height:100%;padding:0;overflow:hidden;';
  let report = {
    canvases: { copied: 0, unreadable: 0 },
    stylesheets: { ...stylesheets },
  };
  let target = cloneStaticNode(source, targetDoc, report, baseUrl);
  target.setAttribute('data-dom-raster-root', 'true');
  applyCaptureViewport(target, sourceCssSize, surfaceBackground);
  appendCaptureContext(targetDoc, root, context).append(target);
  targetDoc.body.append(root);
  return {
    html: `<!doctype html>${targetDoc.documentElement.outerHTML}`,
    reports: report,
  };
}

function createCaptureFrame(sourceDoc, sourceCssSize, html) {
  let frame = sourceDoc.createElement('iframe');
  frame.title = 'DOM raster frame capture';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = [
    'position:fixed',
    'inset:auto auto 0 -100000px',
    `width:${sourceCssSize[0]}px`,
    `height:${sourceCssSize[1]}px`,
    'border:0',
    'clip-path:inset(100%)',
    'pointer-events:none',
    'contain:strict',
  ].join(';');
  frame.srcdoc = html;
  return frame;
}

function measuredSourceSize(source) {
  let sourceRect = source.getBoundingClientRect?.();
  if (!(Number(sourceRect?.width) > 0) || !(Number(sourceRect?.height) > 0)) {
    return null;
  }
  return normalizeDomRasterFrameSize([sourceRect?.width, sourceRect?.height]);
}

function sourceCaptureSize(source, options = {}) {
  if (options.sourceCssSize !== undefined) {
    return normalizeDomRasterFrameSize(options.sourceCssSize);
  }
  let sourceSize = measuredSourceSize(source);
  if (!sourceSize) {
    throw new Error('DOM raster capture requires a connected, measurable source; display:none and zero-sized layouts cannot be captured.');
  }
  return sourceSize;
}

function hasPaintedBackground(value) {
  let color = String(value || '').trim().toLowerCase();
  if (!color || color === 'transparent') return false;
  return !/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(color);
}

function captureSurfaceBackground(source) {
  let win = source?.ownerDocument?.defaultView;
  for (let node = source; node; node = node.parentElement) {
    let style = win?.getComputedStyle?.(node);
    if (hasPaintedBackground(style?.backgroundColor)) {
      return {
        color: style.backgroundColor,
        image: String(style.backgroundImage || '') !== 'none' ? style.backgroundImage : '',
        position: style.backgroundPosition || '',
        size: style.backgroundSize || '',
        repeat: style.backgroundRepeat || '',
      };
    }
  }
  return { color: '' };
}

function applyCaptureViewport(target, sourceCssSize, surfaceBackground) {
  target.removeAttribute('hidden');
  let viewportStyle = [
    'position:absolute',
    'inset:0',
    'display:block!important',
    'width:100%',
    'height:100%',
    'min-width:0',
    'min-height:0',
    'max-width:none',
    'max-height:none',
    'flex:none',
  ].join(';');
  target.style.cssText += `;${viewportStyle};`;
  target.style.setProperty('--sn-layout-overflow-inline-size', `${sourceCssSize[0]}px`, 'important');
  target.style.setProperty('--sn-layout-overflow-block-size', `${sourceCssSize[1]}px`, 'important');
  target.style.setProperty('--sn-xr-content-width', `${sourceCssSize[0]}px`, 'important');
  target.style.setProperty('--sn-xr-content-height', `${sourceCssSize[1]}px`, 'important');
  if (surfaceBackground?.color) target.style.setProperty('background-color', surfaceBackground.color);
  if (surfaceBackground?.image) {
    target.style.setProperty('background-image', surfaceBackground.image);
    if (surfaceBackground.position) target.style.setProperty('background-position', surfaceBackground.position);
    if (surfaceBackground.size) target.style.setProperty('background-size', surfaceBackground.size);
    if (surfaceBackground.repeat) target.style.setProperty('background-repeat', surfaceBackground.repeat);
  }
}

function staticTreeElements(root) {
  let elements = [];
  let visit = (node) => {
    if (!node) return;
    if (node.nodeType === 1) {
      if (!node.hasAttribute?.('data-dom-raster-static-support')) elements.push(node);
      for (let child of node.childNodes || []) visit(child);
      for (let child of node.shadowRoot?.childNodes || []) visit(child);
      return;
    }
    for (let child of node.childNodes || []) visit(child);
  };
  visit(root);
  return elements;
}

function scrollState(root) {
  return staticTreeElements(root).flatMap((element, index) => {
    let left = Number(element.scrollLeft) || 0;
    let top = Number(element.scrollTop) || 0;
    return left || top ? [{ index, left, top }] : [];
  });
}

function applyScrollState(root, state) {
  let elements = staticTreeElements(root);
  for (let item of state || []) {
    let element = elements[item.index];
    if (!element) continue;
    element.scrollLeft = Number(item.left) || 0;
    element.scrollTop = Number(item.top) || 0;
  }
}

function waitForFrameLoad(frame, signal) {
  return raceAbort(new Promise((resolve, reject) => {
    let loaded = () => {
      frame.removeEventListener?.('error', failed);
      resolve();
    };
    let failed = () => {
      frame.removeEventListener?.('load', loaded);
      reject(new Error('DOM raster capture iframe failed to initialize.'));
    };
    frame.addEventListener('load', loaded, { once: true });
    frame.addEventListener('error', failed, { once: true });
  }), signal);
}

const LIVE_SIZE_PROPERTIES = Object.freeze([
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'flex',
  '--sn-layout-overflow-inline-size',
  '--sn-layout-overflow-block-size',
  '--sn-xr-content-width',
  '--sn-xr-content-height',
]);

function applyLiveCaptureSize(source, size) {
  let previous = LIVE_SIZE_PROPERTIES.map((name) => ({
    name,
    value: source.style.getPropertyValue(name),
    priority: source.style.getPropertyPriority(name),
  }));
  let values = {
    width: `${size[0]}px`,
    height: `${size[1]}px`,
    'min-width': `${size[0]}px`,
    'min-height': `${size[1]}px`,
    'max-width': `${size[0]}px`,
    'max-height': `${size[1]}px`,
    flex: 'none',
    '--sn-layout-overflow-inline-size': `${size[0]}px`,
    '--sn-layout-overflow-block-size': `${size[1]}px`,
    '--sn-xr-content-width': `${size[0]}px`,
    '--sn-xr-content-height': `${size[1]}px`,
  };
  for (let [name, value] of Object.entries(values)) source.style.setProperty(name, value, 'important');
  return () => {
    for (let item of previous) {
      if (item.value) source.style.setProperty(item.name, item.value, item.priority);
      else source.style.removeProperty(item.name);
    }
  };
}

function nextRasterCaptureAttemptId(revision) {
  rasterCaptureAttempt += 1;
  return `${DOM_RASTER_FRAME_VERSION}:${revision}:${rasterCaptureAttempt}`;
}

function shadowInclusiveElements(root) {
  let elements = [];
  let visited = new Set();
  let visit = (node) => {
    if (!node || visited.has(node)) return;
    visited.add(node);
    if (node.nodeType === 1) elements.push(node);
    for (let child of node.childNodes || []) visit(child);
    for (let child of node.shadowRoot?.childNodes || []) visit(child);
  };
  visit(root);
  return elements;
}

function matchingRasterSize(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => Math.abs(value - expected[index]) <= 0.5);
}

function validateRasterPreparationReceipt(receipt, request, hookIndex) {
  let label = `DOM raster component preparation hook ${hookIndex + 1}`;
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error(`${label} must return a receipt object.`);
  }
  if (receipt.ready !== true) {
    throw new Error(`${label} receipt must declare ready:true.`);
  }
  if (receipt.attemptId !== request.attemptId) {
    throw new Error(`${label} receipt attemptId does not match the active capture attempt.`);
  }
  let cssSize;
  let viewportCssSize;
  try {
    cssSize = normalizeDomRasterFrameSize(receipt.cssSize);
    viewportCssSize = normalizeDomRasterFrameSize(receipt.viewportCssSize);
  } catch (error) {
    throw new Error(`${label} receipt requires positive cssSize and viewportCssSize: ${error.message}`);
  }
  if (!matchingRasterSize(cssSize, request.cssSize)) {
    throw new Error(
      `${label} receipt cssSize ${cssSize.join(' × ')} px does not match requested ${request.cssSize.join(' × ')} px.`,
    );
  }
  let visualRevision = Number(receipt.visualRevision);
  if (!Number.isInteger(visualRevision) || visualRevision < 0) {
    throw new Error(`${label} receipt visualRevision must be a non-negative integer.`);
  }
  return {
    ready: true,
    attemptId: request.attemptId,
    cssSize,
    viewportCssSize,
    visualRevision,
  };
}

async function prepareRasterComponents(source, request) {
  let hooks = shadowInclusiveElements(source)
    .filter((element) => typeof element.prepareRasterCapture === 'function');
  let receipts = [];
  for (let [index, element] of hooks.entries()) {
    throwIfAborted(request.signal);
    let receipt = await raceAbort(element.prepareRasterCapture({
      attemptId: request.attemptId,
      cssSize: [...request.cssSize],
      revision: request.revision,
      reason: request.reason,
      signal: request.signal,
    }), request.signal);
    throwIfAborted(request.signal);
    receipts.push(validateRasterPreparationReceipt(receipt, request, index));
  }
  return receipts;
}

/**
 * Creates an off-screen, cascade-equivalent document for a visible layout.
 * The caller owns `dispose()` and must release it after serializing the frame.
 *
 * @param {Element} sourceElement
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export async function prepareDomRasterFrameCapture(sourceElement, options = {}) {
  let source = requireElement(sourceElement, 'prepareDomRasterFrameCapture sourceElement');
  let sourceCssSize = sourceCaptureSize(source, options);
  let allowsUnmeasurableSource = options.sourceCssSize !== undefined;
  let sourceDoc = source.ownerDocument;
  let lifetime = new AbortController();
  let signal = combinedSignal(options.signal, lifetime.signal);
  throwIfAborted(signal);
  await settleDocument(sourceDoc, signal, source);
  requireElement(source, 'prepareDomRasterFrameCapture sourceElement');
  let attributes = captureDocumentAttributes(source);
  let context = captureContextAncestors(source);
  let styles = captureDocumentStyles(sourceDoc);
  let sourceScrollState = scrollState(source);
  let surfaceBackground = captureSurfaceBackground(source);
  let staticFrame = createStaticCaptureHtml(source, sourceCssSize, attributes, styles, surfaceBackground, context);
  let frame = createCaptureFrame(sourceDoc, sourceCssSize, staticFrame.html);
  try {
    sourceDoc.body.append(frame);
    await waitForFrameLoad(frame, signal);
    let targetDoc = frame.contentDocument;
    if (!targetDoc) throw new Error('DOM raster capture iframe is not same-origin readable.');
    let target = targetDoc.querySelector('[data-dom-raster-root="true"]');
    if (!target) throw new Error('DOM raster capture iframe did not parse its static layout root.');
    applyScrollState(target, sourceScrollState);
    await settleDocument(targetDoc, signal, target);
    let disposed = false;
    let host = {
      version: DOM_RASTER_FRAME_VERSION,
      frame,
      panel: target,
      html: staticFrame.html,
      sourceElement: source,
      sourceCssSize,
      allowsUnmeasurableSource,
      stylesheets: staticFrame.reports.stylesheets,
      canvases: staticFrame.reports.canvases,
      lifetime,
      captureActive: false,
      get disposed() {
        return disposed;
      },
      dispose() {
        if (disposed) return false;
        disposed = true;
        lifetime.abort(new Error('DOM raster frame host disposed.'));
        frame.remove();
        return true;
      },
    };
    return host;
  } catch (error) {
    lifetime.abort(error);
    frame.remove();
    throw error;
  }
}

/**
 * Resizes an isolated DOM layout and serializes the static frame that a remote
 * Chromium renderer can paint. The output is renderer-neutral and contains no
 * product layout IDs or texture details.
 *
 * @param {Object} host
 * @param {Array<number>} cssSize
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export async function captureDomRasterFrame(host, cssSize, options = {}) {
  if (host?.version !== DOM_RASTER_FRAME_VERSION || host.disposed) {
    throw new Error('captureDomRasterFrame requires an active DOM raster frame capture host.');
  }
  if (host.captureActive) throw new Error('DOM raster frame already has an active capture.');
  let targetCssSize = normalizeDomRasterFrameSize(cssSize);
  let captureRevision = options.revision === undefined ? 0 : Number(options.revision);
  if (!Number.isInteger(captureRevision) || captureRevision < 0) {
    throw new TypeError('captureDomRasterFrame revision must be a non-negative integer.');
  }
  let source = requireElement(host.sourceElement, 'captureDomRasterFrame sourceElement');
  let signal = combinedSignal(options.signal, host.lifetime?.signal);
  throwIfAborted(signal);
  let attemptId = nextRasterCaptureAttemptId(captureRevision);
  let restoreSize = applyLiveCaptureSize(source, targetCssSize);
  let prepared = null;
  host.captureActive = true;
  try {
    if (typeof options.resizeSource === 'function') {
      await raceAbort(options.resizeSource({ source, cssSize: [...targetCssSize], revision: captureRevision, signal }), signal);
    }
    if (typeof options.awaitReady === 'function') {
      await raceAbort(options.awaitReady({ source, cssSize: [...targetCssSize], revision: captureRevision, signal }), signal);
    }
    await prepareRasterComponents(source, {
      attemptId,
      cssSize: targetCssSize,
      revision: captureRevision,
      reason: String(options.reason || 'capture'),
      signal,
    });
    await settleDocument(source.ownerDocument, signal, source);
    requireElement(source, 'captureDomRasterFrame sourceElement');
    let actualSourceSize = measuredSourceSize(source);
    if (!actualSourceSize && host.allowsUnmeasurableSource !== true) {
      throw new Error(
        'DOM raster source became unmeasurable during capture; keep the connected source '
        + 'layout measurable or prepare it with an explicit sourceCssSize.',
      );
    }
    if (actualSourceSize
      && (Math.abs(actualSourceSize[0] - targetCssSize[0]) > 0.5
      || Math.abs(actualSourceSize[1] - targetCssSize[1]) > 0.5)) {
      throw new Error(
        `DOM raster source resolved ${actualSourceSize.join(' × ')} px, expected ${targetCssSize.join(' × ')} px.`,
      );
    }
    prepared = await prepareDomRasterFrameCapture(source, {
      sourceCssSize: targetCssSize,
      signal,
    });
    let rect = prepared.panel.getBoundingClientRect();
    let actualCssSize = normalizeDomRasterFrameSize([rect.width, rect.height]);
    if (Math.abs(actualCssSize[0] - targetCssSize[0]) > 0.5
      || Math.abs(actualCssSize[1] - targetCssSize[1]) > 0.5) {
      throw new Error(
        `DOM raster frame resolved ${actualCssSize.join(' × ')} px, expected ${targetCssSize.join(' × ')} px.`,
      );
    }
    return {
      version: DOM_RASTER_FRAME_VERSION,
      layoutId: String(options.layoutId || ''),
      revision: captureRevision,
      cssSize: actualCssSize,
      scroll: scrollState(prepared.panel),
      html: prepared.html,
      stylesheets: { ...prepared.stylesheets },
      canvases: { ...prepared.canvases },
    };
  } finally {
    prepared?.dispose();
    restoreSize();
    host.captureActive = false;
  }
}
