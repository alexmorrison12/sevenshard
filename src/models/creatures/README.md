# creatures — SEVENSHARD monsters, mounts, pets, critters & ships

Entry: `src/models/creatures/index.js`. Everything is procedural (SDF sculpt → surface nets → ONE skinned mesh per
creature with baked AO + vertex colours + rigid parts). Geometry is built once per (type, variant) and cached; every
instance owns only its bones, skeleton and a material clone (all instances share one GL program).
Lab: `node tools/lab.mjs src/lab/creatures.js` → `http://localhost:5299/lab/creatures.html` (see "Lab" below).

## API

```js
import { createCreature, CREATURES, createShip, preloadCreatures, creatureStats, disposeCreatureCache } from './models/creatures/index.js';

const c = createCreature('imp', { variant: 'red', scale: 1, tint: 0xffffff, elite: false, seed: 17 });
scene.add(c.root);                    // the game owns c.root.position / c.root.rotation.y (model faces −Z; forward = (−sin f, 0, −cos f))
c.update(dt, { speed, turn, combat, dead, down, stunned, fly, strafe });   // every frame
const { dur, hit } = c.play('attack');            // hit = seconds until the blow lands (scaled by dur)
c.play('attack_big', { dur: 2.0 });               // stretch/compress a move (all timings scale)
c.play('stun', { loop: true }); c.stop();         // looped until the next play() / stop()
c.setTint(0xffffff, 0.7);                         // hit flash: the game fades `amount` back to 0 itself
c.dispose();
```

### `createCreature(type, opts)` → creature
| opt | meaning |
|---|---|
| `variant` | palette / look (see the table; unknown → default). Elite variants are listed last. |
| `elite` | `true` → the type's elite variant when no variant is given (bigger, brighter, extra parts). |
| `scale` | extra uniform scale (multiplies the variant's own scale). |
| `tint` | hex colour multiplier for the whole body (e.g. a champion tint). |
| `seed` | per-instance variety: ±6 % size and a subtle brightness/warmth shift (0 / undefined = none). |

Unknown types log a warning and fall back to `imp`. Types not sculpted yet (marked *placeholder* in `CREATURES`) are a
coloured blob with glowing eyes and the generic actions, so integration never blocks.

### creature instance
| field / method | |
|---|---|
| `root` | `THREE.Object3D` — position / `rotation.y` are the game's. Children: `pivot` (instance scale) → bones + mesh. |
| `height`, `radius` | metres (instance scale applied) — nameplates, collision, lock-on. |
| `sockets` | `Object3D`s riding the bones: always `head`, `mouth`, `center`, `back`, `chest`; plus `handR`/`handL`, `rider`, `tail`… when the type has them (see table). Use `getWorldPosition()` for FX. |
| `update(dt, state)` | `speed` m/s along facing (negative = backing off), `turn` rad/s, `strafe` m/s (+right), `combat` bool (stance), `dead`, `down`, `stunned`, `fly` (flyers take off / land). |
| `play(action, { dur, loop })` | → `{ dur, hit? }`. Unknown actions → `{ dur: 0 }`. While dead only `death`/`spawn`/`revive` are accepted. |
| `stop()` | ends looped / held non-state actions (not death / knockdown / stun). |
| `setTint(hex, amount)` | hit flash, freeze (0x9ad8ff), poison (0x7aff5a)… `amount` 0 = off. |
| `setGlow(k)` | emissive multiplier (1 = authored; eyes, veins, flames, orbs). Actions pulse it themselves too. |
| `setDissolve(v, hex?)` | 0..1 burn-away with glowing edges — use after death to remove corpses (e.g. 1.2 s after `death`, ramp 0→1 over 1 s), or 1→0 for a magical spawn. Shadow is dropped past 0.35. |
| `setGround(fn)` | optional terrain following: `fn(worldX, worldZ) → height`; feet plant on slopes, body tilts. The game still sets `root.position.y`. |
| `onFootstep` | optional `(legId, worldPos, strength)` callback when a foot plants (dust puffs / sounds). |
| `isDead` | true after `death` until `spawn` / `revive`. |
| `dispose()` | removes from the scene, frees the per-instance material/skeleton (geometry stays cached). |

### state semantics (`update`)
- `dead: true` plays `death` once and holds the corpse. A true→false transition revives. `play('spawn')` also revives.
- `down: true` plays `knockdown` and stays down; a true→false transition plays `getup`. `play('knockdown')` /
  `play('getup')` do the same without the state flag. Killing a downed creature plays a lying death (no fling).
- `stunned: true` loops `stun` (dazed sway) until false.
- `fly: true` — flyers (`CREATURES[t].flying`) take off and hover with flapping wings; false lands them.
- `combat: true` — combat stance (crouch, raised claws / weapon, hackles up, flames stronger, head low for beasts).
- Locomotion is procedural: feet are planted and integrated with the ground speed, so any `speed` / `turn` looks
  right (walk → trot/run → gallop blends). Death / knockdown / spawn lock the legs automatically.

### actions (common set)
`attack`, `attack2`, `attack_big` (long, readable windup — telegraph it; `hit` is the release), `cast`, `spit`,
`roar`, `hit` (flinch), `knockback` (stagger back — the game should slide the root ~1–3 m back over the first 0.4 s),
`knockdown` (hold) → `getup`, `death` (hold; small mobs are flung ~1.5–2 m back inside the model, maybe with a
backflip, then collapse — the game does NOT need to move the root), `stun` (loop), `spawn` (claws its way out of the
ground; ~1.1 m below grade at t=0 — pair with a portal/ground-crack FX), `spawn_drop` (drops in from ~3 m, for portal
spawns), `idle_alt` (fidget). Each type lists what it supports in `CREATURES[type].actions`; durations below.

### `CREATURES`
`{ [type]: { name, height, radius, flying?, variants: [...], actions: [...], placeholder?, mount?, pet? } }` — height /
radius in metres at scale 1 for the default variant.

### `createShip(type)` → ship
`{ root, sockets: { helm, wake, cannonsL: [], cannonsR: [] }, update(dt, { speed, turn, sail }), fire(side), dispose() }`
— see "Ships" below. Waterline is y = 0.

### other exports
- `preloadCreatures(list)` — build geometry ahead of time (loading screen). `list: [type | [type, variant]]` → build stats.
- `creatureStats()` — `[{ key, ms, tris, verts, bones, … }]` for every cached entry.
- `disposeCreatureCache()` — free cached geometry (zone change).

## Types

<!-- TYPES -->

## Actions per type (seconds: `dur/hit`)

<!-- ACTIONS -->

## Performance
Per type: one draw call (+1 shadow) per instance, geometry shared, ≤ 6k triangles per mob, first build 35–60 ms per
type. Horde test (lab `?mode=horde`): 60 imps + hellhounds at 60 fps, ~1 ms/frame CPU for all 60 controllers,
129 draw calls. No per-frame allocations in the update paths.

## Lab
`creatures.html?type=imp` (single, panel with type/variant/action/state), `&mode=lineup` (all variants),
`&mode=strip&act=death&n=7` (filmstrip), `?mode=horde` (60 mobs charging, fps/CPU readout), `?mode=mount&type=horse`
(placeholder rider on the `rider` socket), `?mode=ship&ship=dawnrunner`, `?mode=gallery` (every type). Params:
`view=iso|orbit`, `yaw` (creature facing, deg), `speed`, `combat=1`, `fly=1`, `t=1.2` (advance & freeze), `act=…`.
