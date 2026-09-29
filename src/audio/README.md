# SEVENSHARD audio (`src/audio/`)

Everything is synthesized at runtime with the Web Audio API — no audio files, no samples, no network.
Owner: audio. Lab: `node tools/lab.mjs src/lab/audio.js` → http://localhost:5299/lab/audio.html

```js
import { createAudio } from './audio/index.js';
const audio = createAudio();        // arms itself: the AudioContext is created/resumed on the first user gesture
audio.music('title');               // remembered until unlocked, then crossfades in
audio.listener(hero.root.position); // every frame
audio.sfx('slash', { pos: hero.root.position });
```

## API (`index.js`)

| call | returns | notes |
|---|---|---|
| `createAudio({ quality })` | api | `quality: 'high'` (default) \| `'low'`. Listens for `pointerdown/pointerup/mousedown/keydown/touchstart/touchend/click` (capture) and unlocks on the first one; re-arms itself if the browser suspends the context. |
| `audio.sfx(name, { pos, vol, pitch, pan, delay, ...extra })` | handle \| null | One-shot. `pos` {x,y,z} (THREE.Vector3 ok) → distance attenuation, air absorption and **screen-space pan** vs the listener. `vol` linear (1). `pitch` rate multiplier (1); every play also gets a small random detune (±3.5 %, recipe-tuned) and randomized internals, so repeats never sound identical. `pan` −1..1 for non-spatial. `delay` seconds. Extra keys go to the recipe (e.g. `{ final: true }` for `pvp_countdown`). Returns null when locked, culled (beyond the sound's range) or voice-limited. Handle: `stop(fade)`, `setPos(p)`, `setVol(v)`. |
| `audio.loop(name, { pos, vol, pitch, fade })` | handle | Looping sound (`names.loops`). Handle: `stop(fade = 0.3)`, `setPos(p)`, `setVol(v)`, `setPitch(r)`. Safe before unlock (starts on unlock). |
| `audio.music(track, { fade = 3, then })` | — | Crossfade to a track; `null` (or `'none'`) fades out. Same track again = no-op. Tracks of one family (`raid` ⇄ `raid_ghost`) switch on the next bar with a transition fill instead of a crossfade. One-shot tracks (`victory`, `defeat`) end by themselves; `then: 'city'` continues with another track. If the track's instruments are still baking (first use, ≈0.3–1 s) the current music keeps playing until it can start. Remembered until unlocked. |
| `audio.stinger(name)` | seconds | Musical jingle over the current music (the music dips, then recovers). |
| `audio.ambience(kind, { vol, mix })` | — | Crossfade the ambience bed to a kind; `null`/`'none'` = silence. `mix` overrides single beds 0..1, e.g. `ambience('city', { mix: { gulls: 0.9 } })` near the harbour. Remembered until unlocked. |
| `audio.song(id, { pos, vol })` | seconds | In-world instrument performance (Songs feature). Without `pos` (you are playing) the music dips under it; with `pos` (someone else nearby) it is spatialised like an SFX. Returns the duration even while locked. |
| `audio.listener(pos, yaw = 0)` | — | Call every frame with the hero (or camera target). The iso camera looks north, so +X is screen-right (pan). |
| `audio.setVolumes({ master, music, sfx, ambience, ui })` | — | 0..1 slider values (perceptual curve, gain = v²). Partial updates OK. `ui` follows `sfx` unless given. `audio.volumes` reads them back. |
| `audio.duck(amount, seconds)` | — | Manually dip music + ambience (story beats). Big SFX and stingers already duck/dip automatically. |
| `audio.unlock()` | bool | Explicit unlock from a gesture handler (optional). `audio.ready` = context running. |
| `audio.currentMusic`, `audio.currentAmbience` | string \| null | canonical names |
| `audio.prepare(names?)` | Promise | Loading-screen pre-bake: any mix of SFX loop names, tracks / stingers / songs (bakes their instruments so they start instantly) and ambience kinds, e.g. `prepare(['boss', 'boss_intro', 'sea'])`. No argument = all SFX loops. No-op while locked. |
| `audio.setQuality('high' \| 'low')` | — | `low` thins some live synthesis for weak CPUs. |
| `audio.stats()` | object | `state, voices, maxVoices, played, stolen, dropped, culled, loops, tickMs, tickMax, music, tracks, bars, skipped, limiterGR, latency` |
| `audio.names` | object | `{ sfx, loops, music, stingers, ambience, songs, aliases: { sfx, music, ambience } }` — every valid name |
| `audio.has(name)` | bool | sfx name (or alias) exists |
| `audio.engine`, `audio.dispose()` | | internals (lab) / teardown |

Named exports: `createAudio`, `SFX_NAMES`, `LOOP_NAMES`, `TRACK_NAMES`, `STINGER_NAMES`, `SONG_NAMES`, `AMBIENCE_NAMES`.
Unknown names are ignored with a console warning (once per name for sfx).

## Music (`audio.music`)

All original compositions built on shared leitmotifs (`music/motifs.js`): **HERO** (the horn call — rising 5th + 4th,
answered, sequenced a third higher), **SHARD** (seven glittering celesta notes) and the lyrical **B** theme.
Every track is a generative arrangement over written themes: its form cycles with reshuffled sections, generated
counter-lines and new ostinati, so it never ends and never repeats exactly (no loop seam exists). Cycle lengths ≥ 90 s.

| track | character |
|---|---|
| `title` | Main theme. D minor, 80 BPM. Intro (drone + SHARD motif) → HERO on solo horn → violins + counter-line + choir → B theme (strings + choir) → tutti (brass, choir, taiko) → Bb–C–D major cadence; later cycles add a development section. |
| `city` | Solhaven: G major 6/8 lilt — lute strums, recorder/flute tune, fiddle B-tune, a grand "square" statement, lute "market" solo, harp "evening". |
| `city_night` | Solhaven at night: the city tune's evening arrangement, softer, flute-led, no bustle. |
| `field` | Adventurous: D major/Mixolydian, 108 BPM — 16-bar horn "Road" theme over a spiccato march, lyrical strings "Plains", woodwind "Trail", tutti reprise. |
| `field_dark` | Thornwood/Ashen Ridge: C minor/Phrygian, 84 BPM — creeping ostinati, bassoon motif, tremolo clusters, "oo" choir, taiko threat, celesta hollows. |
| `dungeon` | Chaos rift: E Phrygian, 120 BPM — 16th synth bass + sub, pluck arpeggiator, dark pad, choir chants, brass stabs, taiko; pulse → build → drop → break. |
| `boss` | Guardian hunt: D minor, 140 BPM — taiko 3-3-2, spiccato ostinati, brass stabs, hunting-horn "Guardian" motif, choir chants, brass-vs-strings duel. |
| `raid` / `raid_ghost` | Gorrath: F minor, 150 BPM — chromatic "Tyrant" motif in low brass, choir chants, the heroes answer with the HERO call. `raid_ghost` (switch any time while `raid` plays) = ghost phase: a transition fill lifts everything a semitone and +6 BPM and adds a second intensity layer (ghostly "oo" clusters, high tremolo, 16th percussion, sub pulses); `music('raid')` returns. |
| `sea` | Sailing shanty: D dorian 6/8 — accordion/whistle verse, crew-sung chorus with fiddle, stomps, claps, "hey!" shouts, fiddle jig; later choruses lift a whole step. |
| `pip` | Pipsprout Hollow: F major bounce — staccato bassoon oom-pah, clarinet tune with chromatic neighbours, comic bassoon tune, xylophone, woodblock, dreamy garden interlude. |
| `stronghold` | Home: Eb major 3/4, calm — "Hearth" tune for flute/clarinet/violins, fingerpicked guitar, harp, celesta window. |
| `pvp` | Tense: A minor, 128 BPM — ticking clock, synth pulse, 3-3-2 spiccato, half-step brass menace, a surge climbing in sequence. |
| `inferno` | Descent: B minor over a chromatic lament bass, organ, choir, bells; each cycle climbs a semitone while the bass keeps falling. |
| `cutscene_sad` | The HERO call broken on solo cello, oboe memory with the SHARD motif, violins + choir weeping. |
| `cutscene_heroic` | The HERO theme reborn in D major: rise → resolve → march (the call climbing through the orchestra over spiccato + snare) → triumph (tutti, choir, taiko) → Bb–C–D glory. |
| `victory` | One-shot fanfare (≈8 s): the call in D major → tutti → plagal amen → SHARD glitter. Use `then` to continue. |
| `defeat` | One-shot (≈8 s): tolling bell, the call falling in minor. |

Aliases (zone / data names): `solhaven`→`city`, `solhaven_night`→`city_night`, `boss_gorrath`/`gorrath`→`raid`,
`training`→`field`, `none`/`silence`→ stop.

## Stingers (`audio.stinger`) — returns seconds

`level_up` (3.4 s), `quest_complete` (3.2), `achievement` (3.6), `legendary_drop` (5, the SHARD motif in gold),
`boss_intro` (4.6: crushing hit → dark swell for the name reveal → lead-in), `raid_clear` (9: the full call in major,
tutti, Bb–C–D), `wipe` (6.5). The current music dips under them and recovers.
`boss_intro` holds the next `music()` call: `stinger('boss_intro'); music('boss')` makes the fight music enter exactly
on the stinger's closing downbeat (≈3.95 s) instead of playing over it.

## Songs (`audio.song`) — returns seconds

| id | song | character |
|---|---|---|
| `homeward` | Hymn of Homeward | G major 3/4 hymn: a rising "home" arpeggio and a gentle descent (≈9.3 s) |
| `tides` | Serenade of Tides | D dorian 6/8: harp waves under a swelling lute line (≈9.6 s) |
| `rest` | Lullaby of Rest | F major 3/4, slow: celesta + harp, a falling rock-a-bye line (≈10 s) |
| `valor` | Ballad of Valor | D minor → major: the main theme's call over bold lute strums (≈8.8 s) |
| `sunrise` | Song of Sunrise | C Lydian: an ascending line with the bright raised 4th, harp glitter (≈9.2 s) |

## Ambience (`audio.ambience`)

Kinds (layered beds, subtle, calibrated): `city` (crowd murmur, merchant calls, carts, the smithy, gulls, distant
bells), `city_quiet`, `city_night` (distant tavern, crickets, owls, bells), `meadow` (birds, wind, grasshoppers, bees),
`forest` (crows, owls, creaking trees, twig snaps), `night` (crickets, frogs, owls), `sea` (waves, wind, creaking hull,
sloshing, ropes, gulls), `cave` (drips, stone knocks, rumbles), `lava` (bubbling, bursts, rumble), `snow` (howling
resonant wind, ice cracks), `desert` (hissing sand gusts, dry wind), `void` (beating drones, pulses, whispers),
`stronghold` (birds, stream, distant shore, gulls).
Aliases: `none`/`silence`→ off, `solhaven`/`town`/`harbor`/`harbour`→`city`, `dungeon`→`cave`, `rift`→`void`,
`field`→`meadow`, `ocean`→`sea`.
Beds for `mix` overrides: `birds wind water crickets fire tavern cave lava waterfall crowd gulls bells waves hull
insects darkbirds nightbirds creaks howl sand drones whispers`.

## SFX (`audio.sfx`) — 125 names + aliases

- **ui** (flat, not ducked): `ui_click ui_hover ui_tab ui_open ui_close ui_error notification quest_accept
  quest_complete level_up telegraph_warn raid_warning pvp_countdown victory_horn` (+ `identity_ready`,
  `honing_*`, `stone_facet_*` are also flat UI-bus sounds). `pvp_countdown` takes `{ final: true }` for the GO tone.
- **combat**: `whoosh whoosh_big slash slash_heavy greatsword blade impact impact_heavy crit punch punch_heavy kick
  monster_hit block counter stagger_break part_break knockdown getup dash gun gunshot_heavy gun_dual shotgun rifle
  reload chain spike claw stomp ground_crack shockwave explosion explosion_big meteor`
- **skills**: `magic_cast cast fire fire_big fire_burst ice frost ice_shatter lightning thunder holy holy_big dark
  demon void vanish chi harp harp_big note shield heal buff debuff portal_open portal_enter teleport awaken
  identity_ready identity_burst revive death_player enrage ghost_slam ghost_wail`
- **creatures**: `monster_die demon_die imp_screech hound_growl roar charge_roar boss_roar boss_roar_big pip_squeak pip_cheer`
- **movement / life**: `footstep_stone footstep_grass footstep_snow dig chop mine gather`
- **loot**: `coin loot_drop loot_rare loot_legendary chest_open door_open`
- **travel**: `mount_summon horse_gallop ship_bell cannon wave_splash sail_flap fishing_cast fishing_bite fishing_reel bell`
- **crafting**: `honing_hammer honing_success honing_fail stone_facet_success stone_facet_fail`
- **loops** (`audio.loop`): `channel spin fire_loop horse_gallop` (all also playable as one-shots)
- **aliases**: `gunshot`→`gun`, `blink`→`teleport`

Signature moments: `counter` (two metal clangs a fifth apart + thud + zing), `stagger_break` (glass-shatter boom with a
crystalline chord), `loot_legendary` (riser → golden brass/choir hit → Lydian bell cascade → glitter), `awaken`
(1.4 s rising power → massive boom), `honing_success` / `honing_fail` (a sympathetic muted-brass sag, not a joke).
Big sounds duck the music automatically (`duck` in the recipe).

## Mixing

- Graph: voices → bus (`music`, `sfx`, `ambience`, `ui`) → bus EQ → duck → volume → per-bus transient limiter (music,
  sfx) → mix → 24 Hz HPF → master limiter (−2 dBFS) → soft clipper (ceiling ≈ −1.1 dBFS).
- One shared hall reverb (generated mono IR, decorrelated wide return); SFX get cheap early reflections + a quieter
  hall send.
- Loudness: every SFX calibrated to a per-class momentary target (`sfx/levels.js`, `TARGETS`/`LEVELS`), every music
  track to an integrated target and every instrument stem to a target level relative to its mix (`music/mix.js`),
  every ambience bed to a design level (`ambience.js`).
- Voice limiting: per-name `max` + burst suppression (`burst` starts per `gap` s) + a global 64-voice cap with
  priority stealing. Distance: full volume inside `ref` (≈4 m), ref/(ref+0.8(d−ref)) roll-off, fade to 0 at `range`
  (28–400 m by sound), distance low-pass, screen-space pan.
- Ducking: SFX with `duck` dip music (and ambience a little); stingers dip music then restore; own songs dip music.

## Performance

- Music is scheduled ≥1.2 s ahead on the audio clock (adaptive up to 4 s when the timer is starved); if the main
  thread stalls longer, late bars are skipped silently (never bursts). No drift.
- Lush patches (7-voice supersaw string section, formant choirs, pads, brass/horn sections, tuned percussion, all
  drums/cymbals/booms) are **baked once per session** into looped multi-zone buffers (`music/bake.js`,
  `music/patches.js`); a note is then ≈2 nodes. Common patches bake in the background right after unlock (≈1 s).
- Instrument buses connect only while they have sounding notes; filter/LFO automation runs at k-rate; every
  finished note / SFX voice / ambience event is disconnected from its bus on the next tick (the render graph never
  grows during a long session).
- CPU / memory numbers: see the end of this file.

## Files

`index.js` (API) · `engine.js` (context, buses, voices, spatial, loops) · `kit.js` (SFX node toolkit) · `util.js` ·
`sfx/*` (recipes + levels) · `ambience.js` · `music/index.js` (scheduler, registry, stingers, songs) · `music/track.js`
· `music/instruments.js` · `music/bake.js` · `music/patches.js` · `music/theory.js` · `music/motifs.js` ·
`music/<track>.js` · `analysis.js` (offline render + BS.1770 loudness / spectrum / spectrogram; lab only).

## Lab (`src/lab/audio.js`)

Buttons for every track (incl. raid⇄ghost phase and victory→city), stinger, song, ambience kind, SFX and loop;
volume sliders; live meters (waveform, spectrum, L/R peak/RMS, limiter GR) and a status line (voices, tick time,
latency, baked MB, audio-thread load when the browser exposes `renderCapacity`); 3D position pad; stress and hitch
tests; offline render + analysis with spectrogram and WAV export. Headless automation on `window.__lab`:
`music(name, s, {png, log})`, `cpu(name, s)`, `stems(name, s)`, `autoMix`, `trackGain`, `clashes(name, s)`,
`roll(name, s)`, `sfxReport(names)`, `calibrate(TARGETS)`, `ambCal(targets)`, `loopSeams()`, `bench(cls, opts, fn)`,
`spec(kind, name, s)`, `sheet(items)`, `show(dataURL)`.

## Measured (lab, offline renders driven by the real tick; min of 3; M-series Mac under heavy load from other agents)

Audio-thread cost as % of one core, including the shared hall reverb (≈1.5 % whenever anything sounds):

| | % | | % |
|---|---|---|---|
| idle engine (nothing playing) | 0.5 | `title` | 4.7 |
| `city` / `city_night` | 5.1 / 4.0 | `field` / `field_dark` | 5.3 / 3.8 |
| `dungeon` | 4.6 | `boss` | 4.8 |
| `raid` / `raid_ghost` | 5.1 / 7.8 | `sea` / `pip` | 4.0 / 3.2 |
| `stronghold` / `pvp` | 3.4 / 3.9 | `inferno` | 3.4 |
| `cutscene_sad` / `cutscene_heroic` | 3.3 / 4.4 | `victory` / `defeat` | 4.7 / 3.9 |
| city music + city ambience | 7.2 | boss + cave ambience + 20 SFX/s | 9.2 |
| raid ghost phase + 20 SFX/s | 10.5 | 40 SFX/s, nothing else | 10.7 |

- Main thread: the 50 ms tick is typically well under 1 ms (max 5.5 ms observed, when a new track is constructed).
  Music is scheduled ≥ 1.2 s ahead; ten 400 ms main-thread stalls in 20 s caused no skipped bars (lead stayed ≥ 1.03 s).
- Real-time run (title → city → combat → level_up → boss_intro + boss → raid → ghost phase → big SFX → songs →
  victory → city → silence): no dropouts, peak −1.6 dBFS, 0 clipped blocks. First sound 0.76 s after the first
  `music('title')` (includes baking the title's instruments).
- Baked sample memory: ≈ 25–35 MB for a typical session, 44 MB if every patch is used (strings, 2 choirs, pads,
  brass/horn sections, 8 tuned-percussion sets, 20 drum/cymbal/fx banks).
- Loudness (integrated, music bus at volume 1): calm cues −23…−25 LUFS, exploration −21…−22, action −18…−19
  (`raid_ghost` −16, it is the extra-intensity layer); stingers −13.5…−17 momentary-max; own songs ≈ −21;
  ambience kinds −29…−37 (subtle); SFX from −34 (`ui_hover`) to −10 (`awaken`) momentary-max at the listener.

## Known issues / notes

- The first use of a track, stinger or song bakes its instruments (≈0.3–1 s, off the audio thread); the current music
  keeps playing until it can start. Use `audio.prepare([...])` behind loading screens to avoid even that.
- Firefox has no `AudioParam.automationRate` (k-rate optimisation silently skipped → somewhat higher CPU); Safari is
  untested. Chrome is the reference.
- "Gulls near water" and similar local details are exposed as bed overrides: `ambience('city', { mix: { gulls: 1 } })`.
- All tuning was done by objective analysis (BS.1770 loudness, spectra, harmonic-clash detection, piano rolls,
  spectrograms, loop-seam and CPU measurements) — there was no listening pass.
