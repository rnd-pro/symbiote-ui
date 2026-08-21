import {
  PRESENTER_HAND_PROFILE_VERSION,
  createPresenterCursor,
} from '../chat/presenter-cursor.js';

const samples = [
  { name: 'Pointer arrow', note: 'points to a registered input before typing', annotation: { intent: 'pointer' }, className: 'input', label: 'Ask the agent…', seed: 421 },
  { name: 'Compact outline', note: 'groups one small semantic region', annotation: { intent: 'group' }, className: 'small', label: 'WO 1009', seed: 422 },
  { name: 'Underline', note: 'calls out one title or value', annotation: { intent: 'detail' }, className: 'wide', label: 'Approval workflow', seed: 423 },
  { name: 'Freehand emphasis', note: 'brief marker emphasis below a compact area', annotation: { intent: 'emphasize' }, className: 'wide', label: 'Emergency process data', seed: 424 },
  { name: 'Focus frame', note: 'large regions use a dashed frame, not marker ink', focus: true, className: 'region', label: 'Workspace panel', seed: 425 },
  { name: 'Question', note: 'semantic symbol, never an enclosing highlight', annotation: { intent: 'question' }, className: 'small', label: 'Queue', seed: 426 },
  { name: 'Check', note: 'semantic confirmation symbol', annotation: { intent: 'success' }, className: 'small', label: 'Ready', seed: 427 },
  { name: 'Cross', note: 'semantic risk or rejection symbol', annotation: { intent: 'risk' }, className: 'small', label: 'Blocked', seed: 428 },
  { name: 'Heart', note: 'affinity symbol', annotation: { intent: 'affinity' }, className: 'small', label: 'Saved', seed: 429 },
  { name: 'Flourish', note: 'closing signature stroke', annotation: { intent: 'flourish' }, className: 'wide', label: 'Complete', seed: 430 },
];

const focus = new URLSearchParams(location.search).get('focus') || '';
const visibleSamples = focus === 'pointer'
  ? samples.filter((sample) => sample.annotation?.intent === 'pointer')
  : samples;
document.body.dataset.focus = focus;

const grid = document.querySelector('#grid');
const overlay = document.querySelector('#gesture-overlay');
document.querySelector('#profile').textContent = PRESENTER_HAND_PROFILE_VERSION;

for (const [index, sample] of visibleSamples.entries()) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `<h2>${sample.name}</h2><p>${sample.note}</p><div class="target ${sample.className || ''}" data-index="${index}">${sample.label}</div>`;
  grid.appendChild(card);
}

await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const cursor = createPresenterCursor(document);

for (const [index, sample] of visibleSamples.entries()) {
  const target = document.querySelector(`[data-index="${index}"]`);
  if (sample.focus) {
    const frame = cursor.presentFocusFrame(target, { mode: 'frame', elapsedMs: 600, viewport: { width: innerWidth, height: innerHeight } });
    const frameRect = frame.frameRect;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(frameRect.left));
    rect.setAttribute('y', String(frameRect.top));
    rect.setAttribute('width', String(frameRect.width));
    rect.setAttribute('height', String(frameRect.height));
    overlay.appendChild(rect);
    continue;
  }
  const frame = cursor.presentAnnotationFrame(target, sample.annotation, {
    progress: 1,
    seed: sample.seed,
    viewport: { width: innerWidth, height: innerHeight },
  });
  if (!frame.presented) {
    target.closest('.card').dataset.suppressed = frame.reason || 'suppressed';
    continue;
  }
  const source = document.querySelector('.pc-ink path');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', source?.getAttribute('d') || '');
  path.dataset.gesture = sample.name;
  path.dataset.digest = frame.pathDigest;
  overlay.appendChild(path);
}

cursor.dispose();
document.body.dataset.gestureLabReady = 'true';
