# SEVENSHARD UI (`src/ui/`)

DOM + CSS user interface for SEVENSHARD: HUD, screens, windows, tooltips, banners, dialogue. It is driven by plain
data objects and reports everything the player does through **one callback**; it never reaches into game internals.
All CSS lives in `src/ui/*.css` (inlined by the build, every class prefixed `ss-`). No frameworks, no webfonts, no
external assets. Lab: `node tools/lab.mjs src/lab/ui.js` → `http://localhost:5299/lab/ui.html` (see *Lab* below).

```js
import { createUI } from './ui/index.js';
const ui = createUI(document.body, { onAction(type, payload) { /* see "Actions" */ } });
ui.screen('title', { server: 'Solmara-1', status: 'Busy', version: 'v1.0' });
ui.screen('game');
ui.hud.update(hudState);                 // ~15×/s, the full HudState; diffed internally
ui.open('inventory', { items, currencies });
```

---------------------------------------------------------------------------------------------------------------------
## 1. createUI(root, opts) → ui

| opt | |
|---|---|
| `onAction(type, payload)` | receives every UI action (section 9) |
| `hotkeys` | `false` disables UI window hotkeys, or an object overriding `HOTKEYS` (`{ inventory: 'KeyI', … }`, `KeyboardEvent.code`) |
| `touch` | `true` / `false` / `'auto'` (default: auto = coarse pointer without a fine pointer) |
| `screen` | initial screen (default `'game'`) |

The UI mounts one `div.ss-ui` (fixed, full screen, `z-index: 20`, `pointer-events: none` except on interactive
elements, so the game canvas underneath keeps receiving world clicks). Layout is authored in a **virtual 1600×900**
space (touch: ~960×540) and scaled with CSS `zoom`, so text and hairlines are laid out — not bitmap-scaled — at the real
resolution: crisp from 1280×720 to 2560×1440. `ui.scale`, `ui.vw`, `ui.vh` expose the current scale / virtual size.

### Core API
| | |
|---|---|
| `ui.screen(name, data)` | `'title' 'charselect' 'create' 'loading' 'game' 'results' 'death'`; same name again = update in place. `'death'` is an overlay (HUD stays). Screens hide the HUD and windows (except modal-layer windows). |
| `ui.hud.update(HudState)` | section 3 |
| `ui.hud.press(key)` | flash a slot on a key press: `'Q'…'F'`, `'1'…'4'`, `'V'`, `'Space'` |
| `ui.hud.loot(item)` | right-side pickup feed (`{ name, grade, count, icon, kind, uid? }`) |
| `ui.hud.badge(id, n)` | notification badge on a menu button (`'mail'`, `'guild'`, …; `0` hides) |
| `ui.setHudVisible(on)` / `ui.hudVisible` | photo mode (also Ctrl+Z / F12) |
| `ui.banner(text, opts)` / `ui.toast(text, kind, dur?)` | section 4 |
| `ui.chat.add(msg)` / `ui.chat.focus(prefill?)` / `ui.chat.clear()` | section 3.9 |
| `ui.dialog(npc, script)` → `Promise<choiceId\|null>` | NPC dialogue, section 7 |
| `ui.confirm(o)` → `Promise<bool>` · `ui.prompt(o)` → `Promise<string\|null>` | section 7 |
| `ui.open(id, data)` `ui.close(id)` `ui.toggle(id, data)` `ui.update(id, data)` `ui.isOpen(id)` `ui.get(id)` | windows, section 6 |
| `ui.setTouch(on, { skills })` | touch layout, section 8 |
| `ui.setScale(m)` | user UI scale multiplier 0.6–1.6 (persisted in localStorage) |
| `ui.wantsKeyboard` / `ui.typing` | a UI text field has focus → the game should ignore key presses |
| `ui.isOverUI(event)` | a pointer event hit interactive UI → the game should not move/attack on it |
| `ui.on(type, fn)` / `ui.off(type, fn)` | extra listeners (`'*'` = every action) besides `onAction` |
| `ui.dispose()` | remove DOM and listeners |

### Keyboard (what the UI handles)
Enter focuses chat (`/` pre-fills a command), Esc closes the top window → else emits `hud:escape` and (if the game
didn't handle it) toggles the game menu, Ctrl+Z / F12 toggles the HUD. Window hotkeys (`HOTKEYS`, matching
`src/engine/input.js`): P character · I inventory · K skills · N engravings · M map · U guild · O party finder ·
L tome · J quests · H compass · Y meter · B songs · `.` emotes. Combat keys (QWER ASDF Z X V C G T Space 1–4) belong
to the game. Note: the game's input layer `preventDefault()`s its bound keys; the UI therefore does not treat
`defaultPrevented` as "handled". Keys are ignored while a text field, modal, NPC dialogue or full screen owns input.

**Window hotkeys and menu buttons**: the UI first emits `hud:menu { id }`. If the game's handler opens/closes/updates
that window (e.g. `ui.toggle(id, data)`), the UI does nothing more; otherwise it toggles the window itself with the
last data it was given. Same for Esc → `hud:escape` → game menu.

---------------------------------------------------------------------------------------------------------------------
## 2. Screens

| name | data | actions |
|---|---|---|
| `title` | `{ server, status: 'Good'\|'Busy'\|'Full'\|'Maintenance', version, news: [{ tag, title, date, body, art? (0–2) }], continue?: { name, cls, level } }` | `title:enter` `title:together` `title:leaderboards` `title:settings` `title:server` `title:news {index}` |
| `charselect` | `{ server, roster: { level, xp: 0..1 }, chars: [{ id, name, cls, level, iLvl, title?, location?, rested? }], selected, max: 6 }` | `select:pick {id}` `select:enter {id}` `select:create` `select:delete {id}` (after type-the-name confirm) `select:back` |
| `create` | `{ cls, sex: 'm'\|'f', look: { face, hair, hairColor, skin, eyes, height, build, marks, markColor }, name, step: 'class'\|'look', classes?: [ids], taken?: [names] }` | `create:change {cls, sex, look}` (every edit) `create:step {step}` `create:camera {view: 'body'\|'face'}` `create:confirm {cls, sex, look, name, path: 'story'\|'powerpass'}` `create:back` |
| `loading` | `{ zone, region?, kind?: 'field'\|'city'\|'dungeon'\|'raid'\|'sea'\|'island'\|'arena'\|'stronghold', tip?, pct: 0..100, image?: canvas\|dataURL }` — call again with `{ pct }` only to advance | — |
| `results` | `{ kind: 'clear'\|'fail', over?, title, sub?, rank?: 'S'…'D', time, best?, stats?: [{ label, value }], loot: [Item], currencies?: { silver, gold, xp }, dps: [{ name, cls, dmg, dps, crit, back, counters, deaths, you, support }], retry?, continueLabel? }` | `results:continue` `results:retry` `results:share` `results:item {uid}` |
| `death` (overlay) | `{ reason?, by?, revives: [{ id, label, sub?, wait?: s, count?, disabled?, key? }], auto?: { label, left } }` — `wait` counts down locally | `death:revive {id}` |
| `game` | — (the HUD) | — |

Title, charselect and create keep the centre of the screen clear for the lead's 3D scene; the title only vignettes the
edges. Create emits `create:change` on every appearance edit so the 3D hero can update live. Name rules: 2–16 letters.

---------------------------------------------------------------------------------------------------------------------
## 3. HudState — `ui.hud.update(state)`

The ARCHITECTURE.md shape plus optional extras (marked +). Missing fields hide their widget.
```js
{ hp, hpMax, shield, mp, mpMax, level, xp, xpMax, iLvl, dead?,                 // + dead (or hp <= 0) greys the bar
  cls,                                                                          // + player class (identity colour); else party[you].cls
  identity: { kind: 'gauge'|'orbs'|'stance'|'bubbles'|'demon', value, max, orbs, maxOrbs, stance ('pistol'|'shotgun'|'rifle'|0–2),
              active, activeLeft, label, activeLabel?, ready?, color? },       // + color overrides the class colour
  skills: [Skill|null ×8],      // Q W E R A S D F. Uses cd, cdLeft, mana, icon, active? (glow), noMana? (else mana > mp), stacks?
  awaken: Skill,                // + uses (remaining uses)
  dash: { cd, cdLeft, charges, maxCharges?, down? },  // + down: knocked down → the slot pulses "Spc UP"
  items: [{ id, icon, count, cd, cdLeft, name, grade? } ×4],
  buffs: [{ id, icon, name, left, stacks, debuff, dur?, desc? }],   // dur enables the remaining-time shade; left = Infinity hides the timer
  target: null | { name, level?, hp, hpMax, kind?: 'mob'|'elite'|'named'|'npc'|'player', title? },   // shown when no boss
  party: [{ name, cls, hp, hpMax, shield, dead, you, support, level?, offline? }],                   // 5–8 entries → raid frames (2×4)
  boss: null | { name, title, hp, hpMax, barHp | bars, stagger: null|{ v, max, left? }, destruction: null|{ v, max },
                 enrageLeft, counter, buffs, groggy?, enraged?, showHp?, others?: [{ name, hp, hpMax, dead }] },
  quests: [{ id, title, kind: 'msq'|'side'|'daily'|'weekly'|'event'|'guide', steps: [{ text, n, need, done }] }],
  zone: { name, sub },
  minimap: { canvas, x0, z0, size, you: { x, z, facing }, markers: [{ x, z, kind, label }] },
  progress: null | { label, pct },                       // chaos dungeon %
  timer: null | { label, left, urgent? },                // hidden when it duplicates boss.enrageLeft ("Enrage")
  cast: null | { label|name, t|pct: 0..1, kind: 'cast'|'casting'|'channel'|'charge'|'hold'|'holding', perfect?: [a, b] | number | { from, to }, icon?, left? },  // +
  interact: null | { key: 'G', label: 'Talk', name?, hold?: 0..1 },                                                                                // +
  badges: { mail: 2, … },                                                                                                                         // +
  ship: null | { name, hp, hpMax, speed, speedMax, sails: 0..3, heading, wind, windSpeed?, crew?, dest?: { name, dist },                          // + sailing
                 skills: [{ id, name, icon, key, cd, cdLeft, desc? } ×4] },
  currencies: { silver, gold, crystals } }
```
- **Cooldowns**: each sweep is a CSS animation started when a cooldown begins and re-synced only when `cdLeft` drifts
  from it (cooldown-rate effects such as Overload ×3 are followed automatically). `cdLeft > cd` is tolerated.
- **Boss bars**: `×N` = `ceil(hp / barHp)`; the last bar is red, colours climb through orange, yellow, green, cyan,
  blue, purple, pink; the next colour shows under the current one; a cream damage trail chases the fill.
- **Identity looks**: `gauge` (Bloodlust/Sanctity/Arcane Surge: segmented bar, Z/X ready glow, shimmering while full,
  marching stripes while active), `orbs` (Chi/Surge diamonds), `stance` (pistol/shotgun/rifle chips + Deadeye bar),
  `bubbles` (Serenade), `demon` (horned crimson gauge).
- **Minimap markers**: `party player npc vendor quest questdone objective portal dungeon boss elite mob seed ping poi triport`
  (quest/boss/party markers clamp to the rim when off-view). Clicking the map emits `hud:minimap {x, z}`.
- **Sailing**: `ship` swaps the combat cluster for the ship cluster: hull bar, speed dial (knots), sail level, ship
  skills Q–R (cooldown sweeps), compass rose. `heading`/`wind` use the hero `facing` convention (0 = north,
  positive = counter-clockwise from above); `wind` is the direction it blows *to*.
- **Legibility**: soft dark plates sit behind boss, target, progress, identity, minimap title and quest text so the
  HUD reads over snow and bloom.

### 3.9 Chat
`ui.chat.add({ channel, from?, text, you?, to?, item?: Item })` — channels `area shout party raid guild whisper system
loot npc world`. Tabs All / Area / Party / Guild / Whisper / System filter by channel. Input: `/s /say` area,
`/y /shout`, `/p /party`, `/ra /raid`, `/g /guild`, `/w <name> <text>`, `/r` reply, `/help`; typing `/p ` switches the
sticky channel. Tab cycles channels, ↑/↓ history, Esc blurs. Emits `chat:send { channel, text, to? }` and
`chat:command { cmd, args, raw }` for any other `/command`. Item links (`msg.item`) show a tooltip.

---------------------------------------------------------------------------------------------------------------------
## 4. Banners & toasts

`ui.banner(text, { kind, sub, title, level, dur })`
| kind | look |
|---|---|
| `zone` | letter-spaced serif zone title, `sub` = region above, gold rule |
| `boss` | cinematic title card: `title` (e.g. "the Horned Tyrant") above the huge name on a dark band |
| `warn` | red mechanic warning band — replaces the current warning instantly |
| `counter` / `stagger` | "COUNTER!" (blue) / "STAGGER BREAK" (purple) pop — instant |
| `levelup` | rotating rays + big `level` number, text below |
| `quest` `clear` `defeat` `gate` `success` `fail` `info` | band + over-line + title |

Major kinds queue (max 3); `warn`, `counter`, `stagger` never wait. `ui.toast(text, kind)` kinds: `info success warn
error loot system party` (top-centre stack, 4 max, ~4 s).

---------------------------------------------------------------------------------------------------------------------
## 5. Items, skills and tooltips

`Item` and `Skill` are the ARCHITECTURE.md shapes. Extra optional item fields the tooltip understands: `tier`,
`trades` (tradable N more times), `effects: [string]` (bracelets), `facetNames`, `gem: { skill, effect }`,
`awaken` (cards), `set: string | { name, have, pieces, bonuses: [{ n, text }] }`, `use`, `cd`, `value`.
Negative engravings use ids `neg_atk neg_speed neg_def neg_move` (`*_reduction` aliases also work).
Any element can carry `el._tip = { title, lines, key?, color? } | { kind: 'item', item, hint? } | { kind: 'skill', skill, hint? }`
(or a function returning one); hover shows it, a 450 ms long-press shows it on touch.

---------------------------------------------------------------------------------------------------------------------
## 6. Windows — `ui.open(id, data)` / `ui.update(id, data)`

Draggable by the title bar, closable (× / Esc, topmost first), stackable (click brings to front), positions remembered
in localStorage (`ss.ui.win.v1`; Settings → Interface → Reset window positions). `window:open {id}` /
`window:close {id}` are emitted so the game can push fresh data. `ui.update(id, data)` re-renders an open window
(and stores the data for the next open). Menu strip ids: `character inventory skills engravings sunheart cards map
guild market mail stronghold tome partyfinder settings`.

| id | data | actions |
|---|---|---|
| `character` | `{ name, cls, level, iLvl, title?, guild?, roster?, gear: { weapon, head, shoulder, chest, pants, gloves, necklace, earring1, earring2, ring1, ring2, stone, bracelet }, stats: { atk, hp, crit, spec, swift, dom, endur, expert }, engravings: [{ id, nodes, neg? }], cards?: { set, count, awaken, bonuses: [{ text, active }] } }` — mount a 3D portrait canvas into `ui.get('character').portrait` (250×390 virtual px) | `char:slot {slot, uid}` · `char:unequip {slot, uid}` (right-click) · `inv:equip {uid, slot}` (drop) |
| `inventory` | `{ items: [Item + pos?], slots?: 60, currencies: { silver, gold, crystals }, tab? }` — tabs All/Gear/Battle/Materials/Misc, search, sort | `inv:use {uid}` · `inv:equip {uid, slot?}` · `inv:sell {uid}` (right-click while vendor is open, or drop on vendor) · `inv:move {uid, to}` (drag) · `inv:sort {tab}` · `inv:link {uid}` (Shift+click) · `inv:select {uid}` |
| `skills` | `{ cls, points, pointsTotal?, skills: [Skill + { learned, lvlReq }], bar: [skillId\|null ×8], selected? }` | `skills:level {id, delta}` · `skills:tripod {id, tier, index}` · `skills:assign {id, key, slot}` (drag / click-then-slot; id null clears) · `skills:reset {id}` · `skills:select {id}` |
| `engravings` | `{ active: [{ id, nodes, neg?, sources?: [{ name, v }] }], equipped: [{ id, nodes }\|null ×2], books: [{ id, nodes }], maxBook?: 12 }` | `engr:equip {slot, id}` · `engr:unequip {slot}` |
| `sunheart` | `sunView()`: `{ unlocked, unlockAt, points, available, iLvl?, trees: [{ id, name, color, blurb, spent, tiers: [{ tier, gate, open, nodes: [{ id, name, desc, rank, max, cost, can }] }] }] }` | `sunheart:rank {id, delta: 1\|-1}` (left / right click) · `sunheart:reset {tree}` |
| `settings` | `{ values: { quality, renderScale, shadows, bloom, fps, master, music, sfx, ambience, mute, moveButton, damageNumbers, cameraShake, telegraphs, quickCast, autoLoot, uiScale, chatOpacity, buffTimers, touch }, keybinds: [{ action, keys: [] }] }` | `settings:change {key, value, values}` · `settings:rebind {action}` (double-click) · `settings:reset {values}` — `uiScale`, `touch`, `chatOpacity` are also applied by the UI |
| `vendor` | `{ name, title?, greeting?, tabs?: [{ id, label }], items: [{ id, item: Item, price: { cur, amount }, stock?, limit?, tab? }], buyback?: [Item + { price }], currencies }` | `vendor:buy {id, qty}` (Shift+click asks a quantity) · `vendor:buyback {uid}` · `inv:sell {uid}` |
| `gamemenu` | `{ items?: [{ id, label, glyph }] }` (default: resume, settings, keys, party finder, photo, help, character select, title) | `gamemenu {id}` |
| `map` | `{ view?: 'zone'\|'world', zone, canvas, x0, z0, size, you, markers, world?: { regions: [{ id, name, x, y (0..1), kind, level?, unlocked?, current?, pct?, triport? }], ship?: { x, y } } }` — zone view defaults to the HUD minimap; world view paints Solmara | `map:click {x, z}` · `map:travel {id}` |
| `honing` | `{ items?: [Item], item, iLvlFrom?, iLvlTo?, gains?: [{ label, from, to }], chance: { base, bonus, boosters?, total? }, maxBonus?, energy: 0..1, mats: [{ id, name, icon, grade, need, have }], cost: { silver, gold }, currencies, boosters: [{ id, name, icon, grade, have, max, add }], result?: 'success'\|'fail', resultKey?, maxed? }` — or call `ui.get('honing').play('success'\|'fail', { hone, energy })` | `hone:select {uid}` · `hone:booster {id, n}` · `hone:tap {uid, boosters}` |
| `stone` | `{ stones?: [Item], stone: Item (engr ×2, neg, facets: [[1\|0\|null ×10] ×3]), chance: 0..1, cost?: { silver }, last?: { line, ok }, lastKey? }` | `stone:select {uid}` · `stone:facet {uid, line}` · `stone:share {uid}` |
| `cards` | `{ deck: [cardId\|null ×6], cards: [{ id, name, grade, awaken, count, icon, desc?, set? }], sets: [{ id, name, cards: [ids], bonuses: [{ need, awaken?, text }] }] }` — awakening n→n+1 costs n+1 copies | `cards:equip {id, slot}` (click / drag) · `cards:unequip {slot}` (right-click) · `cards:awaken {id}` |
| `gems` | `{ sockets: [{ gem: Gem\|null, skill?: { id, name, icon } } ×11], gems: [Gem], skills: [{ id, name, icon }], fuseCost? }` · `Gem = { uid, gem: 'ruin'\|'swift', level, name, grade, icon, desc? }` | `gems:socket {uid, slot}` (drag) · `gems:unsocket {slot}` · `gems:target {slot, skill}` · `gems:fuse {uids: [3]}` |
| `market` | `{ tab?, cats: [{ id, label, subs? }], cat?, sub?, q?, results: [{ id, name, icon, grade, kind, bundle?, lowest, avg?, recent?, stock?, history?: [prices], trend? }], selected?, sellable?: [Item + { suggested }], listings?: [{ id, item, price, qty, left?, sold? }], fee?, exchange?: { rate, history? }, currencies }` | `market:search {q, cat, sub}` · `market:select {id}` · `market:buy {id, qty, price}` · `market:list {uid, price, qty}` · `market:cancel {id}` · `market:exchange {dir: 'crystalsToGold'\|'goldToCrystals', amount}` |
| `stronghold` | `{ level, xp, xpMax, energy: { now, max, perHour }, buildings: [{ id, name, level, max, desc, effect, next?: { cost: [rows], time, req?, can }, upgrading?: { left, total } }], research: [{ id, name, desc, tier, time, cost?, state: 'locked'\|'available'\|'active'\|'done', left?, total?, req? }], craft: { slots, queue: [{ id, name, icon, grade, qty, left, total }], recipes: [{ id, name, icon, grade, time, out?, cost, can }] }, dispatch: { slots, crew: [{ id, name, role, power, busy }], missions: [{ id, name, time, chance, power, rewards, can }], active: [{ id, name, left, total }] } }` — cost rows `{ name, icon, grade, need, have }`; timers tick locally | `sh:upgrade {id}` · `sh:research {id}` · `sh:craft {id, qty}` · `sh:cancel {id}` · `sh:collect` · `sh:dispatch {id}` · `sh:claim {id}` |
| `tome` | `{ tab?: 'tome'\|'collectibles', selected?, regions: [{ id, name, pct, cats: [{ id, label, have, total }], rewards: [{ pct, name, icon, grade, count?, claimed }] }], collectibles: [{ id, name, icon, have, total, tiers: [{ n, name, icon, grade, count?, claimed }] }] }` | `tome:region {id}` · `tome:claim {region, pct}` · `collect:claim {id, n}` |
| `rapport` | `{ npcs: [{ id, name, title, icon?, stage: 0–5, points, max, daily?: { songs, songsMax, emotes, emotesMax }, songs: [{ id, name, locked? }], emotes: [{ id, name }], gifts: [Item], rewards: [{ stage, name, icon, grade, claimed }] }], selected? }` — stages Neutral → Devoted | `rapport:select {id}` · `rapport:song {npc, id}` · `rapport:emote {npc, id}` · `rapport:gift {npc, uid}` · `rapport:claim {npc, stage}` |
| `guild` | `{ guild: null \| { name, tag, level, xp, xpMax, motto, bloodstones, rank, emblem?: { color }, members: [{ name, cls, level, iLvl, rank, online, weekly }], research: [{ id, name, level, max, desc }], missions: [{ id, name, n, need, reward }] }, browse?: [{ id, name, tag, level, members, max, motto, req }] }` | `guild:donate {kind}` · `guild:join {id}` · `guild:create {name, tag}` · `guild:leave` · `guild:research {id}` · `guild:mission {id}` |
| `partyfinder` | `{ you: { name, cls, ilvl }, listings: [{ id, title, content: { kind: 'raid'\|'guardian'\|'chaos', raid?, gate?, hard?, boss?, tier? }, max, req, note, age, leader: Member, members: [Member], canApply }], mine: null \| { title, content, max, req, note, members, applicants }, contents: [{ kind, raid?, gate?, hard?, boss?, tier?, title, max, req, locked }] }` · `Member = { name, cls, ilvl, support?, title? }` — tabs Legion Raid / Abyss (raid `oratory`) / Guardian / Chaos / All | `pf:apply {id}` · `pf:create {content, note, req}` · `pf:accept {name}` · `pf:decline {name}` · `pf:cancel` · `pf:start` · `pf:match {content}` · `pf:refresh` |
| `mail` | `{ mails: [{ id, from, subject, body, date (ms or text), read, kind?: 'system'\|'player'\|'guild', attachments?: [Item], claimed?, expires? }] }` | `mail:open {id}` · `mail:claim {id}` · `mail:claimAll` · `mail:delete {id}` |
| `leaderboards` | `{ board, sub?, boards?: [{ id, label, group?, subs? }], rows: [{ rank, name, cls, value, sub?, you?, party?: [cls] }], you?: { rank, value }, note? }` — default boards: legion_first, legion_nm, legion_hm, legion_dps (per class), legion_support, legion_deathless, guardian, inferno, pvp, stone, honing, seeds | `lb:board {board, sub}` |
| `compass` | `{ events: [{ id, name, kind: 'field_boss'\|'chaos_gate'\|'adventure_island'\|'ghost_ship'\|'sea_bounty'\|'pvp'\|'guild', where?, iLvl?, times?: [minutes after local midnight], next?: s, active?, left?: s, rewards?, icon? }], tracked?: [ids] }` — 24 h timeline, live countdowns | `compass:track {id, on}` · `compass:go {id}` |
| `meter` | `{ title?, time, rows: [{ name, cls, dmg, dps?, you?, support?, dead? }], skills?: [{ name, icon, dmg, crit?, hits? }], log?: [{ t, text, kind: 'dmg'\|'heal'\|'death'\|'mech'\|'buff'\|'loot' }] }` — push ~2×/s | `meter:reset` |
| `songs` / `emotes` | `{ items?: [{ id, name, desc?, glyph?, icon?, cdLeft?, locked? }] }` (defaults: 5 songs / 20 emotes) — radial wheel, 1–9 pick | `songs:play {id}` · `emotes:play {id}` |
| `nexus` | `{ iLvl, cats?: [{ id, label }], selected?, content: [{ id, cat, name, sub?, iLvl, players?, icon?, desc?, locked?, cleared?, note?, modes?: [{ id: 'normal'\|'hard'\|'trial', label, iLvl? }], gates?: [{ name, boss?, icon?, cleared? }], rewards? }], party?: { size, members: [{ name, cls }] }, aiFill? }` | `nexus:select {id}` · `nexus:enter {id, mode, gate, aiFill}` |
| `bid` (modal layer — shows above the results screen) | `{ item, min, step, current: null \| { amount, by }, left, split, gold, you, history: [{ by, amount }], done?: { winner, amount } }` — push every 0.25 s; updated in place | `bid:place {amount}` · `bid:raise {step}` · `bid:pass` |
| `quests` | `{ quests: [{ id, title, kind, desc?, giver?, zone?, level?, steps, rewards? }], tracked?: [ids] }` (defaults to HudState.quests) | `quest:track {id, on}` · `quest:abandon {id}` |

---------------------------------------------------------------------------------------------------------------------
## 7. NPC dialogue, confirm, prompt

`ui.dialog(npc, script)` → `Promise<choiceId | null>` — `npc: { id?, name, title?, portrait?: canvas|dataURL, cls? }`
(portrait falls back to `npc:<id>` then the class crest); `script: string | [string | { text, speaker?, choices?:
[{ id, text, kind?: 'quest'|'shop'|'leave'|'talk' }] }]`. Text types out; click / Space / Enter advance (finishing the
line first); 1–9 pick a choice; Esc closes (→ null). The lower HUD fades while it is open. Also emits
`dialog:choice {id, npc}` and `dialog:close`.

`ui.confirm({ title, text, ok, cancel, danger, match })` → `Promise<bool>` (`match`: type this exact string to enable
OK — used by character delete). `ui.prompt({ title, text, value, placeholder, ok, cancel, maxLength, validate(v) →
error|null })` → `Promise<string|null>`. Enter confirms, Esc cancels, focus is trapped and restored.

---------------------------------------------------------------------------------------------------------------------
## 8. Touch — `ui.setTouch(on, { skills })`

Compact HUD in a ~960×540 virtual space. The bottom-left (≈300×250, virtual joystick) and bottom-right (≈470×300,
skill buttons) zones are kept clear; chat, menu and quests move behind round buttons next to the minimap; windows
centre, scroll and get 40 px close buttons; the interaction prompt becomes a tappable pill (`hud:interact`).
`{ skills: true }` additionally renders the UI's own touch skill cluster (8 skills in an arc, awakening, dash, Z/X,
items 1–4, all with cooldown sweeps) emitting `touch:skill { key, phase: 'down'|'up' }` (hold-friendly).

---------------------------------------------------------------------------------------------------------------------
## 9. Action reference

HUD: `hud:skill {slot, key, id}` · `hud:item {slot, key, id}` · `hud:awaken {key, id}` · `hud:dash {key}` ·
`hud:shipskill {slot, key, id}` · `hud:party {index, name}` · `hud:quest {id}` · `hud:minimap {x, z}` · `hud:compass` ·
`hud:menu {id, key?}` · `hud:escape` · `hud:interact` · `hud:visible {visible}` · `touch:skill {key, phase}`
Chat: `chat:send {channel, text, to?}` · `chat:command {cmd, args, raw}`
Lifecycle: `screen {name}` · `window:open {id}` · `window:close {id}` · `resize {scale, width, height}` · `touch {on}` ·
`dialog:choice {id, npc}` · `dialog:close`
Screens and windows: see the tables in sections 2 and 6.

---------------------------------------------------------------------------------------------------------------------
## 10. Design system (for new windows)

**Tokens** (`a-tokens.css`, on `.ss-ui`): surfaces `--ss-bg` (#0b0f1a @ 88%), `--ss-panel` (panel gradient),
`--ss-bg-well`, `--ss-hover`, `--ss-select`; hairlines `--ss-line`, `--ss-line-a`, `--ss-line-soft`, `--ss-line-hi`;
restrained gold `--ss-gold`, `--ss-gold-hi`, `--ss-gold-a`; text `--ss-text`, `--ss-text-2`, `--ss-dim`, `--ss-mute`;
status `--ss-good`, `--ss-bad`, `--ss-warn`, `--ss-info`; combat `--ss-hp*`, `--ss-mp*`, `--ss-shield`, `--ss-stagger`,
`--ss-destr`, `--ss-counter`; type `--ss-font` (Segoe UI/Roboto/system), `--ss-cond`, `--ss-serif` (Georgia small caps
for display); outlines `--ss-ol`, `--ss-ol2`; `--ss-shadow`, `--ss-ease`, `--ss-spring`. Grade classes `.ss-g0`…`.ss-g7`
set `--gc` (colour) and `--ga/--gb/--gd` (slot gradient) — Common … Primal per DESIGN.md §6.

**CSS primitives** (`b-kit.css`): `.ss-panel` (+ `--flat`, `--glass`, `.ss-orn` gold corner brackets), `.ss-well`,
`.ss-h` (gold-ruled section header, `--c` centred), `.ss-title`, `.ss-label`, `.ss-sep`, `.ss-btn` (+ `--primary` gold,
`--danger`, `--ghost`, `--lg`, `--sm`, `--icon`), `.ss-close`, `.ss-kbd` (+ `--lg`), `.ss-tabs`/`.ss-vtabs` + `.ss-tab`
(`aria-selected`), `.ss-slot` (grade frame; `-ic`, `-n` count, `-hone`, `-q` quality strip, `--empty`, `--round`,
`.is-sel`, `.is-dim`), `.ss-bar` + `.ss-fill` (+ `--gold/--blue/--purple/--red`), `.ss-list`/`.ss-row`, `.ss-kv`,
`.ss-input`, `.ss-toggle`, `.ss-range`, `.ss-seg`, `.ss-select`, `.ss-badge`, `.ss-tag` (`--tc`), `.ss-pips`,
`.ss-win` (+ `-hd`, `-t`, `-bd`, `-ft`), `.ss-modal`, `.ss-tip`, `.ss-scroll`, `.ss-pring` (progress ring, `--p`, `--c`).

**JS kit** (`core/kit.js`): `slot(item, { size, onClick, onContext, tip, hint, empty: { icon, label, tip }, dim, sel,
hone, quality })`, `tabs(parent, items, value, onChange)` / `vtabs` → `{ el, set, map }`, `toggle`, `range`, `select`,
`seg`, `bar`, `money`, `price`, `section`, `kv`, `empty`. `core/util.js`: `h()`, `btn()`, diffed setters (`setText`,
`setCls`, `setStyle`, `setSrc`, `show`…), `Trail` (damage trail), formatters (`fmtInt`, `fmtShort`, `fmtClock`,
`fmtCD`, `fmtLeft`), `store`. `core/drag.js`: `draggable(el, () => payload)` + `el._drop = payload => fn|null`.
`core/glyphs.js`: `glyph(name)` crisp SVG line icons for chrome.

**A new window**: subclass `Win` (`core/windows.js`) with `static id/title/glyph/width/pos/layer`, build DOM once in
`build()` into `this.body`, fill it in `render(data)`, and add the class to `windows/index.js`. Put its CSS in a
`src/ui/*.css` file with `ss-` prefixed classes.

---------------------------------------------------------------------------------------------------------------------
## 11. Icons

`core/icon.js` wraps `icon(id, size, opts)` from `src/ui/icons/` (the icon owner's module; a local placeholder painter
is the fallback). `iconUrl(id, cssPx, opts)` picks the pixel bucket from UI scale × devicePixelRatio and memoizes;
`itemIcon(id, cssPx)` requests `{ bare: true }` art to sit inside `.ss-slot` grade frames. Ids used by the UI:
`skill:<cls>:<slug>` (`skillIconId(cls, name)`), `skill:<cls>:awakening`, `skill:any:dash`, `item:*`, `currency:silver|gold|crystal`,
`engr:<id>` (`engrIcon(id)` maps `*_reduction` → `neg_*`), `status:*`, `class:<cls>`, `tripod:<id>`, `boss:<id>`, `npc:<id>`.

---------------------------------------------------------------------------------------------------------------------
## 12. Performance

`hud.update` with 8 skills, 30 buffs and 8 raid frames: every field is compared before touching the DOM, bars move
with compositor-only `transform`, cooldown sweeps run as CSS animations (not per update), buff/party nodes are pooled.
Measured (headless Chrome, M1): **0.37–0.45 ms per `hud.update`**, 0.48–0.56 ms including the resulting style and
layout work — under the 1 ms budget at 15 Hz. Re-run with the lab's `?perf=1` (logs `[perf] {…}`) or
`window.__benchHud(N)` in the lab page.

---------------------------------------------------------------------------------------------------------------------
## 13. Files

`index.js` (createUI) · `core/` (util, data, icon, glyphs, kit, tooltip, windows, modal, drag) · `hud/` (hud, skillbar,
identity, buffs, boss, party, minimap, quests, chat, menu, center, ship, touch) · `screens/` (title, charselect,
create, loading, results, death) · `windows/` (character, inventory, skills, engravings, settings, vendor, misc,
map, honing, nexus, meter, wheel, compass, social, sunheart, stone, cards, gems, market, stronghold, tome, dialog) ·
CSS `a-tokens` `b-kit` `c-hud` `d-center` `e-windows` `f-screens` `g-touch` `h-windows2`.

## 14. Lab

`node tools/lab.mjs src/lab/ui.js` → `http://localhost:5299/lab/ui.html`. Params: `?screen=hud|title|charselect|create|
loading|results|death` · `&win=<id>[,<id>]` · `&cls=<class>` · `&raid=1` · `&noboss=1` · `&chaos=1` · `&solo=1` ·
`&ship=1` · `&touch=1|skills` · `&banner=zone|boss|warn|counter|stagger|levelup|quest|clear|defeat` · `&toast=1` ·
`&tip=item|skill|buff|gear|stone|awaken` · `&dialog=1` · `&modal=confirm|delete|prompt` · `&hone=success|fail` ·
`&cast=charge|cast|channel` · `&interact=1` · `&freeze=1` · `&hide=1` · `&bg=field|dungeon|city|dark|scene` · `&perf=1`
· `&step=look` (create) · `&kind=<zone kind>` (loading) · `&view=zone|world` (map) · `&locked=1` (sunheart) ·
`&mine=1` (party finder) · `&tab=collectibles` (tome). Mock data: `src/lab/ui-mock.js` (a reference for every shape).
