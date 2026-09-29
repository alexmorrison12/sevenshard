// 'inferno' — Inferno Descent (100 floors): dark and rising. B minor over a chromatic LAMENT bass (B-A#-A-G#-G-F#-E-F#),
// 4/4 at 96 BPM (2.5 s bars). Sections: descend (organ + dark pad + low "oo" choir over the lament, heartbeat taiko,
// a tolling bell) · depths (synth pulse, spiccato, brass swells, riser) · inferno (taiko 3-3-2, brass stabs, organ,
// choir chant, sub) · abyss (booms, drones, a high "oo" cluster). Every full cycle climbs a semitone (the bass keeps
// falling while the music rises), resetting with a big hit after four climbs.
import { Track } from './track.js';
import { Ens, Strings, Organ, Synth, Mallet, Taiko, Timpani, Cymbal, Fx } from './instruments.js';
import { chord, transpose } from './theory.js';

const LAMENT = ['Bm', 'F#/A#', 'Bm/A', 'E/G#', 'G', 'D/F#', 'Em', 'F#'];
const DEPTH_CH = [['Bm', 'Bm', 'G', 'G', 'Em', 'Em', 'F#', 'F#'], ['Bm', 'C', 'Bm', 'A', 'G', 'C', 'F#sus4', 'F#']];
const INF_CH = [['Bm', 'C', 'Bm', 'C', 'G', 'A', 'F#', 'F#'], ['Bm', 'Bm', 'G', 'Em', 'Bm', 'C', 'F#', 'F#']];

export class Inferno extends Track {
  constructor(e, n, t0, seed) {
    super(e, n, t0, seed);
    this.tempo(96, 4);
    this.I('organ', Organ, { rev: 0.6, scale: 0.06 });
    this.I('dpad', Ens, { patch: 'darkpad', rev: 0.55, scale: 0.26 });
    this.I('oo', Ens, { patch: 'choir_oo', rev: 0.65, scale: 0.26 });
    this.I('choir', Ens, { patch: 'choir_ah', rev: 0.5, scale: 0.26, bright: 0.85 });
    this.I('low', Ens, { patch: 'strings', pan: 0.2, rev: 0.35, scale: 0.32, bright: 0.6 });
    this.I('str', Ens, { patch: 'strings', pan: -0.2, rev: 0.45, scale: 0.26, bright: 0.8 });
    this.I('brass', Ens, { patch: 'brass', pan: 0.15, rev: 0.45, scale: 0.24 });
    this.I('horns', Ens, { patch: 'horns', pan: 0.3, rev: 0.5, scale: 0.26 });
    this.I('spc', Strings, { pan: -0.2, rev: 0.25, bright: 0.9 });
    this.I('pulse', Synth, { kind: 'bass', rev: 0.12 });
    this.I('sub', Synth, { kind: 'sub' });
    this.I('bell', Mallet, { kind: 'tubular', pan: 0.25, rev: 0.75, scale: 0.2 });
    this.I('tk', Taiko, { size: 'big', rev: 0.4 });
    this.I('tkm', Taiko, { size: 'mid', pan: 0.2, rev: 0.35 });
    this.I('timp', Timpani, { rev: 0.45 });
    this.I('cym', Cymbal, { rev: 0.5 });
    this.I('fx', Fx, { rev: 0.5 });
    this.cycle = 0; this.climb = 0; this.plan();
  }
  plan() {
    const r = this.rng;
    this.form = this.cycle === 0 ? ['abyss', 'descend', 'depths', 'inferno', 'descend'] : r.pick([['descend', 'depths', 'inferno', 'abyss'], ['depths', 'descend', 'inferno', 'inferno', 'abyss'], ['descend', 'inferno', 'depths', 'inferno']]);
    if (this.cycle > 0) this.climb = (this.climb + 1) % 5; // +1 semitone per cycle, reset after four climbs
    this.dch = r.pick(DEPTH_CH); this.ich = r.pick(INF_CH);
    this.si = 0; this.sb = 0; this.cycle++;
  }
  playBar(bar, t) {
    const I = this.inst, B = this.barDur, s = this.spb;
    const type = this.form[this.si], sb = this.sb, k = this.climb;
    const base = type === 'descend' ? LAMENT : type === 'depths' ? this.dch : type === 'inferno' ? this.ich : ['Bm', 'Bm', 'C', 'Bm', 'Bm', 'Bm', 'C', 'F#'];
    const ch = transpose(base[sb], k), c = chord(ch);
    const bass = 35 + k - ((11 + k - c.bass + 24) % 12); // the lament falls from the (transposed) tonic: B1 A#1 A1 … E1
    const lvl = { abyss: 0.5, descend: 0.7, depths: 0.85, inferno: 1 }[type];
    if (this.si === 0 && sb === 0 && k === 0 && this.cycle > 1) { I.fx.boom(t, 0.8); I.cym.crash(t, 0.7); I.tk.hit(t, 1); }
    // lament bass + low strings (always), organ in descend/inferno
    I.low.note(t, bass, B, 0.4 + 0.15 * lvl, { a: 0.3, r: 0.6 });
    if (type === 'descend' || type === 'inferno') this.pad(I.organ, t, B, ch, { n: 4, lo: 47, hi: 64, vel: 0.5 + 0.2 * lvl, a: 0.06, r: 0.4, key: 'org' });
    switch (type) {
      case 'abyss': {
        if (sb % 4 === 0) { I.fx.boom(this.bt(t, 0.1), 0.55); this.pad(I.dpad, t, B * 4, ch, { n: 3, lo: 47, hi: 62, vel: 0.4, a: 2, r: 2, art: 'pad', key: 'dp' }); }
        if (sb === 2) { const v = this.voicing(ch, 3, 74, 86, 'hi'); for (const m of v) I.oo.note(t, m, B * 4, 0.36, { art: 'swell', a: 3 }); I.oo.note(t, v[0] + 1, B * 4, 0.24, { art: 'swell', a: 3.5 }); }
        if (sb % 2 === 1) I.bell.note(this.bt(t, 2), 59 + k, 1, 0.4);
        I.sub.note(t, 23 + k + 12, B * 0.9, 0.35);
        if (sb === 7) { I.fx.riser(t, B, 0.35); I.timp.roll(this.bt(t, 2), 47 + k, B * 0.5 - 0.05, 0.05, 0.6, { hit: false }); }
        break;
      }
      case 'descend': {
        if (sb % 2 === 0) this.pad(I.dpad, t, B * 2, ch, { n: 3, lo: 50, hi: 65, vel: 0.36, a: 1, r: 1, art: 'pad', key: 'dp' });
        if (sb % 4 === 0) this.pad(I.oo, t, B * 4, ch, { n: 4, lo: 50, hi: 67, vel: 0.42, a: 1.5, r: 1.5, key: 'oo' });
        I.tk.hit(t, 0.55); I.tk.hit(this.bt(t, 0.5), 0.35); // heartbeat
        if (sb === 0 || sb === 4) I.bell.note(t, 59 + k, 1, 0.45);
        if (sb === 7) I.cym.swell(this.bt(t, 1), B - s, 0.4);
        break;
      }
      case 'depths': {
        for (let q = 0; q < 8; q++) I.pulse.note(this.bt(t, q * 0.5), bass + 12, s * 0.4, q % 2 ? 0.42 : 0.6, { open: 4 });
        for (let q = 0; q < 8; q++) I.spc.note(this.bt(t, q * 0.5), bass + 24 + (q === 7 ? 1 : 0), s * 0.4, q % 2 ? 0.36 : 0.5, { d: 0.12 });
        if (sb % 2 === 0) { this.pad(I.horns, t, B * 2, ch, { n: 3, lo: 50, hi: 62, vel: 0.5, art: 'swell', a: 1.5, key: 'hn' }); this.pad(I.choir, t, B * 2, ch, { n: 4, lo: 55, hi: 70, vel: 0.42, a: 1, key: 'ch' }); }
        I.tkm.hit(t, 0.5); I.tkm.hit(this.bt(t, 2), 0.4);
        if (sb === 7) { I.fx.riser(t, B, 0.45); I.cym.swell(t, B, 0.5); I.timp.roll(this.bt(t, 1), 47 + k, B - s - 0.05, 0.1, 0.8, { hit: false }); }
        break;
      }
      case 'inferno': {
        for (const b of [0, 1.5, 3]) I.tk.hit(this.bt(t, b), b === 0 ? 0.95 : 0.75);
        for (let q = 0; q < 8; q++) I.tkm.hit(this.bt(t, q * 0.5), q % 2 ? 0.25 : 0.4);
        for (let q = 0; q < 8; q++) I.spc.note(this.bt(t, q * 0.5), bass + 12 + (q % 4 === 3 ? 1 : 0), s * 0.4, q % 2 ? 0.45 : 0.62, { d: 0.12 });
        if (sb % 2 === 0) { I.sub.note(t, bass - 12 < 24 ? bass : bass - 12, B * 1.9, 0.5); I.timp.hit(t, 47 + k, 0.75); }
        if (sb === 0) { I.cym.crash(t, 0.75); I.fx.boom(t, 0.6); }
        for (const m of this.voicing(ch, 4, 50, 67, 'bst')) { I.brass.note(t, m, s * 0.9, 0.74, { art: 'stab' }); if (sb % 2) I.brass.note(this.bt(t, 2.5), m, s * 0.5, 0.6, { art: 'stab' }); }
        const cv = this.voicing(ch, 3, 57, 72, 'chant');
        for (const sl of [0, 3, 6]) for (const m of cv) I.choir.note(this.bt(t, sl * 0.5), m, s * 0.4, sl === 0 ? 0.62 : 0.46, { art: 'stacc' });
        if (sb === 4) { const top = this.voicing(ch, 1, 74, 83, 'top')[0]; this.line(I.str, t, [{ b: 0, d: 4, m: top }, { b: 4, d: 4, m: top + 1 }], { vel: 0.5, a: 0.3 }); }
        if (sb === 7) { I.cym.swell(this.bt(t, 1), B - s, 0.55); for (let q = 0; q < 8; q++) I.tkm.hit(this.bt(t, 2 + q * 0.25), 0.3 + q * 0.07); }
        break;
      }
    }
    if (++this.sb >= 8) { this.sb = 0; if (++this.si >= this.form.length) this.plan(); }
    return B;
  }
}
