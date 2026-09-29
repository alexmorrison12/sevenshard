# creatures — SEVENSHARD monsters, mounts, pets, critters & ships

Entry: `src/models/creatures/index.js` (contract: ARCHITECTURE.md "Creatures"). Everything is procedural and original:
SDF sculpt → surface nets → **one skinned mesh per creature** (baked AO, vertex colours, painted detail, rigid parts
merged in) → one draw call + one shadow draw. Geometry is built once per (type, variant) and cached (palette-swap variants
re-colour the cached shape); every instance owns only its bones, skeleton and a material clone, and all instances share
one GL program. 34 types, 0 placeholders.

| folder / file | contents |
|---|---|
| `demons/` | `imp`, `hellhound`, `legionnaire`, `brute`, `abyss_caster` (caster.js), `gargoyle`, `rift_crystal` (crystal.js) |
| `pips.js` | `pip` (mascot NPC), `pip_seed` (collectible), `pip_pet` |
| `spirits/` | `skeleton`, `wraith`, `wisp`, `crystal_golem` |
| `beasts/` | `wolf`, `boar`, `spider`, `crab`, `treant` |
| `mounts/` | mounts `horse`, `direwolf`, `sunstag`; pets `foxling`, `owlet`, `slimelet` |
| `wild/` | `sea_serpent`, `kraken_tentacle`; critters `butterfly`, `bird`, `seagull`, `rabbit`, `cat`, `chicken`, `fish` |
| `ships/` (+ `ships.js`) | `createShip`: `dawnrunner`, `pirate`, `ghost`, `merchant` |
| `core.js` | registry, build/cache (`getEntry`), the `Creature` instance class, `makeRegistry` for sub-area labs |
| `ctl.js`, `gait2.js`, `acts.js` | controllers (Biped / Quad / Hover / Base), procedural gait + IK, shared reactions |
| `material.js`, `parts2.js`, `placeholder.js` | creature material, wings / flames / orbs / held props, placeholder blob |

## API

```js
import { createCreature, CREATURES, createShip, SHIPS, preloadCreatures, creatureStats, disposeCreatureCache,
         preloadShip, shipStats, disposeShipCache } from './models/creatures/index.js';

const c = createCreature('imp', { variant: 'red', scale: 1, tint: 0xffffff, elite: false, seed: 17 });
scene.add(c.root);                    // the game owns c.root.position / c.root.rotation.y (model faces −Z; forward = (−sin f, 0, −cos f))
c.update(dt, { speed, turn, combat, dead, down, stunned, fly, strafe, enraged });   // every frame
const { dur, hit } = c.play('attack');            // hit = seconds until the blow lands (scaled by dur)
c.play('attack_big', { dur: 1.4 });               // stretch / compress a move (every timing scales)
c.play('idle_alt', { loop: true }); c.stop();     // looped until the next play() of it / stop()
c.setTint(0xffffff, 0.5);                         // damage flash (the game fades it back to 0) → auto flinch
c.dispose();
```

### `createCreature(type, opts)` → creature
| opt | meaning |
|---|---|
| `variant` | palette / look (see the table; unknown → the type's default). Elite variants are listed last. |
| `elite` | `true` → the type's elite variant when no variant is given (bigger, brighter, extra parts). |
| `scale` | extra uniform scale (multiplies the variant's own scale; `height` / `radius` include it). |
| `tint` | hex colour multiplier for the whole body (e.g. a champion tint). |
| `seed` | per-instance variety: ±6 % size and a subtle brightness / warmth shift (0 / undefined = none). |

Unknown types log a warning and fall back to `imp`.

### creature instance
| field / method | |
|---|---|
| `root` | `THREE.Object3D`; position / `rotation.y` belong to the game. Child `pivot` (instance scale) → flat bones + the mesh. |
| `type`, `variant`, `elite`, `scale` | as resolved. |
| `height`, `radius` | metres, instance scale applied (nameplates, collision, lock-on). |
| `sockets` | `Object3D`s riding the bones. Always `head`, `mouth`, `center`, `chest`, `back` (missing ones alias the nearest); plus per type `handR`/`handL`, `rider`, `tail`, `orb`, `weapon`… (table below). Use `getWorldPosition()` for FX. |
| `flying` | the type can fly (`fly` state). |
| `actions` | action names this type supports (same list as `CREATURES[type].actions`). |
| `update(dt, state)` | see "state" below (the standard controllers clamp dt to 0.1 s). |
| `play(action, { dur, loop })` | → `{ dur, hit?, hits? }` in seconds. `dur` stretches the whole move (hit scales with it), `loop` repeats until the next `play` of it / `stop()`. Unknown action → `{ dur: 0 }`. `play('idle')` (or `'stand'`) ends every non-state action; `play('revive')` brings a corpse back instantly. While dead only `death`, `spawn` and `revive` are accepted. |
| `stop()` | ends looped / held non-state actions (not death / knockdown / stun / spawn / getup). |
| `setTint(hex, amount)` | colour flash / status tint (`amount` 0 = off). A *rising white* tint (the game's damage flash) also plays a light `hit` flinch — see "auto flinch". |
| `autoFlinch` | `true` by default; `false` for super-armoured heavies (`brute`, `crystal_golem`, `treant`, `sea_serpent`, `kraken_tentacle`). Settable per instance. |
| `setGlow(k)` | emissive multiplier (1 = authored eyes / veins / flames / orbs). Actions pulse glow themselves too. |
| `setDissolve(v, hex?)` | 0..1 burn-away with glowing edges (corpse removal: e.g. ramp 0→1 over 1 s after the death settles; 1→0 for a magical spawn). Shadow is dropped past 0.35. |
| `setGround(fn)` | optional terrain following: `fn(worldX, worldZ) → height`; feet plant on slopes and the body tilts. The game still sets `root.position.y`. |
| `onFootstep` | optional `(legId, worldPos, strength 0..1)` callback when a foot plants (dust puffs / footstep sounds). |
| `isDead` | true after `death` until `spawn` / `revive`. |
| `dispose()` | removes the root from its parent, frees the per-instance material / skeleton (geometry stays cached). |

### state (`update(dt, state)`) — all keys optional
- `speed` m/s along the facing (negative = backing off), `turn` rad/s (+ = left), `strafe` m/s (+ = right). Locomotion is
  procedural: feet are planted and integrated with the ground speed, so any speed / turn looks right (walk → trot / run →
  gallop blends; mounts walk 1.6, trot 4, canter 6.5, gallop 9.5 m/s).
- `combat` — combat stance (crouch, raised claws / weapon, hackles up, flames stronger, head low for beasts).
- `dead: true` plays `death` once and holds the corpse; a true→false edge revives. `play('spawn')` also revives.
- `down: true` plays `knockdown` and stays down; the true→false edge plays `getup`. `play('knockdown')` / `play('getup')`
  do the same without the flag. Killing a downed creature plays a lying death on the same side it fell (no fling, no pop).
- `stunned: true` loops `stun` (dazed sway) until false.
- `fly: true` — flyers take off and hover (bat wings flap, casters rise); false lands them. Don't pass it to mounts.
- `enraged: true` — eyes / veins / flames brighten and hackles rise (smoothed).
- Other keys the game passes (`mounted`, `sit`, `groggy`, `burrowed`, `ghost`) are ignored; use the matching actions.

### auto flinch
`setTint(0xffffff, a)` with `a ≥ 0.25` rising by more than 0.05 since the previous call — exactly what `game/visuals.js`
does on damage — plays `hit` unless the creature is dead, down, spawning or already early in a flinch. An attack still
in its windup (`k < 0.9·hit`) is interrupted (the mob AI cancels it too); an attack past its impact plays on.
Multi-hit combos restart the flinch at most every ~half flinch.

### actions (common set)
`attack`, `attack2`, `attack_big` (long, readable windup with a glow charge — telegraph it; `hit` is the release),
`cast`, `spit`, `roar`, `hit` (flinch), `knockback` (stagger back — the game slides the root ~1–3 m over the first
0.4 s), `knockdown` (hold) → `getup`, `death` (hold; small mobs are flung 1–2 m back *inside the model* with an
occasional backflip, then collapse — the game does not move the root), `stun` (loop), `spawn` (claws out of the ground /
type-specific entrance), `spawn_drop` (drops in from ~3 m for portal spawns), `idle_alt` (fidget; also fired
automatically when idle). Friendly types have their own sets (Pip emotes, pet tricks, mount rears, critter idles).
Each type lists what it supports in `CREATURES[type].actions`; durations below.

**Game timing.** Mob attack hit moments are aligned with `src/data/mobs.js` (hit ≈ windup / dur): with the game's
`play(anim, { dur })` the blow lands within ±0.07 s of the damage for every mob attack there (imp, hellhound bite +
pounce, legionnaire thrust + sweep, brute smash + swing, caster bolt, gargoyle, skeleton, wolf, boar, spider, golem
slam, wisp). The caster's `hex` (windup 1.1 of 1.5) reuses `cast`, whose gesture releases at 0.9 s.

### `CREATURES`
`{ [type]: { name, height, radius, flying?, variants: [...], actions: [...], mount?, pet? } }` — height / radius in
metres at scale 1 for the default variant.

### other exports
- `preloadCreatures(list)` — build geometry ahead of time (loading screen). `list: [type | [type, variant]]` → build stats.
- `creatureStats()` — `[{ key, ms, tris, verts, bones, … }]` for every cached entry.
- `disposeCreatureCache()` — free cached creature geometry (zone change).
- `preloadShip(type)`, `shipStats()`, `disposeShipCache()` — the same for ships.

## Ships

```js
const ship = createShip('dawnrunner');     // 'dawnrunner' | 'pirate' | 'ghost' | 'merchant' (unknown → dawnrunner + warning)
scene.add(ship.root);                       // game owns root.position / rotation.y; bow faces −Z; waterline y = 0
ship.update(dt, { speed, turn, sail });     // m/s, rad/s (+ = turning to port), sail 0 furled … 1 full; allocates nothing
const { dur, times } = ship.fire('L');      // port broadside ('R' = starboard); times[i] = when cannons{L|R}[i] fires
ship.setGlow(1.6);                          // lantern / window glow (night)
ship.dispose();
```
`SHIPS[type] = { name, length, beam, loa, height, guns }` (guns per side). `createShip` returns
`{ type, name, length, root, hull, sockets, update, fire, setGlow, dispose, stats }`; `hull` is the rocking child (bob,
pitch, roll, heel into turns, broadside kick) — `root` is never rotated by the ship. Sockets: `helm` (captain's feet at
the wheel, rides the hull), `wake` (stern waterline on the root, does not bob), `cannonsL` / `cannonsR` (muzzles bow →
stern; each socket's local −Z points out of the barrel, i.e. `getWorldDirection().negate()`). Sails furl / reef toward
their yards over ~1 s (first call snaps), billow with speed, luff when slack; flags stream and flutter; the wheel spins
and the rudder swings with `turn`; guns ripple bow → stern 0.12 s apart with recoil. 3 draw calls per ship (wood, sails,
waterline foam) + 2 shadow; ~32–35k triangles; first build 85–116 ms (plank texture shared), cached instances ~35 µs.
The default 21 m game camera crops the 14–17 m masts — a sailing camera at 34–40 m frames them.

## Types

| type | name | height / radius (m) | variants (elite last) | | tris | extra sockets |
|---|---|---|---|---|---|---|
| `imp` | Imp | 0.98 / 0.33 | red, ash, violet, overseer | flies | 5974 | handR, handL |
| `hellhound` | Hellhound | 1.43 / 0.55 | ember, blight, void, alpha |  | 5794 | tail |
| `legionnaire` | Legionnaire | 2.2 / 0.55 | iron, bronze, obsidian, centurion |  | 5748 | handR, handL |
| `brute` | Abyssal Brute | 3 / 1 | crimson, ashen, bile, warlord |  | 5920 | handR, handL |
| `abyss_caster` | Abyss Caster | 2.05 / 0.45 | void, ember, blood, archon | flies | 5970 | handR, handL, orb |
| `gargoyle` | Gargoyle | 1.85 / 0.55 | granite, basalt, mossy, sentinel | flies | 5898 | handR, handL |
| `rift_crystal` | Rift Crystal | 2.4 / 0.85 | violet, crimson, azure |  | 4968 | top, ground |
| `skeleton` | Skeleton | 1.82 / 0.36 | sword, axe, archer, bone_knight |  | 5902 | handR, handL, eyes, weapon, weaponTip, shield |
| `wraith` | Wraith | 2.05 / 0.5 | shade, banshee, dreadwraith | flies | 4576 | handR, handL, eyes, hem |
| `wisp` | Wisp | 0.92 / 0.28 | blue, green, gold, violet | flies | 659 | tail |
| `crystal_golem` | Crystal Golem | 2.8 / 1 | amethyst, aqua, amber, geode_colossus |  | 3090 | handR, handL, fistR, fistL |
| `wolf` | Wolf | 1.25 / 0.5 | grey, brown, black, duskfang |  | 5880 | tail |
| `boar` | Boar | 0.95 / 0.5 | bristleback, dusky, gnarltusk |  | 5440 | — |
| `spider` | Spider | 0.95 / 0.8 | thornweaver, blightfang, pale, broodmother |  | 5744 | spinner |
| `crab` | Crab | 0.4 / 0.45 | sand, reef, barnaclaw |  | 5698 | handR, handL |
| `treant` | Treant | 4.2 / 1.1 | oak, autumn, blighted |  | 8001 | handR, handL, crown |
| `pip` | Pip | 0.62 / 0.24 | sprout, elder, child, merchant, guard, farmer |  | 6140 | handR, handL, sprout |
| `pip_seed` | Pip Seed | 0.644 / 0.21 | gold, jade, rose |  | 2341 | — |
| `horse` | Horse | 2.1 / 0.6 | brown, white, black, armoured | mount | 7666 | rider, tail |
| `direwolf` | Direwolf | 1.9 / 0.62 | grey, snow, black | mount | 7914 | rider, tail |
| `sunstag` | Sunstag | 2.8 / 0.55 | dawn, dusk, moon | mount | 6576 | rider, tail, crown |
| `foxling` | Foxling | 0.45 / 0.18 | red, snow, shadow | pet | 2820 | tail |
| `owlet` | Owlet | 0.42 / 0.15 | tawny, snowy, moonlit | flies, pet | 2859 | — |
| `slimelet` | Slimelet | 0.36 / 0.19 | mint, rose, azure, gold | pet | 2403 | — |
| `pip_pet` | Pipling | 0.434 / 0.168 | sprout, bloom, sky, ember | pet | 3140 | handR, handL, sprout |
| `sea_serpent` | Sea Serpent | 5 / 1.8 | abyssal, coral, leviathan |  | 11164 | jaw, neck, body, tail |
| `kraken_tentacle` | Kraken Tentacle | 7.3 / 0.9 | crimson, violet, lumen, elder |  | 8560 | tip, grip, base |
| `butterfly` | Butterfly | 0.9 / 0.1 | monarch, azure, sulphur, rose, glow | flies | 1288 | — |
| `bird` | Songbird | 0.24 / 0.105 | bluebird, robin, sparrow, goldfinch, cardinal | flies | 829 | — |
| `seagull` | Seagull | 0.42 / 0.16 | herring, blackback, hooded | flies | 1053 | — |
| `rabbit` | Rabbit | 0.352 / 0.132 | brown, grey, white, snow |  | 1398 | — |
| `cat` | Cat | 0.462 / 0.165 | ginger, grey, black, calico, siamese |  | 1471 | — |
| `chicken` | Chicken | 0.46 / 0.13 | white, brown, black, rooster |  | 1231 | — |
| `fish` | Fish | 0.1 / 0.2 | trout, koi, reef, salmon |  | 586 | — |

Sockets `head`, `mouth`, `center`, `chest`, `back` exist on every type; the last column lists the extras. Mounts' `rider`
socket rides a stabilised seat bone (≈55 % of gait pitch / roll removed, bob 1.7 cm walk … 6 cm gallop) and is
counter-scaled so a 1.85 m hero stays 1.85 m on any mount scale / seed. Heights: `pip_seed` and `butterfly` include their
float height; `fish` swims ~0.35 m below the root (root on the water surface); `sea_serpent` (~24 m long) and
`kraken_tentacle` stand on the waterline.

## Actions per type (seconds: `dur` / `hit` at natural speed)

- **`imp`** — attack 0.62/0.28, attack2 0.85/0.42, attack_big 1.70/1.22, cast 1.10/0.61, spit 0.75/0.36, roar 1.30, idle_alt 2.20, scratch 1.60, hit 0.42, knockback 0.90, knockdown 0.80 hold, getup 1.00, death 1.50 hold, stun 1.60 loop, spawn 1.70, spawn_drop 1.10
- **`hellhound`** — attack 0.70/0.32, attack2 0.85/0.42, attack_big 1.70/0.85, spit 1.10/0.44, roar 1.60, idle_alt 2.40, shake 1.80, hit 0.40, knockback 0.85, knockdown 0.80 hold, getup 0.90, death 1.50 hold, stun 1.80 loop, spawn 1.60
- **`legionnaire`** — attack 0.85/0.42, attack2 0.90/0.41, attack_big 2.10/1.20, roar 1.80, block 0.30 hold, idle_alt 2.20, hit 0.45, knockback 0.95, knockdown 0.80 hold, getup 1.20, death 1.70 hold, stun 1.80 loop, spawn 1.90, spawn_drop 1.10
- **`brute`** — attack 1.15/0.63, attack2 1.05/0.53, attack_big 2.50/1.35, roar 2.20, idle_alt 2.60, hit 0.50, knockback 1.00, knockdown 1.00 hold, getup 1.40, death 2.00 hold, stun 2.00 loop, spawn 2.20
- **`abyss_caster`** — attack 0.90/0.45, attack2 1.00/0.55, attack_big 2.40/1.58, cast 1.40/0.84, roar 1.50, idle_alt 3.00, hit 0.45, knockback 0.90, knockdown 0.80 hold, getup 1.00, death 1.50 hold, stun 1.80 loop, spawn 1.80
- **`gargoyle`** — attack 0.75/0.36, attack2 1.00/0.50, attack_big 2.20/1.58, roar 1.60, idle_alt 3.20, hit 0.45, knockback 0.90, knockdown 0.80 hold, getup 1.00, death 1.60 hold, stun 1.60 loop, spawn 2.60, spawn_drop 1.10
- **`rift_crystal`** — hit 0.40, idle_alt 1.80, death 2.00 hold, spawn 1.40
- **`skeleton`** — attack 0.72/0.34, attack2 0.80/0.38, attack_big 1.60/1.02, roar 1.40, hit 0.42, knockback 0.90, knockdown 0.80 hold, getup 1.00, death 1.50 hold, spawn 1.70, spawn_drop 1.10, idle_alt 2.40, stun 1.60 loop
- **`wraith`** — attack 0.72/0.33, attack2 0.95/0.47, attack_big 2.10/1.51, cast 1.25/0.78, roar 1.50, idle_alt 2.60, hit 0.42, knockback 0.85, knockdown 0.80 hold, getup 1.00, stun 1.80 loop, death 2.20 hold, spawn 1.70
- **`wisp`** — attack 0.72/0.33, attack2 1.00/0.60, attack_big 1.90/1.37, cast 1.00/0.56, roar 1.00, idle_alt 1.60, hit 0.36, knockback 0.75, knockdown 0.70 hold, getup 0.70, stun 1.40 loop, death 1.20 hold, spawn 1.00
- **`crystal_golem`** — attack 1.00/0.50, attack2 1.30/0.75, attack_big 1.90/1.01, roar 1.80, idle_alt 3.00, hit 0.50, knockback 1.00, knockdown 1.00 hold, getup 1.40, stun 2.00 loop, death 2.20 hold, spawn 2.40
- **`wolf`** — attack 0.80/0.35, attack2 0.95/0.34, attack_big 1.60/0.99, roar 1.30, howl 3.40, cast 3.40, idle_alt 2.40, yawn 2.00, scratch 2.60, shake 2.20, sit 1.00 hold, sleep 1.00 hold, hit 0.40, knockback 0.85, knockdown 0.80 hold, getup 0.90, death 1.50 hold, stun 1.80 loop, spawn 1.60
- **`boar`** — attack 0.90/0.45, attack2 0.90/0.41, attack_big 2.10/1.51, charge 1.00 loop, roar 1.30, idle_alt 2.60, snort 0.90, scrape 1.20, hit 0.40, knockback 0.85, knockdown 0.80 hold, getup 0.90, death 1.50 hold, stun 1.80 loop, spawn 1.60
- **`spider`** — attack 0.90/0.40, attack2 0.95/0.40, attack_big 1.70/1.09, spit 0.85/0.42, web 1.20/0.66, cast 1.60/0.96, roar 1.40, idle_alt 2.20, tap 0.80, leap 1.25/0.90, hit 0.40, knockback 0.85, knockdown 0.80 hold, getup 0.90, death 1.60 hold, stun 1.80 loop, spawn 1.60, spawn_drop 1.50
- **`crab`** — attack 0.60/0.27, attack2 0.90/0.34, attack_big 1.60/1.02, spit 0.80/0.40, roar 1.40, cast 1.30/0.72, idle_alt 2.40, clack 1.10, eyewipe 1.60, burrow 1.00 hold, hit 0.42, knockback 0.85, knockdown 0.80 hold, getup 0.80, death 1.50 hold, stun 1.60 loop, spawn 1.60
- **`treant`** — attack 1.30/0.72, attack2 1.40/0.84, attack_big 2.60/1.61, roar 2.00, cast 1.80/1.08, spit 1.40/0.70, hit 0.60, knockback 1.10, knockdown 1.20 hold, getup 2.00, death 3.00 hold, stun 2.20 loop, spawn 3.20, idle_alt 3.20, dormant 1.00 hold
- **`pip`** — hop 0.62, wave 1.50, cheer 1.30, dance 1.60 loop, bow 1.40, talk 1.20 loop, surprised 1.10, laugh 1.50, shy 1.80, think 2.20, spin 1.00, sit 0.60 hold, sleep 1.00 hold, pickup 1.00, attack 0.70/0.32, hit 0.45, death 1.30 hold, spawn 1.30, idle_alt 2.20, stun 1.60 loop, knockdown 0.70 hold, getup 0.80, knockback 0.70
- **`pip_seed`** — collect 0.90 hold, spawn 1.00, hit 0.40
- **`horse`** — rear 2.40, whinny 1.80, idle_alt 3.40, graze 5.20, shake 1.70, paw 2.20, swish 1.40, jump 1.15, hit 0.50, death 2.30 hold, spawn 1.60
- **`direwolf`** — attack 0.75/0.34, attack2 0.90/0.45, howl 3.20, rear 2.20, sniff 2.40, shake 1.90, jump 1.00, hit 0.50, knockback 0.85, stun 1.80 loop, death 2.00 hold, spawn 1.50, idle_alt 2.60
- **`sunstag`** — rear 2.60, call 2.00, bow 2.80, graze 4.60, shake 1.60, jump 1.30, hit 0.50, death 2.40 hold, spawn 1.80, idle_alt 3.20
- **`foxling`** — hop 0.55, happy 1.30, sit 1.00 hold, sleep 1.00 hold, pickup 0.80/0.36, wave 1.50, idle_alt 2.20, hit 0.45, death 1.20 hold, spawn 0.75
- **`owlet`** — hop 0.50, happy 1.40, sit 1.00 hold, sleep 1.00 hold, pickup 0.80/0.36, hoot 1.10, idle_alt 2.40, wave 1.40, hit 0.45, death 1.20 hold, spawn 0.75
- **`slimelet`** — hop 0.60, happy 1.30, sit 1.00 hold, sleep 1.00 hold, pickup 0.80/0.36, idle_alt 2.00, wave 1.40, hit 0.50, death 1.30 hold, spawn 0.80
- **`pip_pet`** — hop 0.62, wave 1.50, cheer 1.30, dance 1.60 loop, bow 1.40, talk 1.20 loop, surprised 1.10, laugh 1.50, shy 1.80, think 2.20, spin 1.00, sit 0.60 hold, sleep 1.00 hold, pickup 1.00, attack 0.70/0.32, hit 0.45, death 1.30 hold, spawn 1.30, idle_alt 2.20, stun 1.60 loop, knockdown 0.70 hold, getup 0.80, knockback 0.70, happy 1.00
- **`sea_serpent`** — attack 1.45/0.72, attack2 2.40/0.77, spit 1.10/0.55, attack_big 3.40/2.38, roar 2.20, hit 0.55, stun 2.40 loop, knockdown 1.00 hold, getup 1.40, death 4.50 hold, spawn 2.60, submerge 2.00 hold, idle_alt 3.20, look 3.60, emerge 2.60
- **`kraken_tentacle`** — attack 1.60/0.83, attack_big 3.20/2.18, grab 3.60/1.22, hit 0.50, roar 2.00, idle_alt 3.00, stun 2.60 loop, knockdown 1.00 hold, getup 1.30, death 4.00 hold, spawn 2.20, submerge 1.80 hold, emerge 2.20
- **`butterfly`** — perch 1.00 hold, flee 1.00 hold, flutter 1.60, hit 0.45, death 1.40 hold
- **`bird`** — hop 0.42, peck 0.80, flap 1.00, preen 2.40, look 1.80, flee 1.00 hold, hit 0.40, sing 1.80, death 1.20 hold, knockback 0.60
- **`seagull`** — peck 1.00, flap 1.50, preen 2.40, look 1.80, flee 1.00 hold, hit 0.40, squawk 1.60, death 1.30 hold, knockback 0.70
- **`rabbit`** — hop 0.50, graze 1.00 hold, nibble 2.00, situp 2.40, groom 2.60, thump 0.90, flee 1.00 hold, hit 0.35, knockback 0.60, stun 1.80 loop, death 1.50 hold
- **`cat`** — sit 1.00 hold, lie 1.00 hold, groom 3.00, stretch 2.40, pounce 1.30, hiss 1.60, meow 1.10, flee 1.00 hold, hit 0.35, knockback 0.60, stun 1.80 loop, death 1.50 hold
- **`chicken`** — peck 0.90, flap 1.20, look 1.80, flee 1.00 hold, hit 0.40, scratch 1.40, cluck 1.20, crow 2.20, jump 0.90, death 1.30 hold, knockback 0.70
- **`fish`** — jump 1.20, dart 1.00 hold, nibble 2.40, flop 1.60 loop, hit 0.40, death 2.50 hold, flee 1.00 hold

Skeleton attacks differ per weapon variant (listed: sword). Axe: attack 0.95/0.51, attack2 1.05/0.59, attack_big
1.90/1.29 · archer: attack (shoot) 1.05/0.73, attack2 0.62/0.31, attack_big (volley) 2.00/1.52 · bone_knight: attack
0.85/0.44, attack2 0.90/0.45, attack_big 1.80/1.19. Pets: `sit` / `sleep` hold until `stop()` / `play('idle')`;
`pickup` grabs at its hit time (remove the loot then). Pets and Pips squash & stretch through `pivot.scale` — don't write
it. `pip_seed.collect` holds (pop + fade) until removed. `rift_crystal.death` shatters: spires fly out and tumble,
the core flares and dies, fragments crumble away by ~1.9 s (natural speed).

## Integration notes (game side)
- **Rift crystals** (chaos stage 2): `src/game/modes/chaos.js` still sets `c.data.tpl = { model: 'pip_seed' }`; change it to
  `'rift_crystal'` (or delete the override — the unit's type already is `rift_crystal`). Height 2.4 m / radius 0.85 m
  match the unit; `spawn` grows it out of the ground, `death` shatters it (pairs with the `crystal_shatter` FX).
- **Push knocks**: `visuals.js` plays `knockdown` for `down`/`up` knocks; for `push` knocks call `model.play('knockback')`.
- **Corpses**: `setDissolve` burns a corpse away with ember edges (nicer than sinking); `play('spawn')` / `revive` reset it.
- **Mob stances**: pass `enraged` for enraged elites; `combat` whenever the mob has a target.

## Performance
- One draw call + one shadow draw per creature; geometry and program shared per type.
- Triangles: every mob ≤ 6k in its standard variants (imp 5974, hellhound 5794, legionnaire 5748, brute 5920,
  abyss_caster 5970, gargoyle 5898, skeleton 5902, wolf 5880, boar 5440, spider 5744, crab 5698, wraith 4576,
  crystal_golem 3090, wisp 659, rift_crystal 4968); elite variants (one per pack) 5.5–7.9k. Larger by design: `treant`
  (4.2 m elite) 8.0k, mounts 6.6–8.0k, `sea_serpent` 11.2–11.3k, `kraken_tentacle` 8.6–10.1k, Pip NPC 6.0–6.8k.
  Pets 2.4–3.1k, critters 0.6–1.5k.
- First build per type 20–80 ms in Chrome (the first type of a session pays ~100 ms extra for JIT + the shared detail
  texture); other variants of a type 2–30 ms (re-colour).
- Horde test (lab `?mode=horde`, 60 mobs: 26 imps, 14 hellhounds, 10 legionnaires, 4 casters, 4 gargoyles, 2 brutes,
  charging, attacking, flinching, dying, dissolving, respawning): 60 fps in headless Chrome at 1600×900 on a heavily
  loaded machine, creature update 0.8 ms/frame for all 60 (≈13 µs per mob), 103 draw calls, ~500k triangles including
  the shadow pass; build + spawn of all 60 = 233 ms.
- Update paths create no objects per frame (fixed-shape action / knob / leg records, typed-array parameters, preallocated
  vectors). What remains is V8 number boxing in the pose hooks — ≈0.1–0.7 KB per creature per frame, short-lived
  young-generation garbage.

## Authoring (def format)
A type is a plain object registered in `index.js` (or a sub-area map: `BEASTS`, `SPIRITS`, `MOUNTS`, `WILD`):
`{ name, variants, canFly?/flying?, mount?, pet?, autoFlinch?, config(variant, opts) → cfg (variant, pal, scale, h voxel size,
hg per-group voxel sizes, shapeKey, mat), rig(R), sculpt(S, cfg), paint(v, cfg), parts(acc, S, R, cfg), sockets,
height, radius, controller(inst, opts), actionList }`. Controllers: `BipedCtl`, `QuadCtl`, `HoverCtl` (ctl.js) driven by a
spec `{ bones, gait, actions, fidgets, pose(ctl, dt), post(ctl, dt), … }`, or a `BaseCtl` subclass for bespoke bodies.
Shared reactions in `acts.js` (`bHit`, `bKnockback`, `bKnockdown`, `bGetup`, `bDeath`, `bLie`, `bStun`, `bSpawn`, `bDrop`,
`bRoar`, `q*` for quadrupeds, `retime`, `kf`); leg helpers in ctl.js (`legsLocal`, `legsPlant`, `legsLie`, `armRot`).

## Lab
`node tools/lab.mjs src/lab/creatures.js` → `http://localhost:5299/lab/creatures.html`
- `?type=imp` single creature with a panel (type / variant / every action / speed / turn / state toggles)
- `&mode=lineup` (all variants, or `types=imp:red,brute:bile`), `&mode=strip&act=death&n=7` (filmstrip),
  `?mode=gallery` (every type), `?mode=horde` (60 mobs charging a hero proxy; fps / CPU readout; `count`, `types=imp:30,…`),
  `?mode=mount&type=horse` (placeholder rider on the `rider` socket), `?mode=ship&ship=pirate`
- params: `view=iso|orbit`, `light=day|dusk|dungeon|night`, `yaw` (deg), `speed`, `turn`, `combat=1`, `fly=1`,
  `down=1`, `dead=1`, `stunned=1`, `act=…`, `t=1.2` (advance & freeze), `cam=close|full|head`, `zoom`, `camPitch`, `camYaw`
- sub-area labs with extra modes: `creatures_beasts`, `creatures_spirits`, `creatures_mounts` (`mode=ride`, `mode=pets`),
  `creatures_wild`, `creatures_ships` (`ship=fleet`, `cam=side|bow|helm|…`, `fire=L`).
- `window.__cr` = `{ lab, list, stats, CREATURES, step(sec), state, horde }` for scripted captures.
