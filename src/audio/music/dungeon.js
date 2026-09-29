// 'dungeon' — Chaos Rift: pulsing, dark synth-orchestral. E Phrygian (the F natural), 4/4 at 120 BPM (2 s bars).
// Sections (8 bars): pulse (16th synth bass + sub, dark pad, small taiko, sparse arp) · build (+ spiccato, mid taiko,
// choir swell, riser) · drop (taiko 3-3-2, brass stabs, choir chant, full arp, crash) · break (dark pad, "oo" choir,
// booms, anvil pings, filtered bass). New progressions / bass cells every cycle.
import { Track } from './track.js';
import { Ens, Strings, Synth, Taiko, Cymbal, Fx, Timpani } from './instruments.js';
import { chord } from './theory.js';

const PROGS = [
  ['Em', 'Em', 'F', 'F', 'Em', 'Em', 'D', 'D'],
  ['Em', 'Em', 'C', 'C', 'Am', 'Am', 'B', 'B'],
  ['Em', 'F', 'G', 'F', 'Em', 'F', 'Dm', 'Em'],
  ['Am', 'Am', 'F', 'F', 'Em', 'Em', 'F', 'B'],
];
const BASS = [
  [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 12, 0, 12],
  [0, 0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 7, 12, 7],
  [0, 12, 0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 10, 12],
];
const ARP = [[0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 2, 4, 3, 1], [3, 2, 1, 0, 1, 2, 3, 4]];

export class Dungeon extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(120, 4);
    this.I('bass', Synth, { kind: 'bass', pan: 0, rev: 0.12 });
    this.I('sub', Synth, { kind: 'sub', rev: 0 });
    this.I('arp', Synth, { kind: 'pluck', pan: -0.25, rev: 0.4 });
    this.I('dpad', Ens, { patch: 'darkpad', pan: 0.1, rev: 0.5, scale: 0.26 });
    this.I('choir', Ens, { patch: 'choir_ah', rev: 0.55, scale: 0.26, bright: 0.85 });
    this.I('oo', Ens, { patch: 'choir_oo', rev: 0.65, scale: 0.26 });
    this.I('brass', Ens, { patch: 'brass', pan: 0.2, rev: 0.4, scale: 0.22 });
    this.I('low', Ens, { patch: 'strings', pan: 0.25, rev: 0.35, scale: 0.3, bright: 0.6 });
    this.I('spc', Strings, { pan: -0.2, rev: 0.25, bright: 0.9 });
    this.I('tk', Taiko, { size: 'big', rev: 0.35 });
    this.I('tkm', Taiko, { size: 'mid', pan: 0.25, rev: 0.3 });
    this.I('tks', Taiko, { size: 'small', pan: -0.25, rev: 0.3 });
    this.I('timp', Timpani, { rev: 0.4 });
    this.I('cym', Cymbal, { rev: 0.45 });
    this.I('fx', Fx, { rev: 0.45 });
    this.cycle = 0; this.plan();
  }
  plan() {
    const r = this.rng;
    this.form = this.cycle === 0 ? ['pulse', 'build', 'drop', 'break', 'build', 'drop'] : r.pick([['pulse', 'drop', 'break', 'build', 'drop'], ['break', 'build', 'drop', 'pulse', 'drop'], ['build', 'drop', 'break', 'drop']]);
    this.prog = r.pick(PROGS); this.bpat = r.pick(BASS); this.apat = r.pick(ARP);
    this.si = 0; this.sb = 0; this.cycle++;
  }
  playBar(bar, t) {
    const I = this.inst, B = this.barDur, s = this.spb;
    const type = this.form[this.si], sb = this.sb, ch = this.prog[sb], c = chord(ch);
    const root = 28 + ((c.root - 4 + 12) % 12); // E1..D#2
    const q = s / 4; // 16th
    const lvl = { pulse: 0.8, build: 0.9, drop: 1, break: 0.55 }[type];
    // synth bass 16ths (break: every other 16th, darker)
    for (let k = 0; k < 16; k++) {
      if (type === 'break' && k % 2) continue;
      const acc = k % 8 === 0 || k % 8 === 3 || k % 8 === 6;
      I.bass.note(t + k * q + this.hum(2), root + 12 + this.bpat[k], q * 0.8, (acc ? 0.72 : 0.5) * lvl, { open: type === 'break' ? 3 : type === 'drop' ? 9 : 6 });
    }
    if (sb % 2 === 0) I.sub.note(t, root, B * 1.9, 0.6 * lvl);
    if (sb % 2 === 0 && type !== 'drop') this.pad(I.dpad, t, B * 2, ch, { n: 3, lo: 52, hi: 67, vel: 0.36, a: 0.6, r: 1, art: 'pad', key: 'dp' });
    // arp (not in pulse's first half)
    if (!(type === 'pulse' && sb < 4) && type !== 'break') {
      const tn = this.tones(ch, 64, 5);
      for (let k = 0; k < 16; k++) I.arp.note(t + k * q, tn[this.apat[k % 8]] + (k >= 8 && type === 'drop' ? 12 : 0), q * 0.9, (k % 4 === 0 ? 0.55 : 0.36) * lvl);
    }
    switch (type) {
      case 'pulse':
        I.tks.hit(t, 0.5); I.tks.hit(this.bt(t, 1.5), 0.35); I.tks.hit(this.bt(t, 3), 0.4);
        if (sb === 7) I.fx.riser(this.bt(t, 0), B, 0.35);
        break;
      case 'build': {
        for (let k = 0; k < 8; k++) I.spc.note(this.bt(t, k * 0.5), root + 24 + (k % 4 === 3 ? 1 : 0), s * 0.45, k % 2 ? 0.4 : 0.55, { d: 0.12 });
        I.tkm.hit(t, 0.55); I.tkm.hit(this.bt(t, 2), 0.5); for (let k = 0; k < 4; k++) I.tks.hit(this.bt(t, k + 0.5), 0.28 + sb * 0.03);
        if (sb === 0) this.pad(I.choir, t, B * 7.5, ch, { n: 4, lo: 55, hi: 70, vel: 0.5, art: 'swell', a: 3, key: 'ch' });
        if (sb === 0) I.low.note(t, root + 12, B * 7.5, 0.5, { art: 'swell', a: 4 });
        if (sb >= 6) for (let k = 0; k < 8; k++) I.tks.hit(this.bt(t, k * 0.5 + 0.25), 0.2 + k * 0.03);
        if (sb === 7) { I.cym.swell(this.bt(t, 0), B, 0.55); I.fx.riser(this.bt(t, 0), B, 0.4); I.timp.roll(this.bt(t, 2), 40, B * 0.5 - 0.05, 0.1, 0.8, { hit: false }); }
        break;
      }
      case 'drop': {
        for (const k of [0, 3, 6]) I.tk.hit(this.bt(t, k * 0.5), k === 0 ? 0.95 : 0.75);
        I.tkm.hit(this.bt(t, 1), 0.5); I.tkm.hit(this.bt(t, 3), 0.55, { rim: sb % 2 === 1 });
        for (let k = 0; k < 16; k++) I.tks.hit(t + k * q, k % 4 === 0 ? 0.42 : 0.2);
        if (sb === 0) { I.cym.crash(t, 0.8); I.fx.boom(t, 0.7); }
        if (sb === 4) I.cym.crash(t, 0.55);
        const v = this.voicing(ch, 4, 50, 67, 'bst');
        for (const m of v) { I.brass.note(t, m, s * 0.9, 0.78, { art: 'stab' }); if (sb % 2 === 1) I.brass.note(this.bt(t, 2.5), m, s * 0.5, 0.62, { art: 'stab' }); }
        // choir chant: staccato 3-3-2 on chord tones
        const cv = this.voicing(ch, 3, 57, 72, 'chant');
        for (const sl of [0, 3, 6]) for (const m of cv) I.choir.note(this.bt(t, sl * 0.5), m, s * 0.4, sl === 0 ? 0.6 : 0.46, { art: 'stacc' });
        if (sb % 2 === 0) I.dpad.note(t, root + 24, B * 2, 0.4, { art: 'pad' });
        if (sb === 7) { I.cym.swell(this.bt(t, 1), B - s, 0.5); for (let k = 0; k < 8; k++) I.tkm.hit(this.bt(t, 2 + k * 0.25), 0.3 + k * 0.07); }
        break;
      }
      case 'break': {
        if (sb === 0 || sb === 4) I.fx.boom(t, 0.55);
        if (sb % 4 === 0) this.pad(I.oo, t, B * 4, ch, { n: 3, lo: 55, hi: 70, vel: 0.4, a: 1.5, r: 1.5, art: 'pad', key: 'oo' });
        if (sb % 2 === 1) I.fx.anvil(this.bt(t, 2.5), 0.35);
        if (sb === 7) { I.fx.riser(t, B, 0.35); I.cym.swell(t, B, 0.4); }
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
