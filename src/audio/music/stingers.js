// One-shot musical pieces built on the SEVENSHARD leitmotifs.
//   tracks (music(...)): 'victory' (≈8 s fanfare: the HERO call in D major → tutti → plagal amen → SHARD glitter),
//                        'defeat' (≈8 s: tolling bell, the call falling in minor, a dark close)
//   stingers (stinger(...), over the current music): level_up · quest_complete · achievement · legendary_drop ·
//                        boss_intro (hit → dark name-reveal swell → lead-in) · raid_clear (big) · wipe
// Each class schedules everything in bar 0 and sets `length` (seconds of sounding music, tails excluded).
import { Track } from './track.js';
import { Ens, Horn, Harp, Mallet, Timpani, Taiko, Cymbal, Fx, Strings } from './instruments.js';
import { mel } from './theory.js';
import { CALL_MAJ, SHARD_MAJ, SHARD } from './motifs.js';

class Piece extends Track {
  constructor(e, n, t0, seed, dest, len) { super(e, n, t0, seed, dest); this.length = len; }
  playBar(bar, t) { if (bar > 0) return 0; this.score(t, this.inst, this.spb); return (this.length || 4) + 0.3; }
  // orchestra kit shared by the pieces (only instruments that are used get woken)
  orch({ choir = 'choir_ah' } = {}) {
    this.I('str', Ens, { patch: 'strings', pan: -0.15, rev: 0.5, scale: 0.3 });
    this.I('low', Ens, { patch: 'strings', pan: 0.25, rev: 0.4, scale: 0.32, bright: 0.7 });
    this.I('choir', Ens, { patch: choir, rev: 0.6, scale: 0.28 });
    this.I('brass', Ens, { patch: 'brass', pan: 0.15, rev: 0.5, scale: 0.26 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.55, scale: 0.28 });
    this.I('tpt', Horn, { kind: 'trumpet', pan: 0.1, rev: 0.5 });
    this.I('horn', Horn, { pan: 0.25, rev: 0.6 });
    this.I('harp', Harp, { pan: -0.4, rev: 0.55 });
    this.I('glock', Mallet, { kind: 'glock', pan: 0.35, rev: 0.6, scale: 0.2 });
    this.I('cel', Mallet, { kind: 'celesta', pan: 0.3, rev: 0.65, scale: 0.24 });
    this.I('timp', Timpani, { rev: 0.5 });
    this.I('taiko', Taiko, { size: 'big', rev: 0.4 });
    this.I('cym', Cymbal, { rev: 0.55 });
    this.I('fx', Fx, { rev: 0.45 });
  }
  chord(inst, t, dur, ch, o) { return this.pad(inst, t, dur, ch, o); }
}

// ---------------------------------------------------------------- tracks
export class Victory extends Piece {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 7.5); this.tempo(100, 4); this.orch(); }
  score(t, I, s) {
    const T = (b) => t + b * s;
    I.timp.roll(t, 45, 1.5 * s, 0.1, 0.85, { hit: false }); I.cym.swell(t, 1.5 * s, 0.55);
    // fanfare: the HERO call in D major — trumpets over horns an octave below
    const fan = mel('D4:.75! D4:.25 A4:1 | F#4:.5 A4:.5 D5:1.5!');
    this.line(I.tpt, T(1.5), fan, { vel: 0.82, tr: 12, legato: 0.9 }); this.line(I.horn, T(1.5), fan, { vel: 0.72, legato: 0.9 });
    I.timp.hit(T(1.5), 38, 0.8); I.timp.hit(T(2.25), 38, 0.55); I.timp.hit(T(2.5), 45, 0.7);
    for (const b of [1.5, 2.5, 3.5]) this.bass(I.low, T(b), s * 0.9, 'D', { lo: 38, hi: 50, vel: 0.5, oct: true });
    const H = T(4.5);
    I.cym.crash(H, 0.9); I.timp.hit(H, 38, 1); I.taiko.hit(H, 0.9);
    this.pad(I.str, H, s * 2, 'D', { n: 5, lo: 50, hi: 78, vel: 0.56, a: 0.05 });
    this.pad(I.choir, H, s * 2, 'D', { n: 4, lo: 57, hi: 76, vel: 0.6, a: 0.1, key: 'choir' });
    this.pad(I.brass, H, s * 1.6, 'D', { n: 4, lo: 50, hi: 69, vel: 0.7, art: 'marc', key: 'brass' });
    this.bass(I.low, H, s * 2, 'D', { lo: 26, hi: 38, vel: 0.6, oct: true });
    // plagal "amen": G/D → D(add9)
    const G = T(6.5), E = T(7.5);
    this.pad(I.str, G, s, 'G/D', { n: 5, lo: 50, hi: 79, vel: 0.5, a: 0.1 });
    this.pad(I.choir, G, s, 'G/D', { n: 4, lo: 57, hi: 76, vel: 0.5, a: 0.1, key: 'choir' });
    this.pad(I.horns, G, s, 'G/D', { n: 3, lo: 55, hi: 67, vel: 0.55, key: 'horns' });
    this.pad(I.str, E, s * 2.2, 'Dadd9', { n: 5, lo: 50, hi: 79, vel: 0.5, a: 0.1, r: 1.6 });
    this.pad(I.choir, E, s * 2.2, 'Dadd9', { n: 4, lo: 57, hi: 76, vel: 0.5, a: 0.1, r: 1.6, key: 'choir' });
    this.pad(I.horns, E, s * 2, 'D', { n: 3, lo: 55, hi: 67, vel: 0.5, key: 'horns', r: 1.2 });
    this.bass(I.low, G, s, 'D', { lo: 26, hi: 38, vel: 0.5, oct: true }); this.bass(I.low, E, s * 2.2, 'D', { lo: 26, hi: 38, vel: 0.5, oct: true, r: 1.5 });
    I.timp.roll(G, 38, s * 0.95, 0.2, 0.6, { hit: true });
    I.harp.gliss(E, [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88], s * 1.2, 0.45);
    this.line(I.glock, E + s * 0.9, SHARD_MAJ, { vel: 0.4, tr: -12, hum: 2 });
    I.cym.crash(E, 0.45);
  }
}
export class Defeat extends Piece {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 7.5); this.tempo(56, 4); this.orch({ choir: 'choir_oo' }); this.I('bell', Mallet, { kind: 'tubular', pan: 0.3, rev: 0.75, scale: 0.22 }); }
  score(t, I, s) {
    const T = (b) => t + b * s;
    I.timp.hit(t, 38, 0.6); I.bell.note(T(0.02), 50, 5, 0.55); I.fx.boom(t, 0.4);
    I.low.note(t, 26, s * 6, 0.45, { a: 0.8, r: 2 }); I.low.note(t, 38, s * 6, 0.35, { a: 1, r: 2 });
    this.pad(I.choir, T(0.2), s * 2.6, 'Dm', { n: 4, lo: 57, hi: 72, vel: 0.5, a: 1.4, r: 1.2, key: 'choir' });
    this.pad(I.str, T(0.3), s * 2.5, 'Dm', { n: 4, lo: 50, hi: 69, vel: 0.35, a: 1.2, key: 'str' });
    // the call, falling instead of rising
    this.line(I.horn, T(0.9), mel('A4:1.5 D4:.5 A3:2 | Bb3:1 G3:1 A3:2.5'), { vel: 0.6, legato: 1 });
    this.pad(I.str, T(3), s * 1.6, 'Gm/D', { n: 4, lo: 50, hi: 69, vel: 0.32, a: 0.6, key: 'str' });
    this.pad(I.choir, T(3), s * 1.6, 'Gm/D', { n: 4, lo: 57, hi: 72, vel: 0.42, a: 0.6, key: 'choir' });
    this.pad(I.str, T(4.6), s * 1.8, 'Dm', { n: 4, lo: 50, hi: 69, vel: 0.28, a: 0.8, r: 2.2, key: 'str' });
    this.pad(I.choir, T(4.6), s * 1.8, 'Dm', { n: 4, lo: 57, hi: 72, vel: 0.36, a: 0.8, r: 2.2, key: 'choir' });
    I.timp.hit(T(4.6), 38, 0.35); I.bell.note(T(4.62), 45, 5, 0.35);
    this.line(I.cel, T(5.2), SHARD, { vel: 0.22, tr: -12, hum: 3 });
  }
}

// ---------------------------------------------------------------- stingers
export class LevelUp extends Piece {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 3.4); this.tempo(120, 4); this.orch(); }
  score(t, I, s) {
    const T = (b) => t + b * s;
    I.cym.swell(t, s * 1, 0.45);
    [62, 66, 69].forEach((m, i) => I.tpt.note(T(i * 0.33), m + 12, s * 0.3, 0.7, { art: 'stab' }));
    const H = T(1);
    this.line(I.tpt, H, [{ b: 0, d: 2.5, m: 86 }], { vel: 0.75 });
    this.pad(I.brass, H, s * 2.4, 'D', { n: 4, lo: 50, hi: 69, vel: 0.68, art: 'marc', key: 'brass' });
    this.pad(I.choir, H, s * 2.6, 'Dadd9', { n: 5, lo: 57, hi: 79, vel: 0.56, a: 0.08, r: 1.4, key: 'choir' });
    this.pad(I.str, H, s * 2.6, 'D', { n: 5, lo: 50, hi: 78, vel: 0.5, a: 0.05, r: 1.4 });
    this.bass(I.low, H, s * 2.6, 'D', { lo: 26, hi: 38, vel: 0.55, oct: true, r: 1.4 });
    I.timp.hit(H, 38, 0.9); I.cym.crash(H, 0.7);
    I.harp.gliss(H, [62, 66, 69, 74, 78, 81, 86, 90], s * 1, 0.4);
    this.line(I.glock, H + s * 0.6, SHARD_MAJ, { vel: 0.38, tr: -12, hum: 2 });
  }
}
export class QuestComplete extends Piece {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 3.2); this.tempo(96, 4); this.orch(); }
  score(t, I, s) {
    const T = (b) => t + b * s;
    // IV – V – I in D, horn melody G–A–D
    this.pad(I.str, t, s, 'G', { n: 4, lo: 50, hi: 69, vel: 0.42, a: 0.08 });
    this.pad(I.str, T(1), s, 'A', { n: 4, lo: 50, hi: 69, vel: 0.46, a: 0.08 });
    this.pad(I.str, T(2), s * 2.5, 'D', { n: 5, lo: 50, hi: 74, vel: 0.5, a: 0.08, r: 1.4 });
    this.line(I.horn, t, mel('B4:1 C#5:1 D5:2.5'), { vel: 0.66 });
    for (const [b, c] of [[0, 'G'], [1, 'A'], [2, 'D']]) this.bass(I.low, T(b), s * (b === 2 ? 2.5 : 1), c, { lo: 38, hi: 50, vel: 0.45, r: b === 2 ? 1.4 : 0.4 });
    I.timp.hit(T(2), 38, 0.55);
    I.harp.gliss(T(2), [62, 66, 69, 74, 78, 81, 86], s * 0.9, 0.36);
    I.cel.note(T(2.6), 90, 1, 0.3); I.cel.note(T(2.9), 93, 1, 0.26);
  }
}
export class Achievement extends Piece {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 3.6); this.tempo(110, 4); this.orch(); }
  score(t, I, s) {
    const T = (b) => t + b * s;
    this.line(I.tpt, t, mel('A4:.5 D5:.5 F#5:.5 A5:2.5!'), { vel: 0.72, legato: 0.92 });
    this.line(I.horn, t, mel('A3:.5 D4:.5 F#4:.5 A4:2.5'), { vel: 0.6, legato: 0.92 });
    this.pad(I.brass, T(1.5), s * 2.4, 'D', { n: 4, lo: 50, hi: 69, vel: 0.62, art: 'marc', key: 'brass' });
    this.pad(I.str, T(1.5), s * 2.6, 'Dmaj7', { n: 5, lo: 50, hi: 76, vel: 0.46, a: 0.1, r: 1.4 });
    this.bass(I.low, T(1.5), s * 2.6, 'D', { lo: 26, hi: 38, vel: 0.5, oct: true, r: 1.4 });
    I.cym.crash(T(1.5), 0.55); I.timp.hit(T(1.5), 38, 0.7);
    [86, 90, 93, 98].forEach((m, i) => I.glock.note(T(1.5) + i * 0.09, m - 12, 1, 0.45));
    I.harp.gliss(T(1.6), [74, 78, 81, 85, 86, 90, 93], s, 0.3);
  }
}
export class LegendaryDrop extends Piece {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 5); this.tempo(90, 4); this.orch(); }
  score(t, I, s) {
    const T = (b) => t + b * s;
    I.cym.swell(t, s * 1.4, 0.55); I.fx.riser(t, s * 1.4, 0.35);
    this.line(I.cel, t, SHARD_MAJ, { vel: 0.45, tr: -12, hum: 2 });
    const H = T(1.5);
    I.fx.boom(H, 0.6); I.cym.crash(H, 0.75); I.timp.hit(H, 38, 0.85);
    this.pad(I.choir, H, s * 3.5, 'Dadd9', { n: 5, lo: 57, hi: 81, vel: 0.6, a: 0.15, r: 1.8, key: 'choir' });
    this.pad(I.brass, H, s * 3, 'D', { n: 4, lo: 50, hi: 69, vel: 0.66, art: 'marc', r: 1.2, key: 'brass' });
    this.pad(I.str, H, s * 3.5, 'D', { n: 5, lo: 50, hi: 78, vel: 0.5, a: 0.1, r: 1.8 });
    this.bass(I.low, H, s * 3.5, 'D', { lo: 26, hi: 38, vel: 0.55, oct: true, r: 1.8 });
    this.line(I.tpt, H, CALL_MAJ, { vel: 0.7, tr: 12 });
    I.harp.gliss(T(2), [62, 64, 66, 68, 69, 74, 76, 78, 80, 81, 86, 88, 90], s * 1.3, 0.42); // Lydian sparkle
    this.line(I.glock, T(3), SHARD_MAJ, { vel: 0.36, tr: -12, hum: 2 });
  }
}
// boss_intro: a crushing hit, then a dark swell for the name reveal, then a lead-in into the fight music
export class BossIntro extends Piece {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 4.6); this.tempo(90, 4); this.orch(); this.I('trem', Strings, { pan: -0.3, rev: 0.5, scale: 0.06 }); }
  score(t, I, s) {
    const T = (b) => t + b * s;
    I.fx.boom(t, 0.9); I.taiko.hit(t, 1); I.timp.hit(t, 38, 1); I.cym.crash(t, 0.8);
    for (const m of [38, 45, 50, 51]) I.brass.note(t, m, s * 1.2, 0.8, { art: 'marc', r: 0.8 }); // D–A–D–Eb: the half-step bite
    I.low.note(t, 26, s * 5.5, 0.6, { a: 0.02, r: 1.2 });
    // name reveal: tremolo cluster + dark horn swell + low choir
    I.trem.note(T(1.2), 74, s * 3.6, 0.3, { art: 'trem', a: 0.8 }); I.trem.note(T(1.2), 75, s * 3.6, 0.22, { art: 'trem', a: 1.2 });
    this.pad(I.horns, T(1.3), s * 3, 'Dm', { n: 3, lo: 45, hi: 57, vel: 0.55, art: 'swell', a: 2.2, key: 'horns' });
    this.pad(I.choir, T(1.5), s * 3, 'Dm', { n: 4, lo: 45, hi: 60, vel: 0.5, art: 'swell', a: 2, key: 'choir' });
    // lead-in
    I.timp.roll(T(4.4), 38, s * 1.5, 0.1, 0.9, { hit: false }); I.cym.swell(T(4.4), s * 1.6, 0.6);
    for (let k = 0; k < 6; k++) I.taiko.hit(T(4.4 + k * 0.25), 0.3 + k * 0.1);
  }
}
export class RaidClear extends Piece {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 9); this.tempo(92, 4); this.orch(); }
  score(t, I, s) {
    const T = (b) => t + b * s;
    I.timp.roll(t, 45, s * 1.5, 0.1, 0.9, { hit: false }); I.cym.swell(t, s * 1.5, 0.6);
    const H = T(1.5);
    // the full HERO call in major, tutti
    const call = mel('D4:1.5! A4:.5 D5:2 | C#5:.5 B4:.5 A4:1 F#4:1 A4:1 | D5:4!');
    this.line(I.horn, H, call, { vel: 0.82 }); this.line(I.tpt, H, call, { vel: 0.6, tr: 12 });
    this.line(I.str, H, call, { vel: 0.55, tr: 12, a: 0.05, r: 0.4 });
    for (const [b, c] of [[0, 'D'], [4, 'Bm7'], [8, 'D']]) {
      this.pad(I.brass, H + b * s, s * 2, c, { n: 4, lo: 45, hi: 62, vel: 0.64, art: 'marc', key: 'brass' });
      this.pad(I.choir, H + b * s, s * 4, c, { n: 4, lo: 52, hi: 69, vel: 0.56, a: 0.2, key: 'choir' });
      this.bass(I.low, H + b * s, s * 4, c, { lo: 26, hi: 38, vel: 0.58, oct: true });
      I.taiko.hit(H + b * s, 0.9); I.timp.hit(H + b * s, 38, 0.8); I.cym.crash(H + b * s, b ? 0.55 : 0.85);
    }
    // epic cadence Bb – C – D
    const C0 = T(13.5);
    for (const [i, c] of [[0, 'Bb'], [1, 'C'], [2, 'D']]) {
      const tt = C0 + i * 1.5 * s, dur = i === 2 ? s * 3 : s * 1.5;
      this.pad(I.str, tt, dur, c, { n: 5, lo: 50, hi: 76, vel: 0.62, a: 0.1, r: i === 2 ? 2.5 : 0.6 });
      this.pad(I.choir, tt, dur, c, { n: 4, lo: 55, hi: 74, vel: 0.6, a: 0.1, r: i === 2 ? 2.5 : 0.6, key: 'choir' });
      this.pad(I.brass, tt, dur, c, { n: 4, lo: 48, hi: 67, vel: 0.66, art: 'marc', r: i === 2 ? 1.5 : 0.5, key: 'brass' });
      this.bass(I.low, tt, dur, c, { lo: 26, hi: 38, vel: 0.6, oct: true, r: i === 2 ? 2.5 : 0.6 });
      I.taiko.hit(tt, 0.85); I.timp.hit(tt, [46, 48, 38][i], 0.8);
    }
    I.cym.crash(C0 + 3 * s, 0.9); I.fx.boom(C0 + 3 * s, 0.6);
    I.harp.gliss(C0 + 3 * s, [62, 66, 69, 74, 78, 81, 86, 90], s * 1.2, 0.4);
    this.line(I.glock, C0 + 4 * s, SHARD_MAJ, { vel: 0.4, tr: -12, hum: 2 });
    this.length = (C0 - t) + 5 * s;
  }
}
export class Wipe extends Piece {
  constructor(e, n, t0, seed, dest) { super(e, n, t0, seed, dest, 6.5); this.tempo(58, 4); this.orch({ choir: 'choir_oo' }); this.I('bell', Mallet, { kind: 'tubular', pan: 0.3, rev: 0.75, scale: 0.22 }); }
  score(t, I, s) {
    const T = (b) => t + b * s;
    I.timp.hit(t, 38, 0.6); I.bell.note(T(0.02), 50, 5, 0.55);
    I.low.note(t, 26, s * 6, 0.45, { a: 0.8, r: 2 }); I.low.note(t, 38, s * 6, 0.35, { a: 1, r: 2 });
    this.pad(I.choir, T(0.2), s * 2.6, 'Dm', { n: 4, lo: 57, hi: 72, vel: 0.5, a: 1.4, r: 1.2, key: 'choir' });
    this.pad(I.str, T(0.3), s * 2.5, 'Dm', { n: 4, lo: 50, hi: 69, vel: 0.35, a: 1.2, key: 'str' });
    this.line(I.horn, T(0.9), mel('A4:1 G4:1 F4:1 E4:.75 D4:2.5'), { vel: 0.6, legato: 1 });
    this.pad(I.str, T(3), s * 1.6, 'Gm/D', { n: 4, lo: 50, hi: 69, vel: 0.32, a: 0.6, key: 'str' });
    this.pad(I.choir, T(3), s * 1.6, 'Gm/D', { n: 4, lo: 57, hi: 72, vel: 0.42, a: 0.6, key: 'choir' });
    this.pad(I.str, T(4.6), s * 1.8, 'Dm', { n: 4, lo: 50, hi: 69, vel: 0.28, a: 0.8, r: 2.2, key: 'str' });
    this.pad(I.choir, T(4.6), s * 1.8, 'Dm', { n: 4, lo: 57, hi: 72, vel: 0.36, a: 0.8, r: 2.2, key: 'choir' });
    I.timp.hit(T(4.6), 38, 0.35); I.bell.note(T(4.62), 45, 5, 0.35);
  }
}
