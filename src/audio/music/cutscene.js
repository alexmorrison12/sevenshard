// Cutscene underscores built on the SEVENSHARD leitmotifs.
// 'cutscene_sad' — D minor, 58 BPM: the hero's call slowed and broken on solo cello; an oboe remembers over harp while
//   the SHARD motif glints on celesta; violins + "oo" choir weep; a sparse ending. ≈100 s per cycle.
// 'cutscene_heroic' — D major, 84 BPM: the HERO theme reborn in major. rise (timpani roll, low strings, a distant horn
//   call) → resolve (horns + strings) → triumph (tutti, choir, taiko, crashes) → glory (Bb–C–D). ≈90 s per cycle.
import { Track } from './track.js';
import { Ens, Solo, Wind, Harp, Horn, Mallet, Timpani, Taiko, Cymbal, Fx } from './instruments.js';
import { mel } from './theory.js';
import { SHARD, SHARD_MAJ } from './motifs.js';

const LAMENT = mel('A3:2 D4:2 | F4:3 E4:.5 D4:.5 | D4:2 Bb3:1 G3:1 | A3:3 C#4:1 | D4:2 F4:1 A4:1 | G4:2 F4:1 E4:1 | D4:2 C#4:2 | D4:4');
const LAMENT_CH = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Gm/Bb', ['Asus4', 'A'], 'Dm'];
const WEEP = mel('D5:3 C5:1 | C5:2 A4:2 | Bb4:1.5 A4:.5 G4:2 | A4:4 | G4:2 Bb4:1 Eb5:1 | D5:3 F5:1 | E5:2 D5:2 | C#5:4');
const WEEP_CH = ['Bb', 'F/A', 'Gm', 'Dm/F', 'Eb', 'Bb/D', 'Asus4', 'A'];
const MEM_CH = ['Dm', 'F', 'C', 'Dm', 'Bb', 'F', 'Gm', 'A'];

export class CutsceneSad extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(58, 4);
    this.I('cello', Solo, { kind: 'cello', pan: 0.1, rev: 0.55 });
    this.I('oboe', Wind, { kind: 'oboe', pan: -0.1, rev: 0.6 });
    this.I('vln', Ens, { patch: 'strings', pan: -0.3, rev: 0.6, scale: 0.28, bright: 0.95 });
    this.I('str', Ens, { patch: 'strings', pan: 0.1, rev: 0.55, scale: 0.24, bright: 0.75 });
    this.I('low', Ens, { patch: 'strings', pan: 0.25, rev: 0.45, scale: 0.28, bright: 0.55 });
    this.I('oo', Ens, { patch: 'choir_oo', rev: 0.7, scale: 0.24 });
    this.I('harp', Harp, { pan: -0.4, rev: 0.6 });
    this.I('cel', Mallet, { kind: 'celesta', pan: 0.35, rev: 0.75, scale: 0.22 });
    this.form = ['lament', 'memory', 'weep', 'ending']; this.si = 0; this.sb = 0; this.cycle = 0;
  }
  playBar(bar, t) {
    const I = this.inst, B = this.barDur, s = this.spb, r = this.rng;
    const type = this.form[this.si], sb = this.sb, len = type === 'ending' ? 4 : 8;
    const raw = (type === 'lament' ? LAMENT_CH : type === 'weep' ? WEEP_CH : type === 'memory' ? MEM_CH : ['Dm', 'Bb', 'Gm', 'Dm'])[sb];
    const cs = Array.isArray(raw) ? raw : [raw], each = (fn) => cs.forEach((c, i) => fn(c, t + i * (B / cs.length), B / cs.length));
    switch (type) {
      case 'lament':
        this.line(I.cello, t, this.barSlice(LAMENT, sb, 4), { vel: 0.6, slur: true, legato: 1 });
        each((c, tt, d) => { this.pad(I.str, tt, d, c, { n: 3, lo: 52, hi: 67, vel: 0.26, a: 1.2, r: 1.5, art: 'pad' }); I.low.note(tt, this.bassPitch(c, 31, 43, 'lb'), d, 0.3, { a: 1, r: 1.5 }); });
        if (sb % 2 === 1) I.harp.note(this.bt(t, 2), this.tones(cs[0], 62, 3)[r.int(0, 2)], B, 0.22);
        break;
      case 'memory':
        this.line(I.oboe, t, this.barSlice(LAMENT, sb, 4), { vel: 0.46, tr: 12 });
        each((c, tt) => this.arp(I.harp, tt, 4, c, { pat: [0, 1, 2, 3, 2, 1], step: 0.5 * cs.length, lo: 50, vel: 0.22, len: 4 }));
        if (sb % 2 === 0) this.pad(I.str, t, B * 2, cs[0], { n: 3, lo: 50, hi: 65, vel: 0.22, a: 1.5, r: 1.5, art: 'pad' });
        if (sb === 2 || sb === 6) this.line(I.cel, this.bt(t, 1), SHARD, { vel: 0.3, tr: -12, hum: 3 });
        break;
      case 'weep':
        this.line(I.vln, t, this.barSlice(WEEP, sb, 4), { vel: 0.5, a: 0.5, r: 1 });
        if (sb >= 4) this.line(I.cello, t, this.barSlice(LAMENT, sb, 4), { vel: 0.4, tr: -12, slur: true });
        each((c, tt, d) => { this.pad(I.oo, tt, d, c, { n: 3, lo: 50, hi: 64, vel: 0.34, a: 1, r: 1.5, key: 'oo' }); this.pad(I.str, tt, d, c, { n: 3, lo: 46, hi: 60, vel: 0.24, a: 0.8 }); I.low.note(tt, this.bassPitch(c, 31, 43, 'lb'), d, 0.32, { a: 0.8, r: 1.2 }); });
        break;
      case 'ending':
        if (sb === 0) { this.pad(I.str, t, B * 3.5, 'Dm', { n: 4, lo: 50, hi: 69, vel: 0.26, a: 2, r: 3, art: 'pad' }); I.low.note(t, 38, B * 3.5, 0.3, { a: 2, r: 3 }); }
        if (sb === 1) this.line(I.cel, this.bt(t, 1), SHARD, { vel: 0.26, tr: -12, hum: 3 });
        if (sb === 2) I.harp.note(this.bt(t, 1), 62, B, 0.25);
        break;
    }
    if (++this.sb >= len) { this.sb = 0; if (++this.si >= this.form.length) { this.si = 0; this.cycle++; this.form = this.cycle % 2 ? ['memory', 'lament', 'weep', 'ending'] : ['lament', 'memory', 'weep', 'ending']; } }
    return B;
  }
}

// HERO in D major (bar 2 re-shaped for the major mode)
const HERO_MAJ = mel('D4:1.5! A4:.5 D5:2 | C#5:.5 B4:.5 A4:1 F#4:1 D4:1 | F#4:1.5! C#5:.5 F#5:2 | E5:.5 D5:.5 C#5:1 A4:1 E4:1 | G4:1 B4:1 D5:1.5 C#5:.5 | B4:1 D5:1 F#5:2! | E5:.5 D5:.5 C#5:.5 B4:.5 A4:1 C#5:1 | D5:4');
const HERO_MAJ_CH = ['D', 'Bm7', 'F#m', 'A', 'Em', 'Bm', ['Em', 'A'], 'D'];

export class CutsceneHeroic extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(84, 4);
    this.I('str', Ens, { patch: 'strings', pan: -0.15, rev: 0.45, scale: 0.3 });
    this.I('vln', Ens, { patch: 'strings', pan: -0.35, rev: 0.5, scale: 0.3, bright: 1.2 });
    this.I('low', Ens, { patch: 'strings', pan: 0.25, rev: 0.35, scale: 0.32, bright: 0.7 });
    this.I('choir', Ens, { patch: 'choir_ah', rev: 0.6, scale: 0.28 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.5, scale: 0.26 });
    this.I('brass', Ens, { patch: 'brass', pan: 0.15, rev: 0.45, scale: 0.24 });
    this.I('horn', Horn, { pan: 0.25, rev: 0.6 });
    this.I('tpt', Horn, { kind: 'trumpet', pan: 0.1, rev: 0.5 });
    this.I('harp', Harp, { pan: -0.45, rev: 0.55 });
    this.I('cel', Mallet, { kind: 'celesta', pan: 0.35, rev: 0.7, scale: 0.24 });
    this.I('timp', Timpani, { rev: 0.5 });
    this.I('taiko', Taiko, { size: 'big', rev: 0.4 });
    this.I('cym', Cymbal, { rev: 0.55 });
    this.I('fx', Fx, { rev: 0.45 });
    this.form = ['rise', 'resolve', 'triumph', 'glory']; this.si = 0; this.sb = 0; this.cycle = 0;
  }
  playBar(bar, t) {
    const I = this.inst, B = this.barDur, s = this.spb;
    const type = this.form[this.si], sb = this.sb, len = type === 'rise' || type === 'glory' ? 4 : 8;
    const raw = type === 'rise' ? ['D', 'D', 'G/D', 'A'][sb] : type === 'glory' ? ['Bb', 'C', 'D', 'D'][sb] : HERO_MAJ_CH[sb];
    const cs = Array.isArray(raw) ? raw : [raw], each = (fn) => cs.forEach((c, i) => fn(c, t + i * (B / cs.length), B / cs.length));
    const mel8 = this.barSlice(HERO_MAJ, sb, 4);
    switch (type) {
      case 'rise':
        if (sb === 0) { I.low.note(t, 26, B * 4, 0.45, { a: 3, r: 1 }); I.low.note(t, 38, B * 4, 0.36, { a: 3.5, r: 1 }); I.timp.roll(t, 38, B * 2, 0.02, 0.35, { hit: false }); }
        if (sb === 1) this.line(I.horn, t, this.barSlice(HERO_MAJ, 0, 4), { vel: 0.45 });
        if (sb >= 1) each((c, tt, d) => this.pad(I.str, tt, d, c, { n: 4, lo: 50, hi: 66, vel: 0.24 + sb * 0.06, a: 1, art: sb === 1 ? 'pad' : 'legato' }));
        if (sb === 2) this.line(I.cel, this.bt(t, 1), SHARD_MAJ, { vel: 0.3, tr: -12, hum: 3 });
        if (sb === 3) { I.timp.roll(t, 45, B - 0.05, 0.1, 0.8, { hit: false }); I.cym.swell(this.bt(t, 1), B - s, 0.55); this.pad(I.horns, this.bt(t, 1), B - s, 'A', { n: 3, lo: 52, hi: 64, vel: 0.5, art: 'swell', a: 1.5 }); }
        break;
      case 'resolve':
        this.line(I.horn, t, mel8, { vel: 0.72 }); this.line(I.vln, t, mel8, { vel: 0.44, tr: 12, a: 0.15, r: 0.5 });
        each((c, tt, d) => { this.pad(I.str, tt, d, c, { n: 4, lo: 45, hi: 62, vel: 0.38, a: 0.35 }); I.low.note(tt, this.bassPitch(c, 31, 43, 'lb'), d, 0.45, { a: 0.2 }); });
        this.arp(I.harp, t, 4, cs[0], { pat: [0, 1, 2, 3, 4, 3, 2, 1], lo: 50, vel: 0.26 });
        if (sb === 0 || sb === 4) I.timp.hit(t, 38, 0.55);
        if (sb === 7) { I.cym.swell(this.bt(t, 1), B - s, 0.5); I.timp.roll(this.bt(t, 2), 45, B * 0.5 - 0.05, 0.1, 0.7, { hit: false }); }
        break;
      case 'triumph':
        this.line(I.horn, t, mel8, { vel: 0.84 }); this.line(I.tpt, t, mel8, { vel: 0.6, tr: 12 }); this.line(I.vln, t, mel8, { vel: 0.62, tr: 12, a: 0.05, r: 0.4 });
        each((c, tt, d) => {
          this.pad(I.str, tt, d, c, { n: 5, lo: 45, hi: 64, vel: 0.5, a: 0.12 });
          this.pad(I.choir, tt, d, c, { n: 4, lo: 52, hi: 69, vel: 0.55, a: 0.3, key: 'choir' });
          this.pad(I.brass, tt, Math.min(d, s * 1.5), c, { n: 4, lo: 45, hi: 62, vel: 0.62, art: 'marc', key: 'brass' });
          I.low.note(tt, this.bassPitch(c, 26, 38, 'lb'), d, 0.58, { a: 0.05 });
        });
        for (const k of [0, 3, 6]) I.taiko.hit(this.bt(t, k * 0.5), k === 0 ? 0.9 : 0.68);
        I.timp.hit(t, this.bassPitch(cs[0], 36, 48, 'tp'), sb % 4 === 0 ? 0.8 : 0.55);
        if (sb === 0 || sb === 4) I.cym.crash(t, sb ? 0.55 : 0.8);
        if (sb === 7) I.cym.swell(this.bt(t, 1), B - s, 0.55);
        break;
      case 'glory': {
        const v = [0.62, 0.68, 0.66, 0.4][sb];
        if (sb < 3) each((c, tt, d) => {
          this.pad(I.str, tt, d * (sb === 2 ? 2 : 1), c, { n: 5, lo: 50, hi: 76, vel: v, a: 0.2, r: sb === 2 ? 2.5 : 0.8 });
          this.pad(I.choir, tt, d * (sb === 2 ? 2 : 1), c, { n: 4, lo: 55, hi: 74, vel: v, a: 0.25, r: sb === 2 ? 2.5 : 0.8, key: 'choir' });
          this.pad(I.brass, tt, d * (sb === 2 ? 1.6 : 0.9), c, { n: 4, lo: 48, hi: 67, vel: v, art: 'marc', r: sb === 2 ? 1.5 : 0.5, key: 'brass' });
          I.low.note(tt, this.bassPitch(c, 26, 38, 'lb'), d * (sb === 2 ? 2 : 1), v, { a: 0.05, r: sb === 2 ? 2.5 : 0.8 });
        });
        if (sb === 0) { I.cym.crash(t, 0.7); I.taiko.hit(t, 0.85); I.timp.hit(t, 46, 0.7); }
        if (sb === 1) { I.taiko.hit(t, 0.8); I.timp.hit(t, 48, 0.7); I.timp.roll(this.bt(t, 2), 38, B * 0.5 - 0.05, 0.1, 0.8, { hit: false }); I.cym.swell(this.bt(t, 2), B * 0.5, 0.55); }
        if (sb === 2) { I.cym.crash(t, 0.85); I.taiko.hit(t, 1); I.timp.hit(t, 38, 0.9); I.fx.boom(t, 0.6); this.line(I.horn, t, [{ b: 0, d: 4, m: 62 }], { vel: 0.7 }); this.line(I.tpt, t, [{ b: 0, d: 4, m: 66 }], { vel: 0.5 }); }
        if (sb === 3) { this.line(I.cel, t, SHARD_MAJ, { vel: 0.38, hum: 3 }); I.harp.gliss(t, [62, 66, 69, 74, 78, 81, 86], s * 1.2, 0.35); }
        break;
      }
    }
    if (++this.sb >= len) { this.sb = 0; if (++this.si >= this.form.length) { this.si = 0; this.cycle++; } }
    return B;
  }
}
