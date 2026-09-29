# Field zones spec (shared by world-fields, story, modes and systems owners)

Open-world zones are built by the world-fields owner as `src/world/zones/<id>.js` and registered with
`registerZone(id, def, build)` from `src/world/index.js` (additive; do not edit the kit). Story/modes/systems content
binds to zones only through these anchor names, so keep them exact. Every zone also returns the standard contract
(root, env, heightAt, nav, walkable, anchors, regions, minimap, update, dispose).

| id | name | theme | size | levels |
|---|---|---|---|---|
| `brighthold` | Siege of Brighthold (prologue) | a castle and its lower town burning at night; walls, gatehouse, courtyard, cannons on the ramparts, a breach where the siege behemoth Ashmaw batters the wall | ~140×180 m, linear | 1–5 |
| `goldmeadow` | Goldmeadow | golden farmland: wheat fields, windmills, a river with a stone bridge, a farming hamlet, orchards, bandit camp, wolf dens, boar pastures | ~220×220 m | 5–25 |
| `thornwood` | Thornwood | dark ancient forest: giant roots, fog, mushrooms, a ruined abbey, spider hollows, cultist circles, a treant grove | ~220×220 m | 25–40 |
| `ashen_ridge` | Ashen Ridge | demon-scorched highlands: ash dunes, lava fissures, broken watchtowers, the Legion fortress with a gate and a courtyard arena (Varkhul) | ~220×240 m | 40–50 |
| `pipsprout` | Pipsprout Hollow | the Pips' home seen at Pip scale: giant flowers and mushrooms, dewdrop ponds, acorn houses, a hollow-log town hall | ~160×160 m | any |

## Required anchors (x, z, facing)
- `spawn` (arrival), `gate:<zoneId>` exits to neighbouring zones (goldmeadow ↔ solhaven via `gate:solhaven`, goldmeadow → `gate:thornwood`, thornwood → `gate:ashen_ridge`, …), `triport:<zoneId>` one waypoint statue per field.
- `npc:<id>` quest givers & services — at least 6 per field (e.g. goldmeadow: `npc:farmer_hale`, `npc:miller`, `npc:captain`, `npc:innkeeper`, `npc:hunter`, `npc:child`); list them in the zone README with a one-line role so the story owner can write for them. Pipsprout: `npc:bramblebeard` (Pip elder) + 5 Pips.
- `pack:<n>` mob pack centres (8–16 per field) with a `r` radius and a `tag` naming what lives there (`wolves`, `boars`, `bandits`, `spiders`, `cultists`, `treant`, `demons`, `imps`, `gargoyles`…); `elite:<n>` (3–5) and `fieldboss` (an open area ≥ 30 m for the hourly field boss); `chaosgate` (an open area for the Chaos Gate event).
- `node:<skill>:<n>` trade-skill nodes (skills: `forage`, `log`, `mine`, `hunt`, `fish`, `dig`) — 6–12 per field.
- `seed:<n>` hidden Pip Seed spots (8–12 per field, some tricky: behind props, on ledges, under bridges), `vista:<n>` (2–3, a scenic overlook), `lore:<n>` (2–4 books/steles), `poi:<name>` story locations (e.g. `poi:bandit_camp`, `poi:abbey`, `poi:fortress_gate`, `poi:breach`).
- Prologue extras: `cannon:1..4` (usable cannons on the ramparts), `breach` (where Ashmaw attacks), `duel` (Varkhul duel arena), `poi:*` beats along the linear path.
- Pipsprout: the zone is authored at Pip scale (the hero is shrunk ×0.35 by the game while inside); flag `zone.scale = 0.35` in the zone object.

## Look
Same quality bar as Solhaven: dense props, painted ground layers, cliffs as boundaries, water, foliage with wind,
lighting presets per zone (Goldmeadow warm afternoon, Thornwood misty green-blue, Ashen Ridge volcanic dusk with
embers, Brighthold night fires, Pipsprout bright storybook morning). Minimap canvas for each.
