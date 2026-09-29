# models/hero — SEVENSHARD heroes

Entry: `src/models/hero/index.js` (contract: ARCHITECTURE.md › Heroes).
Lab: `node tools/lab.mjs src/lab/heroes.js` → `http://localhost:5299/lab/heroes.html`
(`?mode=single|lineup|lineup2|tiers|npcs|crowd`, `&cls= &sex= &tier= &npc= &lod=crowd`, `&cam=cbody|cface|full|face|tq|side|iso2`,
`&studio=1` adds the creation-screen key/rim lights, `&act=slash_h&at=0.5` freezes an action, `&nopanel=1`).

Everything is procedural: bodies and heads are SDF sculpts meshed with surface nets and QEM-decimated, armour is
SDF shells fitted to the body, cloth panels / capes / coats are swept sheets, hair is lock-based SDF, faces are painted
canvases, weapons are extruded/lathed parts. All geometry is cached per body kind; a hero is one skinned mesh plus one
rigid mesh per weapon.

```js
import { createHero } from './models/hero/index.js';
const h = createHero({ cls: 'reaver', sex: 'm', gear: { tier: 1 }, weapon: { tier: 1, hone: 15 } });
scene.add(h.root);
h.update(dt, { speed, turn, combat });        // every frame; dt = 0 holds the pose (hit-stop)
const { dur, hits } = h.play('slash_h', { dur: 0.8 });   // hits = impact times in seconds
```

## createHero(opts) → hero

| opt | values | default |
|---|---|---|
| `cls` | `'reaver' 'oathkeeper' 'stormfist' 'pistoleer' 'starcaller' 'songweaver' 'bladedancer' 'demonbound' null` | `'reaver'` |
| `sex` | `'m' 'f'` | `'m'` |
| `look` | `{ face 0-5, hair 0-7, hairColor hex, skin 0-7 (index into SKIN_TONES) or hex, eyes hex, height 0.94-1.06, build 0-1, marks 0-3, markColor hex, beard 0-5 }` | per class & sex (`DEFAULT_LOOK`) |
| `gear` | `{ tier: 0 \| 1 \| 2, dye: [primary, secondary, trim] }` | `{ tier: 1 }` |
| `weapon` | `{ tier: 0 \| 1 \| 2, hone: 0-25 }` (tier defaults to gear.tier) | `{ hone: 0 }` |
| `npc` | one of `NPCS`, or a named character from `NPC_NAMED` (`'brannoc'`, `'seraphine'`); overrides `cls` | `null` |
| `lod` | `'full'` (player / party / creation screen) · `'crowd'` (other players, extras) | `'full'` |
| `seed` | NPC look variant (face, hair, skin, colours); without it every new NPC gets the next variant | auto |

- `look.face`: male presets `Valiant, Rugged, Youthful, Noble, Veteran, Fierce`; female `Radiant, Gentle, Keen, Regal,
  Valkyrie, Sprite` (`FACE_PRESETS`). Each changes the head sculpt (jaw, chin, cheekbones, brow, nose, lips, eye shape)
  and the painted details (brow shape, stubble, scar, mole, freckles, blush).
- `look.hair` (`HAIR_STYLES`): m `swept short long ponytail topknot mohawk backbraid bald`;
  f `fem_long fem_ponytail fem_bun fem_braids fem_bob fem_pigtails fem_buns fem_swept`. Hats/helmets swap tall styles
  for a flatter cut; hoods hide the hair.
- `look.beard` (extension, men only, `BEARD_STYLES`): `none goatee full braided mustache chops`.
- `look.marks`: 0 none, 1 war paint, 2 tribal, 3 arcane (coloured by `markColor`).
- Palettes for pickers: `SKIN_TONES` (8), `HAIR_COLORS` (10), `EYE_COLORS` (8), `MARK_COLORS` (6).

## hero

- `root` — THREE.Group at the feet (y = 0). The model faces −Z; set `root.rotation.y` for facing.
- `height` (m, ≈1.87 male / 1.78 female × look.height; children ≈1.3) · `radius` (m)
- `sockets` (Object3D; add FX/props to them):
  `handR`, `handL` (fist grip frames, +Y along a held weapon), `palmL` (flat palm, harp/tome), `weapon` (origin of the
  weapon in hand), `weaponTip` (blade tip / muzzle / staff head of the active weapon; talons in demon form),
  `back`, `head` (eye level), `chest`, `feet` (ground, root), `overhead` (above the head, for nameplates).
- `update(dt, state)` — `state: { speed (m/s along facing), turn (rad/s), combat, dead, down, stunned, mounted, sit }`.
  Idle ↔ walk ↔ run ↔ sprint by speed with turn lean; `combat` draws the weapon (draw/sheathe gesture ≈0.4 s; attacks
  draw instantly); `dead` falls and holds; `down` lies (knockdown), `stunned` sways, `sit` / `mounted` hold seated poses.
  Springs drive capes, coats, hair, braids, beards, skirt flaps and ribbons; eyelids blink.
- `play(action, { dur, loop })` → `{ dur, hits }`; `hits` are impact times in seconds (already scaled to `dur`).
  Unknown names return `{ dur: 0, hits: [] }`. Actions are weapon-aware (anticipation → strike → follow-through),
  cross-fade 0.12 s, drive the full body when standing and the upper body over locomotion when moving (moves such as
  `dash`, `dash_strike`, `leap` always drive the legs). `hit` is an additive flinch that never interrupts.
  Loops run until the next `play` or `stop()`; holds (`death`, `knockdown`, `leap`, `kneel`) keep their last frame.
- `stop()` — ends a looped action (blends back to idle).
- `setTint(hex, amount)` — flat colour mix (hit flash, freeze, ghost); 0 clears.
- `setGlow(hex, intensity)` — identity / burst glow: fists, weapon edges and a soft rim (capped so ≥3 doesn't wash out).
- `setStance('pistol' | 'shotgun' | 'rifle')` — Pistoleer weapon swap (twin pistols from the thigh holsters, shotgun
  and rifle slung on the back; the stance changes the combat idle, locomotion arms and all gun moves).
- `setDemonForm(on)` — 0.45 s transformation: body ×1.18, skin and armour darken to a violet-black with glowing veins,
  black eyes with burning irises, swept horns with glowing tips, bat wings (fold, breathe, flap faster when moving),
  talons on both hands (the glaive is put away; `weaponTip` moves to the right talons; moves switch to the `claws`
  family), smoke-and-ember aura. Works on any class; meant for Demonbound.
- `setLook(look)`, `setGear(gear)`, `setWeapon(weapon)` — live edits for the creation screen (rebuilds from caches:
  ≈1–2 ms when cached, see perf).
- `dispose()` · `stats` `{ tris, verts, drawCalls, ms, phases, parts }` · `weapons` · `actions()` (every action name).

Other exports: `CLASSES` (name, role, weapon, move family, accent colour), `NPCS`, `NPC_NAMED`, `NPC_PRESETS`,
`warmHero(opts)` (build caches synchronously), `warmHeroes(list, { gapMs })` (async, one hero per task),
`defaultKinds(lod)` (the 16 creation defaults), `buildBucket(build)`.

## Classes, tiers, hone

| class | weapon (in hand ↔ sheathed) | silhouette |
|---|---|---|
| Reaver | ~1.9 m greatsword, two-handed ↔ diagonal on the back | spiked pauldrons, plate, crimson tabard |
| Oathkeeper | longsword (R) + tome ↔ left hip / tome at the hip | silver-white plate, sun tabard, blue-lined cape |
| Stormfist | gauntlets (part of the outfit) | open gi, sash, headband tails, huge gauntlets |
| Pistoleer | twin pistols ↔ thigh holsters; shotgun / rifle ↔ slung on the back | long coat, wide hat, bandolier |
| Starcaller | star staff with a floating orb ↔ back | layered robe, high collar, star cape |
| Songweaver | harp (left hand) ↔ back | flowing dress (f) / long coat (m), ribbons |
| Bladedancer | twin short blades ↔ crossed at the small of the back, greatblade ↔ back | hood + mask, black leather, teal glow |
| Demonbound | demonic glaive ↔ back | violet coat, chains, one big pauldron |

- `gear.tier` 0 story (plain leather / cloth), 1 Vanguard (proper armour, trims, class gems), 2 Horned Tyrant legion set
  (blackened metal, horns on pauldrons/helm, dried-blood cloth, glowing red runes on every trim). `gear.dye` recolours
  primary / secondary / trim.
- `weapon.tier` same three looks for the weapon. `weapon.hone`: +10–14 rune strips start to glow; +15 and up the whole
  weapon smoulders in the class accent colour (Stormfist: the gauntlets), stronger every level to +25 (HDR bloom);
  tier-2 weapons glow red.

## NPCs

`npc:` `guard` (mail, sun tabard, helm, sword at hip) · `knight` (plate, cape, sword) · `noble` (long coat / gown,
collar) · `king` (royal robe, fur mantle, crown, cape) · `oracle` (white robe, blue cape, circlet) · `merchant` (tunic,
feathered hat, pouches) · `blacksmith` (rolled sleeves, leather apron, gloves) · `sailor` (bandana, neckerchief, sash) ·
`pirate` (red coat, bandana, bandolier, sword + pistol) · `bandit` (hood + mask, red scarf, twin knives) · `cultist`
(black robe, hood + mask, skull stole, dark staff) · `priest` (white robe, sun stole) · `bard` (feathered hat, short cape,
lute on the back) · `farmer` (straw hat, rope belt; apron + skirt for women) · `fisher` (cap, vest, rod on the back) ·
`villager` · `child` (small body, big head).
Named characters: `npc: 'brannoc'` (Commander Brannoc Hale — grizzled knight: grey hair and full beard, scarred
Veteran face, Brighthold blue-and-steel plate with the sun) and `npc: 'seraphine'` (young oracle in white and blue,
platinum hair, circlet). Armed NPCs fight with the matching move family (sword / blades / staff); the rest use generic
moves. Townsfolk vary face, hair, beard, skin, build and garment colours per `seed`.

## Actions (default duration s; `@` = hit fractions of the duration; per weapon family where they differ)

Families: greatsword (Reaver), sword (Oathkeeper, guards, knights, pirates), fists (Stormfist), pistol / shotgun / rifle
(Pistoleer stances), staff (Starcaller, cultists), harp (Songweaver), blades (Bladedancer, bandits), glaive
(Demonbound), claws (demon form), none (unarmed NPCs).

Utility: `dash` 0.42 · `dash_back` 0.45 · `hit` additive 0.35 · `hit_heavy` 0.60 · `knockdown` 0.75 hold (stays down
until `getup`) · `getup` 0.80 · `stun` 1.6 loop · `death` 1.2 hold · `revive` 1.3 · `interact` 0.9 · `pickup` 1.0 ·
`use_item` 1.3 (drinks a potion) · `throw` 0.75 @.46 (bomb) · `victory` 1.8 · `transform` 1.3 @.6 · `awaken` 2.0
@.55/.75 · `identity` 1.1.

Attacks:

| action | greatsword | sword | fists | pistol · shotgun · rifle | staff | harp | blades | glaive |
|---|---|---|---|---|---|---|---|---|
| `atk1` | .64 @.40 | .50 @.38 | .34 @.36 | .36 @.30 · .72 @.30 · .50 @.30 | .46 @.36 | .44 @.40 | .36 @.36 | .52 @.38 |
| `atk2` | .66 @.42 | .52 @.38 | .38 @.38 | .36 · .66 @.36 · .50 | .46 @.36 | .44 @.40 | .36 @.36 | .52 @.38 |
| `atk3` | .92 @.50 | .72 @.46 | .60 @.44 | .60 @.30/.42 · .90 @.30/.55 · .80 @.30/.56 | .70 @.46 | 1.1 @.52 | .60 @.30/.52 | .70 @.46 |
| `slash_h` | .86 @.46 | .62 @.42 | .60 @.44 | generic .80 @.46 | generic | generic | .50 @.36 | .72 @.44 |
| `slash_v` | .76 @.46 | .60 @.42 | .60 @.46 | generic .80 @.50 | | | generic | .70 @.44 |
| `slash_up` | .72 @.42 | .58 @.38 | .52 @.40 | generic | | | generic | generic |
| `slash_x` | 1.0 @.30/.60 | .80 @.30/.58 | .50 @.38 | generic | | | .60 @.38 | generic |
| `thrust` | .72 @.44 | .56 @.38 | .46 @.36 | generic | | | generic | .70 @.46 |
| `spin` | .95 @.38/.62 | .72 @.45 | .60 @.46 | .90 @.40/.65 | .70 @.45 | .90 | .55 @.30/.50 | .80 @.36/.60 |
| `spin_loop` | .55 loop | .60 loop | .50 loop (kicks) | .60 loop | .60 | .60 | .40 loop | .60 |
| `leap` / `slam` | .60 hold / .62 @.30 | generic (.80 hold / .80 @.50) | .50 hold / .55 @.28 | generic | | | | |
| `charge_hold` / `charge_release` | 1.1 loop / .70 @.28 | 1.2 / .70 @.30 | 1.2 / .60 @.26 | 1.0 / .50 @.30/.38 · 1.0 / .72 · 2.0 / .62 @.10 | 1.2 / .70 | 1.2 / .70 | 1.2 / .70 | 1.2 / .70 |
| `dash_strike` | .62 @.56 | generic .80 | .52 @.50 | generic | | | .50 @.50 | generic |
| `uppercut` | .66 @.40 | generic | .52 @.40 | generic | | | .50 @.34 | generic |

Blank cells = the generic move (weapon held, .80 s, hit @.50). Every family plays every name.

Same for every family: `punch_loop` .36 loop @.25/.75 · `kick_high` .60 @.40 · `kick_spin` .70 @.48 · `kick_flip` .80
@.36 · `palm` .62 @.42 · `ground_punch` .90 @.50 · `shoot` .42 @.30 (pistol .40 @.28, shotgun .72, rifle .50, harp
.50 @.40) · `shoot_dual` .50 @.30/.38 · `shoot_loop` .26 loop @.10/.60 (shotgun .40 @.30) · `shotgun` .70 @.30 ·
`rifle_aim` 2.0 loop · `rifle_fire` .60 @.10 · `cast` .70 @.46 (harp .60 @.40) · `cast_up` .90 @.52 · `cast_ground` .90
@.50 · `channel` 1.6 loop (staff levitates) · `summon` 1.2 @.60 · `strum` .60 @.40 / `strum_big` 1.1 @.52 / `harp_loop`
1.4 loop (harp; others generic) · `throw_weapon` .70 @.42 (blades .60 @.36) · `pull` .80 @.30/.55 · `buff` 1.0–1.1 ·
`block` 1.0 loop · `taunt` 1.4 · `vanish` .45 · `appear` .50. Claws (demon form): atk1/atk2 .46 @.36, atk3 and all
slashes .70 @.48.


Life & social: `gather` 1.8 · `chop` 1.6 loop @.29/.79 (axe) · `mine` 1.6 loop (pickaxe) · `dig` 1.5 loop @.30
(shovel) · `fish_cast` 1.2 @.50 · `fish_idle` 3.0 loop · `fish_reel` 1.4 @.80 (rod) · `play_instrument` 1.2 loop (lute;
harp 1.4) · emotes `wave` 2.2 · `bow` 2.4 · `dance` 2.0 loop · `cheer` 2.4 · `clap` 2.0 · `laugh` 2.4 · `cry` 2.6 ·
`salute` 2.0 · `point` 2.0 · `flex` 2.2 · `sit` 1.0 loop · `sleep` 3.0 loop · `shrug` 1.6 · `facepalm` 2.0 · `kneel`
1.2 hold · `think` 2.4 · `heart` 2.2 · `angry` 1.8 · `yes` 1.2 · `no` 1.2. Tools appear in the hand for the action and
the weapon is sheathed.

## Performance (measured in the lab: Chrome on the dev Mac, `hero.stats`)

- Full LOD, tier 1: 20.6k–27.2k triangles (Reaver / Oathkeeper plate 25.5–27.5k, all others ≤ 24.2k); tier 0 18–24k;
  tier 2 20.8–27.5k. 1 skinned draw call + 1 per weapon (1–5 total). Body triangles hidden under armour shells are
  culled.
- Crowd LOD: 4.4k–6.8k triangles (avg ≈ 5.6k), same draw-call structure; fine trims/cops/cuffs dropped, cloth built at
  low resolution, shells/hair QEM-squeezed into the budget.
- Build: cached kinds rebuild in ≈1–2 ms. First hero of a kind (full): 60–600 ms (the very first male/female also
  builds the body base; heavy kinds are the ones with long hair, hoods or plate shells); all 16 creation defaults
  ≈ 4.3 s cold — use `warmHeroes()` during a loading screen. Crowd first-of-kind 1–220 ms (avg ≈ 50 ms). NPCs (full)
  5–510 ms first build, 14–26k tris; NPC crowd ≤ 5.7k tris.
- No per-frame allocation in the hero update path except short-lived keyframe literals inside move functions.
