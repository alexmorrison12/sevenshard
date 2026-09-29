// 'title' — the SEVENSHARD main theme. D minor, 4/4, 80 BPM (3 s bars). The first impression: noble, sweeping.
// Leitmotifs (shared with cutscene_heroic / victory / stingers, see motifs.js):
//   SHARD — seven glittering notes (D-A-E-F-E-A-D, Dm add9) on celesta + harp: the Sunheart's shards.
//   HERO  — horn call: rising 5th + 4th (D-A-D), answered by a falling line, then sequenced a third higher
//           (F-C-F), climbing to the peak and cadencing through A major.
//   B     — lyrical strings + choir in Bb/F, peaking on G5.
// Form (cycle 1): intro → A (solo horn) → A2 (violins, horn counterline, choir) → B → A3 (tutti: brass, choir,
// taiko) → coda (Bb–C–D major, the epic bVI–bVII–I) → breath. Later cycles reorder and swap in a development
// section built from motif fragments, so no cycle repeats exactly (≈2 min per cycle).
import { Track } from './track.js';
import { Ens, Horn, Wind, Harp, Mallet, Timpani, Taiko, Cymbal, Fx, Strings } from './instruments.js';
import { Scale, genPhrase } from './theory.js';
import { HERO, HERO_CH, SHARD, SHARD_MAJ, B_THEME, B_CH } from './motifs.js';

const DEV_CH = [['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'], ['Dm', 'C', 'Bb', 'A', 'Gm', 'Dm/F', 'Em7b5', 'A']];
const CODA_CH = ['Bb', 'C', 'D', 'D'];

export class Title extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(80, 4);
    this.I('str', Ens, { patch: 'strings', pan: -0.15, rev: 0.45, scale: 0.3 });
    this.I('low', Ens, { patch: 'strings', pan: 0.25, rev: 0.35, scale: 0.34, bright: 0.7 });
    this.I('vln', Ens, { patch: 'strings', pan: -0.35, rev: 0.5, scale: 0.3, bright: 1.2 });
    this.I('choir', Ens, { patch: 'choir_ah', rev: 0.6, scale: 0.28 });
    this.I('oo', Ens, { patch: 'choir_oo', rev: 0.65, scale: 0.26 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.5, scale: 0.26 });
    this.I('brass', Ens, { patch: 'brass', pan: 0.15, rev: 0.45, scale: 0.22 });
    this.I('horn', Horn, { pan: 0.25, rev: 0.6 });
    this.I('tpt', Horn, { kind: 'trumpet', pan: 0.1, rev: 0.5 });
    this.I('harp', Harp, { pan: -0.45, rev: 0.55 });
    this.I('cel', Mallet, { kind: 'celesta', pan: 0.35, rev: 0.7, scale: 0.26 });
    this.I('flute', Wind, { kind: 'flute', pan: -0.1, rev: 0.55 });
    this.I('oboe', Wind, { kind: 'oboe', pan: 0.12, rev: 0.5 });
    this.I('spc', Strings, { pan: 0.2, rev: 0.3, bright: 0.9 });
    this.I('timp', Timpani, { rev: 0.5 });
    this.I('taiko', Taiko, { size: 'big', rev: 0.4 });
    this.I('tkm', Taiko, { size: 'mid', pan: 0.25, rev: 0.35 });
    this.I('cym', Cymbal, { rev: 0.55 });
    this.I('fx', Fx, { rev: 0.4 });
    this.scale = new Scale('D', 'minor');
    this.cycle = 0; this.plan();
  }
  plan() {
    const r = this.rng, first = this.cycle === 0;
    this.form = first ? ['intro', 'A', 'A2', 'B', 'A3', 'coda', 'breath']
      : r.pick([['intro', 'A2', 'dev', 'B', 'A3', 'coda', 'breath'], ['intro', 'A', 'B', 'dev', 'A3', 'coda', 'breath'], ['intro', 'dev', 'A2', 'B', 'A3', 'coda', 'breath']]);
    this.si = 0; this.sb = 0; this.cycle++;
    this.arpPat = r.pick([[0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 1], [0, 1, 2, 4, 3, 2, 3, 1]]);
    this.makeSection();
  }
  makeSection() {
    const r = this.rng, type = this.form[this.si];
    const S = { type, bars: { intro: 4, coda: 4, breath: 2 }[type] || 8 };
    S.ch = type === 'B' ? B_CH : type === 'dev' ? r.pick(DEV_CH) : type === 'coda' ? CODA_CH : type === 'intro' ? ['Dm', 'Dm', 'Bb/D', ['Dm', 'A']] : type === 'breath' ? ['Dm', 'Dm'] : HERO_CH;
    const chordAt = (b) => { const c = S.ch[Math.min(S.bars - 1, Math.floor(b / 4))]; return Array.isArray(c) ? c[(b % 4) < 2 ? 0 : 1] : c; };
    if (type === 'A2' || type === 'A3') S.counter = genPhrase(r, { scale: this.scale, chordAt, bars: 8, bpb: 4, lo: 62, hi: 77, cells: [[4], [2, 2], [3, 1], [2, 1, 1]], cad: [[4]], rest: 0 });
    if (type === 'dev') {
      // development: the HERO call passed between voices over a moving bass, answered by generated phrases
      S.ans = genPhrase(r, { scale: new Scale('D', 'dorian'), chordAt, bars: 8, bpb: 4, lo: 64, hi: 81, contour: 'arch', rest: 0.1 });
      S.caller = r.pick([['horn', 'oboe', 'horn', 'flute'], ['oboe', 'horn', 'flute', 'horn']]);
    }
    this.S = S;
  }
  playBar(bar, t) {
    const S = this.S, sb = this.sb, I = this.inst, B = this.barDur, s = this.spb, r = this.rng;
    const raw = S.ch[sb], cs = Array.isArray(raw) ? raw : [raw];
    const each = (fn) => cs.forEach((c, i) => fn(c, t + i * (B / cs.length), B / cs.length));
    switch (S.type) {
      case 'intro': {
        if (sb === 0) {
          I.low.note(t, 26, B * 3.8, 0.5, { a: 2.5, r: 1.5 }); I.low.note(t, 38, B * 3.8, 0.42, { a: 3, r: 1.5 });
          this.pad(I.oo, this.bt(t, 1), B * 2.8, 'Dm', { n: 4, lo: 57, hi: 74, vel: 0.45, a: 3, r: 1.5, art: 'pad' });
          I.fx.boom(t, 0.5);
        }
        // the Shard motif glitters over the drone (bars 1–2)
        if (sb === 1 || sb === 2) { this.line(I.cel, this.bt(t, sb === 1 ? 0 : 0.5), SHARD, { vel: 0.5, tr: sb === 1 ? 0 : -12, hum: 3 }); this.line(I.harp, this.bt(t, sb === 1 ? 0.02 : 0.52), SHARD, { vel: 0.32, tr: -12, hum: 3 }); }
        if (sb === 2) this.pad(I.str, t, B * 2, 'Bb/D', { n: 4, lo: 50, hi: 69, vel: 0.3, a: 2, r: 1, art: 'pad' });
        if (sb === 3) {
          I.cym.swell(this.bt(t, 1), B - s, 0.6); I.timp.roll(this.bt(t, 2), 45, B * 0.5 - 0.05, 0.05, 0.6, { hit: false });
          this.pad(I.horns, this.bt(t, 2), B * 0.5, 'A', { n: 3, lo: 52, hi: 69, vel: 0.5, art: 'swell', a: 1.2 });
          this.pad(I.choir, this.bt(t, 2), B * 0.5, 'A', { n: 4, lo: 57, hi: 73, vel: 0.45, a: 1.2, art: 'swell' });
          I.low.note(this.bt(t, 2), 33, B * 0.5, 0.45, { a: 0.6, r: 0.4 });
        }
        break;
      }
      case 'breath': {
        if (sb === 0) { this.pad(I.oo, t, B * 1.6, 'Dm', { n: 3, lo: 57, hi: 72, vel: 0.3, a: 1.5, r: 2, art: 'pad' }); I.low.note(t, 38, B * 1.6, 0.3, { a: 1.5, r: 2 }); }
        if (sb === 1) this.line(I.cel, this.bt(t, 0.5), SHARD, { vel: 0.3, tr: 0, hum: 3 });
        break;
      }
      case 'A': case 'A2': case 'A3': {
        const A2 = S.type === 'A2', A3 = S.type === 'A3';
        const mel = this.barSlice(HERO, sb, 4);
        if (S.type === 'A') this.line(I.horn, t, mel, { vel: 0.66 });
        if (A2) { this.line(I.vln, t, mel, { vel: 0.55, tr: 12, a: 0.12, r: 0.5 }); this.line(I.vln, t, mel, { vel: 0.4, a: 0.12, r: 0.5 }); if (S.counter) this.line(I.horn, t, this.barSlice(S.counter, sb, 4), { vel: 0.46, tr: -12 }); }
        if (A3) {
          this.line(I.horn, t, mel, { vel: 0.82 }); this.line(I.tpt, t, mel, { vel: 0.62, tr: 12 });
          this.line(I.vln, t, mel, { vel: 0.66, tr: 12, a: 0.06, r: 0.4 });
        }
        each((c, tt, d) => {
          // accompaniment sits under the tune: horn tune D4–F5 (A) → strings ≤ D4; violins an octave up (A2/A3) → ≤ A4
          this.pad(I.str, tt, d, c, { n: A3 ? 5 : 4, lo: A3 ? 45 : 43, hi: S.type === 'A' ? 62 : 69, vel: A3 ? 0.5 : 0.36, a: A3 ? 0.15 : 0.4 });
          this.bass(I.low, tt, d, c, { lo: 33, hi: 45, vel: A3 ? 0.62 : 0.46, oct: S.type !== 'A' });
          if (!(S.type === 'A')) this.pad(I.choir, tt, d, c, { n: 4, lo: 52, hi: 69, vel: A3 ? 0.55 : 0.4, a: 0.5, key: 'choir' });
          if (A3) this.pad(I.brass, tt, Math.min(d, s * 1.5), c, { n: 4, lo: 45, hi: 62, vel: 0.62, art: 'marc', key: 'brass' });
          else if (A2) this.pad(I.horns, tt + 0.02, d, c, { n: 3, lo: 48, hi: 60, vel: 0.36, a: 0.5, key: 'horns' });
        });
        if (!A3) this.arp(I.harp, t, 4, cs[0], { pat: this.arpPat, lo: 50, vel: A2 ? 0.26 : 0.3 });
        if (A2 && (sb === 0 || sb === 4)) I.timp.hit(t, 38, 0.55);
        if (A3) {
          // taiko 3-3-2 drive + timpani on the bass, crashes on phrase starts, spiccato pulse
          for (const k of [0, 3, 6]) I.taiko.hit(this.bt(t, k * 0.5), k === 0 ? 0.9 : 0.7);
          I.tkm.hit(this.bt(t, 1), 0.45); I.tkm.hit(this.bt(t, 3), 0.5, { rim: sb % 2 === 1 });
          const bm = this.vl.get('low')[0];
          I.timp.hit(t, bm < 38 ? bm + 12 : bm, sb % 4 === 0 ? 0.8 : 0.55);
          if (sb === 0 || sb === 4) I.cym.crash(t, sb ? 0.55 : 0.8);
          for (let k = 0; k < 8; k++) I.spc.note(this.bt(t, k * 0.5), bm + 12, s * 0.4, k % 2 ? 0.34 : 0.46, { d: 0.12 });
          if (sb === 7) { I.cym.swell(this.bt(t, 1), B - s, 0.45); }
        }
        if (S.type === 'A' && sb === 7) I.timp.roll(this.bt(t, 2), 38, B * 0.5 - 0.05, 0.05, 0.45, { hit: false });
        if (A2 && sb === 7) { I.cym.swell(this.bt(t, 2), B * 0.5, 0.4); }
        break;
      }
      case 'B': {
        const mel = this.barSlice(B_THEME, sb, 4);
        this.line(I.vln, t, mel, { vel: 0.58, a: 0.2, r: 0.7 });
        this.line(I.choir, t, mel, { vel: 0.34, tr: -12, a: 0.25, r: 0.6, key: 'choirMel' });
        if (sb >= 4) this.line(I.flute, t, mel, { vel: 0.4, tr: 12 });
        each((c, tt, d) => {
          this.pad(I.str, tt, d, c, { n: 4, lo: 46, hi: 64, vel: 0.36, a: 0.5 });
          this.bass(I.low, tt, d, c, { lo: 34, hi: 46, vel: 0.46, oct: true });
          this.pad(I.horns, tt + 0.03, d, c, { n: 3, lo: 50, hi: 62, vel: 0.36, a: 0.4, key: 'horns' });
        });
        this.arp(I.harp, t, 4, cs[0], { pat: [0, 2, 4, 2], step: 1, lo: 53, vel: 0.28, len: 3 });
        if (sb === 4) I.cym.crash(t, 0.4);
        if (sb === 7) { I.timp.roll(this.bt(t, 0), 45, B - 0.05, 0.05, 0.75); I.cym.swell(this.bt(t, 1), B - s, 0.55); I.fx.riser(this.bt(t, 0.5), B - s * 0.5, 0.25); }
        break;
      }
      case 'dev': {
        // HERO call fragments passed around, each answered by a generated phrase in D dorian
        const who = S.caller[Math.floor(sb / 2) % 4], half = sb % 2 === 0;
        if (half) { const call = this.barSlice(HERO, 0, 4); const tr = [0, 5, 3, -2][Math.floor(sb / 2) % 4]; this.line(I[who], t, call, { vel: who === 'horn' ? 0.58 : 0.5, tr: tr + (who === 'horn' ? 0 : 12) }); }
        else this.line(I[S.caller[(Math.floor(sb / 2) + 1) % 4] === 'horn' ? 'oboe' : 'flute'], t, this.barSlice(S.ans, sb, 4), { vel: 0.45 });
        each((c, tt, d) => {
          this.pad(I.str, tt, d, c, { n: 4, lo: 50, hi: 69, vel: 0.32, a: 0.6 });
          this.bass(I.low, tt, d, c, { lo: 33, hi: 45, vel: 0.42 });
          if (sb >= 4) this.pad(I.oo, tt, d, c, { n: 3, lo: 57, hi: 72, vel: 0.3, a: 0.8, key: 'oo' });
        });
        // low spiccato pulse grows through the section
        const bm = this.vl.get('low')[0];
        const pulses = sb < 4 ? [0, 2] : [0, 1, 2, 3, 4, 5, 6, 7];
        for (const k of pulses) I.spc.note(this.bt(t, k * (sb < 4 ? 1 : 0.5)), bm + 12, s * 0.4, 0.3 + sb * 0.02, { d: 0.12 });
        if (sb >= 4) I.tkm.hit(t, 0.35 + sb * 0.03);
        if (sb === 7) { I.timp.roll(this.bt(t, 1), 45, B - s - 0.05, 0.05, 0.7); I.cym.swell(this.bt(t, 1), B - s, 0.5); }
        break;
      }
      case 'coda': {
        // Bb – C – D major: the epic bVI–bVII–I, then the Shard motif over D major
        const v = [0.6, 0.66, 0.62, 0.4][sb];
        if (sb < 3) each((c, tt, d) => {
          this.pad(I.str, tt, d * (sb === 2 ? 2 : 1), c, { n: 5, lo: 50, hi: 76, vel: v, a: 0.2, r: sb === 2 ? 2.5 : 0.8 });
          this.pad(I.choir, tt, d * (sb === 2 ? 2 : 1), c, { n: 4, lo: 55, hi: 74, vel: v, a: 0.25, r: sb === 2 ? 2.5 : 0.8, key: 'choir' });
          this.pad(I.brass, tt, d * (sb === 2 ? 1.6 : 0.9), c, { n: 4, lo: 48, hi: 67, vel: v, art: 'marc', r: sb === 2 ? 1.5 : 0.5, key: 'brass' });
          this.bass(I.low, tt, d * (sb === 2 ? 2 : 1), c, { lo: 26, hi: 38, vel: v, oct: true, r: sb === 2 ? 2.5 : 0.8 });
        });
        if (sb === 0) { I.cym.crash(t, 0.7); I.taiko.hit(t, 0.85); I.timp.hit(t, 46, 0.7); }
        if (sb === 1) { I.taiko.hit(t, 0.8); I.timp.hit(t, 48, 0.7); I.timp.roll(this.bt(t, 2), 38, B * 0.5 - 0.05, 0.1, 0.8, { hit: false }); I.cym.swell(this.bt(t, 2), B * 0.5, 0.55); }
        if (sb === 2) { I.cym.crash(t, 0.85); I.taiko.hit(t, 1); I.timp.hit(t, 38, 0.9); I.fx.boom(t, 0.6); this.line(I.horn, t, [{ b: 0, d: 4, m: 62 }], { vel: 0.7 }); this.line(I.tpt, t, [{ b: 0, d: 4, m: 66 }], { vel: 0.5 }); }
        if (sb === 3) { this.line(I.cel, this.bt(t, 0), SHARD_MAJ, { vel: 0.4, tr: 0, hum: 3 }); I.harp.gliss(t, [62, 66, 69, 74, 78, 81, 86], s * 1.2, 0.35); }
        break;
      }
    }
    if (++this.sb >= S.bars) {
      this.sb = 0;
      if (++this.si >= this.form.length) this.plan(); else this.makeSection();
    }
    return B;
  }
}
