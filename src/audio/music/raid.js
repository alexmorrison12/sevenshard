// 'raid' / 'raid_ghost' — Legion Raid: Gorrath, the Horned Tyrant. Epic, choir, relentless. F minor, 4/4 at 150 BPM.
// TYRANT motif: a brutal chromatic descent in low brass (F-E-Db-C…). The heroes answer with the main theme's call.
// Sections: onslaught (3-3-2 low strings, taiko, stabs, tyrant motif in trombones) · chant (staccato choir, 16th
// violins) · titan (tyrant motif in full brass + choir) · heroes (HERO call on horns, strings soar) · bridge.
// music('raid_ghost') while the raid plays = the ghost phase: on the next bar a transition fill (timpani roll,
// cymbal swell, brass rip) lifts everything a semitone and +6 BPM and adds the second intensity layer: ghostly
// "oo" choir clusters, high tremolo strings, 16th small taiko, sub pulses. music('raid') returns to phase 1.
import { Track } from './track.js';
import { Ens, Strings, Horn, Taiko, Timpani, Cymbal, Fx, Synth } from './instruments.js';
import { mel, chord, transpose } from './theory.js';
import { HERO } from './motifs.js';

const TYRANT = mel('F3:1.5! F3:.5 E3:1 Db3:1 | C3:2 r:1 C3:.5 Db3:.5 | F3:1.5! F3:.5 Ab3:1 G3:1 | F3:2 Eb3:1 Db3:1 | Bb2:1.5! Db3:.5 F3:1 Bb3:1 | C4:2 B3:1 Bb3:1 | Ab3:1 F3:1 E3:1 G3:1 | F3:4!');
const TYRANT_CH = ['Fm', 'C', 'Fm', 'Db', 'Bbm', 'C', ['Db', 'C'], 'Fm'];
const ONS_CH = [['Fm', 'Fm', 'Db', 'Eb', 'Fm', 'Fm', 'Bbm', 'C'], ['Fm', 'Db', 'Bbm', 'C', 'Fm', 'Ab', 'Bbm', 'C']];
const CHANT_CH = [['Db', 'Eb', 'Fm', 'Fm', 'Bbm', 'Db', 'C', 'C'], ['Bbm', 'C', 'Fm', 'Db', 'Bbm', 'Eb', 'C', 'C']];
const HERO_RAID_CH = ['Fm', 'Db', 'Ab', 'Eb', 'Bbm', 'Db', ['Bbm', 'C'], 'Fm']; // HERO_CH moved to F minor
const tc = transpose;

export class Raid extends Track {
  constructor(e, n, t0, seed, phase = 1) {
    super(e, n, t0, seed);
    this.mixKey = 'raid';
    this.I('low', Strings, { pan: 0.2, rev: 0.25, bright: 1, body: 200, hp: 40 });
    this.I('hi', Strings, { pan: -0.35, rev: 0.35, bright: 1.1 });
    this.I('trem', Strings, { pan: 0.35, rev: 0.5, bright: 1, scale: 0.05 });
    this.I('str', Ens, { patch: 'strings', pan: -0.1, rev: 0.4, scale: 0.28 });
    this.I('bass', Ens, { patch: 'strings', pan: 0.2, rev: 0.3, scale: 0.32, bright: 0.6 });
    this.I('brass', Ens, { patch: 'brass', pan: 0.15, rev: 0.4, scale: 0.26 });
    this.I('tbn', Horn, { kind: 'trombone', pan: 0.25, rev: 0.4 });
    this.I('tuba', Horn, { kind: 'tuba', pan: 0.1, rev: 0.35 });
    this.I('horn', Horn, { pan: 0.3, rev: 0.5 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.45, scale: 0.26 });
    this.I('choir', Ens, { patch: 'choir_ah', rev: 0.5, scale: 0.28 });
    this.I('ghost', Ens, { patch: 'choir_oo', rev: 0.8, scale: 0.26, bright: 0.9 });
    this.I('taiko', Taiko, { size: 'big', rev: 0.35 });
    this.I('mid', Taiko, { size: 'mid', pan: 0.25, rev: 0.3 });
    this.I('small', Taiko, { size: 'small', pan: -0.25, rev: 0.3 });
    this.I('timp', Timpani, { rev: 0.4 });
    this.I('cym', Cymbal, { rev: 0.45 });
    this.I('fx', Fx, { rev: 0.45 });
    this.I('sub', Synth, { kind: 'sub' });
    this.ach = ONS_CH[0]; this.cch = CHANT_CH[0];
    this.setup(phase, true);
  }
  setup(phase, first = false) {
    this.phase = phase; this.sh = phase === 2 ? 1 : 0;
    this.tempo(phase === 2 ? 156 : 150, 4);
    this.form = first ? ['onslaught', 'chant', 'titan', 'heroes', 'bridge', 'onslaught', 'titan'] : phase === 2 ? ['titan', 'chant', 'onslaught', 'heroes', 'titan', 'bridge'] : ['onslaught', 'heroes', 'chant', 'titan', 'bridge'];
    this.ach = this.rng.pick(ONS_CH); this.cch = this.rng.pick(CHANT_CH);
    this.si = 0; this.sb = 0; this.nextPhase = 0;
  }
  setPhase(name) { const p = name === 'raid_ghost' ? 2 : 1; if (p !== this.phase || this.nextPhase) this.nextPhase = p; }
  chs(type) { return type === 'titan' ? TYRANT_CH : type === 'chant' ? this.cch : type === 'heroes' ? HERO_RAID_CH : type === 'bridge' ? ['Fm', 'Db', 'Bbm', 'C'] : this.ach; }
  playBar(bar, t) {
    const I = this.inst, s = this.spb, B = this.barDur;
    if (this.nextPhase) { const p = this.nextPhase; this.transition(t, p); this.setup(p); return B; }
    const type = this.form[this.si], sb = this.sb, len = type === 'bridge' ? 4 : 8;
    const raw = this.chs(type)[sb % 8], list = (Array.isArray(raw) ? raw : [raw]).map((c) => tc(c, this.sh));
    const G = this.phase === 2, sh = this.sh;
    const each = (fn) => list.forEach((c, i) => fn(c, t + i * (B / list.length), B / list.length));
    const c0 = chord(list[0]), tp = 36 + ((c0.bass - 0 + 12) % 12) + (c0.bass < 5 ? 12 : 0);
    // --- drums: relentless ---
    const big = type === 'bridge' ? [0] : type === 'titan' || G ? [0, 2, 3, 4, 6] : [0, 3, 6];
    for (const k of big) I.taiko.hit(this.bt(t, k * 0.5), k === 0 ? 0.95 : k === 3 || k === 6 ? 0.78 : 0.6);
    if (type !== 'bridge') { I.mid.hit(this.bt(t, 1), 0.5); I.mid.hit(this.bt(t, 3), 0.55, { rim: sb % 2 === 1 }); }
    if (G || type === 'chant') for (let k = 0; k < (G ? 16 : 8); k++) I.small.hit(this.bt(t, k * (G ? 0.25 : 0.5)), G ? (k % 4 === 0 ? 0.45 : 0.2) : (k % 2 ? 0.22 : 0.32));
    if (type !== 'bridge' || sb === 0) I.timp.hit(t, tp, sb % 4 === 0 ? 0.85 : 0.6);
    if (sb === 0 && type !== 'bridge') I.cym.crash(t, 0.75);
    if (sb === len - 1) { I.cym.swell(this.bt(t, 1), B - s, 0.55); if (type !== 'bridge') for (let k = 0; k < 4; k++) I.small.hit(this.bt(t, 3 + k * 0.25), 0.3 + k * 0.1); }
    if (G && sb % 2 === 0) I.sub.note(t, 29 + sh, B * 1.9, 0.5);
    // --- low strings 8ths (16ths in the ghost phase) with 3-3-2 accents ---
    if (type !== 'bridge') {
      const step = G ? 0.25 : 0.5;
      each((c, tt, d) => {
        const cc = chord(c), rt = 36 + ((cc.bass + 12) % 12) + (cc.bass < 3 ? 12 : 0);
        for (let k = 0; k < Math.round(d / (step * s)); k++) {
          const slot = Math.round(k * step * 2) % 8, acc = slot === 0 || slot === 3 || slot === 6;
          I.low.note(tt + k * step * s, rt + (G && k % 2 ? 12 : 0), s * step * 0.8, acc ? 0.62 : 0.4, { d: 0.12 });
        }
      });
    }
    // --- per section ---
    if (type === 'onslaught' || type === 'chant') {
      each((c, tt) => { for (const m of this.voicing(c, 4, 48, 65, 'bst')) I.brass.note(tt, m, s * 0.9, G ? 0.8 : 0.72, { art: 'stab' }); });
      if (sb % 2 === 1 || G) { const nx = tc([].concat(this.chs(type)[(sb + 1) % 8])[0], sh); for (const m of this.voicing(nx, 3, 48, 63, 'bst2')) I.brass.note(this.bt(t, 3.5), m, s * 0.5, 0.6, { art: 'stab' }); }
    }
    if (type === 'onslaught') {
      // the tyrant motif growls underneath in trombones + tuba
      const notes = this.barSlice(TYRANT, sb, 4);
      this.line(I.tbn, t, notes, { vel: 0.62, tr: sh }); this.line(I.tuba, t, notes, { vel: 0.5, tr: sh - 12 });
    }
    if (type === 'chant') {
      each((c, tt, d) => {
        const tn = this.tones(c, G ? 74 : 67, 4), pat = G ? [3, 0, 3, 1, 3, 2, 3, 1] : [2, 0, 1, 0, 3, 0, 1, 0];
        for (let k = 0; k < Math.round(d / (0.25 * s)); k++) I.hi.note(tt + k * 0.25 * s, tn[pat[k % 8]], s * 0.22, k % 4 === 0 ? 0.5 : 0.36, { d: 0.09 });
        const v = this.voicing(c, 3, 55, 70, 'chant');
        for (const sl of G ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 2, 3, 5, 6]) if (sl * 0.5 * s < d - 0.01) for (const m of v) I.choir.note(tt + sl * 0.5 * s, m, s * 0.4, sl % 3 === 0 ? 0.62 : 0.45, { art: 'stacc' });
      });
    }
    if (type === 'titan') {
      const notes = this.barSlice(TYRANT, sb, 4);
      this.line(I.tbn, t, notes, { vel: 0.8, tr: sh }); this.line(I.tuba, t, notes, { vel: 0.6, tr: sh - 12 }); this.line(I.horn, t, notes, { vel: 0.7, tr: sh + 12 });
      each((c, tt, d) => {
        this.pad(I.choir, tt, d, c, { n: 5, lo: 50, hi: 70, vel: 0.58, a: 0.15, key: 'choir' });
        I.bass.note(tt, this.bassPitch(c, 24, 36, 'bb'), d, 0.55, { a: 0.05 });
        for (const m of this.voicing(c, 4, 46, 62, 'bst')) I.brass.note(tt, m, Math.min(d, s * 1.6), 0.7, { art: 'marc' });
      });
    }
    if (type === 'heroes') {
      // the heroes answer: the main theme's call on horns (moved to F minor), strings soar above
      const notes = this.barSlice(HERO, sb, 4);
      this.line(I.horn, t, notes, { vel: 0.78, tr: 3 + sh }); this.line(I.str, t, notes, { vel: 0.5, tr: 15 + sh, a: 0.05, r: 0.3 });
      each((c, tt, d) => { this.pad(I.horns, tt, d, c, { n: 3, lo: 48, hi: 62, vel: 0.44, a: 0.1, key: 'horns' }); I.bass.note(tt, this.bassPitch(c, 26, 38, 'bb'), d, 0.5, { a: 0.05 }); });
    }
    if (type === 'bridge') {
      if (sb === 0) { this.pad(I.choir, t, B * 4, list[0], { n: 4, lo: 53, hi: 72, vel: 0.55, a: 2.5, art: 'swell', key: 'choir' }); I.fx.boom(t, 0.6); }
      each((c, tt, d) => I.bass.note(tt, this.bassPitch(c, 29, 41, 'bb'), d, 0.45, { a: 0.4 }));
      if (sb === 3) { I.timp.roll(t, 41 + sh, B - 0.05, 0.1, 0.9, { hit: false }); I.fx.riser(t, B, 0.4); }
    }
    // --- ghost-phase layer on top of every section ---
    if (G) {
      if (sb % 4 === 0) {
        const v = this.voicing(list[0], 4, 72, 86, 'ghostv'); // high "oo" cluster incl. added 9th
        for (const m of v) I.ghost.note(t, m, B * 4, 0.42, { art: 'swell', a: 2 });
        I.ghost.note(t, v[0] + 2, B * 4, 0.3, { art: 'swell', a: 2.5 });
        I.trem.note(t, 84 + sh, B * 4 - 0.1, 0.28, { art: 'trem', a: 1 }); I.trem.note(t, 85 + sh, B * 4 - 0.1, 0.2, { art: 'trem', a: 1.5 });
      }
      if (sb % 4 === 3) I.cym.swell(this.bt(t, 2), B * 0.5, 0.45);
    }
    if (++this.sb >= len) { this.sb = 0; if (++this.si >= this.form.length) { this.si = 0; this.ach = this.rng.pick(ONS_CH); this.cch = this.rng.pick(CHANT_CH); } }
    return B;
  }
  transition(t, to) {
    const I = this.inst, s = this.spb, B = this.barDur, sh = to === 2 ? 1 : 0;
    I.timp.roll(t, 41 + sh, B - 0.05, 0.15, 1, { hit: false });
    I.cym.swell(t, B - 0.02, 0.75); I.fx.riser(t, B, 0.5);
    for (let k = 0; k < 16; k++) I.small.hit(this.bt(t, k * 0.25), 0.2 + k * 0.035);
    I.taiko.hit(t, 0.9); I.taiko.hit(this.bt(t, 3), 0.8);
    for (let k = 0; k < 8; k++) I.brass.note(this.bt(t, 2 + k * 0.25), 53 + sh + k * 2, s * 0.24, 0.45 + k * 0.05, { art: 'stab' });
    this.pad(I.choir, t, B, tc('C', sh), { n: 4, lo: 55, hi: 74, vel: 0.55, a: 1.5, art: 'swell', key: 'choir' });
    for (let k = 0; k < 8; k++) I.low.note(this.bt(t, k * 0.5), 48 + sh - 12, s * 0.4, 0.5 + k * 0.04, { d: 0.12 });
  }
}
