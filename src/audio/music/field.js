// 'field' — the open road (Goldmeadow / Valemont): adventurous, sunlit. D major with a Mixolydian bVII (C),
// 4/4 at 108 BPM (bar ≈ 2.2 s). Sections: intro (horn call over the first ostinato) · road (16-bar horn theme over a
// spiccato march, light snare) · plains (lyrical strings, harp, flute answers, timpani) · trail (pizzicato +
// woodwind duet, generated) · tutti road (violins + horns in octaves, full drums). ≈2.2 min per cycle.
import { Track } from './track.js';
import { Ens, Strings, Wind, Harp, Horn, Mallet, Timpani, Taiko, Snare, Cymbal } from './instruments.js';
import { mel, Scale, genPhrase } from './theory.js';

const ROAD = mel('A4:1 D5:1.5 E5:.5 F#5:1 | G5:1.5 F#5:.5 E5:1 D5:1 | F#5:1 B4:1.5 C#5:.5 D5:1 | E5:3 A4:1 | B4:1 D5:1 G5:1.5 F#5:.5 | F#5:1 E5:1 D5:1 A4:1 | G5:1 F#5:1 E5:1 D5:1 | E5:2 C#5:1 A4:1 | A4:1 D5:1.5 E5:.5 F#5:1 | G5:1.5 E5:.5 C5:1 E5:1 | D5:1 B4:1.5 C5:.5 D5:1 | A4:3 D5:1 | F#5:1 D5:1 B4:1.5 C#5:.5 | D5:1 G5:1 B5:1.5 A5:.5 | A5:1 G5:1 E5:1 C#5:1 | D5:4');
const ROAD_CH = ['D', 'G', 'Bm', 'A', 'G', 'D/F#', 'Em7', 'A', 'D', 'C', 'G', 'D', 'Bm', 'G', 'A', 'D'];
const PLAINS = mel('F#5:3 E5:1 | D5:2 B4:2 | A4:1.5 B4:.5 D5:1 F#5:1 | E5:4 | F#5:2 A5:1 G5:1 | G5:1.5 F#5:.5 E5:2 | E5:1 F#5:1 G5:1 A5:1 | F#5:4');
const PLAINS_CH = ['Bm', 'G', 'D', 'A', 'Bm', 'Em', 'A7', 'D'];
const TRAIL_CH = [['D', 'C', 'G', 'D', 'Bm', 'C', 'G', 'A'], ['G', 'D', 'C', 'D', 'Em', 'C', 'G', 'A']];
// low-string ostinato cells (semitones above the bass, 8ths)
const OST = [[0, 0, 7, 0, 12, 0, 7, 0], [0, 12, 7, 12, 0, 12, 7, 5], [0, 0, 12, 0, 7, 7, 12, 7]];

export class Field extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(108, 4);
    this.I('str', Ens, { patch: 'strings', pan: -0.1, rev: 0.4, scale: 0.28 });
    this.I('vln', Ens, { patch: 'strings', pan: -0.35, rev: 0.45, scale: 0.3, bright: 1.15 });
    this.I('low', Ens, { patch: 'strings', pan: 0.25, rev: 0.3, scale: 0.3, bright: 0.7 });
    this.I('spc', Strings, { pan: 0.2, rev: 0.25, bright: 0.95 });
    this.I('horn', Horn, { pan: 0.25, rev: 0.45 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.45, scale: 0.26 });
    this.I('flute', Wind, { kind: 'flute', pan: -0.15, rev: 0.45 });
    this.I('oboe', Wind, { kind: 'oboe', pan: 0.12, rev: 0.42 });
    this.I('clar', Wind, { kind: 'clarinet', pan: 0.05, rev: 0.42 });
    this.I('harp', Harp, { pan: -0.45, rev: 0.45 });
    this.I('glock', Mallet, { kind: 'glock', pan: 0.35, rev: 0.5, scale: 0.16 });
    this.I('snare', Snare, { rev: 0.25 });
    this.I('tkm', Taiko, { size: 'mid', pan: 0.2, rev: 0.3 });
    this.I('timp', Timpani, { rev: 0.4 });
    this.I('cym', Cymbal, { rev: 0.45 });
    this.scale = new Scale('D', 'major'); this.mixo = new Scale('D', 'mixolydian');
    this.cycle = 0; this.plan();
  }
  plan() {
    const r = this.rng;
    this.form = this.cycle === 0 ? ['intro', 'road', 'plains', 'trail', 'tutti', 'plains'] : r.pick([['road', 'trail', 'plains', 'tutti'], ['trail', 'road', 'plains', 'tutti', 'plains'], ['plains', 'road', 'trail', 'tutti']]);
    this.ost = r.pick(OST); this.si = 0; this.sb = 0; this.cycle++;
    this.make();
  }
  make() {
    const r = this.rng, type = this.form[this.si];
    const S = { type, bars: type === 'intro' ? 2 : type === 'road' || type === 'tutti' ? 16 : 8 };
    S.ch = type === 'plains' ? PLAINS_CH : type === 'trail' ? r.pick(TRAIL_CH) : type === 'intro' ? ['D', 'A'] : ROAD_CH;
    if (type === 'trail') {
      const chordAt = (b) => S.ch[Math.min(7, Math.floor(b / 4))];
      S.a = genPhrase(r, { scale: this.mixo, chordAt, bars: 4, bpb: 4, lo: 69, hi: 86, rest: 0.1 });
      S.b = genPhrase(r, { scale: this.scale, chordAt: (b) => chordAt(b + 16), bars: 4, bpb: 4, lo: 62, hi: 79, contour: 'down', rest: 0.1 }).map((n) => ({ ...n, b: n.b + 16 }));
      S.who = r.pick([['flute', 'oboe'], ['oboe', 'clar'], ['flute', 'clar']]);
    }
    if (type === 'plains') S.counter = genPhrase(r, { scale: this.scale, chordAt: (b) => S.ch[Math.min(7, Math.floor(b / 4))], bars: 8, bpb: 4, lo: 74, hi: 88, cells: [[2, 2], [3, 1], [1, 1, 2], [4]], cad: [[4]], rest: 0.15 });
    this.S = S;
  }
  march(t, c, lvl, busy) {
    const I = this.inst, s = this.spb, bm = this.bassPitch(c, 38, 50, 'ostb');
    for (let k = 0; k < 8; k++) I.spc.note(this.bt(t, k * 0.5) + this.hum(3), bm + this.ost[k], s * 0.45, (k % 2 === 0 ? 0.58 : 0.42) * lvl, { d: 0.14 });
    // light snare: march figure with a pickup roll every 4th bar
    if (busy) {
      for (const [b, v] of [[0, 0.5], [1, 0.3], [1.5, 0.22], [2, 0.42], [3, 0.3], [3.5, 0.25]]) I.snare.hit(this.bt(t, b), v * lvl);
      if (this.sb % 4 === 3) I.snare.roll(this.bt(t, 3), this.spb * 0.95, 0.15, 0.5 * lvl, { rate: 16 });
    }
  }
  playBar(bar, t) {
    const S = this.S, sb = this.sb, I = this.inst, B = this.barDur, s = this.spb, c = S.ch[sb];
    switch (S.type) {
      case 'intro': {
        this.march(t, c, 0.8, false);
        if (sb === 0) { this.line(I.horn, t, [{ b: 0, d: 1.5, m: 57 }, { b: 1.5, d: 0.5, m: 62 }, { b: 2, d: 2, m: 69 }], { vel: 0.6 }); I.low.note(t, 38, B * 2, 0.4, { a: 0.4 }); }
        if (sb === 1) { this.pad(I.horns, t, B, 'A', { n: 3, lo: 52, hi: 64, vel: 0.45, art: 'swell', a: 1 }); I.cym.swell(this.bt(t, 1), B - s, 0.45); I.timp.roll(this.bt(t, 2), 45, B * 0.5 - 0.05, 0.05, 0.5, { hit: false }); }
        break;
      }
      case 'road': case 'tutti': {
        const tut = S.type === 'tutti', notes = this.barSlice(ROAD, sb, 4);
        if (!tut) this.line(I.horn, t, notes, { vel: 0.66, tr: -12 });
        else { this.line(I.vln, t, notes, { vel: 0.6, a: 0.05, r: 0.3 }); this.line(I.horn, t, notes, { vel: 0.66, tr: -12 }); this.line(I.flute, t, notes, { vel: 0.4, tr: 12 }); }
        this.march(t, c, tut ? 1.05 : 0.9, true);
        this.pad(I.str, t, B, c, { n: tut ? 4 : 3, lo: 45, hi: tut ? 64 : 60, vel: tut ? 0.36 : 0.28, a: 0.2, r: 0.5 });
        I.low.note(t, this.bassPitch(c, 31, 43, 'lowb'), B, tut ? 0.46 : 0.36, { a: 0.1, r: 0.4 });
        if (tut) this.pad(I.horns, t + 0.02, B, c, { n: 3, lo: 50, hi: 62, vel: 0.4, a: 0.15, key: 'horns' });
        if (tut) { I.tkm.hit(t, 0.6); I.tkm.hit(this.bt(t, 2), 0.45); }
        if (sb % 4 === 0) I.timp.hit(t, this.bassPitch(c, 36, 48, 'tp'), tut ? 0.7 : 0.5);
        if (sb === 0 && tut) I.cym.crash(t, 0.6);
        if (sb === 8) I.cym.crash(t, tut ? 0.5 : 0.35);
        if (sb === 15) { I.cym.swell(this.bt(t, 1), B - s, 0.4); }
        if (!tut && sb % 2 === 1) this.arp(I.harp, t, 4, c, { pat: [0, 1, 2, 3, 4, 3, 2, 1], lo: 62, vel: 0.2 });
        break;
      }
      case 'plains': {
        const notes = this.barSlice(PLAINS, sb, 4);
        this.line(I.vln, t, notes, { vel: 0.56, a: 0.2, r: 0.7 });
        if (S.counter) this.line(I.flute, t, this.barSlice(S.counter, sb, 4), { vel: 0.36 });
        this.pad(I.str, t, B, c, { n: 4, lo: 47, hi: 66, vel: 0.32, a: 0.5, r: 0.8 });
        I.low.note(t, this.bassPitch(c, 31, 43, 'lowb'), B, 0.4, { a: 0.3, r: 0.6 });
        this.arp(I.harp, t, 4, c, { pat: [0, 1, 2, 3, 4, 3, 2, 1], lo: 55, vel: 0.26 });
        if (sb % 2 === 0) this.pad(I.horns, t + 0.03, B * 2, c, { n: 2, lo: 50, hi: 62, vel: 0.3, a: 0.8, key: 'horns' });
        if (sb === 0 || sb === 4) I.timp.hit(t, this.bassPitch(c, 36, 48, 'tp'), 0.45);
        if (sb === 7) { I.glock.note(this.bt(t, 2), 90, 1, 0.3); I.cym.swell(this.bt(t, 2), B * 0.5, 0.3); }
        break;
      }
      case 'trail': {
        const [a, b] = S.who;
        if (sb < 4) this.line(I[a], t, this.barSlice(S.a, sb, 4), { vel: 0.5 }); else this.line(I[b], t, this.barSlice(S.b, sb, 4), { vel: 0.5, tr: b === 'clar' ? -12 : 0 });
        const bm = this.bassPitch(c, 38, 50, 'pz');
        I.spc.note(t, bm, s, 0.5, { art: 'pizz' }); I.spc.note(this.bt(t, 2), bm + 7, s, 0.4, { art: 'pizz' });
        const tn = this.tones(c, 62, 3); I.spc.note(this.bt(t, 1), tn[0], s, 0.3, { art: 'pizz' }); I.spc.note(this.bt(t, 3), tn[1], s, 0.3, { art: 'pizz' });
        if (sb % 2 === 0) this.pad(I.str, t, B * 2, c, { n: 3, lo: 52, hi: 67, vel: 0.22, a: 1, r: 1, art: 'pad' });
        if (sb === 3 || sb === 7) I.glock.note(this.bt(t, 3), this.tones(c, 86, 1)[0], 1, 0.22);
        break;
      }
    }
    if (++this.sb >= S.bars) {
      this.sb = 0;
      if (++this.si >= this.form.length) this.plan(); else this.make();
    }
    return B;
  }
}
