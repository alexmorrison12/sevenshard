// 'pip' — Pipsprout Hollow: whimsical, bouncy, tiny. F major, 4/4 at ~120 BPM (bar ≈ 2 s).
// A: clarinet tune with chromatic neighbour notes over a staccato bassoon oom-pah and pizzicato chords.
// B: the bassoon gets the (comic, low) tune, flute trills and woodblock answer. A': flute + xylophone.
// garden: a dreamy interlude (harp, celesta, soft strings, generated flute line). Sections reshuffle per cycle.
import { Track } from './track.js';
import { Ens, Strings, Wind, Harp, Mallet, HandDrum } from './instruments.js';
import { mel, Scale, genPhrase } from './theory.js';

const PIP_A = mel('C5:.5 A4:.5 F4:.5 A4:.5 C5:.5 r:.5 F5:1 | E5:.5 F5:.5 E5:.5 D5:.5 C5:1 Bb4:1 | A4:.5 Bb4:.5 A4:.5 G#4:.5 A4:1 C5:1 | B4:.5 C5:.5 D5:.5 F5:.5 E5:1 D5:1 | D5:.5 F5:.5 A5:.5 F5:.5 D5:1 A4:1 | Bb4:.5 D5:.5 F5:.5 D5:.5 Bb4:1 F4:1 | G4:.5 A4:.5 Bb4:.5 C5:.5 D5:.5 E5:.5 F5:.5 G5:.5 | F5:1 C5:.5 A4:.5 F4:2');
const PIP_A_CH = ['F', 'C7', 'F', 'G7', 'Dm', 'Bb', 'C7', 'F'];
const PIP_B = mel('F3:1 Bb3:1 D4:1 Bb3:1 | C4:1 A3:1 F3:2 | G3:.5 A3:.5 Bb3:.5 C4:.5 D4:1 G3:1 | E3:1 G3:1 C4:2 | A3:1 C4:1 F4:1 E4:.5 D4:.5 | D4:1 F4:1 Bb4:2 | G4:.5 F4:.5 E4:.5 D4:.5 C4:1 E4:1 | F4:2 r:2');
const PIP_B_CH = ['Bb', 'F', 'Gm', 'C7', 'F', 'Bb', 'C7', 'F'];
const GARDEN_CH = [['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C'], ['Bb', 'F', 'Gm', 'C', 'Am', 'Dm', 'Gm', 'C']];

export class Pip extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(this.rng.range(116, 124), 4);
    this.I('clar', Wind, { kind: 'clarinet', pan: -0.1, rev: 0.35 });
    this.I('flute', Wind, { kind: 'flute', pan: -0.25, rev: 0.4 });
    this.I('picc', Wind, { kind: 'piccolo', pan: 0.3, rev: 0.45 });
    this.I('bsn', Wind, { kind: 'bassoon', pan: 0.15, rev: 0.3 });
    this.I('pizz', Strings, { pan: 0.25, rev: 0.3 });
    this.I('str', Ens, { patch: 'strings', pan: 0.1, rev: 0.45, scale: 0.22, bright: 0.8 });
    this.I('xylo', Mallet, { kind: 'xylo', pan: 0.3, rev: 0.35, scale: 0.24 });
    this.I('glock', Mallet, { kind: 'glock', pan: -0.3, rev: 0.45, scale: 0.16 });
    this.I('mar', Mallet, { kind: 'marimba', pan: 0.2, rev: 0.35, scale: 0.3 });
    this.I('cel', Mallet, { kind: 'celesta', pan: 0.35, rev: 0.55, scale: 0.24 });
    this.I('harp', Harp, { pan: -0.4, rev: 0.45 });
    this.I('perc', HandDrum, { pan: 0.1, rev: 0.2 });
    this.scale = new Scale('F', 'major');
    this.cycle = 0; this.plan();
  }
  plan() {
    const r = this.rng;
    this.form = this.cycle === 0 ? ['intro', 'A', 'B', 'A2', 'garden', 'A', 'B'] : r.pick([['A2', 'B', 'garden', 'A', 'B'], ['B', 'A', 'garden', 'A2', 'B'], ['A', 'garden', 'B', 'A2']]);
    this.si = 0; this.sb = 0; this.cycle++;
    this.make();
  }
  make() {
    const r = this.rng, type = this.form[this.si];
    const S = { type, bars: type === 'intro' ? 2 : 8 };
    S.ch = type === 'B' ? PIP_B_CH : type === 'garden' ? r.pick(GARDEN_CH) : type === 'intro' ? ['F', 'C7'] : PIP_A_CH;
    if (type === 'garden') S.mel = genPhrase(r, { scale: this.scale, chordAt: (b) => S.ch[Math.min(7, Math.floor(b / 4))], bars: 8, bpb: 4, lo: 72, hi: 88, cells: [[2, 2], [3, 1], [4], [1, 1, 2]], cad: [[4]], rest: 0.12 });
    this.S = S;
  }
  // oom-pah: staccato bassoon bass on 1 & 3, pizzicato chord on 2 & 4
  oompah(t, c, lvl = 1) {
    const I = this.inst, s = this.spb;
    const bm = this.bassPitch(c, 41, 53, 'bb'), v = this.voicing(c, 3, 57, 69, 'pz');
    I.bsn.note(t, bm, s * 0.4, 0.55 * lvl); I.bsn.note(this.bt(t, 2), bm + (bm + 7 <= 55 ? 7 : -5), s * 0.4, 0.48 * lvl);
    for (const b of [1, 3]) for (const m of v) I.pizz.note(this.bt(t, b), m, s * 0.3, 0.34 * lvl, { art: 'pizz' });
  }
  playBar(bar, t) {
    const S = this.S, sb = this.sb, I = this.inst, B = this.barDur, s = this.spb, c = S.ch[sb];
    switch (S.type) {
      case 'intro':
        this.oompah(t, c, 0.8);
        if (sb === 1) { I.xylo.note(this.bt(t, 2), 84, 1, 0.4); I.xylo.note(this.bt(t, 2.5), 79, 1, 0.35); I.xylo.note(this.bt(t, 3), 76, 1, 0.35); I.perc.block(this.bt(t, 3.5), 0.5, true); }
        break;
      case 'A': case 'A2': {
        const notes = this.barSlice(PIP_A, sb, 4), A2 = S.type === 'A2';
        this.line(A2 ? I.flute : I.clar, t, notes, { vel: 0.58, tr: A2 ? 12 : 0, legato: 0.75, hum: 4 });
        if (A2) this.line(I.xylo, t, notes, { vel: 0.3, tr: 12, hum: 4 });
        this.oompah(t, c);
        if (sb % 2 === 1) I.perc.tri(this.bt(t, 3), 0.3);
        if (sb === 3 || sb === 7) I.glock.note(this.bt(t, 3.5), this.tones(c, 84, 1)[0], 1, 0.35);
        if (A2 && sb % 4 === 0) this.pad(I.str, t, B * 4, c, { n: 3, lo: 55, hi: 67, vel: 0.25, a: 1, r: 1, art: 'pad' });
        break;
      }
      case 'B': {
        // the bassoon sings (comically low); flute trills answer; woodblocks tick
        this.line(I.bsn, t, this.barSlice(PIP_B, sb, 4), { vel: 0.62, legato: 0.8, hum: 4 });
        const v = this.voicing(c, 3, 57, 69, 'pz');
        for (const b of [0, 1, 2, 3]) for (const m of v) I.pizz.note(this.bt(t, b + 0.5), m, s * 0.3, 0.3, { art: 'pizz' });
        I.mar.note(t, this.bassPitch(c, 45, 57, 'mb'), s, 0.5);
        if (sb % 2 === 1) { const tn = this.tones(c, 81, 2); for (let k = 0; k < 6; k++) I.flute.note(this.bt(t, 2 + k * 0.25), k % 2 ? tn[0] + 2 : tn[0], s * 0.24, 0.35); }
        I.perc.block(this.bt(t, 1), 0.4); I.perc.block(this.bt(t, 3), 0.45, true);
        if (sb === 7) { I.perc.block(this.bt(t, 2), 0.5); I.perc.block(this.bt(t, 2.5), 0.5, true); }
        break;
      }
      case 'garden': {
        this.line(I.flute, t, this.barSlice(S.mel, sb, 4), { vel: 0.42, hum: 8 });
        this.arp(I.harp, t, 4, c, { pat: [0, 1, 2, 3, 4, 3, 2, 1], lo: 53, vel: 0.24 });
        if (sb % 2 === 0) this.pad(I.str, t, B * 2, c, { n: 3, lo: 53, hi: 67, vel: 0.26, a: 1, r: 1.2, art: 'pad' });
        if (this.rng.chance(0.6)) I.cel.note(this.bt(t, this.rng.pick([1, 2, 2.5, 3])), this.rng.pick(this.tones(c, 84, 4)), 1, 0.3);
        if (sb === 7) { I.picc.note(this.bt(t, 2), 96, s * 0.4, 0.3); I.picc.note(this.bt(t, 2.5), 93, s * 1.2, 0.3); }
        break;
      }
    }
    if (++this.sb >= S.bars) { this.sb = 0; if (++this.si >= this.form.length) this.plan(); else this.make(); }
    return B;
  }
}
