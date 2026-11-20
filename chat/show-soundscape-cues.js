/**
 * Sound cues of the presenter overlay, read from what it draws: the selection
 * frame appearing, the marker ink starting a stroke, the click ripple firing,
 * the visor going up or down. Observing the DOM keeps the sound independent of
 * the gesture code and works the same for the hose and the flying robot.
 *
 * @param {Element} overlay presenter cursor overlay
 * @param {(kind: string, detail?: object) => void} cue sound sink (see createShowSoundscape)
 * @returns {() => void} stop function
 */

const NEW_PLACE_PX = 40;
const STROKE_START = /M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/;
const PAN_SPAN = 0.8;

/** Stereo position of a screen x: the left edge is -0.8, the right edge 0.8. */
export const panOfX = (x, width) => (
  width > 0 ? Math.max(-1, Math.min(1, (x / width) * 2 - 1)) * PAN_SPAN : 0
);

export function watchPresenterCues(overlay, cue, sustain = () => {}) {
  const win = overlay.ownerDocument?.defaultView;
  const Observer = win?.MutationObserver || globalThis.MutationObserver;
  if (!Observer) return () => {};
  const marquee = overlay.querySelector('.pc-marquee');
  let marqueeShown = false;
  let marqueeOrigin = null;
  const strokeStart = new WeakMap();
  const lastLength = new WeakMap();
  const visor = new Map();
  // Layout is read at most once per element and frame: the observer fires on every
  // drawing update, and the show must not pay a layout flush for each of them.
  const raf = win.requestAnimationFrame?.bind(win) || ((fn) => setTimeout(fn, 16));
  const rects = new Map();
  const rectOf = (element) => {
    let box = rects.get(element);
    if (!box) {
      box = element.getBoundingClientRect();
      if (!rects.size) raf(() => rects.clear());
      rects.set(element, box);
    }
    return box;
  };
  const panOf = (element) => {
    const box = rectOf(element);
    return panOfX(box.left + box.width / 2, win.innerWidth);
  };

  const observer = new Observer((records) => {
    for (const record of records) {
      const target = record.target;
      if (record.type !== 'attributes' || !(target instanceof win.Element)) continue;
      if (marquee && marquee.contains(target)) {
        const shown = !marquee.classList.contains('pc-marquee-faded');
        const box = rectOf(marquee);
        const origin = { x: box.left, y: box.top };
        // A frame is a new selection when it appears, or when a shown frame
        // restarts small somewhere else (selections in a row never fade in between).
        const moved = marqueeOrigin && Math.hypot(origin.x - marqueeOrigin.x, origin.y - marqueeOrigin.y) > NEW_PLACE_PX;
        if (shown && (!marqueeShown || (moved && box.width < NEW_PLACE_PX))) {
          cue('select', { pan: panOf(marquee) });
          marqueeOrigin = origin;
        }
        if (shown && !marqueeOrigin) marqueeOrigin = origin;
        if (!shown) marqueeOrigin = null;
        marqueeShown = shown;
        // While the frame is drawn it keeps sounding; its size sets the pitch, low when it starts and high when it is large.
        if (shown && box.width > 2) sustain('drag', Math.max(box.width, box.height) / (win.innerWidth * 0.18), { pan: panOf(marquee) });
      } else if (record.attributeName === 'class' && target.classList.contains('pc-click')) {
        if (target.classList.contains('pc-click-fired') && !String(record.oldValue || '').includes('pc-click-fired')) cue('click', { pan: panOf(target) });
      } else if (record.attributeName === 'd' && target.parentNode?.classList?.contains('pc-ink')) {
        // Every new stroke sounds. Accumulated annotations keep earlier strokes in the
        // same path, so a stroke is a new subpath (`M`), a path drawn from empty, or
        // one that restarts elsewhere.
        const d = target.getAttribute('d') || '';
        const start = STROKE_START.exec(d);
        if (start) {
          const point = { x: Number(start[1]), y: Number(start[2]) };
          const strokes = (d.match(/M/g) || []).length;
          const before = strokeStart.get(target);
          if (!record.oldValue || !before || strokes > before.strokes
            || Math.hypot(point.x - before.x, point.y - before.y) > NEW_PLACE_PX) {
            cue('ink', { pan: panOf(target) });
          }
          strokeStart.set(target, { ...point, strokes });
          // The pen sounds while the path grows: its speed is the intensity.
          sustain('draw', (d.length - (lastLength.get(target) ?? d.length)) / 30 + 0.3, { pan: panOf(target) });
          lastLength.set(target, d.length);
        } else { strokeStart.delete(target); lastLength.delete(target); }
      } else if (record.attributeName === 'data-rig-mask') {
        const state = target.getAttribute('data-rig-mask');
        const before = visor.get(target) ?? 'up';
        if (state !== before) cue(state === 'down' ? 'visor-down' : 'visor-up');
        visor.set(target, state);
      }
    }
  });
  // Native text selection drawn by the show: a swipe for as long as it changes.
  const doc = overlay.ownerDocument;
  const onSelection = () => {
    if ((doc.getSelection?.()?.toString() || '').length > 0) sustain('swipe', 0.5);
  };
  doc.addEventListener('selectionchange', onSelection);
  observer.observe(overlay, {
    subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style', 'width', 'height', 'd', 'data-rig-mask'],
  });
  return () => { observer.disconnect(); doc.removeEventListener('selectionchange', onSelection); };
}
