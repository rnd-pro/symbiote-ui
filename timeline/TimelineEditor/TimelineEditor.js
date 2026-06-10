/**
 * TimelineEditor — NLE-style timeline editor component.
 *
 * Provides multi-track timeline with playhead, clip display, zoom/pan,
 * and transport controls. Works standalone with mock data or connected
 * to symbiote-engine for real-time sync.
 *
 * @element sn-timeline-editor
 *
 * Events:
 * - playhead-change: { frame: number, time: number }
 * - clip-select: { clipId: string, trackId: string }
 * - clip-move: { clipId: string, start: number, end: number }
 * - transport-change: { action: 'play' | 'pause' | 'stop' }
 * - zoom-change: { pixelsPerFrame: number }
 */

import Symbiote from '@symbiotejs/symbiote';
import { timelineEditorTemplate } from './TimelineEditor.tpl.js';
import css from './TimelineEditor.css.js';

let TRACK_COLORS = {
  video: 'hsl(210 55% 42%)',
  audio: 'hsl(45 65% 42%)',
  text: 'hsl(150 45% 38%)',
  effect: 'hsl(280 50% 45%)',
  default: 'hsl(200 30% 40%)',
};

let TRACK_ICONS = {
  video: '🎬',
  audio: '🎵',
  text: '📝',
  effect: '✨',
  default: '📦',
};

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

function formatTimecode(frame, fps) {
  let totalSeconds = frame / fps;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.floor(totalSeconds % 60);
  let frames = Math.floor(frame % fps);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

export class TimelineEditor extends Symbiote {

  /** @type {{ fps: number, duration: number, tracks: Array, markers?: Array }} */
  #data = null;

  /** @type {number} Current playhead frame */
  #playheadFrame = 0;

  /** @type {number} Pixels per frame */
  #pixelsPerFrame = 4;

  /** @type {number|null} Animation frame ID */
  #animationId = null;

  /** @type {boolean} Is playing */
  #playing = false;

  /** @type {number} Playback start timestamp */
  #playStartTime = 0;

  /** @type {number} Playback start frame */
  #playStartFrame = 0;

  /** @type {string|null} Selected clip ID */
  #selectedClipId = null;

  /** @type {ResizeObserver} */
  #resizeObserver = null;

  init$ = {
    timeDisplay: '00:00:00',
    playing: false,
    hasData: false,
    headersHtml: '',
    playheadX: 0,
    zoomLabel: '4 px/fr',

    rulerClick: (e) => {
      if (!this.#data) return;
      let rect = e.currentTarget.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let frame = Math.round(x / this.#pixelsPerFrame);
      frame = Math.max(0, Math.min(frame, this.#data.duration));
      this.#setPlayhead(frame);
    },

    canvasClick: (e) => {
      if (!this.#data) return;
      let rect = e.target.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;
      let frame = Math.round(x / this.#pixelsPerFrame);
      let trackIndex = Math.floor(y / 36); // --te-track-height = 36

      // Check if click is on a clip
      let track = this.#data.tracks[trackIndex];
      if (track) {
        let clip = track.clips?.find(c => {
          let cx = c.start * this.#pixelsPerFrame;
          let cw = (c.end - c.start) * this.#pixelsPerFrame;
          return x >= cx && x <= cx + cw;
        });
        if (clip) {
          this.#selectedClipId = clip.id;
          this.#renderTracks();
          emit(this, 'clip-select', { clipId: clip.id, trackId: track.id, clip });
          return;
        }
      }

      // Click on empty area — move playhead
      this.#selectedClipId = null;
      frame = Math.max(0, Math.min(frame, this.#data.duration));
      this.#setPlayhead(frame);
      this.#renderTracks();
    },
  };

  connectedCallback() {
    super.connectedCallback?.();

    // Listen for transport button clicks
    this.addEventListener('click', this.#onTransportClick);

    // Setup resize observer
    this.#resizeObserver = new ResizeObserver(() => {
      if (this.#data) {
        requestAnimationFrame(() => {
          this.#renderRuler();
          this.#renderTracks();
        });
      }
    });
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    this.removeEventListener('click', this.#onTransportClick);
    this.#stopPlayback();
    this.#resizeObserver?.disconnect();
  }

  #onTransportClick = (e) => {
    let btn = e.target.closest('[data-action]');
    if (!btn) return;

    switch (btn.dataset.action) {
      case 'play':
        if (this.#playing) {
          this.#pausePlayback();
        } else {
          this.#startPlayback();
        }
        break;
      case 'stop':
        this.#stopPlayback();
        this.#setPlayhead(0);
        break;
      case 'skip-start':
        this.#stopPlayback();
        this.#setPlayhead(0);
        break;
      case 'skip-end':
        this.#stopPlayback();
        if (this.#data) this.#setPlayhead(this.#data.duration);
        break;
      case 'zoom-in':
        this.#setZoom(this.#pixelsPerFrame * 1.4);
        break;
      case 'zoom-out':
        this.#setZoom(this.#pixelsPerFrame / 1.4);
        break;
      case 'fit':
        this.#fitToView();
        break;
    }
  };

  // ── Public API ──

  /**
   * Load timeline data.
   * @param {{ fps: number, duration: number, tracks: Array<{ id: string, type?: string, label: string, clips: Array<{ id: string, start: number, end: number, label?: string }> }>, markers?: Array<{ frame: number, label?: string }> }} data
   */
  loadTimeline(data) {
    this.#data = data;
    this.#playheadFrame = 0;
    this.set$({
      hasData: true,
      timeDisplay: formatTimecode(0, data.fps || 30),
    });
    this.#renderHeaders();
    requestAnimationFrame(() => {
      this.#renderRuler();
      this.#renderTracks();
    });
  }

  /** Get current playhead frame */
  get currentFrame() {
    return this.#playheadFrame;
  }

  /** Set current playhead frame */
  set currentFrame(frame) {
    this.#setPlayhead(frame);
  }

  /** Get current time in seconds */
  get currentTime() {
    if (!this.#data) return 0;
    return this.#playheadFrame / (this.#data.fps || 30);
  }

  /** Get timeline data */
  get timelineData() {
    return this.#data;
  }

  /** Set playhead to specific frame from external source */
  setFrame(frame) {
    this.#setPlayhead(frame);
  }

  // ── Internal ──

  #setPlayhead(frame) {
    if (!this.#data) return;
    this.#playheadFrame = Math.max(0, Math.min(frame, this.#data.duration));
    let x = this.#playheadFrame * this.#pixelsPerFrame;
    this.set$({
      playheadX: x,
      timeDisplay: formatTimecode(this.#playheadFrame, this.#data.fps || 30),
    });
    emit(this, 'playhead-change', {
      frame: this.#playheadFrame,
      time: this.#playheadFrame / (this.#data.fps || 30),
    });
  }

  #setZoom(ppf) {
    this.#pixelsPerFrame = Math.max(0.5, Math.min(20, ppf));
    let label = this.#pixelsPerFrame >= 1
      ? `${this.#pixelsPerFrame.toFixed(1)} px/fr`
      : `${(1 / this.#pixelsPerFrame).toFixed(1)} fr/px`;
    this.$.zoomLabel = label;
    this.#setPlayhead(this.#playheadFrame); // update playhead position
    this.#renderRuler();
    this.#renderTracks();
    emit(this, 'zoom-change', { pixelsPerFrame: this.#pixelsPerFrame });
  }

  #fitToView() {
    if (!this.#data) return;
    let scroll = this.ref.tracksScroll;
    if (!scroll) return;
    let availWidth = scroll.clientWidth - 20;
    let ppf = availWidth / this.#data.duration;
    this.#setZoom(ppf);
  }

  #startPlayback() {
    if (!this.#data || this.#playing) return;
    this.#playing = true;
    this.$.playing = true;
    this.#playStartTime = performance.now();
    this.#playStartFrame = this.#playheadFrame;

    // If at end, restart from beginning
    if (this.#playheadFrame >= this.#data.duration) {
      this.#playStartFrame = 0;
      this.#playheadFrame = 0;
    }

    emit(this, 'transport-change', { action: 'play' });
    this.#animationLoop();
  }

  #pausePlayback() {
    this.#playing = false;
    this.$.playing = false;
    if (this.#animationId) {
      cancelAnimationFrame(this.#animationId);
      this.#animationId = null;
    }
    emit(this, 'transport-change', { action: 'pause' });
  }

  #stopPlayback() {
    this.#playing = false;
    this.$.playing = false;
    if (this.#animationId) {
      cancelAnimationFrame(this.#animationId);
      this.#animationId = null;
    }
    emit(this, 'transport-change', { action: 'stop' });
  }

  #animationLoop = () => {
    if (!this.#playing || !this.#data) return;

    let elapsed = (performance.now() - this.#playStartTime) / 1000;
    let frame = this.#playStartFrame + Math.floor(elapsed * this.#data.fps);

    if (frame >= this.#data.duration) {
      frame = this.#data.duration;
      this.#setPlayhead(frame);
      this.#stopPlayback();
      return;
    }

    this.#setPlayhead(frame);
    this.#animationId = requestAnimationFrame(this.#animationLoop);
  };

  // ── Rendering ──

  #renderHeaders() {
    if (!this.#data) return;
    let html = this.#data.tracks.map(track => {
      let type = track.type || 'default';
      let color = TRACK_COLORS[type] || TRACK_COLORS.default;
      let icon = TRACK_ICONS[type] || TRACK_ICONS.default;
      return `<div class="te-header-track">
        <span class="te-header-icon" style="background: ${color}">${icon}</span>
        <span class="te-header-label">${track.label || track.id}</span>
        <button class="te-header-mute" title="Mute">M</button>
      </div>`;
    }).join('');
    this.$.headersHtml = html;
  }

  #renderRuler() {
    let canvas = this.ref.rulerCanvas;
    if (!canvas || !this.#data) return;

    let container = canvas.parentElement;
    let width = container.clientWidth;
    let height = 28;
    let dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    let ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    let fps = this.#data.fps || 30;
    let ppf = this.#pixelsPerFrame;
    let duration = this.#data.duration;

    // Determine tick interval
    let secondWidth = ppf * fps;
    let tickInterval; // in frames
    if (secondWidth > 200) tickInterval = fps / 4;
    else if (secondWidth > 60) tickInterval = fps;
    else if (secondWidth > 15) tickInterval = fps * 5;
    else tickInterval = fps * 10;

    let majorInterval = tickInterval * 4;

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'top';

    for (let f = 0; f <= duration; f += tickInterval) {
      let x = f * ppf;
      if (x > width) break;

      let isMajor = f % majorInterval < tickInterval;
      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 8 : 18);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isMajor) {
        let label = formatTimecode(f, fps);
        ctx.fillText(label, x + 2, 2);
      }
    }

    // Draw markers
    if (this.#data.markers) {
      ctx.strokeStyle = 'hsla(40, 70%, 55%, 0.6)';
      for (let marker of this.#data.markers) {
        let x = marker.frame * ppf;
        if (x > width) continue;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
  }

  #renderTracks() {
    let canvas = this.ref.tracksCanvas;
    if (!canvas || !this.#data) return;

    let container = canvas.parentElement;
    let trackH = 36;
    let totalHeight = this.#data.tracks.length * trackH;
    let totalWidth = Math.max(container.clientWidth, this.#data.duration * this.#pixelsPerFrame + 20);
    let dpr = window.devicePixelRatio || 1;

    canvas.width = totalWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = totalWidth + 'px';
    canvas.style.height = totalHeight + 'px';

    let ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, totalWidth, totalHeight);

    let ppf = this.#pixelsPerFrame;

    // Draw track backgrounds
    this.#data.tracks.forEach((track, i) => {
      let y = i * trackH;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)';
      ctx.fillRect(0, y, totalWidth, trackH);

      // Track border
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(0, y + trackH);
      ctx.lineTo(totalWidth, y + trackH);
      ctx.stroke();

      // Draw clips
      let type = track.type || 'default';
      let clipColor = TRACK_COLORS[type] || TRACK_COLORS.default;

      if (track.clips) {
        for (let clip of track.clips) {
          let cx = clip.start * ppf;
          let cw = (clip.end - clip.start) * ppf;
          let cy = y + 3;
          let ch = trackH - 6;

          let isSelected = this.#selectedClipId === clip.id;

          // Clip body
          ctx.fillStyle = clipColor;
          ctx.globalAlpha = isSelected ? 1 : 0.75;
          this.#roundRect(ctx, cx, cy, cw, ch, 3);
          ctx.fill();

          // Selection outline
          if (isSelected) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            this.#roundRect(ctx, cx, cy, cw, ch, 3);
            ctx.stroke();
            ctx.lineWidth = 1;
          }

          ctx.globalAlpha = 1;

          // Clip label
          if (cw > 30 && clip.label) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.textBaseline = 'middle';
            let maxW = cw - 8;
            let text = clip.label;
            let metrics = ctx.measureText(text);
            if (metrics.width > maxW) {
              while (text.length > 1 && ctx.measureText(text + '…').width > maxW) {
                text = text.slice(0, -1);
              }
              text += '…';
            }
            ctx.fillText(text, cx + 4, cy + ch / 2);
          }

          // Clip edge handles
          if (isSelected) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(cx, cy + 4, 2, ch - 8);
            ctx.fillRect(cx + cw - 2, cy + 4, 2, ch - 8);
          }
        }
      }
    });

    // Draw markers
    if (this.#data.markers) {
      ctx.strokeStyle = 'hsla(40, 70%, 55%, 0.4)';
      ctx.setLineDash([4, 4]);
      for (let marker of this.#data.markers) {
        let x = marker.frame * ppf;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, totalHeight);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  #roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

TimelineEditor.template = timelineEditorTemplate;
TimelineEditor.rootStyles = css;
TimelineEditor.reg('sn-timeline-editor');

export default TimelineEditor;
