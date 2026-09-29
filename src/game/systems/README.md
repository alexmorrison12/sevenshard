# SEVENSHARD systems — progression & economy layer (`src/game/systems/`)

Pure logic (no DOM, no three.js): plain functions that operate on an `Account` (src/game/account.js) and a character
record and return plain result objects. Deterministic when given an RNG. Everything persists inside `account.data`
(roster-wide state under `account.roster.*`, per-character state on the `char` object) and is saved via `account.save()`.
`hooks.js` is the one module that talks to the session: it plugs every system into `src/game/registry.js` (window data,
UI actions, NPC services, bus tracking, ticks) — see **hooks.js** at the end.

```js
import * as S from './game/systems/index.js';
S.loot.chaosReward(account, char, { tier: 3 });          // namespaces: common rolls gear stats loot economy honing cards
S.market.buy(account, char, 'leapstone', 5);             //   gems engravings market stronghold lifeskills collectibles
S.tasks.track(account, char, 'kill', { family: 'demon' }); // rapport tasks guild shops mail titles boards mods
const ctx = S.statContext(account, char);                // top level: tick, track, statContext, applyMods, simulateEconomy
```
Tests: `node tools/test-systems.mjs` (452 checks + economy summary, ~2 s; `--quick` for a shorter run).

## Conventions
| | |
|---|---|
| `account` | an `Account`. Systems use `account.roster`, `account.data`, `account.chars`, `count/has/take/give/addItem/addXp/addRosterXp/resets/save`. |
| `char` | a character record (`char.equip`, `char.inv`, `char.books`, `char.gems`, `char.daily`, `char.rest`, `char.weekly`…). Pass `null` where a function says the character is optional. |
| `now` | optional last argument / option (ms since epoch), default `Date.now()`. Daily reset 10:00 UTC, weekly Wednesday 10:00 UTC. |
| `rng` | optional: an `RNG` (`src/core/noise.js`), a `() => [0,1)` function, or a numeric/string seed. Omitted → `Math.random`. |
| results | actions return `{ ok: true, … }` or `{ ok: false, why, msg, … }` — `why` a short code (`'materials'`, `'locked'`, `'limit'`, `'energy'`…), `msg` a player-facing sentence (e.g. "Not enough Destruction Stone (need 240 more)."). |

### Shared shapes
```js
Row    = { id, name, count, grade: 0..7, icon, kind, uid?, item?, unlock? }
         // one line of a reward/cost list. ids: wallet currencies ('silver','gold','crystals','royal','shards','pirate',
         // 'bloodstone','pvp','tokens'), ITEMS ids, unique items (item = the full Item), cards ('card:<id>'), unlocks
         // ('titles:<id>' | 'mounts:<id>' | 'pets:<id>' | 'emotes:<id>' | 'songs:<id>' | 'unlocks:<id>', unlock: 'Title'…)
Bundle = { <currency|ITEMS id>: count, items?: [Item], cards?: { cardId: n }, xp?, rosterXp?, skillPts?,
           titles?: [id], mounts?: [id], pets?: [id], emotes?: [id], songs?: [id], unlocks?: [id] }
Item   = ARCHITECTURE.md Item (unique items carry a uid: gear, accessories, stones, bracelets, gems, books)
Cost   = { <currency|ITEMS id>: count }
Notification = { kind: 'taskDone'|'weekly'|'rep'|'title'|'achievement'|'rapport'|'research'|'sold'|'expired'|'event'|'board'|…, text, id? }
```
Icons follow `src/ui/icons` ids (`item:<id>`, `currency:<id>`, `item:gem:<type>:<lv>`, `item:book:<engr>`, `npc:<id>`,
`boss:<id>`, `class:<id>`). New stackables in items.js carry an `icon` when their own id has no art. Cards use
`cardIcon(id)` → `boss:<id>` / `npc:<id>` / `class:<id>` portraits.

### Persistence map
| state | path |
|---|---|
| wallet / materials | `roster.wallet`, `roster.mats` (Account helpers) |
| cards | `roster.cards[id] = { n: duplicates, awaken }`, `roster.deck = [id\|null ×6]`, `roster.cardChoice` (pending selector) |
| gems | loose gems: `char.inv` (`kind: 'gem'`); sockets `char.gems = [Gem\|null ×11]`, `Gem.skill` = skill id |
| engravings | learned points `char.learned[engr]` (0–80), mirrored as `char.library[engr]` = equippable nodes; equipped `char.books = [{ id, nodes, slot }]` |
| honing pity | `item.honeState` (gear.js), `item.honeLog`, `roster.stats.honing`, `roster.stats.bestStone` |
| market | `roster.market` (`listings`, `sold`, `impact`, `taken`, `accTaken`, `t`) |
| stronghold / life skills | `roster.stronghold`, `roster.life` |
| collectibles / tome | `roster.collect[type]`, `roster.claimed`, `roster.tome[region][kind]` |
| rapport / tasks / guild / shops | `roster.rapport[npc]`, `roster.tasks`, `roster.guild` (+ `roster.guildLeft`), `roster.shops` |
| mail / titles / boards | `roster.mail`, `roster.titles` + `roster.activeTitle` + `roster.records` + `roster.achieved`, `roster.boards` |
| per character | `char.daily` (`chaos`, `guardian`), `char.rest`, `char.weekly.{raid,abyss,inferno}` (self-stamped with the week), `char.events` |

---

## Hook-in for the lead
`src/game/plugins.js` already imports `systems/hooks.js`, which registers the windows, actions, services, NPC choices,
bus tracking, the 10 s tick and HUD badges (details at the end). What remains in lead-owned code:

1. **Content rewards** — in `Session.contentDone`, replace the placeholder reward block (the `if (c.kind === 'chaos') …
   else …` giving silver/stones/leapstones/gold, the `rest.chaos -= 20` and `daily.chaos++`) with:
   ```js
   import { contentRewards, moreRewards } from './systems/hooks.js';
   const R = contentRewards(this, c, r);            // rolls + grants; handles resonance, rest bonus, weekly raid gold
   loot.push(...R.loot); Object.assign(cur, R.currencies);   // results-screen rows & currency line
   // after the results screen: if (R.more) moreRewards(this, R.more);   (replaces Session.moreRewards)
   ```
   Keep XP, Sunheart points and `bus.emit('clear', …)` as they are (hooks.js tracks the clear for tasks/titles/boards —
   don't also call `tasks.track('clear')`). For `ChaosMode({ rested })` use `S.loot.restInfo(ch).chaos.rested`.
2. **Stats** — in `spawnMe` and `refreshChar`: `const ctx = S.statContext(this.account, c); const st = S.applyMods(heroStats(c, ctx), ctx.extra);`
   (stats.js consumes `ctx.rosterLevel`, `ctx.research.atk`, `ctx.cardBonus.dmgAdd`; `ctx.extra` adds card-set crit /
   crit damage / damage taken / HP / heal & shield, research HP and title mods with the stats.js conventions).
   Per-skill gems: `ctx.skills[skillId] = { dmg: 0.24, cdr: 0.16, ruin, swift }` → skill damage × (1 + dmg), cooldown ×
   (1 − cdr) in the skill runner. `ctx.extra.elemRes` / `dotMul` and `ctx.econ.xpGain` need combat/XP support.
3. **Bus events** hooks.js listens to: `kill` (needs `mine`), `clear`, `zone`, `talk`, `song`, `emote`, `gather`,
   `collect`, `hone`/`facet` (legacy only; events with `sys: true` are skipped), `sail`, `pvp`, `death`, `boss_part`.
   World owners: emit `collect { id: 'seed:goldmeadow:3' }` for any collectible id (hooks calls `collectibles.collect`),
   `gather { skill }` without `items` to let the systems roll the node, `sail { dist | arrive }`, `pvp { win, mode }`,
   `boss_part { boss, part: 'hornL' }`, `clear { content: { kind: 'inferno', floor } | { kind: 'fieldboss'|'chaosgate'|'island'|'ghostship', island? }, result }`.
4. **Account** — no change required; every system lazily initialises and migrates its state (old
   `roster.market = { listings, sold }`, `roster.stronghold`, `char.library`, premade `char.books`).
5. The lead's `honingMenu` dialog and the `shop:general` vendor are superseded by hooks.js services (`honing` opens the
   honing window, `shop:general` opens the vendor with `S.shops` stock and limits); `engr:*` actions and the
   `engravings` window now read learned points (same UI shape as before).

---

## `loot` — reward tables & rolls (`loot.js`, tables in `src/data/loot.js`)
Every reward function rolls, **grants** (unless `grant: false`) and returns:
```js
LootResult = { ok, source: 'chaos:3'|'guardian:rimewing'|'abyss:oratory:0'|'raid:gorrath:normal:1'|'island:gold'|'inferno:20'…, title,
  rows: [Row], bundle: Bundle, currencies: { silver, gold, … },  // currencies only — the results-screen line
  resonance, rested, first, gold, notes: [string], more?: { cost: { gold }, raid, gate, mode } }
```
| function | notes |
|---|---|
| `chaosReward(account, char, { tier: 1-4, cleared = true, rng, now, grant = true })` | base loot every clear; the first 2 clears per day add the **Resonance Chest** (×2 and extras rolled twice when rest ≥ 20, which is consumed). Calls `account.resets()`, increments `char.daily.chaos`. Research *Rift Cartography* +10% honing mats; `silverGain` (cards/guild) on silver. |
| `guardianReward(account, char, { guardian: 'rimewing'\|'cinderhorn'\|'sandmaw'\|'kurai', … })` | leapstone-heavy; 2 resonance hunts/day with rest bonus; *Guardian Studies* +10% leapstones. |
| `abyssReward(account, char, { raid: 'oratory', gate: 0\|1, … })` | weekly first clear of each gate: gold (250 / 400) + chest; later clears: small `repeat` table. |
| `raidReward(account, char, { raid: 'gorrath', gate: 0\|1, mode: 'normal'\|'hard', … })` | gate gold (NM 500/800, HM 750/1200) **once per gate per character per week, either difficulty** + chest + `more` offer. Repeat clears: 10k silver + a note. |
| `buyMoreRewards(account, char, { raid, gate, mode, rng })` | pays `moreCost` gold (NM 250/400, HM 400/600) once per gate per week → horns, leapstones, fusion, relic accessory / book chance. |
| `fieldDrop(account, char, { kind: 'mob'\|'elite'\|'named', rng, grant })` | per-kill drops (often empty). |
| `eventReward(account, char, { kind: 'fieldboss'\|'chaosgate'\|'island'\|'ghostship'\|'treasure', island?, focus?, rng, now })` | once per event window per character (hourly / 2-hourly). Island focus from `ISLANDS[island].focus` (`gold silver cards shards pips`). Rare collectibles: Gilded Atoll soul (2%), Heart of Tidebearer on the Ghost Ship (3%). |
| `infernoReward(account, char, { floor: 1-100, rng, now })` | every floor; boon chest every 5th; weekly milestone chest every 10th (gold 30 + 3·floor, gem pouch, card pack, horns from 20); floor ≥ 50 grants the Heart of the Ember Titan once. |
| `restInfo(char)` | `{ chaos: { rest, rested, resonanceLeft }, guardian: { … } }` |
| `weeklyInfo(account, char, now)` | `{ raid: { 'gorrath:0': 'normal'\|'hard'\|null, … }, abyss: { 'oratory:0': bool, … }, inferno: { best, milestones }, more: { 'gorrath:1': 'offer'\|'bought' } }` |
| `preview(source)` | `{ title, mins, ilvl, sections: [{ name, rows: [{ id, name, grade, icon, min, max, chance }] }] }` for `'chaos:3'`, `'guardian:kurai'`, `'abyss:oratory:1'`, `'raid:gorrath:hard:1'`, `'fieldboss'`, `'chaosgate'`, `'ghostship'`, `'treasure'`, `'island:gold'`, `'inferno:40'`, `'mob'`/`'elite'`/`'named'`. |
| `sources()` | `[{ id, title, ilvl, mins, kind }]` |
| `simulateEconomy(opts)` | re-export of `economy.js` |

## `economy` — `simulateEconomy(opts)` (`economy.js`)
Plays a dedicated player in a sandbox account (`SimAccount`, never the real save): Powerpass Starter Crate → hone Vanguard
to +12 → reforge all six pieces at the raid vendor (→ Horned +6, 1400) → Horned +6 → +8 (1420). Activities: world events
when live (waits up to 4 min for one), abyss gates once ≥ 1325, daily resonance chaos/guardian, then the best
value-per-minute of chaos / guardian / Inferno; sells tradable drops, buys missing honing mats with gold, uses boosters
when the base chance ≤ 35%, accepts & claims Wayfarer's Tasks.
```js
simulateEconomy({ runs = 24, seed = 1, strategy = 'early' (reforge at +12) | 'late' (at +15), start (ms, default Wed 2026-09-30 10:05 UTC;
                  runs rotate weekly Honing Support events), maxHours = 12, crate = true, verbose = false, debug = false })
→ { runs, strategy, target: 1420, entry: 1415, finished,
    hours: { median, p10, p90, mean, min, max }, entryHours: { median, p10, p90 }, transferHours: { median },
    per: { chaos, guardian, abyss, events, inferno, taps, fails, transfers, marketBuys, marketSales, salesGold, buyGold },
    spent: { silver, gold, leapstone, fusion, shards, horn_shard, destruction_stone, guardian_stone }, earned: { … },
    timeline: [{ min, ilvl, what }], supportEvents: [names], results?: [per-run, with stall counts] (debug), text }
```
Current tuning (48 runs): **legion ready median 2.6 h** (p10 1.8 h, p90 4.3 h), raid entry (1415) median 1.9 h, all
six pieces reforged after ~15 min (crate-funded). ~60 honing taps. Binding resources: horn shards and gold (by design);
without the crate ≈ 10 h; the 'late' (+15) path is gold-bound and much slower — reforging at +12 is the intended path.

## `honing` (`honing.js`)
| function | returns |
|---|---|
| `view(account, char, now)` | `{ iLvl, support: SupportEvent, stats: HoningStats, pieces: [Piece] }` |
| `hone(account, char, slot, { boosters: { solar_grace, solar_blessing, solar_protection }, rng, now })` | `HoneResult` |
| `chanceOf(item, boosters, now)` | `{ base, raw, event, failBonus, boost, total, energy, guaranteed, fails }` (0..1) |
| `costOf(account \| null, item, now)` | Cost of one attempt after the weekly event and research discounts |
| `expected(item, { boosters, now, account })` | `{ taps (mean), p50, p90, perTap: Cost, cost: Cost, chances: [p per tap] }` |
| `transferPreview(account, char, slot)` / `transfer(account, char, slot)` | preview `{ ok, why, msg, from, to: { set: 'horned', hone, iLvl }, cost, costRows, missing }` / `{ ok, item, old, cost }` — **Vanguard +12 or higher only**; hone becomes `round(hone / 2)` (+12 → +6 = 1400, +15 → +8 = 1420, +20 → +10); quality kept; cost weapon 10 horns / 200 gold / 4,000 sunshards, armor 6 / 100 / 2,500. |
| `upgradeQuality(account, char, slot, { rng })` | `{ ok, old, rolled, now, cost }` (never lowers quality) |
| `supportEvent(now)` | `{ id, name, desc, costMul?, rateMul?, maxHone?, energyMul?, ends }` — weekly **Honing Support** rotation: Artisan's Week (energy ×1.5), Lucky Forge (base ×1.2 on +1…+15), Silver Lining (silver −40%), Stonemason's Discount (stones −30%), Leap of Faith (leapstones & fusion −25%), Shardstorm (sunshards −50%) |
| `stats(account)` | `{ taps, wins, fails, guaranteed, luckiest, unluckiest, history: [Share ×≤20] }` |
| `TRANSFER`, `SUPPORT_EVENTS` | constants |
```js
Piece = { slot, slotName, uid, name, set, setName, grade, icon, hone, max, iLvl, nextILvl, quality,
  canHone, why: null|'story'|'max'|'materials', msg, chance: { base, failBonus, boost, event, total }, energy, guaranteed, fails, taps,
  cost, costRows, missing, boosters: { solar_grace: { have, max, add }, … }, expected: { taps, cost },
  transfer: null | { ok, can, why, msg, from, to, cost, costRows, missing } }
HoneResult = { ok, why?, msg?, need?, missing?, success, guaranteed, slot, name, from, to, hone, iLvl, chance, base,
  energy, energyGain, fails, taps, cost, costRows, share: null | Share, notes }
Share = { kind: 'hone', name, slot, set, from, to, taps, fails, chance, base, energy, guaranteed,
  luck: 0..1 (share of Shardbearers who needed MORE taps), label: 'Lucky'|'Average'|'Unlucky'|'Artisan', spent, t, char: { name, cls } }
```

## `engravings` (`engravings.js`)
Books add points (Rare 5, Epic 10, Legendary 20) to `char.learned[engr]` (max 80); each 20 points allow +3 equipped
nodes (max +12) in one of 2 slots. Stones: `gear.facet` rules (75% start, −10% on success, +10% on failure, 25–75%).
| function | returns |
|---|---|
| `view(account, char)` | `{ slots: [{ slot, id, name, nodes, max } \| null ×2], learned: [{ id, name, points, max: 80, equipMax }], books: [{ uid, engr, name, grade, points }] (unread), summary: Summary, stones: [StoneView] }` |
| `readBook(account, char, uid)` | `{ ok, engr, points, total, equipMax }` |
| `equip(account, char, slot, engr, nodes?)` / `unequip(account, char, slot)` | `{ ok, slot, id, nodes }` / `{ ok }` |
| `learned(char)` / `equipMax(char, engr)` | learned map (migrates `char.books`/`char.library`) / 0–12 |
| `summary(char)` | `Summary` |
| `stoneView(stone, equipped?)` / `facet(account, char, stoneUid, line, { rng })` | `StoneView` / `{ ok, success, chance, next, done, cost: { silver }, stone: StoneView, share: StoneShare\|null, notes }` (silver per tap: Legendary 1,200 · Relic 1,680 · Ancient 2,200) |
| `bestStone(account)` | best finished `StoneShare` |
```js
Summary = { list: [{ id, name, desc, nodes, level, negative, cls, sources: [{ kind: 'book'|'accessory'|'stone'|'class', name, v }] }],
  threes, fiveByThree, label: '5x3'|'3 3 2 1'…, negatives: [{ id, name, level }] }
StoneView = { uid, name, grade, facets, chance, done, equipped, lines: [{ id, name, negative, slots: [1|-1|0], success, fail, left, nodes, level }] ×3,
  score: [a, b, neg], label: '97'|'10/7'…, is97, cost: { silver } }
StoneShare = { kind: 'stone', label, score, lines: [name], grade, is97, t, char }
```

## `cards` (`cards.js`, catalog `src/data/cards.js`)
37 cards (grades 2–5) · sets **Tides of Light** (6: light res, damage +4/7/10/15% at 0/12/18/30 awakening), **Pip Parade**
(6: silver & xp), **Horns of the Legion** (5: crit +3%, crit damage up to +25%), **Storm & Ember** (6: elemental res,
DoT +10/20%, damage +6% at 30), **Wardens of Brighthold** (5: HP, heal/shield, damage taken). In a set chain only the best
reached bonus applies. Awakening n→n+1 costs 1/2/3/4/5 duplicates + grade × 800 × (n+1) silver.
| function | returns |
|---|---|
| `view(account)` | `{ deck, deckAwaken, collection: [{ id, name, grade, kind, sets, owned, dupes, awaken, maxAwaken, canAwaken, awakenCost, inDeck, source, flavor, icon }], sets: [{ id, name, cards: [{ id, name, owned, inDeck, awaken }], inDeck, awk, bonuses: [{ n, awk, desc, active, reached }] }], mods, active, packs: [{ id, name, count }], choice: null \| { pack, options: [{ id, name, grade }] }, owned, total }` |
| `openPack(account, packId = 'card_pack', { rng })` | `{ ok, pack, cards: [{ id, name, grade, isNew, dupes, awaken }], choose: null \| [id ×3] }` (packs: `card_pack`, `card_pack_epic`, `card_pack_pip`, `card_pack_legend` = selector) |
| `choose(account, index)` / `addCard(account, id, n)` | resolve the selector / add directly |
| `awaken(account, id)` / `setDeck(account, slot, id\|null)` / `autoDeck(account)` | `{ ok, id, awaken, cost }` / `{ ok, deck }` / `{ ok, deck, set }` |
| `mods(account)` (= `cardMods`) | `{ mods: { dmgAdd, crit, critDmg, dmgTaken, hpMaxMul, healMul, shieldMul, silverGain, xpGain, elemRes, dotMul, seedSense }, active: [{ set, name, desc }] }` |
| `cardIcon(id)` | portrait icon id |

## `gems` (`gems.js`)
| function | returns |
|---|---|
| `view(account, char)` | `{ sockets: [{ idx, gem, skill, skillName, type, level, value, desc }] ×11, bag: [Item], fusable: [{ type, level, count, cost, can }], skills: [{ id, name, ruin, swift }], mods }` |
| `socket(account, char, gemUid, idx, skillId)` / `unsocket(account, char, idx)` / `assign(account, char, idx, skillId)` | `{ ok, replaced }` / `{ ok, gem }` / `{ ok }` — one Ruinstone + one Swiftstone per skill |
| `fuse(account, char, type, level, { count })` / `fuseUids(account, char, [uid ×3])` | `{ ok, made: [Item], cost }` — 3 → 1, always succeeds, silver `level × 2,000` |
| `openPouch(account, char, 'gem_pouch'\|'gem_pouch_hi', { rng })` | `{ ok, gem }` (Lv.1–3 / Lv.3–5) |
| `mods(char)` (= `gemMods`) | `{ [skillId]: { dmg, cdr, ruin, swift } }` (Ruinstone 3…40%, Swiftstone 2…20%) |
| `skillList(char)`, `sockets(char)`, `fuseCost(level)` | helpers |

## `market` (`market.js`)
Order books (gold per **bundle**; `unit` = 1 if the item is worth ≥ 5 g, 10 if ≥ 0.5 g, 100 if ≥ 0.05 g, else 1,000;
prices below 100 g have 0.1 g steps) for every tradable ITEMS id, cooking, `book:<engr>` and `gem:<type>:<lv>`; unique
accessory listings. Reference prices drift with deterministic noise over real time (+ a weekly post-reset demand bump)
and move with your trades (decaying over ~6 h); SimPlayer listings (named with `simName`) relist every 10 minutes.
| function | returns |
|---|---|
| `categories()` | `[{ id: 'honing'\|'battle'\|'trade'\|'food'\|'book'\|'gem'\|'accessory', name, items: [id] }]` |
| `browse(account, { cat, q, now, char })` | `[{ id, name, grade, icon, cat, unit, price (cheapest ask), ref, change24, volume24, have }]` |
| `book(account, id, now, char)` | `{ id, name, grade, icon, cat, unit, ref, price, change24, have, asks: [{ key, seller, price, qty, you }], history (24 h), suggest }` |
| `history(id, { now, hours = 168, step = 1 h })` / `price(id, now)` / `refPrice(account, id, now)` | `[{ t, price, vol }]` / reference price (pure) / including your trades |
| `quote(account, id, qty, now)` / `buy(account, char, id, qty, { now, maxPrice })` | `{ ok, qty, cost, avg, fills }` / `{ ok, bought, spent, avg, fills, rows }` (cheapest first; gold) |
| `list(account, char, id, qty, price, { now, uid })` | `{ ok, listing }` — stackables in bundles; books/gems/accessories by `uid`. **5% fee** on sale (−1% with *Market Contacts*), **listings expire after 3 days** |
| `listings(account, now)` / `cancel(account, char, id, now)` | `[Listing]` / `{ ok, returned: [Row] }` |
| `tick(account, now)` | `[{ kind: 'sold'\|'expired', text, gold?, id }]` — proceeds and expired goods arrive **by mail** |
| `accessories(account, { slot, engr, now })` / `buyAccessory(account, char, key, now)` / `accessoryPrice(item)` | `[{ key, seller, price, item, you }]` / `{ ok, item, spent }` / fair price |
| `exchange(now, { hours })` / `buyCrystals(account, hundreds, now)` / `sellCrystals(account, hundreds, now)` | `{ buy, sell, history: [{ t, buy }] }` (gold per 100 crystals) / `{ ok, crystals, gold }` |
| `fee(account)`, `ITEMS_MARKET`, `FEE`, `EXPIRY` | |
```js
Listing = { id, itemId, name, grade, icon, unit, qty (bundles left), sold, price (per bundle), t, expires, left, status: 'active'|'sold'|'expired'|'cancelled', proceeds, item? }
```

## `stronghold` (`stronghold.js`, data `src/data/stronghold.js`)
Buildings (Manor caps the others; level L needs stronghold level (L−1)·3), 13 research projects (tiers by Research Hall
level 1/3/6), 19 workshop recipes, crew & 8 dispatch missions (10 min – 4 h, success = 25% + 75% × crew power / mission
power, role match ×1.25), garden & pet ranch yields, action energy (5,000, +180/h). All real time.
| function | returns |
|---|---|
| `view(account, now)` | `StrongholdView` |
| `buildingInfo(account, id, now)` / `upgradeBuilding(account, id, now)` | `{ id, name, desc, level, max, effect, next }` / `{ ok, building, level, levelUps }` |
| `researchList(account, now)` / `startResearch(account, id, now)` / `perks(account)` | rows / `{ ok, research, t1 }` / summed perks `{ chaosLoot, honeSilver, craftSpeedBattle, lifeEnergy, dispatchSlots, atk, hp, guardianLoot, marketFee, dispatchChance, foodYield, fusionCost, craftSlots }` |
| `recipes(account, now)` / `recipeQuote(account, recipe, qty, now)` / `craft(account, recipe, qty, now)` / `cancelCraft(account, jobId, now)` / `collectCrafts(account, char, now)` | `[Quote & { can }]` / `{ recipe, name, cat, qty, cost, costRows, energy, mins, out, outRows, locked }` / `{ ok, job }` / `{ ok, refunded }` / `{ ok, rows, jobs }` |
| `missions(account, now)` / `dispatchChance(account, mission, crewIds, now)` / `dispatch(account, mission, crewIds, now)` / `collectDispatch(account, char, jobId, { rng, now })` / `recruitCrew(account, { pay, rng, now })` | … / 0.1–0.98 / `{ ok, job }` / `{ ok, success, rows, mission, levelUps }` / `{ ok, crew }` |
| `collectGarden(account, now)` / `stationPet(account, petId, now)` / `collectRanch(account, { rng, now })` | `{ ok, rows }` |
| `rush(account, 'research'\|'craft'\|'dispatch', jobId, now)` | `{ ok, cost: { crystals } }` (1 per started 10 min) |
| `energy(account, now)` / `addXp(account, n, now)` / `tick(account, now)` / `craftSlots` / `dispatchSlots` / `crewCap` | `{ now, max, perHour }` / levels gained / `[{ kind: 'research', id, name, text }]` |
```js
StrongholdView = { level, xp, xpNext, max, energy, energyMax,
  buildings: [{ id, name, desc, level, max, effect: { text, … } | null, next: null | { level, cost, costRows, reqStronghold, can, why, effect } }],
  research: [{ id, name, tier, desc, perk, cost, costRows, energy, mins, done, active, locked, available, left }],
  researching: null | { id, name, t0, t1, left, pct }, perks,
  crafts: [{ id, recipe, name, qty, t0, t1, left, pct, done, out: [Row] }], craftSlots,
  dispatch: [{ id, mission, name, crew, chance, t0, t1, left, done }], dispatchSlots,
  crew: [{ id, name, role, power, xp, busy }], crewCap, garden: { level, ready: [Row], since }, ranch: { level, pets, slots }, notes }
```

## `lifeskills` (`lifeskills.js`, data `src/data/lifeskills.js`)
`forage log mine hunt fish dig`, levels 1–30 (`xpToNext(lv) = 80·lv^1.55 + 120`), Life Energy 10,000 (+300/h real time;
*Restful Breeze* +5%), drops unlock at levels 1/5/10 (rare: Sunbloom, Elder Heartwood, Starsteel, Pristine Pelt, Sea
Pearl, Relic Idol; Glimmer Ore = `gem_ore`), tools tier 1–4 (yield +0/10/20/35%, rare ×1/1.25/1.5/2, 500 uses).
| function | returns |
|---|---|
| `view(account, now)` | `{ energy, energyMax, perHour, skills: [{ id, name, verb, level, xp, xpNext, energy, anim, tool: { tier, name, dur, max }, drops: [{ id, name, grade, icon, rare, level, unlocked }] }] }` |
| `gather(account, char, skill, { rng, now })` | `{ ok, rows, xp, level, levelUp, energy, rare }` |
| `fishCast(account, { rng, now })` / `fishReel(account, char, cast, reactAt, { rng, now })` | `{ ok, cast: { id, biteAt (s), window (s), perfect (s), rare, energy } }` / `{ ok, result: 'perfect'\|'good'\|'early'\|'late', rows, xp, levelUp }` — pull in `[biteAt, biteAt + window]`; the first `perfect` seconds = ×1.5 yield, rare ×2 |
| `digStart(account, { rng, now })` / `digStop(account, char, dig, pos 0..1, { rng, now })` | `{ ok, dig: { id, speed (cycles/s), zone: [a, b], perfect: [c, d], energy } }` / `{ ok, result: 'perfect'\|'good'\|'poor', rows, xp, levelUp }` |
| `eat(account, foodId, now)` / `buyTool(account, skill, tier, now)` / `energy(account, now)` | `{ ok, energy }` (food1 500, food2 700, food3 1,000, food4 1,500, life_tonic 1,000) / `{ ok, tool }` / `{ now, max, perHour }` |

## `collectibles` (`collectibles.js`, data `src/data/collectibles.js`)
120 Pip Seeds `seed:<zone>:<n>` (solhaven 16, goldmeadow 24, thornwood 22, ashen_ridge 18, pipsprout 28, islands 12),
8 Island Souls `soul:<island>` (the Glass Sea islands from `src/data/islands.js`: Coinflip Cay, Songstone Isle, Powderkeg Cove,
Moonveil Atoll, Stormcrown Spire, Hushwater Lagoon, Shellback Isle, Drownbell Shoal; Adventure Islands are `ADVENTURE_LIST`), 6 Giant's Hearts,
10 Masterpieces, 8 Omnium Stars, 10 Sea Bounties, 6 World Tree Leaves, 12 Vistas — each `{ id, name, zone, hint, source }`.
Reward tiers per type (skill point potions, card packs, roster xp, pets, mounts, titles; Sunbloom Pip Wagon at 120 seeds).
| function | returns |
|---|---|
| `view(account)` | `{ types: [TypeView], tome: [TomeRegion], seedsByZone: { zone: { name, have, total } } }` |
| `collect(account, char, type, id)` | `{ ok, isNew, type, id, name, have, total, ready: [n], zoneDone, notes }` |
| `claim(account, char, type, n)` | `{ ok, rows }` |
| `tomeRecord(account, region, 'bosses'\|'npcs'\|'lore'\|'cuisine', id, char?)` / `tomePct(account, region)` / `tomeClaim(account, char, region, 0.3\|0.6\|0.9\|1)` | `{ ok, isNew, pct }` / 0..1 / `{ ok, rows }` (seeds & vistas count automatically) |
| `find(id)` / `zoneList(zone)` | `{ …, type }` / `[{ id, type, name, hint }]` everything placeable in a zone (for world owners) |
```js
TypeView = { id, name, icon, have, total, pct, tiers: [{ n, rows, claimed, ready }], next: null | { n, rows }, items: [{ id, name, zone, hint, source, found }] }
TomeRegion = { id, name, pct, sections: [{ kind: 'bosses'|'npcs'|'seeds'|'vistas'|'lore'|'cuisine', name, have, total, entries: [{ id, name, found, hint }] }], rewards: [{ pct, rows, claimed, ready }] }
```
Regions: `solhaven goldmeadow thornwood ashen_ridge pipsprout glass_sea`; Solhaven's NPC entries use `data/npcs.js` ids.

## `rapport` (`rapport.js`, data `src/data/rapport.js`)
`brannoc seraphine mirelle wren maren tumbleroot` (Solhaven; = `data/npcs.js` `rapport` ids), `bramblebeard`
(Pipsprout), `morwenna` (Drownbell Shoal). Stages Neutral 0 → Amicable 1,000 → Friendly 3,000 → Trusted 6,000 → Honored
10,000 → Devoted 16,000. 6 songs + 6 emotes per NPC per day; song 40 / emote 15 / gifts 60–600 points × preference
(love 2, like 1.5, neutral 1, dislike 0.5). Songs: `homeward tides rest valor sunrise` (same ids as features.js).
| function | returns |
|---|---|
| `view(account, now)` / `one(account, npc, now)` | `[RapportView]` / `RapportView` |
| `song(account, char, npc, songId, now)` / `emote(account, char, npc, emoteId, now)` / `gift(account, char, npc, giftId, n, now)` | `{ ok, gain, pts, stage, stageName, stageUp, line, left, notes }` |
| `claim(account, char, npc, stage 1..5)` | `{ ok, rows }` (cards, songs, emotes, masterpieces/hearts/stars/leaves, titles, mounts, pets) |
```js
RapportView = { id, name, title, zone, personality, icon: 'npc:<id>', pts, stage: { idx, name, min, next }, pct,
  today: { songs, songsMax: 6, emotes, emotesMax: 6 }, likes: { songs, emotes, gifts: { gift1..4: 'love'|'like'|'neutral'|'dislike' } },
  rewards: [{ stage, name, rows, claimed, ready }], line }
```

## `tasks` — Wayfarer's Tasks, reputation, the tracking hub, event calendar (`tasks.js`, data `src/data/tasks.js`)
Daily: 6 of 21 templates offered (deterministic per roster & day), accept 3. Weekly: 5 of 9 offered, accept 3. Rewards +
Wayfarer reputation (100 / 400 per task; levels 1–10 with rewards; level 10 = Wayfarer's Sunstag + title).
| function | returns |
|---|---|
| `view(account, now)` | `{ day, week, daily: { offered: [Task], accepted, max, done }, weekly: {…}, rep: { level, pts, next, max, rewards: [{ level, rows, claimed, ready }] } }` |
| `accept` / `abandon(account, id, now)` / `claim(account, char, id, now)` / `claimRep(account, char, level)` | `{ ok }` / `{ ok, rows, rep, notes }` / `{ ok, rows }` |
| `track(account, char, event, data)` | `[Notification]` — tasks → titles/achievements → guild missions → leaderboards. `data.now` overrides the clock. |
| `calendar(now, { hours = 6 })` / `live(now)` / `eventWindow(kind, now)` / `compass(account, now)` | `[CalEvent]` / live ones / the live-or-next window / `{ now, live, next (≤ 8), resets: { daily, weekly } }` |
| `state(account, now)` | normalised state (rolls offers) |
```js
Task = { id, tpl, name, desc, event, need, n, done, claimed, accepted, rows, rep }
CalEvent = { id: '<kind>:<start>', kind: 'fieldboss'|'chaosgate'|'island'|'ghostship', name, where, start, end, live, left (ms), rows, island?: { id, name, focus } }
```
Schedule (UTC): Field Boss *Old Thunderhoof* every hour at :00 (10 min, zone rotates), Chaos Gate at :30 (10 min),
Adventure Island every 2 h at :00 (15 min; island rotates among the five focus islands), Ghost Ship Thu & Sun at 12, 16,
20, 23 h (20 min). Events systems emit themselves: `hone transfer quality facet read card awaken fuse buy sell sold craft
dispatch research build gather collect tome song emote gift rapport donate shop taskDone`.

## `guild` (`guild.js`, data `src/data/guilds.js`)
| function | returns |
|---|---|
| `list(account, now)` | `[{ id, name, tag, level, members, max, motto, focus, leader, recruiting, joined }]` (12 AI guilds + your own) |
| `view(account, now)` | `null \| { id, name, tag, level, xp, xpNext, members, max, motto, rank, own, bloodstones, contribution, donations: { silver: { cost, bloodstones, xp, done }, gold: [{ tier, cost, bloodstones, xp, done }] }, research: [{ id, name, desc, level, max, perk, active }], missions: [{ id, name, desc, progress, need, done, claimed, rows, mine }], roster: [{ name, cls, ilvl, rank, online, contribution, you }] }` |
| `join(account, id, now)` / `leave(account, now)` / `create(account, { name, motto }, now)` | `{ ok, guild }` (1-day re-join cooldown; founding costs 20,000 silver) |
| `donate(account, char, 'silver'\|'gold', tier, now)` | `{ ok, bloodstones, xp }` (silver 10k → 40; gold 100/500/1,000 → 100/400/700; one of each per day) |
| `claimMission(account, char, id, now)` / `setResearch(account, id)` / `perks(account)` | `{ ok, rows }` / `{ ok }` / `{ xpGain, silverGain, lifeXp, shopDiscount, restGain }` |

## `shops` (`shops.js`, data `src/data/shops.js`)
`general` (silver), `raid` (horns: **Horned Tyrant reforging** entries `transfer_<slot>`, Relic Accessory Chest, solar
mats, card), `pvp`, `guild` (bloodstones, needs a guild; guild research discount), `harbor` (pirate coins), `island`
(Glass Sea Tokens), `card` (gold), `crystal` (crystals: outfits, pets, mount, bound honing bundles).
| function | returns |
|---|---|
| `list()` / `view(account, char, shopId, now)` | `[{ id, name, npc, currency }]` / `{ id, name, npc, desc, currency, currencies, items: [ShopItem] }` |
| `buy(account, char, shopId, key, n = 1, now)` | `{ ok, rows, spent, left }` |
```js
ShopItem = { key, id, name, grade, icon, kind, desc, qty, price: { currency, amount }, cost?, costRows? (reforge),
  limit: null | { period: 'daily'|'weekly'|'total', max, left }, can, why, req?, bound? }
```

## `mail` (`mail.js`)
| function | returns |
|---|---|
| `inbox(account, now)` / `read(account, id)` | `{ unread, list: [Mail] }` (expired pruned) / `{ ok, mail }` |
| `claim(account, char, id)` / `claimAll(account, char)` / `remove(account, id)` | `{ ok, rows }` / `{ ok }` (`why: 'attachments'` if unclaimed) |
| `send(account, { from, subject, body, kind, bundle, days = 30, t })` | `Mail` |
| `welcome(account, char, t)` | `[Mail]` — once per roster: Brannoc's welcome + a compensation letter; once per Powerpass character: the **Powerpass Starter Crate** (`POWERPASS_CRATE`: 1.05M silver, 4,500 gold, 40k sunshards, 6k guardian / 3k destruction stones, 260 leapstones, 150 fusion, 40 Horns of the Tyrant, solar boosters, card packs, gem pouches) |
| `compensation(account, { reason, bundle, t })` | `Mail` ("Please accept our sincere apologies for the unscheduled maintenance of the Glass Sea…") |
```js
Mail = { id, from, subject, body, kind: 'system'|'market'|'event'|'guild'|'gift'|'compensation'|'rapport', t, read, claimed, expires, left, attachments: [Row], hasItems }
```

## `titles` (`titles.js`, data `src/data/titles.js`)
41 titles, 30 achievements (first guardian, +15/+20 hone, Artisan, the Lucky, 97 stone, all seeds in a zone, 100 PvP
wins, Legion NM/HM, horns, Inferno 50/100, 100 chaos, 100 fish, souls, tome, Devoted, market gold, donations, sailing…).
| function | returns |
|---|---|
| `view(account)` | `{ active, titles: [{ id, name, desc, color, owned, active, mods }], achievements: [{ id, name, desc, cat, progress, need, done, title, rows }] }` |
| `setActive(account, id\|null)` / `grantTitle(account, id)` / `mods(account)` | `{ ok }` / `{ ok, isNew }` / active title's stat mods |
| `track(account, char, event, data)` | called by `tasks.track` |

## `boards` — local leaderboards (`boards.js`)
Boards `legion_nm`, `legion_hm` (fastest clear, weekly), `guardian` (today's guardian, daily), `inferno` (deepest floor),
`pvp` (rating), `honing_luck` (lowest-chance first-tap success), `best_stone`, `seeds` — 30 deterministic SimPlayer
entries per period + your best (auto-submitted from tracked events).
| function | returns |
|---|---|
| `list()` / `view(account, id, now)` | `[{ id, name, desc, unit, better }]` / `{ id, name, desc, unit, week, period, entries: [{ rank, name, cls, guild, value, display, you, sim }], you: { rank, value, display } \| null, guardian? }` |
| `submit(account, char, id, value, now)` / `display(unit, value)` / `todaysGuardian(now)` | `{ ok, improved, best, rank }` |

## `mods` (`mods.js`)
| function | returns |
|---|---|
| `statContext(account, char)` | `{ rosterLevel, research: { atk }, cardBonus: { dmgAdd }, extra: { crit, critDmg, dmgTaken, hpMaxMul, healMul, shieldMul, elemRes, dotMul, … }, skills: { [skillId]: { dmg, cdr, ruin, swift } }, econ }` |
| `applyMods(stats, mods)` | stats with mods applied (`hpMaxMul` scales hpMax, `*Mul` multiplies, others add; recomputes `power`) |
| `econMods(account)` | `{ silverGain, xpGain, chaosLoot, guardianLoot, marketFee, lifeEnergy, lifeXp, shopDiscount, restGain, seedSense }` |

## `common` & `rolls` (helpers other owners may use)
`rngOf(r)`, `seeded(rng, fn)` (Math.random → rng while fn runs), `hash01(...)`, `itemInfo(id)` → `{ id, name, grade, icon,
kind, desc, value, tradable, bound }`, `iconFor(id)`, `bundleRows(bundle)`, `grantBundle(account, char, bundle)`,
`merge/scale/addTo`, `missing/canPay/pay/discount/costRows`, `CURRENCIES`, `emit(account, char, event, data)` /
`onTrack(fn)` (the event hub), `rolls.rollTable(table, rng, { mul, mulBy, times, into })`, `rolls.generate('acc:5'|
'stone:6'|'bracelet:5'|'book:4'|'gem:2-5'|'card:<id>'|'card@4')`, `rolls.expectTable`, `rolls.previewTable`.

## Top level (`index.js`)
`tick(account, char, now)` → `[Notification]` (market sales/expiries, stronghold research, life energy, daily task board,
events going live — hooks.js calls it every 10 s) · `track` · `statContext` · `applyMods` · `simulateEconomy` · namespaces.

---

## `hooks.js` — session glue (imported by `src/game/plugins.js`)
Registers with `src/game/registry.js` (top level only registers; work happens in `init`/handlers):

**Windows** (data in the exact shapes the `src/ui/windows/*` classes document) and **actions**:
| window | data from | actions handled |
|---|---|---|
| `honing` | `honing.view` → `{ items, item, iLvlFrom, iLvlTo, gains, chance: { base, bonus, boosters, total }, maxBonus, energy, mats, cost, currencies, boosters, maxed, result, resultKey, support, expected, transfer, stats }` | `hone:select { uid }` · `hone:tap { uid, boosters }` · `hone:booster` |
| `stone` | ability stones (bag + equipped; facets as 1 / 0 / null) + `view`, `best` | `stone:select { uid }` · `stone:facet { uid, line }` · `stone:share { uid }` (sets `session.shareCard`) |
| `cards` | `{ deck, cards (owned), sets: [{ id, name, cards, bonuses: [{ need, awaken, text }] }], packs, choice, active }` | `cards:equip { id, slot }` · `cards:unequip { slot }` · `cards:awaken { id }` · `cards:open { pack }` · `cards:auto` |
| `gems` | `{ sockets: [{ gem, skill: { id, name, icon } }], gems, skills, fuseCost, fuseCosts, currencies, fusable, mods }` | `gems:socket { uid, slot }` · `gems:unsocket { slot }` · `gems:target { slot, skill }` · `gems:fuse { uids }` |
| `market` | `{ tab, cats (+ subs for gems/accessories), cat, sub, q, results: [{ id, name, icon, grade, kind, bundle, lowest, avg, history, trend, stock?, recent?, asks? }], selected, sellable, listings: [{ id, item, price, qty, sold, left (s) }], fee, exchange: { rate, sell, history }, currencies }` | `market:search { q, cat, sub }` · `market:select { id }` · `market:buy { id, qty }` (`acc#<key>` = accessory) · `market:list { uid ('mat:<id>' for stackables), price, qty }` · `market:cancel { id }` · `market:exchange { dir, amount }` |
| `stronghold` | `{ level, xp, xpMax, energy, buildings, research (state locked/available/active/done), craft: { slots, queue, recipes }, dispatch: { slots, crew, missions, active }, garden, ranch, perks }` (times in seconds) | `sh:upgrade` · `sh:research` · `sh:craft { id, qty }` · `sh:cancel` · `sh:collect` · `sh:dispatch { id }` (auto-picks the strongest free crew) · `sh:claim { id }` · `sh:garden` · `sh:ranch` · `sh:recruit { pay }` · `sh:rush { kind, id }` |
| `compass` | `{ events: [{ id: kind, name, kind: 'field_boss'\|'chaos_gate'\|'adventure_island'\|'ghost_ship', where, times (local minutes), dur, active, left, next, rewards }], tracked }` | `compass:track { id, on }` · `compass:go { id }` |
| `tome` / `collectibles` | `{ tab, selected, regions: [{ id, name, pct (0–100), cats, rewards: [{ pct (0–100), name, icon, grade, count, claimed }] }], collectibles: [{ id, name, icon, have, total, tiers: [{ n, …row, claimed }], items }], seedsByZone }` | `tome:region { id }` · `tome:claim { region, pct }` · `collect:claim { id: type, n }` |
| `rapport` | `{ selected, npcs: [{ id, name, title, icon, stage, points, max, daily, songs: [{ id, name, locked }], emotes, gifts: [Item uid 'mat:giftN'], rewards, likes, line }] }` | `rapport:select` · `rapport:song { npc, id }` · `rapport:emote { npc, id }` · `rapport:gift { npc, uid }` · `rapport:claim { npc, stage }` |
| `mail` | `{ mails: [{ id, from, subject, body, date, read, kind, attachments: [Item], claimed, expires }], unread }` | `mail:open` · `mail:claim` · `mail:claimAll` · `mail:delete` |
| `guild` | `{ guild: null \| { …, members, research, missions: [{ id, name, n, need, reward }], donations }, browse }` | `guild:donate { kind, tier? }` · `guild:join` · `guild:create { name, tag }` · `guild:leave` · `guild:research` · `guild:mission` |
| `leaderboards` | `{ board, boards, rows: [{ rank, name, cls, value (display), sub, you }], you, note }` | `lb:board { board }` · `title:leaderboards` (opens it from the title screen) |
| `engravings` | `{ active: [{ id, nodes, neg, sources }], equipped, books (learned, nodes = equip max), maxBook: 12, summary, learned, unread }` | `engr:equip { slot, id }` · `engr:unequip { slot }` |
| `vendor` | systems shops as `{ name, title, npc, shop, items: [{ id: key, item, price: { cur, amount }, limit, stock }], currencies }` | `vendor:buy { id, qty }` (only while a systems shop is open) · `shop:open { id }` |

**Services** (NPC `action`): `honing`, `market`, `cards`, `gems`, `mail`, `guild` (open their windows), `tasks`
(Wayfarer's Board dialog: accept / claim / reputation rewards), `songs` (Lyra teaches `tides`/`rest`/`valor` for silver),
`shop:general`, `rapport`. **NPC choices**: blacksmith → raid vendor (Horned Tyrant reforging) & quality upgrade; cards →
card shop & stone faceting; pvp / guild / harbor (+ island tokens) shops; bank → crystal shop; any rapport NPC's
"Spend time together" opens the rapport window on them.

**Inventory use** (`inv:use`, falls through to the session when not handled): card packs (selector → choice dialog),
gem pouches, food & Life Energy Tonic, Skill Point Potion (+1 skill point), Relic Accessory Chest, Adventurer's Chest,
Treasure Map (dig: treasure rewards), Crew Contract, engraving books (read).

**Bus → systems**: see Hook-in step 3. Open-world kills (`mode.kind` city/field/island/stronghold) also roll
`loot.fieldDrop`. First `zone` event per character sends the welcome letters (+ Powerpass crate).
**HUD**: `badges.mail` = unread letters; accepted daily/weekly tasks appear in `quests` (kind `daily`/`weekly`).
**Exports**: `contentRewards(session, c, r)`, `moreRewards(session, offer)`, and every window data builder
(`honingData`, `marketData`, …) for tests and other owners.
