const DEFAULT_OVERLAY_Z_BASE = 20000;

let overlayZCounter = DEFAULT_OVERLAY_Z_BASE;
let overlayHomes = new WeakMap();

function readOverlayBase(element) {
  if (typeof getComputedStyle !== 'function' || !element) return DEFAULT_OVERLAY_Z_BASE;
  let value = getComputedStyle(element).getPropertyValue('--sn-overlay-z-base').trim();
  let number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : DEFAULT_OVERLAY_Z_BASE;
}

function collectCustomProperties(style) {
  let names = new Set();
  if (!style) return names;
  for (let i = 0; i < style.length; i += 1) {
    let name = style.item?.(i) || style[i];
    if (typeof name === 'string' && name.startsWith('--sn-')) {
      names.add(name);
    }
  }
  return names;
}

export function nextOverlayZIndex(element = null) {
  overlayZCounter = Math.max(overlayZCounter, readOverlayBase(element));
  overlayZCounter += 1;
  return overlayZCounter;
}

export function bringOverlayToFront(element) {
  let zIndex = nextOverlayZIndex(element);
  if (element?.style) {
    element.style.zIndex = String(zIndex);
    element.setAttribute?.('data-overlay-z', String(zIndex));
  }
  return zIndex;
}

export function resetOverlayStack(value = DEFAULT_OVERLAY_Z_BASE) {
  overlayZCounter = Number.isFinite(value) ? value : DEFAULT_OVERLAY_Z_BASE;
}

export function syncOverlayTheme(element, themeSource) {
  if (!element?.style || !themeSource || typeof getComputedStyle !== 'function') return;

  let computed = getComputedStyle(themeSource);
  let inline = themeSource.style;
  let names = new Set([
    ...collectCustomProperties(computed),
    ...collectCustomProperties(inline),
  ]);

  for (let name of names) {
    let value = computed.getPropertyValue(name).trim() || inline?.getPropertyValue(name)?.trim();
    if (value) element.style.setProperty(name, value);
  }
}

export function mountOverlayToDocument(element, themeSource = element?.parentElement) {
  let body = element?.ownerDocument?.body;
  if (!element || !body) return false;

  if (!overlayHomes.has(element)) {
    overlayHomes.set(element, {
      parent: element.parentNode,
      nextSibling: element.nextSibling,
    });
  }

  syncOverlayTheme(element, themeSource);
  element.toggleAttribute('data-overlay-portal', true);
  if (element.parentNode !== body) body.appendChild(element);
  return true;
}

export function restoreOverlayHome(element) {
  let home = overlayHomes.get(element);
  if (!element || !home?.parent) return false;

  if (home.nextSibling?.parentNode === home.parent) {
    home.parent.insertBefore(element, home.nextSibling);
  } else {
    home.parent.appendChild(element);
  }
  element.removeAttribute('data-overlay-portal');
  overlayHomes.delete(element);
  return true;
}
