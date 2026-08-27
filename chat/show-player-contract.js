export const CHAT_SHOW_VIDEO_CONTROL_SEMANTICS = Object.freeze(['detail', 'pointer-only']);

export const CHAT_SHOW_PLAYER_CONTRACT = Object.freeze({
  version: 'chat-show-player-v1',
  placement: 'fixed-composition-region',
  transcriptEmbed: 'receipt-only',
  captionOwner: 'player',
  ttsOwner: 'player',
  videoControlSemantics: CHAT_SHOW_VIDEO_CONTROL_SEMANTICS,
});
