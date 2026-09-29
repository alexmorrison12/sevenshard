# src/world — zones for SEVENSHARD

Every zone is procedural: GPU-baked tileable textures, a splat-painted heightfield, merged architecture, instanced
foliage, decals, water/lava shaders and ambient FX. Entry: `src/world/index.js`.

## Contract

```js
import { buildZone, ZONES, applyEnv } from './world/index.js';
const zone = await buildZone('solhaven', { quality: 'high', seed: 1, onProgress: (f, label) => {} });
scene.add(zone.root);
await zone.precompile(renderer, camera, scene);          // optional: no shader hitch the first time water etc. is seen
applyEnv(zone.env, { sun, hemi, scene, renderer, focus: heroPos }); // or apply the fields yourself
// every frame
zone.update(dt, t, heroPos, camera);
// leaving
zone.dispose();
```

| field | meaning |
|---|---|
| `zone.root` | `THREE.Group` at the origin. **Do not move it** — ground/decal/water shaders use world coordinates. |
| `zone.env` | `{ preset, sunColor, sunIntensity, sunDir: [x,y,z] (unit, toward the sun), hemiSky, hemiGround, hemiIntensity, fogColor, fogSunColor, fogDensity, fogHeight, fogBase, background, grade: {…GRADE_DEFAULT}, music, ambience, weather, night (0..1) }` |
| `zone.heightAt(x, z)` | walking height: the heightfield (exactly matching the rendered triangles) or a registered deck (piers). |
| `zone.nav` | `{ cell: 0.5, w, h, x0, z0, data: Uint8Array }`, row-major `data[j * w + i]`, 1 = walkable. Cell (i, j) spans `[x0 + i·cell, x0 + (i+1)·cell) × [z0 + j·cell, …)`. Obstacles are already inflated by ~0.3 m (hero radius); every anchor is on a walkable cell and every zone's walkable area is one connected piece (chaos_rift: one piece per stage island). |
| `zone.walkable(x, z)` | nav lookup (false outside the grid). |
| `zone.anchors` | `{ name: { x, z, facing } }` (some carry `y`, see below). Facing uses the model convention: forward = (−sin f, 0, −cos f), 0 = looking north. |
| `zone.regions` | `[{ name, x, z, r }]` area labels. |
| `zone.minimap` | `{ canvas, x0, z0, size }` painted top-down map (splat colours, hill-shading, roofs, water, walkable-edge rim). Canvas pixel (u, v) ↔ world (x0 + u/px·size, z0 + v/px·size). |
| `zone.update(dt, t, focus, camera)` | light pool (nearest K lanterns/braziers become real PointLights with flicker), grass follow, particles, emissive pulses; writes `G.uPlayerPos` (see *cutaway*). `G.uTime`/`G.uCamPos` are expected to be set by the game each frame (as the lab kit does). |
| `zone.dispose()` | frees the zone's geometries, materials and ground textures (shared baked texture sets stay cached). |

`ZONES = { id: { name, kind, size } }`:

| id | name | kind | notes |
|---|---|---|---|
| `test` | Proving Plaza | arena | 60×60 walled plaza for combat tests |
| `solhaven` | Solhaven | city | capital hub, ~160×160 playable |
| `chaos_rift` | Demon Rift | dungeon | three floating islands (x = −110, 0, +110) |
| `frostmere` | Frostmere | arena | Rimewing's frozen lake bowl |
| `throne_of_horns` | Throne of Horns | arena | Gorrath's colosseum (Legion Gate 2) |
| `kennels` | The Kennels | arena | Skarn & Vesk pit (Legion Gate 1) |
| `crucible` | The Crucible | arena | 3v3 PvP |
| `inferno` | Inferno Descent | dungeon | roguelite floor, **layout randomised by `opts.seed`** (pass the floor number) |
| `stronghold` | Brightwater Isle | stronghold | the player's manor island |
| `cinderforge` | Cinderforge | arena | Cinderhorn's volcanic caldera (~64 m) |
| `sunscar` | Sunscar Basin | arena | Sandmaw's desert basin (~76 m, open floor) |
| `foxfire_shrine` | Foxfire Shrine | arena | Kurai's moonlit mountain shrine (~60 m) |
| `oratory_choir` | The Drowned Choir | arena | Sunken Oratory gate 1, Nerissa (flooded nave, ~56 m) |
| `oratory_abyss` | Oracle of the Deep | arena | Sunken Oratory gate 2, the Deep Oracle (abyss platform, ~50 m) |

### Extras (beyond the contract)
- `applyEnv(env, { sun, hemi, scene, renderer, focus })` — light colours/intensities, sun position relative to `focus`
  (the sun's target follows focus), shared fog uniforms in `G`, `scene.background`, `renderer.grade`.
- `makeEnv(preset, overrides)`, `PRESETS` — lighting presets: `day` (warm golden afternoon), `dusk`, `night`,
  `dungeon`, `void` (violet rift), `frost`, `volcanic`, `blood` (legion red), and for the guardian arenas `caldera`,
  `desert`, `moonlit`, `drowned`, `abyss`.
- `zone.envs` / `zone.setEnv(name)` — named variants. `solhaven`, `test`, `stronghold`: `day | dusk | night` (night lights
  windows, boosts lamp pools, dims water); `crucible`: `dusk | day`. `setEnv` returns the env to apply.
- `zone.precompile(renderer, camera, scene)` — `compileAsync` over the zone (renderer = the game's `Renderer` or a
  `WebGLRenderer`).
- `zone.stats` `{ build, bake, meshes, tris }`, `zone.bounds` `{ x0, z0, x1, z1 }` (playable rectangle),
  `zone.decks` (walkable surfaces above the heightfield), `zone.stages` (chaos_rift: `[{ name, x, z, r }]`),
  `zone.spots` (solhaven: chimneys, forge hearths, crystals, sunheart — handy FX emitters: `[x, y, z]` lists).
- `registerZone(id, def, buildFn)` — add/replace a builder at runtime. `bakeStats` — texture bake timing.
- **Cutaway:** every building/foliage/flag material dissolves (ordered dither) inside a small screen-space ellipse around
  the hero when it is in front of the hero, so roofs and trees never hide the character. Driven by `G.uPlayerPos`
  (set by `zone.update`; the game may also set it itself).
- **Weather/ambience** (`env.weather`): `clear`, `snow` (frostmere renders its own snowfall), `embers`, `ash`, `none` —
  each zone already renders its ambient particles (dust, motes, embers, ash, snow, fireflies).

## Anchors per zone

**test** — `spawn` (0, 18), `boss` (0, −8), `npc:trainer`, `spawn:m1…m8` (ring r = 12).

**solhaven** — `spawn` (0, 9.2, facing the fountain), `triport:solhaven`, `mailbox`, `board:party`,
`portal:chaos | guardian | abyss | legion | inferno` (Rift Nexus pads, terrace NW), `dock:ship` (end of the second pier),
`gate:goldmeadow` (west gate), `fish:1` (end of the first pier), `vista:1` (terrace balustrade over the harbour),
`seed:1…5`, NPCs `npc:blacksmith` (forge, West Road), `npc:gemcutter`, `npc:tailor`, `npc:stable`, `npc:market`
(broker kiosk, Market Row), `npc:general`, `npc:bank` (domed bank, NE of the plaza), `npc:cards`, `npc:tasks`,
`npc:guild` (Guild Hall, terrace NE), `npc:pvp` (terrace banners), `npc:songs` (garden gazebo), `npc:harbor`,
`npc:stronghold` (quay), `npc:brannoc` (grand stairs), `npc:seraphine` (Rift Nexus), `npc:rapport1…3`;
36 idle spots: `idle:fountain1…8`, `idle:bench1…4`, `idle:market1…4`, `idle:dock1…4`, `idle:garden1…4`,
`idle:nexus1…3`, `idle:guild1…2`, `idle:forge1`, `idle:triport1`, `idle:well1`, `idle:stairs1…2`, `idle:arcade1…2`.
Regions: Central Plaza, Market Row, Harbour, Artisan Quarter, West Gate, Rift Nexus, Guild Hall, Royal Keep,
Garden of Dawn, Lantern Row. Heights: city 0, north terrace +3 (grand stairs at x = 0, ±46), harbour quay −1.5
(ramps at z ≈ 0 and 44), piers are decks at −1.29.

**chaos_rift** — per stage N ∈ {1, 2, 3} (island centres x = −110, 0, +110, z = 0): `stageN:spawn` (south rim),
`stage1:exit`, `stage2:exit` (the swirling rift portal on the north rim), `stage3:boss`, `sN:m1…m12` (mob points,
≥ 6.5 m apart, away from the spawn), `sN:elite`. Stages are separate islands: move between them by teleport.

**frostmere** — `spawn` (0, 27, south shore), `boss` (0, −6), `boss:perch` (north cliff top, has `y`: 17 — not
walkable, for the wyvern's perch/landing), `dive:1…4` (ring r = 18), `camp` (hunters' fire by the approach).
Lake: ice radius 30, walkable radius ~38.

**throne_of_horns** — `spawn` (south gate), `boss` (0, −8), `throne` (on the Horned Throne, has `y`, not walkable),
`pillar:1…8` (walkable spots in front of the eight horned pillars at r = 21.5, starting north-east going clockwise),
`wedge:1…8` (centres of the eight floor wedges at r = 11, starting north). Walkable radius 28.

**kennels** — `spawn`, `boss` (0, −6), `boss:skarn` (−6, −8), `boss:vesk` (6, −8), `kennel:1…5` (in front of the five
kennel gates on the north wall). Walkable radius 23.

**crucible** — `spawn`, `team:a1…a3` (south dais, facing north), `team:b1…b3` (north dais, facing south), `center`.

**inferno** — `spawn` (south), `exit` (fire gate, north), `boss`, `boon` (centre), `spawn:m1…m10`. Outline, column
clusters, lava pools and mob points change with `seed`.

**stronghold** — `spawn`, `dock:ship`, `building:manor | workshop | research | barracks | garden | ranch`,
`npc:steward`, `npc:shipwright`, `idle:isle1…7`.

### Guardian arenas (`spawn` south facing north, `boss` centre-north facing south = π, `camp` by the entrance)
| id | spawn | boss | camp | walkable | notes |
|---|---|---|---|---|---|
| `cinderforge` | (0, 21) | (0, −5) | (−8.5, 24.5) | radius ≈ 28.6, lip at z ≈ −19.5 | cracked columnar basalt with molten seams; the shelf breaks off in the north over a molten lake with four lava falls; obsidian spires & basalt organ columns on the rim; smoke plumes, heat haze, ash + embers. Env `caldera`. |
| `sunscar` | (0, 28.5) | (0, −6) | (−8.75, 30.25) | radius ≈ 34.7 (3 600 m², no props on the floor) | wind-rippled dunes over a half-buried sun-plaza; sandstone mesas; colonnades, a sunken gateway, colossus legs, a fallen crowned head, a stone hand, a giant ribcage on the rim; sand streamers + blowing sand. Env `desert`. |
| `foxfire_shrine` | (0, 12.4) | (0, −5) | (−8.4, 17.4) | radius ≈ 26.7 + gate avenue | polar-paved courtyard, vermilion gate avenue from the south, stone lanterns, fox guardians, a wooden stage (deck y = 0.42) and a two-tier shrine hall in the north, bell pavilion, moon-viewing pond, autumn maples with falling leaves, blue foxfire wisps, a big moon. Env `moonlit`. |
| `oratory_choir` | (0, 21) | (0, −12) | (−6.5, 24.5) | nave 35 × 50 m | ankle-deep flood water (y = 0.3, visual only — walk height is the floor) with hero ripples & caustics, coral-crusted clustered columns, lancet windows, the great rose window + a fallen one, organ, coral throne, pews, chandelier, god rays. Env `drowned`. |
| `oratory_abyss` | (0, 17) | (0, −7) | (−7.5, 18.4) | platform radius ≈ 23.4 | ancient-stone disc over black water (y = −1.6) with a glowing rim skirt, broken arches (tall north, stumps south), glow-coral, 70 bioluminescent kelp strands, seven giant tentacles, the drowned cathedral silhouette in the north. Env `abyss`. |

## The kit (reusable modules)

| module | what it gives you |
|---|---|
| `bake.js` | GPU texture baker: a private WebGL2 context renders periodic GLSL "paintings" once per texel (MRT: colour+height, AO+emissive+alpha), then derives normal/cavity maps; `bakeSet(recipe, { size, outputs: ['albedo','normal','normal3','rgba','emit'], bump, cavity })`. GLSL lib: `pnoise/fbm/vfbm/ridged/pvoro` (periodic), hashes, `Surf` struct. |
| `textures.js` | Ground layers (one `DataArrayTexture` pair, albedo+height / packed normal+AO+emissive): `grass, dirt, cobble, fan` (fan-pattern setts), `flagstone, sand, snow, obsidian` (glowing fissures), `ice, rock, marble, moss` (leaf litter), `void` (corruption veins), `gravel, bloodstone, mud, basalt` (hex columns with molten seams), `cinder` (ash & slag with hot cracks), `dunes` (wind ripples), `sandstone` (eroded pavers), `seastone` (drowned checker floor with algae & barnacles); `autumnAtlas()` (maple leaves); `LAYER_TILE` metres/repeat. Architecture `kitTex(name)`: `ashlar, plaster, tiles, slate, planks, timber, metal, gold, cloth, rockface, marbleWall, darkstone` (emissive cracks), `bone, window` (emissive panes), `thatch, bark, glacier`. `decalAtlas()` (16 slots), `foliageAtlas()`, `noiseTex()`. All cached per session (~0.2–0.4 s total on first use). |
| `ground.js` | `Ground({ x0, z0, w, d, res, layers: [≤12], base, seed })`: `sculpt(fn)`, `flatten/raise(shape, …)`, `paint(layer, shape, { soft, noise, nscale, amount })` ("over" compositing), `info('ao'|'wear'|'wet'|'glow', shape, …)`, `plaza(x, z, r, { layer, tile, rings, spokes, border, keep })` (polar paving, ≤4; `keep: true` = half-buried: painted weights still apply and the inlays only show where the paving does), `tint`, `emitColor`, `build(parent, { clip })`, `heightAt/normalAt/weight/infoAt`. Shader: height-blended splats, anti-tiling (two offset samples blended by noise), per-layer normal maps, macro variation, polished wear, glossy wet, contact AO, emissive fissures, pooled glow. |
| `shapes.js` | 2D SDF shapes: `circle, ring, rect(x, z, w, d, rot), poly, line(pts, width), all, union, subtract, inflate`. |
| `nav.js` | `NavGrid(x0, z0, w, d, 0.5)`: `walk(shape)`, `block(shape, inflate)`, `blockWhere(fn)`, `keepConnected(seeds)`, `nearest(x, z, r)`, `walkable`, `toContract()`. |
| `kit.js` | `Kit`: `add(material, geometry, matrix, { tint, ao, yGround, aoH, cast, chunkAt })` merges into one mesh per material × 40 m chunk × shadow flag; `glow(geo, m, hex, intensity)` (HDR), `block(shape)`, `light(...)`, `flame(...)`, `spots`. Materials (`kitMaterial(name)`): `stone, plaster, roof, slate, planks, timber, metal, gold, cloth, rock` + `darkrock` + `icecliff` + `wetrock` (triplanar with normals), `marble, dark, bone, window, thatch, paint, ice, glow, lacquer` (vermilion wood), `obsidian` (glassy), `coral`, `wetstone`. Primitives with metre UVs: `box, walls` (hollow), `cyl, cone, sphere, gableRoof, hipRoof, extrude, archPanel`; `M(...)`, `Frame`, `faceTo`. Shader patches `cutV/cutF` (screen-space hero cutaway), `BAYER`. |
| `props.js` | barrel, crate, crateStack, sack, pot, bench, lampPost, wallTorch, wallLamp, brazier, planter, roundPlanter, flowerBox, flowerPot, column, stairs, wall (crenellated), tower, stall, kiosk, cart, well, noticeBoard, mailbox, anvil, weaponRack, hay, dummy, banner, flagPole, lanternString, bunting, fountain, balustrade, retaining (terrace wall), gazebo, fenceLine, ropeCoil, fishBasket, anchorProp, net, logPile, coalPile, bollard, statue. |
| `buildings.js` | `townhouse` (white stone + plaster, quoins, arched windows with shutters & flower boxes, shop awnings/signs, balconies, dormers, chimneys; hidden north faces skip detail), `row` (a street frontage), `arcade` (low arches + rooftop café terrace: the iso-friendly south side of a street), `dressStreets` (sidewalk strips + clutter at every visible front door), `guildHall, bank` (golden dome), `forge, gatehouse, keep, lighthouse, ship` (lofted hull, masts, sails, rigging), `crane, pier, portalPad, triport, sevenLights` (the Seven Lights statue & Sunheart prism), `portico`, `archedWindow, archDoor`; `ROOF` colours. |
| `foliage.js` | `Grass(ground, { layer, density, height, tint })` — GPU tufts around the player wherever `layer` is painted (bent away from the hero); `Flora`: `tree('broadleaf'|'blossom'|'maple'|'cypress'|'pine'|'dead'|'bush', x, y, z, { s, variant, opts })` (`maple` opts.palette 0–3), `flower(x, y, z, colour)`, `build(parent)` — instanced per 40 m cell, wind sway, cutaway. |
| `decals.js` | `Decals(heightAt).add(kind, x, z, { size, rot, alpha, tint, emit, emitI, sx, sz })` → one mesh. Kinds: `cracks, rubble, leaves, puddle` (glossy), `moss, blood, scorch, stain, runes` (emissive), `pebbles, petals, grate, fissure` (emissive), `frost, straw, sunmark`. |
| `water.js` | `buildWater(ground, { x, z, w, d, level, shallow, deep, swell, foam })` (depth from the heightfield, ripples, fresnel, glints, shore foam), `buildPool`, `buildLava`, `buildJets` (fountain arcs). |
| `fx.js` | `buildFlames(list)`, `LightPool(parent, lights, K)`, `buildParticles('embers'|'dust'|'snow'|'ash'|'motes'|'fireflies'|'leaves'|'sand'|'bubbles'|'plankton'|'foxfire', { count, color, color2 })`, flames accept `{ bob, orbit, intensity }` (drifting wisps), `Flags` (waving banners/pennants), `buildShafts` (god rays), `buildRiftPortal`. |
| `cliffs.js` | `islandSkirt` (floating-island underside with cliff face, strata, glowing seams, stalactites), `cliffRing` (displaced rock/ice wall along a polyline, `heightFn`), `boulder, spike, crystal`, `buildFloaters` (bobbing rocks), `buildVoidFloor` (nebula), `buildAbyssMist`, `buildRimGlow`. |
| `arenas.js` | set pieces for guardian arenas: `buildLavaFalls`, `buildPlumes` (smoke columns), `buildHaze` (heat shimmer), `buildMoon`, `buildMoonPond` (moon reflection + glitter path), `buildFlood` (wade-able shallow water: depth tint, caustics, fresnel, rings around the hero — call `mesh.userData.update(focus, dt)`), `buildKelp` (instanced swaying strands with glowing tips), `buildStreamers` (ground-hugging blowing sand). |
| `shrine.js` | original mountain-shrine architecture: `gateArch`, `stoneLantern`, `foxGuardian`, `shrineHall` (plinth, colonnade, lattice doors, two-tier upswept roof), `stage` (registers a walkable deck), `paperLanterns`. |
| `minimap.js` | `paintMinimap(zone, { px, area, roofs, water, marks, clip })`. |
| `env.js` | `PRESETS`, `makeEnv`, `applyEnv`. |
| `zone.js` | `Zone` base: `anchor, region, deck, onUpdate, onEnv, setEnv, precompile, dispose`. |

## Shared kit & other owners
The kit modules above are also used by the world-fields owner (`zones/goldmeadow.js` …, `fields/`, see `FIELDS.md`)
and the sea owner (`sea/`), who register zones with `registerZone`. Keep kit changes **additive** (new options/exports);
the kit was verified against Goldmeadow after the last round of changes. Kit-level visual changes (env presets, water,
cliffs) apply to every zone that uses them.

## Performance (M-series Mac, headless Chrome, 1600×900, quality high)
| zone | warm build | draw calls at spawn | tris at spawn | sustained |
|---|---|---|---|---|
| solhaven | 0.45–0.7 s (first zone of a session adds ~0.3 s of texture baking) | 176–215 | 0.5–0.68 M | 60 fps |
| chaos_rift | 0.43 s | 58 | 40 k | 60 |
| frostmere | 0.14 s | 86 | 42 k | 60 |
| throne_of_horns / kennels | 0.08 s | 56–58 | 28–46 k | 60 |
| crucible / inferno | 0.05–0.1 s | 46–99 | 43–70 k | 60 |
| stronghold | 0.15 s | 216 | 0.46 M | 60 |
| cinderforge | 0.35 s cold / 0.15 s warm | 60–63 | 86–90 k | 60 |
| sunscar | 0.67 s / 0.21 s | 47–52 | 78–83 k | 60 |
| foxfire_shrine | 0.50 s / 0.24 s | 144–151 | 0.37 M | 60 |
| oratory_choir | 0.61 s / 0.14 s | 53–62 | 133–158 k | 60 |
| oratory_abyss | 1.18 s / 0.36 s | 54–55 | 135–137 k | 60 |
Shadows: buildings, props and trees cast; ground, decals, grass, flowers and water don't. Draw-call counts include the
shadow pass and post. No per-frame allocations in zone.update.

## Lab
`node tools/lab.mjs src/lab/world.js` → `http://localhost:5299/lab/world.html?zone=solhaven&view=iso&env=day&at=spawn&nav=1&labels=1`
(`at` = an anchor name or `x,z`; `view=overview` for a high view; `dist=20` sets the iso distance; `boss=<guardian id>` places
that guardian at `anchors.boss` for scale/framing; `hero=1` swaps the capsule for a real hero model). WASD/arrows walk a 1.85 m capsule (Shift runs),
N toggles the nav overlay, the panel switches zone / day-dusk-night / iso-overview / anchor labels.
`window.__lab.world` exposes `build(id)`, `teleport(x, z, facing)`, `setEnv(name)`, `overview()`, `iso()`, `zone`.
