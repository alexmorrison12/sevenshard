# `src/ui/icons/` — procedural icons

Every icon in SEVENSHARD is painted at runtime with the 2D canvas API (no image files, no downloaded fonts, no
emoji), lazily on first request, then cached as a PNG data URL. Style: Lost Ark-like square tiles — a richly lit,
painterly subject on a dark vignetted background, one dominant hue + glow, light from the top-left, subtle bevel.

```js
import { icon, iconCanvas, hasIcon, ICON_IDS, gradeFrame, gradeColor, gradeBorder, preloadIcons } from './ui/icons/index.js';

img.src = icon('skill:reaver:whirlwind_edge', 64);          // data:image/png;base64,…  (cached by id + size + opts)
img.src = icon('item:necklace', 64, 4);                      // on the Legendary slot background + grade glow
img.src = icon('item:necklace@4', 64);                       // same, grade as an id suffix (handy in data)
img.src = icon('item:necklace', 64, { bare: true });         // transparent: object + soft drop shadow only
slot.style.background = gradeFrame(item.grade);              // CSS background matching `grade:<n>`
```

## API

| export | description |
|---|---|
| `icon(id, size = 64, opts?) → string` | PNG data URL, cached by id + size + opts. Returns `''` without a DOM (safe to import in Node). |
| `iconCanvas(id, size = 64, opts?) → HTMLCanvasElement` | A fresh (uncached) canvas — draw it into share cards, minimap, etc. |
| `hasIcon(id) → boolean` | `true` for canonical ids and aliases (suffixes ignored). Anything else still renders (see *Fallbacks*). |
| `ICON_IDS` | Frozen array of every canonical id (557), in gallery order. |
| `ICON_ALIASES` | `{ alias: canonicalId }` (45) — see *Aliases*. |
| `SKILL_KEYS` | `{ reaver: ['whirlwind_edge', …12], … }` in DESIGN.md order. |
| `gradeFrame(grade) → string` | CSS `background` for an item slot (dark top-left → grade colour bottom-right, Ancient beige, Primal teal glow). |
| `gradeColor(grade) → '#hex'`, `gradeBorder(grade) → 'rgba()'` | Grade colours (DESIGN.md §6). |
| `GRADES`, `CLASS_COLORS`, `CLASSES` | `[{ id, name, color }]`, `{ reaver: '#e8313f', … }`, the 8 class ids. |
| `preloadIcons(ids, size = 64, budgetMs = 4) → Promise` | Optional idle-time warm-up in small slices (never blocks a frame). |
| `clearIconCache()` | Drop cached URLs (e.g. after a devicePixelRatio change). |
| `iconURL` | Alias of `icon` (for code ported from Everdawn). |

**opts** — a grade number `0–7`, or `{ grade, bare }`; also accepted as id suffixes `@<grade>` / `@bare`
(`'item:weapon:reaver:t2@5'`, `'item:ring@bare'`). Only items use grade/bare.

**Ids are forgiving** — display names are normalised to lower_snake_case (`'skill:reaver:Whirlwind Edge'`,
`'engr:All-Out Attack'`, `"skill:stormfist:Heaven's Fury"` all work).

**Sizes & speed** — request the pixel size you display × `devicePixelRatio`. Icons are painted at 2× internally (≤128 px)
and downsampled; designed to read at 32 px and look good at 128–256 px. Measured in headless Chrome (M-series), incl.
PNG encoding: all 557 ids at 64 px ≈ 600 ms total — median 1.1 ms, p95 1.6 ms, p99 2.0 ms per icon; 32 px median
0.6 ms; cards at 128 px median 3.2 ms; NPC portraits at 256 px median 3.8 ms. The very first paint also builds the shared
canvas-grain texture (~20 ms, once). Nothing is painted until first requested; `preloadIcons` can warm a list in idle time.
Code size: ~290 KB minified / ~88 KB gzipped.

## Shapes & backgrounds per family

| family | shape | notes |
|---|---|---|
| `skill:*` | square tile, painted background, bevel | awakening icons carry a gold filigree inner frame |
| `item:*` | square tile | neutral slot background, or grade background + glow with `grade`, or transparent with `bare`; objects get a soft drop shadow |
| `status:*` | square tile, blue (buff) / red (debuff) accent line | bold symbols for 16–24 px use |
| `npc:*` | square painted bust | dialog portraits (fine at 192–256 px); crop with `border-radius` if you want round |
| `card:*` | square painted portrait in an ornate gold card frame | corner gems / inner line by kind: boss red, legend gold, Pip green, NPC blue |
| `grade:<0-7>` | square gradient tile | same look as `gradeFrame()` |
| `engr:*`, `tripod:*`, `boss:*` | circular emblem, **transparent corners** | ring: silver (combat engr), gold (class engr), crimson (negatives), bronze (tripods), obsidian (bosses) |
| `class:*`, `ui:*`, `currency:*` | **transparent** glyph | own dark outline + shadow; sits on any panel |

## Id list

**Skills** (`skill:<class>:<key>`) — 12 per class + `identity_z`, `identity_x`, `awakening`:
- **reaver**: whirlwind_edge, tempest_slash, diving_slash, sword_storm, mountain_cleave, hell_blade, red_dust, chain_sword, strike_wave, shoulder_charge, finish_strike, wind_blade · identity_z *Burst Mode*, identity_x *Crimson Finale*, awakening *Worldsplitter*
- **oathkeeper**: holy_bulwark, heavenly_blessing, light_shock, sword_of_justice, godsent_law, holy_explosion, flash_slash, execution_of_justice, wrath_of_heaven, charging_blade, sacred_chain, rite_of_mending · identity_z *Aegis of Dawn*, identity_x *Sacred Punishment*, awakening *Radiant Judgment*
- **stormfist**: lightning_kick, blazing_fist, tempest_barrage, sweeping_kick, storm_dragon_upper, swiftwind_dash, ground_quake, thunder_palm, moonflash_kick, heavenly_strike, lightning_whisper, soaring_tiger · identity_z *Dragon Ascent*, identity_x *Thunder Tiger*, awakening *Heaven's Fury*
- **pistoleer**: quick_shot, spiral_tracker, equilibrium, dexterous_shot, dual_buckshot, shotgun_rapid_fire, last_request, dragon_shot, focused_shot, perfect_shot, target_down, catastrophe · identity_z *Stance cycle*, identity_x *Deadeye Focus*, awakening *Last Rites*
- **starcaller**: doomfall, blaze_nova, frost_lance, starfire_explosion, punishing_bolt, seraphic_hail, esoteric_rune, lightning_vortex, inferno_wave, blink, void_rift, frost_nova · identity_z *Overload*, identity_x *Arcane Surge*, awakening *Stellar Collapse*
- **songweaver**: sound_shock, harp_of_rhythm, stigma, guardian_tune, heavenly_tune, rhapsody_of_light, wind_of_music, sonic_vibration, prelude_of_storm, rhythm_buckshot, soundholic, tempest_chord · identity_z *Anthem of Courage*, identity_x *Hymn of Mending*, awakening *Grand Finale*
- **bladedancer**: blitz_rush, spincutter, maelstrom, void_strike, death_trance, moonlight_sonic, soul_absorber, wind_cut, dark_order, upper_slash, blade_dance, shadow_step · identity_z *Surge*, identity_x *Surge orbs*, awakening *Thousand Cuts*
- **demonbound**: demonic_slash, ruining_rush, cruel_cutter, blood_massacre, grind_chain, thrust_of_destruction, demolition, soul_chain, blood_pillars, howl, leaping_blow, demon_vision · identity_z *Demonform*, identity_x *Revert*, awakening *Abyssal Rupture* · demon skills abyss_claw, rending_talons, hellfire_wings, demonic_slam
- `skill:any:dash`, `skill:any:basic`

**Tripods** (`tripod:`): quick_prep, mobility, weak_point, enhanced, wide, super_armor, bleed, burn, freeze, shock, pull,
pierce, extra_hit, charge, zone, element + the game's generic catalogue: stance, unstoppable, swift, mana_saver, keen,
crushing, aftershock, back, head, scorched, vital

**Class crests** (`class:`): reaver, oathkeeper, stormfist, pistoleer, starcaller, songweaver, bladedancer, demonbound

**Items** (`item:`):
- weapons `weapon:<class>` (= t1) and `weapon:<class>:t0|t1|t2` (story / Vanguard / Horned Tyrant)
- armour `head|shoulder|chest|pants|gloves:t0|t1|t2`
- accessories `necklace`, `earring`, `ring`, `stone` (ability stone), `bracelet`
- gems `gem:ruin:1…10`, `gem:swift:1…10` (Ruinstone red octagon, Swiftstone blue hexagon; colour, glow, sparkle and a gold bezel grow with level)
- engraving books `book:<engraving>` for all 44 engravings (the engraving emblem is set into the cover)
- `card_pack`; materials `destruction_stone`, `guardian_stone`, `leapstone`, `fusion`, `shards`, `solar_grace`, `solar_blessing`, `solar_protection`
- battle items `hp_potion`, `elixir`, `destruction_bomb`, `flame_grenade`, `frost_grenade`, `whirlwind_grenade`, `clay_grenade`, `dark_grenade`, `sleep_bomb`, `panacea`, `time_stop`, `feather`
- trade `herb`, `flower`, `timber`, `ore`, `gem_ore`, `fish`, `meat`, `relic_shard`; food `food:1…4`; gifts `gift:1…4`
- collectibles `island_soul`, `giants_heart`, `masterpiece`, `omnium_star`, `sea_bounty`, `world_leaf`, `pip_seed`
- misc `mount_whistle`, `pet_charm`, `chest`, `key`, `map` (treasure map), `coin_pirate`, `skill_potion`, `scroll`, `quest`
- src/data/items.js extras with their own art: `horn_shard`, `resin`, `heartwood`, `starsteel`, `hide`, `pelt`, `clam`,
  `pearl`, `sunbloom`, `buried_coin`, `relic_idol`, `card_pack_epic`, `card_pack_legend`, `card_pack_pip`, `gem_pouch`,
  `gem_pouch_hi`, `accessory_chest`, `life_tonic`, `crew_contract`, `rename_ticket` (the explicit `icon:` overrides in
  items.js that borrow other art can now simply be dropped)

**Currencies** (`currency:`): silver, gold, crystal, royal, shards, bloodstone, pirate, token, pvp

**Engravings** (`engr:`): vendetta, hexed_idol, keen_edge, adrenaline, backstabber, frontliner, wind_captain,
spirit_absorption, precise_blade, super_charge, barricade, expert, awakening, master_brawler, ether_predator,
crisis_evasion, stabilized_status, all_out_attack, mana_flow, heavy_armor, sight_focus, drops_of_ether, propulsion,
increase_mass · class: bloodfrenzy, tempered_fury, blessed_aura, judgment, storm_conduit, chi_master, quickdraw,
longshot, ignition, wellspring, last_refrain, heart_of_courage, afterglow, stormsurge, unleashed, restraint ·
negatives: neg_atk, neg_speed, neg_def, neg_move

**Statuses** (`status:`): burn, bleed, poison, freeze, shock, stun, fear, sleep, silence, slow, knockdown, shield, heal,
atk_up, crit_up, speed_up, def_down, brand, counter, stagger, invuln, super_armor, rest, armor_break, weaken, def_up,
regen, enrage (every id of `STATUS` in src/game/combat.js is covered)

**Menu** (`ui:`): character, inventory, skills, engravings, cards, gems, map, guild, market, mail, stronghold, tome,
collectibles, party, settings, songs, emotes, pvp, leaderboard, compass, quests, friends, honing, mounts, pets,
wardrobe, chat, photo, help, logout

**Bosses** (`boss:`, round medallions): gorrath, skarn, vesk, varkhul, ashmaw, gatekeeper, rimewing, cinderhorn,
sandmaw, kurai, nerissa, deep_oracle, thunderhoof, vorrathis, ghost_captain

**NPCs** (`npc:`, square busts): brannoc, seraphine, bramblebeard, merchant · every city NPC id of src/data/npcs.js:
blacksmith (Hilda), market (Orrin), bank (Petra), guild (Sir Cadwyn), cards (Iolanthe), general (Bram Tully),
songs (Lyra), pvp (Marshal Kaine), harbor (Mirelle), stronghold (Tobin), tasks (Wayfarer's Board), gemcutter (Jory),
tailor (Ysolde), stable (Gregor), rapport1 (Wren), rapport2 (Old Maren), rapport3 (Pip Tumbleroot), nexus (Oriel),
mail (mailbox), board (Party Finder) · card characters: morwenna, ithra, aurelion, solenne, maelis, vaelor, kest,
corvan, puddlebutton, sprig, captain_acorn, mossy_gran

**Cards** (`card:`): all 37 of src/data/cards.js (seraphine, ithra, aurelion, solenne, brannoc, maelis, bramblebeard,
puddlebutton, sprig, tumbleroot, captain_acorn, mossy_gran, gorrath, varkhul, skarn, vesk, ashmaw, rimewing, cinderhorn,
sandmaw, kurai, thunderhoof, nerissa, maren, hilda, mirelle, wren, morwenna, deep_oracle, ghost_captain, gatekeeper,
vorrathis, vaelor, kest, corvan, tully, iolanthe)

**Grades**: `grade:0…7` (Common, Uncommon, Rare, Epic, Legendary, Relic, Ancient, Primal)

## Aliases (`ICON_ALIASES`)
- awakening defs by kit id → `skill:<cls>:awakening`: worldsplitter, radiant_judgment, heavens_fury, last_rites,
  stellar_collapse, grand_finale, thousand_cuts, abyssal_rupture
- identity defs → `identity_z|x`: aegis_of_dawn, sacred_punishment, dragon_ascent, thunder_tiger, overload,
  anthem_of_courage, hymn_of_mending, surge, burst_mode, crimson_finale, deadeye_focus, demonform, …
- `item:food1…4` → `item:food:1…4`, `item:gift1…4` → `item:gift:1…4`; `status:haste` → speed_up, `status:protection` → def_up

## Fallbacks
Unknown **tripod** and **status** ids pick the closest generic art by keyword (`tripod:crimson_gale` → bleed,
`tripod:ice_age` → freeze, `status:sanctuary` → shield, …), so unique tripods can use `tripod:<their id>` and custom
buffs `status:<their id>`. Any other unknown id renders a tasteful generic by prefix: `skill:<class>:<x>` a
class-coloured slash, `item:*` a pouch, `engr:*` a star emblem, `card:*` a card back, `status:*` a diamond, `boss:*` a
horned silhouette, `npc:*` a hooded bust, `ui:*` a gold diamond, `currency:*` a coin.

## Tools
- Lab: `node tools/lab.mjs src/lab/icons.js` → `http://localhost:5299/lab/icons.html?prefix=skill:reaver`
  (params: `prefix` (comma list), `ids`, `size`, `zoom`, `grade`, `bare`, `bg=light`, `hud=1`, `px=32&mag=3` for
  nearest-neighbour small-size inspection). The header shows paint timings.
- Coverage: `node src/lab/icons_check.js` cross-checks every id the kits, statuses, items, cards, NPCs, engravings and
  the UI tables can request; exits 1 if any lacks art.

## Files
`index.js` (API, registry, aliases, frames) · `core.js` (painting toolkit: gradients, glows, slashes, bolts, fire,
crystals, metals, backdrops, finishes) · `ids.js` (catalogue, grades, class colours) · `palette.js` · `motifs.js`
(weapons, hands, figures, dragon, tiger, demon, wings…) · `generic.js` (grade backgrounds, fallbacks) · `skills*.js` ·
`items*.js` · `emblems.js` (engravings, tripods, crests) · `misc.js` (currencies, statuses, menu) · `portraits.js`
(bosses, story busts) · `people.js` (bust/Pip system) · `npcs_cards.js` (city NPCs, cards).
