// 'field_dark' — Thornwood / Ashen Ridge: dread, tension, things moving in the dark. C minor with a Phrygian Db and a
// harmonic-minor G major, 4/4 at 84 BPM (bar ≈ 2.9 s). Sections (8 bars): creep (low spiccato ostinato + bassoon
// motif) · stalk (tremolo clusters, pulsing mid taiko, horn swells) · threat (big taiko, brass, dark choir) ·
// hollow (almost nothing: celesta, harp, a drone, distant booms). Ostinati and progressions are re-drawn each cycle.
import { Track } from './track.js';
import { Ens, Strings, Wind, Horn, Harp, Mallet, Timpani, Taiko, Cymbal, Fx } from './instruments.js';
import { mel, chord } from './theory.js';

const MOTIF = mel('C4:1.5 D4:.5 Eb4:1 D4:1 | C4:3 Ab3:1 | F3:1 Ab3:1 C4:1 Db4:1 | B3:3 r:1 | C4:1.5 D4:.5 Eb4:1 F4:1 | G4:2 Ab4:1 G4:1 | F4:1 Eb4:1 D4:1 Db4:1 | C4:4');
const MOTIF_CH = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Cm', 'Fm', 'Cm'];
const PROGS = [
  ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'Db', 'G'],
  ['Cm', 'Db', 'Cm', 'Bb', 'Ab', 'Db', 'Gsus4', 'G'],
  ['Cm', 'Cm', 'Ebm/Bb', 'Ab', 'Cm', 'Cm', 'Db', 'Db'],
  ['Fm', 'Cm', 'Db', 'Ab', 'Fm', 'Cm', 'Db', 'G'],
];
const OST = [[0, 0, 1, 0, 0, 0, -2, 0], [0, 12, 0, 10, 0, 8, 0, 7], [0, 0, 7, 0, 6, 0, 3, 1], [0, 3, 7, 3, 0, 3, 8, 7]];

export class FieldDark extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(this.rng.range(82, 86), 4);
    this.I('low', Ens, { patch: 'strings', pan: 0.2, rev: 0.35, scale: 0.32, bright: 0.6 });
    this.I('str', Ens, { patch: 'strings', pan: -0.2, rev: 0.45, scale: 0.26, bright: 0.7 });
    this.I('spc', Strings, { pan: 0.15, rev: 0.25, bright: 0.8, hp: 45 });
    this.I('trem', Strings, { pan: -0.35, rev: 0.5, bright: 0.8, scale: 0.05 });
    this.I('oo', Ens, { patch: 'choir_oo', rev: 0.6, scale: 0.26, bright: 0.8 });
    this.I('bsn', Wind, { kind: 'bassoon', pan: 0.1, rev: 0.45 });
    this.I('clar', Wind, { kind: 'clarinet', pan: -0.1, rev: 0.5 });
    this.I('horn', Horn, { pan: 0.3, rev: 0.55 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.5, scale: 0.26, bright: 0.8 });
    this.I('brass', Ens, { patch: 'brass', pan: 0.2, rev: 0.4, scale: 0.22 });
    this.I('harp', Harp, { pan: -0.4, rev: 0.6 });
    this.I('cel', Mallet, { kind: 'celesta', pan: 0.35, rev: 0.75, scale: 0.2 });
    this.I('tk', Taiko, { size: 'big', rev: 0.4 });
    this.I('tkm', Taiko, { size: 'mid', pan: 0.25, rev: 0.35 });
    this.I('timp', Timpani, { rev: 0.45 });
    this.I('cym', Cymbal, { rev: 0.5 });
    this.I('fx', Fx, { rev: 0.5 });
    this.cycle = 0; this.plan();
  }
  plan() {
    const r = this.rng;
    this.form = this.cycle === 0 ? ['hollow', 'creep', 'stalk', 'threat', 'hollow', 'creep'] : r.pick([['creep', 'stalk', 'threat', 'hollow'], ['stalk', 'creep', 'threat', 'threat', 'hollow'], ['hollow', 'stalk', 'creep', 'threat']]);
    this.prog = r.pick(PROGS); this.ost = r.pick(OST); this.ost2 = r.pick(OST);
    this.si = 0; this.sb = 0; this.cycle++;
  }
  playBar(bar, t) {
    const I = this.inst, B = this.barDur, s = this.spb, r = this.rng;
    const type = this.form[this.si], sb = this.sb;
    const chs = type === 'creep' ? MOTIF_CH : this.prog;
    const ch = chs[sb % 8], c = chord(ch), root = 36 + ((c.bass - 0 + 12) % 12);
    const ost = sb >= 4 ? this.ost2 : this.ost;
    const inten = { hollow: 0.5, creep: 0.75, stalk: 0.88, threat: 1 }[type];
    // low spiccato ostinato (not in hollow)
    if (type !== 'hollow') for (let k = 0; k < 8; k++) {
      const m = root + ost[k];
      I.spc.note(this.bt(t, k * 0.5) + this.hum(3), m, s * 0.45, (k % 2 === 0 ? 0.6 : 0.42) * inten, { d: 0.15 });
      if (type === 'threat') I.spc.note(this.bt(t, k * 0.5), m + 12, s * 0.45, 0.3, { d: 0.12 });
    }
    // sustained low strings + dark harmony
    if (sb % 2 === 0) {
      I.low.note(t, root < 40 ? root : root - 12, B * 2, 0.36 * inten + 0.1, { a: 0.8, r: 1 });
      if (type !== 'creep') this.pad(I.str, t, B * 2, ch, { n: 3, lo: 48, hi: 63, vel: 0.26 + 0.1 * inten, a: 1, r: 1.2, art: 'pad' });
    }
    switch (type) {
      case 'hollow': {
        if (sb === 0) { I.fx.boom(this.bt(t, 0.2), 0.4); this.pad(I.oo, this.bt(t, 1), B * 4, 'Cm', { n: 3, lo: 55, hi: 70, vel: 0.28, a: 3, r: 2.5, art: 'pad', key: 'oo' }); }
        if (r.chance(0.6)) { const tn = this.tones(ch, 72, 5); I.cel.note(this.bt(t, r.pick([0.5, 1, 2, 2.5])), r.pick(tn), 1, 0.3); }
        if (r.chance(0.5)) { const tn = this.tones(ch, 48, 6); for (let k = 0; k < 3; k++) I.harp.note(this.bt(t, k * 1.33) + this.hum(20), tn[(k * 2 + sb) % tn.length], B, 0.2); }
        if (sb === 4) I.fx.boom(t, 0.3);
        if (sb === 7) { I.timp.roll(this.bt(t, 1), 36, B - s - 0.05, 0.03, 0.45, { hit: false }); }
        break;
      }
      case 'creep': {
        this.line(sb < 4 || this.cycle % 2 ? I.bsn : I.clar, t, this.barSlice(MOTIF, sb, 4), { vel: 0.55, tr: sb < 4 || this.cycle % 2 ? 0 : 12 });
        if (sb % 2 === 0) I.tkm.hit(t, 0.4);
        if (sb === 7) I.cym.swell(this.bt(t, 1), B - s, 0.35);
        break;
      }
      case 'stalk': {
        if (sb % 4 === 0) {
          const top = 79 + (c.root % 12 === 1 ? 1 : 0);
          I.trem.note(t, top, B * 4 - 0.1, 0.3, { art: 'trem', a: 1.5, r: 0.8 }); I.trem.note(t, top + 1, B * 4 - 0.1, 0.22, { art: 'trem', a: 2, r: 0.8 });
          this.pad(I.horns, t, B * 2, ch, { n: 2, lo: 48, hi: 60, vel: 0.46, art: 'swell', a: 1.5, key: 'hornL' });
        }
        I.tkm.hit(t, 0.55); I.tkm.hit(this.bt(t, 2), 0.4); if (sb % 2) I.tkm.hit(this.bt(t, 3.5), 0.35);
        // the half-step menace (root → b2 → root) on the chord's own root, so it bites without clashing
        if (sb === 2 || sb === 6) { const rm = 60 + ((c.root % 12) + 12) % 12 - (c.root % 12 > 6 ? 12 : 0); this.line(I.horn, t, [{ b: 0, d: 1.5, m: rm }, { b: 1.5, d: 0.5, m: rm + 1 }, { b: 2, d: 2, m: rm }], { vel: 0.5 }); }
        if (sb === 7) { I.cym.swell(this.bt(t, 1), B - s, 0.45); I.timp.roll(this.bt(t, 2), 36, B * 0.5 - 0.05, 0.05, 0.6, { hit: false }); }
        break;
      }
      case 'threat': {
        for (const b of [0, 1.5, 3]) I.tk.hit(this.bt(t, b), b === 0 ? 0.9 : 0.7);
        for (let k = 0; k < 8; k++) I.tkm.hit(this.bt(t, k * 0.5), k % 2 ? 0.25 : 0.38);
        if (sb % 2 === 0) I.timp.hit(t, root < 40 ? root : root - 12, 0.7);
        if (sb === 0) I.cym.crash(t, 0.6);
        const v = this.voicing(ch, 4, 48, 65, 'bst');
        for (const m of v) { I.brass.note(t, m, s * 0.8, 0.72, { art: 'stab' }); if (sb % 2 === 1) I.brass.note(this.bt(t, 2.5), m, s * 0.6, 0.58, { art: 'stab' }); }
        if (sb % 4 === 0) this.pad(I.oo, t, B * 4, ch, { n: 4, lo: 48, hi: 67, vel: 0.46, a: 0.8, key: 'oo' });
        if (sb === 4) this.line(I.horn, t, this.barSlice(MOTIF, 0, 4), { vel: 0.62, tr: 12 });
        if (sb === 7) { I.cym.swell(this.bt(t, 1), B - s, 0.5); I.fx.riser(this.bt(t, 1), B - s, 0.3); }
        break;
      }
    }
    if (++this.sb >= 8) {
      this.sb = 0;
      if (++this.si >= this.form.length) this.plan();
    }
    return B;
  }
}
