/**
 * Face masks of the presenter robot. Each variant is an SVG for a 54x54 face
 * (clipped to the avatar circle) with two moving pupils marked `data-eye`.
 * The palette is neutral metal, ink and a cool white glow: no brand orange.
 *
 * `travel` is how far (px at the default body size) the pupils may move.
 */

const GLOW = 'filter:drop-shadow(0 0 1.6px #8fd0ff)';

const astro = () => ({
  label: 'Космонавт',
  travel: 2.1,
  svg: `
    <circle cx="27" cy="27" r="27" fill="#dcd9d2"/>
    <circle cx="27" cy="27" r="25.6" fill="none" stroke="#a9a59c" stroke-width="1"/>
    <path d="M9 24 C9 14 17 9 27 9 C37 9 45 14 45 24 C45 34 40 42 27 42 C14 42 9 34 9 24 Z" fill="#17171b" stroke="#8b877e" stroke-width="1.4"/>
    <path d="M13 19.5 C15 14.5 21 12.2 27 12.2" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="38.5" cy="17" r="1.1" fill="#fff" fill-opacity=".35"/>
    <circle cx="20.5" cy="24" r="4.6" fill="#0b0b0f" stroke="#3d3d47" stroke-width=".7"/>
    <circle cx="33.5" cy="24" r="4.6" fill="#0b0b0f" stroke="#3d3d47" stroke-width=".7"/>
    <g data-eye="l" style="transform-box:fill-box;transform-origin:center"><circle cx="20.5" cy="24" r="2.3" fill="#eaf6ff" style="${GLOW}"/></g>
    <g data-eye="r" style="transform-box:fill-box;transform-origin:center"><circle cx="33.5" cy="24" r="2.3" fill="#eaf6ff" style="${GLOW}"/></g>
    <path d="M17 46.4 L37 46.4" stroke="#a9a59c" stroke-width="1.2" stroke-linecap="round"/>
    <rect x="2.2" y="22" width="3.6" height="9" rx="1.6" fill="#a9a59c"/>
    <rect x="48.2" y="22" width="3.6" height="9" rx="1.6" fill="#a9a59c"/>`,
});

const walle = () => ({
  label: 'Валли',
  travel: 3.2,
  svg: `
    <circle cx="27" cy="27" r="27" fill="#2a2926"/>
    <rect x="5" y="9" width="44" height="34" rx="6" fill="#807a6e" stroke="#5a564d" stroke-width="1.2"/>
    <path d="M7 14 H47" stroke="#9b958a" stroke-width="1" stroke-opacity=".7"/>
    <rect x="25.8" y="20" width="2.4" height="8" fill="#5a564d"/>
    <circle cx="16.5" cy="24" r="9.2" fill="#cfcac0" stroke="#5a564d" stroke-width="1.2"/>
    <circle cx="37.5" cy="24" r="9.2" fill="#cfcac0" stroke="#5a564d" stroke-width="1.2"/>
    <circle cx="16.5" cy="24" r="6.8" fill="#15141a"/>
    <circle cx="37.5" cy="24" r="6.8" fill="#15141a"/>
    <g data-eye="l" style="transform-box:fill-box;transform-origin:center"><circle cx="16.5" cy="24" r="3" fill="#eaf6ff" style="${GLOW}"/></g>
    <g data-eye="r" style="transform-box:fill-box;transform-origin:center"><circle cx="37.5" cy="24" r="3" fill="#eaf6ff" style="${GLOW}"/></g>
    <circle cx="13.6" cy="20.8" r="1.2" fill="#fff" fill-opacity=".8"/>
    <circle cx="34.6" cy="20.8" r="1.2" fill="#fff" fill-opacity=".8"/>
    <path d="M17 38 H37 M19 40.4 H35" stroke="#5a564d" stroke-width="1" stroke-linecap="round"/>`,
});

const bot = () => ({
  label: 'Робот',
  travel: 2,
  svg: `
    <circle cx="27" cy="27" r="27" fill="#2a2926"/>
    <path d="M27 8 L27 4.6" stroke="#d9d6cf" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="27" cy="3.8" r="1.8" fill="#d9d6cf"/>
    <rect x="7" y="8" width="40" height="38" rx="9" fill="#d9d6cf" stroke="#8d897f" stroke-width="1.2"/>
    <rect x="11" y="14" width="32" height="17" rx="4.5" fill="#111114"/>
    <g data-eye="l" style="transform-box:fill-box;transform-origin:center"><rect x="15" y="17.5" width="8" height="7.5" rx="1.8" fill="#eaf6ff" style="${GLOW}"/></g>
    <g data-eye="r" style="transform-box:fill-box;transform-origin:center"><rect x="31" y="17.5" width="8" height="7.5" rx="1.8" fill="#eaf6ff" style="${GLOW}"/></g>
    <rect x="16.5" y="35" width="21" height="6.6" rx="3.3" fill="#111114"/>
    <circle cx="12.2" cy="37.4" r="1.3" fill="#b9b5aa"/>
    <circle cx="41.8" cy="37.4" r="1.3" fill="#b9b5aa"/>`,
});

export const MASK_VARIANTS = Object.freeze({ astro: astro(), walle: walle(), bot: bot() });
export const MASK_ORDER = Object.freeze(Object.keys(MASK_VARIANTS));
export const DEFAULT_MASK = 'astro';
