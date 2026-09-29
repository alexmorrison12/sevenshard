// 'stronghold' — Brightwater Isle, home: calm, warm, unhurried. Eb major, 3/4 at ~72 BPM (bar ≈ 2.5 s).
// HEARTH: a 16-bar tune passed between flute (with fingerpicked guitar), clarinet (with strings and a soft horn
// pad) and the violins. window: a quiet interlude (celesta, warm pad, a generated oboe line). ≈2 min per cycle.
import { Track } from './track.js';
import { Ens, Wind, Harp, Lute, Horn, Mallet, Strings } from './instruments.js';
import { mel, Scale, genPhrase } from './theory.js';

const HEARTH = mel('G4:2 Bb4:1 | C5:1.5 Bb4:.5 Ab4:1 | G4:1 Bb4:1 Eb5:1 | D5:3 | Eb5:2 D5:.5 C5:.5 | C5:1 Ab4:1 F4:1 | F4:1 G4:1 Ab4:1 | G4:3 | Bb4:2 Eb5:1 | D5:1.5 C5:.5 Bb4:1 | C5:1 Eb5:1 Ab5:1 | G5:3 | F5:1 Eb5:1 C5:1 | Eb5:1.5 C5:.5 Ab4:1 | Bb4:1 C5:1 D5:1 | Eb5:3');
const HEARTH_CH = ['Eb', 'Ab', 'Eb/G', 'Bb', 'Cm', 'Ab', 'Bb', 'Eb', 'Eb', 'Gm', 'Ab', 'Eb/Bb', 'Fm7', 'Ab', 'Bb', 'Eb'];
const WIN_CH = [['Ab', 'Eb', 'Fm', 'Bb', 'Ab', 'Eb/G', 'Fm7', 'Bb'], ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Fm', 'Bb']];

export class Stronghold extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(this.rng.range(70, 74), 3);
    this.I('flute', Wind, { kind: 'flute', pan: -0.1, rev: 0.45 });
    this.I('clar', Wind, { kind: 'clarinet', pan: 0.1, rev: 0.45 });
    this.I('oboe', Wind, { kind: 'oboe', pan: 0.12, rev: 0.5 });
    this.I('vln', Ens, { patch: 'strings', pan: -0.3, rev: 0.5, scale: 0.28, bright: 0.95 });
    this.I('str', Ens, { patch: 'strings', pan: 0.1, rev: 0.45, scale: 0.24, bright: 0.8 });
    this.I('low', Ens, { patch: 'strings', pan: 0.25, rev: 0.35, scale: 0.28, bright: 0.6 });
    this.I('pad', Ens, { patch: 'pad', rev: 0.55, scale: 0.22 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.5, scale: 0.2, bright: 0.8 });
    this.I('gtr', Lute, { kind: 'guitar', pan: 0.25, rev: 0.3, scale: 0.26 });
    this.I('harp', Harp, { pan: -0.4, rev: 0.5 });
    this.I('cel', Mallet, { kind: 'celesta', pan: 0.35, rev: 0.6, scale: 0.24 });
    this.I('pizz', Strings, { pan: 0.2, rev: 0.3 });
    this.scale = new Scale('Eb', 'major');
    this.cycle = 0; this.plan();
  }
  plan() {
    const r = this.rng;
    this.form = this.cycle === 0 ? ['A1', 'window', 'A2', 'A3', 'window'] : r.pick([['A2', 'window', 'A1', 'A3'], ['A3', 'window', 'A2', 'window', 'A1'], ['window', 'A1', 'A3', 'A2']]);
    this.si = 0; this.sb = 0; this.cycle++; this.make();
  }
  make() {
    const r = this.rng, type = this.form[this.si];
    const S = { type, bars: type === 'window' ? 8 : 16 };
    S.ch = type === 'window' ? r.pick(WIN_CH) : HEARTH_CH;
    if (type === 'window') S.mel = genPhrase(r, { scale: this.scale, chordAt: (b) => S.ch[Math.min(7, Math.floor(b / 3))], bars: 8, bpb: 3, lo: 67, hi: 82, cells: [[3], [2, 1], [1, 2]], cad: [[3]], rest: 0.15 });
    this.S = S;
  }
  // fingerpicking in 3/4: bass on 1, chord tones on 2 and 3 (+ an off-beat lift every other bar)
  pick(t, c, vel) {
    const I = this.inst, s = this.spb, bm = this.bassPitch(c, 39, 51, 'gb'), v = this.voicing(c, 3, 58, 70, 'gv');
    I.gtr.note(t, bm, s * 2, vel); I.gtr.note(this.bt(t, 1), v[0], s, vel * 0.7); I.gtr.note(this.bt(t, 1.5), v[1], s, vel * 0.6); I.gtr.note(this.bt(t, 2), v[2], s, vel * 0.65);
    if (this.sb % 2) I.gtr.note(this.bt(t, 2.5), v[1], s, vel * 0.5);
  }
  playBar(bar, t) {
    const S = this.S, sb = this.sb, I = this.inst, B = this.barDur, s = this.spb, c = S.ch[sb];
    switch (S.type) {
      case 'A1': {
        this.line(I.flute, t, this.barSlice(HEARTH, sb, 3), { vel: 0.52 });
        this.pick(t, c, 0.44);
        if (sb % 4 === 0) this.pad(I.pad, t, B * 4, c, { n: 3, lo: 51, hi: 63, vel: 0.26, a: 1.5, r: 1.5, art: 'pad' });
        if (sb === 15) I.harp.gliss(this.bt(t, 1), this.tones(c, 63, 8), s * 1.5, 0.28);
        break;
      }
      case 'A2': {
        this.line(I.clar, t, this.barSlice(HEARTH, sb, 3), { vel: 0.55, tr: -12 });
        this.arp(I.harp, t, 3, c, { pat: [0, 1, 2, 3, 2, 1], lo: 51, vel: 0.26 });
        if (sb % 2 === 0) { this.pad(I.str, t, B * 2, c, { n: 3, lo: 55, hi: 67, vel: 0.26, a: 0.8, r: 1 }); this.pad(I.horns, t + 0.05, B * 2, c, { n: 2, lo: 51, hi: 60, vel: 0.26, a: 1, key: 'horns' }); }
        I.pizz.note(t, this.bassPitch(c, 39, 51, 'pz'), s, 0.4, { art: 'pizz' });
        break;
      }
      case 'A3': {
        this.line(I.vln, t, this.barSlice(HEARTH, sb, 3), { vel: 0.5, tr: 12, a: 0.25, r: 0.7 });
        if (sb >= 8) this.line(I.flute, t, this.barSlice(HEARTH, sb, 3), { vel: 0.3 });
        this.pick(t, c, 0.36);
        this.pad(I.str, t, B, c, { n: 3, lo: 51, hi: 67, vel: 0.3, a: 0.6, r: 0.8 });
        I.low.note(t, this.bassPitch(c, 31, 43, 'lb'), B, 0.34, { a: 0.4, r: 0.6 });
        if (sb === 7 || sb === 15) I.cel.note(this.bt(t, 1), this.tones(c, 82, 1)[0], 1, 0.3);
        break;
      }
      case 'window': {
        this.line(I.oboe, t, this.barSlice(S.mel, sb, 3), { vel: 0.4, hum: 8 });
        if (sb % 2 === 0) { this.pad(I.pad, t, B * 2, c, { n: 3, lo: 53, hi: 67, vel: 0.3, a: 1.2, r: 1.8, art: 'pad' }); I.low.note(t, this.bassPitch(c, 31, 43, 'lb'), B * 2, 0.28, { a: 1, r: 1.5 }); }
        if (this.rng.chance(0.55)) { const tn = this.tones(c, 75, 5); I.cel.note(this.bt(t, this.rng.pick([0.5, 1, 1.5, 2])), this.rng.pick(tn), 1, 0.28); }
        if (this.rng.chance(0.5)) this.arp(I.harp, t, 3, c, { pat: [0, 2, 4], step: 1, lo: 51, vel: 0.2, len: 3 });
        break;
      }
    }
    if (++this.sb >= S.bars) { this.sb = 0; if (++this.si >= this.form.length) this.plan(); else this.make(); }
    return B;
  }
}
