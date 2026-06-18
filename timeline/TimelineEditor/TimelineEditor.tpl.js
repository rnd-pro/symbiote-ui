import { html } from '@symbiotejs/symbiote';

export let timelineEditorTemplate = html`
  <div class="te-transport">
    <button data-action="skip-start" title="Skip to Start">⏮</button>
    <button data-action="play" title="Play / Pause">▶</button>
    <button data-action="stop" title="Stop">⏹</button>
    <button data-action="skip-end" title="Skip to End">⏭</button>
    <span class="te-time" ${{ textContent: 'timeDisplay' }}></span>
    <div class="te-spacer"></div>
    <span class="te-zoom-label" ${{ textContent: 'zoomLabel' }}></span>
    <button data-action="zoom-out" title="Zoom Out">−</button>
    <button data-action="zoom-in" title="Zoom In">+</button>
    <button data-action="fit" title="Fit to View">⊞</button>
  </div>
  <div class="te-body">
    <div class="te-headers" ${{ '@hidden': '!hasData' }}>
      <div class="te-headers-ruler-pad">Tracks</div>
      <div class="te-headers-list" ref="headersList"></div>
    </div>
    <div class="te-canvas-area" ${{ '@hidden': '!hasData' }}>
      <div class="te-ruler" ${{ onclick: 'rulerClick' }}>
        <canvas ref="rulerCanvas"></canvas>
        <div class="te-playhead" ref="rulerPlayhead"></div>
      </div>
      <div class="te-tracks-scroll" ref="tracksScroll">
        <div class="te-tracks-canvas">
          <canvas ref="tracksCanvas" ${{ onclick: 'canvasClick' }}></canvas>
          <div class="te-playhead" ref="tracksPlayhead"></div>
        </div>
      </div>
    </div>
    <div class="te-empty" ${{ '@hidden': 'hasData' }}>
      No timeline data
    </div>
  </div>
`;
