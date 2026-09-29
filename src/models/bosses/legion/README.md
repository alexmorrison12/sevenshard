# models/bosses/legion — Legion bosses

Procedural legion bosses: SDF-sculpted (kit/sdf.js → surface nets → one skinned mesh with baked AO and painted vertex
colours), procedurally animated (gait IK, keyframed actions with weapon IK, spring secondary motion) and dressed with
world-space ambient particles. Contract: ARCHITECTURE.md → "Bosses". Lab: `node tools/lab.mjs src/lab/legion.js` →
`http://localhost:5299/lab/legion.html` (see "Lab" below).

```js
import { createBoss, BOSSES, preloadBosses, disposeBossCache, bossStats, BOSS_IDS } from './models/bosses/legion/index.js';

preloadBosses(['gorrath']);                 // optional: build + cache geometry during loading (returns build stats)
const b = createBoss('gorrath', { impactFx: true });
scene.add(b.root);                          // game owns root.position / root.rotation.y (models face −Z, like heroes)
b.update(dt, { speed, turn, dead, groggy, enraged, ghost, combat });   // every frame; dt = 0 holds the pose (hit-stop)
const { dur, hits } = b.play('axe_cleave', { dur: 2.2 });             // hits: impact moments in seconds (scaled)
b.setGlow('counter', 1);  b.breakPart('hornL');  b.setTint(0xffffff, 0.6);  b.dispose();
```

## Exports
| export | description |
|---|---|
| `createBoss(id, opts)` | new instance; geometry is built once per id and cached (build ≈ 75–120 ms per boss, Gorrath ≈ 190 ms; ≈ 2× that on a cold JIT). `opts.impactFx` (default true): built-in dust/sparks at hit moments, landings and falls. `opts.autoGlow` (default true): actions with a `counter` window show the blue shimmer themselves; `false` = only `setGlow('counter')`. |
| `BOSSES` | `{ [id]: { name, title, height, radius, walkSpeed, runSpeed, actions: { [name]: { dur, hits, counter?, active?, move?, stretch?, sustain?, hold? } } } }` — pure data (no meshes built). `counter` = the self-driven blue window [t0, t1]; `active` = damage windows; `move` = root travel the encounter should perform `[{ t:[t0,t1], dist (m or 'target'), height? (root arc of B.leap) }]`; `stretch` = the segment that absorbs a longer/shorter `dur`; `sustain` = the loop segment used by `state.groggy`. All times in seconds at the default `dur`. |
| `preloadBosses(ids?)` | builds and caches geometry; returns `[{ id, ms, tris, verts, bones, … }]`. |
| `disposeBossCache()` | frees cached geometry (instances created later rebuild it). |
| `bossStats()` · `BOSS_IDS` · `registerBoss(id, def)` | cache stats · `['gorrath','skarn','vesk','varkhul','ashmaw','gatekeeper']` · add/replace a definition. |

## Instance
| member | description |
|---|---|
| `root` | `THREE.Object3D` — add to the scene; set `position` / `rotation.y` (facing). Model faces −Z. Children: `pivot` (scaled model), two world-space particle pools, weapon trails, horn debris. |
| `height`, `radius`, `meta` | metres; `meta` = this boss's `BOSSES` entry (`meta.actions[name].dur/hits`). |
| `sockets` | `Object3D`s: `head, mouth, chest, back, handR, handL, weapon, weaponTip, feet…` + per-boss extras (below), `parts: { hornL, hornR }` (Gorrath). Weapon sockets ride on the weapon, also while it flies or lies on the ground. |
| `update(dt, state)` | `dt` is clamped to [0, 0.1] s. `state = { speed (m/s along facing), turn (rad/s), dead, groggy, enraged, ghost (0..1), combat (default true) }` (other keys ignored). Gait with planted feet (walk → run blend), idle life (breathing, look-around, snorts), springs (capes, tails, chains, tabards, flail), glow smoothing, particles, trails. **`dt = 0` holds the exact pose.** `dead: true` plays `death` and holds; true→false revives (and returns dropped weapons). `groggy: true` plays `groggy` and loops its `sustain` segment until false, then it gets up. `enraged` → persistent enrage glow. `ghost` → spectral form (translucent, no shadow). Actions with a `gait` hint (charges) run the legs even when `speed` is 0. |
| `play(name, { dur, dist })` | one-shot action → `{ dur, hits }`; `dur` stretches the move (uniformly, or only the `stretch` segment), `hits` scale with it. `play('idle')` cancels. Unknown names and actions of a dead boss return `{ dur: 0, hits: [] }` (e.g. `getup`). `dist` (m): `axe_throw` range (default 15). `loop` is ignored (use `dur`). |
| `stop(name?)`, `playing(name?)` | fade out actions / query. |
| `setGlow(kind, v)` | `'counter'` (electric-blue fresnel rim + rising bands; body stays readable), `'enrage'` (hotter emissive shifted to the enrage colour + red rim + more embers), `'ghost'` (spectral blue-violet translucency, wisps). 0..1; combined by max with state flags and action channels (e.g. `triple_sweep` shows its own counter shimmer during its windup). |
| `breakPart(name)` | Gorrath `'hornL'`/`'hornR'`: the horn beyond the bronze ring vanishes (also from shadows), shards tumble and settle, sparks; returns false if unknown/already broken. `repair()` restores. |
| `setTint(hex, amount)` | hit flash / freeze tint (caller fades `amount`). |
| `onEvent = (name, worldPos, data, boss) => {}` | `'hit'` at every hit moment (`data.index`, position = the action's `hitAt` socket), `'step'` (footfall, `data` = leg id), `'snort'`, `'land'`, `'jump'`, `'kneel'`, `'fall'`, `'roar'`, `'release'`/`'catch'` (Gorrath's axe throw), `'drop'`/`'weaponDrop'` (death), `'break'` (part), `'rift'`, `'wave'`, `'summon'`, `'howl'`, `'slam'`, `'stomp'`, `'burst'`, `'ghost'`, `'skid'`, `'charge'`, `'ignite'`, `'flinch'`. `worldPos` may be null. |
| `weapons` | Gorrath `axe`, Varkhul `sword`: `{ mesh }` separate objects. `flying('axe')` is true while Gorrath's axe is thrown (world-space boomerang path, spins flat, returns to the hand — collide with `sockets.weapon`). On death the weapon is dropped to the ground. |
| `fx(kind, pos, n, opts)` | built-in particles: `'ember','flame','breath','smoke','steam','ghost','void','spark','dust'`. |
| `dispose()` | removes from the scene; frees per-instance materials, particles, trails (geometry stays cached). |

Draw calls per boss: body 1 (+1 depth prepass while ghost) + weapon 1 (Gorrath, Varkhul) + 2 particle pools + 1 trail per
weapon edge (+ debris after a horn break). Materials share one GL program per variant across all bosses.

## Integration notes
- **Hit alignment**: every attack's `hits[0]` is its main impact, so `dur = meta.dur × at / hits[0]` (the encounter kit's
  `act()`) keeps windups proportional. Heavy moves have long, readable anticipations (≈40–60 % of the time to impact).
- **Root motion is the encounter's**: `move` segments tell how far/when to move the root. Leaps (`leap_slam`, `leap`,
  `pounce`) are pose-only — crouch, airborne tuck, slam — and expect the root arc of `B.leap` (`height` in the metadata).
  Charges (`horn_charge`, `charge`) run the legs themselves. Intros contain their own drop from the sky (Gorrath,
  hounds): don't move the root during `intro`. The encounter plays `intro` at 2.4 s; longer cinematics extend its hold.
- `ghost_form` / `ghost_transform` is the transition only — keep `state.ghost = 1` (or `setGlow('ghost', 1)`) afterwards.
- `channel` (stagger check / Soulfire) kneels and builds glow; any `dur` works (its middle stretches), ends with a burst.
- `groggy` via `state.groggy` (loops) or `play('groggy', { dur })` (stretches); the boss kneels, eyes dim, head lolls.
- `death` holds on the ground. It lasts 3.6–6 s; if the corpse is sunk/removed, wait ≥ `meta.actions.death.dur`.
- Colours are tuned for the `blood` raid preset (both legion gates): dark hides, a cool silhouette rim, hot glows.

## Lab (`src/lab/legion.js`, core in `legion_core.js`)
Boss/action pickers, `dur ×`, loop, glow sliders, state toggles (enraged/groggy/dead), horn breaks, hit flash,
locomotion (speed/turn/patrol), a 1.85 m capsule hero, views `iso` (game camera; giants pull back), `cine` (close & low),
`gamecine` (the encounter intro camera), `close` (head), `front/side/back/top/orbit`, and a `blood light (raid)` button.
URL: `?boss=gorrath&act=axe_cleave&loop=1&t=1.2&view=iso|cine|gamecine&light=blood&counter=1&enrage=1&ghost=1&speed=2.6&hero=0&face=180`.
Automation (`window.__legion`): `set(id)`, `play(name, {loop})`, `pose(name, t, {scale})` → Promise (freeze at t),
`sheet(name, n, {pitch, face, gap, times, dur})` (contact sheet; `dur` = review at a game-scaled duration), `loco(speed, turn)`, `glow(kind, v)`, `state({...})`,
`view(name)`, `stats()`. Solo labs `legion_ashmaw.js` / `legion_gatekeeper.js` load one definition without `index.js`.

## Bosses
### Gorrath, the Horned Tyrant (`gorrath`) — height 7 m, radius 2.3 m, walk ≈ 2.6 m/s, run ≈ 9 m/s · 59000 tris
| action | dur (s) | hits (s) | extra |
|---|---|---|---|
| `idle` | 4 | – |  |
| `walk` | 1.11 | 0, 0.56 |  |
| `run` | 0.69 | 0, 0.34 |  |
| `turn` | 1.2 | 0.6 |  |
| `axe_cleave` | 2.6 | 1.45 |  |
| `stomp` | 2 | 1.05 |  |
| `death` | 5 | 1.6, 3.4 | holds |
| `axe_sweep` | 2.4 | 1.25 | active 1.1–1.45 |
| `triple_sweep` | 5.2 | 2.05, 2.9, 4.25 | counter 0.35–1.8; active 1.95–2.2, 2.8–3.05, 3.75–4.45 |
| `horn_charge` | 3.4 | 1.15 | active 1–2.5; move 1–2.5 18 m |
| `leap_slam` | 3 | 1.85 | move 0.55–1.85 →target (root arc 7 m) |
| `axe_throw` | 3.4 | 1, 2.7 | active 1–2.7 |
| `roar` | 2.8 | 1 |  |
| `rift_carve` | 4.2 | 2.55 |  |
| `channel` | 6 | 5.5 | stretch 1.2–5 |
| `groggy` | 5 | – | stretch 1–4; sustain 1.2–3.8 |
| `ghost_form` | 3.2 | 2.2 |  |
| `enrage` | 3.2 | 1.35 |  |
| `intro` | 3.8 | 0.55, 2.6 | stretch 0.8–1.9 |
| `leap` | 2.3 | 1.5 | move 0.45–1.5 →target (root arc 6 m) |
| `kick` | 1.5 | 0.62 |  |
| `cast` | 1.9 | 0.9 |  |
| `spectral_lunge` | 2.3 | 1.1, 1.42 | active 1.1–1.5 |
| `spawn` | 0.9 | – |  |
| `hit` | 0.6 | – |  |
| `ghost_transform` | 3.2 | 2.2 |  |

### Skarn, the Cinder Hound (`skarn`) — height 4.1 m, radius 2.2 m, walk ≈ 2.4 m/s, run ≈ 11 m/s · 42987 tris
| action | dur (s) | hits (s) | extra |
|---|---|---|---|
| `idle` | 3 | – |  |
| `walk` | 0.95 | 0, 0.24, 0.48, 0.71 |  |
| `run` | 0.49 | 0, 0.24 |  |
| `bite` | 1.3 | 0.62 |  |
| `claw_swipe` | 1.4 | 0.72 |  |
| `pounce` | 2.2 | 1.25 | move 0.45–1.25 →target (root arc 4 m) |
| `breath` | 3.4 | 1.1, 1.6, 2.1, 2.6 | active 1–2.8 |
| `howl` | 2.6 | 1 |  |
| `tail_whip` | 1.5 | 0.78 |  |
| `spin_attack` | 2 | 0.85, 1.2 | active 0.7–1.35 |
| `charge` | 3 | 1.1 | active 0.9–2.3; move 0.9–2.3 16 m |
| `intro` | 3.2 | 0.72, 2 | stretch 0.9–1.4 |
| `groggy` | 5 | – | stretch 1–4; sustain 1.2–3.8 |
| `death` | 3.6 | 1.8 | holds |
| `hit` | 0.5 | – |  |

### Vesk, the Void Hound (`vesk`) — height 4.1 m, radius 2.2 m, walk ≈ 2.4 m/s, run ≈ 11 m/s · 41614 tris
| action | dur (s) | hits (s) | extra |
|---|---|---|---|
| `idle` | 3 | – |  |
| `walk` | 0.95 | 0, 0.24, 0.48, 0.71 |  |
| `run` | 0.49 | 0, 0.24 |  |
| `bite` | 1.3 | 0.62 |  |
| `claw_swipe` | 1.4 | 0.72 |  |
| `pounce` | 2.2 | 1.25 | move 0.45–1.25 →target (root arc 4 m) |
| `breath` | 3.4 | 1.1, 1.6, 2.1, 2.6 | active 1–2.8 |
| `howl` | 2.6 | 1 |  |
| `tail_whip` | 1.5 | 0.78 |  |
| `spin_attack` | 2 | 0.85, 1.2 | active 0.7–1.35 |
| `charge` | 3 | 1.1 | active 0.9–2.3; move 0.9–2.3 16 m |
| `intro` | 3.2 | 0.72, 2 | stretch 0.9–1.4 |
| `groggy` | 5 | – | stretch 1–4; sustain 1.2–3.8 |
| `death` | 3.6 | 1.8 | holds |
| `hit` | 0.5 | – |  |

### Varkhul, the Ravager (`varkhul`) — height 3.6 m, radius 1.3 m, walk ≈ 2.4 m/s, run ≈ 7 m/s · 49458 tris
| action | dur (s) | hits (s) | extra |
|---|---|---|---|
| `idle` | 3 | – |  |
| `walk` | 1 | 0, 0.5 |  |
| `run` | 0.67 | 0, 0.33 |  |
| `spawn` | 0.9 | – |  |
| `slash_combo` | 2.6 | 0.55, 1.15, 1.9 | active 0.45–0.65, 1.05–1.25, 1.85–2 |
| `overhead` | 2.2 | 1.2 |  |
| `fire_wave` | 2.6 | 1.35 | active 1.35–2.2 |
| `leap` | 2.4 | 1.5 | move 0.45–1.5 →target (root arc 4 m) |
| `summon` | 3 | 1.8 |  |
| `roar` | 2.4 | 0.9 |  |
| `groggy` | 5 | – | stretch 1–4; sustain 1.2–3.8 |
| `death` | 4 | 1.5, 2.8 | holds |
| `intro` | 3.5 | 1, 2.3 | stretch 0.1–0.6 |
| `hit` | 0.5 | – |  |

### Ashmaw, the Siege Behemoth (`ashmaw`) — height 15 m, radius 6 m, walk ≈ 2.2 m/s, run ≈ 3 m/s · 56267 tris
| action | dur (s) | hits (s) | extra |
|---|---|---|---|
| `idle` | 5 | – |  |
| `walk` | 2.38 | 0, 0.6, 1.19, 1.79 |  |
| `spawn` | 1.2 | – |  |
| `slam_wall` | 4.2 | 2.3 |  |
| `roar` | 4 | 1.4 |  |
| `breath` | 5 | 1.8, 2.6, 3.4 | active 1.6–4 |
| `hit` | 1.2 | 0.15 |  |
| `death` | 6 | 2.2, 4 | holds |

### Gatekeeper, Warden of the Chaos Gate (`gatekeeper`) — height 4 m, radius 1.6 m, walk ≈ 2.2 m/s, run ≈ 6 m/s · 46296 tris
| action | dur (s) | hits (s) | extra |
|---|---|---|---|
| `idle` | 3 | – |  |
| `walk` | 1.11 | 0, 0.56 |  |
| `spawn` | 1 | – |  |
| `bash` | 1.8 | 0.9 |  |
| `spin` | 2.8 | 0.9, 1.4, 1.9 | active 0.8–2.1 |
| `summon` | 2.8 | 1.6 |  |
| `intro` | 3 | 0.85, 2.05 |  |
| `groggy` | 5 | – | stretch 1–4; sustain 1.2–3.8 |
| `death` | 3.8 | 1.6, 2.6 | holds |
| `hit` | 0.5 | – |  |

### Boss notes
- **Gorrath** (`gorrath.js`): bison-humped minotaur demon lord, oxblood-charcoal hide with molten fissures, burning
  eyes under an iron chanfron (war plate down the brow and nose bridge with angry brow wings), heavy tusks, braided
  beard, gold nose-ring (spring), ringed breakable horns with rune bands, riveted bronze-rimmed pauldrons with
  glowing-tipped spikes, skull belt, war-cape with the Legion's horned-ring sigil (3 spring chains + body collision),
  loincloth bearing the same sigil, cloven hooves, and the double-bitted greataxe (separate mesh; molten edges, a
  horned-ring sigil on each bit, flame emitters, 2 speed trails). Sockets: `nose`,
  `weaponTip2` (second blade), `feetL/feetR`, `parts.hornL/hornR`. `triple_sweep` = Tyrant's Reaping: overhead windup
  with the counter shimmer (0.35–1.8), two sweeps, then a full 360° Reaping Wheel. `rift_carve` raises the axe high and
  charges it (glow) before the slam. `leap` / `kick` / `cast` / `spectral_lunge` / `spawn` / `hit` are extra moves.
- **Skarn / Vesk** (`hounds.js`): twin demon hounds (shared anatomy). Skarn: charcoal + molten cracks, flame-licked
  dorsal spikes and particle flame mane, ridged ram horns curling back and forward past the cheeks, burning tail tuft. Vesk: leaner, void-black with violet
  fissures, obsidian spines with violet fire, swept blade horns, scythe-bladed tail. Breath = directed particle jet
  that splashes along the ground (`active` window). Trails on both forepaws and the tail. Sockets: `tail`,
  `feetFL/FR/RL/RR`; `handR/weapon` = right forepaw.
- **Varkhul** (`varkhul.js`): demon knight in blackened plate with burning seams, horned great-helm with a glowing
  T-visor and spike crown, ember mantle (springs, smouldering hem, embers/smoke), crimson tabards, and a separate
  burning greatsword (droppable; flame emitters + trail). Idle rests both hands on the pommel of the planted blade;
  walks with it on the shoulder. Sockets: `weapon` (mid-blade), `weaponTip`.
- **Ashmaw** (`ashmaw.js`): 15 m knuckle-walking siege behemoth: obsidian-spiked molten hump, bone shoulder/back
  plates, ram-plate skull with forward-curling horns, furnace maw (breath jet), broken shackles with swinging chains,
  ballista bolts in the hide. `slam_wall` rears up and hammers both fists down in front; `hit` is the cannon flinch.
  Sockets: `handR/handL` = fists, `feetFL…`. In the lab the iso camera pulls back to 52 m for giants.
- **Gatekeeper** (`gatekeeper.js`): hunched warden in blackened iron with chaos-green accents: horned bucket-helm with
  eye slits, chain bandolier, tower shield with a glowing chaos eye (left-hand IK + aim), spiked flail on a spring
  bone chain (swings, trails, flies out in `spin`). Sockets: `shield`, `weapon`/`weaponTip` = flail ball.

## Internals (for maintainers)
- `boss.js` — build cache (`buildEntry`) + `Boss` runtime: gait via `kit/gait.js`, keyframe actions, right/left
  weapon IK, springs, glow, particles, trails, weapon flight/drop, debris; `bipedCarriage`, `quadCarriage`.
- `anim.js` — keyframe compiler (`$handR/$aimR/$poleR`, `$handL/$aimL/$poleL`, `$gripL`, `$footX`, `$hips`, `$air`,
  `$shake`, `$charge`, `$body`, `$counter`, `$ghost`, `$enrage`, `$eyes`, `$breath`, `$freeR/L`, bone `x`/`x+`),
  per-segment easing, time warp (stretch/sustain), `SpringChain`, `armIK`.
- `material.js` — boss shader (molten cracks, counter/enrage/ghost, silhouette rim, hidden parts, dissolve) + ghost
  prepass + shadow-depth variant. `acc.js` — geometry accumulator with the `ext` channel (spec, part, crack, glow class).
- `fxlite.js` — world-space particle pools + weapon trails. `meta.js` — `metaOf()` (BOSSES entries).
