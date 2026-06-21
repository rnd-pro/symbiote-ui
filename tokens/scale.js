/**
 * Canonical geometry scale — the single source for spacing, radius, sizing,
 * typography, and connector geometry rungs.
 *
 * The rung TOKEN NAMES (`--sn-space-md`, `--sn-node-radius`, ...) are the stable
 * contract every component must consume; the concrete px values are
 * register-scoped through named profiles. Dense tool/IDE surfaces and airy
 * product surfaces share the same rung names and differ only in profile values,
 * so "use the scale" is a membership check, not an arithmetic guess.
 *
 * Node-safe: no DOM access. Themes and `themes/Skin.js` build their geometry
 * from these profiles; `audit.js`/`discover.js` read them to validate and expose
 * the scale.
 *
 * @module symbiote-ui/tokens/scale
 */

/** Spacing rung names, smallest → largest. The numbered axis the rest derives from. */
export const SPACE_RUNGS = Object.freeze(['xs', 'sm', 'md', 'lg', 'xl']);

/** Register-scoped geometry profiles. `product` is the airy default. */
const PROFILES = {
  product: {
    registers: ['product', 'agent-workspace', 'media-studio', 'brand'],
    skin: 'modern',
    space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radius: { node: 'md', comment: 'sm' },
    socketSize: 'md',
    socketBorderWidth: 2,
    connWidth: 2,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    shadowGeometry: '0 4px 16px',
    shadowAlpha: 0.3,
  },
  tool: {
    registers: ['tool', 'admin', 'editor'],
    skin: 'compact',
    space: { xs: 3, sm: 5, md: 8, lg: 12, xl: 16 },
    radius: { node: 'md', comment: 'sm' },
    socketSize: 'md',
    socketBorderWidth: 1.5,
    connWidth: 1.5,
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    shadowGeometry: '0 2px 8px',
    shadowAlpha: 0.2,
  },
  spacious: {
    registers: ['presentation'],
    skin: 'rounded',
    space: { xs: 5, sm: 10, md: 14, lg: 20, xl: 28 },
    radius: { node: 'lg', comment: 'md' },
    socketSize: 'md',
    socketBorderWidth: 2.5,
    connWidth: 2.5,
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 14,
    shadowGeometry: '0 6px 24px',
    shadowAlpha: 0.25,
  },
};

export const GEOMETRY_PROFILES = deepFreeze(PROFILES);
export const GEOMETRY_PROFILE_NAMES = Object.freeze(Object.keys(PROFILES));
export const DEFAULT_GEOMETRY_PROFILE = 'product';

/** Canonical geometry token names that components are allowed to consume. */
const GEOMETRY_TOKENS = Object.freeze([
  ...SPACE_RUNGS.map((rung) => `--sn-space-${rung}`),
  '--sn-node-radius',
  '--sn-comment-radius',
  '--sn-socket-size',
  '--sn-socket-border-width',
  '--sn-grid-size',
  '--sn-conn-width',
  '--sn-font-size',
]);

const GEOMETRY_TOKEN_SET = new Set(GEOMETRY_TOKENS);

/** CSS properties grouped by the geometry axis their values must come from. */
const SPACING_PROPERTIES = new Set([
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-block', 'margin-inline', 'margin-block-start', 'margin-block-end',
  'margin-inline-start', 'margin-inline-end',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-inline', 'padding-block-start', 'padding-block-end',
  'padding-inline-start', 'padding-inline-end',
  'gap', 'row-gap', 'column-gap',
  'inset', 'inset-block', 'inset-inline', 'top', 'right', 'bottom', 'left',
]);

const RADIUS_PROPERTIES = new Set([
  'border-radius',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'border-start-start-radius', 'border-start-end-radius',
  'border-end-start-radius', 'border-end-end-radius',
]);

const FONT_SIZE_PROPERTIES = new Set(['font-size']);

/**
 * @param {string} property
 * @returns {'space'|'radius'|'font-size'|null}
 */
export function geometryAxisForProperty(property) {
  let prop = String(property || '').trim().toLowerCase();
  if (SPACING_PROPERTIES.has(prop)) return 'space';
  if (RADIUS_PROPERTIES.has(prop)) return 'radius';
  if (FONT_SIZE_PROPERTIES.has(prop)) return 'font-size';
  return null;
}

/** @param {string} name @returns {boolean} */
export function isGeometryToken(name) {
  return GEOMETRY_TOKEN_SET.has(String(name || '').trim());
}

/** @returns {string[]} */
export function listGeometryTokens() {
  return [...GEOMETRY_TOKENS];
}

function getProfile(profileName) {
  return PROFILES[profileName] || PROFILES[DEFAULT_GEOMETRY_PROFILE];
}

function parsePx(rawValue) {
  let text = String(rawValue || '').trim();
  let match = text.match(/^(-?\d*\.?\d+)px$/);
  if (match) return Number(match[1]);
  if (/^-?\d*\.?\d+$/.test(text)) return Number(text);
  return null;
}

function nearestRung(value, rungValues) {
  let best = null;
  for (let [rung, px] of rungValues) {
    let distance = Math.abs(value - px);
    if (!best || distance < best.distance) best = { rung, px, distance };
  }
  return best;
}

/**
 * Snap a raw geometry value to the nearest canonical scale token for a profile.
 * @param {string} property CSS property name (decides the axis)
 * @param {string|number} rawValue e.g. '12px'
 * @param {string} [profileName]
 * @returns {{token: string, exact: boolean, nearestPx: number, axis: string}|null}
 */
export function snapValueToToken(property, rawValue, profileName = DEFAULT_GEOMETRY_PROFILE) {
  let axis = geometryAxisForProperty(property);
  if (!axis) return null;
  let value = parsePx(rawValue);
  if (value === null) return null;
  let profile = getProfile(profileName);

  if (axis === 'font-size') {
    return {
      token: 'var(--sn-font-size)',
      exact: Math.abs(value - profile.fontSize) < 0.5,
      nearestPx: profile.fontSize,
      axis,
    };
  }

  let rungValues = SPACE_RUNGS.map((rung) => [rung, profile.space[rung]]);
  let best = nearestRung(value, rungValues);
  if (!best) return null;
  return {
    token: `var(--sn-space-${best.rung})`,
    exact: best.distance < 0.5,
    nearestPx: best.px,
    axis,
  };
}

/**
 * Build the geometry custom-property map for a profile. This is the single
 * source `themes/Skin.js` skins are generated from.
 * @param {string} profileName
 * @returns {Object<string,string>}
 */
export function buildSkinGeometry(profileName) {
  let p = getProfile(profileName);
  let geometry = {};
  for (let rung of SPACE_RUNGS) geometry[`--sn-space-${rung}`] = `${p.space[rung]}px`;
  geometry['--sn-node-radius'] = `var(--sn-space-${p.radius.node})`;
  geometry['--sn-comment-radius'] = `var(--sn-space-${p.radius.comment})`;
  geometry['--sn-socket-size'] = `var(--sn-space-${p.socketSize})`;
  geometry['--sn-socket-border-width'] = `${p.socketBorderWidth}px`;
  geometry['--sn-grid-size'] = 'var(--sn-space-xl)';
  geometry['--sn-conn-width'] = String(p.connWidth);
  geometry['--sn-font'] = p.fontFamily;
  geometry['--sn-font-size'] = `${p.fontSize}px`;
  geometry['--sn-shadow-geometry'] = p.shadowGeometry;
  geometry['--sn-node-shadow'] = `var(--sn-shadow-geometry) var(--sn-shadow-color, rgba(0, 0, 0, ${p.shadowAlpha}))`;
  return geometry;
}

/**
 * Emit the geometry scale as a CSS custom-property block for a profile.
 * @param {string} [profileName]
 * @returns {string}
 */
export function geometryScaleCss(profileName = DEFAULT_GEOMETRY_PROFILE) {
  let geometry = buildSkinGeometry(profileName);
  return Object.entries(geometry)
    .map(([token, value]) => `  ${token}: ${value};`)
    .join('\n');
}

/**
 * Agent-facing descriptor of the geometry scale for `discover`.
 * @returns {Object}
 */
export function getGeometryScaleDescriptor() {
  return {
    version: 'geometry-scale-v1',
    defaultProfile: DEFAULT_GEOMETRY_PROFILE,
    spaceRungs: [...SPACE_RUNGS],
    tokens: listGeometryTokens(),
    profiles: GEOMETRY_PROFILE_NAMES.map((name) => ({
      name,
      registers: [...PROFILES[name].registers],
      skin: PROFILES[name].skin,
      space: { ...PROFILES[name].space },
      fontSize: PROFILES[name].fontSize,
    })),
    axes: {
      space: [...SPACING_PROPERTIES],
      radius: [...RADIUS_PROPERTIES],
      'font-size': [...FONT_SIZE_PROPERTIES],
    },
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (let child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
