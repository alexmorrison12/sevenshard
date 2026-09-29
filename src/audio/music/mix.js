// Stem gains per track (linear) and per-track loudness trims, calibrated offline in the audio lab (driver:
// autoMix — each instrument rendered solo with the same seed and moved toward a target level relative to the full
// mix; trackGain — each track's integrated loudness on the music bus at volume 1).
export const MIX = {
  title: { str: 0.933, low: 1.38, vln: 1.479, choir: 1.135, oo: 0.473, horns: 1.161, brass: 1.799, horn: 1.549, tpt: 1.679, harp: 1.319, cel: 0.943, flute: 1, oboe: 1.334, spc: 2.818, timp: 1.641, taiko: 1.928, tkm: 2.344, cym: 1.122, fx: 0.355 },
  city: { lute: 0.776, lute2: 1.023, rec: 0.458, flute: 0.631, fid: 0.61, str: 0.624, vln: 0.653, low: 0.933, pizz: 1.585, horn: 0.596, harp: 0.767, glock: 2.317, drum: 1 },
  field: { str: 0.803, vln: 1, low: 1.189, spc: 1.035, horn: 0.7, horns: 0.944, flute: 0.716, oboe: 1, clar: 0.661, harp: 0.933, glock: 3.388, snare: 2.985, tkm: 1.318, timp: 0.871, cym: 0.871 },
  field_dark: { low: 0.956, str: 0.431, spc: 0.944, trem: 1.622, oo: 0.562, bsn: 0.531, clar: 1, horn: 0.7, horns: 0.507, brass: 1.071, harp: 0.768, cel: 1.011, tk: 0.7, tkm: 0.776, timp: 0.684, cym: 0.513, fx: 0.549 },
  dungeon: { bass: 1, sub: 0.507, arp: 2.399, dpad: 0.861, choir: 1.048, oo: 0.468, brass: 1.412, low: 1.496, spc: 0.933, tk: 0.822, tkm: 0.871, tks: 0.966, timp: 1.479, cym: 0.661, fx: 0.832 },
  boss: { low: 1.531, hi: 1.365, str: 1.161, bass: 1.66, brass: 1.446, horns: 1, horn: 1.23, tpt: 1.496, choir: 1.047, taiko: 0.933, mid: 1.412, small: 1.035, timp: 1.135, cym: 0.871, fx: 0.851 },
  raid: { low: 1.799, hi: 1.567, trem: 1, str: 1.548, bass: 2.398, brass: 1.532, tbn: 1.995, tuba: 1.288, horn: 1.412, horns: 1.246, choir: 1.122, ghost: 1, taiko: 1.059, mid: 1.678, small: 1.084, timp: 1.259, cym: 0.804, fx: 0.871, sub: 1 },
  sea: { acc: 1.148, accL: 1.738, whistle: 0.923, fid: 0.881, gtr: 0.923, bass: 1.862, crew: 0.742, low: 0.832, drum: 0.944 },
  pip: { clar: 0.473, flute: 0.519, picc: 0.777, bsn: 1.035, pizz: 1.109, str: 0.645, xylo: 1.883, glock: 1.82, mar: 1.135, cel: 1.202, harp: 0.496, perc: 2.163 },
  stronghold: { flute: 0.417, clar: 0.519, oboe: 0.668, vln: 0.676, str: 0.66, low: 0.861, pad: 0.569, horns: 0.822, gtr: 1.863, harp: 0.692, cel: 1.381, pizz: 1.567 },
  pvp: { spc: 1.38, trem: 2.163, low: 0.617, str: 0.692, brass: 1.412, horns: 1.023, tpt: 1.549, pulse: 1.084, sub: 0.446, snare: 2.512, tk: 0.861, tkm: 1, timp: 1, cym: 0.717, fx: 0.892, clock: 3.162 },
  inferno: { organ: 0.776, dpad: 0.617, oo: 0.389, choir: 0.934, low: 1.011, str: 1.149, brass: 1.364, horns: 0.75, spc: 1.259, pulse: 0.684, sub: 0.442, bell: 1.906, tk: 0.912, tkm: 0.912, timp: 0.852, cym: 0.66, fx: 0.684 },
  cutscene_sad: { cello: 0.496, oboe: 0.513, vln: 0.543, str: 0.479, low: 0.676, oo: 0.417, harp: 0.507, cel: 0.609 },
  cutscene_heroic: { str: 0.851, vln: 1.531, low: 1.717, choir: 1, horns: 1.288, brass: 1.738, horn: 1.288, tpt: 1.698, harp: 1.496, cel: 1.567, timp: 1.445, taiko: 1.906, cym: 1.259, fx: 1.995, spc: 1.463, snare: 4.57 },
};
export const TRACK_GAIN = { title: 0.596, city: 1.862, field: 1.365, field_dark: 1.973, dungeon: 1.479, boss: 0.989, raid: 0.776, sea: 1.862, pip: 2.371, stronghold: 2.066, pvp: 1.396, inferno: 1.549, cutscene_sad: 2.661, cutscene_heroic: 0.741 };
