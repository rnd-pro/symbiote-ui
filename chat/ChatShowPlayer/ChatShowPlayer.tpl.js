import { html } from '@symbiotejs/symbiote';

export default html`
  <header class="chat-show-header">
    <span class="material-symbols-outlined chat-show-icon" aria-hidden="true" ${{ textContent: 'icon' }}></span>
    <span class="chat-show-title" ${{ textContent: 'title', title: 'title' }}></span>
    <slot name="actions"></slot>
    <button type="button" class="chat-show-header-action material-symbols-outlined" data-header-action="settings" aria-haspopup="dialog" ${{ onclick: 'onSettings', '@hidden': '!showSettings', '@aria-expanded': 'menuExpanded', '@aria-label': 'showMenuLabel' }}>more_vert</button>
    <button type="button" class="chat-show-header-action material-symbols-outlined" data-header-action="close" aria-label="Close Show" ${{ onclick: 'onClose', '@hidden': '!showClose' }}>close</button>
  </header>
  <section class="chat-show-menu" role="dialog" ${{ '@hidden': '!menuOpen', '@aria-label': 'quickControlsLabel' }}>
    <header class="chat-show-menu-header">
      <strong ${{ textContent: 'menuTitle' }}></strong>
      <div class="chat-show-menu-actions">
        <button type="button" class="chat-show-menu-action" data-show-menu-action="layout" ${{ onclick: 'onLayoutAction', title: 'layoutActionLabel', '@aria-label': 'layoutActionLabel' }}>
          <span class="material-symbols-outlined" aria-hidden="true" ${{ textContent: 'layoutActionGlyph' }}></span>
        </button>
      </div>
    </header>
  </section>
  <div class="chat-show-timeline" ref="timeline" itemize="turns" item-tag="chat-show-row-item" ${{ onclick: 'onTimelineClick' }}>
    <template>
      <button type="button" class="chat-show-row" ${{ '@data-index': 'index', '@current': 'current', '@aria-current': 'ariaCurrent' }}>
        <span class="chat-show-row-speaker" ${{ textContent: 'speaker' }}></span>
        <span class="chat-show-row-text" ${{ textContent: 'text' }}></span>
      </button>
    </template>
  </div>
  <div class="chat-show-caption" aria-live="polite" ${{ '@hidden': '!showCaption' }}>
    <span class="chat-show-caption-viewport" ref="captionViewport" tabindex="0">
      <span class="chat-show-caption-text" ${{ textContent: 'captionText', '@hidden': 'hasCaptionWords' }}></span>
      <span class="chat-show-caption-words" itemize="captionWords" item-tag="chat-show-caption-word-item" ${{ '@hidden': '!hasCaptionWords' }}>
        <template><span class="chat-show-caption-word" ${{ textContent: 'text', '@active': 'active', '@spoken': 'spoken' }}></span></template>
      </span>
    </span>
  </div>
  <div class="chat-show-video-controls" aria-label="Video controls" itemize="videoControls" item-tag="chat-show-video-control-item" ${{ onclick: 'onVideoControl', '@hidden': '!hasVideoControls' }}>
    <template>
      <button type="button" class="chat-show-video-control" ${{ '@data-video-control': 'id', '@data-semantics': 'semantics', '@aria-disabled': 'ariaDisabled' }}>
        <span class="material-symbols-outlined" aria-hidden="true" ${{ textContent: 'glyph' }}></span>
        <span ${{ textContent: 'label' }}></span>
      </button>
    </template>
  </div>
  <div class="chat-show-progress">
    <span class="chat-show-progress-track" ref="progressTrack" role="slider" aria-valuemin="0" ${{ '@style': 'progressStyle', '@tabindex': 'progressTabIndex', '@aria-disabled': 'progressDisabled', '@aria-valuemax': 'progressMax', '@aria-valuenow': 'progressValue', '@aria-valuetext': 'progressText', '@aria-label': 'progressLabel', onpointerdown: 'onProgressPointerDown', onpointermove: 'onProgressPointerMove', onpointerup: 'onProgressPointerUp', onpointercancel: 'onProgressPointerCancel', onkeydown: 'onProgressKeyDown' }}>
      <span class="chat-show-progress-segments" aria-hidden="true" itemize="progressSegments" item-tag="chat-show-progress-segment-item">
        <template>
          <span class="chat-show-progress-segment" ${{ '@style': 'style' }}>
            <span class="chat-show-progress-fill"></span>
          </span>
        </template>
      </span>
      <span class="chat-show-progress-thumb" aria-hidden="true"></span>
    </span>
    <span class="chat-show-progress-time" aria-hidden="true">
      <span class="chat-show-position" ${{ textContent: 'positionLabel' }}></span>
      <span class="chat-show-progress-clock">
        <span ${{ textContent: 'progressElapsedLabel' }}></span>
        <span>/</span>
        <span ${{ textContent: 'progressTotalLabel' }}></span>
      </span>
    </span>
  </div>
  <div class="chat-show-controls" aria-label="Show controls">
    <button type="button" class="material-symbols-outlined" data-control="restart" ${{ onclick: 'onRestart', '@aria-label': 'restartLabel' }}>first_page</button>
    <button type="button" class="material-symbols-outlined" data-control="prev" aria-label="Previous" ${{ onclick: 'onPrev' }}>skip_previous</button>
    <button type="button" class="material-symbols-outlined chat-show-primary-control" data-control="play" ${{ '@aria-label': 'playLabel', '@aria-pressed': 'playing', textContent: 'playGlyph', onclick: 'onPlayPause' }}></button>
    <button type="button" class="material-symbols-outlined" data-control="next" aria-label="Next" ${{ onclick: 'onNext' }}>skip_next</button>
    <button type="button" class="material-symbols-outlined" data-control="stop" aria-label="Stop" ${{ onclick: 'onStop' }}>stop</button>
  </div>
`;
