// Stem gains per track (linear) and per-track loudness trims, calibrated offline in the audio lab
// (__lab.stems / __lab.music): each instrument is rendered solo with the same seed and moved toward a target level
// relative to the full mix; TRACK_GAIN sets each track's integrated loudness (music bus, volume 1).
export const MIX = {
  title: { str: 0.977, low: 1.23, vln: 1.429, horn: 1.202, tbn: 1.567, choir: 1.274, harp: 1.396, oboe: 1.334, timp: 1.047, cym: 1.738, bell: 1.274 },
};
export const TRACK_GAIN = { title: 0.923 };
