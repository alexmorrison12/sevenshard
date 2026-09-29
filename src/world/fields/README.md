# Field zones (world-fields owner)

Five open-world zones built on the world kit (`src/world/*`, untouched) plus shared field helpers in this folder.
Spec: `src/world/FIELDS.md`. Every zone returns the standard contract (`root, env, heightAt, nav, walkable, anchors,
regions, minimap, update, dispose`) plus the kit extras (`envs`/`setEnv`, `stats`, `bounds`).

| id | name | file | size | look | scale |
|---|---|---|---|---|---|
| `brighthold` | Siege of Brighthold (prologue) | `zones/brighthold.js` | ~136×188 m, linear | night, burning town & castle, embers, smoke | 1 |
| `goldmeadow` | Goldmeadow | `zones/goldmeadow.js` | ~218×216 m | warm afternoon, wheat, pollen & fluff | 1 |
| `thornwood` | Thornwood | `zones/thornwood.js` | ~212×224 m | misty blue-green forest, light shafts, fireflies | 1 |
| `ashen_ridge` | Ashen Ridge | `zones/ashen_ridge.js` | ~212×246 m | volcanic dusk, lava, embers, ash | 1 |
| `pipsprout` | Pipsprout Hollow | `zones/pipsprout.js` | ~160×156 m | bright storybook morning at Pip scale | **0.35** |

## Registration
Each zone file calls `registerZone(id, DEF, build)` itself; `src/world/index.js` imports each file once
(`import './zones/goldmeadow.js';`). Because index.js imports the zone before its own body has run (import cycle),
the call is wrapped: `try { registerZone(…) } catch { queueMicrotask(() => registerZone(…)) }` — the zones are in
`ZONES` by the first microtask after the bundle loads (long before any `buildZone`). Code that reads `ZONES` at
module top level (e.g. a lab's zone dropdown) should do so after a `Promise.resolve()`.

## Anchor conventions
`zone.anchors[name] = { x, z, facing, …extra }` (facing: forward = (−sin f, 0, −cos f)). Extras used here:
- `pack:<n>` / `elite:<n>`: `r` (metres) and `tag` (what lives there, see table below).
- `fieldboss`, `chaosgate`, `arena:varkhul`, `duel`, `breach`: `r` = usable radius of the open area.
- `seed:<n>`: `hint` = the collectible hint wording ("Under the old windmill") — seed `n` ↔ `seed:<zone>:<n>` in
  `src/data/collectibles.js` (counts follow the catalog: goldmeadow 24, thornwood 22, ashen_ridge 18, pipsprout 28,
  brighthold 8), each placed at the spot its hint names (behind props, on ledges, under the bridge…).
- `node:<skill>:<n>`: `skill` (`forage log mine hunt fish dig`); fish nodes face the water.
- `cannon:<n>` (Brighthold): `muzzle: [x, y, z]` world point of the barrel mouth; anchor = the gunner's spot behind it.
- `vista:<name>` ids match the catalog (`vista:windmill`, `vista:sunflower`, `vista:moonpool`, `vista:giant_tree`,
  `vista:lava_falls`, `vista:fortress`, `vista:mushroom`, `vista:petal`); numeric aliases `vista:<n>` carry `alias`.
- Every anchor is snapped onto walkable nav at build time.

Suggested creature per pack `tag`: wolves→`wolf`, boars→`boar`, bandits→npc `bandit`, spiders→`spider`,
cultists→npc `cultist`, treant→`treant`, wisps→`wisp`, skeletons→`skeleton`, demons→`legionnaire`, imps→`imp`,
gargoyles→`gargoyle`, hounds→`hellhound`, casters→`abyss_caster`, brutes→`brute`, crabs→`crab`,
beetles/rabbits/slimes (Pipsprout pests)→`crab`/`rabbit`/`slimelet`-style small mobs.

## brighthold — Siege of Brighthold (prologue, night)
Linear path south → north: burning harbour (`spawn` 0, 83) → lower town street & barricades → town square → gate
ramp → outer gatehouse (0, 22) → the bailey → east rampart terraces with the four cannons (`cannon:1..4`, reached
by stairs at x≈28) firing east through the embrasures → `breach` (47.5, −14) where Ashmaw batters the wall
(`boss:ashmaw` 64, −14 outside; `fieldboss` = Ashmaw's field) → inner gatehouse (0, −40) → the courtyard duel arena
(`duel` 0, −60, r 14; `boss:varkhul` 0, −70) before the burning keep. `gate:solhaven` = the evacuation ship at the
quay. Castle walls dissolve when they stand between the camera and the hero.
| anchor | role |
|---|---|
| `npc:brannoc` | Commander Brannoc Hale at the outer gate — gives the orders, sends you to the cannons |
| `npc:seraphine` | Seraphine inside the inner gate — hears the Shard, points you at Varkhul |
| `npc:sergeant` | Sergeant holding the square barricade — combat tutorial, rallies the militia |
| `npc:gunner` | Master gunner on the south terrace — teaches the cannons (`cannon:1..4`) |
| `npc:medic` | Field medic among the bailey tents — potions / revive tutorial |
| `npc:refugee` | Refugee on the quay — first dialogue, "the town is burning" |
| `npc:dockmaster` | Dockmaster by the burning ship — evacuation, the prologue's exit |
| `npc:child` | Frightened child at the square arcade — small rescue beat |
Beats (`poi:`): harbor, barricade, town_square, gate_ramp, outer_gate, bailey, ramparts, breach, inner_gate,
courtyard, keep. Packs 9 (imps/demons), elites 3, chaosgate (bailey), nodes 6, vistas 2, lore 2, seeds 8.

## goldmeadow — Goldmeadow (lv 5–25, warm afternoon)
Arrival from Solhaven at the east gate posts (`spawn` 98, 30.5; `gate:solhaven` 107, 30). Sheafton hamlet (48, 20)
with the Golden Sheaf inn, well, stalls and `triport:goldmeadow`; Hale Farm (44, 62) with barn and pumpkin patch;
wheat fields (scarecrow field, the wheat maze); Windmill Hill (86, 84, sails turn); Sunflower Hill (−6, 88);
the river with the two-arch Stone Bridge (≈ −4, 7) and bridge post; the millpond with a turning waterwheel;
Beehive Orchard (62, −44); Old Watchtower (18, −80); Ember Clearing (`chaosgate` 82, −62); Standing Stones with a
dolmen (`fieldboss` −56, −32, r 17); Wolf Dens under a rock face with caves (−80, −72); Hunter's Camp; Boar Wallows
(−80, −10); Hermit's Hollow (−90, 36); Bandit Camp in a palisade (−64, 74); `gate:thornwood` (−42, −104.5).
| anchor | role |
|---|---|
| `npc:farmer_hale` | Farmer Hale (Brannoc's brother) at his farmhouse — main MSQ giver, wolves & bandits |
| `npc:miller` | The miller at the windmill door — grain gone missing, sends you to the bandits |
| `npc:captain` | Watch captain at the bridge post — bounty board, bandit camp assault |
| `npc:innkeeper` | Innkeeper of the Golden Sheaf — rumours, cooking/food vendor, rest |
| `npc:hunter` | Hunter at the camp near the dens — wolf/boar hunts, Hunting trade skill |
| `npc:child` | Village child on the green — lost-pet side quest, Pip Seed hints |
| `npc:merchant` | Travelling merchant at the Sheafton stalls — general goods |
| `npc:beekeeper` | Beekeeper by her shed in the orchard — honey, foraging |
| `npc:hermit` | Old hermit at Hermit's Hollow — lore, Standing Stones legend |
| `npc:guard` | Gate guard at the east watch post — zone intro, directions |
| `npc:shrinekeeper` | Keeper of the Shrine of Dawn by the bridge — Seven Lights lore, blessings |
Packs 13 (wolves 4, boars 5, bandits 4), elites 4, nodes 12, vistas windmill/sunflower, lore 3, pois 23, seeds 24.

## thornwood — Thornwood (lv 25–40, misty forest)
Arrival from Goldmeadow (`spawn` −20, 97; `gate:goldmeadow` −20, 107.5). The Old Pilgrim Road (cobbled) runs
north-east through the Thorn Arch to `gate:ashen_ridge` (72, −106). Wardens' Camp (8, 42, `triport:thornwood`);
the misty creek (from the Moonlit Pool −62, −88) crossed by the Fallen Giant (walkable trunk deck, ≈ −43, −31) on the
way to the Ruined Abbey (−66, −40, cultists, altar, graveyard); Cultist Circle (40, 6) and a second small circle;
Spider Hollow (64, 48, webs & cocoons); Owl Roost (88, −6); the Hollow Glade (`fieldboss` 72, −44, r 16);
Treant Grove (−6, −70, a giant heart-tree); Witch Lights marsh with a stilt hut (−86, 8); abandoned logging camp
(−66, 68) with a ford; Toadstool Ring (−4, 84); chaos clearing (`chaosgate` 46, 86); the Hollow Oak (−26, 30).
| anchor | role |
|---|---|
| `npc:warden` | Warden-captain at the rangers' lodge — Thornwood MSQ hub, cultist threat |
| `npc:herbalist` | Herbalist by the camp fire — potions, Foraging, poison antidotes vs spiders |
| `npc:scholar` | Abbey scholar in the graveyard — abbey history, cult rituals, lore steles |
| `npc:woodcutter` | Last woodcutter at the logging camp — treant attacks, Logging |
| `npc:pilgrim` | Pilgrim resting at the rune stone by the Thorn Arch — Seven Lights pilgrimage |
| `npc:trapper` | Spider trapper at the hollow's edge — spider bounties, Hunting |
| `npc:witch` | Marsh witch at her cauldron — witch lights, riddles, odd rewards |
Packs 14 (spiders 4, cultists 3, treant 2, wolves 3, wisps 1, skeletons 1), elites 4, nodes 12, vistas
moonpool/giant_tree, lore 3, pois 17, seeds 22.

## ashen_ridge — Ashen Ridge (lv 40–50, volcanic dusk)
Arrival from Thornwood (`spawn` −70, 106; `gate:thornwood` −70, 121). The Cinder Road climbs through Cinderfall,
the scorched village (−50, 62) and its burned chapel (−76, 44), to Emberwatch, the forward camp (−8, 26,
`triport:ashen_ridge`), then up a banner-lined ramp to the Legion Fortress gate (0, −68). Inside: the courtyard arena
(`arena:varkhul` / `duel` 0, −94 r 18, `boss:varkhul`), barracks, green fire pits, the throne dais and the first Shard
(`poi:shard`). West: ash dunes, obsidian spires, the old mine in the cliffs (−96, −28). East: the lava river pouring
off the high ledge (the Lava Falls 74, −80) past the broken siege engine (26, −24), a basalt ford, the Ashen Plain
(`fieldboss` 48, 34, r 18), sulphur vents (40, 80), the eastern drop into the burning caldera. Fortress walls dissolve
between camera and hero.
| anchor | role |
|---|---|
| `npc:commander` | Solmara field commander at the command tent — final MSQ push on the fortress |
| `npc:quartermaster` | Quartermaster by the supply crates — vendor, repair, battle items |
| `npc:healer` | Camp healer by the tents — wounded soldiers, revive items |
| `npc:scout` | Scout on the broken watchtower — fortress intel, sends you to the gate |
| `npc:smith` | Camp smith at the anvil — gear upgrades, Legion steel |
| `npc:survivor` | Survivor of Cinderfall at the village well — the village's fate, rescue side quest |
| `npc:priest` | Priest in the burned chapel — lore, the Shard's song, blessings |
| `npc:miner` | Old miner at the mine mouth — Mining, the mountain giant (Old Grumhald) |
Packs 14 (demons 4, imps 3, gargoyles 3, hounds 2, casters 1, brutes 1), elites 4, nodes 11, vistas
lava_falls/fortress, lore 3, pois 16, seeds 18.

## pipsprout — Pipsprout Hollow (any level, Pip scale ×0.35)
`zone.scale = 0.35`: the whole zone is authored in Pip metres (a Pip ≈ 0.65 m): the game should shrink the hero and
the camera distance by this factor while inside (the fields lab does). Arrival on the Petal Pier over the dewdrop pond
(`spawn` 0, 66; `dock:ship` / `gate:glass_sea` 0, 70). Village green with the thimble well and acorn houses (0, 20,
`triport:pipsprout`), the hollow-log town hall with Bramblebeard's porch (0, 5), berry market (22, 24), Moss Library
(−40, 4), Acorn Tower (34, −18), Petal Theatre (46, 16), the Giant Red Mushroom (−38, −30, climbable shelf steps),
snail stables (−50, 44), the ladybug bridge over the brook, the sleepy caterpillar (46, 48), dandelion clocks
(28, 60), root tunnels and the Seed Vault door (0, −58), Clover Meadow (`fieldboss` 42, −44), chaos pod (−50, −52).
Near-camera foliage and props dissolve so giant flowers never block the view.
| anchor | role |
|---|---|
| `npc:bramblebeard` | Bramblebeard, the Pip elder, on his porch — Pip Seeds, collectibles rewards, Hollow MSQ |
| `npc:pip_merchant` | Pip merchant at the berry market — seed trades, Pip cosmetics |
| `npc:pip_librarian` | Pip librarian at the Moss Library — lore, Adventure Tome, Masterpiece hunt |
| `npc:pip_stablekeeper` | Snail-stable keeper — snail mount, slow races |
| `npc:pip_guard` | Pip guard on the pier — greeting, "mind your size" |
| `npc:pip_farmer` | Pip farmer in the dandelion clocks — dandelion seeds, foraging |
| `npc:pip_child` | Pip child at the well — hide & seek (seed hunt tutorial) |
| `npc:pip_bard` | Pip bard on the Petal Theatre stage — songs, emote/performance quests |
Packs 9 (beetles 3, slimes 2, rabbits, spiders, wisps, crabs), elites 3, nodes 10, vistas mushroom/petal, lore 3,
pois 18, seeds 28.

## Shared helpers (`src/world/fields/`)
- `common.js` — `FieldGround` (Ground + per-layer albedo tint & tile size), `DistGrid` (distance to polylines),
  `spline/along/paintPath/scatter`, `FieldKit` (Kit + custom-material merging, `fade: 'south'|'near'` dissolving
  materials, unmerged animated `part()`s), `Anchors`, `snapAnchors`, `aliasNumbered`, `seedSpots`, `waterEnv`.
- `flora.js` — `FieldGrass` (GPU tufts: grass, wheat, reed, giant Pip blades, fern), `FieldFlora` (every tree part,
  flower and instanced thing of a zone in a few `BatchedMesh` multi-draws with per-instance culling; kit species +
  oak, autumn, apple, fir, charred, ancient, willow), geometry for sunflowers, mushrooms, ferns, reeds, tall grass,
  giant flowers and blade clumps, `thingMaterial` (near-camera dissolve).
- `fx.js` — `Mist` (ground fog sheets), `buildSmoke` (plumes lit by fire below), `buildDrifters` (leaves, petals,
  fluff, ash), `buildButterflies`, `buildLavaFall`.
- `props.js` — natural (rock, rockCluster, stump, log, cliffEdge, standingStone, dolmen), rural (cottage, barn,
  windmill with animated sails, stoneBridge deck, dryWall, railFence, hay, scarecrow, beehive, signpost, shrine,
  lanternPost, gatePosts, roadArch, woodpile, trough, hayWagon, pumpkin), camps & ruins (tent, palisade, campfire,
  lookout, ruinTower, ruinWall, archRuin, gravestone), siege (cannon, barricade).
- `forest.js` — webs, cocoons, egg sacs, owls, thorn arch, root arches, the fallen giant, glow shrooms, moonflowers,
  candles, altar, cauldron, stilt hut, sawpit, bone piles, rune stones.
- `ashen.js` — obsidian spires, spiked Legion walls, fortress towers & gate, banners, pikes, cages, fire pits, the
  siege engine, rails, mine carts & entrance, sulphur vents, charred posts, rubble.
- `pips.js` — acorn houses, the log hall, acorn tower, thimble well, ladybug, caterpillar, snail, leaf bridge, petal
  theatre, seed-vault door, berry stall, fireflies, dewdrops, pebbles, clover, leaf pads, acorn & twig clutter.

## Lab
`node tools/lab.mjs src/lab/fields.js` → `http://localhost:5299/lab/fields.html?zone=goldmeadow&view=iso|overview&at=spawn|x,z|<anchor>&nav=1&labels=1&kinds=npc`
WASD/arrows walk a 1.85 m capsule (scaled by `zone.scale`), Shift runs, N toggles the nav overlay, the panel switches
zone / env / view and filters anchor kinds (pack & fieldboss radii are drawn). `window.__lab.fields = { zone, build(id),
teleport(x, z, f), goto(anchor), overview(), iso(), tour(list, ms), stats(), setEnv(name), ready }`.

## Performance (M-series laptop, 1600×900, high; measured in the real game via `session.loadZone`)
| zone | build | meshes | draw calls at the camera | tris in view |
|---|---|---|---|---|
| brighthold | ~0.5 s | 234 | ~95–115 | ~0.35–0.5 M |
| goldmeadow | ~0.8 s | 335 | ~95–125 | ~0.9 M |
| thornwood | ~0.8 s | 326 | ~75–110 | ~0.4 M |
| ashen_ridge | ~0.7 s | 243 | ~65–100 | ~0.35 M |
| pipsprout | ~0.65 s | ~270 | ~70–110 | ~0.7–0.9 M |
(first zone of a session adds ~0.2–0.8 s of shared texture baking.)

## Known issues / notes for other owners
- **Registration timing.** Field zones register one microtask after the bundle evaluates (import cycle with
  `world/index.js`). Anything that calls `buildZone('<field>')` synchronously *during* bundle evaluation misses them:
  `src/lab/world.js?zone=goldmeadow` throws and `index.html?dev=arena&zone=goldmeadow` falls back to the dev arena.
  The session (`__session.loadZone(...)`) and `src/lab/fields.js` are fine. Fix for the world owner (one line): let
  `registerZone` queue into a hoisted store, e.g. declare `var ZONES`/`BUILDERS` via a function-declaration getter,
  or defer those callers by `await Promise.resolve()`.
- **Pip scale.** `pipsprout` sets `zone.scale = 0.35`; the game does not yet shrink the hero/camera there (the lab does).
- **Seed counts** follow `data/collectibles.js` (goldmeadow 24, thornwood 22, ashen_ridge 18, pipsprout 28) rather
  than FIELDS.md's 8–12, so every catalog seed has a spot; brighthold has 8.
- **Brighthold `fieldboss`** is Ashmaw's field outside the breach (r 12, ~16×44 m) — the prologue has no hourly boss.
- Pack tags beyond the current creature list (beetles, rabbits, slimes in Pipsprout) are suggestions for small mobs.
