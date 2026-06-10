export let timelineEditorTemplate = /*html*/`
  <div class="te-transport">
    <button data-action="skip-start" title="Skip to Start">⏮</button>
    <button data-action="play" title="Play / Pause" \${playing ? 'data-active' : ''}>▶</button>
    <button data-action="stop" title="Stop">⏹</button>
    <button data-action="skip-end" title="Skip to End">⏭</button>
    <span class="te-time">\${timeDisplay}</span>
    <div class="te-spacer"></div>
    <span class="te-zoom-label">\${zoomLabel}</span>
    <button data-action="zoom-out" title="Zoom Out">−</button>
    <button data-action="zoom-in" title="Zoom In">+</button>
    <button data-action="fit" title="Fit to View">⊞</button>
  </div>
  <div class="te-body">
    <div class="te-headers" \${!hasData ? 'hidden' : ''}>
      <div class="te-headers-ruler-pad">Tracks</div>
      <div class="te-headers-list" \${@headersHtml}></div>
    </div>
    <div class="te-canvas-area" \${!hasData ? 'hidden' : ''}>
      <div class="te-ruler" \${@rulerClick}>
        <canvas ref="rulerCanvas"></canvas>
        <div class="te-playhead" style="left: \${playheadX}px"></div>
      </div>
      <div class="te-tracks-scroll" ref="tracksScroll">
        <div class="te-tracks-canvas">
          <canvas ref="tracksCanvas" \${@canvasClick}></canvas>
          <div class="te-playhead" style="left: \${playheadX}px"></div>
        </div>
      </div>
    </div>
    <div class="te-empty" \${hasData ? 'hidden' : ''}>
      No timeline data. Use loadTimeline() to load tracks.
    </div>
  </div>
`;
