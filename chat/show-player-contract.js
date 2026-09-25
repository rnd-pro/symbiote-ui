export const CHAT_SHOW_VIDEO_CONTROL_SEMANTICS = Object.freeze(['detail', 'pointer-only']);

export const CHAT_SHOW_PLAYER_CONTRACT = Object.freeze({
  version: 'chat-show-player-v2',
  placement: 'inline-or-native-layout-panel',
  placementModes: Object.freeze(['inline', 'panel']),
  placementLifecycle: 'same-live-player-reparented-without-controller-recreation',
  responsiveFallback: 'native-panel-closes-to-inline-before-mobile-drawer',
  transcriptEmbed: 'receipt-only',
  captionOwner: 'player',
  ttsOwner: 'player',
  progress: Object.freeze({
    projection: 'duration-weighted-segmented-overall-timeline',
    // Opt-in: a timeline uses the host-absolute composition clock when every
    // turn carries a finite non-negative startMs (with a positive durationMs);
    // an optional timeline.totalMs overrides the computed max turn end. Turns
    // without startMs keep the duration-weighted projection unchanged.
    timeBase: 'duration-weighted | host-absolute-composition',
    // Absolute mode maps an absolute composition time to the turn that contains
    // it. A requested time inside a gap (a composition span no turn covers)
    // snaps forward to the next turn at position 0, or backward to the last
    // turn at its full durationMs when no next turn exists; the seek event then
    // reports the honest receipt keys snapped and gapMs beside index,
    // positionMs, absoluteMs and source.
    absoluteGapSeek: 'requested-time-inside-a-gap-snaps-forward-to-the-next-turn-position-0',
    seek: 'turn-index-and-position-ms',
    input: Object.freeze(['pointer', 'keyboard']),
  }),
  videoControlSemantics: CHAT_SHOW_VIDEO_CONTROL_SEMANTICS,
});
