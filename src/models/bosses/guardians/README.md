# Guardian bosses — `src/models/bosses/guardians/`

Procedural giant monsters for Guardian Hunts, the Abyssal Dungeon and the field boss. Every mesh is an SDF sculpt
(kit `Sculpt`: surface nets → skin weights → baked AO → painted vertex colours) plus lofted / faceted rigid parts and
skinned membranes, animated procedurally (kit `Pose` FK + 2-bone IK, planted-feet gait). No assets.

Lab: `node tools/lab.mjs src/lab/guardians.js` → `http://localhost:5299/lab/guardians.html` (see the header of
`src/lab/guardians.js` for URL params: `?boss=rimewing&act=breath&view=iso|cine&loop=1&at=1.2` …).

## API (contract: ARCHITECTURE.md "Bosses")

```js
import { createBoss, BOSSES, preloadBosses, disposeBossCache, bossStats, GUARDIAN_IDS } from './models/bosses/guardians/index.js';

const b = createBoss('rimewing', { scale: 1 });   // kurai also accepts { clone: true } (translucent flame copy)
scene.add(b.root);                                // game sets root.position (x, ground y, z) and root.rotation.y = facing
b.update(dt, { speed, turn, dead, groggy, enraged, fly, burrowed, ghost });
const { dur, hits } = b.play('breath', { dur: 3.5 });   // one-shot; returns impact moments (seconds from now)
b.stop(name?)                  // end a loop action (fly / sing / groggy …) or all actions
b.setGlow('counter' | 'enrage' | 'ghost', 0..1)
b.breakPart(name) → bool       // true if it broke now (names in BOSSES[id].parts)
b.isBroken(name) → bool
b.setTint(hex, amount, fade?)  // colour overlay; persistent until changed, or decays to 0 over `fade` seconds
b.dispose()                    // materials + skeleton; geometry stays cached (disposeBossCache() frees it)
```

Instance fields: `root`, `height`, `radius`, `sockets`, `actions` (names), `info` (= `BOSSES[id]`), `altitude`
(current internal lift of the body in metres — flight / burrow), `dead`, `meshes`, `U` (shared material uniforms).
Helpers: `b.socketPos(name, out?)` → world position, `b.socketDir(name, out?)` → world forward (−Z) of a socket.
`b.onEvent = (type, info) => {}` receives `('hit', { action, index })` when an action's hit moment passes.

### Conventions
- Faces −Z in local space, metres, Y up, feet on y = 0 at the root. One `root` Object3D; everything else is inside.
- **The model moves vertically by itself** (flight altitude, dive swoops, burrowing). The game only moves x / z and
  facing. For attacks that travel (`move` in the metadata) the game translates the root forward by `move.dist` metres
  between `move.t0` and `move.t1` (seconds at canonical duration — scale them like hits); pass the real ground speed
  as `state.speed` meanwhile so feet stay planted.
- `update(0, …)` holds the pose exactly (hit-stop). Large `dt` is clamped to 0.1 s.
- Sockets are `Object3D`s parented to bones and are fresh right after `update()` (the root's world matrix is updated
  inside `update`). Forward of a socket is its local −Z (e.g. the breath direction of `mouth`).

### State (update)
| key | meaning |
|---|---|
| `speed`, `turn` | m/s along facing, rad/s. Drives the gait (walk ≈ 3 m/s, run ≈ 7.5 m/s for rimewing). |
| `dead` | `true` plays `death` (held); a later `true → false` edge revives. `play('death')` also works. |
| `groggy` | dazed layer (stagger break / counter stun): sagging stance, drooping head, dim eyes. |
| `enraged` | faster breathing, restless tail, stronger glow + red rim. |
| `fly` 0..1 | airborne amount (rimewing hovers at `BOSSES.rimewing.flyHeight` metres). `takeoff` / `land` animate the transition and latch the airborne state themselves, so the game may either drive `fly` or just play `takeoff` / `land`. A `fly` edge 1 → 0 drops the latch. |
| `burrowed` 0..1 | sunk into the ground (cinderhorn / sandmaw). |
| `ghost` | translucent ghost look (bool or 0..1), same as `setGlow('ghost', v)`. |

### Actions
`play(name, { dur })` time-stretches the action to `dur` seconds and scales `hits` accordingly. Loop actions
(`loop: true` in the metadata) keep their canonical cycle and run for `dur` seconds (default: until `stop()` or the next
action); their hits repeat every cycle. `idle` cancels everything. `walk` / `run` / `turn` are driven by
`state.speed / turn` — `play('walk')` only previews locomotion when the state carries no speed (lab).

`BOSSES[id] = { name, title, height, radius, parts: [...], actions: { name: { dur, hits: [s…], loop?, hold?,
counter?: [t0, t1], move?: { dist, t0, t1 }, speed?, turn? } }, flyHeight?, wingspan? }`
- `counter` = suggested blue counter window (seconds at canonical duration) — call `setGlow('counter', 1)` during it.

### Glow / tint
- `counter`: shimmering blue fresnel + rising bands over the whole body (bloom-bright).
- `enrage`: boiling elemental glow shifted toward red + hot red rim (also driven by `state.enraged`).
- `ghost`: translucent, desaturated, blue-white fresnel (materials switch to transparent while > 0).
- `setTint(0xffffff, 0.6, 0.15)` = hit flash; `setTint(0x9fdcff, 0.45)` = freeze tint (clear with amount 0).

## Guardians

### `rimewing` — Rimewing, Tyrant of the Frozen Skies (ice wyvern, 12 m wingspan, head ≈ 4 m)
Knuckle-walks on its folded wing-hands (high "bat" elbows), flies, dives. Glowing blue throat sac + chest veins,
crystalline frost spines, crystal crown and tail blade.
- parts: `crest` (crystal crown), `tail` (crystal tail blade)
- sockets: `head`, `mouth` (breath origin, forward = breath direction), `chest`, `back`, `throat`, `handL/handR`
  (wrists), `wingL/wingR` (wing tips), `weapon` (tail), `weaponTip` / `tail` (blade), `footL/footR`, `crest`
- actions (canonical dur · hits): idle 4 · loop; walk 1.35 loop; run 0.95 loop; turn 1.6 loop; intro 6.0 · [3.35] roar;
  bite 1.35 · [0.62]; claw 1.6 · [0.86] (counter 0.25–0.7); tail_sweep 2.1 · [1.0] (full spin); breath 3.8 ·
  [1.35, 1.75, 2.15, 2.55, 2.95] (frost cone ticks); takeoff 2.4 · [0.8] (wing blast); fly 1.25 loop; dive 2.9 · [1.42]
  (move 16 m between 0.95–1.75); land 2.0 · [1.15]; ice_spikes 3.1 · [1.6, 2.15]; wing_gust 2.5 · [1.2, 1.6];
  groggy 3.0 loop; death 3.6 hold.
- `flyHeight` 5.5 m.

## Files
- `index.js` — registry, `BOSSES`, `createBoss`.
- `core/build.js` — geometry build + cache. `core/boss.js` — runtime instance (API above). `core/ctl.js` — action
  timeline, state smoothing, gait/IK frame. `core/gait.js` — kit gait + IK blending / paw rest rotation.
  `core/material.js` — guardian shader (kinds: skin, hard, crystal, membrane, flame, eye, mouth, lava, hair, water).
  `core/acc.js` — skinned geometry accumulator. `core/geo.js` — lofts, crystals, eyes, grids.
- `<id>.js` — rig, sculpt, paint, dress (parts), sockets, metadata. `<id>_anim.js` — gait, base layers, actions.

## Performance
Built once per id and cached (shared by all instances). rimewing: ~200 ms build, 36k tris, 45 bones, 2 draw calls
(+2 shadow). Per-frame update ≈ 0.1–0.2 ms.
