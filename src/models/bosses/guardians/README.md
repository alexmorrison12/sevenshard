# Guardian bosses — `src/models/bosses/guardians/`

Seven procedural giant monsters for Guardian Hunts, the Abyssal Dungeon and the field boss. Every body is an SDF sculpt
(kit `Sculpt`: surface nets → skin weights → baked AO → painted vertex colours) plus lofted / faceted rigid parts,
skinned membranes and additive flame / lightning shells, all animated procedurally (kit `Pose` FK + 2-bone IK with a
planted-feet gait for the legged ones). No assets.

Lab: `node tools/lab.mjs src/lab/guardians.js` → `http://localhost:5299/lab/guardians.html`
(`?boss=kurai&act=tail_whip&view=iso|cine|orbit&loop=1&at=1.2&light=day|dusk|dungeon|night` …, header of
`src/lab/guardians.js` lists every param; `window.__g` exposes `boss`, `play`, `set`, `setBoss`, `sim`, `view`).

## API (contract: ARCHITECTURE.md "Bosses")

```js
import { createBoss, BOSSES, preloadBosses, disposeBossCache, bossStats, GUARDIAN_IDS } from './models/bosses/guardians/index.js';

const b = createBoss('rimewing', { scale: 1 });   // opts: scale, selfLift (see Flight), clone (kurai only)
scene.add(b.root);                                // game sets root.position (x, ground y, z) and root.rotation.y = facing
b.update(dt, { speed, turn, dead, groggy, enraged, fly, burrowed, ghost });
const { dur, hits } = b.play('breath', { dur: 3.5 });   // hits: impact moments in seconds from now (scaled with dur)
b.stop(name?)                  // end a loop action (fly / sing / channel / groggy …) or all actions
b.setGlow('counter' | 'enrage' | 'ghost', 0..1)
b.breakPart(name) → bool       // true if it broke now (names: BOSSES[id].parts)
b.isBroken(name) → bool
b.setTint(hex, amount, fade?)  // colour overlay; persistent until changed, or decays to 0 over `fade` seconds
b.dispose()                    // materials + skeleton; geometry stays cached (disposeBossCache() frees it)
```

Instance fields: `root`, `height`, `radius`, `sockets`, `actions` (names), `info` / `meta` (= `BOSSES[id]`),
`altitude` (current internal lift of the body, m: flight > 0, burrow / submerge < 0), `dead`, `meshes`, `U` (shared
material uniforms), `externalLift`. Helpers: `b.socketPos(name, out?)` → world position, `b.socketDir(name, out?)` →
world forward (−Z) of a socket. `b.onEvent = (type, info) => {}` receives `('hit', { action, index })` at hit moments.

`preloadBosses(ids?)` builds geometry ahead (loading screen) and returns build stats; `bossStats()` lists the cache.

### Conventions
- Faces −Z in local space, metres, Y up, the root on the ground. Everything else lives under `root`.
- `update(0, …)` holds the pose exactly (hit-stop). `dt` is clamped to 0.1 s.
- Sockets are `Object3D`s parented to bones and are fresh right after `update()` (the root's world matrix is
  refreshed inside `update`). Forward of a socket is its local −Z (e.g. `mouth` = breath / spit direction,
  `eye` = the Deep Oracle's gaze beam).
- Moving attacks carry `move: { dist, t0, t1 }` in the metadata: the model animates in place; the game translates the
  root forward by `dist` between `t0` and `t1` (canonical seconds — scale like hits) and should pass the root's real
  ground speed as `state.speed` meanwhile so the feet stay planted.
- Up to three meshes share one skeleton: `body` (opaque), `membrane` (double-sided wings / fins) and `flame`
  (additive flames, sandfall, lightning arcs). `flame` never casts or receives shadows and carries
  `userData.noShadow = true` so hosts that force `castShadow` on every mesh can skip it.
- `play('death', { dur })` never runs faster than 80 % of the canonical death (a generic 1.2 s unit death would rush a
  giant's collapse). `play('spawn' | 'knockdown' | 'getup' …)` of unknown names is a harmless no-op.

### State (update)
| key | meaning |
|---|---|
| `speed`, `turn` | m/s along facing, rad/s — drives the gait (walk / run speeds in the action metadata). |
| `dead` | `true` plays `death` (held); a later `true → false` edge revives. `play('death')` also works. |
| `groggy` | dazed layer (counter / stagger break): sagging stance, drooping head, dim eyes. `play('groggy', { dur })` too. |
| `enraged` | faster breathing, restless tail / tentacles, stronger glow + hot rim (also via `setGlow('enrage')`). |
| `fly` 0..1 | rimewing airborne amount (see Flight). |
| `burrowed` 0..1 | sunk below the ground / water: cinderhorn (5 m), sandmaw (17 m), nerissa (7.5 m), deep_oracle (11 m). The burrow / submerge / dive actions animate it and latch; a state 1 → 0 edge releases the latch. |
| `ghost` | translucent ghost look (bool or 0..1), same as `setGlow('ghost', v)`. |

### Flight (rimewing)
With `fly` set the model poses in flight (wings beating, legs tucked, billowing membranes) **and lifts itself** to
`BOSSES.rimewing.flyHeight` (5.5 m) × fly. If the game lifts the root itself while flying (e.g. a `hover` leap), the
model detects it once (root > 1 m above its last grounded height while `fly` > 0) and from then on only poses —
no double altitude. Force either behaviour with `createBoss('rimewing', { selfLift: true | false })`.
`takeoff` / `land` / `dive` animate the transition themselves (and latch airborne), so scripts may drive `fly` or not.

### Actions
`play(name, { dur })` time-stretches the action to `dur` seconds and scales `hits`. Loop actions (`loop: true`) keep
their canonical cycle and run for `dur` seconds (default: until `stop()` / the next action); their hits repeat each
cycle. `idle` cancels everything. `walk` / `run` / `turn` are driven by `state.speed / turn` (`play('walk')` only
previews locomotion in the lab when the state carries no speed).

Every guardian also answers the generic encounter names **`roar`** and **`channel`** (a real action or an alias,
marked `alias` in the metadata) so shared scripts can use them.

`BOSSES[id] = { name, title, height, radius, parts: [...], actions: { name: { dur, hits: [s…], loop?, hold?,
counter?: [t0, t1], move?: { dist, t0, t1 }, speed?, turn?, alias? } }, flyHeight?, wingspan?, length?, burrowDepth? }`
- `counter` = suggested blue counter window (canonical seconds): call `setGlow('counter', 1)` during it.

### Glow / tint
- `counter`: shimmering blue fresnel + rising bands over the whole body (bloom-bright).
- `enrage`: elemental glow boils toward red + hot red rim (also driven by `state.enraged`).
- `ghost`: translucent, desaturated, fresnel-lit (materials switch to transparent while > 0; first use compiles a
  transparent program variant).
- `setTint(0xffffff, 0.6, 0.15)` = hit flash; `setTint(0x9fdcff, 0.45)` = freeze tint (clear with amount 0).

## Guardians
Times are canonical seconds: `name dur [hits]`. All have `idle` (loop), `intro`, `groggy` (loop), `death` (hold),
`roar`, `channel` (loop).

### `rimewing` — Rimewing, Tyrant of the Frozen Sky (ice wyvern · 12 m wingspan · head ≈ 4 m · height 4.4 · radius 3.2)
Knuckle-walks on its folded wing-hands (high bat elbows), flies, dives. Glowing blue throat sac and chest veins,
crystal frost spines, crystal crown, crystal tail blade, dark membranes with frosted edges and glowing veins.
- parts: `wings` (membranes tear), `crest` (crystal crown), `tail` (crystal tail blade)
- sockets: `head`, `mouth` (breath origin/direction), `throat`, `chest`, `back`, `handL/R` (wrists), `wingL/R` (wing
  tips), `weapon` (tail), `weaponTip`/`tail` (blade), `footL/R`, `crest`
- walk 1.35 (3 m/s) · run 0.95 (7.5 m/s) · turn 1.6 · intro 6.0 [3.35 roar] · bite 1.35 [0.62] · claw 1.6 [0.86]
  counter 0.25–0.7 · tail_sweep 2.1 [1.0] (full spin) · breath 3.8 [1.35 1.75 2.15 2.55 2.95] · takeoff 2.4 [0.8] ·
  fly 1.25 loop · dive 2.2 [0.9] move 16 m 0.35–1.3 · pounce 2.2 [1.6] counter 0.1–1.05 move 8 m 1.05–1.55 ·
  land 2.0 [1.15] · ice_spikes 3.1 [1.6 2.15] · wing_gust 2.5 [1.2 1.6] · roar 2.2 [0.9] · channel 2.0 loop [1.0]
  (Absolute Zero: reared, wings high, every crystal blazing) · death 3.6

### `kurai` — Kurai the Pyrefox (nine-tailed fire fox · 5.2 m to the ear tips · radius 2.4)
Ivory-gold fur, charcoal socks, white kitsune mask face with crimson markings and a glowing brow sigil, nine tails that
turn from fur into living flame (emissive core + additive flame shell). `createBoss('kurai', { clone: true })` =
translucent additive flame copy (same actions) for the clone mechanic.
- parts: `tails` (the four outer tails gutter out and hang limp)
- sockets: `head`, `mouth`, `brow`, `chest`, `back`, `handL/R` (fore paws), `weapon` (tail root), `weaponTip` (centre
  tail tip), `tail0` … `tail8` (tail tips — orb spawn points)
- walk 1.6 (3 m/s) · run 0.8 (10 m/s) · intro 6.0 [4.35 howl] · claw 1.2 [0.55] · tail_whip 1.9 [0.9] (spinning
  fan of tails) · fire_orbs 2.3 [0.95 1.3 1.65] · pounce 1.8 [1.12] counter 0.05–0.42 move 12 m 0.5–1.1 ·
  clone 1.9 [0.95] (flame burst: spawn clones at the hit) · foxfire_breath 3.3 [1.05 1.45 1.85 2.25 2.65] ·
  dash 1.0 [0.42] move 14 m 0.18–0.56 · howl 2.7 [1.2] · roar = howl · channel 2.0 loop · death 3.3

### `cinderhorn` — Cinderhorn, the Molten Juggernaut (lava rhino-beetle · 7 m long · 5.2 m to the horn · radius 3.0)
Obsidian plates with molten seams (per-pixel voronoi), beetle carapace, shard spines, pronotum horn over the head and
one huge nasal horn. Sinks into lava and erupts back out (`burrowed`).
- parts: `horn` (a glowing jagged stump remains)
- sockets: `head`, `mouth`, `chest`, `back`, `handL/R`, `footL/R`, `horn`, `weapon` / `weaponTip` (horn), `tail` (club)
- walk 1.8 (2.6 m/s) · run 1.0 (7.5 m/s) · intro 6.0 [1.2 4.2] (erupts from lava, roars) · gore 1.6 [0.78] ·
  charge 3.6 [1.5 2.1 2.7] counter 0.55–1.15 move 20 m 1.25–2.75 · stomp 2.0 [1.05] · lava_spit 2.2 [0.85 1.15 1.45] ·
  burrow 2.4 (→ burrowed) · erupt 2.0 [0.45] · tail_slam 2.2 [1.2] · roar 2.6 [1.0] · channel 2.0 loop · death 3.4

### `sandmaw` — Sandmaw, the Dune Devourer (sand wurm · 16 m long · rears 9.8 m · radius 3.2)
Mostly submerged: the root sits where it breaches; below y = 0 is hidden by the ground. Shingled sandstone armour with a
dark rust saddle banded ring by ring over a pale belly, dorsal chitin spikes, a four-petal beak that blooms into a
ring-toothed glowing maw, sandfall streaming off the plates.
- parts: `mandible` (the upper beak petal is torn away)
- sockets: `head`, `mouth` (maw — spit origin), `chest`, `back`, `base` (breach point), `weapon` / `weaponTip` (beak)
- intro 6.0 [1.0 4.4] · burrow 2.6 [1.3] (→ burrowed) · emerge 2.4 [0.5] · bite 1.9 [1.02] (lunges ~7 m forward and
  down) · tail_sweep 2.6 [1.35] (bows low and scythes its length in an arc) · sand_spit 2.3 [0.95 1.3 1.65] ·
  sandstorm 4.2 [1.4 2.0 2.6 3.2] (towering roar-spin) · roar 2.4 [1.0] · channel 2.4 loop · death 4.0

### `nerissa` — Nerissa of the Drowned Choir (siren · 5.6 m · floats above the water · radius 2.0)
Mask-faced siren in nacre armour (ribbed violet shell bodice, scallop-shell pauldrons with glowing rims), serpentine
tail with glowing fins, bioluminescent hair fronds, branching coral crown, song-runes that pulse with her voice. Dives under the water and resurfaces (`burrowed` = submerged).
- parts: `crown`
- sockets: `head`, `mouth`, `chest`, `back`, `handL/R`, `orb` (between the hands — water orb), `tail`, `weapon` /
  `weaponTip` (fluke), `crown`
- intro 6.0 [4.6] (rises from the water, sings) · sing 2.4 loop [1.2 per cycle] · tail_slap 2.0 [1.05] ·
  water_orb 2.2 [1.25] · dive 3.4 [2.45] move 10 m 1.1–2.2 (submerged in between) · scream 2.6 [0.95 1.35 1.75] ·
  roar = scream · channel = sing · death 4.0 (sinks)

### `deep_oracle` — The Deep Oracle, Eye of the Sunken Abyss (tentacled horror · 7.4 m above the water · radius 3.6)
A ribbed dome with one colossal eye (lids, glowing iris, slit pupil), beaked maw with glowing feelers, bioluminescent
spots, eight tentacles that writhe independently and are driven individually by actions.
- parts: `eye` (bloodied: the iris dims and a lid droops)
- sockets: `head`, `eye` (gaze beam origin, forward = beam direction), `mouth`, `chest`, `back`, `tentacle0` …
  `tentacle7` (tips; 0 = front-right, 7 = front-left, counter-clockwise from above), `handL/R`, `weapon` / `weaponTip`
- intro 6.5 [4.6] (tentacles break the surface, then the dome, then the eye opens) · tentacle_slam 2.4 [1.35] (front
  pair) · tentacle_sweep 2.6 [1.3] (tentacle 1 sweeps the front) · gaze 3.6 [1.2 1.6 2.0 2.4 2.8] · summon 3.0 [1.6] ·
  submerge 2.4 (→ burrowed) · emerge 2.2 [0.6] · roar 2.4 [1.0] · channel 2.4 loop · death 4.5

### `thunderhoof` — Old Thunderhoof, the Storm That Walks (stag-bull field boss · 5.9 m to the antler tips · radius 2.8)
Bison hump under a grizzled mane, silver beard, cloven hooves, two vast antlers whose tines crackle with strobing
lightning arcs, lightning-scarred flanks.
- parts: `antlerL`, `antlerR` (splintered stumps remain)
- sockets: `head`, `mouth`, `chest`, `back`, `handL/R` (fore hooves), `antlerL/R`, `crown` (above the antlers —
  lightning origin), `weapon` / `weaponTip` (right antler)
- walk 1.8 (2.8 m/s) · run 0.95 (8.5 m/s) · intro 6.0 [3.9 bellow] · charge 3.4 [1.45 2.0 2.55] counter 0.45–1.1
  move 20 m 1.2–2.65 · stomp 2.0 [1.05] · lightning_call 3.2 [1.3 1.8 2.3] · gore 1.6 [0.75] · roar 2.2 [0.95] ·
  channel 2.0 loop · death 3.5

## Files
- `index.js` — registry, `BOSSES` (metadata incl. aliases), `createBoss`, preload / cache helpers.
- `core/boss.js` — runtime instance (API above). `core/ctl.js` — action timeline (time-stretch, loops, fades, aliases),
  state smoothing, latches, channels, gait/IK frame. `core/gait.js` — kit gait + per-leg IK weight / paw rest rotation /
  digit re-aim hook. `core/material.js` — guardian shader (surface kinds: skin, hard, crystal, membrane, flame, eye,
  mouth, lava, hair, water, bolt; counter / enrage / ghost / tint / flash / tatter). `core/acc.js` — skinned geometry
  accumulator. `core/geo.js` — lofts, crystals, eyes, grids. `core/build.js` — build + cache.
- `<id>.js` — rig, sculpt, paint, dress (parts), sockets, metadata, breakables. `<id>_anim.js` — gait, base layers,
  actions.

## Performance (M-series laptop, first build; cached afterwards and shared by all instances)
| id | build | tris | bones | draw calls (+shadow) |
|---|---|---|---|---|
| rimewing | ~250 ms | 36k | 45 | 2 (+2) |
| kurai | ~250 ms | 45k | 60 | 2 (+1) |
| cinderhorn | ~170 ms | 54k | 27 | 1 (+1) |
| sandmaw | ~290 ms | 56k | 19 | 2 (+1) |
| nerissa | ~150–250 ms | 38k | 59 | 2 (+2) |
| deep_oracle | ~250 ms | 46k | 71 | 1 (+1) |
| thunderhoof | ~280 ms | 44k | 26 | 2 (+1) |

Build times are headless-Chrome figures and include first-use JIT; all stay under the 600 ms budget and 60k tris.
Per-frame `update` ≈ 0.006–0.02 ms (no allocations in the hot path).
