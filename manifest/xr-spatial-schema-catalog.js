import {
  XR_SPATIAL_PLACEMENT_LIMITS,
  XR_SPATIAL_TOLERANCES,
  XR_SPATIAL_TRANSFORM_CONVENTION,
  XR_SPATIAL_VERSIONS,
  freezeSpatialValue,
} from '../xr/spatial-contract.js';

export let XR_SPATIAL_SCHEMA_VERSIONS = [
  {
    version: XR_SPATIAL_VERSIONS.target,
    path: 'schemas/xr-spatial-target-v1.json',
    description: 'Approved or committed metric target for root-relative XR spatial verification.',
  },
  {
    version: XR_SPATIAL_VERSIONS.observation,
    path: 'schemas/xr-spatial-observation-v1.json',
    description: 'Same-frame stereo, object, viewer, root, and input evidence captured from an XR session.',
  },
  {
    version: XR_SPATIAL_VERSIONS.audit,
    path: 'schemas/xr-spatial-audit-v1.json',
    description: 'Stable-window metric audit with orthographic, stereo, and reference-only axonometric projections.',
  },
  {
    version: XR_SPATIAL_VERSIONS.hitMap,
    path: 'schemas/xr-content-hit-map-v1.json',
    description: 'Immutable frame-bound content hit map for portable XR panel interactions.',
  },
  {
    version: XR_SPATIAL_VERSIONS.placementReceipt,
    path: 'schemas/xr-spatial-placement-receipt-v1.json',
    description: 'Paired pre-root placement evidence bound to XR session, frame, input source, hit pose, and surface normal.',
  },
  {
    version: 'xr-portable-panel-state-v1',
    path: 'schemas/xr-portable-panel-state-v1.json',
    description: 'Universal tracking representation for portable, pinned, and focused WebXR panels.',
  },
  {
    version: 'xr-portable-panel-receipt-v1',
    path: 'schemas/xr-portable-panel-receipt-v1.json',
    description: 'Deeply frozen operation receipt verifying layout adjustments, focus changes, or pinned state.',
  },
  {
    version: 'xr-frame-timing-v1',
    path: 'schemas/xr-frame-timing-v1.json',
    description: 'Summary of WebXR session frame rate performance, drop ratios, and intervals.',
  },
  {
    version: 'xr-final-session-snapshot-v1',
    path: 'schemas/xr-final-session-snapshot-v1.json',
    description: 'Sanitized post-cleanup snapshot capturing the final spatial, receipt, performance and input state.',
  },
  {
    version: 'xr-spatial-window-layout-v1',
    path: 'schemas/xr-spatial-window-layout-v1.json',
    description: 'Versioned spatial-window layout descriptor mapping one open layout instance to one XR window.',
  },
  {
    version: 'xr-spatial-window-sync-receipt-v1',
    path: 'schemas/xr-spatial-window-sync-receipt-v1.json',
    description: 'Idempotent syncLayouts reconciliation receipt with per-window add, update, remove, and unchanged actions.',
  },
  {
    version: 'xr-spatial-window-lifecycle-receipt-v1',
    path: 'schemas/xr-spatial-window-lifecycle-receipt-v1.json',
    description: 'Spatial-window lifecycle receipt for enter, exit, session adopt and release, focus, move, reset, and theme actions.',
  },
  {
    version: 'xr-spatial-window-resize-receipt-v1',
    path: 'schemas/xr-spatial-window-resize-receipt-v1.json',
    description: 'Resize begin, preview, commit, and cancel receipt; preview never scales content and commit swaps texture and geometry transactionally.',
  },
  {
    version: 'xr-spatial-window-relay-receipt-v1',
    path: 'schemas/xr-spatial-window-relay-receipt-v1.json',
    description: 'Controller and hand ray routing receipt for external chrome actions or the live DOM input relay.',
  },
  {
    version: 'xr-spatial-window-scroll-receipt-v1',
    path: 'schemas/xr-spatial-window-scroll-receipt-v1.json',
    description: 'Wheel and select-drag scroll gesture receipt with lifecycle phase, capture identity, deltas, and live DOM scroll offsets.',
  },
  {
    version: 'xr-spatial-window-selection-receipt-v1',
    path: 'schemas/xr-spatial-window-selection-receipt-v1.json',
    description: 'Text selection drag receipt with stable capture identity and selection data read from the live DOM.',
  },
  {
    version: 'xr-spatial-window-focus-receipt-v1',
    path: 'schemas/xr-spatial-window-focus-receipt-v1.json',
    description: 'Content focus, blur, and cancel receipt with the real DOM focus result and the structured dom-focus or dom-overlay IME handoff.',
  },
  {
    version: 'xr-spatial-window-viewport-receipt-v1',
    path: 'schemas/xr-spatial-window-viewport-receipt-v1.json',
    description: 'Per-window viewport update receipt: CSS viewport change without remount, preserved focus, form values, selection and scroll, and measured texture pixels.',
  },
  {
    version: 'xr-spatial-window-theme-redraw-receipt-v1',
    path: 'schemas/xr-spatial-window-theme-redraw-receipt-v1.json',
    description: 'Theme redraw sync receipt validating per-window snapshots, revisions, uploads/redraws, and binding hash.',
  },
  {
    version: 'xr-spatial-window-fallback-v1',
    path: 'schemas/xr-spatial-window-fallback-v1.json',
    description: 'Explicit per-window fallback data for unsupported capability and runtime texture upload failure.',
  },
  {
    version: 'xr-spatial-window-assembly-diagnostics-v1',
    path: 'schemas/xr-spatial-window-diagnostics-v1.json',
    description: 'Spatial-window assembly diagnostics with per-window lifecycle, upload, relay, resize, fallback, chrome metrics, overlap verdict, and frame evidence.',
  },
  {
    version: 'xr-spatial-window-frame-v1',
    path: 'schemas/xr-spatial-window-frame-v1.json',
    description: 'Per-frame dirty-gating evidence proving zero idle texture uploads with frame timing metrics.',
  },
  {
    version: 'xr-html-canvas-upload-receipt-v1',
    path: 'schemas/xr-html-canvas-upload-receipt-v1.json',
    description: 'HTML-in-Canvas upload receipt capturing render, upload, mode, dimensions, signature, and errors.',
  },
];

export function listXRSpatialSchemas() {
  return XR_SPATIAL_SCHEMA_VERSIONS.map((schema) => ({
    ...schema,
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://rnd-pro.github.io/symbiote-ui/${schema.path}`,
  }));
}

export let XR_SPATIAL_EVIDENCE_CONTRACT = freezeSpatialValue({
  version: 'xr-spatial-provider-contract-v1',
  entrypoint: 'symbiote-ui/xr',
  transformConvention: XR_SPATIAL_TRANSFORM_CONVENTION,
  tolerances: XR_SPATIAL_TOLERANCES,
  placementLimits: XR_SPATIAL_PLACEMENT_LIMITS,
  schemas: listXRSpatialSchemas(),
  exports: {
    target: ['validateTarget'],
    capture: ['checkSampleEligibility', 'evaluateSample'],
    audit: ['SpatialStabilityTracker', 'verifyXRSpatialAuditEnvelope'],
    projection: ['projectTop', 'projectFront', 'projectRight', 'projectAxonometric', 'projectObservations'],
    placement: ['createXRPlacementReceipt', 'verifyXRPlacementReceipt'],
    contentSelect: ['createXRTrustedSelectReceipt', 'verifyXRTrustedSelectReceipt'],
    portablePanel: ['createXRPortablePanelStore', 'verifyXRPortablePanelReceipt', 'verifyXRPortablePanelStateSnapshot'],
    spatialWindowAssembly: [
      'createXRSpatialWindowAssembly',
      'normalizeXRSpatialWindowLayout',
      'diffXRSpatialWindowLayouts',
      'createXRSpatialWindowChromeSurface',
      'computeXRSpatialWindowDefaultSlotPose',
      'resolveXRSpatialWindowDefaultPlacement',
    ],
  },
  verification: {
    requiresStereoEvidence: true,
    metricVerdictInputs: [
      'root-relative-object-error',
      'typed-spatial-constraints',
      'all-frame-stability',
      'same-frame-stereo-eligibility',
    ],
    minimumFrames: XR_SPATIAL_TOLERANCES.minimumFrames,
    minimumDurationMs: XR_SPATIAL_TOLERANCES.minimumDurationMs,
    projections: {
      metricReference: ['top', 'front', 'right', 'stereo'],
      referenceOnly: [{ id: 'axonometric', metric: false, affectsRuntimeVerdict: false }],
    },
  },
  interactions: {
    placement: {
      phaseVersion: XR_SPATIAL_VERSIONS.placementPhase,
      receiptVersion: XR_SPATIAL_VERSIONS.placementReceipt,
      preRoot: true,
      requiresPanelHit: false,
      requiresCommittedRoot: false,
    },
    contentSelect: {
      phaseVersion: XR_SPATIAL_VERSIONS.interactionPhase,
      receiptVersion: XR_SPATIAL_VERSIONS.trustedSelect,
      requiresPanelHit: true,
      requiresCommittedRoot: true,
    },
  },
});
