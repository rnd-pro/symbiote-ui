/**
 * Soundscape of the Show: a seeded generative techno bed and short synthesized
 * sound cues for the accent events (selection, ink, click, arms, visor, scene).
 * Everything is synthesized with Web Audio, no samples.
 *
 *   const sound = createShowSoundscape({ seed: 'abc' });
 *   sound.setPlaying(true);          // from a user gesture: starts the bed
 *   sound.cue('select');             // an accent sound, only while playing
 *
 * The bed ducks on every kick and stays quiet next to narration. The seed
 * fixes the track (tempo, key, riffs); `getSeed()` returns it for reports.
 */

import {
  BARS_PER_CYCLE, STEPS_PER_BAR, createRandom, createTrack, generateBar, midiToHz, stepOffsetSeconds,
} from './show-soundscape-score.js';

/** Long events sound for as long as they last: the caller keeps `sustain`ing them. */
export const SUSTAINED_VOICES = Object.freeze(['drag', 'draw', 'swipe']);
const SUSTAIN_RELEASE_S = 0.24;
const SUSTAIN_TICK_MS = 60;

export const SOUND_CUES = Object.freeze([
  'select', 'ink', 'click', 'arm-out', 'arm-in', 'visor-down', 'visor-up', 'scene', 'media', 'note', 'text',
]);

const LOOKAHEAD_S = 0.2;
const TICK_MS = 40;
const FADE_S = 0.6;
const BED_LEVEL = 0.5;
const CUE_MIN_GAP_S = 0.05;

export function createShowSoundscape({
  seed = '', volume = 0.5, createContext = null, onTrace = null, startBar = 0, music = false, sounds = true,
} = {}) {
  let currentSeed = String(seed || Math.random().toString(36).slice(2, 8));
  const tempoSeed = currentSeed;
  let track = createTrack(currentSeed, tempoSeed);
  let level = Math.max(0, Math.min(1, volume));
  let musicOn = Boolean(music);
  let soundsOn = Boolean(sounds);
  let playing = false; // the show runs: sounds may play, and the bed when it is on
  let disposed = false;
  let ctx = null;
  let nodes = null;
  let timer = null;
  let cursor = { cycle: 0, bar: startBar, step: 0, time: 0 };
  let pendingSeed = null;
  let lastCueAt = new Map();
  const voices = new Map();
  let voiceTimer = null;
  const trace = (type, data) => { if (typeof onTrace === 'function') onTrace(type, data); };

  const makeContext = () => {
    if (createContext) return createContext();
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Ctor ? new Ctor({ latencyHint: 'interactive' }) : null;
  };

  const noiseBuffer = (context) => {
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    const random = createRandom('noise');
    for (let i = 0; i < length; i += 1) data[i] = random() * 2 - 1;
    return buffer;
  };

  const build = () => {
    ctx = makeContext();
    if (!ctx) return false;
    const master = ctx.createGain();
    master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 4;
    // A bright shelf keeps the top end open: noise voices alone sound dull.
    const air = ctx.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 5000;
    air.gain.value = 8;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3200;
    presence.Q.value = 0.7;
    presence.gain.value = 7;
    master.connect(presence).connect(air).connect(compressor).connect(ctx.destination);

    const bed = ctx.createGain(); // everything musical, ducked by the kick
    const duck = ctx.createGain();
    const musicBus = ctx.createGain(); // the techno bed as a whole: switched by setMusic
    musicBus.gain.value = musicOn ? 1 : 0;
    bed.connect(duck).connect(musicBus).connect(master);
    const sfx = ctx.createGain();
    sfx.gain.value = soundsOn ? 0.9 : 0;
    sfx.connect(master);

    // One shared ping-pong echo for stabs and cues: repeats bounce left, right.
    const echo = ctx.createGain();
    const echoTime = 60 / track.bpm * 0.75;
    const delayL = ctx.createDelay(1);
    const delayR = ctx.createDelay(1);
    delayL.delayTime.value = echoTime;
    delayR.delayTime.value = echoTime;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2400;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.5;
    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();
    panL.pan.value = -0.85;
    panR.pan.value = 0.85;
    echo.connect(echoTone).connect(delayL);
    delayL.connect(panL).connect(echoOut);
    delayL.connect(delayR);
    delayR.connect(panR).connect(echoOut);
    delayR.connect(feedback).connect(delayL);
    echoOut.connect(master);

    nodes = { master, bed, duck, sfx, musicBus, echo, delays: [delayL, delayR], panners: new Map(), noise: noiseBuffer(ctx) };
    return true;
  };

  const envelope = (param, at, { attack = 0.003, peak = 1, decay = 0.2 }) => {
    param.cancelScheduledValues(at);
    param.setValueAtTime(0.0001, at);
    param.linearRampToValueAtTime(peak, at + attack);
    param.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  };

  const setEchoTime = () => {
    for (const delay of nodes.delays) delay.delayTime.value = 60 / track.bpm * 0.75;
  };

  // A voice goes through a shared stereo panner per position (-1 left .. 1 right).
  const panTo = (out, pan) => {
    const value = Math.round(Math.max(-1, Math.min(1, Number(pan) || 0)) * 20) / 20;
    if (!value) return out;
    let byOut = nodes.panners.get(out);
    if (!byOut) { byOut = new Map(); nodes.panners.set(out, byOut); }
    let panner = byOut.get(value);
    if (!panner) {
      panner = ctx.createStereoPanner();
      panner.pan.value = value;
      panner.connect(out);
      byOut.set(value, panner);
    }
    return panner;
  };

  const tone = (type, freq, at, length, { peak = 0.5, to = null, out = nodes.bed, filter = null, attack = 0.003, pan = 0 } = {}) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + length);
    envelope(gain.gain, at, { attack, peak, decay: length });
    let head = osc;
    if (filter) {
      const biquad = ctx.createBiquadFilter();
      biquad.type = filter.type;
      biquad.frequency.setValueAtTime(filter.from, at);
      biquad.frequency.exponentialRampToValueAtTime(filter.to, at + length);
      biquad.Q.value = filter.q ?? 1;
      osc.connect(biquad);
      head = biquad;
    }
    head.connect(gain).connect(panTo(out, pan));
    osc.start(at);
    osc.stop(at + attack + length + 0.05);
    return gain;
  };

  const hiss = (at, length, { peak = 0.3, type = 'highpass', from = 6000, to = 6000, q = 0.7, out = nodes.bed, attack = 0.002, pan = 0 } = {}) => {
    const src = ctx.createBufferSource();
    src.buffer = nodes.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + length);
    filter.Q.value = q;
    const gain = ctx.createGain();
    envelope(gain.gain, at, { attack, peak, decay: length });
    src.connect(filter).connect(gain).connect(panTo(out, pan));
    src.start(at, Math.random() * 1.5);
    src.stop(at + attack + length + 0.05);
  };

  const sendEcho = (gain, amount) => {
    const send = ctx.createGain();
    send.gain.value = amount;
    gain.connect(send).connect(nodes.echo);
  };

  // ---- the bed ----------------------------------------------------------

  const kickAt = (at) => {
    tone('sine', 150, at, 0.32, { peak: 0.95, to: 42, out: nodes.musicBus });
    hiss(at, 0.014, { peak: 0.3, type: 'highpass', from: 4500, to: 4500, out: nodes.musicBus });
    // Sidechain: the rest of the bed ducks and then swells back.
    const g = nodes.duck.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(0.25, at);
    g.linearRampToValueAtTime(1, at + 0.26);
  };

  const bassAt = (hit, at, sixteenth) => {
    const length = sixteenth * 4 * hit.gate;
    const freq = midiToHz(hit.note);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, at);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = hit.accent ? 14 : 8;
    filter.frequency.setValueAtTime(hit.accent ? 3600 : 1400, at);
    filter.frequency.exponentialRampToValueAtTime(140, at + length);
    const gain = ctx.createGain();
    envelope(gain.gain, at, { attack: 0.004, peak: hit.accent ? 0.34 : 0.26, decay: length });
    osc.connect(filter).connect(gain).connect(nodes.bed);
    osc.start(at);
    osc.stop(at + length + 0.06);
  };

  const stabAt = (hit, at, sixteenth) => {
    const length = sixteenth * 3.2;
    for (const midi of hit.notes) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = detune;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 4;
        filter.frequency.setValueAtTime(7000, at);
        filter.frequency.exponentialRampToValueAtTime(700, at + length);
        const gain = ctx.createGain();
        envelope(gain.gain, at, { attack: 0.006, peak: 0.05, decay: length });
        osc.connect(filter).connect(gain).connect(panTo(nodes.bed, detune < 0 ? -0.6 : 0.6));
        sendEcho(gain, 0.7);
        osc.start(at);
        osc.stop(at + length + 0.06);
      }
    }
  };

  const clapAt = (at) => {
    for (const [i, offset] of [0, 0.011, 0.022].entries()) {
      hiss(at + offset, 0.09, { peak: 0.3, type: 'bandpass', from: 2400, to: 1500, q: 0.9, pan: (i - 1) * 0.45 });
    }
  };

  const percAt = (level, at, step) => {
    tone('triangle', 520 + level * 300, at, 0.07, { peak: 0.12 * level, to: 300, pan: (step % 8 < 4 ? -1 : 1) * (0.35 + level * 0.4) });
  };

  const scheduleStep = (cycle, bar, step, at) => {
    const data = generateBar(track, cycle, bar);
    const sixteenth = 60 / track.bpm / 4;
    if (data.kick[step]) kickAt(at);
    if (data.hat[step]) hiss(at, 0.035, { peak: 0.45 * data.hat[step], from: 8500, to: 8500, q: 0.5, pan: step % 4 === 1 ? -0.3 : 0.3 });
    if (data.openHat[step]) hiss(at, 0.22, { peak: 0.42, from: 9500, to: 6500, q: 0.5, pan: 0.2 });
    if (data.clap[step]) clapAt(at);
    if (data.perc[step]) percAt(data.perc[step], at, step);
    if (data.bass[step]) bassAt(data.bass[step], at, sixteenth);
    for (const hit of data.stab) if (hit.step === step) stabAt(hit, at, sixteenth);
    if (data.layers.noise && step === 0) {
      // Riser into the next section.
      for (const pan of [-0.6, 0.6]) {
        hiss(at, sixteenth * STEPS_PER_BAR, { peak: 0.08, type: 'bandpass', from: 400, to: 9000, q: 2, attack: sixteenth * 12, pan });
      }
    }
  };

  const pump = () => {
    if (!ctx || !playing || !musicOn) return;
    const sixteenth = 60 / track.bpm / 4;
    while (cursor.time < ctx.currentTime + LOOKAHEAD_S) {
      const at = cursor.time + (stepOffsetSeconds(track, cursor.step) - cursor.step * sixteenth);
      scheduleStep(cursor.cycle, cursor.bar, cursor.step, Math.max(at, ctx.currentTime));
      cursor.time += sixteenth;
      cursor.step += 1;
      if (cursor.step >= STEPS_PER_BAR) {
        cursor.step = 0;
        cursor.bar += 1;
        if (cursor.bar >= BARS_PER_CYCLE) { cursor.bar = 0; cursor.cycle += 1; }
        if (pendingSeed !== null) {
          // The next track takes over on the bar line and keeps the groove:
          // same tempo and swing, bar position and echo carry on.
          currentSeed = pendingSeed;
          pendingSeed = null;
          track = createTrack(currentSeed, tempoSeed);
          trace('seed', { seed: currentSeed, bpm: track.bpm, scale: track.scaleName });
        }
      }
    }
  };

  // ---- cues -------------------------------------------------------------

  // Cue pitches stay in the track's key so they sit with the bed.
  const keyed = (degree, octave = 3) => {
    const scale = track.scale;
    const index = ((degree % scale.length) + scale.length) % scale.length;
    return midiToHz(track.root + 12 * octave + scale[index] + 12 * Math.floor(degree / scale.length));
  };

  const playCue = (kind, detail, at) => {
    // `detail.pan` (-1 left .. 1 right) places the sound where the event happens.
    const out = panTo(nodes.sfx, detail?.pan);
    switch (kind) {
      case 'select': { // two quick rising blips, a "lock" of the frame
        for (const [i, degree] of [0, 4].entries()) {
          const gain = tone('square', keyed(degree, 3), at + i * 0.07, 0.09, { peak: 0.14, out, filter: { type: 'lowpass', from: 4000, to: 1200 } });
          sendEcho(gain, 0.35);
        }
        break;
      }
      case 'ink': { // marker scribble: filtered noise sweeping with the stroke
        const length = Math.max(0.25, Math.min(2.2, Number(detail?.durationMs) / 1000 || 0.7));
        hiss(at, length, { peak: 0.16, type: 'bandpass', from: 1800, to: 4200, q: 3, out, attack: 0.04 });
        tone('triangle', keyed(5, 4), at, length * 0.8, { peak: 0.04, to: keyed(7, 4), out });
        break;
      }
      case 'click': { // a crisp tick with a soft thump
        tone('square', 1800, at, 0.025, { peak: 0.16, out, to: 900 });
        tone('sine', 220, at, 0.12, { peak: 0.4, out, to: 90 });
        break;
      }
      case 'arm-out': { // servo whoosh going out
        hiss(at, 0.28, { peak: 0.13, type: 'bandpass', from: 500, to: 3200, q: 2.5, out, attack: 0.05 });
        tone('sawtooth', 150, at, 0.26, { peak: 0.05, to: 420, out, filter: { type: 'lowpass', from: 600, to: 1800 } });
        break;
      }
      case 'arm-in': { // and back
        hiss(at, 0.25, { peak: 0.1, type: 'bandpass', from: 3000, to: 500, q: 2.5, out, attack: 0.03 });
        tone('sawtooth', 420, at, 0.22, { peak: 0.04, to: 150, out, filter: { type: 'lowpass', from: 1800, to: 500 } });
        break;
      }
      case 'visor-down': { // metal clank, then a tiny power-up chirp
        tone('square', 310, at, 0.05, { peak: 0.14, out, to: 180 });
        tone('square', 466, at + 0.004, 0.05, { peak: 0.1, out, to: 260 });
        hiss(at, 0.06, { peak: 0.14, type: 'highpass', from: 5000, to: 5000, out });
        tone('sine', keyed(0, 5), at + 0.09, 0.18, { peak: 0.08, to: keyed(4, 5), out });
        break;
      }
      case 'visor-up': {
        tone('sine', keyed(4, 5), at, 0.14, { peak: 0.07, to: keyed(0, 5), out });
        tone('square', 260, at + 0.1, 0.06, { peak: 0.1, out, to: 150 });
        hiss(at + 0.1, 0.05, { peak: 0.1, type: 'highpass', from: 4500, to: 4500, out });
        break;
      }
      case 'scene': { // section change: downward sweep and a low hit
        hiss(at, 0.7, { peak: 0.13, type: 'bandpass', from: 5000, to: 300, q: 1.5, out, attack: 0.02 });
        tone('sine', 110, at + 0.02, 0.5, { peak: 0.38, to: 38, out });
        break;
      }
      case 'media': { // media starts: a quick rising arpeggio
        for (const [i, degree] of [0, 2, 4, 7].entries()) {
          const gain = tone('triangle', keyed(degree, 4), at + i * 0.06, 0.12, { peak: 0.13, out });
          sendEcho(gain, 0.4);
        }
        break;
      }
      case 'note': { // a chat note or action: a soft bell
        const gain = tone('sine', keyed(7, 5), at, 0.5, { peak: 0.12, out });
        tone('sine', keyed(7, 5) * 2.01, at, 0.3, { peak: 0.04, out });
        sendEcho(gain, 0.6);
        break;
      }
      case 'text': { // a text selection swipe
        hiss(at, 0.3, { peak: 0.12, type: 'bandpass', from: 1200, to: 3200, q: 4, out, attack: 0.05 });
        tone('square', keyed(3, 4), at + 0.28, 0.05, { peak: 0.08, out });
        break;
      }
      default:
    }
  };

  // ---- sustained voices -------------------------------------------------

  // How each long event sounds; `value` (0..1) is its live intensity: the grown
  // size of a frame, the pen speed, the swipe progress.
  const VOICE_SHAPES = {
    // The frame is a robot voice: a buzzing tone that sweeps from low to high as the
    // frame grows (value 0 = just started, 1 = a large frame), with no noise.
    drag: { pulse: 24, osc: 'sawtooth', freqLow: 120, freqHigh: 1300, level: 0.035 },
    draw: { noise: 'bandpass', q: 2.5, low: 1800, high: 5200, osc: 'sine', oscDegree: 5, oscSpan: 2, level: 0.14, oscLevel: 0.025 },
    swipe: { noise: 'bandpass', q: 4, low: 1000, high: 3200, osc: 'square', oscDegree: 2, oscSpan: 5, level: 0.09, oscLevel: 0.03 },
  };

  const endVoice = (kind) => {
    const voice = voices.get(kind);
    if (!voice || !ctx) return;
    voices.delete(kind);
    const now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, 0.03);
    voice.src.stop(now + 0.2);
    voice.osc.stop(now + 0.2);
  };

  const voiceTick = () => {
    const now = ctx?.currentTime ?? 0;
    for (const [kind, voice] of voices) if (now > voice.until) endVoice(kind);
    if (!voices.size) { clearInterval(voiceTimer); voiceTimer = null; }
  };

  const sustainVoice = (kind, value, pan) => {
    const shape = VOICE_SHAPES[kind];
    const now = ctx.currentTime;
    const level01 = Math.max(0, Math.min(1, Number(value) || 0));
    let voice = voices.get(kind);
    if (!voice) {
      const osc = ctx.createOscillator();
      osc.type = shape.osc;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      let src = null;
      let filter;
      if (shape.pulse) {
        // Tone -> low-pass -> gate pulsed by an LFO, like marching ants made audible.
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 5;
        const gate = ctx.createGain();
        gate.gain.value = 0.7;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = shape.pulse;
        const depth = ctx.createGain();
        depth.gain.value = 0.3;
        lfo.connect(depth).connect(gate.gain);
        osc.connect(filter).connect(gate).connect(gain);
        lfo.start();
        voice = { src: lfo, osc, filter, gain, until: 0 };
      } else {
        src = ctx.createBufferSource();
        src.buffer = nodes.noise;
        src.loop = true;
        filter = ctx.createBiquadFilter();
        filter.type = shape.noise;
        filter.Q.value = shape.q;
        const oscGain = ctx.createGain();
        oscGain.gain.value = shape.oscLevel;
        src.connect(filter).connect(gain);
        osc.connect(oscGain).connect(gain);
        src.start();
        voice = { src, osc, filter, gain, until: 0 };
      }
      gain.connect(panTo(nodes.sfx, pan));
      osc.start();
      voices.set(kind, voice);
      trace('cue', { kind, sustained: true, pan });
    }
    voice.until = now + SUSTAIN_RELEASE_S;
    if (shape.freqLow) {
      // Exponential sweep: equal size steps are equal musical steps.
      const freq = shape.freqLow * (shape.freqHigh / shape.freqLow) ** level01;
      voice.osc.frequency.setTargetAtTime(freq, now, 0.06);
      voice.filter.frequency.setTargetAtTime(Math.min(8000, freq * 3.2), now, 0.06);
    } else {
      voice.filter.frequency.setTargetAtTime(shape.low + (shape.high - shape.low) * level01, now, 0.04);
      voice.osc.frequency.setTargetAtTime(keyed(shape.oscDegree + Math.round(level01 * shape.oscSpan), 4), now, 0.05);
    }
    voice.gain.gain.setTargetAtTime(shape.level * (0.55 + 0.45 * level01), now, 0.03);
    if (!voiceTimer) voiceTimer = setInterval(voiceTick, SUSTAIN_TICK_MS);
  };

  // ---- control ----------------------------------------------------------

  const applyGain = () => {
    if (!ctx || !nodes) return;
    const now = ctx.currentTime;
    const fade = (param, value) => {
      param.cancelScheduledValues(now);
      param.setTargetAtTime(value, now, FADE_S / 3);
    };
    fade(nodes.master.gain, playing ? level * BED_LEVEL : 0);
    fade(nodes.musicBus.gain, musicOn ? 1 : 0);
    fade(nodes.sfx.gain, soundsOn ? 0.9 : 0);
  };

  // The groove keeps its bar and step over a pause: resuming continues it
  // after the fade instead of restarting from bar one.
  // The scheduler runs only while the show runs and the music is on.
  const syncClock = () => {
    const want = playing && musicOn && Boolean(ctx);
    if (want && !timer) {
      cursor.time = ctx.currentTime + 0.08;
      timer = setInterval(pump, TICK_MS);
    } else if (!want && timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return {
    /** The show runs or stops. Call it from a user gesture for the first start. */
    setPlaying(next) {
      if (disposed) return;
      next = Boolean(next);
      if (next === playing) return;
      playing = next;
      if (next) {
        // With the music and the sounds both off no audio context is created at all.
        if ((musicOn || soundsOn) && !ctx && !build()) { playing = false; return; }
        void ctx?.resume?.()?.catch?.(() => {});
        trace('play', { seed: currentSeed, bpm: track.bpm, scale: track.scaleName, root: track.root, music: musicOn });
      }
      syncClock();
      applyGain();
    },
    /** One accent sound. Silent while paused, switched off or before the first start. */
    cue(kind, detail = null) {
      if (disposed || !ctx || !nodes || !playing || !soundsOn || !SOUND_CUES.includes(kind)) return;
      const now = ctx.currentTime;
      if (now - (lastCueAt.get(kind) ?? -1) < CUE_MIN_GAP_S) return;
      lastCueAt.set(kind, now);
      trace('cue', { kind, pan: detail?.pan });
      try { playCue(kind, detail, now + 0.01); } catch (error) { trace('cue-error', { kind, message: String(error?.message || error) }); }
    },
    /**
     * A long event is going on: call it on every update (size, pen move) and it
     * sounds until updates stop. `value` is the live intensity in 0..1.
     */
    sustain(kind, value = 0.5, detail = null) {
      if (disposed || !ctx || !nodes || !playing || !soundsOn || !SUSTAINED_VOICES.includes(kind)) return;
      try { sustainVoice(kind, value, detail?.pan); } catch (error) { trace('cue-error', { kind, message: String(error?.message || error) }); }
    },
    setSeed(next) {
      currentSeed = String(next || currentSeed);
      track = createTrack(currentSeed, tempoSeed);
      cursor = { cycle: 0, bar: startBar, step: 0, time: ctx ? ctx.currentTime + 0.08 : 0 };
      if (nodes) setEchoTime();
      trace('seed', { seed: currentSeed, bpm: track.bpm, scale: track.scaleName });
    },
    /** Switch to another track at the end of the current bar (at once when stopped). */
    queueSeed(next) {
      if (!next) return;
      if (timer) pendingSeed = String(next);
      else this.setSeed(next);
    },
    getSeed: () => currentSeed,
    getTrack: () => track,
    /** The techno bed on or off (it keeps its place in the arrangement while off). */
    setMusic(next) {
      musicOn = Boolean(next);
      if (musicOn && playing && !ctx && !build()) return;
      if (musicOn) void ctx?.resume?.()?.catch?.(() => {});
      syncClock();
      applyGain();
    },
    isMusic: () => musicOn,
    /** The accent sounds on or off. */
    setSounds(next) {
      soundsOn = Boolean(next);
      if (soundsOn && playing && !ctx && !build()) return;
      void ctx?.resume?.()?.catch?.(() => {});
      applyGain();
    },
    isSounds: () => soundsOn,
    setVolume(next) { level = Math.max(0, Math.min(1, Number(next) || 0)); applyGain(); },
    isPlaying: () => playing,
    dispose() {
      disposed = true;
      playing = false;
      clearInterval(timer);
      clearInterval(voiceTimer);
      timer = null;
      try { void ctx?.close?.(); } catch { /* the context is already closed */ }
      ctx = null;
      nodes = null;
    },
  };
}
