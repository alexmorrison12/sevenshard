# Skills, tripods and identities — authoring guide

Class kits are data files in `src/data/classes/<id>.js` (see `reaver.js`, the reference kit). The runtime is
`src/game/skills/runner.js` (SkillRun), `tripods.js`, `src/game/identity.js`, `src/game/hero.js` (HeroKit) and
`src/game/combat.js` (hit resolution, statuses). Builders are in `src/game/skills/dsl.js`.

## Kit shape
```js
export default {
  id, name, archetype, role: 'dps'|'support', weapon, difficulty: 1-3, blurb, palette: { main: hex, fx: 'colorName' },
  dash: { cd, dist, dur }, stats: { hp, atk, def }        // multipliers vs the reference hero
  basic: [ { anim, dur, hit: { t, ...shape, coef, stagger }, fx?: { t, preset, ... }, proj?: {...}, sfx? } ×3 ],  // C / left-click combo
  identity: { handler?, kind, label, ... },               // see "Identities"
  awakening: { id, name, type, cd, uses, range, dur, superArmor, fixedSpeed, desc, props, events },
  skills: [ 12 skill defs ],
  defaultBar: [8 skill ids],
  engravings: [ { id, name, desc, mods?, ... } ×2 ],      // class engravings
}
```

## Skill def
```js
{ id, name, type: 'normal'|'combo'|'chain'|'holding'|'charge'|'casting'|'point',
  cd, mp, dur (lock time for normal/point/casting/charge-release), cancelAt (dash-cancel point, default 60% of dur),
  range (point skills: max distance of the ground target), superArmor: 'push'|'full', fixedSpeed (ignore attack speed),
  desc, props: { stagger: 'Low'|'Mid'|'High'|'Very High', wp, counter, attack: 'back'|'head', superArmor },   // tooltip tags
  events: [timeline],                                          // normal / point / casting (+ cast: seconds) / charge (fires on release)
  stages: [{ dur, window, events }],                           // combo (press again) / chain (press again within chainWindow)
  loop: { every, walk (m/s while held), first, events }, holdMax, end: [timeline], endDur,   // holding
  chargeTime, perfect: [lo, hi], perfectMul, minCharge, onStart(run),                        // charge
  stance: 'pistol'|'shotgun'|'rifle',                          // Pistoleer only
  tripods: [[tier1 ×3], [tier2 ×3], [tier3 ×2]] }              // entries: 'generic' | 'generic:value' | { id, name, desc, apply(def) }
```
Timeline builders (time `t` in seconds from the start, scaled by attack speed):
- `A(t, anim, dur, {loop})` hero animation (names in ARCHITECTURE.md "Heroes" actions)
- `H(t, { ...shape, coef, stagger, wp, counter, attack, knock: 'push'|'pull'|'down'|'up'|'stun', kb, knockDur, status: [{ id, dur, chance, power }], brand, heavy, crit, at: 'point'|number, team: 'enemy'|'ally', heal, shield, buff, once })`
- shapes: `circle(r, off)`, `cone(r, deg, off)`, `rect(len, width, off)`, `donut(r, inner)`; `off` shifts the origin forward.
  `at: 'point'` centres the hit on the (range-clamped) cursor point; a number = metres ahead of the caster.
- `M(t, 'dash'|'back'|'leap'|'toAim'|'blink', dist, dur, { height, iframes, to: 'behind', stopShort })`
- `P(t, { speed, range, radius, pierce, count, spread (rad), kind, color, hit, homing, turn, arc, at })` projectiles
- `Z(t, { r, dur, tick, first, hit, at, kind, follow, team })` ground zones (ticking)
- `B(t, { target: 'self'|'party', id, dur, mods, name, shield (× atk), shieldDur, heal (× atk, or healOf:'max' → × target max HP), r })`
- `FX(t, preset, { color, r, arc, flip, vertical, spin, big, len, width, at, follow })` — generic presets: `slash`, `shockwave`, `burst`; anything else is passed to `fx.play(name, params)` (see src/fx/README.md), with a fallback.
- `S(t, sfxName)` (src/audio/README.md names), `K(t, trauma 0..1)` camera shake, `T(t, telegraph)`, `C(t, fn(run, level))`.
- `hits(n, t, dt, spec)` splits one hit spec into n ticks.

Damage: `coef` × attack power × skill level mult (1 + 0.12·(lv−1)) × tripods × crit/back/head × buffs × target defence.
Tuning target at equal item level: a full 8-skill rotation ≈ 25–45 × attack power per second against one target.
Rough coef budget per cast ≈ 3–4 × cooldown seconds (spread across hits); holding/charge a bit more; awakenings 500–900.
Supports (Oathkeeper, Songweaver) deal ~40% of a DPS but bring buffs: party atk (+10–15%), brand (+10% taken), shields, heals.

Colours for FX (`color`): crimson, gold, holy, lightning, fire, ice, arcane, dark, brass, rose, teal, demon, silver, cyan, green, white.

## Identities (`identity` in the kit)
- `handler: 'reaver'` — see reaver.js.
- `handler: 'gaugeSkills'` (default for kind 'gauge'): `{ kind: 'gauge', label, max, gainPerHit, gainBasic, gainPerCast, color,
  z: { ...skill def, cost } | { mode: true, id, name, dur, mods, glow, fx, color, onStart(kit, st) }, x: {...}, activeLabel, hooks(kit, st) }`
- `handler: 'orbs'` (kind 'orbs' or 'bubbles'): `{ kind, label, perOrb, maxOrbs, gainPerHit, gainBasic, color, hudKind,
  z: { ...skill def, orbs: n | 'all', perOrbMul, dur, perOrbDur }, x: {...} }`
- `handler: 'pistoleer'`: stances (`stance` on each skill; casting swaps with a Quickdraw buff) + `focus: { dur, mods }`, `max`, `gainPerHit`.
- `handler: 'demonbound'`: `{ max, gainPerHit, gainBasic, dur, mods, demonSkills: [4 skill defs for Q W E R] }`.
Hooks available to identities: `onHit(evs, hit, ctx)`, `onCast(def, run, opts)`, `update(dt)`, `key(k, aim)`, `hud()`,
`skillMul(def, opts)`, `cdMul(def)`, `mpMul()`, `overrideSkill(slot)`.

## Testing a kit
`node build.mjs` then open `http://localhost:5299/index.html?dev=arena&cls=<id>` (options `&mobs=30&ilvl=1415&theme=void`).
`window.__game` exposes `hero` (HeroKit: `press(slot, aim)`, `release(slot)`, `basic(aim)`, `dash(aim)`,
`identityKey('z'|'x', aim)`, `awakenCast(aim)`), `player.aim`, `level` (events: damage, death, skillStart, …).
