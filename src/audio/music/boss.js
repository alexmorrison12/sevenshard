// 'boss' — Guardian Hunt: driving percussion + brass. D minor, 4/4 at 140 BPM (bar ≈ 1.7 s).
// GUARDIAN motif: an arpeggiated hunting-horn line (D-F-A-D, answered down; sequenced on C; climbs to A5).
// Sections: intro (drums + low strings) · A (spiccato ostinato, brass stabs, taiko 3-3-2) · B (motif on horns + trumpets,
// choir pads) · C (choir chant, 16th violins) · duel (brass call / strings answer) · bridge (breath before the next wave).
import { Track } from './track.js';
import { Ens, Strings, Horn, Taiko, Timpani, Cymbal, Fx } from './instruments.js';
import { mel, chord } from './theory.js';

const GUARD = mel('D4:1 F4:.5 A4:.5 D5:1.5 C5:.5 | Bb4:1 A4:.5 G4:.5 F4:2 | E4:1 G4:.5 C5:.5 E5:1.5 D5:.5 | C#5:2 A4:2 | D5:1 F5:1 A5:1.5 G5:.5 | F5:1 D5:1 Bb4:1 D5:1 | G4:1 Bb4:1 A4:1 C#5:1 | D5:4!');
const GUARD_CH = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', ['Gm', 'A'], 'Dm'];
const A_CH = [['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'], ['Dm', 'C', 'Bb', 'A', 'Dm', 'F', 'Gm', 'A']];
const C_CH = [['Bb', 'C', 'Dm', 'Dm', 'Gm', 'Bb', 'A', 'A'], ['Gm', 'A', 'Dm', 'Bb', 'Gm', 'C', 'A', 'A']];
const DUEL_CH = ['Dm', 'Dm', 'Eb', 'Eb', 'Dm', 'Dm', 'C', 'A'];
const HI_PAT = [[2, 0, 1, 0, 3, 0, 1, 0], [0, 1, 2, 1, 3, 2, 1, 2], [3, 0, 2, 0, 1, 0, 2, 0]];

export class Boss extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(140, 4);
    this.I('low', Strings, { pan: 0.2, rev: 0.25, bright: 1, body: 200, hp: 40 });
    this.I('hi', Strings, { pan: -0.35, rev: 0.35, bright: 1.1 });
    this.I('str', Ens, { patch: 'strings', pan: -0.1, rev: 0.4, scale: 0.28 });
    this.I('bass', Ens, { patch: 'strings', pan: 0.2, rev: 0.3, scale: 0.3, bright: 0.65 });
    this.I('brass', Ens, { patch: 'brass', pan: 0.2, rev: 0.4, scale: 0.24 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.45, scale: 0.26 });
    this.I('horn', Horn, { pan: 0.3, rev: 0.5 });
    this.I('tpt', Horn, { kind: 'trumpet', pan: 0.1, rev: 0.45 });
    this.I('choir', Ens, { patch: 'choir_ah', rev: 0.5, scale: 0.26 });
    this.I('taiko', Taiko, { size: 'big', rev: 0.35 });
    this.I('mid', Taiko, { size: 'mid', pan: 0.25, rev: 0.3 });
    this.I('small', Taiko, { size: 'small', pan: -0.25, rev: 0.3 });
    this.I('timp', Timpani, { rev: 0.4 });
    this.I('cym', Cymbal, { rev: 0.45 });
    this.I('fx', Fx, { rev: 0.4 });
    this.cycle = 0; this.plan();
  }
  plan() {
    const r = this.rng;
    this.form = this.cycle === 0 ? ['intro', 'A', 'B', 'C', 'bridge', 'B', 'duel', 'C'] : r.pick([['A', 'C', 'B', 'duel', 'bridge', 'B'], ['A', 'B', 'duel', 'C', 'bridge', 'C'], ['C', 'A', 'B', 'bridge', 'duel', 'B']]);
    this.ach = r.pick(A_CH); this.cch = r.pick(C_CH); this.hpat = r.pick(HI_PAT);
    this.si = 0; this.sb = 0; this.cycle++;
  }
  chs(type) { return type === 'B' ? GUARD_CH : type === 'C' ? this.cch : type === 'duel' ? DUEL_CH : type === 'bridge' ? ['Dm', 'Bb', 'Gm', 'A'] : this.ach; }
  playBar(bar, t) {
    const I = this.inst, s = this.spb, B = this.barDur;
    const type = this.form[this.si], sb = this.sb, len = type === 'intro' || type === 'bridge' ? 4 : 8;
    const raw = this.chs(type)[sb % 8], list = Array.isArray(raw) ? raw : [raw];
    const each = (fn) => list.forEach((c, i) => fn(c, t + i * (B / list.length), B / list.length));
    const c0 = chord(list[0]), tp = 38 + ((c0.bass - 2 + 12) % 12);
    // --- drums ---
    const big = type === 'intro' ? (sb < 2 ? [0] : [0, 3, 6]) : type === 'bridge' ? [0] : [0, 3, 6];
    for (const k of big) I.taiko.hit(this.bt(t, k * 0.5), k === 0 ? 0.95 : 0.76);
    if (type !== 'intro' && type !== 'bridge') { I.mid.hit(this.bt(t, 1), 0.5); I.mid.hit(this.bt(t, 3), 0.55, { rim: sb % 2 === 1 }); }
    if (type === 'C' || type === 'duel') for (let k = 0; k < 8; k++) I.small.hit(this.bt(t, k * 0.5), k % 2 ? 0.22 : 0.32);
    if (type !== 'intro' || sb >= 2) I.timp.hit(t, tp, sb % 4 === 0 ? 0.8 : 0.55);
    if (sb === 0 && type !== 'intro' && type !== 'bridge') I.cym.crash(t, 0.75);
    if (sb === len - 1) { I.cym.swell(this.bt(t, 1), B - s, 0.55); if (type !== 'intro') for (let k = 0; k < 4; k++) I.small.hit(this.bt(t, 3 + k * 0.25), 0.3 + k * 0.1); }
    if (type === 'intro' && sb === 3) I.timp.roll(t, 38, B - 0.05, 0.1, 0.9, { hit: false });
    if (type === 'intro' && sb === 0) I.fx.boom(t, 0.7);
    // --- low strings: 8ths with 3-3-2 accents ---
    if (type !== 'bridge') each((c, tt, d) => {
      const cc = chord(c), rt = 36 + ((cc.bass + 12) % 12) + (cc.bass < 2 ? 12 : 0);
      for (let k = 0; k < Math.round(d / (0.5 * s)); k++) {
        const slot = k % 8, acc = slot === 0 || slot === 3 || slot === 6;
        I.low.note(tt + k * 0.5 * s, rt, s * 0.4, acc ? 0.62 : 0.4, { d: 0.12 });
      }
    });
    // --- high string ostinato (16ths) ---
    if (type === 'A' || type === 'C') each((c, tt, d) => {
      const tn = this.tones(c, type === 'C' ? 74 : 67, 4);
      for (let k = 0; k < Math.round(d / (0.25 * s)); k++) I.hi.note(tt + k * 0.25 * s, tn[this.hpat[k % 8]], s * 0.22, k % 4 === 0 ? 0.5 : 0.36, { d: 0.09 });
    });
    // --- brass stabs ---
    if (type === 'A' || type === 'C') {
      each((c, tt) => { for (const m of this.voicing(c, 4, 50, 67, 'bst')) I.brass.note(tt, m, s * 0.9, 0.7, { art: 'stab' }); });
      if (sb % 2 === 1) { const nx = [].concat(this.chs(type)[(sb + 1) % 8])[0]; for (const m of this.voicing(nx, 3, 50, 65, 'bst2')) I.brass.note(this.bt(t, 3.5), m, s * 0.5, 0.6, { art: 'stab' }); }
    }
    // --- theme / pads / choir ---
    if (type === 'B') {
      const notes = this.barSlice(GUARD, sb, 4);
      this.line(I.horn, t, notes, { vel: 0.8 }); this.line(I.tpt, t, notes, { vel: 0.5, tr: 12 });
      each((c, tt, d) => { this.pad(I.choir, tt, d, c, { n: 4, lo: 52, hi: 67, vel: 0.5, a: 0.25, key: 'choir' }); this.pad(I.str, tt, d, c, { n: 4, lo: 45, hi: 62, vel: 0.35, a: 0.2 }); I.bass.note(tt, this.bassPitch(c, 26, 38, 'bb'), d, 0.5, { a: 0.05 }); });
    }
    if (type === 'C') {
      each((c, tt, d) => {
        const v = this.voicing(c, 3, 57, 72, 'chant');
        for (const sl of [0, 2, 3, 5, 6]) if (sl * 0.5 * s < d - 0.01) for (const m of v) I.choir.note(tt + sl * 0.5 * s, m, s * 0.4, sl % 3 === 0 ? 0.62 : 0.45, { art: 'stacc' });
        this.pad(I.str, tt, d, c, { n: 4, lo: 52, hi: 70, vel: 0.3, a: 0.2 });
      });
      if (sb >= 4) this.line(I.horn, t, [{ b: 0, d: 3.8, m: this.voicing(list[0], 1, 62, 74, 'hornTop')[0] }], { vel: 0.6 });
    }
    if (type === 'duel') {
      // brass calls (bars 0,2,4,6), strings answer (1,3,5,7) — fragments of the motif
      const frag = this.barSlice(GUARD, sb % 2 === 0 ? 0 : 2, 4), tr = [0, 0, 1, 1, 0, 0, -2, -1][sb];
      if (sb % 2 === 0) { this.line(I.horn, t, frag, { vel: 0.78, tr }); this.line(I.tpt, t, frag, { vel: 0.5, tr: tr + 12 }); for (const m of this.voicing(list[0], 4, 48, 64, 'bst')) I.brass.note(t, m, s * 0.9, 0.7, { art: 'stab' }); }
      else { const hi = this.barSlice(GUARD, 4, 4); this.line(I.str, t, hi, { vel: 0.58, tr: tr - 12, a: 0.05, r: 0.3 }); }
      each((c, tt, d) => I.bass.note(tt, this.bassPitch(c, 26, 38, 'bb'), d, 0.45, { a: 0.05 }));
    }
    if (type === 'bridge') {
      if (sb === 0) { this.pad(I.choir, t, B * 4, list[0], { n: 4, lo: 55, hi: 74, vel: 0.55, a: 2.5, art: 'swell', key: 'choir' }); I.fx.boom(t, 0.5); }
      each((c, tt, d) => { I.bass.note(tt, this.bassPitch(c, 33, 45, 'bb'), d, 0.42, { a: 0.3 }); });
      if (sb === 3) { I.timp.roll(t, 38, B - 0.05, 0.1, 0.9, { hit: false }); I.fx.riser(t, B, 0.35); }
    }
    if (++this.sb >= len) { this.sb = 0; if (++this.si >= this.form.length) this.plan(); }
    return B;
  }
}
