// Music engine: lookahead scheduler on the audio clock + crossfades + phase changes + stingers + songs.
// Bars are generated when their start time enters the lookahead window (≥ 1.2 s, adaptively larger when the
// timer is starved), so brief main-thread hitches never cause gaps; if a stall exceeds the window, late bars are
// advanced silently instead of bursting. The musical clock is t += barDuration on AudioContext time (no drift).
// Tracks never end (their forms cycle with variation), so "looping" has no seam at all.
// A track whose baked instruments are not ready yet is started when they are (the old one keeps playing).
import { RNG } from '../util.js';
import { TRACK_GAIN } from './mix.js';
import { Title } from './title.js';
import { City } from './city.js';
import { Field } from './field.js';
import { FieldDark } from './field_dark.js';
import { Dungeon } from './dungeon.js';
import { Boss } from './boss.js';
import { Raid } from './raid.js';
import { Sea } from './sea.js';
import { Pip } from './pip.js';
import { Stronghold } from './stronghold.js';
import { Pvp } from './pvp.js';
import { Inferno } from './inferno.js';
import { CutsceneSad, CutsceneHeroic } from './cutscene.js';
import { Victory, Defeat, LevelUp, QuestComplete, Achievement, LegendaryDrop, BossIntro, RaidClear, Wipe } from './stingers.js';
import { Homeward, Tides, Rest, Valor, Sunrise } from './songs.js';
import { getZones, getHits } from './patches.js';

// family: tracks of one family switch phase on the next bar (music('raid') → music('raid_ghost')) instead of fading.
// oneShot: plays once (victory / defeat); `then` continues with another track.
export const TRACKS = {
  title: { make: (e, n, t, s) => new Title(e, n, t, s) },
  city: { make: (e, n, t, s) => new City(e, n, t, s) },
  city_night: { make: (e, n, t, s) => new City(e, n, t, s, null, true) },
  field: { make: (e, n, t, s) => new Field(e, n, t, s) },
  field_dark: { make: (e, n, t, s) => new FieldDark(e, n, t, s) },
  dungeon: { make: (e, n, t, s) => new Dungeon(e, n, t, s) },
  boss: { make: (e, n, t, s) => new Boss(e, n, t, s) },
  raid: { family: 'raid', make: (e, n, t, s) => new Raid(e, n, t, s, 1) },
  raid_ghost: { family: 'raid', make: (e, n, t, s) => new Raid(e, n, t, s, 2) },
  sea: { make: (e, n, t, s) => new Sea(e, n, t, s) },
  pip: { make: (e, n, t, s) => new Pip(e, n, t, s) },
  stronghold: { make: (e, n, t, s) => new Stronghold(e, n, t, s) },
  pvp: { make: (e, n, t, s) => new Pvp(e, n, t, s) },
  inferno: { make: (e, n, t, s) => new Inferno(e, n, t, s) },
  cutscene_sad: { make: (e, n, t, s) => new CutsceneSad(e, n, t, s) },
  cutscene_heroic: { make: (e, n, t, s) => new CutsceneHeroic(e, n, t, s) },
  victory: { oneShot: true, make: (e, n, t, s) => new Victory(e, n, t, s) },
  defeat: { oneShot: true, make: (e, n, t, s) => new Defeat(e, n, t, s) },
};
// zone / data names → canonical tracks (null = silence)
export const MUSIC_ALIAS = { solhaven: 'city', solhaven_night: 'city_night', boss_gorrath: 'raid', gorrath: 'raid', training: 'field', none: null, silence: null };
// overlay pieces: { make, len (nominal seconds), dip (music level under it), hold (s: the next music() waits for this downbeat) }
export const STINGERS = {
  level_up: { len: 3.4, dip: 0.3, make: (e, n, t, s, o) => new LevelUp(e, n, t, s, o) },
  quest_complete: { len: 3.2, dip: 0.35, make: (e, n, t, s, o) => new QuestComplete(e, n, t, s, o) },
  achievement: { len: 3.6, dip: 0.3, make: (e, n, t, s, o) => new Achievement(e, n, t, s, o) },
  legendary_drop: { len: 5, dip: 0.25, make: (e, n, t, s, o) => new LegendaryDrop(e, n, t, s, o) },
  boss_intro: { len: 4.6, dip: 0.15, hold: 3.95, make: (e, n, t, s, o) => new BossIntro(e, n, t, s, o) },
  raid_clear: { len: 9, dip: 0.1, make: (e, n, t, s, o) => new RaidClear(e, n, t, s, o) },
  wipe: { len: 6.5, dip: 0.15, make: (e, n, t, s, o) => new Wipe(e, n, t, s, o) },
};
export const SONGS = {
  homeward: { len: 9.3, name: 'Hymn of Homeward', make: (e, n, t, s, o) => new Homeward(e, n, t, s, o) },
  tides: { len: 9.6, name: 'Serenade of Tides', make: (e, n, t, s, o) => new Tides(e, n, t, s, o) },
  rest: { len: 10, name: 'Lullaby of Rest', make: (e, n, t, s, o) => new Rest(e, n, t, s, o) },
  valor: { len: 8.8, name: 'Ballad of Valor', make: (e, n, t, s, o) => new Valor(e, n, t, s, o) },
  sunrise: { len: 9.2, name: 'Song of Sunrise', make: (e, n, t, s, o) => new Sunrise(e, n, t, s, o) },
};

// patches baked in the background right after unlock (most tracks use them)
const WARM_ZONES = ['strings', 'choir_ah', 'horns', 'brass', 'timpani', 'celesta'];
const WARM_HITS = ['taiko_big', 'taiko_mid', 'taiko_small', 'crash', 'swell', 'boom'];

export class MusicEngine {
  constructor(a) {
    this.a = a; this.ctx = a.ctx; this.tracks = []; this.cur = null; this.want = null;
    this.baseHorizon = 1.2; this.horizon = 1.2;
    this.rng = new RNG(a.seed ^ 0x5bd1e995);
    this.stats = { bars: 0, skipped: 0, minLead: Infinity, maxTimerGap: 0, horizon: 1.2 };
    this.log = false; this._wall = 0;
  }
  get currentName() { return this.cur ? this.cur.name : (this.want ? this.want.name : null); }
  // background bake of the common patches (returns a promise)
  warm() {
    const ps = [];
    for (const z of WARM_ZONES) { const r = getZones(this.a, z); if (r.promise) ps.push(r.promise); }
    for (const h of WARM_HITS) { const r = getHits(this.a, h); if (r.promise) ps.push(r.promise); }
    return Promise.all(ps);
  }
  // construct a track without playing it and wait for its baked instruments (offline analysis / loading screens)
  async prepare(name) {
    if (name in MUSIC_ALIAS) name = MUSIC_ALIAS[name];
    const def = TRACKS[name] || STINGERS[name] || SONGS[name]; if (!def) return;
    const tr = def.make(this, name, this.ctx.currentTime, 1);
    await Promise.all(tr.pending); tr.dispose();
  }
  play(name, { fade = 3, then = null, seed = null } = {}) {
    const now = this.ctx.currentTime;
    if (name in MUSIC_ALIAS) name = MUSIC_ALIAS[name];
    if (then in MUSIC_ALIAS) then = MUSIC_ALIAS[then];
    if (!name) { this.want = null; if (this.cur) { this.cur.fadeOut(now, fade); this.cur = null; } return; }
    const def = TRACKS[name];
    if (!def) { console.warn('[audio] unknown track', name); return; }
    if (this.cur && !this.cur.stopping && !this.want) {
      if (this.cur.name === name) return;
      if (def.family && this.cur.family === def.family && this.cur.setPhase) { this.cur.setPhase(name); this.cur.name = name; return; }
    }
    if (this.want && this.want.name === name) return;
    const tr = def.make(this, name, now + 0.08, seed ?? ((this.rng.next() * 4294967296) >>> 0));
    tr.family = def.family || null; tr.then = then; tr.oneShot = !!def.oneShot;
    tr.out.gain.value = tr.rev.gain.value = TRACK_GAIN[name] ?? TRACK_GAIN[tr.mixKey] ?? 1;
    this.want = tr;
    const go = () => { if (this.want !== tr) { tr.dispose(); return; } this.want = null; this._start(tr, fade); };
    if (tr.pending.length) Promise.all(tr.pending).then(go, (e) => { console.error('[audio] track failed', name, e); if (this.want === tr) this.want = null; });
    else go();
  }
  _start(tr, fade) {
    const now = this.ctx.currentTime;
    // a holding stinger (boss_intro) is still leading in: the new track enters right on its downbeat
    const hold = this.holdUntil && this.holdUntil > now + 0.1, t0 = hold ? this.holdUntil : now + 0.08;
    if (hold) fade = Math.min(fade, 0.25);
    tr.restart(t0);
    if (tr.oneShot) { tr.fadeIn(t0, 0.01); if (this.cur) this.cur.fadeOut(now, Math.min(fade, 0.8)); }
    else { tr.fadeIn(t0, fade); if (this.cur) this.cur.fadeOut(now, fade); }
    this.cur = tr; this.tracks.push(tr);
    this.tick();
  }
  // Overlay a one-shot piece (stinger / song) on top of the current music, which dips while it plays.
  // Returns the piece's nominal duration in seconds (known before its samples are ready).
  overlay(def, name, { dip = 0.3, vol = 1, out = null } = {}) {
    const now = this.ctx.currentTime;
    const tr = def.make(this, name, now + 0.05, (this.rng.next() * 4294967296) >>> 0, out);
    tr.out.gain.value = tr.rev.gain.value = (TRACK_GAIN[name] ?? TRACK_GAIN[tr.mixKey] ?? 1) * vol;
    tr.overlay = true;
    const go = () => {
      const t0 = this.ctx.currentTime + 0.05;
      tr.restart(t0); tr.fadeIn(t0, 0.01); this.tracks.push(tr);
      tr.schedule(t0 + 60);
      const dur = Math.max(0.1, tr.length || tr.until - t0);
      const cur = this.cur;
      if (dip < 1 && cur && !cur.stopping && cur !== tr) { cur.setLevel(dip, this.ctx.currentTime, 0.25); cur._restoreAt = Math.max(cur._restoreAt || 0, t0 + dur - 0.8); }
    };
    if (tr.pending.length) Promise.all(tr.pending).then(go); else go();
    return def.len ?? tr.length ?? 4;
  }
  stinger(name, o = {}) {
    const def = STINGERS[name];
    if (!def) { console.warn('[audio] unknown stinger', name); return 0; }
    const len = this.overlay(def, name, { dip: def.dip ?? 0.25, ...o });
    if (def.hold) this.holdUntil = this.ctx.currentTime + 0.05 + def.hold; // the next music() lands on its downbeat
    return len;
  }
  // o.pos: another player performing somewhere in the world → distance + pan (no music dip unless close)
  song(id, o = {}) {
    const def = SONGS[id];
    if (!def) { console.warn('[audio] unknown song', id); return 0; }
    let out = null, dip = 0.35;
    if (o.pos) {
      const sp = this.a._spatial(o.pos, 60, 6);
      if (sp.g < 0.01) return def.len;
      const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(), pn = ctx.createStereoPanner();
      g.gain.value = sp.g; lp.type = 'lowpass'; lp.frequency.value = sp.lp; pn.pan.value = sp.pan;
      g.connect(lp); lp.connect(pn); pn.connect(this.a.bus.music.in); out = g;
      dip = sp.g > 0.6 ? 0.6 : 1;
      setTimeout(() => { try { pn.disconnect(); } catch (e) { /* noop */ } }, (def.len + 6) * 1000);
    }
    return this.overlay(def, id, { dip, vol: o.vol ?? 1, out });
  }
  tick() {
    const now = this.ctx.currentTime;
    if (!this.a.offline) {
      const w = performance.now();
      if (this._wall) {
        const gap = (w - this._wall) / 1000;
        if (gap > this.stats.maxTimerGap) this.stats.maxTimerGap = gap;
        // grow the lookahead quickly when the timer is starved (background tab / long frames), shrink slowly
        this.horizon = gap * 2.2 > this.horizon ? Math.min(4, gap * 2.2) : Math.max(this.baseHorizon, this.horizon - 0.01);
      }
      this._wall = w; this.stats.horizon = this.horizon;
    }
    let next = null;
    for (const tr of this.tracks.slice()) {
      if (!tr.ended) tr.schedule(now + this.horizon);
      else for (const i of tr.insts) i.sweep(now);
      if (tr._restoreAt && now >= tr._restoreAt) { tr._restoreAt = 0; if (!tr.stopping) tr.setLevel(1, now, 1.2); }
      if (tr === this.cur && tr.ended && tr.then && !tr.thenStarted && now > tr.until - 2) { tr.thenStarted = true; next = tr.then; }
      if ((tr.stopping && now > tr.stopAt + 0.2) || (tr.ended && now > tr.until + 0.3)) {
        tr.dispose(); this.tracks.splice(this.tracks.indexOf(tr), 1);
        if (this.cur === tr) this.cur = null;
      }
    }
    if (next) { if (this.cur && this.cur.ended) this.cur = null; this.play(next, { fade: 2 }); }
  }
}
