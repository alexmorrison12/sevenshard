# src/world — zones for SEVENSHARD

(Work in progress — this file is kept in sync with the code as zones land.)

## Contract

```js
import { buildZone, ZONES, applyEnv } from './world/index.js';
const zone = await buildZone('solhaven', { quality: 'high', seed: 1 });
scene.add(zone.root);
applyEnv(zone.env, { sun, hemi, scene, renderer, focus: hero.root.position }); // or apply the fields yourself
// every frame
zone.update(dt, t, heroPosition, camera);
```

| field | meaning |
|---|---|
| `zone.root` | `THREE.Group` at the origin (do not move it: materials use world coordinates) |
| `zone.env` | `{ sunColor, sunIntensity, sunDir:[x,y,z] (toward the sun), hemiSky, hemiGround, hemiIntensity, fogColor, fogSunColor, fogDensity, fogHeight, fogBase, background, grade:{…GRADE_DEFAULT}, music, ambience, weather, night (0..1), preset }` |
| `zone.heightAt(x, z)` | ground height (matches the rendered heightfield triangles exactly) |
| `zone.nav` | `{ cell: 0.5, w, h, x0, z0, data: Uint8Array }` row-major (`data[j * w + i]`), 1 = walkable; cell (i, j) covers `[x0 + i*cell, x0 + (i+1)*cell)` × `[z0 + j*cell, …)`. Obstacles are already inflated by ~0.35 m (hero radius). |
| `zone.walkable(x, z)` | nav lookup (false outside the grid) |
| `zone.anchors` | `{ name: { x, z, facing } }` — facing uses the model convention (forward = (−sin f, 0, −cos f); 0 = looking north) |
| `zone.regions` | `[{ name, x, z, r }]` for area labels |
| `zone.minimap` | `{ canvas, x0, z0, size }` painted top-down map; canvas pixel (u, v) ↔ world (x0 + u/px*size, z0 + v/px*size) |
| `zone.update(dt, t, focus, camera)` | animates water, flags, torches/light pool, particles; also writes `G.uPlayerPos` (buildings between camera and player dither out) |
| `zone.dispose()` | frees geometries/materials owned by the zone (shared baked textures stay cached) |

`ZONES = { id: { name, kind, size } }` — ids: `test`, `solhaven`, `chaos_rift`, `frostmere`, `throne_of_horns`, `kennels`,
`crucible`, `inferno`, `stronghold`. Zones not yet built return a placeholder walled arena that already carries the
final anchor names (so integration can start before the art lands).

### Extras (beyond the contract)
- `applyEnv(env, { sun, hemi, scene, renderer, focus })` — applies light colours/intensities, sun direction relative to
  `focus`, the shared fog uniforms in `G`, `scene.background` and `renderer.grade`.
- `zone.envs` — optional named lighting variants (`day`, `dusk`, `night` for the city); `zone.setEnv(name)` switches
  (also updates window glow / lamp intensity) and returns the new env to apply.
- `zone.stats` — `{ build (ms), bake (ms), meshes, tris }`.
- `zone.bounds` — `{ x0, z0, x1, z1 }` playable rectangle.

## Zones

### `test` — Proving Plaza (60×60 m)
Walled flagstone plaza, polar-paved centre (sun inlay), cobble ring, 7 columns, 4 braziers, training dummies (north),
crates/barrels, closed south gate.
Anchors: `spawn` (0, 18), `boss` (0, −8, facing south), `npc:trainer`, `spawn:m1…m8` (ring r = 12).

## Lab
`node tools/lab.mjs src/lab/world.js` → `http://localhost:5299/lab/world.html?zone=test&view=iso&env=day&at=spawn&nav=1&labels=1`
WASD/arrows walk a 1.85 m capsule (Shift runs), N toggles the nav overlay. `window.__lab.world` exposes
`teleport(x, z)`, `setEnv(name)`, `overview()`, `iso()`, `build(id)`, `zone`.
