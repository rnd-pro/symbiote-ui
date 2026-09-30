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
    seek: 'turn-index-and-position-ms',
    input: Object.freeze(['pointer', 'keyboard']),
  }),
  videoControlSemantics: CHAT_SHOW_VIDEO_CONTROL_SEMANTICS,
});
