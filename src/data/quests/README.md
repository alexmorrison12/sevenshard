# Quests & story data

Each chapter file (`prologue.js`, `solhaven.js`, `goldmeadow.js`, `pipsprout.js`, `thornwood.js`, `ashen_ridge.js`,
`epilogue.js`, `guide.js`) exports `{ id, name, zone, levels: [lo, hi], quests: [...], cutscenes: { id: def } }`.
`index.js` compiles them into `QUESTS`, `QUEST_LIST` (story order), `CUTSCENES` and `KIND_ORDER`. The runtime is
`src/game/quests/system.js`. Story NPCs and where they stand are in `npcs.js` (`STORY_NPCS`, `PLACEMENTS`); field
residents, mob packs and zone fallbacks are in `src/data/field.js`.

## Quest

```js
{ id: 'g2_wolves', kind: 'msq' | 'side' | 'guide' | 'event' | 'daily', title, level, zone?,
  prereq: ['g1_farm'], when?: Q => bool, minLevel?,
  auto?: true,                 // msq/guide default: accepted when available, in the open world only
  giver?: npcId, offer?: [lines],   // side quests: offered in that NPC's dialogue
  chapterStart?, chapterOver?, // chapter card when accepted
  desc, steps: [...], rewards: { xp, silver, gold, items: { id: n }, gear: [{ slot, grade }], vanguard, pets, titles,
  unlock: ['raid', …], choice: [{ label, …reward }] } }
```

`rewards.xp` is in levels' worth of XP at the quest level. Catch-up and over-level damping are in `xpScale()`
(system.js); story XP tapers off at level 50.

## Steps

Every step has `text` (tracker line) and optional `zone` (defaults to the quest's zone; `null` = anywhere), `at`
(anchor list: `'npc:x'`, `'poi:y'`, `['poi:y', dx, dz]`, `[[x, z]]`), `need`, `onEnter(Q, e)`, `init(Q)`.

| type | fields | done when |
|---|---|---|
| `talk` / `choice` | `npc`, `lines`, `choices: [{ id, text, reply, flag, stay }]` | the dialogue ends (last step = turn-in) |
| `kill` | `mob` / `family` / `tag`, `spawn: { type, name, n, at, elite }` | `need` matching kills |
| `collect` | `item`, `from: { mob }`, `chance` | drops from matching kills |
| `interact` | `at`, `need`, `spread`, `name`, `label`, `dur`, `anim`, `model`, `onUse(Q, obj)` | objects used |
| `reach` | `at`, `r`, `mounted` | the hero gets there |
| `zone` | `zone` | the hero enters the zone |
| `gather` / `event` / `use` | `skill` · `ev` (`hone`, `song`, `emote`…) + `match(d)` · `what` (`skill`, `awakening`, `dash`…) | bus / level events |
| `clear` | `content` (`chaos`, `guardian`, `raid`, `story_chaos`…), `any` | a matching `clear` bus event |
| `defend` / `escort` | `waves`, `dur`, `protect` · `who`, `path`, `ambush` | runner succeeds |
| `encounter` | `boss`, `at`, `bossAt`, `r`, `storyHp`, `atkScale` | the boss dies (EncounterMode in the field) |
| `cutscene` | `id` | the cutscene finishes |
| `signal` | `id` | `Q.signal(id)` from a mode |
| `level` | `need` | character level |

Dialogue lines are strings (spoken by the step's NPC), `{ s: speakerId | 'hero', t }`, or `Q => line`. `{name}` is the
character's name.

## Cutscene

```js
cutscenes: { id: { music, after, run: async (cs, Q) => { cs.shot(pos, look, dur, fov); await cs.say(who, text, secs);
  cs.spawn(npcId, at); cs.walk(u, x, z); cs.anim(u, name, dur); cs.title(name, sub); cs.fade(to, secs); cs.flash(); … } } }
```

The Cutscene API is in `src/game/quests/cutscene.js`. Esc skips; everything spawned without `keep` is cleaned up.
