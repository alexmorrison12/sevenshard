# models/kit — shared creature toolkit (from Everdawn)

Shared by the creatures and boss owners. **Additive changes only**: add new exports; never change the behaviour of an
existing export (other models depend on it). If you need different behaviour, copy the function into your own folder.

- `sdf.js` — `Prim` primitives (ellipsoid / round cone / rounded box …) bound to bones, smooth-unioned; meshed with
  narrow-band surface nets, projected, skinned (primitive→bone influence), painted, with baked SDF AO.
- `rig.js` — `Rig` (bones), `Pose` (FK with rest-aligned bones, 2-bone IK), easing helpers (`sstep`, `mix`, `env`...).
- `geo.js` — `GeoAcc` accumulation for skinned meshes + rigid parts (sweeps, eyes, tufts, bezier tapers).
- `gait.js` — procedural gait (footfall phases, IK feet planted on the ground).
- `quadruped.js`, `biped.js` — generic locomotion/action controllers (`ActionSet`).
- `material.js` — creature material (lambert stylised + procedural detail textures).
- `parts.js` — reusable rigid parts (horns, claws, teeth, spikes, fins…).

Everdawn's own creatures that used this kit (wolf, boar, bear, spider, kobold, gurgler, critters) and its SDF dragon
are in Everdawn's `src/models/` (the author's earlier browser MMO) — worked examples of the same approach.
