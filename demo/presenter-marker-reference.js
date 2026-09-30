import {
  PRESENTER_MARKER_CATALOG,
  createPresenterMarkerGeometry,
} from '../chat/presenter-marker-geometry.js';

export const PRESENTER_MARKER_REFERENCE_SEEDS = Object.freeze([
  'reference-alpha',
  'reference-beta',
  3931985963,
]);

export const PRESENTER_MARKER_REFERENCE_TARGETS = Object.freeze([
  Object.freeze({
    id: 'short',
    label: 'short target · 52×26',
    rect: Object.freeze({ left: 294, top: 92, width: 52, height: 26 }),
    lines: Object.freeze(['15+']),
  }),
  Object.freeze({
    id: 'wide',
    label: 'wide target · 310×38',
    rect: Object.freeze({ left: 165, top: 88, width: 310, height: 38 }),
    lines: Object.freeze(['human decision checkpoint']),
  }),
  Object.freeze({
    id: 'multiline',
    label: 'multiline target · 230×104',
    rect: Object.freeze({ left: 205, top: 48, width: 230, height: 104 }),
    lines: Object.freeze(['parallel workers', 'review independently', 'join after evidence']),
  }),
]);

const CELL_WIDTH = 640;
const CELL_HEIGHT = 210;

function escapeMarkup(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function markerPlacement(marker) {
  if (marker === 'arrow' || marker === 'bracket' || marker === 'number') return 'before';
  return undefined;
}

function targetForMarker(marker, target) {
  if (marker !== 'arrow' || target.rect.left >= 270) return target;
  let left = Math.min(280, CELL_WIDTH - target.rect.width - 30);
  return {
    ...target,
    rect: {
      ...target.rect,
      left,
    },
  };
}

function targetMarkup(target) {
  let { rect, lines } = target;
  let lineHeight = 18;
  let firstY = rect.top + rect.height / 2 - (lines.length - 1) * lineHeight / 2 + 5;
  let text = lines.map((line, index) => (
    `<text x="${rect.left + rect.width / 2}" y="${firstY + index * lineHeight}" text-anchor="middle" class="target-text">${escapeMarkup(line)}</text>`
  )).join('');
  return `<rect class="target-surface" x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}" rx="8"/>${text}`;
}

function safeAreaMarkup(geometry) {
  if (!['oval', 'multi-oval'].includes(geometry.marker)) return '';
  let rect = geometry.safeArea.rect;
  return `<rect data-protected-safe-area="true" class="safe-area" x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}" rx="4"/>
    <text class="safe-label" x="${rect.left + 4}" y="${Math.min(181, rect.bottom + 28)}">protected safe-area · min ${geometry.safeArea.minimumClearancePx.toFixed(1)}px</text>`;
}

function tailMarkup(geometry) {
  if (!['oval', 'multi-oval'].includes(geometry.marker)) return '';
  let first = geometry.kinematics.samples[0];
  let last = geometry.kinematics.samples.at(-1);
  return `<circle data-tail-start="true" class="tail-start" cx="${first.x.toFixed(2)}" cy="${first.y.toFixed(2)}" r="3"/>
    <circle data-tail-end="true" class="tail-end" cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="3"/>`;
}

function referenceContent(marker, target, seed) {
  let renderedTarget = targetForMarker(marker, target);
  let geometry = createPresenterMarkerGeometry({
    marker,
    targetRect: renderedTarget.rect,
    seed,
    placement: markerPlacement(marker),
    label: marker === 'number' ? '3' : undefined,
    viewport: { width: CELL_WIDTH, height: CELL_HEIGHT },
  });
  return {
    geometry,
    markup: `${targetMarkup(renderedTarget)}
      ${safeAreaMarkup(geometry)}
      <path data-production-ribbon="true" data-path-hash="${geometry.kinematics.normalizedPathHash}" data-linecap="round" data-linejoin="round" class="marker-ink" d="${geometry.render.ribbonPath}"/>
      ${tailMarkup(geometry)}
      <text data-seed-label="true" class="seed-label" x="16" y="24">${escapeMarkup(target.label)} · seed ${escapeMarkup(seed)}</text>
      <text class="metric-label" x="16" y="198">${geometry.kinematics.arcLengthPx.toFixed(0)}px · ${geometry.timing.durationMs.toFixed(0)}ms · ${geometry.kinematics.normalizedPathHash}</text>`,
  };
}

function svgStyle() {
  return `<style>
    .reference-bg{fill:#101217}.reference-frame{fill:none;stroke:#2a3040;stroke-width:1}
    .target-surface{fill:#e9edf6;stroke:#75819b;stroke-width:1}.target-text{fill:#171b24;font:600 14px ui-sans-serif,system-ui}
    .marker-ink{fill:#ff4f8b;fill-opacity:.94;stroke:none;filter:drop-shadow(0 0 2px #ff4f8b55)}
    .safe-area{fill:#55e6a522;stroke:#55e6a5;stroke-width:1.5;stroke-dasharray:5 4}.safe-label{fill:#7df3bd;font:600 10px ui-monospace,monospace}
    .tail-start{fill:#fff;stroke:#101217;stroke-width:1}.tail-end{fill:#ffdb66;stroke:#101217;stroke-width:1}
    .seed-label{fill:#dfe5f3;font:600 12px ui-monospace,monospace}.metric-label{fill:#8994ab;font:11px ui-monospace,monospace}
    .sheet-title{fill:#f7f8fb;font:700 24px ui-sans-serif,system-ui}.sheet-subtitle{fill:#9aa5ba;font:12px ui-monospace,monospace}
    .contact-title{fill:#f7f8fb;font:700 18px ui-sans-serif,system-ui}.contact-meta{fill:#98a3b8;font:11px ui-monospace,monospace}
  </style>`;
}

function referenceVariantGroup(marker, target, seed, transform = '') {
  let content = referenceContent(marker, target, seed);
  return `<g data-reference-variant="true" data-target-kind="${target.id}" data-seed="${escapeMarkup(seed)}"${transform ? ` transform="${transform}"` : ''}>
    <rect class="reference-bg" width="${CELL_WIDTH}" height="${CELL_HEIGHT}" rx="12"/>
    <rect class="reference-frame" x=".5" y=".5" width="${CELL_WIDTH - 1}" height="${CELL_HEIGHT - 1}" rx="11.5"/>
    ${content.markup}
  </g>`;
}

export function renderPresenterMarkerReferenceSvg(marker, options = {}) {
  let target = options.targetSpec || PRESENTER_MARKER_REFERENCE_TARGETS[1];
  let seed = options.seed ?? PRESENTER_MARKER_REFERENCE_SEEDS[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CELL_WIDTH} ${CELL_HEIGHT}" role="img" aria-label="${escapeMarkup(marker)} marker reference">
    ${svgStyle()}
    ${referenceVariantGroup(marker, target, seed)}
  </svg>`;
}

export function renderPresenterMarkerReferenceSheet(marker, options = {}) {
  let targetSpecs = options.targetSpecs || PRESENTER_MARKER_REFERENCE_TARGETS;
  let seeds = options.seeds || PRESENTER_MARKER_REFERENCE_SEEDS;
  let width = CELL_WIDTH * seeds.length;
  let headingHeight = 70;
  let height = headingHeight + CELL_HEIGHT * targetSpecs.length;
  let variants = targetSpecs.flatMap((target, row) => seeds.map((seed, column) => (
    referenceVariantGroup(marker, target, seed, `translate(${column * CELL_WIDTH} ${headingHeight + row * CELL_HEIGHT})`)
  ))).join('');
  let catalog = PRESENTER_MARKER_CATALOG.find(({ name }) => name === marker);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeMarkup(marker)} marker reference sheet">
    ${svgStyle()}
    <rect class="reference-bg" width="${width}" height="${height}"/>
    <text class="sheet-title" x="24" y="32">${escapeMarkup(marker)}</text>
    <text class="sheet-subtitle" x="24" y="52">${escapeMarkup(catalog?.semantics || marker)} · ${escapeMarkup(catalog?.contractTier || '')} contract</text>
    ${variants}
  </svg>`;
}

function galleryVariant(marker, target, seed) {
  return `<figure data-gallery-variant data-target-kind="${target.id}" data-seed="${escapeMarkup(seed)}">
    ${renderPresenterMarkerReferenceSvg(marker, { targetSpec: target, seed })}
    <figcaption><span data-seed-label>${escapeMarkup(target.label)}</span><code>${escapeMarkup(seed)}</code></figcaption>
  </figure>`;
}

export function renderPresenterMarkerGalleryMarkup(options = {}) {
  let seeds = options.seeds || PRESENTER_MARKER_REFERENCE_SEEDS.slice(0, 2);
  return PRESENTER_MARKER_CATALOG.map((entry) => `<section class="marker-card" data-marker-card="${entry.name}">
    <header><div><span class="tier">${entry.contractTier}</span><h2>${entry.name}</h2></div><p>${escapeMarkup(entry.semantics)} · ${entry.safetyPolicy}</p></header>
    <div class="variant-grid">${PRESENTER_MARKER_REFERENCE_TARGETS.flatMap((target) => seeds.map((seed) => galleryVariant(entry.name, target, seed))).join('')}</div>
  </section>`).join('');
}

export function renderPresenterMarkerContactSheet(options = {}) {
  let columns = 4;
  let cellWidth = 400;
  let cellHeight = 280;
  let rows = Math.ceil(PRESENTER_MARKER_CATALOG.length / columns);
  let width = columns * cellWidth;
  let height = rows * cellHeight;
  let target = options.targetSpec || PRESENTER_MARKER_REFERENCE_TARGETS[1];
  let seed = options.seed ?? PRESENTER_MARKER_REFERENCE_SEEDS[0];
  let samples = PRESENTER_MARKER_CATALOG.map((entry, index) => {
    let column = index % columns;
    let row = Math.floor(index / columns);
    let { markup, geometry } = referenceContent(entry.name, target, seed);
    return `<g data-contact-marker="${entry.name}" transform="translate(${column * cellWidth} ${row * cellHeight})">
      <rect class="reference-bg" width="${cellWidth}" height="${cellHeight}"/>
      <text class="contact-title" x="16" y="28">${entry.name}</text>
      <text class="contact-meta" x="16" y="47">${entry.contractTier} · ${geometry.kinematics.normalizedPathHash}</text>
      <g transform="translate(0 58) scale(.625)">${markup}</g>
    </g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Presenter marker contact sheet">
    ${svgStyle()}
    <rect class="reference-bg" width="${width}" height="${height}"/>
    ${samples}
  </svg>`;
}

export function mountPresenterMarkerGallery(documentObject = document) {
  let gallery = documentObject.querySelector('[data-marker-gallery]');
  if (gallery) gallery.innerHTML = renderPresenterMarkerGalleryMarkup();
  let form = documentObject.querySelector('[data-reference-controls]');
  let preview = documentObject.querySelector('[data-interactive-preview]');
  if (!form || !preview) return;
  let markerSelect = form.elements.marker;
  let targetSelect = form.elements.target;
  let seedInput = form.elements.seed;
  markerSelect.innerHTML = PRESENTER_MARKER_CATALOG.map(({ name }) => `<option>${name}</option>`).join('');
  targetSelect.innerHTML = PRESENTER_MARKER_REFERENCE_TARGETS.map(({ id, label }) => `<option value="${id}">${label}</option>`).join('');
  let update = () => {
    let target = PRESENTER_MARKER_REFERENCE_TARGETS.find(({ id }) => id === targetSelect.value)
      || PRESENTER_MARKER_REFERENCE_TARGETS[1];
    preview.innerHTML = renderPresenterMarkerReferenceSvg(markerSelect.value, {
      targetSpec: target,
      seed: seedInput.value,
    });
  };
  form.addEventListener('input', update);
  targetSelect.value = 'wide';
  update();
}

if (typeof document !== 'undefined' && document.querySelector('[data-marker-gallery]')) {
  mountPresenterMarkerGallery(document);
}
