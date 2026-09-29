# src/game/meta — leaderboards, share cards, challenge links, combat meter, records

A session plugin (`index.js`, imported by `src/game/plugins.js`). Everything plugs in through `src/game/registry.js`;
no other owner's file is edited. Lab: `node tools/lab.mjs src/lab/meta.js` → `http://localhost:5299/lab/meta.html`
(`?card=all`, `?boards=legion_nm&variant=g1`, `?meter=1&tab=dmg|sup|skills|log`, `?share=clear`, `?ribbons=1&pill=1`, `?chal=1`).

| file | |
|---|---|
| `index.js` | the plugin: registry claims, bus listeners, keys, screens, challenge flow, sharing |
| `boards.js` | board definitions, periods, the SimPlayer realm, local + remote merge, submissions, UI-window data |
| `remote.js` | Supabase adapter (`SUPABASE_URL` / `SUPABASE_KEY`, empty = local only), `PUBLIC_URL` |
| `records.js` | personal records in `roster.records.pb`, `legionRaceNews()` |
| `meter.js` | `Meter` (combat log collector) + `MeterPanel` (the detailed DOM panel) |
| `cards.js` | `renderCard(kind, data)` → 1200×630 canvas |
| `portrait.js` | `heroPortrait(char)` — the hero rendered in a separate small WebGL context |
| `share.js` | `ShareModal` (preview · Save · Share… · Copy image · Copy challenge link) + card data builders |
| `challenge.js` | `?challenge=` links: encode / validate / decode, launch descriptor, attempt tracking |
| `ui.js` | the meta layer, ribbons, share pills, title challenge card, `BoardsPanel` |
| `store.js` | localStorage `ss.meta.v1` (entries, raid progress, honing streaks, challenge, panel layout) |
| `meta.css` | styles (all rules scoped under `.ss-mx-layer`; built on `src/ui/a-tokens.css` + `b-kit.css`) |

## Wiring (what the session sees)
- **Windows**: `registerWindow('meter')` feeds the UI owner's compact meter window (hotkey **Y**, pushed 2×/s while open);
  `registerWindow('leaderboards')` feeds the UI owner's leaderboards window (`lb:board {board, sub}` handled; gate /
  Inferno variants are flattened into ids like `legion_nm:g1`, classes stay `subs`).
- **Actions**: `results:share` (only that one — other `results:*` go to the session) · `title:leaderboards` (opens the
  meta leaderboards overlay; windows are hidden on the title screen) · `meter:reset` · `lb:board` · `chat:command`
  `/meter` `/lb` `/records` `/share` `/profile` `/challenge` (other commands fall through) · `share:*`:
  `share:clear [{content, result}]` `share:hone [share]` `share:stone [{uid}|StoneView]` `share:profile` `share:inferno`
  `share:card {kind, data, opts}` `share:boards {board, variant}` `share:meter` `share:challenge`.
  These are (re)claimed in `init()`, i.e. after every module registered: meta takes over `systems/hooks.js`'s local
  `leaderboards` window, `lb:` and `title:leaderboards` (other prefixes are chained, never dropped).
- **Keys**: Backquote (input action `meter`, read in `update()`) toggles the detailed Combat Meter panel. It and the
  compact UI window (Y) are alternatives: opening one closes the other. Esc closes meta modals first.
- **Bus**: `clear` (boards, records, challenge result, post-fight log) · `hone` · `facet` · `collect` (seeds) · `pvp`
  (rating) · `zone` (challenge offer). `session.shareCard` (set by the systems stone window's `stone:share`) opens the
  share modal.
- **Debug**: `window.__meta` (the plugin: `meter`, `panel`, `boardsPanel`, `shareModal`, `lastCard` canvas, `lastClear` …).

## Leaderboards
| id | variants | period | value |
|---|---|---|---|
| `legion_first` World First | — | week | ms after the weekly reset of your first full Gorrath clear (both gates this week) |
| `legion_nm` / `legion_hm` Fastest | `full` `g1` `g2` | week | seconds; Full Raid = your best Gate 1 + best Gate 2 this week |
| `legion_dps` Top DPS | DPS classes | week | your DPS in a Gorrath gate |
| `legion_support` Top Support | — | week | 0–100: 60% buff uptime + 40% (shields + heals) / raid damage taken |
| `legion_deathless` | — | week | fastest gate with zero raid deaths |
| `guardian` Daily Guardian | — | day | today's guardian (`GUARDIANS[dayId % 4]`, same rotation as systems), fastest kill |
| `inferno` | `deepest` `fastest100` | week | deepest floor / seconds from floor 1 to 100 |
| `pvp` | — | all | `roster.pvp.rating` (posted on `pvp` events) |
| `stone` | — | week | `a*100 + b + (10 − negative)/100` → shown `97`, `10/7` |
| `honing` Luckiest | — | week | odds of that success (1 − P(needing more taps)); lower = luckier; only posted when < 50% |
| `seeds` | — | all | `roster.collect.seeds.length` |

Resets: daily 10:00 UTC, weekly Wednesday 10:00 UTC (`dayId` / `weekId` in `src/core/util.js`). Rows merge per board /
variant / period, one per name (best value): your entries (this browser, every roster), friends' entries
(`addFriendEntries(list)`), the realm's SimPlayers and the global board. **SimPlayers**: one seeded raider pool per
period (the week's elite top several boards, like a real server); each entry appears at a plausible moment (a 12-minute
clear can't be posted 5 minutes after the reset), so boards fill up through the week. Values are calibrated on real
fights (Rimewing ≈ 99 s for an over-geared Raid Ready Reaver + AI party; AI allies ≈ 1.1–1.3M DPS; Gorrath G1 ≈ 15 min
with an AI raid) — tune `GATE_T`, `GUARD_T`, `DPS_K` and the `spread()` calls in `boards.js`.
Entries carry `premade` (Raid Ready characters), `trial` (content entered under the item level) and `coop` flags,
shown as tags. API: `boardView(board, variant, { now, limit })`, `submit(entry)`, `myBest()`, `windowData()`,
`addFriendEntries(list)` / `shareableEntries()` (for co-op sharing, if the net layer wants it), `todaysGuardian()`.

### Enabling global boards (Supabase)
Nothing is created automatically. To go global (a Supabase project is the owner's choice and cost):
1. Create a Supabase project; open **SQL editor**, paste and run `supabase/schema.sql` (idempotent).
2. **Project settings → API**: copy the Project URL and the publishable (anon) key.
3. Put them in `src/game/meta/remote.js` (`SUPABASE_URL`, `SUPABASE_KEY`) and `node build.mjs`.

The table is closed (RLS, no policies); only `submit_entry` and `top_entries` are executable by `anon`. The server
derives the period itself, validates board / variant / value ranges, names, classes and party, and rate-limits per IP
hash (8 per 10 s, 150 per hour). With empty keys (the default) everything stays local; the overlay shows *Local realm*
/ *Global board* / *Global board unreachable*. `PUBLIC_URL` is where share cards and challenge links point when the
page runs somewhere a friend can't open (file://, localhost, a sandboxed frame).

## Share cards
`renderCard(kind, data)` → `Promise<canvas>` 1200×630, system fonts (Georgia display, Segoe/Roboto/Helvetica text),
icons from `iconCanvas()` (`boss:<id>`, `class:<id>`, `engr:<id>`, `item:*`), SEVENSHARD crest + wordmark, the public
address and date. Kinds: `clear` (guardian / raid gate / chaos / abyss: boss medallion, time, S/A/B rank, board rank,
badges — First clear, Personal best, Deathless, World First #n, Premade, Trial, Beat <name> — party DPS bars, or your
numbers when solo), `hone` (+N, taps, luck, Artisan's Energy, chances, item level), `stone` (the three facet lines,
`97 STONE`), `profile` (the hero rendered by `heroPortrait()`, name / title / guild, item level, engravings, weapon,
best records), `inferno` (floor, time, kills, boons, weekly rank). `ShareModal.open(kind, data, { challenge })`
previews and offers Save image (download, or `window.claude.use('downloads')` in sandboxed embeds), Share… (Web Share
API with the PNG), Copy image (ClipboardItem) and Copy challenge link. Moments worth sharing (+18 and up, a lucky
honing, a 97-ish stone) pop a small **Share** pill above the skill bar.

## Challenge links
`?challenge=<base64url JSON>` (`{ v, k: 'guardian'|'raid'|'chaos'|'inferno', n, c, b|r+g+h|tr|s, t, f, d, w }`),
validated against real boss / raid / class ids, clamped, never inserted as HTML. On load the code moves to the store
(and out of the address bar); the title shows a challenge card (bottom-left, Accept / dismiss); after entering Solhaven
the player is offered the content (`session.launch`, item level checked; raids below the requirement enter as Trial).
The next matching clear records the attempt (`store.challenges`) and shows *Challenge beaten!* (with *Send it back*) or
*Not this time*. `/challenge` re-offers a pending challenge, or copies a link for your last clear.

## Combat meter
`Meter` listens to the level's `damage heal shield death revive counter staggerCheck staggerBreak partBreak awaken
identity bossBanner bossEnrage cast` events and splits combat into fights: one per boss encounter (closed at victory /
wipe, then stamped with the official clear time), chaos run or Inferno floor; open-world skirmishes end after 10 s idle.
Per member: damage, DPS, share, crit %, back + head attack %, counters, stagger share (each hit's drop of the boss's
stagger bar is attributed to its source), shields, effective healing, damage taken, deaths, support buff uptime (share of
ally-time under at least one of that support's buffs) and Brand uptime on bosses. For the local hero: per-skill damage,
share, DPS, crit, hits / casts, biggest hit (DoTs, battle items and Inferno boons get their own rows). The log keeps the
fight's key moments (mechanic banners, counters, stagger / part breaks, awakenings, identities, deaths, record hits,
the clear). Twelve fights of history (◀ ▶ in the panel). The panel is parked while the results screen is up (it covers
Continue) and restored afterwards; Backquote opens it there for the post-fight log.

## Records & news
Personal bests live in `roster.records.pb` (`{ key: { v, t, name, cls, sub, label, unit, prev } }`: `guardian:<id>`,
`raid:<raid>:g<n>:<nm|hm>`, `raid:<raid>:full:<mode>`, `chaos:<tier>`, `dps:legion:<cls>`, `inferno:deepest`,
`inferno:100`, `hone:luck`, `stone:best`); improvements show as ribbons over the results screen (toasts in game).
`roster.records` is shared with `systems/titles.js` (flat counters) and `modes/inferno.js` (`records.inferno`) — meta
only touches `records.pb`.

**Title news for the lead**: `import { legionRaceNews } from './meta/index.js'` →
`ui.screen('title', { …, news: [legionRaceNews(this.account), ...NEWS] })` gives
`{ tag: 'Race', title: 'Weekly Legion Race', date: '<n> clears so far · resets in 2d 4h', body: 'World First: … Fastest
Normal: … Your best: #n.', art: 2 }`.
