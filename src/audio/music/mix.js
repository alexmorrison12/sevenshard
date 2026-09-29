// Stem gains per track (linear) and per-track loudness trims, calibrated offline in the audio lab (driver:
// autoMix — each instrument rendered solo with the same seed and moved toward a target level relative to the full
// mix; trackGain — each track's integrated loudness on the music bus at volume 1).
export const MIX = {
  title: { str: 0.966, low: 1.288, vln: 1.259, choir: 1.259, oo: 0.531, horns: 1.135, brass: 1, horn: 1.496, tpt: 1, harp: 1.274, cel: 0.602, flute: 0.923, oboe: 1.334, spc: 1, timp: 1.622, taiko: 1, tkm: 1, cym: 0.977, fx: 0.126 },
  city: { lute: 0.871, lute2: 1.035, rec: 0.496, flute: 1, fid: 0.692, str: 0.61, vln: 0.741, low: 0.966, pizz: 1.698, horn: 0.692, harp: 1.318, glock: 2.57, drum: 1.109 },
  field: { str: 0.803, vln: 1, low: 1.189, spc: 1.035, horn: 0.7, horns: 0.944, flute: 0.716, oboe: 1, clar: 0.661, harp: 0.933, glock: 3.388, snare: 2.985, tkm: 1.318, timp: 0.871, cym: 0.871 },
  field_dark: { low: 1.06, str: 0.473, spc: 1.023, trem: 1.799, oo: 0.631, bsn: 0.61, clar: 1, horn: 0.851, horns: 0.589, brass: 1.188, harp: 0.923, cel: 1.188, tk: 0.776, tkm: 0.813, timp: 0.767, cym: 0.543, fx: 0.457 },
  dungeon: { bass: 1, sub: 0.507, arp: 2.399, dpad: 0.861, choir: 1.048, oo: 0.468, brass: 1.412, low: 1.496, spc: 0.933, tk: 0.822, tkm: 0.871, tks: 0.966, timp: 1.479, cym: 0.661, fx: 0.832 },
  boss: { low: 1.531, hi: 1.365, str: 1.161, bass: 1.66, brass: 1.446, horns: 1, horn: 1.23, tpt: 1.496, choir: 1.047, taiko: 0.933, mid: 1.412, small: 1.035, timp: 1.135, cym: 0.871, fx: 0.851 },
  raid: { low: 1.679, hi: 1.397, trem: 1, str: 1.396, bass: 2.065, brass: 1.397, tbn: 1.778, tuba: 1.148, horn: 1.216, horns: 1.123, choir: 0.966, ghost: 1, taiko: 0.977, mid: 1.566, small: 1, timp: 1.148, cym: 0.733, fx: 0.785, sub: 1 },
  sea: { acc: 1.148, accL: 1.738, whistle: 0.923, fid: 0.881, gtr: 0.923, bass: 1.862, crew: 0.742, low: 0.832, drum: 0.944 },
  pip: { clar: 0.473, flute: 0.519, picc: 0.777, bsn: 1.035, pizz: 1.109, str: 0.645, xylo: 1.883, glock: 1.82, mar: 1.135, cel: 1.202, harp: 0.496, perc: 2.163 },
  stronghold: { flute: 0.479, clar: 0.631, oboe: 0.776, vln: 1, str: 0.724, low: 0.776, pad: 0.741, horns: 0.851, gtr: 1.928, harp: 0.841, cel: 1.097, pizz: 1.884 },
  pvp: { spc: 1.38, trem: 2.265, low: 0.631, str: 0.716, brass: 1.462, horns: 1.035, tpt: 1.66, pulse: 1.072, sub: 0.436, snare: 2.754, tk: 0.861, tkm: 1, timp: 1.071, cym: 0.725, fx: 0.832, clock: 3.09 },
  inferno: { organ: 0.776, dpad: 0.617, oo: 0.389, choir: 0.934, low: 1.011, str: 1.149, brass: 1.364, horns: 0.75, spc: 1.259, pulse: 0.684, sub: 0.442, bell: 1.906, tk: 0.912, tkm: 0.912, timp: 0.852, cym: 0.66, fx: 0.684 },
  cutscene_sad: { cello: 0.531, oboe: 0.631, vln: 0.668, str: 0.624, low: 0.901, oo: 0.513, harp: 0.676, cel: 0.785 },
  cutscene_heroic: { str: 0.822, vln: 1.396, low: 1.659, choir: 1, horns: 1.109, brass: 1.862, horn: 1.188, tpt: 1.429, harp: 1.349, cel: 1, timp: 1.396, taiko: 1.738, cym: 1.135, fx: 1.698, spc: 1.334, snare: 2.818 },
};
export const TRACK_GAIN = { title: 0.813, city: 1.679, field: 1.365, field_dark: 1.82, dungeon: 1.479, boss: 0.989, raid: 0.841, sea: 1.862, pip: 2.371, stronghold: 1.95, pvp: 1.429, inferno: 1.549, cutscene_sad: 2.188, cutscene_heroic: 0.776 };
