import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

class TestCSSStyleSheet {
  replaceSync(text) {
    this.cssText = text;
  }
}

class TestResizeObserver {
  observe() {}
  disconnect() {}
}

class TestCanvasContext {
  setTransform() {}
  clearRect() {}
  fillRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  fill() {}
  arcTo() {}
  closePath() {}
  save() {}
  clip() {}
  restore() {}
  setLineDash() {}
  fillText() {}
  measureText(text) {
    return { width: String(text).length * 6 };
  }
}

let testWindow = null;

function installDom() {
  if (testWindow) {
    document.body.innerHTML = '';
    return;
  }
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  testWindow = window;
  class TestCustomEvent extends window.CustomEvent {
    constructor(type, init = {}) {
      super(type, init);
      Object.defineProperty(this, 'composed', { value: init.composed === true });
    }
  }
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: TestCustomEvent,
    MutationObserver: window.MutationObserver,
    customElements: window.customElements,
    CSSStyleSheet: TestCSSStyleSheet,
    ResizeObserver: TestResizeObserver,
    requestAnimationFrame: (callback) => setTimeout(() => callback(performance.now()), 0),
    cancelAnimationFrame: (handle) => clearTimeout(handle),
    getComputedStyle: (element) => ({
      getPropertyValue(name) {
        return element.style?.getPropertyValue?.(name) || '';
      },
    }),
  });
  window.document.adoptedStyleSheets = [];
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    this.__context ||= new TestCanvasContext();
    return this.__context;
  };
  window.HTMLElement.prototype.setPointerCapture = function setPointerCapture(pointerId) {
    this.__capturedPointerId = pointerId;
  };
  window.HTMLElement.prototype.hasPointerCapture = function hasPointerCapture(pointerId) {
    return this.__capturedPointerId === pointerId;
  };
  window.HTMLElement.prototype.releasePointerCapture = function releasePointerCapture(pointerId) {
    if (this.__capturedPointerId === pointerId) this.__capturedPointerId = null;
  };
}

function pointerEvent(type, values = {}) {
  let event = new Event(type, { bubbles: true, cancelable: true, composed: true });
  Object.defineProperties(event, {
    pointerId: { value: values.pointerId ?? 1 },
    isPrimary: { value: values.isPrimary ?? true },
    button: { value: values.button ?? 0 },
    clientX: { value: values.clientX ?? 0 },
    clientY: { value: values.clientY ?? 0 },
  });
  return event;
}

async function renderTick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function createEditor(data) {
  installDom();
  await import('../timeline/TimelineEditor/TimelineEditor.js');
  let editor = document.createElement('sn-timeline-editor');
  document.body.append(editor);
  await renderTick();
  Object.defineProperties(editor.ref.timelineScroll, {
    clientWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 180 },
  });
  editor.ref.timelineScroll.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 180,
  });
  editor.loadTimeline(data);
  await renderTick();
  return editor;
}

function clipHit(editor, clipId) {
  return editor.querySelector(`.te-clip-hit[data-clip-id="${clipId}"]`);
}

function drag(hit, { pointerId = 1, from = 0, to = 0, endType = 'pointerup' } = {}) {
  hit.dispatchEvent(pointerEvent('pointerdown', { pointerId, clientX: from }));
  hit.dispatchEvent(pointerEvent('pointermove', { pointerId, clientX: to }));
  hit.dispatchEvent(pointerEvent(endType, { pointerId, clientX: to }));
}

test('timeline clip drag captures one primary pointer and emits one semantic commit', async () => {
  let sourceData = {
    fps: 30,
    duration: 100,
    tracks: [{
      id: 'video',
      label: 'Video',
      clips: [{ id: 'intro', label: 'Intro', start: 10, end: 20 }],
    }],
  };
  let editor = await createEditor(sourceData);
  let hit = clipHit(editor, 'intro');
  assert.ok(hit, 'canvas clips expose an accessible semantic hit target');
  assert.equal(hit.tagName, 'BUTTON');
  assert.match(hit.getAttribute('aria-label'), /Intro/);

  let moves = [];
  let selections = 0;
  editor.addEventListener('clip-move', (event) => moves.push(event));
  editor.addEventListener('clip-select', () => { selections += 1; });

  hit.dispatchEvent(pointerEvent('pointerdown', {
    pointerId: 6,
    isPrimary: false,
    clientX: 40,
  }));
  assert.equal(hit.hasPointerCapture(6), false, 'a non-primary pointer cannot own the drag');

  hit.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7, clientX: 40 }));
  assert.equal(hit.hasPointerCapture(7), true);
  hit.dispatchEvent(pointerEvent('pointermove', { pointerId: 8, clientX: 200 }));
  hit.dispatchEvent(pointerEvent('pointermove', { pointerId: 7, clientX: 60 }));
  hit.dispatchEvent(pointerEvent('pointerup', { pointerId: 7, clientX: 60 }));
  hit.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
  await renderTick();

  assert.equal(moves.length, 1);
  assert.equal(moves[0].bubbles, true);
  assert.equal(moves[0].composed, true);
  assert.equal(moves[0].cancelable, true);
  assert.deepEqual(moves[0].detail, {
    clipId: 'intro',
    trackId: 'video',
    start: 15,
    end: 25,
    previousStart: 10,
    previousEnd: 20,
    deltaFrames: 5,
    fps: 30,
    source: 'pointer',
    phase: 'commit',
  });
  assert.deepEqual(editor.timelineData.tracks[0].clips[0], {
    id: 'intro',
    label: 'Intro',
    start: 10,
    end: 20,
  });
  assert.deepEqual(sourceData.tracks[0].clips[0], {
    id: 'intro',
    label: 'Intro',
    start: 10,
    end: 20,
  });
  assert.equal(hit.style.left, '40px');
  assert.equal(selections, 0, 'the compatibility click after a drag is suppressed');
  editor.remove();
});

test('timeline clip drag clamps frames and cancels without mutating host data', async () => {
  let editor = await createEditor({
    fps: 24,
    duration: 100,
    tracks: [{
      id: 'events',
      label: 'Events',
      clips: [
        { id: 'editable', label: 'Editable', start: 80, end: 90 },
        { id: 'generated', label: 'Generated', start: 10, end: 20, generated: true },
        { id: 'readonly', label: 'Read only', start: 30, end: 40, editable: false },
      ],
    }],
  });
  let moves = [];
  editor.addEventListener('clip-move', (event) => moves.push(event));

  drag(clipHit(editor, 'editable'), { from: 320, to: 520 });
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].detail, {
    clipId: 'editable',
    trackId: 'events',
    start: 90,
    end: 100,
    previousStart: 80,
    previousEnd: 90,
    deltaFrames: 10,
    fps: 24,
    source: 'pointer',
    phase: 'commit',
  });

  drag(clipHit(editor, 'editable'), {
    pointerId: 2,
    from: 320,
    to: 280,
    endType: 'pointercancel',
  });
  drag(clipHit(editor, 'generated'), { pointerId: 3, from: 40, to: 80 });
  drag(clipHit(editor, 'readonly'), { pointerId: 4, from: 120, to: 160 });
  await renderTick();

  assert.equal(moves.length, 1);
  assert.equal(clipHit(editor, 'generated').getAttribute('aria-disabled'), 'true');
  assert.equal(clipHit(editor, 'readonly').getAttribute('aria-disabled'), 'true');
  assert.deepEqual(
    editor.timelineData.tracks[0].clips.map(({ start, end }) => ({ start, end })),
    [{ start: 80, end: 90 }, { start: 10, end: 20 }, { start: 30, end: 40 }],
  );
  editor.remove();
});

test('timeline drag is cancelled by lost capture, rehydrate, prevented commit, and disconnect', async () => {
  let editor = await createEditor({
    fps: 30,
    duration: 100,
    tracks: [{
      id: 'video',
      label: 'Video',
      clips: [{ id: 'intro', label: 'Intro', start: 10, end: 20 }],
    }],
  });
  let moves = [];
  let hit = clipHit(editor, 'intro');
  editor.addEventListener('clip-move', (event) => {
    moves.push(event);
    event.preventDefault();
  });

  hit.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 40 }));
  hit.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 60 }));
  hit.dispatchEvent(pointerEvent('lostpointercapture', { pointerId: 1, clientX: 60 }));
  hit.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 60 }));
  assert.equal(moves.length, 0);

  hit.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientX: 40 }));
  hit.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 60 }));
  editor.loadTimeline(editor.timelineData);
  hit.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 60 }));
  assert.equal(moves.length, 0);

  await renderTick();
  hit = clipHit(editor, 'intro');
  drag(hit, { pointerId: 3, from: 40, to: 60 });
  await renderTick();
  assert.equal(moves.length, 1);
  assert.equal(moves[0].defaultPrevented, true);
  assert.equal(clipHit(editor, 'intro').style.left, '40px');
  assert.equal(editor.timelineData.tracks[0].clips[0].start, 10);

  hit = clipHit(editor, 'intro');
  hit.dispatchEvent(pointerEvent('pointerdown', { pointerId: 4, clientX: 40 }));
  hit.dispatchEvent(pointerEvent('pointermove', { pointerId: 4, clientX: 60 }));
  editor.remove();
  hit.dispatchEvent(pointerEvent('pointerup', { pointerId: 4, clientX: 60 }));
  assert.equal(moves.length, 1);
});
