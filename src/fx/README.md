# FX — `src/fx/`

Every skill, impact, telegraph, damage number and ambient effect. Everything is procedural (textures are painted on
canvas at init, ~0.2 s), pooled and instanced; the per-frame path allocates nothing.

```js
import { FX } from './fx/index.js';
const fx = new FX(scene, { quality: 'high', heightAt: (x, z) => zone.heightAt(x, z) });   // heightAt optional
// every frame, AFTER the game moved its objects:
fx.update(dt, t, camera);
fx.applyScreen(renderer, isoCam);   // optional: pushes fx.screen (shake / flash / radial blur / aberration) into them
```

Constructor options: `quality: 'low'|'medium'|'high'|'ultra'` (particle density 0.45 / 0.75 / 1 / 1.25 and pool
sizes), `heightAt(x, z)` (ground height for placement; if the world sets `G.uHeightTex`, telegraphs/decals/rings/
particles conform to the terrain on the GPU automatically), `camera` (can also be passed per update).

Other members: `fx.setHeight(fn, groundY = 0)`, `fx.setLight(color)` (else smoke/dust lighting follows the scene's
hemisphere + sun), `fx.stats()`, `fx.reset()` (kill everything), `fx.dispose()`, `fx.PRESETS` (name → recipe),
`fx.has(name)`, `fx.onShake = (amount 0..1, pos) => {}` (called on big impacts), `fx.screen = { shake, flash,
flashCol, radial, radialX, radialY, aberration }` (decays every update; read it or call `applyScreen`).

## Conventions
- Metres, Y up, north = −Z. **`pos` is at the feet / on the ground** for anything ground-anchored; impacts (`hit`)
  take the hit point (a chest socket is fine — impacts are pulled 0.4 m toward the camera so they never hide inside a
  body). `slash` accepts either the feet (it lifts the pivot by `height`, default 1.0 m) or the pivot itself (any `pos`
  more than 0.45 m above the ground is used as the pivot).
- Positions: `Vector3`, `{x,y,z}`, `[x,y,z]` or an `Object3D` (its world position).
- `dir`: `Vector3` / `{x,z}` / `[x,z]` / number (facing yaw: forward = (−sin f, 0, −cos f)) / `Object3D`. Flattened to XZ.
- Colours: hex, css string, `THREE.Color`, linear `[r,g,b]` (HDR allowed — values > 1 bloom), or a palette name:
  `crimson gold holy light fire ember lava frost ice lightning storm chi arcane dark void demon shadow poison nature
  heal water music sand wind white foxfire rift brass rose teal silver cyan green red orange yellow blue purple pink`.
- Angles are radians; values > 6.3 are read as degrees (so `arc: 140` works).
- Handles: `{ alive, pos, dir, stop(fade?), setPos(v | x,y,z), setDir(d), setFill(v), detonate(), set(k, v) }`.
  Methods are safe after the effect ended (no-ops). One-shot calls return an inert handle (`alive: false`).
  `fx.play()` with an unknown name returns `null` (so callers can fall back).
- `attach` / `follow`: an `Object3D` to follow (loops auto-stop when it leaves the scene), or any object with `pos`
  `{x,z}` (e.g. a simulation unit). `unit`: the caster's model root (used by presets that need the caster).

## Primitives

| Call | Params (defaults) | Returns |
|---|---|---|
| `fx.slash(p)` | `pos, dir, radius (3), arc (2.6 rad; 'spin' 2π), color, intensity (2.2), width (radius·0.4; values ≤ 2 are a multiplier), dur (0.34), style: 'h'\|'v'\|'up'\|'d'\|'x'\|'spin'\|'thrust'\|'claw'\|'wave' (aliases sword/horizontal, vertical/overhead, diagonal, cross, uppercut, stab), flip, tilt (rad), height, delay, speed (travelling wave), dark (black body + burning rim), glow (true), sparks (true), sweep, grow, length (thrust)` | inert |
| `fx.burst(p)` | `pos, color, count (24), speed (6), size (0.3 m), life (0.5 s), kind: spark fire frost holy dark arcane lightning blood water poison dust sand smoke star feather note leaf petal ember heal crimson chi confetti coin shard debris, dir, spread, up, flash` | inert |
| `fx.shockwave(p)` | `pos, radius (6), color, dur, width (edge m), wall (radius ≥ 4), height, dust (true), dustColor, pressure (true), delay, from (start radius)` | inert |
| `fx.projectile(p)` | `from, dir \| to, speed, kind, color, size (visual radius m, 0.35), scale, range, arc (lob height m), homing (Object3D), onHit(pos), impact (true), delay, tilt` — kinds: `bolt bullet fire/fireball slug frost/ice/lance arcane holy dark/shadow lightning lightning_bolt lightning_dragon/dragon chi glaive wave blade/crescent note water/orb foxfire lava grenade rock blood`. If the caller writes `h.pos` / `h.setPos()` every frame the projectile becomes *driven* (no self-motion, no auto impact). | handle (`.pos`) |
| `fx.beam(p)` | `from, to (Vector3 or Object3D — followed), color, width, dur (1), kind: glow energy holy helix wave chain tracer lightning laser, strands, fade, speed/length (tracer)` | handle |
| `fx.lightning(p)` | `from, to, color, width (0.34), dur (0.35), strands (3), impact (true: flash + sparks + scorch)` | handle |
| `fx.meteor(p)` | `target, radius (3.5), color, delay/fall (1.1 s), telegraph (true), teleColor ('orange'), from, scale, onHit(pos)` | handle |
| `fx.decal(p)` | `pos, radius (2), kind, dur (per kind; Infinity = until stop), color, dir, length (fissure), intensity, fadeIn, hot (glow cool-down s), delay` — kinds: `scorch crack crater frost ice holy rune/arcane demon blood fissure lava/fire poison void water electric/lightning claw music nature/heal sun quake sigil swirl` | handle |
| `fx.aura(p)` | `attach, kind, color, scale, height (1.85·scale), radius (shield), dur (∞)` — kinds: `burst/crimson enrage demon holy/sanctity shield/bubble heal/regen water buff/atk fire/burn frost/freeze/frozen poison shock bleed speed/haste ghost counter stun chi music overload brand` | handle |
| `fx.trail(p)` | `attach (Object3D), tip (Object3D) or tipOffset (local Vector3) for a swept blade surface — else a camera-facing ribbon of width; color, width (0.35), life (0.2 s), dur, kind ('energy')` | handle |
| `fx.telegraph(p)` | see below | handle (`.stop()` cancel, `.setFill(0..1)`, `.detonate()`) |
| `fx.number(pos, value, o)` | `value`: number (thousands separators) or string. `o: { style, crit, scale, tag }` — styles `normal crit back head counter heal shield miss immune dot hurt stagger`. `crit: true` on any style gives the crit look; back/head add the orange tag, counter adds "COUNTER!". | — |
| `fx.hit(p)` | `pos, dir, crit, element (physical slash crimson blood fire frost/ice lightning holy light dark/shadow demon arcane chi water poison nature music earth sand wind), scale, back` | inert |
| `fx.death(p)` | `pos, kind: mob demon beast undead boss player, color, scale` | inert |
| `fx.portal(p)` | `pos, color, dir, radius (1.6), flat, spin, dur` | handle |
| `fx.lootBeam(p)` | `pos, grade (0-7 or name: common … primal), color, dur` | handle |
| `fx.pickup(p)` | `pos, kind: gold silver item hp mp seed shard xp, to (collector: sparks streak to it), color` | inert |
| `fx.counterWindow(p)` | `attach \| pos, dur (0.8), height (3), radius, scale` — shimmering blue flare, pulses and ground rings | handle |
| `fx.weather(kind, p)` | kinds `snow rain ash embers fireflies dust leaves petals`; `intensity (1), color, dur` — follows the camera focus, zero CPU per frame | handle |
| `fx.play(name, p)` | named composite effect (below) | handle / inert / null |

### Telegraphs
```js
fx.telegraph({ shape: 'circle'|'cone'|'rect'|'line'|'donut'|'wedges', pos, dir, radius, inner, angle, width, length,
               color: 'red'|'orange'|'blue'|'purple'|'yellow'|'white' | any colour, dur, delay,
               count (wedges, 8), phase (0|1: which alternate wedges), fill (true), reverse, detonate (true),
               intensity (1), follow, onDetonate(pos) })
```
- Colour language: **red** damage zone · **orange** must-dodge / heavy · **blue** counter window · **purple** stagger
  check / wipe · **yellow** safe spot / shield · **white** neutral marker.
- With `dur`: a dark translucent zone whose fill grows from the origin (centre for circles, apex for cones, start for
  rects/lines, inner edge for donuts; `reverse` fills inward) with a bright front, a crisp HDR rim and an outer glow;
  when full it detonates (flash) and fades. Without `dur` it is a persistent pulsing marker until `.stop()`.
- `rect`/`line` run from `pos` along `dir` for `length` (line = narrow rect, width 1.8 default).
- `cone`: `radius` (or length) and full `angle` (radians or degrees). `donut`: `radius` outer, `inner`.
- `wedges`: the 8-wedge "rift carve" pie; alternating wedges are active, `phase` flips them.
- "Spike line" (sequential circles) is the preset `spike_line`.
- One instanced draw call for all telegraphs; per-frame CPU cost is zero (analytic timing).

## Presets — `fx.play(name, params)`
Common params: `pos` (caster feet / centre), `dir`, `target` (aim point; default ahead), `attach`/`follow`/`unit`,
`color`, `scale`, `big` (×1.35), `radius`|`r`, `len`|`length`, `width`, `dur`. Loops return a handle — call `.stop()`
(they also end after `dur`). Names in *italics* are aliases.

**Reaver** — `greatsword_cleave` (*cleave*; radius 4.2, arc, flip) · `crimson_wave` (*wave*, *red_dust*; len 9, width,
speed, buff) · `aura_burst` · `whirlwind` loop (*whirl*, *sword_storm*; follows attach/follow; radius) · `leap_slam`
(pos → target, lands in `crater`) · `crater` (*ground_slam*; r) · `ground_crack` (len) · `chain_throw` (*chain*,
*chain_sword*; len/target) · `hell_blade` · `mountain_cleave` · `wind_blade` (two crescent blades) · `strike_wave` ·
`burst_mode` (identity eruption + 2.5 s crimson aura on attach/unit) · `crimson_finale` · `dash_trail` (follows unit).

**Oathkeeper** — `holy_nova` (radius 6) · `light_pillar` (*wrath_of_heaven*; target) · `sanctuary_zone` loop
(*heavenly_blessing*; radius 5, dur 6) · `shield_bubble` (*holy_bulwark*; attach or `targets: [Object3D…]`, dur 4) ·
`brand_mark` (attach, dur 8) · `holy_explosion` (target) · `heal_burst` (*rite_of_mending*) · `cleanse` ·
`identity_burst` · `sacred_chain`.

**Stormfist** — `chi_palm` · `thunder_palm` (len) · `chi_burst` (r) · `lightning_burst` (r) · `lightning_bolt` (sky
bolt) · `lightning_strike` (*lightning_pillar*; r: several bolts) · `lightning_aura` (follow, dur) · `lightning_trail`
(follows unit, or along len) · `lightning_dragon` (*storm_dragon_upper*; spirals up then crashes) · `tiger_dash`
(*thunder_tiger*, *soaring_tiger*; len, width) · `flurry_sparks` loop (*tempest_barrage*; dur) · `punch` · `kick` ·
`dragon_kick` (*moonflash_kick*, *lightning_kick*) · `ground_quake` · `fire_palm` (*blazing_fist*) · `flame_pillar`.

**Pistoleer** — `muzzle_flash` (`weapon: 'pistol'|'shotgun'|'rifle'`, `muzzle` point or `sockets.weaponTip`) ·
`bullet_tracer` (to/target) · `sniper_round` (*perfect_shot*, *focused_shot*) · `sniper_impact` · `grenade` (target) ·
`dragon_shot` · `dual_buckshot` · `last_request` · `spiral_tracker` (homing) · `equilibrium` loop (*shotgun_rapid*) ·
`target_down` · `catastrophe` (target, radius) · `explosion` · `explosion_big`.

**Starcaller** — `meteor_rain` loop (*doomfall*; target, radius 5, dur 3, every) · `fire_nova` (*blaze_nova*) ·
`frost_lance` (len) · `frost_nova` (radius) · `blizzard` loop (*hail*, *seraphic_hail*; target, radius, dur) ·
`punishing_bolt` · `lightning_vortex` loop · `black_hole` (*void_rift*; target, radius, dur 2.2 — implodes on end) ·
`rune_detonation` (*esoteric_rune*; target, delay) · `starfire_explosion` · `teleport_blink` (*blink*; pos → to/target) ·
`inferno_wave`.

**Songweaver** — `harp_note_wave` (*sound_shock*) · `orbiting_notes` (*harp_of_rhythm*; attach, dur) ·
`music_buff_ring` (*heavenly_tune*, *anthem_of_courage*) · `heal_zone` loop (*hymn_of_mending*; radius, dur) ·
`sonic_vibration` (*soundholic*; target) · `rhapsody_of_light` · `guardian_tune` · `wind_of_music` · `stigma`.

**Bladedancer** — `blade_storm` loop (*maelstrom*, *blade_dance*; target or attach, radius, dur) · `blade_dash`
(*blitz_rush*; afterimages to target) · `shadow_step` · `surge_dash` (*surge*; `orbs` 0-3) · `void_strike` ·
`spincutter` · `moonlight_sonic` · `dark_order`.

**Demonbound** — `demon_transform` (*demonform*; + 3 s demon aura on attach/unit) · `dark_slash` (*demonic_slash*) ·
`abyss_claw` (*rending_talons*, *claw_swipe*) · `blood_pillars` (target, count 5) · `demolition` (len) · `fear_howl`
(*howl*) · `cruel_cutter` (thrown glaive) · `hellfire_wings` · `demonic_slam` · `dark_burst`.

**Awakenings** (screen-filling; pos = caster, target = aim) — `awk_world_split` (*worldsplitter*; fissure from the
caster/unit toward pos/target, len) · `awk_radiant_sword` (*radiant_judgment*; a sword of light falls from heaven) ·
`awk_heavenly_dragon` (*heavens_fury*) · `awk_bullet_hell` (*last_rites*) · `awk_stellar_collapse`
(*stellar_collapse*) · `awk_grand_finale` (*grand_finale*; party dome) · `awk_thousand_cuts` (*thousand_cuts*) ·
`awk_abyssal_gate` (*abyssal_rupture*) · `awaken_aura` (*awakening*; generic activation) · `time_stop`.

**Bosses** — `frost_breath` / `fire_breath` / `dark_breath` loops (pos = boss feet, `mouth` Object3D or `from`,
dir, len 12, angle 0.9, dur 2) · `ice_spike_eruption` (*ice_spike*; pos or `points`) · `ice_shatter` ·
`crystal_shatter` · `frost_burst` · `absolute_zero` · `wing_gust` (angle) · `wind_burst` (*whoosh_big*) ·
`siren_scream` · `roar_ring` (*boss_roar*) · `lava_pool` loop (*zone_lava*) · `lava_spit` (target, pool) ·
`fire_burst` · `tail_flame_whip` (flip) · `tail_sweep` · `foxfire_orbs` loop (count, launch) · `charge_dust` loop
(*horn_charge*; follow the charger) · `dust_burst` · `burrow_plume` · `sandstorm` · `water_orb` · `tentacle_slam` ·
`eye_beam` (from/mouth, sweepFrom/sweepTo or target + len, dur) · `axe_shockwave` (len) · `impact_heavy` ·
`slash_heavy` · `bite` · `monster_hit` · `rift_carve` (8-wedge telegraph + eruption; count, phase, delay, second) ·
`ghost_mist` loop · `enrage` · `spike_line` (len, radius, kind: ice|fire|blood|rock, step, warn).

**Utility** — `counter_hit` · `stagger_break` · `part_break` (`part` Object3D or pos + height) · `level_up` ·
`revive` · `spawn_puff` · `footstep_dust` (*dust_puff*).

**Zones** (loops; pos, r, dur 4) — `zone_fire` `zone_lightning` `zone_holy` `zone_heal` `zone_frost`/`zone_ice`
`zone_poison` `zone_dark`/`zone_void` `zone_music` `zone_water` `zone_lava` `zone_generic`.

**Ambient** (loops at pos or attach; scale) — `torch` `brazier` `campfire` `fountain` (basin) `forge_sparks` (rate).

## Budget / performance
One `THREE.Group` (`fx.group`). Draw calls (only while something of that kind is alive): particles 2, slashes 1,
telegraphs 1, decals 1, rings 2, ribbons (trails + beams + lightning + chains + tracers) 1, rocks 1, crystals 1,
bubbles 1, pillars 1, portals 1, props ≤ 7, numbers 1 — ≤ 21 total. Particles are written once at spawn and animated
on the GPU; telegraphs/decals/slashes/rings/numbers/debris are analytic instanced buffers (written once).
