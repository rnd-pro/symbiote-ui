import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ShowAttentionController } from '../chat/show-attention.js';

function createFrameScheduler() {
  let nextId = 0;
  let callbacks = new Map();
  let now = 0;
  return {
    view: {
      performance: { timeOrigin: 1700000000000, now: () => now },
      requestAnimationFrame(callback) {
        let id = ++nextId;
        callbacks.set(id, callback);
        return id;
      },
      cancelAnimationFrame(id) { callbacks.delete(id); },
    },
    step(timestamp) {
      now = timestamp;
      let frame = [...callbacks.values()];
      callbacks.clear();
      for (let callback of frame) callback(timestamp);
    },
    get pending() { return callbacks.size; },
  };
}

function animatedTarget(view, id) {
  return { id, ownerDocument: { defaultView: view } };
}

// Natural composite: approach 200ms + action 400ms + hold 1000ms
// + home return 300ms = 1900ms.
function createPacingCursor({ actionDurationMs = 400, approachMs = 200, returnMs = 300 } = {}) {
  let focusElapsed = [];
  let approachElapsed = [];
  let completeHome;
  let home = new Promise((resolve) => { completeHome = resolve; });
  let cursor = {
    clear() {},
    planApproach: () => ({
      durationMs: approachMs,
      render: (elapsedMs) => approachElapsed.push(elapsedMs),
    }),
    planHomeReturn: () => ({ durationMs: returnMs }),
    presentFocusFrame: (_target, frame) => {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      if (!frame.planOnly) focusElapsed.push(elapsedMs);
      return {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v2',
        durationMs: actionDurationMs,
        revealProgress: Math.min(1, elapsedMs / actionDurationMs),
        normalizedPathHash: 'pacing-path',
        targetRect: { left: 1, top: 2, width: 100, height: 40 },
        cursor: { x: 40, y: 50 },
      };
    },
    whenHome: () => home,
  };
  return { cursor, focusElapsed, approachElapsed, completeHome: (status = { status: 'home' }) => completeHome(status) };
}

test('the authored budget fills approach, action and hold while the return stays outside it', async () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'frame');
  let { cursor, focusElapsed, approachElapsed, completeHome } = createPacingCursor();
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  let admissions = [];
  let milestones = [];
  let handle = attention.present({
    mode: 'frame',
    targetId: 'frame',
    budgetMs: 3000,
    onAdmission: (a) => admissions.push(a),
    onMilestone: (receipt) => milestones.push(receipt.milestone),
  });

  assert.equal(handle.presented, true);
  // 200 approach + 1800 action + 1000 hold + 2000 linger + 300 return.
  assert.equal(handle.durationMs, 5300, 'the release delay and return stay outside the authored budget');
  assert.equal(admissions[0].status, 'admitted');
  // Admission compares the action slot: 3000 - 200 approach - 1000 hold.
  assert.equal(admissions[0].budget.plannedDurationMs, 1800);
  assert.equal(admissions[0].budget.limitMs, 3000);

  // Approach occupies the first 200ms at natural speed.
  scheduler.step(1000);
  scheduler.step(1100);
  scheduler.step(1199);
  assert.deepEqual(approachElapsed, [0, 100, 199]);
  assert.deepEqual(focusElapsed, [], 'action has not started during approach');

  // Stretched action: paceFactor = 1800 / 400 = 4.5. At elapsed 1100 (900 into
  // the action) the natural elapsed is 200 => half drawn.
  scheduler.step(2100);
  let half = focusElapsed.at(-1);
  assert.ok(Math.abs(half - 200) < 1, `action half-drawn at mid slot, got ${half}`);

  // Drawing completes at elapsed 2000 and the full result is held for 1000ms.
  scheduler.step(2999);
  assert.ok(focusElapsed.at(-1) < 400, 'action still drawing just before its stretched end');
  scheduler.step(3000);
  assert.equal(focusElapsed.at(-1), 400, 'action reaches full draw at the stretched boundary');

  // The settled receipt fires when the authored slot ends (elapsed 3000); the
  // planned home return keeps rendering on the same clock without extending it.
  scheduler.step(3999);
  assert.deepEqual(milestones, ['first-frame'], 'not settled before the authored slot ends');
  scheduler.step(4000);
  assert.deepEqual(
    milestones,
    ['first-frame', 'settled'],
    'settled when the authored slot ends',
  );
  completeHome();
  let terminal = await attention.whenSettled();
  assert.equal(terminal.status, 'completed');
  attention.dispose();
});

test('a budget equal to the natural slot leaves the gesture unpaced', () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'frame');
  let { cursor, focusElapsed } = createPacingCursor();
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  // 200 approach + 400 action + 1000 hold + 2000 linger + 300 return is the natural slot.
  let handle = attention.present({ mode: 'frame', targetId: 'frame', budgetMs: 1600, onAdmission: () => {} });
  assert.equal(handle.durationMs, 3900);
  scheduler.step(1000);
  scheduler.step(1200);
  scheduler.step(1600);
  // Natural action speed: 400ms draw starts right after the 200ms approach.
  assert.ok(focusElapsed.includes(400), 'action completes at natural speed');
  attention.dispose();
});

test('a slot too small for the full hold clamps the hold and keeps the action at natural speed', () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'frame');
  let { cursor, focusElapsed } = createPacingCursor();
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  let admissions = [];
  let milestones = [];
  // 1200 cannot carry a stretched action plus a full second: the hold shrinks
  // to what the slot has left, the action is never compressed, and the
  // supervised window still fits the authored slot.
  let handle = attention.present({
    mode: 'frame',
    targetId: 'frame',
    budgetMs: 1200,
    onAdmission: (a) => admissions.push(a),
    onMilestone: (receipt) => milestones.push(receipt.milestone),
  });
  assert.equal(handle.presented, true);
  assert.equal(admissions[0].status, 'admitted');
  assert.equal(admissions[0].budget.plannedDurationMs, 400, 'the action keeps its natural duration');
  // 200 approach + 400 action + 600 hold fills the authored slot (1200); the
  // remaining release delay (2400) and the planned return (300) follow it.
  assert.equal(handle.durationMs, 3900);
  scheduler.step(1000);
  scheduler.step(1200);
  scheduler.step(1600);
  assert.ok(focusElapsed.includes(400), 'action completes at natural speed');
  scheduler.step(2199);
  assert.deepEqual(milestones, ['first-frame'], 'the result is still held');
  scheduler.step(2200);
  assert.deepEqual(
    milestones,
    ['first-frame', 'settled'],
    'the gesture settles when the authored slot ends',
  );
  attention.dispose();
});

test('a slot with room keeps the full legibility second and stretches the action', () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'frame');
  let { cursor, focusElapsed } = createPacingCursor();
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  let milestones = [];
  // 3150 carries 200 approach + 1912 action + 1000 hold: the selection is drawn
  // slowly and stays visible for a full second afterwards.
  let handle = attention.present({
    mode: 'frame',
    targetId: 'frame',
    budgetMs: 3150,
    onAdmission: () => {},
    onMilestone: (receipt) => milestones.push(receipt.milestone),
  });
  assert.equal(handle.durationMs, 5450);
  scheduler.step(1000);
  scheduler.step(2100);
  assert.ok(focusElapsed.at(-1) < 400, 'the action is stretched, not natural');
  scheduler.step(3200);
  assert.equal(focusElapsed.at(-1), 400, 'the stretched action reaches its end');
  scheduler.step(4149);
  assert.deepEqual(milestones, ['first-frame'], 'the full selection is still held');
  scheduler.step(4150);
  assert.deepEqual(
    milestones,
    ['first-frame', 'settled'],
    'the hold is released after its full second',
  );
  attention.dispose();
});

test('travel longer than the authored slot never rejects the gesture', () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'frame');
  let { cursor } = createPacingCursor({ approachMs: 2000, returnMs: 0 });
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  let admissions = [];
  let handle = attention.present({
    mode: 'frame',
    targetId: 'frame',
    budgetMs: 1200,
    onAdmission: (a) => admissions.push(a),
  });
  // Travel alone exceeds the slot; the gesture is still admitted at natural speed
  // instead of being rejected as `budget-exceeded`.
  assert.equal(handle.presented, true);
  assert.equal(admissions[0].status, 'admitted');
  assert.equal(admissions[0].reason.code, 'within-budget');
  assert.equal(admissions[0].budget.plannedDurationMs, 400);
  attention.dispose();
});

test('paced gesture survives pause, resume and seek without jumping the action', async () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'frame');
  let { cursor, focusElapsed, completeHome } = createPacingCursor();
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  attention.present({ mode: 'frame', targetId: 'frame', budgetMs: 3000, onAdmission: () => {} });

  scheduler.step(1000);
  scheduler.step(1500);
  let beforePause = focusElapsed.at(-1);
  attention.pause();
  scheduler.step(1800);
  assert.equal(focusElapsed.at(-1), beforePause, 'pause freezes the stretched action');
  attention.resume();
  scheduler.step(1800);
  scheduler.step(2200);
  assert.ok(focusElapsed.at(-1) > beforePause, 'resume continues the stretched action');

  // The action slot ends at 3000ms (200 approach + 1800 action + 1000 hold).
  attention.seek(1500);
  assert.ok(focusElapsed.at(-1) < 400, 'seek before the action end keeps the drawing open');
  attention.seek(2000);
  assert.equal(focusElapsed.at(-1), 400, 'seek maps composite time back to natural action time');
  scheduler.step(3000);
  scheduler.step(4400);
  completeHome();
  let terminal = await attention.whenSettled();
  assert.equal(terminal.status, 'completed');
  attention.dispose();
});
test('planned return shares pause and seek clock and settles once at the gesture window end', async () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'frame');
  let { cursor, focusElapsed } = createPacingCursor();
  let returns = [];
  let milestones = [];
  cursor.planHomeReturn = () => ({
    durationMs: 300,
    render: (elapsedMs) => returns.push(elapsedMs),
  });
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  attention.present({
    mode: 'frame', targetId: 'frame', budgetMs: 3000,
    onAdmission: () => {},
    onMilestone: (receipt) => milestones.push(receipt.milestone),
  });
  scheduler.step(0);
  scheduler.step(1999);
  assert.ok(focusElapsed.at(-1) < 400, 'the action is still drawing inside its slot');
  assert.equal(returns.length, 0);
  scheduler.step(2000);
  assert.equal(focusElapsed.at(-1), 400, 'the drawing completes at the end of its slot');
  assert.equal(returns.length, 0, 'the full result stays visible for a second');
  scheduler.step(2999);
  assert.equal(returns.length, 0, 'the in-window hold is still running');
  scheduler.step(3000);
  assert.deepEqual(milestones, ['first-frame', 'settled'], 'settled at the authored window end');
  assert.equal(returns.length, 0, 'the release delay keeps the selection parked after settle');
  scheduler.step(4999);
  assert.equal(returns.length, 0, 'still parked just before the three-second delay ends');
  scheduler.step(5000);
  assert.equal(returns.length, 1, 'the return starts after the full release delay');
  assert.equal(returns.at(-1), 0, 'the return starts at its own zero');
  scheduler.step(5100);
  assert.equal(returns.at(-1), 100, 'the return keeps its own clock');
  attention.pause();
  scheduler.step(9000);
  assert.equal(returns.at(-1), 100);
  attention.seek(500);
  assert.ok(focusElapsed.at(-1) < 400);
  attention.seek(5000);
  assert.ok(returns.length >= 2, 'seeking to the release start restarts the return');
  attention.resume();
  scheduler.step(10000);
  scheduler.step(10300);
  let terminal = await attention.whenSettled();
  assert.equal(returns.at(-1), 300, 'the return reaches its planned end');
  assert.equal(terminal.status, 'completed');
  assert.deepEqual(milestones, ['first-frame', 'settled']);
  attention.dispose();
});

test('click effect keeps natural duration while spare budget becomes hold; cancel stops return', async () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'click');
  let { cursor } = createPacingCursor();
  let clickFrames = [];
  let returns = [];
  cursor.presentClickFrame = (_target, frame) => {
    if (!frame.planOnly) clickFrames.push(frame.elapsedMs);
    return {
      presented: true, durationMs: 200, cursor: { x: 40, y: 50 },
      planVersion: 'symbiote-presenter-kinematics-v2',
      normalizedPathHash: '',
      targetRect: { left: 1, top: 2, width: 100, height: 40 },
      hotspot: { x: 40, y: 50 },
    };
  };
  cursor.presentCursorFrame = () => ({ presented: true });
  cursor.planHomeReturn = () => ({
    durationMs: 300, render: (elapsedMs) => returns.push(elapsedMs),
  });
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  attention.present({ mode: 'click', targetId: 'click', budgetMs: 3000, onAdmission() {} });
  scheduler.step(0);
  scheduler.step(200);
  scheduler.step(400);
  assert.deepEqual(clickFrames, [0, 200]);
  scheduler.step(2699);
  assert.equal(clickFrames.at(-1), 200);
  assert.equal(returns.length, 0);
  scheduler.step(2800);
  assert.equal(returns.at(-1), 100, 'the planned return starts after the click hold');
  attention.cancel('test-stop');
  let terminal = await attention.whenSettled();
  assert.equal(terminal.status, 'completed', 'the authored click completed at its window end');
  let before = returns.length;
  scheduler.step(9000);
  assert.equal(returns.length, before, 'cancel stops the housekeeping return');
  attention.dispose();
});

test('paced frame opts the projector into continuous sampling; an unpaced frame does not', () => {
  let run = (budgetMs) => {
    let scheduler = createFrameScheduler();
    let target = animatedTarget(scheduler.view, 'frame');
    let observed = [];
    let cursor = {
      clear() {},
      planApproach: () => ({ durationMs: 200, render() {} }),
      planHomeReturn: () => ({ durationMs: 300, render() {} }),
      whenHome: () => Promise.resolve({ status: 'home' }),
      presentFocusFrame: (_target, frame) => {
        if (!frame.planOnly && Number(frame.elapsedMs) > 0) observed.push(frame.continuous === true);
        return {
          presented: true,
          durationMs: 400,
          revealProgress: Math.min(1, (Number(frame.elapsedMs) || 0) / 400),
          planVersion: 'symbiote-presenter-kinematics-v2',
          normalizedPathHash: 'continuous-path',
          targetRect: { left: 0, top: 0, width: 100, height: 40 },
          cursor: { x: 1, y: 1 },
        };
      },
    };
    let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
    attention.present({ mode: 'frame', targetId: 'frame', budgetMs, onAdmission() {} });
    scheduler.step(0);
    scheduler.step(400);
    scheduler.step(800);
    attention.dispose();
    return observed;
  };

  let paced = run(3000);
  assert.ok(paced.length > 0, 'the stretched action rendered frames');
  assert.ok(
    paced.every((continuous) => continuous === true),
    'every paced frame render requests continuous interpolation',
  );

  // 1600 is the natural slot: 200 approach + 400 action + 1000 hold.
  let unpaced = run(1600);
  assert.ok(unpaced.length > 0, 'the natural action rendered frames');
  assert.ok(
    unpaced.every((continuous) => continuous === false),
    'an unpaced frame keeps the scheduled 30 FPS projector',
  );
});

test('native selection return uses final endpoint and retains cleanup after backward seek', async () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'text');
  let { cursor } = createPacingCursor();
  let clears = 0;
  let origin;
  cursor.presentCursorFrame = (_target, frame) => ({ presented: true, cursor: frame.point });
  cursor.planHomeReturn = (_target, receipt) => {
    origin = receipt.cursor;
    return { durationMs: 300, render() {} };
  };
  let receipt = {
    presented: true, durationMs: 400, progress: 0,
    planVersion: 'symbiote-presenter-kinematics-v2', normalizedPathHash: 'text-path',
    targetRect: { left: 0, top: 0, width: 100, height: 20 },
    cursor: { x: 0, y: 0, visible: true }, finalCursor: { x: 100, y: 20 },
  };
  let attention = new ShowAttentionController({
    cursor, resolveTarget: () => target,
    selectText: () => ({
      receipt,
      presentFrame: () => receipt,
      clear: () => { clears += 1; },
    }),
  });
  attention.present({
    mode: 'native-selection', targetId: 'text', budgetMs: 3000, onAdmission() {},
  });
  assert.deepEqual(origin, receipt.finalCursor);
  scheduler.step(0);
  // The authored slot is 3000ms (200 approach + 1800 action + 1000 hold) plus
  // a 2000ms release delay; the selection is released and cleaned up only
  // after the full three-second post-action pause.
  attention.seek(2800);
  assert.equal(clears, 0, 'the selection is still held inside its slot');
  attention.seek(4800);
  assert.equal(clears, 0, 'the selection stays parked through the release delay');
  attention.seek(5000);
  assert.equal(clears, 1);
  attention.seek(500);
  attention.reset('stop-after-seek');
  assert.equal(clears, 2);
  assert.equal((await attention.whenSettled()).status, 'cancelled');
  attention.dispose();
});
