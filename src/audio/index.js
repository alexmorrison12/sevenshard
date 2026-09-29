// SEVENSHARD audio — public entry. Everything is synthesized at runtime with the Web Audio API.
//
//   import { createAudio } from './audio/index.js';
//   const audio = createAudio();                 // unlocks itself on the first user gesture (safe to call early)
//   audio.music('title');                        // remembered until unlocked, then crossfades in
//   audio.sfx('slash', { pos: hero.root.position, vol: 1, pitch: 1 });
//   audio.listener(hero.root.position);          // every frame (the iso camera looks north: +X = screen right)
//   audio.setVolumes({ master: 1, music: 0.8, sfx: 1, ambience: 0.7 });
//
// See README.md for every name and option.
import { Engine, TRACKS } from './engine.js';
import { SFX, SFX_NAMES, LOOP_NAMES, ALIAS } from './sfx/index.js';
import { STINGERS, SONGS, MUSIC_ALIAS } from './music/index.js';
import { AMBIENCE_NAMES, AMBIENCE_ALIAS } from './ambience.js';

export const TRACK_NAMES = Object.keys(TRACKS);
export const STINGER_NAMES = Object.keys(STINGERS);
export const SONG_NAMES = Object.keys(SONGS);
export { SFX_NAMES, LOOP_NAMES, AMBIENCE_NAMES };

const GESTURES = ['pointerdown', 'pointerup', 'mousedown', 'keydown', 'touchstart', 'touchend', 'click'];

export function createAudio(opts = {}) {
  const e = new Engine();
  if (opts.quality) e.setQuality(opts.quality);
  let armed = false;

  function unlock() {
    e.init();
    const ctx = e.ctx;
    if (!ctx) return false;
    if (!ctx._sevenWatch) { ctx._sevenWatch = true; ctx.addEventListener?.('statechange', () => { if (e.ctx === ctx && ctx.state !== 'running' && ctx.state !== 'closed') arm(); }); }
    if (ctx.state === 'running') { disarm(); return true; }
    ctx.resume?.().then(() => { if (ctx.state === 'running') disarm(); }).catch(() => {});
    return false;
  }
  const onGesture = () => { unlock(); };
  function arm() {
    if (armed || typeof window === 'undefined') return;
    armed = true;
    for (const ev of GESTURES) window.addEventListener(ev, onGesture, { capture: true, passive: true });
  }
  function disarm() {
    if (!armed) return;
    armed = false;
    for (const ev of GESTURES) window.removeEventListener(ev, onGesture, { capture: true });
  }
  arm();

  const api = {
    /** true once the AudioContext is running */
    get ready() { return !!e.ctx && e.ctx.state === 'running'; },
    /** Explicit unlock (call from a click/keydown handler); returns true when running. */
    unlock,

    /** One-shot sound. pos {x,y,z} = spatial (distance + screen pan), vol 0..n, pitch = rate multiplier. → handle|null */
    sfx(name, o = {}) { return e.play(name, o); },
    /** Looping sound (channels, auras, fire...) → handle { stop(fade), setPos(p), setVol(v), setPitch(r) } */
    loop(name, o = {}) { return e.loop(name, o); },

    /** Crossfade to a track (null = fade out). o: { fade (s, default 3), then (track after a one-shot) } */
    music(track, o = {}) { e.music(track || null, o); },
    /** Musical jingle over the current music (which dips). → seconds */
    stinger(name, o = {}) { return e.ctx ? e.stinger(name, o) : (STINGERS[name]?.len ?? 0); },
    /** Crossfade the ambience bed to a kind (null = silence). o: { vol } */
    ambience(kind, o = {}) { e.ambience(kind || null, o); },
    /** In-world instrument performance for the Songs feature. o: { pos, vol }. → seconds */
    song(id, o = {}) { return e.ctx ? e.song(id, o) : (SONGS[id]?.len ?? 0); },

    /** Listener position (hero / camera target). yaw optional (radians, 0 = facing north like the game camera). */
    listener(pos, yaw = 0) { e.setListener(pos, yaw); },
    /** Volumes 0..1 (partial updates OK). The UI bus follows sfx unless `ui` is given. */
    setVolumes(v = {}) {
      for (const k of ['master', 'music', 'sfx', 'ambience', 'ui']) if (v[k] != null) e.setVolume(k, v[k]);
      if (v.sfx != null && v.ui == null) e.setVolume('ui', v.sfx);
    },
    get volumes() { return { ...e.vol }; },

    /** Duck music + ambience by amount (0..1) for seconds (big moments). */
    duck(amount = 0.5, seconds = 1.5) { e.duck(amount, seconds); },
    get currentMusic() { return e.currentMusic; },
    get currentAmbience() { return e.amb ? e.amb.kind : (e._pendingAmb ? e._pendingAmb[0] : null); },
    /** 'high' (default) | 'low' — thinner per-note synthesis for weak CPUs */
    setQuality(q) { e.setQuality(q); },
    /** Pre-render loop buffers (e.g. behind a loading screen). */
    prepare(names) { return e.prepare(names); },
    stats() {
      const mu = e.mu, s = e.stats;
      return {
        state: e.ctx ? e.ctx.state : 'locked', voices: e.voices.length, maxVoices: s.maxVoices, played: s.played,
        stolen: s.stolen, dropped: s.dropped, culled: s.culled, loops: e.loops.size, tickMs: +s.tickMs.toFixed(2), tickMax: +s.tickMax.toFixed(2),
        music: e.currentMusic, tracks: mu ? mu.tracks.length : 0, bars: mu ? mu.stats.bars : 0, skipped: mu ? mu.stats.skipped : 0,
        limiterGR: e.lim ? +e.lim.reduction.toFixed(1) : 0,
        latency: e.ctx ? +(((e.ctx.baseLatency || 0) + (e.ctx.outputLatency || 0)) * 1000).toFixed(1) : 0,
      };
    },
    names: { sfx: SFX_NAMES, loops: LOOP_NAMES, music: TRACK_NAMES, stingers: STINGER_NAMES, ambience: AMBIENCE_NAMES, songs: SONG_NAMES,
      aliases: { sfx: { ...ALIAS }, music: { ...MUSIC_ALIAS }, ambience: { ...AMBIENCE_ALIAS } } },
    has(name) { return !!SFX[ALIAS[name] || name]; },
    engine: e,
    dispose() { disarm(); e.dispose(); },
  };
  return api;
}
