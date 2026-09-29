# SEVENSHARD audio (`src/audio/`)

Everything is synthesized at runtime with the Web Audio API — no audio files, no samples, no network.
Owner: audio. Lab: `node tools/lab.mjs src/lab/audio.js` → http://localhost:5299/lab/audio.html

> Status: early drop — API stable; content (full SFX list, all tracks, stingers, songs, ambience) is landing
> incrementally. Unknown names are ignored with a single console warning, so the game can call every name now.

## API

```js
import { createAudio } from './audio/index.js';
const audio = createAudio();     // arms itself: the AudioContext is created/resumed on the first user gesture
```

| call | returns | notes |
|---|---|---|
| `audio.sfx(name, { pos, vol, pitch, pan, delay })` | handle \| null | One-shot. `pos` {x,y,z} (THREE.Vector3 ok) → distance attenuation + screen pan vs the listener. `vol` linear (default 1). `pitch` rate multiplier (default 1; a small random ±3.5 % detune is always added so repeats don't fatigue). `pan` −1..1 for non-spatial. `delay` seconds. Returns null when locked, culled (too far), or voice-limited. Handle: `stop(fade)`, `setPos(p)`, `setVol(v)`. |
| `audio.loop(name, { pos, vol, pitch, fade })` | handle | Looping sound (see `names.loops`). Handle: `stop(fade=0.3)`, `setPos(p)`, `setVol(v)`, `setPitch(r)`. Safe before unlock. |
| `audio.music(track, { fade = 3, then })` | — | Crossfade to a track; `null` fades out. Same track again = no-op. Tracks of one family switch on the next bar without a crossfade. Remembered until unlocked. |
| `audio.stinger(name)` | seconds | Musical jingle over the current music (the music dips, then recovers). |
| `audio.ambience(kind, { vol })` | — | Crossfade the ambience bed to a kind; `null` = silence. Remembered until unlocked. |
| `audio.song(id, { pos, vol })` | seconds | In-world instrument performance (Songs feature). Without `pos` the music dips under it. Returns the duration even while locked. |
| `audio.listener(pos, yaw = 0)` | — | Call every frame with the hero (or camera target) position. The iso camera looks north, so +X = screen right (pan). |
| `audio.setVolumes({ master, music, sfx, ambience, ui })` | — | 0..1 slider values (perceptual curve). Partial updates OK. `ui` follows `sfx` unless given. |
| `audio.duck(amount, seconds)` | — | Manually dip music + ambience (big story beats). Big SFX already duck automatically. |
| `audio.unlock()` | bool | Explicit unlock from a gesture handler (optional; gestures are captured automatically). |
| `audio.ready` | bool | AudioContext running. |
| `audio.currentMusic`, `audio.currentAmbience`, `audio.volumes` | | state |
| `audio.setQuality('high'\|'low')` | | `low` thins per-note synthesis for weak CPUs. |
| `audio.prepare(names?)` | Promise | Pre-bakes loop buffers (loading screen). |
| `audio.stats()` | object | voices, loops, limiter gain reduction, scheduler bars/skips, tick time, latency. |
| `audio.names` | `{ sfx, loops, music, stingers, ambience, songs }` | every valid name |
| `audio.has(name)` | bool | sfx name exists |
| `audio.dispose()` | | |

Named exports: `createAudio`, `SFX_NAMES`, `LOOP_NAMES`, `TRACK_NAMES`, `STINGER_NAMES`, `SONG_NAMES`, `AMBIENCE_NAMES`.

## Names (current)

- **music**: `title`
- **sfx**: `slash`, `impact`, `whoosh`, `ui_click`
- **ambience**: `city`, `meadow`, `forest`, `sea`, `cave`, `lava`, `snow`, `desert`, `void`, `stronghold`

(Full lists land with the next drops; see `audio.names` at runtime.)

## Mixing

Master: 24 Hz HPF → limiter (−2 dBFS) → soft clipper (ceiling ≈ −1.1 dBFS). Music and SFX buses each have their own
transient limiter so drums/impacts never pump the other bus. Big SFX duck the music automatically; stingers dip it.
Per-name voice caps + burst suppression + a global 64-voice cap with priority stealing.
