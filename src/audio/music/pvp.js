// 'pvp' — the Proving Grounds / the Crucible: tense, focused, rising. A minor, 4/4 at 128 BPM (bar ≈ 1.9 s).
// Sections: standoff (a ticking woodblock clock, low synth pulse, tremolo cluster, distant timpani) · clash (3-3-2
// spiccato ostinato, snare + taiko, brass stabs, the MENACE half-step swells) · surge (a 2-bar cell climbing in
// sequence each pass, snare rolls, risers) · breath (short reset). Ostinati re-drawn per cycle.
import { Track } from './track.js';
import { Ens, Strings, Horn, Synth, Taiko, Snare, Timpani, Cymbal, Fx, HandDrum } from './instruments.js';
import { chord, transpose } from './theory.js';

const CLASH_CH = [['Am', 'Am', 'F', 'F', 'Dm', 'Dm', 'E', 'E'], ['Am', 'F', 'Am', 'G', 'F', 'Dm', 'E', 'E'], ['Am', 'Bb', 'Am', 'F', 'Dm', 'Bb', 'E', 'E']];
const OST = [[0, 12, 7, 0, 12, 7, 0, 3], [0, 0, 3, 0, 5, 0, 3, 1], [0, 7, 12, 7, 0, 7, 10, 7]];

export class Pvp extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(128, 4);
    this.I('spc', Strings, { pan: 0.2, rev: 0.25, bright: 1 });
    this.I('trem', Strings, { pan: -0.35, rev: 0.45, bright: 0.9, scale: 0.05 });
    this.I('low', Ens, { patch: 'strings', pan: 0.2, rev: 0.3, scale: 0.3, bright: 0.6 });
    this.I('str', Ens, { patch: 'strings', pan: -0.15, rev: 0.4, scale: 0.26 });
    this.I('brass', Ens, { patch: 'brass', pan: 0.15, rev: 0.4, scale: 0.24 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.45, scale: 0.26 });
    this.I('tpt', Horn, { kind: 'trumpet', pan: 0.1, rev: 0.45 });
    this.I('pulse', Synth, { kind: 'bass', rev: 0.1 });
    this.I('sub', Synth, { kind: 'sub' });
    this.I('snare', Snare, { rev: 0.25 });
    this.I('tk', Taiko, { size: 'big', rev: 0.35 });
    this.I('tkm', Taiko, { size: 'mid', pan: 0.2, rev: 0.3 });
    this.I('timp', Timpani, { rev: 0.4 });
    this.I('cym', Cymbal, { rev: 0.4 });
    this.I('fx', Fx, { rev: 0.4 });
    this.I('clock', HandDrum, { pan: -0.2, rev: 0.2 });
    this.cycle = 0; this.plan();
  }
  plan() {
    const r = this.rng;
    this.form = this.cycle === 0 ? ['standoff', 'clash', 'surge', 'breath', 'clash', 'surge'] : r.pick([['clash', 'standoff', 'surge', 'clash', 'breath'], ['standoff', 'surge', 'clash', 'clash', 'breath'], ['clash', 'surge', 'breath', 'clash']]);
    this.ch = r.pick(CLASH_CH); this.ost = r.pick(OST); this.si = 0; this.sb = 0; this.cycle++;
  }
  playBar(bar, t) {
    const I = this.inst, B = this.barDur, s = this.spb;
    const type = this.form[this.si], sb = this.sb, len = type === 'breath' ? 2 : 8;
    // surge: the 2-bar cell rises a step every pass (A, B, C, D)
    const lift = type === 'surge' ? [0, 0, 2, 2, 3, 3, 5, 5][sb] : 0;
    const chs = type === 'surge' ? ['Am', 'F'] : type === 'standoff' ? ['Am', 'Am', 'Bb', 'Am'] : type === 'breath' ? ['E', 'E'] : this.ch;
    const ch0 = transpose(chs[sb % chs.length], lift), c = chord(ch0), root = 33 + ((c.root - 9 + 12) % 12);
    const q = s / 4;
    // clock: always ticking (8ths), accent on the beat
    for (let k = 0; k < 8; k++) I.clock.block(this.bt(t, k * 0.5), k % 2 ? 0.28 : 0.4, k % 2 === 1);
    if (type === 'standoff') {
      for (let k = 0; k < 4; k++) I.pulse.note(this.bt(t, k), root + 12, s * 0.5, 0.4, { open: 3 });
      if (sb % 4 === 0) { I.trem.note(t, 76, B * 4 - 0.1, 0.25, { art: 'trem', a: 1.2 }); I.trem.note(t, 77, B * 4 - 0.1, 0.18, { art: 'trem', a: 1.8 }); I.low.note(t, root, B * 4, 0.42, { a: 1 }); }
      if (sb % 2 === 1) I.timp.hit(this.bt(t, 3), 33 + 12, 0.35);
      if (sb === 6) this.pad(I.horns, t, B * 2, 'E', { n: 2, lo: 52, hi: 64, vel: 0.5, art: 'swell', a: 2.5 });
      if (sb === 7) { I.snare.roll(this.bt(t, 2), B * 0.5, 0.15, 0.6, { rate: 18 }); I.fx.riser(t, B, 0.3); }
    }
    if (type === 'clash' || type === 'surge') {
      for (let k = 0; k < 8; k++) {
        const acc = k === 0 || k === 3 || k === 6;
        I.spc.note(this.bt(t, k * 0.5), root + 12 + this.ost[k], s * 0.45, acc ? 0.62 : 0.42, { d: 0.13 });
        I.spc.note(this.bt(t, k * 0.5), root + 24 + this.ost[k], s * 0.45, acc ? 0.36 : 0.22, { d: 0.1 });
      }
      for (let k = 0; k < 16; k++) if (k % 4 !== 2) I.pulse.note(t + k * q, root + 12, q * 0.7, k % 4 === 0 ? 0.6 : 0.4, { open: 5 });
      I.tk.hit(t, 0.9); I.tk.hit(this.bt(t, 1.5), 0.7); I.tk.hit(this.bt(t, 3), 0.75);
      for (const [b, v] of [[1, 0.45], [2.5, 0.3], [3, 0.5], [3.75, 0.3]]) I.snare.hit(this.bt(t, b), v);
      if (sb % 2 === 0) I.sub.note(t, root, B * 1.9, 0.5);
      if (sb === 0) I.cym.crash(t, 0.65);
      const v = this.voicing(ch0, 4, 50, 66, 'bst');
      if (type === 'clash') for (const m of v) { I.brass.note(t, m, s * 0.8, 0.68, { art: 'stab' }); if (sb % 2) I.brass.note(this.bt(t, 2.5), m, s * 0.5, 0.55, { art: 'stab' }); }
      // MENACE: half-step brass swell (root → b2 → root) every other bar
      if (type === 'clash' && sb % 4 === 2) { this.line(I.tpt, t, [{ b: 0, d: 1.5, m: 69 }, { b: 1.5, d: 0.5, m: 70 }, { b: 2, d: 2, m: 69 }], { vel: 0.66 }); this.pad(I.horns, t, B * 2, ch0, { n: 3, lo: 50, hi: 64, vel: 0.5, art: 'swell', a: 1.2 }); }
      if (type === 'surge') {
        if (sb % 2 === 0) this.pad(I.str, t, B * 2, ch0, { n: 4, lo: 57, hi: 76, vel: 0.45 + lift * 0.02, a: 0.4 });
        this.line(I.tpt, t, [{ b: 0, d: 1, m: 69 + lift }, { b: 1, d: 1, m: 72 + lift }, { b: 2, d: 1, m: 76 + lift }, { b: 3, d: 1, m: 77 + lift }], { vel: 0.55 + lift * 0.02, legato: 0.8 });
        if (sb === 7) { I.snare.roll(t, B, 0.2, 0.8, { rate: 20 }); I.cym.swell(t, B, 0.55); I.fx.riser(t, B, 0.4); }
      }
      if (type === 'clash' && sb === 7) { I.cym.swell(this.bt(t, 1), B - s, 0.45); I.timp.roll(this.bt(t, 2), 45, B * 0.5 - 0.05, 0.1, 0.7, { hit: false }); }
    }
    if (type === 'breath') {
      if (sb === 0) { I.fx.boom(t, 0.6); this.pad(I.low, t, B * 2, 'E', { n: 2, lo: 28, hi: 40, vel: 0.45, a: 0.2 }); I.trem.note(t, 80, B * 2 - 0.1, 0.25, { art: 'trem', a: 0.4 }); }
      if (sb === 1) I.snare.roll(this.bt(t, 2), B * 0.5, 0.1, 0.55, { rate: 18 });
    }
    if (++this.sb >= len) { this.sb = 0; if (++this.si >= this.form.length) this.plan(); }
    return B;
  }
}
