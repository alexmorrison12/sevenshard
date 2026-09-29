# Session & plugin API (for feature owners)

The session (`src/game/session.js`, lead-owned) runs the flow: title → character select → create → world → content →
results. Features plug in through `src/game/registry.js` and are imported once in `src/game/plugins.js` (already
lists: `quests/index.js`, `modes/field.js`, `modes/prologue.js`, `modes/sailing.js`, `modes/island.js`,
`modes/stronghold.js`, `modes/pvp.js`, `modes/inferno.js`, `modes/events.js`, `meta/index.js`, `systems/hooks.js`;
a file that doesn't exist yet builds as an empty stub). Module top level must only declare + register (no side effects
that can throw); do work in `init(session)`.

## Registry
```js
import { registerPlugin, registerContent, registerService, registerWindow, registerAction, registerZoneMode } from '../registry.js';
registerPlugin({ id, init(session), update(dt), hud(hudState) /* mutate: quests, badges, extra */, interactable() /* → target | null */,
                 interact(target) /* → true if handled */, npcChoices(npcId) /* → [{ id, text, kind }] */, onNpcChoice(npcId, choiceId, unit) /* → true if handled */ });
registerContent(kind, async (session, c) => { /* load zone, spawn, set session.game.mode, session.inWorld() */ });  // session.launch({ kind, ... })
registerService(action, (session, npcDef, npcUnit) => {});       // NPC service (src/data/npcs.js `action`)
registerWindow(id, session => data);                              // data for ui.open(id, data) when the player opens it
registerAction('prefix:', (session, type, payload) => handled);   // UI actions ('market:' catches 'market:buy', …)
registerZoneMode(zoneIdOrKind, (session, zone, o) => mode);       // mode for an open-world zone ('goldmeadow', 'field', 'island'…)
```

## Session
- `session.game` — Game: `scene`, `cam` (IsoCam: `shake(v)`, `cinematic({pos, look, dur, fov})`, `endCinematic()`, `groundAt(px,py)`, `toScreen(p)`),
  `level` (Level), `zone` (world zone: `anchors`, `heightAt`, `nav`, `env`, `minimap`, `id`, `name`, `kind`), `hero` (HeroKit: `u` unit,
  `char`, `press/release/basic/dash/identityKey/awakenCast/useItem`), `player` (PlayerCtrl: `aim`, `setDest(x,z)`), `mode`, `party`,
  `fx` (src/fx/README.md), `audio` (src/audio/README.md), `ui` (src/ui/README.md), `net` (co-op), `renderer` (`fx.letterbox/flash/hurt/desat`,
  `grade`), `input`, `hooks.frame` (push `dt => …`), `inputBlocked`.
- `session.account` — Account (src/game/account.js): `roster`, `chars`, `settings`, `count/has/take/give(id, n)`, `grant(char, bundle)`,
  `addItem(char, item)`, `addXp(char, n)`, `save()`. `session.char` — the active character record.
- `session.ui` — UI (banner, toast, dialog, confirm, prompt, open/close/update windows, chat, screen).
- `session.bus` — gameplay events (see registry.js header): `kill`, `talk`, `zone`, `clear`, `collect`, `gather`, `hone`, `facet`, `song`,
  `emote`, `levelup`, `quest`, `item`, `sail`, `pvp`, `death`, `npcChoice`. Emit your own the same way (`session.bus.emit('gather', {...})`).
- `await session.loadZone(id, { kind, region })` (loading screen, builds zone, new Level) → zone
- `session.spawnMe(at)` → HeroKit for the active character at `{ x, z, facing }`
- `session.inWorld()` → game screen + HUD feed. `session.zoneMode(zoneId)` → the registered mode for a zone.
- `session.launch(c)` → content (registered kinds or built-ins `chaos` / `guardian` / `raid`); `session.contentDone(c, result)` → rewards +
  results screen for the built-ins; `session.returnToHub()`.
- `session.interact(target)` NPC dialog (with plugin choices) and services; `session.findInteractable()`.

## Modes (`session.game.mode`)
`{ kind, enter(), exit(), update(dt), preUpdate?(dt), interactable?(), interact?(t) → bool, bossHud?(), progressHud?(), timerHud?(), partyHud?() }`
Examples: `src/game/modes/city.js` (hub: NPCs, AI adventurers), `chaos.js` (waves + progress), `encounter.js` (bosses + party + results).
Useful building blocks: `makeMob(type, { x, z, ref, alert, elite, hpMul, scale })` / `refFor(levelOrIlvl)` (src/game/ai/mob.js),
`makeBoss(def, o)` (ai/boss.js), `Party` (party.js: `addLocal`, `fill(n, at, ilvl)`, `bindMeter`, `meterRows`, `revive`),
`Unit` (unit.js), Level (level.js: `units`, `add/remove`, `query`, `telegraph`, `projectile`, `groundZone`, `after/every/wait`, events
`damage/death/spawn/...`), combat helpers (combat.js: `dealDamage`, `applyStatus`, `heal`, `addShield`, `resolveHit`).
NPCs are Units `{ kind: 'npc', team: 2, data: { npc: outfit, npcDef: { id, name, title, action, lines } } }` (see modes/city.js).

## Testing
`node build.mjs`, then `node tools/flow.mjs --content=chaos:1 --secs=12 --shots=$SP/you` (fresh save → create → Solhaven → content)
or drive `window.__session` from `tools/shot.mjs --evalAfter`. `node tools/errors.mjs <url> 8000` prints console/shader errors.
Keep the build green: other owners test against the same `dist/index.html`.
