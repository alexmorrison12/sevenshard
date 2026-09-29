# `src/ui/icons/` — procedural icons

Every icon in SEVENSHARD is painted at runtime with the 2D canvas API (no image files, no downloaded fonts, no
emoji), lazily on first request, then cached as a PNG data URL.

```js
import { icon, iconCanvas, hasIcon, ICON_IDS, gradeFrame, gradeColor, gradeBorder, preloadIcons } from './ui/icons/index.js';

img.src = icon('skill:reaver:whirlwind_edge', 64);          // data:image/png;base64,…  (cached by id + size + opts)
img.src = icon('item:necklace', 64, 4);                      // on the Legendary slot background + grade glow
img.src = icon('item:necklace@4', 64);                       // same, grade as an id suffix (handy in data)
img.src = icon('item:necklace', 64, { bare: true });         // transparent: object + soft shadow only
slot.style.background = gradeFrame(item.grade);              // CSS background matching `grade:<n>`
```

## API

| export | description |
|---|---|
| `icon(id, size = 64, opts?) → string` | PNG data URL, cached by id + size + opts. First paint of a 64 px icon ≈ 1–3 ms. Returns `''` without a DOM. |
| `iconCanvas(id, size = 64, opts?) → HTMLCanvasElement` | A fresh (uncached) canvas — draw it into share cards, minimap, etc. |
| `hasIcon(id) → boolean` | `true` for canonical ids (suffixes ignored). Unknown ids still render: a tasteful generic by prefix. |
| `ICON_IDS` | Frozen array of every canonical id (gallery order). |
| `SKILL_KEYS` | `{ reaver: ['whirlwind_edge', …12], … }` in DESIGN.md order. |
| `gradeFrame(grade) → string` | CSS `background` for an item slot (dark top-left → grade colour bottom-right, Ancient beige, Primal teal glow). |
| `gradeColor(grade) → '#hex'`, `gradeBorder(grade) → 'rgba()'` | Grade colours (DESIGN.md §6). |
| `GRADES`, `CLASS_COLORS`, `CLASSES` | `[{ id, name, color }]`, `{ reaver: '#e8313f', … }`, the 8 class ids. |
| `preloadIcons(ids, size = 64, budgetMs = 4) → Promise` | Optional idle-time warm-up in small slices (never blocks a frame). |
| `clearIconCache()` | Drop cached URLs (e.g. after a devicePixelRatio change). |
| `iconURL` | Alias of `icon` (for code ported from Everdawn). |

**opts** — a grade number `0–7`, or `{ grade, bare }`; also accepted as id suffixes `@<grade>` / `@bare`
(`'item:weapon:reaver:t2@5'`, `'item:ring@bare'`). Only items use grade/bare.

**Sizes** — request the pixel size you display × `devicePixelRatio` for crisp icons (e.g. a 32 CSS-px skill slot on a
2× screen → `icon(id, 64)`). Icons are painted at 2× internally and downsampled, and are designed to read at 32 px and
look good at 128 px.

## Shapes & backgrounds per family

| family | shape | notes |
|---|---|---|
| `skill:*` | square tile, painted background, bevel | awakening icons carry a gold inner frame |
| `item:*` | square tile | neutral slot background, or grade background with `grade`, or transparent with `bare` |
| `status:*` | square tile, blue (buff) / red (debuff) accent line | bold symbol for 16–24 px use |
| `npc:*` | square painted bust | crop with `border-radius` if you want round |
| `grade:<0-7>` | square gradient tile | same look as `gradeFrame()` |
| `engr:*`, `tripod:*`, `boss:*` | circular emblem, **transparent corners** | ring: silver (combat engr), gold (class engr), crimson (negatives), bronze (tripods), obsidian (bosses) |
| `class:*`, `ui:*`, `currency:*` | **transparent** glyph | sits on any panel; has its own dark outline/shadow |

## Id list

Skills (`skill:<class>:<key>`) — 12 per class + `identity_z`, `identity_x`, `awakening`:
- **reaver**: whirlwind_edge, tempest_slash, diving_slash, sword_storm, mountain_cleave, hell_blade, red_dust, chain_sword, strike_wave, shoulder_charge, finish_strike, wind_blade · identity_z *Burst Mode*, identity_x *Crimson Finale*, awakening *Worldsplitter*
- **oathkeeper**: holy_bulwark, heavenly_blessing, light_shock, sword_of_justice, godsent_law, holy_explosion, flash_slash, execution_of_justice, wrath_of_heaven, charging_blade, sacred_chain, rite_of_mending · identity_z *Aegis of Dawn*, identity_x *Sacred Punishment*, awakening *Radiant Judgment*
- **stormfist**: lightning_kick, blazing_fist, tempest_barrage, sweeping_kick, storm_dragon_upper, swiftwind_dash, ground_quake, thunder_palm, moonflash_kick, heavenly_strike, lightning_whisper, soaring_tiger · identity_z *Dragon Ascent*, identity_x *Thunder Tiger*, awakening *Heaven's Fury*
- **pistoleer**: quick_shot, spiral_tracker, equilibrium, dexterous_shot, dual_buckshot, shotgun_rapid_fire, last_request, dragon_shot, focused_shot, perfect_shot, target_down, catastrophe · identity_z *Stance cycle*, identity_x *Deadeye Focus*, awakening *Last Rites*
- **starcaller**: doomfall, blaze_nova, frost_lance, starfire_explosion, punishing_bolt, seraphic_hail, esoteric_rune, lightning_vortex, inferno_wave, blink, void_rift, frost_nova · identity_z *Overload*, identity_x *Arcane Surge*, awakening *Stellar Collapse*
- **songweaver**: sound_shock, harp_of_rhythm, stigma, guardian_tune, heavenly_tune, rhapsody_of_light, wind_of_music, sonic_vibration, prelude_of_storm, rhythm_buckshot, soundholic, tempest_chord · identity_z *Anthem of Courage*, identity_x *Hymn of Mending*, awakening *Grand Finale*
- **bladedancer**: blitz_rush, spincutter, maelstrom, void_strike, death_trance, moonlight_sonic, soul_absorber, wind_cut, dark_order, upper_slash, blade_dance, shadow_step · identity_z *Surge*, identity_x *Surge orbs*, awakening *Thousand Cuts*
- **demonbound**: demonic_slash, ruining_rush, cruel_cutter, blood_massacre, grind_chain, thrust_of_destruction, demolition, soul_chain, blood_pillars, howl, leaping_blow, demon_vision · identity_z *Demonform*, identity_x *Revert*, awakening *Abyssal Rupture* · demon skills abyss_claw, rending_talons, hellfire_wings, demonic_slam
- `skill:any:dash`, `skill:any:basic`

Tripods: `tripod:` quick_prep, mobility, weak_point, enhanced, wide, super_armor, bleed, burn, freeze, shock, pull, pierce, extra_hit, charge, zone, element

Class crests: `class:` reaver, oathkeeper, stormfist, pistoleer, starcaller, songweaver, bladedancer, demonbound

Items (`item:`):
- weapons `weapon:<class>` (= t1) and `weapon:<class>:t0|t1|t2` (story / Vanguard / Horned Tyrant)
- armour `head|shoulder|chest|pants|gloves:t0|t1|t2`
- accessories `necklace`, `earring`, `ring`, `stone` (ability stone), `bracelet`
- gems `gem:ruin:1…10`, `gem:swift:1…10` (colour and glow intensify with level)
- engraving books `book:<engraving>` for all 40 combat + class engravings
- `card_pack`; materials `destruction_stone`, `guardian_stone`, `leapstone`, `fusion`, `shards`, `solar_grace`, `solar_blessing`, `solar_protection`
- battle items `hp_potion`, `elixir`, `destruction_bomb`, `flame_grenade`, `frost_grenade`, `whirlwind_grenade`, `clay_grenade`, `dark_grenade`, `sleep_bomb`, `panacea`, `time_stop`, `feather`
- trade `herb`, `flower`, `timber`, `ore`, `gem_ore`, `fish`, `meat`, `relic_shard`; food `food:1…4`; gifts `gift:1…4`
- collectibles `island_soul`, `giants_heart`, `masterpiece`, `omnium_star`, `sea_bounty`, `world_leaf`, `pip_seed`
- misc `mount_whistle`, `pet_charm`, `chest`, `key`, `map` (treasure map), `coin_pirate`, `skill_potion`, `scroll`, `quest`

Currencies: `currency:` silver, gold, crystal, royal, shards, bloodstone, pirate, token, pvp

Engravings (`engr:`): vendetta, hexed_idol, keen_edge, adrenaline, backstabber, frontliner, wind_captain,
spirit_absorption, precise_blade, super_charge, barricade, expert, awakening, master_brawler, ether_predator,
crisis_evasion, stabilized_status, all_out_attack, mana_flow, heavy_armor, sight_focus, drops_of_ether, propulsion,
increase_mass · class: bloodfrenzy, tempered_fury, blessed_aura, judgment, storm_conduit, chi_master, quickdraw,
longshot, ignition, wellspring, last_refrain, heart_of_courage, afterglow, stormsurge, unleashed, restraint ·
negatives: neg_atk, neg_speed, neg_def, neg_move

Statuses (`status:`): burn, bleed, poison, freeze, shock, stun, fear, sleep, silence, slow, knockdown, shield, heal,
atk_up, crit_up, speed_up, def_down, brand, counter, stagger, invuln, super_armor, rest

Menu (`ui:`): character, inventory, skills, engravings, cards, gems, map, guild, market, mail, stronghold, tome,
collectibles, party, settings, songs, emotes, pvp, leaderboard, compass, quests, friends, honing, mounts, pets,
wardrobe, chat, photo, help, logout

Portraits: `boss:` gorrath, skarn, vesk, varkhul, ashmaw, gatekeeper, rimewing, cinderhorn, sandmaw, kurai, nerissa,
deep_oracle, thunderhoof (round medallions) · `npc:` brannoc, seraphine, bramblebeard, merchant (square busts)

Grades: `grade:0…7` (Common, Uncommon, Rare, Epic, Legendary, Relic, Ancient, Primal)

**Fallbacks** — any other id renders a generic by prefix: `skill:<class>:<anything>` gets a class-coloured slash,
`item:*` a pouch, `engr:*`/`tripod:*` a star emblem, `status:*` a diamond, `boss:*` a horned silhouette, `npc:*` a hooded
bust, `ui:*` a gold diamond, `currency:*` a coin.

## Files

`index.js` (API, registry, frames) · `core.js` (painting toolkit: gradients, glows, slashes, bolts, fire, crystals,
metals, backdrops, finishes) · `ids.js` (id catalogue, grades, class colours) · `palette.js` (class palettes) ·
`generic.js` (grade backgrounds, fallbacks) · `skills*.js`, `items.js`, `emblems.js`, `misc.js`, `portraits.js` (painters).

Lab: `node tools/lab.mjs src/lab/icons.js` → `http://localhost:5299/lab/icons.html?prefix=skill:reaver`
(params: `prefix`, `ids`, `size`, `zoom`, `grade`, `bare`, `bg=light`, `hud=1`). The header shows paint timings.
