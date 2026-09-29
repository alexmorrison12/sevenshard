# models/bosses/legion — Legion bosses

Procedural (SDF-sculpted, skinned, procedurally animated) legion bosses. Contract: ARCHITECTURE.md → "Bosses".
Lab: `node tools/lab.mjs src/lab/legion.js` → `http://localhost:5299/lab/legion.html`.

```js
import { createBoss, BOSSES, preloadBosses, disposeBossCache, bossStats, BOSS_IDS } from './models/bosses/legion/index.js';

preloadBosses(['gorrath']);                 // optional: build + cache geometry during loading (returns build stats)
const b = createBoss('gorrath', { impactFx: true });
scene.add(b.root);                          // game owns root.position / root.rotation.y (model faces −Z, like heroes)
b.update(dt, { speed, turn, dead, groggy, enraged, ghost, combat });   // every frame
const { dur, hits } = b.play('axe_cleave', { dur: 2.2 });             // hits: impact moments in seconds (scaled)
b.setGlow('counter', 1);  b.breakPart('hornL');  b.setTint(0xffffff, 0.6);  b.dispose();
```

## Exports
| export | description |
|---|---|
| `createBoss(id, opts)` | new instance (geometry cached per id, < 600 ms first build). `opts.impactFx` (default true): built-in dust/sparks on hits/landings. |
| `BOSSES` | `{ [id]: { name, title, height, radius, walkSpeed, runSpeed, actions: { [name]: { dur, hits, counter?, active?, move?, hold?, stretch?, sustain? } } } }` — pure data, safe to read without building meshes. |
| `preloadBosses(ids?)` | builds and caches geometry, returns `[{ id, ms, tris, verts, bones, … }]`. |
| `disposeBossCache()` | frees cached geometry (live instances keep working; they re-upload). |
| `bossStats()` | build stats of cached bosses. `BOSS_IDS`: `['gorrath','skarn','vesk','varkhul','ashmaw','gatekeeper']`. |

Implemented models: **gorrath** (others currently return a stand-in model with the right name, size, metadata and
`play()` timings, so encounters can be wired; they are replaced in place as they come online — same API).

## Instance
| member | description |
|---|---|
| `root` | `THREE.Object3D` — add to the scene; set `position` / `rotation.y` (facing). Model faces −Z. |
| `height`, `radius` | metres (collision / nameplate / camera framing). |
| `sockets` | `Object3D`s for FX/attachments: `head, mouth, chest, handR, handL, weapon` (axe head centre), `weaponTip` / `weaponTip2` (the two blade edges), `nose`, `back`, `feetL`, `feetR`, `parts: { hornL, hornR }`. Weapon sockets ride on the axe, also while it is thrown. |
| `update(dt, state)` | `state = { speed (m/s along facing), turn (rad/s), dead, groggy, enraged, ghost (0..1), combat (default true) }`. Locomotion (gait with planted hooves, heavy walk → run), idle life (breathing, snorts with steam, look-around), cape/tail/nose-ring springs, glow smoothing, particles. **`dt = 0` holds the exact pose** (hit-stop). `dead: true` plays `death` and holds; a true→false transition revives. `groggy: true` plays `groggy` and sustains its dazed loop until false (then it gets up). `enraged` → persistent enrage glow. `ghost` → spectral form. |
| `play(name, { dur, dist })` | one-shot action → `{ dur, hits }`. `dur` stretches the move (uniformly, or only the middle "stretch" segment for `channel`/`groggy`), `hits` scale with it. `play('idle')` cancels. Unknown / dead → `{ dur: 0, hits: [] }`. `dist` (m) for `axe_throw`. |
| `stop(name?)`, `playing(name?)` | fade out actions / query. |
| `setGlow(kind, v)` | `'counter'` (electric-blue shimmer: fresnel rim + rising bands — the counter window read), `'enrage'` (hotter crimson emissive + red rim + ember smoke), `'ghost'` (spectral translucency). Values 0..1; combined with state flags and action-driven glows by max. |
| `breakPart(name)` | `'hornL'` / `'hornR'`: the horn shatters (debris shards + sparks), a jagged stump stays. Returns false if unknown / already broken. `repair()` restores. |
| `setTint(hex, amount)` | hit flash / freeze tint (you fade `amount` back to 0). |
| `onEvent = (name, worldPos, data, boss) => {}` | callbacks: `'hit'` (at each hit moment; `data.index`), `'step'` (footfall), `'snort'`, `'slam'`, `'stomp'`, `'kneel'`, `'fall'`, `'drop'`/`'weaponDrop'`, `'release'`/`'catch'` (axe throw), `'break'` (part), plus action-specific names. `worldPos` may be null. |
| `weapons.axe.mesh`, `flying('axe')` | Gorrath's axe is a separate `Mesh`; during `axe_throw` it flies in world space (its `matrixWorld` is authored; use `sockets.weapon.getWorldPosition(v)` for collision). |
| `fx(kind, pos, n, opts)` | spawn built-in particles: `'ember','flame','smoke','steam','ghost','void','spark','dust'`. |
| `dispose()` | removes from the scene, frees per-instance materials/particles (geometry stays cached). |

Draw calls per boss: body 1 (+1 depth prepass while ghost) + weapon 1 + 2 particle pools + debris (only after a break).

## Gorrath, the Horned Tyrant (`gorrath`) — ~7 m, radius 2.3 m, walk ≈ 2.6 m/s, run ≈ 9 m/s
| action | dur (s) | hits (s) | notes |
|---|---|---|---|
| `idle` | 4 | – | breathing, periodic snort (steam) — driven by `update`, `play('idle')` cancels actions |
| `walk` / `run` | 1.11 / 0.69 | footfalls | gait cycle length; locomotion is driven by `update({ speed })` |
| `turn` | 1.2 | 0.6 | body leads a turn + stomp; rotate `root` yourself over `dur` |
| `axe_cleave` | 2.6 | 1.45 | overhead two-handed chop into the ground in front (windup 0.5–1.3) |
| `stomp` | 2.0 | 1.05 | right hoof raised high, slammed down: circle shockwave |
| `death` | 5.0 | 1.6 (knees), 3.4 (body) | recoil, drops the axe, kneels, collapses face-down; holds, eyes fade |

(More actions are being added: intro, axe_sweep, triple_sweep (counter), horn_charge, leap_slam, axe_throw, roar,
rift_carve, channel, groggy, ghost_form, enrage — `BOSSES.gorrath.actions` always lists what is available.)

## Internals (for maintainers)
- `boss.js` — build cache + `Boss` runtime (gait via `kit/gait.js`, keyframe actions, weapon/arm IK, springs, glow, particles, weapon flight/drop, debris).
- `anim.js` — keyframe compiler (`$handR`/`$aimR` weapon IK channels, `$footX`, `$hips`, `$air`, glow channels…), time warp, springs, arm IK.
- `material.js` — boss shader (cracks, counter/enrage/ghost, hidden parts, dissolve). `acc.js` — geometry accumulator with the `ext` channel.
- `fxlite.js` — world-space particle pools. `gorrath.js` — the Horned Tyrant definition. `meta.js` — stand-in metadata.
