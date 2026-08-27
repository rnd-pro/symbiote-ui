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

test('Show manifest, schema catalog, and JSON file expose one synchronized public contract', async () => {
  let fileSchema = JSON.parse(await readFile(new URL('../schemas/show-event-v1.json', import.meta.url), 'utf8'));
  assert.deepEqual(SHOW_EVENT_SCHEMA, fileSchema);
  assert.deepEqual(getUiSchema('show-event-v1'), fileSchema);
  assert.equal(getShowRuntimeContract(), SHOW_RUNTIME_CONTRACT);
  assert.equal(SHOW_RUNTIME_CONTRACT.specifier, 'symbiote-ui/chat/show-runtime');
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.markerAliases, { ovals: 'multi-oval' });
  assert.ok(SHOW_RUNTIME_CONTRACT.markerShapes.includes('underline'));
  assert.ok(SHOW_RUNTIME_CONTRACT.markerShapes.includes('box'));
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.attentionIntents, ['emphasize', 'detail', 'group', 'pointer', 'risk', 'question', 'success', 'affinity', 'flourish']);
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.mediaModes, ['short-muted-montage', 'full-with-media-audio']);
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.mediaInteractionSemantics, {
    'short-muted-montage': 'pointer-only',
    'full-with-media-audio': 'detail',
  });
  assert.equal(SHOW_RUNTIME_CONTRACT.chatComposition.playerPlacement, 'fixed-lower-region-outside-transcript-scroll');
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
    clock: 'requestAnimationFrame-callback-timestamp',
    timing: 'arc-length-minimum-jerk-with-human-speed-ceiling',
    geometry: 'adaptive-geometric-tolerance-centripetal-smoothing-and-normalized-arc-seeded-noise',
    width: 'speed-curvature-and-pressure-derived-ribbon',
    completion: 'settled-visible-until-replaced-or-cleared',
    settlementReceipt: 'plan-version-cue-media-first-frame-and-actual-settled-time-with-normalized-path-hash',
    cursorTravel: 'shared-arc-length-minimum-jerk-planner-with-human-speed-ceiling',
    speedLimitsPxPerMs: { minimumMoving: 0.14, target: 0.3, maximum: 0.454 },
    enclosingTail: 'displaced-overlap-with-visible-offset',
    markerPersistence: 'accumulate-after-settle',
    controls: ['pause', 'resume', 'seek', 'capture-state', 'restore-state', 'reset'],
    cancellation: ['replacement', 'cancel', 'seek-reset', 'branch-reset', 'dispose'],
    reducedMotion: 'immediate-final-semantic-state',
    consumerInput: ['intent', 'target', 'style', 'seed', 'gestureId', 'cueTimeMs', 'mediaTimeMs'],
  });
  assert.deepEqual(SHOW_RUNTIME_CONTRACT.actionLifecycle.phases, ['inspect', 'reveal', 'transition', 'target', 'act', 'restore']);
  assert.equal(SHOW_RUNTIME_CONTRACT.actionLifecycle.restoration, 'only-provider-owned-change-without-user-supersession');
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('provider-owned-presenter-animation'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('arc-length-natural-presenter-kinematics'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('progressive-native-selection'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('bounded-owned-media-seek'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('atomic-owned-media-load-generation'));
  assert.ok(SHOW_RUNTIME_CONTRACT.capabilities.includes('runtime-owned-media-playback-clock'));
});

test('show-event-v1 validates normalized canonical marker and media events', () => {
  let ajv = new Ajv2020({ strict: true });
  let validate = ajv.compile(SHOW_EVENT_SCHEMA);
  let markerEvent = createShowEvent({ type: 'attention', mode: 'marker', targetId: 'target', marker: 'ovals' });
  let mediaEvent = createShowEvent({ type: 'media', mediaId: 'clip', mode: 'full-with-media-audio' });
  assert.equal(validate(markerEvent), true, JSON.stringify(validate.errors));
  assert.equal(validate(mediaEvent), true, JSON.stringify(validate.errors));
});
