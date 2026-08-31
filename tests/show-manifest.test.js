import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';

import {
  SHOW_EVENT_SCHEMA,
  SHOW_RUNTIME_CONTRACT,
  getShowRuntimeContract,
  getUiSchema,
} from '../manifest/index.js';
import { createShowEvent } from '../chat/show-contracts.js';
import * as showRuntime from '../chat/show-runtime.js';
import { PRESENTER_INK_DRAW_SPEED_PX_PER_MS } from '../chat/presenter-cursor.js';

test('Show manifest, schema catalog, and JSON file expose one synchronized public contract', async () => {
  let fileSchema = JSON.parse(await readFile(new URL('../schemas/show-event-v1.json', import.meta.url), 'utf8'));
  assert.deepEqual(SHOW_EVENT_SCHEMA, fileSchema);
  assert.deepEqual(getUiSchema('show-event-v1'), fileSchema);
  assert.equal(getShowRuntimeContract(), SHOW_RUNTIME_CONTRACT);
  assert.equal(SHOW_RUNTIME_CONTRACT.specifier, 'symbiote-ui/chat/show-runtime');
  assert.equal(showRuntime.SHOW_ATTENTION_ADMISSION_VERSION, 'show-attention-admission-v2');
  assert.equal(showRuntime.SHOW_ATTENTION_MILESTONE_VERSION, 'show-attention-milestone-v2');
  assert.equal(showRuntime.SHOW_ATTENTION_TERMINAL_VERSION, 'show-attention-terminal-v2');
  assert.equal(showRuntime.SHOW_ATTENTION_PROVIDER_VERSION, 'show-attention-provider-v1');
  assert.equal(typeof showRuntime.createShowAttentionAdmission, 'function');
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.markerAliases, { ovals: 'multi-oval' });
  assert.ok(SHOW_RUNTIME_CONTRACT.markerShapes.includes('underline'));
  assert.ok(SHOW_RUNTIME_CONTRACT.markerShapes.includes('box'));
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.attentionIntents, ['emphasize', 'detail', 'group', 'pointer', 'risk', 'question', 'success', 'affinity', 'flourish']);
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.mediaModes, [
    'short-muted-montage',
    'short-inline-continuous',
    'full-with-media-audio',
  ]);
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.mediaInteractionSemantics, {
    'short-muted-montage': 'pointer-only',
    'short-inline-continuous': 'pointer-only',
    'full-with-media-audio': 'detail',
  });
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.mediaPlayback, {
    directiveFields: ['startMs', 'endMs', 'segments', 'segmentDurationMs', 'frames', 'frameHoldMs', 'finalFrame', 'keepPlayingDuringQuote'],
    targetHooks: ['captureShowMediaState', 'applyShowMediaPolicy', 'playShowMedia', 'pauseShowMedia', 'restoreShowMediaState'],
    nativeTarget: 'HTMLMediaElement',
    boundedCancellation: ['start', 'stop', 'replacement'],
    continuousMode: 'short-inline-continuous',
    hookContext: 'immutable-operation-id-and-abort-signal',
    lifecycleOwnership: 'serialized-startup-and-teardown',
    cleanupFailure: 'failure-independent-aggregate-error',
    audioAcquisition: 'generation-safe-latest-request-wins',
    nativeRestoration: 'captured-paused-state-including-resume',
  });
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('stable-chat-show-player-with-inline-and-native-panel-projections'));
  assert.equal(SHOW_RUNTIME_CONTRACT.chatComposition.embedPart, 'transcript-receipt-for-stable-player');
  assert.equal(SHOW_RUNTIME_CONTRACT.chatComposition.playerPlacement, 'inline-or-native-layout-panel');
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.chatComposition.playerPlacementModes, ['inline', 'panel']);
  assert.equal(SHOW_RUNTIME_CONTRACT.chatComposition.playerPlacementLifecycle, 'same-live-player-reparented-without-controller-recreation');
  assert.equal(SHOW_RUNTIME_CONTRACT.chatComposition.playerResponsiveFallback, 'native-panel-closes-to-inline-before-mobile-drawer');
  assert.equal(SHOW_RUNTIME_CONTRACT.chatComposition.responsiveShell.desktop, 'single-panel-layout-split-with-native-resizer-and-collapse');
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.chatComposition.responsiveShell.mobile, ['panel-layout-drawer']);
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.chatComposition.videoControlSemantics, ['detail', 'pointer-only']);
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.audioAlignment, {
    inputVersion: 'workspace-aligned-sequence-v3',
    resolutions: ['exact', 'occurrence', 'segment'],
    clock: 'media.currentTime',
    fallback: 'recognized-segment-boundary',
    interpolation: false,
    ownedSeek: {
      success: 'physically-observed-near-requested-position',
      initialZeroForNonzeroCheckpoint: 'not-success',
      retries: 'bounded-readiness-and-progress-events',
      failureCallback: 'onSeekFailure',
    },
    atomicLoad: {
      method: 'loadAndRestorePlayback',
      ownership: 'listeners-source-load-metadata-current-data-seek',
      success: 'generation-current-data-and-physical-seek-complete',
      terminalReceipt: 'immutable-promise-receipt',
      nonSuccessCallback: 'onSeekFailure',
    },
    playbackClock: {
      source: 'media.currentTime',
      nativeTrigger: 'timeupdate',
      fallback: 'lifecycle-bound-250ms-sample',
      directNativePlay: true,
      stops: ['pause', 'ended', 'error', 'waiting', 'seeking', 'source-reset', 'document-hidden', 'dispose'],
    },
  });
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.attentionAnimation, {
    clock: 'performance-time-origin-with-raf-or-performance-now-monotonic-time',
    timing: 'profile-specific-arc-length-motion-with-hard-budget',
    geometry: 'adaptive-geometric-tolerance-centripetal-smoothing-and-normalized-arc-seeded-noise',
    width: 'speed-curvature-and-pressure-derived-ribbon',
    completion: 'settled-visible-until-replaced-or-cleared',
    settlementReceipt: 'show-attention-terminal-v2-with-exact-nested-provider-evidence',
    cursorTravel: 'shared-arc-length-minimum-jerk-planner-with-hard-budget-speed-ceiling',
    speedLimitsPxPerMs: { minimumMoving: 1.6, target: 3, maximum: 3 },
    speedLimitsScope: 'cursor-travel',
    markerInk: {
      motionProfile: 'constant-speed',
      speedPxPerMs: 0.471,
      duration: 'arc-length-divided-by-speed',
      cap: 'rounded',
      enclosingTail: 'displaced-overlap-with-lateral-offset',
    },
    minimumDurationMs: 220,
    admission: {
      version: 'show-attention-admission-v2',
      callback: 'onAdmission',
      provider: {
        id: 'symbiote-ui/show-attention',
        version: 'show-attention-provider-v1',
      },
      namespaces: ['provider', 'effect', 'target', 'budget', 'plan', 'reason'],
      budget: 'explicit-budgetMs-hard-maximum',
      phase: 'immutable-provider-zero-progress-plan-before-any-visual-mutation',
      statuses: ['admitted', 'rejected'],
      requiredIdentities: ['target', 'layout', 'geometry', 'plan'],
      pathIdentity: 'required-except-truthful-non-path-click',
      rejection: 'exact-structured-provider-reason-no-visual-milestone',
    },
    milestones: {
      version: 'show-attention-milestone-v2',
      callback: 'onMilestone',
      sequence: ['first-frame', 'settled'],
      firstFrame: 'first-provider-render-raf-or-synchronous-terminal-render',
      settled: 'terminal-visual-settlement-only',
      observedAt: 'performance-time-origin-and-monotonic-time',
      providerReceipt: 'exact-immutable-nested-render-evidence',
      workspaceIdentity: 'none',
    },
    terminal: {
      version: 'show-attention-terminal-v2',
      callback: 'onTerminal-and-whenSettled',
      statuses: ['completed', 'rejected', 'cancelled', 'failed'],
      observedAt: 'performance-time-origin-and-monotonic-time',
      providerReceipt: 'exact-immutable-nested-plan-or-render-evidence',
      workspaceIdentity: 'none',
    },
    enclosingTail: 'displaced-overlap-with-rounded-separated-caps',
    markerPersistence: 'accumulate-after-settle',
    controls: ['pause', 'resume', 'seek', 'capture-state', 'restore-state', 'reset'],
    cancellation: ['replacement', 'cancel', 'seek-reset', 'branch-reset', 'dispose'],
    reducedMotion: 'immediate-final-semantic-state',
    consumerInput: [
      'intent',
      'target',
      'style',
      'seed',
      'gestureId',
      'cueTimeMs',
      'mediaTimeMs',
      'budgetMs',
      'targetIdentity',
      'layoutIdentity',
      'geometryIdentity',
      'onAdmission',
      'onMilestone',
      'onTerminal',
    ],
  });
  assert.equal(
    SHOW_RUNTIME_CONTRACT.attentionAnimation.markerInk.speedPxPerMs,
    PRESENTER_INK_DRAW_SPEED_PX_PER_MS,
  );
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.visualSettlement, {
    helper: 'waitForShowVisualSettlement',
    ordering: 'reveal-or-scroll-then-terminal-settlement-then-attention',
    scrollCompletion: 'latest-native-scrollend-plus-stable-rect-and-offsets',
    transformCompletion: 'stable-target-rect',
    timeout: 'progress-aware-inactivity-bound',
    cancellation: 'abort-signal-owned',
  });
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.actionLifecycle.phases, ['inspect', 'reveal', 'transition', 'target', 'act', 'restore']);
  assert.equal(SHOW_RUNTIME_CONTRACT.actionLifecycle.restoration, 'only-provider-owned-change-without-user-supersession');
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('provider-owned-presenter-animation'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('arc-length-natural-presenter-kinematics'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('progressive-native-selection'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('geometry-aware-hard-budget-admission'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('actual-attention-milestone-receipts'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('bounded-owned-media-seek'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('atomic-owned-media-load-generation'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('runtime-owned-media-playback-clock'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('custom-show-media-targets'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('abortable-bounded-media-choreography'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('continuous-inline-media'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('visual-settlement-before-attention'));
});

test('show-event-v1 validates normalized canonical marker and media events', () => {
  let ajv = new Ajv2020({ strict: true });
  let validate = ajv.compile(SHOW_EVENT_SCHEMA);
  let markerEvent = createShowEvent({ type: 'attention', mode: 'marker', targetId: 'target', marker: 'ovals' });
  let mediaEvent = createShowEvent({
    type: 'media',
    mediaId: 'clip',
    mode: 'short-inline-continuous',
    segments: [0.2, 0.5, 0.8],
    segmentDurationMs: 120,
    frames: [1, 4, 7],
    frameHoldMs: 80,
    finalFrame: 9,
    keepPlayingDuringQuote: true,
  });
  assert.equal(validate(markerEvent), true, JSON.stringify(validate.errors));
  assert.equal(validate(mediaEvent), true, JSON.stringify(validate.errors));

  let duplicateSegments = JSON.parse(JSON.stringify(mediaEvent));
  duplicateSegments.directive.segments = [0.2, 0.2];
  assert.equal(validate(duplicateSegments), false, 'schema rejects duplicate segment fractions');

  let outOfRangeSegments = JSON.parse(JSON.stringify(mediaEvent));
  outOfRangeSegments.directive.segments = [0, 0.5];
  assert.equal(validate(outOfRangeSegments), false, 'schema rejects fractions outside the open interval');

  let unorderedSegments = JSON.parse(JSON.stringify(mediaEvent));
  unorderedSegments.directive.segments = [0.8, 0.2];
  assert.equal(validate(unorderedSegments), true, JSON.stringify(validate.errors));

  let missingSpeechText = {
    version: 'symbiote-show-v1',
    type: 'show:speech',
    sequence: 0,
    timestampMs: 0,
    directive: { version: 'symbiote-show-v1', type: 'speech' },
  };
  assert.equal(validate(missingSpeechText), false, 'speech requires its canonical text field');

  let mediaFieldOnSpeech = createShowEvent({ type: 'speech', text: 'Canonical speech' });
  mediaFieldOnSpeech = JSON.parse(JSON.stringify(mediaFieldOnSpeech));
  mediaFieldOnSpeech.directive.segments = [0.2, 0.5];
  assert.equal(validate(mediaFieldOnSpeech), false, 'speech rejects media-only fields');

  let mismatchedEnvelope = JSON.parse(JSON.stringify(mediaEvent));
  mismatchedEnvelope.type = 'show:speech';
  assert.equal(validate(mismatchedEnvelope), false, 'envelope type is coupled to directive type');
});
