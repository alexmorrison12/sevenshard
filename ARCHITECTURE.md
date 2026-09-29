# SEVENSHARD — architecture & conventions (read before writing code)

Plain ES modules under `src/`, bundled by esbuild into ONE self-contained HTML file. three.js r186
(`import * as THREE from 'three'`, addons via `three/addons/...`). Only other runtime dependency: `peerjs` (net).
No external assets, fonts, CDNs or network fetches: every model, texture, sound, icon and song is generated in code at
load time (lazily, cached). Read `DESIGN.md` for the game itself (names, classes, bosses, zones, look).

## Build, labs, screenshots
- `node build.mjs` → `dist/index.html` (the game). `--min` for release, `--watch` while developing.
- **Lab pages** for isolated work: create `src/lab/<name>.js` starting with `createLab()` from `src/lab/kit.js`,
  build with `node tools/lab.mjs src/lab/<name>.js` (add `--watch` to rebuild on save) → `dist/lab/<name>.html`.
- A static server is already running: `http://localhost:5299/lab/<name>.html`
  (if not: `node tools/serve.mjs dist 5299 &`).
- Screenshot (headless Chrome, real GPU): `node tools/shot.mjs <url> <out.png> [--w=1600 --h=900 --wait=3000]
  [--eval="js"] [--evalAfter="js"] [--shots=4 --every=500] [--mobile]` then LOOK at the PNG with the Read tool.
  `window.__lab.lab` is the lab object (`setView('iso'|'close'|'orbit'|'front'|'side'|'top')`, `setLight(...)`,
  `step(n)`, `scene`, `panel`). URL params: `?view=iso&light=dusk&q=high`.
  Put screenshots in the scratchpad: `source tools/env.sh` sets `$SP`.
- **Iterate visually.** Judge every asset at the game camera (`view=iso`, ~21 m away, looking north at 54° pitch —
  a 1.85 m hero is ~110 px tall at 1600×900) AND in close-up. Do at least three look-fix-look rounds. Do not stop at the
  first version that renders.

## Ownership (do not edit files you do not own; additive exports only in shared files)
| Area | Owner | Entry |
|---|---|---|
| `build.mjs`, `tools/`, `src/main.js`, `src/index.html`, `src/core/`, `src/engine/`, `src/game/`, `src/net/`, `src/meta/`, `src/data/` | lead | — |
| `src/models/kit/` (shared SDF sculpt + rig toolkit, from Everdawn) | shared: add new exports, never change existing behaviour | `kit/*.js` |
| `src/models/hero/` | heroes | `hero/index.js` |
| `src/models/creatures/` | creatures | `creatures/index.js` |
| `src/models/bosses/legion/` | legion bosses | `bosses/legion/index.js` |
| `src/models/bosses/guardians/` | guardian bosses | `bosses/guardians/index.js` |
| `src/world/` | world | `world/index.js` |
| `src/fx/` | fx | `fx/index.js` |
| `src/audio/` | audio | `audio/index.js` |
| `src/ui/` (except `src/ui/icons/`) | ui | `ui/index.js` |
| `src/ui/icons/` | icons | `ui/icons/index.js` |
| `src/lab/<yourarea>*.js` | you | — |

Every owner writes `src/<area>/README.md` documenting the public API exactly as implemented (the lead integrates from it).
**Deliver early:** create your entry module with the contract below and a crude-but-working implementation first, so
integration can start; then raise quality. Keep the contract stable; extend it rather than change it.
Everdawn (`/Users/alex/Claude/MMOTest/src`, read-only) is a previous game by the same team — its humanoid SDF bodies,
creature toolkit, dragon, FX, audio synth and UI code are proven and may be copied and adapted freely.

## World conventions
- Metres, Y up. +X east, +Z south; **north = −Z**. The game camera looks north (toward −Z) from the south, pitched 54°.
- **Every model faces −Z in its local space** (Everdawn convention). The game sets `root.rotation.y = facing`; the
  forward vector is `(−sin facing, 0, −cos facing)`. At `facing = 0` a hero shows the camera its back.
- Scale: a hero is ~1.85 m tall (heroic, ≈7.5 heads, broad shoulders, oversized weapons). Imps ~1 m, legionnaires 2.2 m,
  guardians 6–15 m, Gorrath ~7 m.
- Colours in vertex buffers are LINEAR (`linColor(hex)` from `src/engine/geom.js`). Materials take hex.
- Emissive / MeshBasic colours above 1.0 bloom (the renderer does HDR → bloom → tone map). Use this for glow.

## Rendering
- `src/engine/renderer.js`: HDR MSAA → UnrealBloom → final pass (Khronos neutral tone map, grade, vignette, hurt/flash,
  aberration, radial blur, letterbox). Zones set `renderer.grade = {...GRADE_DEFAULT, ...}`.
- Materials: `lambert(params, opts)` / `stylize(mat, opts)` from `src/engine/materials.js` (Lambert + wrap lighting,
  optional `spec`/`shine`, `rim`/`rimColor`, `trans` foliage, height fog, shared uniforms `G`). Works with skinning,
  instancing, vertex colours, shadows. Set a unique `opts.key` per distinct shader variant. MeshStandardMaterial is
  allowed for hero armour metal if it clearly looks better (keep counts low).
- Do not use `scene.fog`. Fog is the shared height fog in `G` (`uFogColor`, `uFogDensity`, `uFogHeight`, `uFogBase`).
- Shadows: one directional sun with a tight frustum that follows the player. Everything that stands up casts; ground receives.
- Shared helpers: `src/engine/geom.js` (MeshBuilder with vertex colours, tube, blob, mat4), `src/engine/paint.js`
  (procedural painted tileable textures), `src/core/noise.js` (RNG, Simplex, clamp, lerp, smoothstep, damp...),
  `src/models/kit/` (SDF sculpt → surface nets → skinned mesh with baked AO; Rig/Pose FK + 2-bone IK).

## Performance budgets (M1 laptop, 1600×900, "high")
- 60 fps with: hero + 3 party members + 60 mobs (chaos dungeon) or 8 players + boss (raid) + heavy skill FX.
- Draw calls < 400, triangles < 1.5 M in a busy scene. Hero ≤ 25k tris (crowd LOD ≤ 6k), mob ≤ 6k, boss ≤ 60k.
- Model build time: first hero of a kind < 250 ms, cached afterwards; boss < 600 ms; zone < 2.5 s (yield with `await`).
- No per-frame allocations in hot paths; share geometries/materials between instances.

## Contracts

### Heroes — `src/models/hero/index.js`
```js
createHero({
  cls: 'reaver'|'oathkeeper'|'stormfist'|'pistoleer'|'starcaller'|'songweaver'|'bladedancer'|'demonbound'|null,
  sex: 'm'|'f',
  look: { face: 0-5, hair: 0-7, hairColor: hex, skin: 0-7, eyes: hex, height: 0.94-1.06, build: 0-1, marks: 0-3, markColor: hex },
  gear: { tier: 0|1|2, dye: [hex, hex, hex] },   // 0 story, 1 Vanguard, 2 Horned Tyrant legion set (glowing)
  weapon: { tier: 0|1|2, hone: 0-25 },           // +15 and up gets an ever stronger glow
  npc: null | 'guard'|'knight'|'noble'|'king'|'oracle'|'merchant'|'blacksmith'|'sailor'|'pirate'|'bandit'|'cultist'|'priest'|'bard'|'farmer'|'fisher'|'villager'|'child',
  lod: 'full'|'crowd',
}) → hero
hero.root  hero.height  hero.radius
hero.sockets  // { handR, handL, weapon, weaponTip, back, head, chest, feet, overhead } Object3Ds for FX/attachments
hero.update(dt, state)  // state: { speed (m/s along facing), turn (rad/s), combat, dead, down (knocked down), stunned,
                        //          mounted, sit }  — drives locomotion + idles, blends with one-shots
hero.play(action, { dur, loop }) → { dur }   // one-shot (or looped until the next play / stop()) layered action
hero.stop()                                  // end a looped action
hero.setTint(hex, amount)                    // hit flash, ghost, freeze tint
hero.setGlow(hex, intensity)                 // weapon/identity glow (Burst Mode, Overload…)
hero.setStance('pistol'|'shotgun'|'rifle')   // Pistoleer weapon swap
hero.setDemonForm(on)                        // Demonbound transformation (bigger, horns, wings, claws, dark aura)
hero.setLook(look) / hero.setGear(gear)      // creation screen live edits (may rebuild internally)
hero.dispose()
```
Actions (weapon-aware poses; `dur` stretches the move; hits land around 40–60% unless noted):
- utility: `dash`, `dash_back`, `hit`, `hit_heavy`, `knockdown` (stays down until `getup`), `getup`, `stun` (loop),
  `death` (holds), `revive`, `interact`, `pickup`, `use_item` (drink), `throw`, `victory`, `transform`, `awaken`, `identity`
- attacks: `atk1` `atk2` `atk3` (basic combo), `slash_h`, `slash_v`, `slash_up`, `slash_x`, `thrust`, `spin`,
  `spin_loop`, `leap` (rise, hang), `slam` (land), `charge_hold` (loop), `charge_release`, `dash_strike`, `uppercut`,
  `punch_loop`, `kick_high`, `kick_spin`, `kick_flip`, `palm`, `ground_punch`, `shoot`, `shoot_dual`, `shoot_loop`,
  `shotgun`, `rifle_aim` (loop), `rifle_fire`, `cast`, `cast_up`, `cast_ground`, `channel` (loop), `summon`, `strum`,
  `strum_big`, `harp_loop`, `throw_weapon`, `pull`, `buff`, `block` (loop), `taunt`, `vanish`, `appear`
- life & social: `gather`, `chop`, `mine`, `dig`, `fish_cast`, `fish_idle` (loop), `fish_reel`, `play_instrument` (loop),
  emotes `wave`, `bow`, `dance` (loop), `cheer`, `clap`, `laugh`, `cry`, `salute`, `point`, `flex`, `sit` (loop),
  `sleep` (loop), `shrug`, `facepalm`, `kneel`, `think`, `heart`, `angry`, `yes`, `no`

### Creatures — `src/models/creatures/index.js`
```js
createCreature(type, { variant, scale, tint, elite, seed }) → c
c.root c.height c.radius c.sockets { head, mouth, center, back, handR?, handL?, rider? }
c.update(dt, { speed, turn, combat, dead, down, stunned, fly })
c.play(action, { dur, loop }) → { dur }   // attack, attack2, attack_big, cast, spit, roar, hit, knockback, knockdown,
                                          // getup, death, spawn (emerge), idle_alt
c.setTint(hex, amount)  c.dispose()
CREATURES = { [type]: { name, height, radius, flying?, actions: [...] } }
createShip(type) → { root, sockets: { helm, wake, cannonsL: [], cannonsR: [] }, update(dt, { speed, turn, sail }), fire(side), dispose() }
```
Types: demons `imp`, `hellhound`, `legionnaire`, `brute`, `abyss_caster`, `gargoyle`; `skeleton`, `wraith`;
beasts `wolf`, `boar`, `spider`, `crab`, `treant`; `crystal_golem`, `wisp`; Pips `pip` (variants elder, child,
merchant, guard, farmer) and `pip_seed` (collectible); sea `sea_serpent`, `kraken_tentacle`; mounts `horse`
(variants), `direwolf`, `sunstag` (rider socket, walk/run gaits); pets `foxling`, `owlet`, `slimelet`, `pip_pet`;
critters `butterfly`, `bird`, `seagull`, `rabbit`, `cat`, `chicken`, `fish`. Ships: `dawnrunner` (player), `pirate`,
`ghost`, `merchant`.

### Bosses — `src/models/bosses/{legion,guardians}/index.js`
```js
createBoss(id, opts) → b
b.root b.height b.radius b.sockets { head, mouth, chest, handR, handL, weapon, weaponTip, parts: {…} }
b.update(dt, { speed, turn, dead, groggy, enraged, fly, burrowed, ghost })
b.play(action, { dur }) → { dur, hits: [seconds…] }   // hits = impact moments (scaled with dur)
b.setGlow('counter'|'enrage'|'ghost', 0..1)          // counter = shimmering blue windup highlight
b.breakPart(name)                                    // e.g. Gorrath 'hornL'/'hornR'
b.setTint(hex, amount)  b.dispose()
BOSSES = { [id]: { name, title, height, radius, actions: { [name]: { dur, hits: [...] } } } }
```
Legion: `gorrath`, `skarn`, `vesk`, `varkhul`, `ashmaw`, `gatekeeper`. Guardians: `rimewing`, `cinderhorn`,
`sandmaw`, `kurai`, `nerissa`, `deep_oracle`, `thunderhoof`. See DESIGN.md §7 and the brief for each boss's moves.

### World — `src/world/index.js`
```js
await buildZone(id, { quality, seed }) → zone
zone.root                               // THREE.Group, the game adds it to the scene
zone.env = { sunColor, sunIntensity, sunDir: [x,y,z], hemiSky, hemiGround, hemiIntensity, fogColor, fogDensity,
             fogHeight, background, grade: {...}, music, ambience, weather }
zone.heightAt(x, z)                     // ground height
zone.nav = { cell, w, h, x0, z0, data } // Uint8Array, 1 = walkable
zone.walkable(x, z)
zone.anchors = { spawn: {x, z, facing}, 'npc:blacksmith': {...}, 'portal:chaos': {...}, ... }
zone.regions = [{ name, x, z, r }]       // minimap/area labels
zone.minimap = { canvas, x0, z0, size }  // painted top-down map
zone.update(dt, t, focus, camera)       // water, foliage wind, flags, torches, ambient critters
zone.dispose()
ZONES = { [id]: { name, kind: 'city'|'field'|'dungeon'|'arena'|'sea'|'island'|'stronghold', size } }
```

### FX — `src/fx/index.js`
```js
const fx = new FX(scene, { quality })
fx.update(dt, t, camera)
fx.play(preset, params) → handle        // named composite effects ('meteor_strike', 'holy_nova', ...), see fx/README.md
fx.slash({ pos, dir, radius, arc, color, width, dur, style })   fx.burst({ pos, color, count, speed, size, life, kind })
fx.shockwave({ pos, radius, color, dur })   fx.projectile({ from, dir|to, speed, kind, color, size }) → handle (.pos, .stop())
fx.beam({ from, to, color, width, dur, kind })   fx.lightning({ from, to, color })   fx.meteor({ target, radius, color })
fx.decal({ pos, radius, kind, dur })   fx.aura({ attach, kind, color }) → handle   fx.trail({ attach, color, width }) → handle
fx.telegraph({ shape: 'circle'|'cone'|'rect'|'donut'|'line', pos, dir, radius, inner, angle, width, length,
               color: 'red'|'orange'|'blue'|'purple'|'yellow'|'white', dur }) → handle
fx.number(pos, value, { style: 'normal'|'crit'|'heal'|'shield'|'counter'|'miss'|'back'|'head', scale })
fx.hit({ pos, dir, crit, element })   fx.death({ pos, kind, color })   fx.portal({ pos, color }) → handle
fx.lootBeam({ pos, grade }) → handle   fx.pickup({ pos, kind })   fx.counterWindow({ attach, dur })
```

### Audio — `src/audio/index.js`
```js
const audio = createAudio()      // lazily unlocks on first user gesture
audio.sfx(name, { pos, vol, pitch })   audio.music(track)   audio.stinger(name)   audio.ambience(kind)
audio.song(id) → seconds         // in-world instrument performance for the Songs feature
audio.listener(pos)              audio.setVolumes({ master, music, sfx, ambience })
```

### UI — `src/ui/index.js` and icons — `src/ui/icons/index.js`
DOM + CSS (every `.css` file under `src/` is inlined by the build). The UI is driven by plain data objects and emits
actions through a callback; it never reaches into game internals. Data shapes below; `ui/README.md` documents the rest.
```js
const ui = createUI(document.body, { onAction(type, payload) {} })
ui.screen(name, data)         // 'title' | 'charselect' | 'create' | 'loading' | 'game' | 'results' | 'death'
ui.hud.update(hud)            // ~15×/s, full HudState (diffed internally)
ui.banner(text, opts)  ui.toast(text, kind)  ui.chat.add(msg)  ui.dialog(npc, script) → Promise
ui.open(window, data)  ui.close(window)  ui.toggle(window)  ui.update(window, data)
icon(id, size) → dataURL (cached)   // 'skill:<class>:<key>', 'item:<kind>', 'currency:<id>', 'engr:<id>', 'status:<id>', 'class:<id>', 'ui:<id>'
```

## Shared data shapes (UI, net, save)
```js
Item = { uid, id, name, kind: 'weapon'|'armor'|'accessory'|'stone'|'bracelet'|'gem'|'card'|'material'|'consumable'|
         'battle'|'book'|'mount'|'pet'|'cosmetic'|'currency'|'gift'|'food'|'quest'|'collectible',
         slot?: 'weapon'|'head'|'shoulder'|'chest'|'pants'|'gloves'|'necklace'|'earring'|'ring'|'stone'|'bracelet',
         grade: 0..7, icon, iLvl?, hone?, quality?, stats?: { atk, hp, crit, spec, swift, dom, endur, expert, might },
         engr?: [{ id, v }], neg?: { id, v }, facets?: [[1,0,…],[…],[…]], set?, bound?: 'char'|'roster', count, desc, value }
Skill = { id, name, icon, type: 'Normal'|'Combo'|'Chain'|'Holding'|'Charge'|'Casting'|'Point'|'Toggle', key, cd, cdLeft,
          mana, level, maxLevel, desc, stagger, weakPoint, counter, attack: 'Back'|'Head'|null, superArmor,
          tripods: [[{ id, name, icon, desc, unlock, picked }] ×3 tiers] }
HudState = { hp, hpMax, shield, mp, mpMax, level, xp, xpMax, iLvl,
  identity: { kind: 'gauge'|'orbs'|'stance'|'bubbles'|'demon', value, max, orbs, maxOrbs, stance, active, activeLeft, label },
  skills: [Skill|null ×8], awaken: Skill, dash: { cd, cdLeft, charges }, items: [{ id, icon, count, cd, cdLeft } ×4],
  buffs: [{ id, icon, name, left, stacks, debuff }], target, party: [{ name, cls, hp, hpMax, shield, dead, you, support }],
  boss: null | { name, title, hp, hpMax, barHp, stagger: null|{ v, max }, destruction: null|{ v, max }, enrageLeft, counter, buffs },
  quests: [{ id, title, kind: 'msq'|'side'|'daily'|'event', steps: [{ text, n, need, done }] }],
  zone: { name, sub }, minimap: { canvas, x0, z0, size, you: {x, z, facing}, markers: [{ x, z, kind, label }] },
  progress: null | { label, pct }, timer: null | { label, left }, currencies: { silver, gold, crystals } }
```
