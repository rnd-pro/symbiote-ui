/**
 * Score of the Show's generative techno: a pure, seeded generator. The same
 * seed always gives the same track; every 32-bar cycle is a fresh variation
 * of it. No audio here, only data, so the music can be tested without a
 * sound card.
 */

export const STEPS_PER_BAR = 16;
export const BARS_PER_CYCLE = 32;

/** Hash a seed of any kind into a 32-bit state (cyrb128-style, first lane). */
export function hashSeed(seed) {
  const text = String(seed ?? '');
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32: small seeded generator returning floats in [0, 1). */
export function createRandom(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCALES = Object.freeze({
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
});

const pick = (random, list) => list[Math.floor(random() * list.length)];

/**
 * Track-level traits. Tempo and swing come from `tempoSeed`, key and scale from
 * `seed`: sections of one show change key and riffs but keep the groove.
 */
export function createTrack(seed, tempoSeed = seed) {
  const pace = createRandom(`${tempoSeed}:pace`);
  const random = createRandom(`${seed}:track`);
  const scaleName = pick(random, Object.keys(SCALES));
  return Object.freeze({
    seed: String(seed),
    bpm: 122 + Math.floor(pace() * 14),
    root: 33 + Math.floor(random() * 7), // MIDI A1..F#2: low techno bass
    scaleName,
    scale: SCALES[scaleName],
    swing: Math.round(pace() * 8) / 100,
  });
}

/** Which layers play in a bar of the 32-bar cycle. */
export function layersForBar(bar) {
  const b = ((bar % BARS_PER_CYCLE) + BARS_PER_CYCLE) % BARS_PER_CYCLE;
  if (b < 4) return { kick: true, hat: b >= 2, clap: false, bass: false, stab: false, perc: false, noise: b === 3 };
  if (b < 8) return { kick: true, hat: true, clap: true, bass: b >= 6, stab: false, perc: false, noise: false };
  if (b < 16) return { kick: true, hat: true, clap: true, bass: true, stab: b >= 12, perc: b >= 10, noise: b === 15 };
  if (b < 20) return { kick: false, hat: b >= 18, clap: false, bass: b >= 18, stab: true, perc: false, noise: b === 19 };
  if (b < 28) return { kick: true, hat: true, clap: true, bass: true, stab: true, perc: true, noise: b === 27 };
  return { kick: true, hat: true, clap: b >= 30, bass: b < 30, stab: false, perc: b >= 30, noise: b === 31 };
}

/**
 * One 16-step bar of every voice.
 * @returns {{ kick: boolean[], hat: number[], openHat: boolean[], clap: boolean[], perc: number[],
 *   bass: Array<{ step: number, note: number, accent: boolean, slide: boolean, gate: number } | null>,
 *   stab: Array<{ step: number, notes: number[] }> }}
 */
export function generateBar(track, cycle, bar) {
  const random = createRandom(`${track.seed}:${cycle}:${bar}`);
  // The riff is fixed for four bars at a time so the ear can follow it.
  const riffRandom = createRandom(`${track.seed}:${cycle}:riff:${Math.floor(bar / 4)}`);
  const layers = layersForBar(bar);
  const note = (degree) => {
    const octave = Math.floor(degree / track.scale.length);
    return track.root + track.scale[((degree % track.scale.length) + track.scale.length) % track.scale.length] + 12 * octave;
  };

  const kick = Array.from({ length: STEPS_PER_BAR }, (_, step) => (
    layers.kick && step % 4 === 0
  ));
  const openHat = Array.from({ length: STEPS_PER_BAR }, (_, step) => (
    layers.hat && step % 4 === 2
  ));
  const hat = Array.from({ length: STEPS_PER_BAR }, (_, step) => {
    if (!layers.hat || openHat[step]) return 0;
    if (step % 2 === 1) return random() < 0.55 ? 0.35 + random() * 0.3 : 0;
    return 0.25;
  });
  const clap = Array.from({ length: STEPS_PER_BAR }, (_, step) => (
    layers.clap && (step === 4 || step === 12 || (bar % 4 === 3 && step === 14 && random() < 0.5))
  ));
  const perc = Array.from({ length: STEPS_PER_BAR }, (_, step) => (
    layers.perc && step % 4 !== 0 && step % 4 !== 2 && random() < 0.3 ? 0.4 + random() * 0.5 : 0
  ));

  const bass = Array.from({ length: STEPS_PER_BAR }, () => null);
  if (layers.bass) {
    for (let step = 0; step < STEPS_PER_BAR; step += 1) {
      // Off-beat bass between the kicks, with occasional 16th pickups.
      const offbeat = step % 4 === 2;
      const pickup = step % 4 === 3 && riffRandom() < 0.4;
      const draw = riffRandom();
      if (!(offbeat || pickup) || draw > 0.88) continue;
      const degree = pick(riffRandom, [0, 0, 0, 2, 3, 4, -2, 7]);
      bass[step] = {
        step,
        note: note(degree),
        accent: riffRandom() < 0.3,
        slide: riffRandom() < 0.25,
        gate: 0.4 + riffRandom() * 0.5,
      };
    }
  }

  const stab = [];
  if (layers.stab) {
    const chordRoot = pick(riffRandom, [0, 0, 2, 3, 5]);
    const hits = pick(riffRandom, [[3, 10], [6], [3, 6, 11], [2, 9, 14]]);
    for (const step of hits) {
      stab.push({ step, notes: [note(chordRoot + 7), note(chordRoot + 9), note(chordRoot + 11)] });
    }
  }
  return { kick, hat, openHat, clap, perc, bass, stab, layers };
}

/** Time of a step in seconds from the bar start, with swing on the off 16ths. */
export function stepOffsetSeconds(track, step) {
  const sixteenth = 60 / track.bpm / 4;
  return step * sixteenth + (step % 2 === 1 ? track.swing * sixteenth : 0);
}

export const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
