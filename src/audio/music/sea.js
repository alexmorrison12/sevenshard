// 'sea' — sailing the Glass Sea: a rollicking shanty. D dorian, 6/8 (eighth ≈ 200, bar ≈ 1.8 s).
// Verse: accordion + tin whistle. Chorus: the crew sings (low formant choir) with fiddle harmony and accordion
// chords. Jig: a generated fiddle reel over stomps. Every chorus ends with a crew "hey!" (choir shout + clap).
// Later cycles lift the chorus a whole step (the classic shanty key change) and reshuffle the sections.
import { Track } from './track.js';
import { Ens, Strings, Solo, Wind, Lute, HandDrum } from './instruments.js';
import { mel, Scale, genPhrase, transpose } from './theory.js';

const VERSE = mel('A4:1 D5:2 D5:1 E5:1 F5:1 | E5:2 C5:1 G4:2 C5:1 | A4:1 D5:2 D5:1 E5:1 F5:1 | E5:3 A4:3 | F5:1 E5:1 F5:1 A5:2 F5:1 | G5:2 E5:1 C5:2 E5:1 | F5:1 E5:1 D5:1 C#5:2 E5:1 | D5:3 r:3');
const VERSE_CH = ['Dm', 'C', 'Dm', 'A', 'F', 'C', ['Dm', 'A'], 'Dm'];
const CHORUS = mel('C5:2 A4:1 F4:2 A4:1 | G4:2 E4:1 C4:3 | D4:1 F4:1 A4:1 D5:2 C5:1 | B4:3 G4:3 | A4:2 F4:1 C5:2 A4:1 | G4:1 A4:1 G4:1 E4:3 | D4:1 F4:1 A4:1 C#5:2 A4:1 | D5:3 r:3');
const CHORUS_CH = ['F', 'C', 'Dm', 'G', 'F', 'C', ['Dm', 'A'], 'Dm'];
const JIG_CH = [['Dm', 'Dm', 'C', 'C', 'Dm', 'Dm', 'Am', 'Dm'], ['Dm', 'C', 'Dm', 'G', 'Dm', 'C', 'A', 'Dm']];

export class Sea extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(this.rng.range(196, 206), 6);
    this.I('acc', Wind, { kind: 'accordion', pan: 0.15, rev: 0.25 });
    this.I('accL', Wind, { kind: 'accordion', pan: 0.3, rev: 0.2, scale: 0.05 });
    this.I('whistle', Wind, { kind: 'whistle', pan: -0.2, rev: 0.3 });
    this.I('fid', Solo, { kind: 'fiddle', pan: -0.3, rev: 0.3 });
    this.I('gtr', Lute, { kind: 'guitar', pan: 0.25, rev: 0.2 });
    this.I('bass', Strings, { pan: 0.05, rev: 0.15 });
    this.I('crew', Ens, { patch: 'choir_ah', pan: 0, rev: 0.35, scale: 0.3, bright: 0.8 });
    this.I('low', Ens, { patch: 'strings', pan: 0.2, rev: 0.3, scale: 0.26, bright: 0.55 });
    this.I('drum', HandDrum, { pan: 0, rev: 0.2 });
    this.scale = new Scale('D', 'dorian');
    this.cycle = 0; this.plan();
  }
  plan() {
    const r = this.rng;
    this.form = this.cycle === 0 ? ['intro', 'verse', 'chorus', 'jig', 'verse', 'chorus', 'break', 'chorus'] : r.pick([['verse', 'chorus', 'jig', 'chorus', 'break', 'chorus'], ['jig', 'verse', 'chorus', 'verse', 'chorus', 'chorus'], ['verse', 'jig', 'chorus', 'break', 'chorus', 'chorus']]);
    this.si = 0; this.sb = 0; this.cycle++; this.lift = 0;
    this.make();
  }
  make() {
    const r = this.rng, type = this.form[this.si];
    const S = { type, bars: type === 'intro' ? 2 : type === 'break' ? 4 : 8 };
    // the last chorus of a (later) cycle lifts a whole step
    if (type === 'chorus' && this.cycle > 1 && this.form.indexOf('chorus', this.si + 1) < 0) this.lift = 2;
    S.tr = type === 'chorus' ? this.lift : 0;
    S.ch = type === 'verse' ? VERSE_CH : type === 'chorus' ? CHORUS_CH : type === 'jig' ? r.pick(JIG_CH) : type === 'break' ? ['Dm', 'C', 'Dm', 'A'] : ['Dm', 'A'];
    if (type === 'jig') S.mel = genPhrase(r, { scale: this.scale, chordAt: (b) => S.ch[Math.min(7, Math.floor(b / 6))], bars: 8, bpb: 6, lo: 67, hi: 86, cells: [[1, 1, 1, 1, 1, 1], [2, 1, 2, 1], [1, 1, 1, 3], [3, 1, 1, 1]], cad: [[3, 3], [6]], rest: 0 });
    S.lead = this.cycle % 2 ? 'whistle' : 'acc';
    this.S = S;
  }
  trans(c, k) { return transpose(c, k); }
  playBar(bar, t) {
    const S = this.S, sb = this.sb, I = this.inst, B = this.barDur, s = this.spb;
    const raw = S.ch[sb], cs = (Array.isArray(raw) ? raw : [raw]).map((c) => this.trans(c, S.tr));
    const each = (fn) => cs.forEach((c, i) => fn(c, t + i * (B / cs.length), B / cs.length));
    const full = S.type !== 'intro' && S.type !== 'break';
    // groove: stomps on 1 & 4, claps on the off-beats (3, 6), bodhrán 8ths
    I.drum.stomp(t, 0.75); I.drum.stomp(t + 3 * s, 0.6);
    if (full) { I.drum.clap(t + 2 * s, 0.4); I.drum.clap(t + 5 * s, 0.45); for (let k = 0; k < 6; k++) I.drum.hit(t + k * s + this.hum(3), k % 3 === 0 ? 0.5 : 0.28, { open: k % 3 === 0 }); }
    // guitar boom-chick + plucked bass
    each((c, tt, d) => {
      const v = this.voicing(c, 4, 52, 67, 'gv'), bm = this.bassPitch(c, 38, 50, 'gb');
      I.bass.note(tt, bm - 12 < 33 ? bm : bm - 12, s * 2, 0.55, { art: 'pizz' });
      I.gtr.strum(tt + 2 * s * (d / B), v, 0.4); if (d === B) { I.bass.note(tt + 3 * s, bm + 7 - 12 < 33 ? bm + 7 : bm - 5, s * 2, 0.45, { art: 'pizz' }); I.gtr.strum(tt + 5 * s, v, 0.35, { dir: -1 }); }
      if (full && S.type !== 'verse') I.accL.chord(tt + (d === B ? 3 * s : 0), v.slice(0, 3), s * 2.5, 0.5);
    });
    switch (S.type) {
      case 'intro':
        if (sb === 0) I.low.note(t, 38, B * 2, 0.4, { a: 0.5 });
        if (sb === 1) this.hey(t + 3 * s);
        break;
      case 'verse':
        this.line(I[S.lead], t, this.barSlice(VERSE, sb, 6), { vel: 0.6, hum: 4, legato: 0.9 });
        if (S.lead === 'acc' && sb >= 4) this.line(I.whistle, t, this.barSlice(VERSE, sb, 6), { vel: 0.35, tr: 12, hum: 4, legato: 0.9 });
        if (sb === 7) this.hey(t + 3 * s);
        break;
      case 'chorus': {
        const notes = this.barSlice(CHORUS, sb, 6);
        this.line(I.crew, t, notes, { vel: 0.62, tr: S.tr - 12, a: 0.05, r: 0.2, legato: 0.92 });
        this.line(I.crew, t, notes, { vel: 0.4, tr: S.tr, a: 0.05, r: 0.2, legato: 0.92 });
        this.line(I.fid, t, notes, { vel: 0.46, tr: S.tr + 12, legato: 0.9 });
        if (sb % 2 === 0) I.low.note(t, this.bassPitch(cs[0], 31, 43, 'lowb'), B * 2, 0.36, { a: 0.3 });
        if (sb === 7) this.hey(t + 3 * s);
        break;
      }
      case 'jig':
        this.line(I.fid, t, this.barSlice(S.mel, sb, 6), { vel: 0.58, hum: 3, legato: 0.85 });
        if (sb >= 4) this.line(I.whistle, t, this.barSlice(S.mel, sb, 6), { vel: 0.34, hum: 3, legato: 0.85 });
        break;
      case 'break':
        // stomps and the crew humming the chorus head
        if (sb === 0) this.line(I.crew, t, this.barSlice(CHORUS, 0, 6).concat(this.barSlice(CHORUS, 1, 6).map((n) => ({ ...n, b: n.b + 6 }))), { vel: 0.45, tr: -12, a: 0.1, r: 0.3 });
        if (sb === 3) this.hey(t + 3 * s);
        break;
    }
    if (++this.sb >= S.bars) { this.sb = 0; if (++this.si >= this.form.length) this.plan(); else this.make(); }
    return B;
  }
  hey(t) {
    const I = this.inst;
    for (const m of [50, 57, 62]) I.crew.note(t, m, 0.2, 0.75, { art: 'stacc', d: 0.16 });
    I.drum.clap(t, 0.7); I.drum.stomp(t, 0.8);
  }
}
