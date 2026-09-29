# Boss scripting guide

Boss definitions live in `src/data/bosses/<id>.js` and are registered in `src/data/bosses/index.js` (`BOSS_DEFS`).
The brain is `src/game/ai/boss.js` (BossBrain); encounters (arena, party, intro, wipe/victory, HUD) are
`src/game/modes/encounter.js`; raid/guardian tables are `src/data/raids.js`. Reference: `src/data/bosses/rimewing.js`.

## Definition
```js
export default {
  id, model (boss model id, see ARCHITECTURE "Bosses"), name, title, kind: 'guardian'|'legion'|'abyss'|'field',
  radius, height, hp (× reference attack power: ~36000 for a 4-player guardian ≈ 4–5 min; legion gates ~65000–90000 with 8),
  atk (× reference hero HP: 0.1 → a coef-1 hit ≈ 18% of a hero's HP after defence), bars, speed, turnRate, enrage (s),
  music, arena, modelOpts,
  moves: { name: { range, minRange, cd, weight, phase | minPhase, when(B), recover, phaseAfter, async run(B, target) } },
  mechanics: [{ id, at: hpFraction, async run(B) }],      // fire once when HP crosses `at` (highest first)
  onStart(enc), onBossDeath(enc, unit),                    // optional encounter hooks (twin bosses, soft enrage…)
}
```

## Script helpers (inside `run(B, t)`; always `await` waits)
- `B.u` boss unit (`pos`, `fx/fz` forward, `hp/hpMax`, `data`), `B.level`, `B.phase` (number you set), `B.flags` (per-fight state),
  `B.mods.hard` (hard mode), `B.heroes()`, `B.randomHero()`, `B.target`.
- `B.turnTo(unit)`, `B.lookAt(x, z)`, `B.anim(action, dur)` → `{ dur, hits }` (plays the model action).
- `B.wait(sec)` — level clock; throws CANCEL when the boss is countered/stagger-broken (don't catch it except `finally`).
- `B.tele(shape, o)` → telegraph record (set `.alive = false` to remove). shapes: `circle {r}`, `cone {r, deg}`, `rect {len, width}`,
  `donut {r, inner}`; common `o`: `x, z` (default boss pos), `dir {x,z}` (default forward), `off` (forward offset), `dur`,
  `color: 'red'|'orange'|'blue'|'purple'|'yellow'`, `follow: unit`, `safe: true` (safe zones are ignored by AI dodging).
- `B.hit(shape, o)` resolves damage now: same geometry + `coef, knock ('push'|'pull'|'down'|'up'|'stun'), kb, knockDur, status: [{id,dur,chance,power}], fx (preset), sfx, shake, heavy`.
  `shape: 'all'` hits every hero (raid-wide).
- `B.strike(shape, o)` = tele → wait(o.dur) → hit.
- `B.counterWindow(dur, groggy = 3.5)` — blue shimmer; a counter-flagged skill during the window stuns the boss and cancels the move.
- `await B.staggerCheck(amount, dur, { groggy, onFail, label })` — purple stagger bar; broken → boss groggy (move cancelled); else `onFail()`.
  Amount guide: a DPS's very-high-stagger skill does ~50–80; a full 4-party can deal ~450 in 6 s, 8 players ~900.
- `B.destruction(part, amount, onBreak)` — weak-point/destruction bar (weak point level ×10 per hit, destruction bomb 30); calls model `breakPart(part)`.
- `await B.charge(dist, dur, { coef, knock, kb })` run forward through heroes; `await B.leap(x, z, dur, height)`.
- `B.spawnAdds(type, n, r, o)` (mob types from `src/data/mobs.js`), `B.hazard({ x, z, r, dur, tick, hit: { coef, status }, kind })` lingering zone.
- `B.banner(text, kind: 'warn'|'info'|'good'|'stagger'|'fail'|'mechanic')`, `B.level.emit('shake', { unit: B.u, v })`.
- `B.interrupt(groggySecs)`, `B.u.data.hpFloor = hp` (can't drop below until you clear it — for mandatory phase mechanics),
  `B.u.untargetable`, `B.u.data.fly / burrowed / ghost / hover` (visual states the model reads), `B.u.data.dmgTakenFn = (src, o) => mult`.

Design rules (Lost Ark feel): every heavy attack is readable (animation + telegraph ≥ 0.6 s; orange for must-dodge),
1–2 counter windows per minute, one stagger check per phase, a part to break, phases at HP thresholds with a banner,
punishing but fair raid-wide mechanics with clear instructions in the banner, back-attack punishers (tail sweeps).

## Testing
`node build.mjs` then `http://localhost:5299/index.html?dev=boss&boss=<id>&auto=1&party=4` (the AI plays you too),
or a raid gate: `?dev=boss&raid=gorrath&gate=2&auto=1` (8 players), `&hard=1` for hard mode.
`window.__game.mode` is the EncounterMode (`boss`, `bosses`, `party.meterRows()`, `state`); `window.__result` holds the
result when the fight ends. Measure clear time and wipes with a few seeds; tune `hp`, `atk` and timings.
