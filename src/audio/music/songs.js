// In-world instrument performances for the Songs feature (the hero plays lute + harp). Original melodies, each with
// its own key, metre and character so they are recognisable at a glance:
//   homeward — Hymn of Homeward    G major, 3/4 hymn: a rising "home" arpeggio, gentle descent to the tonic   (≈9 s)
//   tides    — Serenade of Tides   D dorian, 6/8: harp waves rolling under a lute line that swells and ebbs   (≈9.5 s)
//   rest     — Lullaby of Rest     F major, 3/4, slow: celesta + harp, a falling "rock-a-bye" line             (≈10 s)
//   valor    — Ballad of Valor     D minor → D major, 4/4: the main theme's heroic call over bold strums      (≈9 s)
//   sunrise  — Song of Sunrise     C Lydian, 4/4: an ascending line with the bright raised 4th, harp glitter  (≈9 s)
import { Track } from './track.js';
import { Harp, Lute, Mallet, Ens, Wind } from './instruments.js';
import { mel } from './theory.js';

class Song extends Track {
  constructor(e, n, t0, seed, dest, len) {
    super(e, n, t0, seed, dest); this.length = len;
    this.I('lute', Lute, { pan: 0.1, rev: 0.35, scale: 0.3 });
    this.I('strum', Lute, { pan: -0.1, rev: 0.3, scale: 0.22 });
    this.I('harp', Harp, { pan: -0.2, rev: 0.5, scale: 0.34 });
  }
  playBar(bar, t) { if (bar > 0) return 0; this.score(t, this.inst, this.spb); return this.length + 0.3; }
}

export class Homeward extends Song {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 9.3); this.tempo(80, 3); this.I('pad', Ens, { patch: 'strings', rev: 0.5, scale: 0.16, bright: 0.7 }); }
  score(t, I, s) {
    const tune = mel('G4:1 B4:1 D5:1 | E5:2 D5:1 | C5:1 A4:1 F#4:1 | G4:3');
    const ch = ['G', 'C', ['Am', 'D'], 'G'], B = 3 * s;
    this.line(I.lute, t, tune, { vel: 0.62, hum: 6 });
    ch.forEach((c, i) => {
      const cs = Array.isArray(c) ? c : [c];
      cs.forEach((cc, j) => this.arp(I.harp, t + i * B + j * B / cs.length, 3 / cs.length, cc, { pat: [0, 1, 2, 3, 4, 5], lo: 55, vel: 0.3, len: 4 }));
      this.pad(I.pad, t + i * B, B, cs[0], { n: 3, lo: 55, hi: 67, vel: 0.3, a: 0.6, r: 1.2, art: 'pad' });
    });
    I.harp.gliss(t + 3 * B + s, [67, 71, 74, 79, 83, 86], s * 1.2, 0.3);
  }
}
export class Tides extends Song {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 9.6); this.tempo(150, 6); this.I('flute', Wind, { kind: 'flute', pan: -0.2, rev: 0.5, scale: 0.14 }); }
  score(t, I, s) {
    const tune = mel('D5:2 E5:1 F5:2 E5:1 | D5:2 C5:1 G4:3 | A4:2 B4:1 C5:2 D5:1 | A4:6');
    const ch = ['Dm', 'C', ['Dm/F', 'G'], 'Dm'], B = 6 * s;
    this.line(I.lute, t, tune, { vel: 0.6, hum: 5 });
    this.line(I.flute, t + 3 * B, mel('A5:6'), { vel: 0.3, hum: 0 });
    // harp waves: up-and-down arpeggios, one per bar
    ch.forEach((c, i) => { const cs = Array.isArray(c) ? c : [c]; cs.forEach((cc, j) => this.arp(I.harp, t + i * B + j * B / cs.length, 6 / cs.length, cc, { pat: [0, 1, 2, 3, 4, 3, 2, 1], step: 0.75, lo: 50, vel: 0.28, len: 3 })); });
  }
}
export class Rest extends Song {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 10); this.tempo(72, 3); this.I('cel', Mallet, { kind: 'celesta', pan: 0.2, rev: 0.6, scale: 0.3 }); }
  score(t, I, s) {
    const tune = mel('C5:2 A4:1 | Bb4:1 A4:1 G4:1 | G4:2 E4:1 | F4:3');
    const ch = ['F', 'Bb', 'C', 'F'], B = 3 * s;
    this.line(I.cel, t, tune, { vel: 0.5, tr: 12, hum: 6 });
    this.line(I.lute, t, tune, { vel: 0.4, hum: 6 });
    ch.forEach((c, i) => { I.harp.note(t + i * B, this.bassPitch(c, 41, 53, 'hb'), B, 0.3); this.arp(I.harp, t + i * B + s, 2, c, { pat: [0, 1, 2, 1], step: 0.5, lo: 57, vel: 0.2, len: 3 }); });
    I.cel.note(t + 3 * B + 1.5 * s, 89, 1, 0.22);
  }
}
export class Valor extends Song {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 8.8); this.tempo(96, 4); }
  score(t, I, s) {
    // the main theme's call, then a bold turn to D major
    const tune = mel('D4:1.5! A4:.5 D5:2 | C5:1 Bb4:1 G4:1 E4:1 | F#4:1 A4:1 D5:2!');
    const ch = ['Dm', ['Bb', 'C'], 'D'], B = 4 * s;
    this.line(I.lute, t, tune, { vel: 0.66, hum: 4 });
    ch.forEach((c, i) => {
      const cs = Array.isArray(c) ? c : [c];
      cs.forEach((cc, j) => {
        const tt = t + i * B + j * B / cs.length, v = this.voicing(cc, 4, 50, 64, 'sv'), bs = this.bassPitch(cc, 38, 50, 'sb');
        I.strum.note(tt, bs, s, 0.55);
        for (let k = 0; k < 4 / cs.length; k++) I.strum.strum(tt + k * s, v, k === 0 ? 0.5 : 0.38, { dir: k % 2 ? -1 : 1, spread: 0.018 });
      });
    });
    I.harp.gliss(t + 2 * B, [62, 66, 69, 74, 78, 81, 86], s, 0.34);
  }
}
export class Sunrise extends Song {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 9.2); this.tempo(100, 4); this.I('pad', Ens, { patch: 'strings', rev: 0.55, scale: 0.16, bright: 0.9 }); }
  score(t, I, s) {
    const tune = mel('C5:.5 D5:.5 E5:1 G5:2 | F#5:1 E5:1 D5:1 A5:1 | G5:2 B5:1 A5:1 | C6:4');
    const ch = ['C', 'D/C', ['C', 'G/B'], 'C'], B = 4 * s;
    this.line(I.harp, t, tune, { vel: 0.5, hum: 4 });
    this.line(I.lute, t, tune, { vel: 0.4, tr: -12, hum: 4 });
    ch.forEach((c, i) => { const cs = Array.isArray(c) ? c : [c]; cs.forEach((cc, j) => { this.arp(I.strum, t + i * B + j * B / cs.length, 4 / cs.length, cc, { pat: [0, 1, 2, 3, 2, 1, 2, 3], lo: 48, vel: 0.3, len: 2 }); }); this.pad(I.pad, t + i * B, B, cs[0], { n: 3, lo: 55, hi: 67, vel: 0.26, a: 0.8, r: 1.2, art: 'pad' }); });
    I.harp.gliss(t + 3 * B, [72, 74, 76, 78, 79, 84, 86, 88, 90, 91, 96], s * 1.6, 0.3);
  }
}
