const XR_THEME_TOKEN_MAP = Object.freeze({
  panelBackground: '--sn-xr-panel-bg',
  panelBorder: '--sn-xr-panel-border',
  panelRadius: '--sn-xr-panel-radius',
  panelShadow: '--sn-xr-panel-shadow',
  pointerColor: '--sn-xr-pointer-color',
  textColor: '--sn-text',
  mutedTextColor: '--sn-text-dim',
  motionDuration: '--sn-duration-fast',
  motionEasing: '--sn-ease-standard',
  gap: '--sn-layout-resizer-size',
});

const XR_THEME_FALLBACKS = Object.freeze({
  '--sn-xr-panel-bg': 'var(--sn-panel-bg)',
  '--sn-xr-panel-border': 'var(--sn-node-border)',
  '--sn-xr-panel-radius': 'var(--sn-node-radius)',
  '--sn-xr-panel-shadow': 'var(--sn-node-shadow)',
  '--sn-xr-pointer-color': 'var(--sn-node-selected)',
  '--sn-text': 'var(--sn-text)',
  '--sn-text-dim': 'var(--sn-text-dim)',
  '--sn-duration-fast': '120ms',
  '--sn-ease-standard': 'ease',
  '--sn-layout-resizer-size': '6px',
});

function resolveThemeRoot(rootOrDocument) {
  if (!rootOrDocument) return null;
  if (rootOrDocument.documentElement) return rootOrDocument.documentElement;
  return rootOrDocument;
}

function readCssToken(root, cssVar, computedStyle) {
  if (!root || !computedStyle) return XR_THEME_FALLBACKS[cssVar] || '';
  let value = computedStyle.getPropertyValue(cssVar).trim();
  return value || XR_THEME_FALLBACKS[cssVar] || '';
}

function resolveCssProperty(root, cssVar, property) {
  let documentRef = root?.ownerDocument || root?.documentElement?.ownerDocument || null;
  let parent = documentRef?.body || root;
  if (!documentRef?.createElement || !parent?.append || typeof globalThis.getComputedStyle !== 'function') return '';
  let probe = documentRef.createElement('span');
  probe.style.position = 'absolute';
  probe.style.pointerEvents = 'none';
  probe.style.opacity = '0';
  probe.style[property] = `var(${cssVar})`;
  parent.append(probe);
  let value = globalThis.getComputedStyle(probe).getPropertyValue(property).trim();
  probe.remove?.();
  return value;
}

export function createXRThemeSnapshot(rootOrDocument = globalThis.document, options = {}) {
  let root = resolveThemeRoot(rootOrDocument);
  let computedStyle = root && typeof globalThis.getComputedStyle === 'function'
    ? globalThis.getComputedStyle(root)
    : null;
  let tokens = {};

  for (let cssVar of Object.values(XR_THEME_TOKEN_MAP)) {
    tokens[cssVar] = readCssToken(root, cssVar, computedStyle);
  }

  return {
    version: 'xr-theme-snapshot-v1',
    themeScope: options.themeScope || root?.dataset?.themeScope || 'default-provider',
    tokens,
    material: {
      background: tokens['--sn-xr-panel-bg'],
      backgroundColor: resolveCssProperty(root, '--sn-xr-panel-bg', 'background-color') || tokens['--sn-xr-panel-bg'],
      border: tokens['--sn-xr-panel-border'],
      borderColor: resolveCssProperty(root, '--sn-xr-panel-border', 'border-color') || tokens['--sn-xr-panel-border'],
      radius: tokens['--sn-xr-panel-radius'],
      shadow: tokens['--sn-xr-panel-shadow'],
      pointer: tokens['--sn-xr-pointer-color'],
      pointerColor: resolveCssProperty(root, '--sn-xr-pointer-color', 'color') || tokens['--sn-xr-pointer-color'],
      text: tokens['--sn-text'],
      textColor: resolveCssProperty(root, '--sn-text', 'color') || tokens['--sn-text'],
      textDim: tokens['--sn-text-dim'],
      textDimColor: resolveCssProperty(root, '--sn-text-dim', 'color') || tokens['--sn-text-dim'],
      gap: tokens['--sn-layout-resizer-size'],
      motion: {
        duration: tokens['--sn-duration-fast'],
        easing: tokens['--sn-ease-standard'],
      },
    },
  };
}

export function applyXRThemeToPanel(panel, themeSnapshot) {
  let snapshot = themeSnapshot || createXRThemeSnapshot(null);
  return {
    ...panel,
    themeScope: panel.themeScope || snapshot.themeScope,
    material: {
      ...snapshot.material,
      ...(panel.material || {}),
    },
  };
}

export function getXRThemeTokenMap() {
  return { ...XR_THEME_TOKEN_MAP };
}
