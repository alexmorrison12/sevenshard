# SEVENSHARD systems — progression & economy layer (`src/game/systems/`)

Pure logic (no DOM, no three.js): plain functions that operate on an `Account` (src/game/account.js) and a character
record, and return plain result objects the UI renders. Deterministic when given an RNG. Everything persists inside
`account.data` (roster-wide state under `account.roster.*`, per-character state on the `char` object) and is saved
through `account.save()`.

```js
import * as S from './game/systems/index.js';
S.loot.chaosReward(account, char, { tier: 3 });          // namespaces: loot honing cards gems engravings market
S.market.buy(account, char, 'leapstone', 5);             //   stronghold lifeskills collectibles rapport tasks guild
S.tasks.track(account, char, 'kill', { mob: 'imp' });    //   shops mail titles mods boards partyfinder economy
const ctx = S.mods.statContext(account, char);           //   gear stats rolls common (+ top-level track, statContext)
```

## Conventions

| | |
|---|---|
| `account` | an `Account` instance. Systems only use `account.roster`, `account.data`, `count/has/take/give/addItem/addXp/addRosterXp/save`. |
| `char` | a character record from `account.chars` (`char.equip`, `char.inv`, `char.books`, `char.gems`, `char.daily`, `char.weekly`, `char.rest`…). Pass `null` where a function says the character is optional. |
| `now` | optional last argument / option (ms since epoch). Defaults to `Date.now()`. Daily reset 10:00 UTC, weekly Wednesday 10:00 UTC (`src/core/util.js`). |
| `rng` | optional: an `RNG` from `src/core/noise.js`, a `() => [0,1)` function, or a numeric/string seed. Omitted → `Math.random`. |
| results | every action returns `{ ok: true, … }` or `{ ok: false, why, msg, … }` — `why` is a short code (`'materials'`, `'locked'`, `'limit'`, …), `msg` a player-facing sentence. |

### Shared shapes
```js
Row    = { id, name, count, grade: 0..7, icon, kind, uid?, item?, unlock? }
         // one line of a reward/cost list: currencies ('silver', 'gold', 'crystals', 'royal', 'shards', 'pirate',
         // 'bloodstone', 'pvp', 'tokens'), ITEMS ids, unique items (item = the full Item), cards (id 'card:<id>'),
         // unlocks (id 'titles:<id>' | 'mounts:<id>' | 'pets:<id>' | 'emotes:<id>' | 'songs:<id>', unlock: 'Title'…)
Bundle = { <currency|ITEMS id>: count, items?: [Item], cards?: { cardId: n }, xp?, rosterXp?, skillPts?,
           titles?: [id], mounts?: [id], pets?: [id], emotes?: [id], songs?: [id], unlocks?: [id] }
Item   = ARCHITECTURE.md Item (weapon/armor/accessory/stone/bracelet/gem/book… with uid)
Cost   = { <currency|ITEMS id>: count }
```
Icons follow the `src/ui/icons` catalogue (`item:<id>`, `currency:<id>`, `item:gem:<type>:<lv>`, `item:book:<engr>`,
`npc:<id>`, `boss:<id>`); new ids that have no dedicated art: cards use `card:<id>` (generic art until the icons owner
paints them).

### Persistence map (what lives where)
| state | path |
|---|---|
| materials / currencies | `roster.mats`, `roster.wallet` (Account helpers) |
| cards, deck, pending selector | `roster.cards[id] = { n: duplicates, awaken }`, `roster.deck = [id\|null ×6]`, `roster.cardChoice` |
| gems | loose gems are `char.inv` items (`kind: 'gem'`); sockets `char.gems = [Gem\|null ×11]` (`Gem.skill` = skill id) |
| engravings | learned points `char.learned[engr]`; equipped `char.books = [{ id, nodes }]` (read by data/engravings.js) |
| honing pity & stats | `item.honeState` (gear.js), `item.honeLog`, `roster.stats.honing` |
| market | `roster.market` (`listings`, `sold`, `impact`, `taken`, `t`) |
| stronghold | `roster.stronghold` |
| life skills | `roster.life` |
| collectibles / tome | `roster.collect`, `roster.claimed`, `roster.tome` |
| rapport | `roster.rapport[npcId]` |
| tasks & reputation | `roster.tasks` |
| guild | `roster.guild` |
| shops limits | `roster.shops` |
| mail | `roster.mail` |
| titles & achievements | `roster.titles`, `roster.activeTitle`, `roster.records`, `roster.achieved` |
| boards | `roster.boards` |
| per-character dailies | `char.daily` (`chaos`, `guardian` counts), `char.rest`, `char.weekly` (raid gold, abyss, inferno) |

---

## Hook-in for the lead

1. **Stats.** `const ctx = S.mods.statContext(account, char)`, then `let st = heroStats(char, ctx)` and
   `st = S.mods.applyMods(st, ctx.extra)` (stats.js already consumes `ctx.rosterLevel`, `ctx.research.atk` and
   `ctx.cardBonus.dmgAdd`; `ctx.extra` carries the rest — card set crit / crit damage / damage taken / HP / heal &
   shield, research HP, title and guild mods — using the stats.js conventions: keys ending in `Mul` multiply
   `(1 + v)`, `hpMaxMul` scales `hpMax`, anything else is added). Per-skill gem mods: `ctx.skills[skillId] =
   { dmg: 0.24, cdr: 0.16 }` → multiply that skill's damage by `1 + dmg` and its cooldown by `1 − cdr` in the skill
   runner. Economy-side mods (`silverGain`, `xpGain`, `elemRes`, `dotMul`, `seedSense`) are in `ctx.econ` /
   `ctx.extra` (`elemRes`, `dotMul` need combat support; loot already applies `silverGain`; apply `xpGain` to
   combat XP grants). Re-run after any change to deck, gems, research, titles or guild.
2. **World events → `S.tasks.track(account, char, event, data)`** (returns notifications `[{ kind, text, … }]` to toast):
   | event | data | when |
   |---|---|---|
   | `kill` | `{ mob, family: 'demon'\|'beast'\|'undead'\|'construct'\|'pip'…, zone, elite?, boss?, count? }` | every kill |
   | `clear` | `{ content: 'chaos'\|'guardian'\|'abyss'\|'raid'\|'inferno'\|'fieldboss'\|'chaosgate'\|'island'\|'ghostship'\|'pvp', id, tier?, gate?, mode?, time?, deaths? }` | content completed |
   | `sail` | `{ dist?, arrive?: islandId }` | distance sailed (m) / island reached |
   | `pvp` | `{ win: bool, mode }` | Proving Grounds match end |
   | `death` | `{ content? }` | hero died |
   | `login` | `{}` | once per session start |
   | `zone` | `{ zone }` | entered a zone |
   | `song` / `emote` | `{ song\|emote, npc? }` | only when played outside `S.rapport` (rapport functions emit these themselves) |
   | `boss_part` | `{ boss, part }` | a boss part was broken (Gorrath horns → title) |
   Everything performed *through* systems functions (hone, transfer, facet, market buy/sell, craft, dispatch,
   research, gather/fish/dig, rapport song/emote/gift, card awaken/open, gem fuse, collect, donate, shop buy, mail
   claim) emits its own event — do not track those again.
3. **Rewards.** Replace `Session.contentDone`'s placeholder loot with `S.loot.*` (they grant and return rows):
   chaos → `S.loot.chaosReward(A, ch, { tier, cleared })` (it consumes rest bonus itself — drop the session's own
   `rest.chaos -= 20` and the `rested` multiplier; pass `rested` into ChaosMode from `S.loot.restInfo(ch).chaos.rested`);
   guardian → `S.loot.guardianReward(A, ch, { guardian: id })`; abyss gate → `S.loot.abyssReward(A, ch, { raid:
   'oratory', gate: 0|1 })`; legion gate → `S.loot.raidReward(A, ch, { raid: 'gorrath', gate: 0|1, mode:
   'normal'|'hard' })` then optionally `S.loot.buyMoreRewards(...)`; field kills → `S.loot.fieldDrop(A, ch, { kind:
   'mob'|'elite'|'named' })`; events → `S.loot.eventReward(A, ch, { kind: 'fieldboss'|'chaosgate'|'island'|
   'ghostship'|'treasure', island? })`; Inferno floor → `S.loot.infernoReward(A, ch, { floor })`. Each result's
   `rows` feed the results screen `loot`, `currencies` feeds the currency line. Then call `S.tasks.track(A, ch,
   'clear', …)`.
4. **Honing.** Use `S.honing.hone(A, ch, slot, { boosters })` instead of `gear.hone` (same rules, plus weekly Honing
   Support events, research discounts, pity stats, share-card data and task/title tracking).
5. **Timers.** Every ~10 s while playing (and on window open) call `S.tick(account, char)` — it brings the market
   (your listings selling, expiries → mail), stronghold research, life energy and the calendar up to date and returns
   notifications `[{ kind, text }]` to toast. It is cheap.
6. **First login of a new character**: `S.mail.welcome(account, char)` (starter kit letters; powerpass characters
   get the Powerpass Starter Crate). Safe to call more than once.
7. **Account change needed (optional):** nothing is required — every system lazily initialises its own state. The
   old `roster.market = { listings, sold }` and `roster.stronghold` defaults are migrated in place.

---

## `loot` — reward tables & rolls (`loot.js`, tables in `src/data/loot.js`)

Every reward function rolls, **grants** (unless `grant: false`) and returns a `LootResult`:
```js
LootResult = { ok, source: 'chaos:3'|'guardian:rimewing'|'abyss:oratory:0'|'raid:gorrath:normal:1'|…, title,
  rows: [Row], bundle: Bundle, currencies: { silver, gold, … }  // only currencies, for the results screen line
  resonance: bool, rested: bool, first: bool, gold: n,           // flags that applied
  notes: [string],                                              // e.g. 'Rest bonus ×2', 'Weekly gold already claimed'
  more?: { cost: { gold }, gate, mode, raid } }                  // raid only: the More Rewards offer
```
| function | notes |
|---|---|
| `chaosReward(account, char, { tier: 1-4, cleared = true, rng, now, grant = true })` | base loot every clear; the first 2 clears per day add the **Resonance Chest** (×2 and extras rolled twice when rest ≥ 20, which is consumed). Increments `char.daily.chaos`. Research *Rift Cartography* +10% materials; card sets' `silverGain` applies to silver. |
| `guardianReward(account, char, { guardian: 'rimewing'\|'cinderhorn'\|'sandmaw'\|'kurai', cleared, rng, now, grant })` | leapstone-heavy; 2 resonance clears/day with rest bonus like chaos. |
| `abyssReward(account, char, { raid: 'oratory', gate: 0\|1, cleared, rng, now, grant })` | weekly first clear of each gate: gold + chest; later clears that week: small `repeat` table. |
| `raidReward(account, char, { raid: 'gorrath', gate: 0\|1, mode: 'normal'\|'hard', cleared, rng, now, grant })` | gate gold once per gate per character per week (either difficulty) + chest; result has `more` (the More Rewards offer). Repeat clears: `notes` explains, practice silver only. |
| `buyMoreRewards(account, char, { raid, gate, mode, rng, now })` | pays gold, rolls the More Rewards chest (once per gate per week). |
| `fieldDrop(account, char, { kind: 'mob'\|'elite'\|'named', rng, grant })` | per-kill drops (cheap, often empty `rows`). |
| `eventReward(account, char, { kind: 'fieldboss'\|'chaosgate'\|'island'\|'ghostship'\|'treasure', island?, focus?, rng, now, grant })` | open-world events; `island` = Adventure Island id (`S.tasks.calendar` gives the island and its `focus`: `'gold'\|'silver'\|'cards'\|'shards'\|'pips'`). Field boss & chaos gate pay once per event window per character. |
| `infernoReward(account, char, { floor: 1-100, rng, now, grant })` | per floor; every 5th floor a boon chest; every 10th floor a weekly milestone chest (gold, gem pouch, card pack, horn shards from 20). |
| `restInfo(char)` → `{ chaos: { rest, rested, resonanceLeft }, guardian: { … } }` | for the content menu ("Rested ×2"). |
| `weeklyInfo(account, char, now)` → `{ raid: { 'gorrath:0': 'normal'\|null, … }, abyss: { 'oratory:0': bool, … }, inferno: { best, milestones: [10, 20…] }, more: {…} }` | what is still claimable this week. |
| `preview(source)` → `{ title, mins, ilvl, sections: [{ name: 'Every clear'\|'Resonance Chest'\|…, rows: [{ id, name, grade, icon, min, max, chance }] }] }` | reward preview for any source id (`'chaos:3'`, `'guardian:kurai'`, `'abyss:oratory:1'`, `'raid:gorrath:hard:1'`, `'fieldboss'`, `'island:gold'`, `'inferno:40'`). |
| `sources()` → `[{ id, title, ilvl, mins, kind }]` | every content source (for menus / the economy model). |
| `simulateEconomy(opts)` | re-exported from `economy.js` (see below). |

## `economy` — `simulateEconomy(opts)` (`economy.js`)
Plays a dedicated player from a Powerpass character (Vanguard +10, iLvl 1200) to Horned Tyrant +8 (iLvl 1420) in a
sandbox account (never touches the real save): picks content by iLvl (chaos, guardians, abyss, hourly events,
Inferno), opens pouches, sells tradable drops on the market, buys missing honing materials with gold, hones greedily
(lowest piece first), and transfers Vanguard → Horned Tyrant at the raid vendor.
```js
simulateEconomy({ runs = 24, seed = 1, strategy = 'early'|'late', start: ms, maxHours = 12, log = false })
→ { runs, strategy, target: 1420, entry: 1415,
    hours: { median, p10, p90, mean, min, max },          // to iLvl 1420 (all pieces Horned +8)
    entryHours: { median, p10, p90 },                     // to iLvl 1415 (raid entry)
    transferHours: { median },
    per: { chaos, guardian, abyss, events, inferno, taps, fails, transfers, marketBuys, marketSales },   // means
    spent: { silver, gold, leapstone, fusion, shards, horn_shard, destruction_stone, guardian_stone },   // means
    earned: { … same keys },
    timeline: [{ min, ilvl, what }],                      // of the median run
    text }                                                // printable summary
```

## `honing` — honing polish (`honing.js`)
| function | returns |
|---|---|
| `view(account, char, now)` | `HoningView` (below) |
| `hone(account, char, slot, { boosters: { solar_grace, solar_blessing, solar_protection }, rng, now })` | `HoneResult` |
| `expected(item, { boosters, now, account })` | `{ taps (mean attempts), p50, p90, perTap: Cost, cost: Cost (expected total), chances: [0..1 per tap] }` |
| `transferPreview(account, char, slot)` | `{ ok, why, msg, from: { set, hone, iLvl }, to: { set: 'horned', hone, iLvl }, cost, costRows, missing }` |
| `transfer(account, char, slot)` | `{ ok, item (new Horned Tyrant piece, equipped), old, cost }` — Vanguard **+12 or higher** only; hone becomes `round(hone / 2)` (+12 → +6 = 1400, +15 → +8 = 1420, +20 → +10); quality kept; costs horn shards + gold + sunshards (weapon 10 / 300 / 6000, armor 6 / 150 / 3500). |
| `upgradeQuality(account, char, slot, { rng })` | `{ ok, old, rolled, now, cost }` (never goes down; silver + gold cost from gear.js) |
| `supportEvent(now)` | `{ id, name, desc, costMul?, rateBonus?, energyMul?, maxHone?, ends }` — this week's **Honing Support** (rotates weekly: Artisan's Week, Lucky Forge, Silver Lining, Stonemason's Discount, Leap of Faith, Shardstorm) |
| `stats(account)` | `{ taps, wins, fails, guaranteed, luckiest: Share\|null, unluckiest: Share\|null, history: [Share ×≤20] }` |
| `TRANSFER` | `{ from: 'vanguard', to: 'horned', minHone: 12, cost: { weapon: Cost, armor: Cost } }` |
```js
HoningView = { iLvl, support: SupportEvent, stats: HoningStats,
  pieces: [{ slot, uid, name, set, setName, grade, icon, hone, max, iLvl, nextILvl, quality,
    canHone, why: null|'max'|'story'|'materials', msg,
    chance: { base, failBonus, boost, event, total },          // 0..1
    energy: 0..1, guaranteed: bool, fails, taps,               // Artisan's Energy & pity at this level
    cost: Cost, costRows: [Row], missing: Cost,
    boosters: { solar_grace: { have, max, add }, solar_blessing: {…}, solar_protection: {…} },  // add = chance per piece
    expected: { taps, cost },
    transfer: null | TransferPreview }] }
HoneResult = { ok, why?, msg?, need?,                          // why: 'max'|'story'|'materials'|'booster'
  success, guaranteed, slot, name, from, to, hone, iLvl, chance, base,
  energy (after, 0..1), energyGain, fails, taps, cost: Cost, costRows: [Row],
  share: null | Share,                                         // on success
  notes: [Notification] }                                      // task/title progress
Share = { kind: 'hone', name, slot, set, from, to, taps, fails, chance, base, energy, guaranteed,
  luck: 0..1 (share of Shardbearers who needed MORE taps), label: 'Lucky'|'Average'|'Unlucky'|'Artisan',
  spent: Cost, t, char: { name, cls } }
```

## `engravings` — books, equipping, stone faceting, build summary (`engravings.js`)
Learned points: a book adds its points (Rare 5, Epic 10, Legendary 20) to `char.learned[engr]` (max 80). Equipping
one of 2 slots gives +3 nodes per 20 learned points (max +12).
| function | returns |
|---|---|
| `view(account, char)` | `{ slots: [{ slot: 0\|1, id, name, nodes, max } \| null ×2], learned: [{ id, name, points, max: 80, equipMax }], books: [{ uid, engr, name, grade, points }] (unread in bag), summary: Summary, stones: [StoneView] (bag + equipped) }` |
| `readBook(account, char, uid)` | `{ ok, engr, points, total, equipMax }` |
| `equip(account, char, slot, engr, nodes?)` | `{ ok, slot, id, nodes }` (nodes defaults to the max allowed; 3/6/9/12) |
| `unequip(account, char, slot)` | `{ ok }` |
| `summary(char)` | `Summary` |
| `stoneView(stone)` | `StoneView` |
| `facet(account, char, stoneUid, line: 0\|1\|2, { rng })` | `{ ok, success, chance, next, done, cost, stone: StoneView, share: null \| StoneShare, notes }` — costs silver per tap (Legendary 1,200 · Relic 1,680 · Ancient 2,200) |
| `bestStone(account)` | `StoneShare \| null` (roster best by positive nodes) |
```js
Summary = { list: [{ id, name, desc, nodes, level: 0..3, negative, cls, sources: [{ kind: 'book'|'accessory'|'stone'|'class', name, v }] }],
  threes, fiveByThree: bool, label: '5x3'|'3 3 3 2 1'…, negatives: [{ id, name, level }] }
StoneView = { uid, name, grade, facets: 6..10, chance: 0.25..0.75, done, equipped,
  lines: [{ id, name, negative, slots: [1|-1|0 …], success, fail, left, nodes, level }] ×3,
  score: [a, b, neg], label: '97', is97: bool, cost: { silver } }
StoneShare = { kind: 'stone', label: '97', score, lines: [name…], grade, is97, t, char: { name, cls } }
```

## `cards` — collection, packs, awakening, deck, sets (`cards.js`, catalog `src/data/cards.js`)
37 cards (grades 2–5), 5 sets: **Tides of Light** (6: damage up to +15% at 30 awakening), **Pip Parade** (6:
+silver / +xp), **Horns of the Legion** (5: crit & crit damage), **Storm & Ember** (6: elemental resistance,
damage-over-time), **Wardens of Brighthold** (5: HP, heal/shield, damage taken).
| function | returns |
|---|---|
| `view(account)` | `CardsView` |
| `openPack(account, packId = 'card_pack', { rng })` | `{ ok, pack, cards: [{ id, name, grade, isNew, dupes, awaken }], choose: null \| [cardId ×3] }` — consumes one pack item; the Legendary Card Selector returns `choose` (resolve with `choose`) |
| `choose(account, index)` | `{ ok, card }` resolves the pending selector (`roster.cardChoice`) |
| `awaken(account, cardId)` | `{ ok, id, awaken, cost: { dupes, silver } }` — dupes 1/2/3/4/5, silver grade × 800 × (level + 1) |
| `setDeck(account, slot: 0..5, cardId \| null)` | `{ ok, deck }` (a card can sit in one slot only) |
| `autoDeck(account)` | `{ ok, deck, set }` — fills the deck with the set giving the most value |
| `mods(account)` | `{ mods: { dmgAdd, crit, critDmg, dmgTaken, hpMaxMul, healMul, shieldMul, silverGain, xpGain, elemRes, dotMul, seedSense }, active: [{ set, name, desc }] }` |
| `CARDS`, `CARD_SETS`, `CARD_PACKS` | catalog re-exports |
```js
CardsView = { deck: [cardId|null ×6], deckAwaken,
  collection: [{ id, name, grade, kind: 'npc'|'pip'|'boss'|'legend', sets: [setId], owned, dupes, awaken, maxAwaken: 5,
    canAwaken, awakenCost: { dupes, silver } | null, inDeck, source, flavor, icon: 'card:<id>' }],
  sets: [{ id, name, cards: [{ id, name, owned, inDeck, awaken }], inDeck, awk,
    bonuses: [{ n, awk, desc, active, reached }] }],
  mods, active: [{ set, name, desc }],
  packs: [{ id, name, count }], choice: null | { pack, options: [{ id, name, grade }] },
  owned, total }
```

## `gems` — 11 sockets, fusion (`gems.js`)
A socketed gem is the gem Item plus `skill` (skill id). **Ruinstone** = +damage%, **Swiftstone** = −cooldown% for its
skill (`gear.gemValue`). One Ruinstone and one Swiftstone per skill.
| function | returns |
|---|---|
| `view(account, char)` | `{ sockets: [{ idx, gem: Item\|null, skill, skillName, type, level, value, desc }] ×11, bag: [Item], fusable: [{ type, level, count, can, cost }], skills: [{ id, name, ruin, swift }], mods }` |
| `socket(account, char, gemUid, idx, skillId)` | `{ ok, replaced: Item\|null }` (replaced gem returns to the bag) |
| `unsocket(account, char, idx)` | `{ ok, gem }` |
| `assign(account, char, idx, skillId)` | `{ ok }` re-target a socketed gem |
| `fuse(account, char, type: 'ruin'\|'swift', level: 1..9, { count = 1 })` | `{ ok, made: [Item], cost }` — 3 gems of a level → 1 of the next (always succeeds), costs silver `level × 2,000` each |
| `openPouch(account, char, pouchId = 'gem_pouch', { rng })` | `{ ok, gem: Item }` (`gem_pouch` Lv.1–3, `gem_pouch_hi` Lv.3–5) |
| `mods(char)` | `{ [skillId]: { dmg: 0.24, cdr: 0.16, ruin: lv, swift: lv } }` |

## `market` — AI auction house & crystal exchange (`market.js`)
Order books for every tradable item (materials, battle items, trade goods, food, engraving books `book:<engr>`, gems
`gem:<ruin|swift>:<lv>`) plus unique accessory listings. Prices are **gold per bundle** (`unit` items per bundle:
stones ×10, trade goods ×100, most others ×1). Reference prices drift with deterministic supply/demand noise over real
time and react to your trades; SimPlayers (named via `social/names.js simName`) relist every 10 minutes.
| function | returns |
|---|---|
| `categories()` | `[{ id: 'honing'\|'battle'\|'trade'\|'food'\|'book'\|'gem'\|'accessory', name, items: [id] }]` |
| `browse(account, { cat, q, now })` | `[{ id, name, grade, icon, cat, unit, price, ref, change24, volume24, have }]` (price = cheapest ask per bundle) |
| `book(account, id, now)` | `{ id, name, grade, icon, cat, unit, ref, price, change24, have, asks: [{ key, seller, price, qty, you }], history: [{ t, price, vol }] (24 h, hourly), suggest }` |
| `history(id, { now, hours = 168, step = 3600e3 })` | `[{ t, price, vol }]` (for charts) |
| `quote(account, id, qty, now)` | `{ ok, qty, cost, avg, fills: [{ seller, price, qty }] }` (no side effects) |
| `buy(account, char, id, qty, { now, maxPrice })` | `{ ok, bought, spent, avg, fills, rows }` — cheapest first; gold only |
| `list(account, char, id, qty, price, { now, uid })` | `{ ok, listing }` — takes the goods (stackables in bundles of `unit`; unique items by `uid`: accessories, gems, books). **5% fee** on sale (research *Market Contacts* −1%). Listings **expire after 24 h** (items return by mail). |
| `listings(account, now)` | `[Listing]` your listings (sales processed first) |
| `cancel(account, char, listingId, now)` | `{ ok, returned: [Row] }` |
| `tick(account, now)` | `[{ kind: 'sold'\|'expired', text, gold? }]` — processes your listings (proceeds & returns arrive by **mail**) |
| `accessories(account, { slot, engr, now })` | `[{ key, seller, price, item: Item }]` (SimPlayer unique listings, relisted every 10 min) |
| `buyAccessory(account, char, key, now)` | `{ ok, item, spent }` |
| `exchange(now)` | `{ buy, sell, history: [{ t, buy }] }` — gold per 100 crystals (buy = what 100 crystals cost; sell = what you get for 100) |
| `buyCrystals(account, hundreds, now)` / `sellCrystals(account, hundreds, now)` | `{ ok, crystals, gold }` |
| `fee(account)` | `0.05` minus perks |
| `price(id, now)` | reference price per bundle |
| `ITEMS_MARKET` | `{ [id]: { id, name, grade, icon, cat, unit, base, vol } }` |
```js
Listing = { id, itemId, name, grade, icon, unit, qty (bundles left), sold, price (per bundle), t, expires, left,
  status: 'active'|'sold'|'expired', item?: Item }
```

## `stronghold` — Brightwater Isle (`stronghold.js`, data `src/data/stronghold.js`)
Buildings (Manor, Workshop, Research Hall, Crew Barracks, Garden, Pet Ranch), 13 research projects, 19 workshop
recipes, 8 dispatch missions (10 min – 4 h), action energy (5,000 max, +180/h). Real time.
| function | returns |
|---|---|
| `view(account, now)` | `StrongholdView` |
| `upgradeBuilding(account, id, now)` | `{ ok, building, level, levelUps }` |
| `researchList(account, now)` / `startResearch(account, id, now)` | rows below / `{ ok, research, t1 }` |
| `recipes(account, now)` / `recipeQuote(account, recipeId, qty, now)` | `[Quote & { can }]` / `Quote = { recipe, name, cat, qty, cost, costRows, energy, mins, out, outRows, locked }` |
| `craft(account, recipeId, qty, now)` / `cancelCraft(account, jobId, now)` / `collectCrafts(account, char, now)` | `{ ok, job }` / `{ ok, refunded }` / `{ ok, rows, jobs }` |
| `missions(account, now)` | `[{ id, name, tag, mins, crew, power, xp, rewards: [{ id, min, max, chance }], freeCrew }]` |
| `dispatchChance(account, missionId, crewIds, now)` | 0.1..0.98 |
| `dispatch(account, missionId, crewIds, now)` / `collectDispatch(account, char, jobId, { rng, now })` | `{ ok, job }` / `{ ok, success, rows, mission, levelUps }` |
| `recruitCrew(account, { pay: 'contract'\|'silver', rng, now })` | `{ ok, crew }` |
| `collectGarden(account, now)` / `stationPet(account, petId, now)` / `collectRanch(account, { rng, now })` | `{ ok, rows }` |
| `rush(account, 'research'\|'craft'\|'dispatch', jobId, now)` | `{ ok, cost: { crystals } }` (1 crystal per started 10 min) |
| `perks(account)` | `{ chaosLoot, honeSilver, craftSpeedBattle, lifeEnergy, dispatchSlots, atk, hp, guardianLoot, marketFee, dispatchChance, foodYield, fusionCost, craftSlots }` (sums) |
| `energy(account, now)` | `{ now, max, perHour }` |
| `tick(account, now)` | `[{ kind: 'research', id, name, text }]` |
```js
StrongholdView = { level, xp, xpNext, max, energy, energyMax,
  buildings: [{ id, name, desc, level, max, effect: { text, … } | null,
    next: null | { level, cost, costRows, reqStronghold, can, why, effect } }],
  research: [{ id, name, tier, desc, perk, cost, costRows, energy, mins, done, active, locked, available, left }],
  researching: null | { id, name, t0, t1, left, pct },
  perks, crafts: [{ id, recipe, name, qty, t0, t1, left, pct, done, out: [Row] }], craftSlots,
  dispatch: [{ id, mission, name, crew: [crewId], chance, t0, t1, left, done }], dispatchSlots,
  crew: [{ id, name, role, power, xp, busy }], crewCap,
  garden: { level, ready: [Row], since }, ranch: { level, pets: [petId], slots }, notes: [Notification] }
```

## `lifeskills` — trade skills (`lifeskills.js`, data `src/data/lifeskills.js`)
Foraging `forage`, Logging `log`, Mining `mine`, Hunting `hunt`, Fishing `fish`, Archaeology `dig`. Levels 1–30,
Life Energy 10,000 (+300/h real time, research *Restful Breeze* +5%).
| function | returns |
|---|---|
| `view(account, now)` | `{ energy, energyMax, perHour, skills: [{ id, name, verb, level, xp, xpNext, energy (cost), tool: { tier, name, dur, max } \| null, drops: [{ id, name, grade, icon, rare, level, unlocked }] }] }` |
| `gather(account, char, skill, { rng, now, node })` | `{ ok, rows, xp, level, levelUp, energy, rare }` (fish/dig: use the minigames below; `gather` resolves them as an average catch) |
| `fishCast(account, { rng, now })` | `{ ok, cast: { id, biteAt (s), window (s), perfect (s), rare: bool, energy } }` — spend energy on cast; the float bobs at `biteAt` s |
| `fishReel(account, char, cast, reactAt, { rng })` | `{ ok, result: 'perfect'\|'good'\|'early'\|'late', rows, xp, levelUp }` — reactAt = seconds after the cast when the player pulled; in `[biteAt, biteAt + window]` succeeds, the first `perfect` s is a perfect catch (×1.5, rare ×2) |
| `digStart(account, { rng, now })` | `{ ok, dig: { id, speed (cycles/s), zone: [a, b], perfect: [c, d], energy } }` — a meter sweeps 0→1→0 |
| `digStop(account, char, dig, pos 0..1, { rng })` | `{ ok, result: 'perfect'\|'good'\|'poor', rows, xp, levelUp }` |
| `eat(account, foodId, now)` | `{ ok, energy }` (food1 +500, food2 +700, food3 +1,000, food4 +1,500, life_tonic +1,000) |
| `buyTool(account, skill, tier)` | `{ ok, tool }` (silver; tier 1–4: yield +0/10/20/35%, rare ×1/1.25/1.5/2, 500 uses) |
| `energy(account, now)` | `{ now, max, perHour }` |

## `collectibles` — Pip Seeds & co, Adventure Tome (`collectibles.js`, data `src/data/collectibles.js`)
Catalogs: 120 Pip Seeds (`seed:<zone>:<n>`, zones `solhaven goldmeadow thornwood ashen_ridge pipsprout islands`),
8 Island Souls, 6 Giant's Hearts, 10 Masterpieces, 8 Omnium Stars, 10 Sea Bounties, 6 World Tree Leaves, 12 Vistas —
each `{ id, name, zone, hint, source }` (world/content owners place them by id). Reward tiers per type (skill point
potions, card packs, roster xp, pets, mounts, titles; the Sunbloom Pip Wagon legendary mount at 120 seeds).
| function | returns |
|---|---|
| `view(account)` | `{ types: [TypeView], tome: [TomeRegion], seedsByZone: { zone: { have, total } } }` |
| `collect(account, char, type, id)` | `{ ok, isNew, type, id, name, have, total, ready: [n] }` — type `'seeds'\|'souls'\|'hearts'\|'masterpieces'\|'stars'\|'bounties'\|'leaves'\|'vistas'` (also records the tome) |
| `claim(account, char, type, n)` | `{ ok, rows }` (claim reward tier `n`) |
| `tomeRecord(account, region, kind, id)` | `{ ok, isNew, pct }` — kind `'bosses'\|'npcs'\|'lore'\|'cuisine'` (seeds & vistas are recorded by `collect`) |
| `tomeClaim(account, char, region, pct)` | `{ ok, rows }` (tiers at 30/60/90/100%) |
| `zoneList(zone)` | `[{ id, type, name, hint }]` everything placeable in a zone |
| `COLLECTIBLES`, `TOME`, `ISLANDS` | catalogs (`ISLANDS[id] = { id, name, gimmick, soul, focus }`) |
```js
TypeView = { id, name, icon, have, total, pct,
  tiers: [{ n, rows: [Row], claimed, ready }], next: null | { n, rows },
  items: [{ id, name, zone, hint, source, found }] }
TomeRegion = { id, name, pct, sections: [{ kind, name, have, total, entries: [{ id, name, found, hint }] }],
  rewards: [{ pct, rows: [Row], claimed, ready }] }
```

## `rapport` — 8 NPCs (`rapport.js`, data `src/data/rapport.js`)
`brannoc`, `seraphine`, `mirelle`, `wren`, `maren`, `tumbleroot` (Solhaven — ids match `data/npcs.js` `rapport`),
`bramblebeard` (Pipsprout Hollow), `morwenna` (Brinehollow). Stages Neutral → Amicable (1,000) → Friendly (3,000) →
Trusted (6,000) → Honored (10,000) → Devoted (16,000). 6 songs and 6 emotes per NPC per day.
| function | returns |
|---|---|
| `view(account, now)` | `[RapportView]` |
| `one(account, npcId, now)` | `RapportView` |
| `song(account, char, npcId, songId, now)` / `emote(account, char, npcId, emoteId, now)` | `{ ok, gain, pts, stage, stageUp, line, left }` (`why: 'limit'` after 6/day; unknown song → `'song'`) |
| `gift(account, char, npcId, giftId, n = 1, now)` | same shape; gifts have no daily limit, preference ×2 love / ×1.5 like / ×1 neutral / ×0.5 dislike |
| `claim(account, char, npcId, stage)` | `{ ok, rows }` (stage 1..5 rewards; cards, songs, emotes, Giant's Heart/Masterpiece, titles, mounts) |
| `SONGS`, `EMOTES`, `RAPPORT_NPCS`, `STAGES` | catalogs |
```js
RapportView = { id, name, title, zone, personality, icon: 'npc:<id>', pts,
  stage: { idx: 0..5, name, min, next: number|null }, pct (to next stage),
  today: { songs, songsMax: 6, emotes, emotesMax: 6 },
  likes: { songs: [id], emotes: [id], gifts: { giftId: 'love'|'like'|'neutral'|'dislike' } },
  rewards: [{ stage, name, rows: [Row], claimed, ready }], line }
```

## `tasks` — Wayfarer's Tasks, weekly tasks, reputation, event calendar (`tasks.js`, data `src/data/tasks.js`)
Each day 6 of ~20 task templates are offered (deterministic per roster & day); accept up to 3. Weekly: 5 offered,
accept 3. Completing grants rewards + **Wayfarer reputation** (levels 1–10 with rewards).
| function | returns |
|---|---|
| `view(account, now)` | `TasksView` |
| `accept(account, taskId, now)` / `abandon(account, taskId, now)` | `{ ok }` |
| `claim(account, char, taskId, now)` | `{ ok, rows, rep }` |
| `claimRep(account, char, level)` | `{ ok, rows }` |
| `track(account, char, event, data)` | `[Notification]` — see Hook-in; also routes to titles, achievements, guild missions |
| `calendar(now, { hours = 6 })` | `[CalEvent]` upcoming + live, sorted by start |
| `live(now)` | `[CalEvent]` live now |
| `compass(account, now)` | `{ now, live: [CalEvent], next: [CalEvent] (≤ 8), resets: { daily, weekly } (ms timestamps) }` |
| `eventWindow(kind, now)` | the current/next `CalEvent` of that kind |
```js
Notification = { kind: 'task'|'taskDone'|'weekly'|'rep'|'title'|'achievement'|'guild'|'research'|'sold'|'expired'|…, text, id? }
TasksView = { day, week,
  daily: { offered: [Task], accepted: [taskId], max: 3, done },
  weekly: { offered: [Task], accepted: [taskId], max: 3, done },
  rep: { level, pts, next, max: 10, rewards: [{ level, rows, claimed, ready }] } }
Task = { id, tpl, name, desc, event, need, n, done, claimed, accepted, rows: [Row], rep }
CalEvent = { id, kind: 'fieldboss'|'chaosgate'|'island'|'ghostship', name, where, start, end, live, left,
  island?: { id, name, focus }, rows?: [{ id, name }] }   // left = ms until start (upcoming) or until end (live)
```
Schedule (UTC): Field Boss (*Old Thunderhoof*) every hour at :00 (10 min), Chaos Gate at :30 (10 min), Adventure
Island every 2 h at :00 (15 min; island rotates), Ghost Ship on Thursdays & Sundays at 12:00, 16:00, 20:00, 23:00
(20 min).

## `guild` (`guild.js`, data `src/data/guilds.js`)
12 AI guilds (deterministic levels/members/mottos), join / leave / create, daily donations, research perks, weekly
missions, guild shop (`S.shops`, shop id `'guild'`, bloodstones).
| function | returns |
|---|---|
| `list(account, now)` | `[{ id, name, tag, level, members, max, motto, focus, leader, recruiting, joined }]` |
| `view(account, now)` | `null \| GuildView` |
| `join(account, id, now)` / `leave(account, now)` / `create(account, { name, motto }, now)` | `{ ok, guild }` (create costs 20,000 silver; leaving has a 1-day re-join cooldown) |
| `donate(account, char, kind: 'silver'\|'gold', tier = 0, now)` | `{ ok, bloodstones, xp }` (once per kind per day) |
| `claimMission(account, char, missionId, now)` | `{ ok, rows }` |
| `setResearch(account, id)` | `{ ok }` (guild research focus; applies when you lead your own guild) |
| `perks(account)` | `{ xpGain, silverGain, lifeXp, shopDiscount, restGain }` |
```js
GuildView = { id, name, tag, level, xp, xpNext, members, max, motto, rank: 'Member'|'Officer'|'Master', own,
  bloodstones, contribution,
  donations: { silver: { cost, bloodstones, xp, done }, gold: [{ tier, cost, bloodstones, xp, done }] },
  research: [{ id, name, desc, level, max, perk, active }],
  missions: [{ id, name, desc, progress, need, done, claimed, rows: [Row] }],
  roster: [{ name, cls, ilvl, rank, online, contribution, you }] }
```

## `shops` — vendors (`shops.js`, data `src/data/shops.js`)
Shop ids: `general` (silver: potions, battle items, gifts, tools), `raid` (Horn of the Tyrant: Horned Tyrant transfer
entries, relic accessories, honing mats), `pvp` (Proving Tokens), `guild` (bloodstones), `harbor` (pirate coins:
ship skins, crew contracts, treasure maps), `island` (Glass Sea Tokens), `card` (gold / card packs), `crystal`
(crystals: cosmetics, bound honing bundles, pets, a mount).
| function | returns |
|---|---|
| `list()` | `[{ id, name, npc, currency }]` |
| `view(account, char, shopId, now)` | `{ id, name, npc, desc, currency, currencies: { [cur]: amount }, items: [ShopItem] }` |
| `buy(account, char, shopId, key, n = 1, now)` | `{ ok, rows, spent: Cost, left }` (transfer entries run `honing.transfer`) |
```js
ShopItem = { key, id, name, grade, icon, kind, desc, qty (per purchase), price: { currency, amount },
  limit: null | { period: 'daily'|'weekly'|'total', max, left }, can, why, req? }
```

## `mail` (`mail.js`)
| function | returns |
|---|---|
| `inbox(account, now)` | `{ unread, list: [Mail] }` (newest first; expired mail pruned) |
| `read(account, id)` | `{ ok, mail }` |
| `claim(account, char, id)` / `claimAll(account, char)` | `{ ok, rows }` |
| `remove(account, id)` | `{ ok }` (refuses unclaimed attachments: `why: 'attachments'`) |
| `send(account, { from, subject, body, kind, bundle, days = 30, t })` | `Mail` |
| `welcome(account, char)` | `[Mail]` newly sent (idempotent per roster / per powerpass character) |
| `compensation(account, { reason, bundle })` | `Mail` (tongue-in-cheek apology letter) |
```js
Mail = { id, from, subject, body, kind: 'system'|'market'|'event'|'guild'|'gift'|'compensation'|'rapport',
  t, read, claimed, expires, left, attachments: [Row], hasItems }
```

## `titles` — titles & achievements (`titles.js`, data `src/data/titles.js`)
| function | returns |
|---|---|
| `view(account)` | `{ active, titles: [{ id, name, desc, color, owned, active }], achievements: [{ id, name, desc, cat, progress, need, done, title, rows }] }` |
| `setActive(account, id \| null)` | `{ ok }` |
| `track(account, char, event, data)` | `[Notification]` (called by `tasks.track`) |
| `mods(account)` | stat mods of the active title (`{}` for most) |

## `boards` — local leaderboards (`boards.js`)
Weekly boards with deterministic SimPlayer competitors plus your records (global boards can replace them later).
| function | returns |
|---|---|
| `list()` | `[{ id, name, desc, unit: 'time'\|'floor'\|'rating'\|'luck'\|'stone'\|'count', better: 'lower'\|'higher' }]` |
| `view(account, boardId, now)` | `{ id, name, week, unit, entries: [{ rank, name, cls, guild, value, display, you, sim }], you: { rank, value, display } \| null }` |
| `submit(account, char, boardId, value, now)` | `{ ok, improved, best, rank }` |
Boards: `legion_nm`, `legion_hm` (fastest clear), `guardian` (today's guardian, fastest kill), `inferno` (deepest floor),
`pvp` (rating), `honing_luck` (lowest chance hit), `best_stone`, `seeds`.

## `partyfinder` — SimPlayer party listings (`partyfinder.js`)
| function | returns |
|---|---|
| `listings(account, char, { content, now })` | `[{ id, content, title, desc, leader: { name, cls, ilvl, title, guild, persona }, members: [{ name, cls, ilvl, support, seed }], size, max, minIlvl, created }]` (refreshes every 2 min) |
| `join(account, char, listingId, now)` | `{ ok, content, sims: [seed…], members }` — spawn the others with `party.addSim(makeSim(seed), …)` |
| `contents()` | `[{ id: 'chaos:3'\|'guardian:sandmaw'\|'abyss:oratory'\|'raid:gorrath:normal'…, name, ilvl, max }]` |

## `mods` — stat & economy aggregation (`mods.js`)
| function | returns |
|---|---|
| `statContext(account, char)` | `{ rosterLevel, research: { atk }, cardBonus: { dmgAdd }, extra: Mods, skills: { [skillId]: { dmg, cdr } }, econ: { silverGain, xpGain, chaosLoot, guardianLoot, marketFee, lifeEnergy, seedSense } }` |
| `applyMods(stats, mods)` | the stats object with `mods` applied (stats.js conventions) |
| `econMods(account)` | the `econ` part |

## Top level (`index.js`)
`tick(account, char, now)` → `[Notification]` (market, stronghold research, life energy, rapport day roll, calendar)
· `track` (= `tasks.track`) · `statContext` (= `mods.statContext`) · every module as a namespace.
