// 'city' — Solhaven, the golden capital: warm, bustling, lute & strings. G major, 6/8 lilt (eighth = 186, bar ≈ 1.94 s).
// Sections: intro (lute) · A (recorder tune) · B (fiddle, E minor with a B7 turn) · square (tune A on violins, horn
// counter-line, full strings, drums) · market (lute solo over busy tambourine) · evening (harp, flute, soft strings).
// The form reshuffles every cycle (≈2 min per cycle) and the generated sections are new each time.
import { Track } from './track.js';
import { Ens, Strings, Solo, Wind, Lute, Harp, Horn, Mallet, HandDrum } from './instruments.js';
import { mel, Scale, genPhrase } from './theory.js';

// Original tunes (units: eighth notes, 6 per bar).
const TUNE_A = mel('D5:2 B4:1 G4:2 A4:1 | C5:1 B4:1 C5:1 E5:3 | D5:2 B4:1 G4:2 B4:1 | A4:3 F#4:2 D4:1 | E4:1 G4:1 B4:1 E5:2 D5:1 | C5:2 E5:1 G5:2 E5:1 | F#5:2 E5:1 D5:1 C5:1 A4:1 | B4:1 A4:1 F#4:1 G4:3');
const TUNE_A_CH = ['G', 'C', 'G', 'D', 'Em', 'C', 'D7', 'G'];
const TUNE_B = mel('B4:1 C5:1 B4:1 G4:1 A4:1 B4:1 | C5:2 E5:1 A4:3 | A4:1 B4:1 A4:1 F#4:1 G4:1 A4:1 | B4:2 D5:1 G4:3 | E5:1 D5:1 C5:1 G4:1 A4:1 B4:1 | C5:2 A4:1 E5:3 | D#5:1 E5:1 F#5:1 A5:2 F#5:1 | G5:2 E5:1 B4:3');
const TUNE_B_CH = ['Em', 'Am', 'D', 'G', 'C', 'Am', 'B7', 'Em'];
const MARKET_CH = [['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'], ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D']];
const EVE_CH = [['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'D'], ['C', 'G/B', 'Am', 'Em', 'F', 'C', 'Am', 'D']];
const FORMS = [['A', 'B', 'square', 'market', 'B', 'evening', 'A'], ['A', 'market', 'B', 'evening', 'square', 'B'], ['B', 'A', 'evening', 'market', 'square', 'A']];
const NIGHT_FORMS = [['evening', 'A', 'evening', 'B', 'evening', 'A'], ['A', 'evening', 'B', 'evening', 'A', 'evening'], ['evening', 'B', 'A', 'evening', 'B', 'evening']];

export class City extends Track {
  constructor(e, n, t0, seed, dest, night = false) {
    super(e, n, t0, seed, dest);
    this.night = night; this.mixKey = 'city';
    this.tempo(night ? this.rng.range(160, 168) : this.rng.range(180, 190), 6);
    this.I('lute', Lute, { pan: 0.2, rev: 0.28 });
    this.I('lute2', Lute, { pan: -0.3, rev: 0.28, scale: 0.24 });
    this.I('rec', Wind, { kind: 'recorder', pan: -0.12, rev: 0.32 });
    this.I('flute', Wind, { kind: 'flute', pan: -0.05, rev: 0.4 });
    this.I('fid', Solo, { kind: 'fiddle', pan: -0.25, rev: 0.32 });
    this.I('str', Ens, { patch: 'strings', pan: 0.1, rev: 0.4, scale: 0.26, bright: 0.85 });
    this.I('vln', Ens, { patch: 'strings', pan: -0.3, rev: 0.4, scale: 0.28, bright: 1.1 });
    this.I('low', Ens, { patch: 'strings', pan: 0.25, rev: 0.3, scale: 0.3, bright: 0.65 });
    this.I('pizz', Strings, { pan: 0.25, rev: 0.25 });
    this.I('horn', Horn, { pan: 0.3, rev: 0.45 });
    this.I('harp', Harp, { pan: -0.4, rev: 0.45 });
    this.I('glock', Mallet, { kind: 'glock', pan: 0.35, rev: 0.5, scale: 0.18 });
    this.I('drum', HandDrum, { pan: 0.05, rev: 0.18 });
    this.scale = new Scale('G', 'major');
    this.cycle = 0; this.form = night ? NIGHT_FORMS[0].slice() : ['intro', ...FORMS[0]]; this.si = 0; this.sb = 0;
    this.make();
  }
  make() {
    const r = this.rng, type = this.form[this.si];
    const S = { type, bars: type === 'intro' ? 4 : 8, v: r.next() };
    S.ch = type === 'B' ? TUNE_B_CH : type === 'market' ? r.pick(MARKET_CH) : type === 'evening' ? r.pick(EVE_CH) : type === 'intro' ? ['G', 'C', 'G', 'D'] : TUNE_A_CH;
    const chordAt = (b) => S.ch[Math.min(7, Math.floor(b / 6))];
    if (type === 'market') S.mel = genPhrase(r, { scale: this.scale, chordAt, bars: 8, bpb: 6, lo: 62, hi: 81, cells: [[3, 3], [2, 1, 2, 1], [1, 1, 1, 3], [2, 1, 3], [1, 1, 1, 1, 1, 1]], cad: [[6], [3, 3]], rest: 0.04 });
    if (type === 'evening') S.mel = genPhrase(r, { scale: this.scale, chordAt, bars: 8, bpb: 6, lo: 67, hi: 83, cells: [[6], [3, 3], [4, 2]], cad: [[6]], rest: 0.05 });
    if (type === 'A' && this.cycle + this.si > 1) S.orn = true;
    S.lead = type === 'A' ? (this.cycle % 2 || this.night ? 'flute' : 'rec') : 'fid';
    this.S = S;
  }
  strumPat(t, c, vel, kind) {
    const lute = this.inst.lute, s = this.spb;
    const v = this.voicing(c, 4, 55, 71, 'lutev'), bass = this.bassPitch(c, 40, 52, 'luteb');
    if (kind === 0) { // boom . chick | boom . chick
      lute.note(t, bass, s * 2, vel); lute.strum(t + 2 * s, v, vel * 0.7);
      lute.note(t + 3 * s, bass + 7 <= 57 ? bass + 7 : bass - 5, s * 2, vel * 0.85); lute.strum(t + 5 * s, v, vel * 0.6, { dir: -1 });
    } else if (kind === 1) { // rolling arpeggio
      [bass, v[0], v[1], v[2], v[3] ?? v[2] + 12, v[1]].forEach((m, i) => lute.note(t + i * s + this.hum(5), m, s * 3, vel * (i % 3 === 0 ? 1 : 0.75)));
    } else { // full strums on 1 and 4 with a lift on 6
      lute.note(t, bass, s * 3, vel); lute.strum(t + 0.01, v, vel * 0.85);
      lute.strum(t + 3 * s, v, vel * 0.75, { dir: -1 }); lute.strum(t + 5 * s, v.slice(1), vel * 0.5);
    }
  }
  ornament(notes) {
    const out = [];
    for (const n of notes) {
      if (n.d >= 2 && this.rng.chance(0.35)) { const up = this.scale.step(n.m, 1); out.push({ b: n.b, d: 0.5, m: n.m }, { b: n.b + 0.5, d: 0.5, m: up }, { b: n.b + 1, d: n.d - 1, m: n.m }); }
      else out.push(n);
    }
    return out;
  }
  drums(t, lvl, full) {
    const I = this.inst, s = this.spb, sb = this.sb;
    if (this.night) { lvl *= 0.45; full = false; }
    I.drum.hit(t, 0.7 * lvl); I.drum.hit(t + 3 * s, 0.45 * lvl, { open: false });
    if (sb % 2 === 1) I.drum.hit(t + 5 * s, 0.35 * lvl, { open: false });
    if (full) { I.drum.tamb(t + 2 * s, 0.45 * lvl); I.drum.tamb(t + 5 * s, 0.38 * lvl); }
    for (let k = 0; k < 6; k++) I.drum.shake(t + k * s + this.hum(4), (k % 3 === 0 ? 0.4 : 0.25) * lvl);
  }
  playBar(bar, t) {
    const S = this.S, sb = this.sb, I = this.inst, B = this.barDur, s = this.spb, c = S.ch[sb];
    switch (S.type) {
      case 'intro':
        this.strumPat(t, c, 0.5, sb < 2 ? 1 : 0);
        if (sb === 0) I.low.note(t, 43, B * 3.8, 0.3, { a: 1.5, r: 1 });
        if (sb === 3) { I.drum.hit(t + 3 * s, 0.4, { open: false }); I.glock.note(t + 3 * s, 86, 1, 0.3); }
        break;
      case 'A': case 'B': {
        const tune = S.type === 'B' ? TUNE_B : TUNE_A, notes = this.barSlice(tune, sb, 6);
        const lead = I[S.lead];
        this.line(lead, t, S.orn ? this.ornament(notes) : notes, { vel: S.type === 'B' ? 0.6 : 0.55, hum: 5 });
        if (S.type === 'B' && S.v > 0.45) this.line(I.rec, t, notes, { vel: 0.32, tr: -12, hum: 5 });
        this.strumPat(t, c, 0.44, S.type === 'B' ? 2 : (sb % 4 === 3 ? 1 : 0));
        I.pizz.note(t, this.bassPitch(c, 36, 48, 'pz'), s * 2, 0.5, { art: 'pizz' });
        this.pad(I.str, t, B, c, { n: 3, lo: 48, hi: 62, vel: 0.26, a: sb === 0 ? 1 : 0.4, r: 0.8, art: 'pad' }); // follows every chord
        this.drums(t, S.type === 'B' ? 1 : 0.85, S.type === 'B');
        break;
      }
      case 'square': {
        // the grand statement: tune A on violins (octave doubled), horn counter-line, full strings, glock sparkle
        const notes = this.barSlice(TUNE_A, sb, 6);
        this.line(I.vln, t, notes, { vel: 0.58, tr: 12, a: 0.05, r: 0.35, hum: 4 });
        this.line(I.vln, t, notes, { vel: 0.42, a: 0.05, r: 0.35, hum: 4 });
        const cm = this.voicing(c, 1, 55, 64, 'hornTop')[0];
        I.horn.note(t, cm, B * 0.95, 0.5);
        this.pad(I.str, t, B, c, { n: 4, lo: 48, hi: 64, vel: 0.36, a: 0.15, r: 0.5 });
        I.low.note(t, this.bassPitch(c, 31, 43, 'lowb'), B, 0.45, { a: 0.1, r: 0.4 });
        this.strumPat(t, c, 0.46, 2);
        this.drums(t, 1.05, true);
        if (sb === 0 || sb === 4) I.glock.note(t, this.tones(c, 84, 1)[0], 1, 0.35);
        if (sb === 7) I.harp.gliss(t + 2 * s, this.tones(c, 67, 8), s * 3, 0.3);
        break;
      }
      case 'market': {
        this.line(I.lute2, t, this.barSlice(S.mel, sb, 6), { vel: 0.55, hum: 4 });
        this.strumPat(t, c, 0.38, sb % 2);
        I.pizz.note(t, this.bassPitch(c, 36, 48, 'pz'), s * 2, 0.45, { art: 'pizz' });
        I.pizz.note(t + 3 * s, this.bassPitch(c, 36, 48, 'pz') + 7, s * 2, 0.32, { art: 'pizz' });
        for (let k = 0; k < 6; k++) I.drum.tamb(t + k * s + this.hum(3), k % 3 === 0 ? 0.45 : 0.25);
        I.drum.hit(t, 0.5); if (sb % 2) I.drum.clap(t + 3 * s, 0.35);
        break;
      }
      case 'evening': {
        this.line(I.flute, t, this.barSlice(S.mel, sb, 6), { vel: 0.42, hum: 8 });
        this.arp(I.harp, t, 6, c, { pat: [0, 1, 2, 3, 2, 1], step: 1, lo: 50, vel: 0.26, len: 4 });
        this.pad(I.str, t, B, c, { n: 3, lo: 50, hi: 64, vel: 0.26, a: sb === 0 ? 1 : 0.5, r: 1.1, art: 'pad' }); I.low.note(t, this.bassPitch(c, 36, 48, 'lowb'), B, 0.3, { a: 0.5, r: 0.8 });
        if (sb === 7) I.glock.note(t + 3 * s, 86, 1, 0.25);
        break;
      }
    }
    if (++this.sb >= S.bars) {
      this.sb = 0;
      if (++this.si >= this.form.length) { this.cycle++; this.form = this.rng.pick(this.night ? NIGHT_FORMS : FORMS).slice(); this.si = 0; }
      this.make();
    }
    return B;
  }
}
