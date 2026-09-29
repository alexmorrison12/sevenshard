# models/hero — SEVENSHARD heroes

Entry: `src/models/hero/index.js`. Lab: `node tools/lab.mjs src/lab/heroes.js` → `http://localhost:5299/lab/heroes.html`.

> Status: work in progress — the API below is stable; visuals and the per-weapon move library are being filled in.
> Every action name in the contract already plays (weapon-specific variants where authored, a sensible generic
> version otherwise).

```js
import { createHero, CLASSES, NPCS } from './models/hero/index.js';
const h = createHero({ cls: 'reaver', sex: 'm', gear: { tier: 1 }, weapon: { tier: 1, hone: 0 } });
scene.add(h.root);
h.update(dt, { speed, turn, combat, dead, down, stunned, mounted, sit });   // every frame (dt may be 0 = hit-stop)
const { dur, hits } = h.play('slash_h', { dur: 0.8 });                      // hits = impact times in seconds
```

## createHero(opts) → hero
| opt | values | default |
|---|---|---|
| `cls` | `'reaver'|'oathkeeper'|'stormfist'|'pistoleer'|'starcaller'|'songweaver'|'bladedancer'|'demonbound'|null` | `'reaver'` |
| `sex` | `'m'|'f'` | `'m'` |
| `look` | `{ face 0-5, hair 0-7, hairColor hex, skin 0-7 (or hex), eyes hex, height 0.94-1.06, build 0-1, marks 0-3, markColor hex }` | per class & sex |
| `gear` | `{ tier: 0|1|2, dye: [primary, secondary, trim] }` | `{ tier: 1 }` |
| `weapon` | `{ tier: 0|1|2, hone: 0-25 }` (tier defaults to gear.tier) | |
| `npc` | one of `NPCS` (overrides `cls`) | `null` |
| `lod` | `'full'|'crowd'` | `'full'` |
| `seed` | number (idle variation) | 1 |

## hero
- `root` (THREE.Group; set `root.rotation.y = facing`, model faces −Z), `height` (m), `radius` (m)
- `sockets`: `handR`, `handL` (grip frames: +Y along the held weapon), `weapon` (main weapon origin), `weaponTip`
  (blade tip / muzzle of the weapon currently in hand), `back`, `head` (eye level, −Z out of the face), `chest`,
  `feet` (root, ground level), `overhead` (root, above the head — nameplates)
- `update(dt, state)` — `state: { speed (m/s along facing), turn (rad/s), combat, dead, down, stunned, mounted, sit }`.
  `combat` draws the weapon (short draw gesture); attack actions draw it instantly. `dead` collapses and holds.
- `play(action, { dur, loop })` → `{ dur, hits: [s…] } | null`. Actions layer over locomotion (upper body while
  moving, full body while standing; movement actions like `dash` always drive the legs).
- `stop()` — ends a looped action. `hold` actions (`death`, `knockdown`, `leap`) keep their last frame until the next `play`.
- `setTint(hex, amount)` (hit flash 0..1), `setGlow(hex, intensity)` (identity / burst glow: rim + weapon edges; 0 off)
- `setStance('pistol'|'shotgun'|'rifle')` (Pistoleer), `setDemonForm(on)` (Demonbound)
- `setLook(look)`, `setGear(gear)`, `setWeapon(weapon)` — live edits (rebuild internally; cached geometry)
- `dispose()`
- `stats`: `{ tris, verts, drawCalls, ms }`

## Actions (typical duration in seconds; hits as a fraction of the duration)
Implemented now with authored greatsword variants: `atk1` 0.70 (0.42), `atk2` 0.72 (0.45), `atk3` 0.95 (0.52),
`slash_h` 0.90 (0.46), `spin` 0.95 (0.36, 0.62), `spin_loop` 0.55 loop; utility: `dash` 0.42, `dash_back` 0.45,
`hit` (additive flinch, never interrupts), `hit_heavy` 0.6, `knockdown` 0.75 (holds down until `getup`), `getup` 0.8,
`stun` 1.6 loop, `death` 1.2 (holds), `revive` 1.3.
(The full vocabulary from ARCHITECTURE.md is being added; this list is updated as it lands.)
