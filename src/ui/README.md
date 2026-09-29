# SEVENSHARD UI (`src/ui/`)

DOM + CSS UI for SEVENSHARD. Driven by plain data objects; reports everything the player does through one
callback. Never reaches into game internals. (Work in progress — this file is kept in sync with the code.)

```js
import { createUI } from './ui/index.js';
const ui = createUI(document.body, { onAction(type, payload) { /* see "Actions" */ } });
ui.screen('game');
ui.hud.update(hudState);          // ~15×/s, full HudState, diffed internally (< 1 ms)
```

## createUI(root, opts) → ui
| opt | |
|---|---|
| `onAction(type, payload)` | every UI action (see Actions) |
| `hotkeys` | `false` disables UI window hotkeys; or an object overriding `HOTKEYS` (`{ inventory: 'KeyI', … }`, KeyboardEvent.code) |
| `touch` | `true` / `false` / `'auto'` (default: auto = coarse pointer without a fine pointer) |
| `screen` | initial screen (default `'game'`) |

The UI mounts one `div.ss-ui` (fixed, full-screen, `z-index: 20`, `pointer-events: none` except on interactive
elements). Layout is authored in a virtual 1600×900 space (touch: 960×540 class of sizes) and scaled with CSS `zoom`
so text and hairlines stay crisp from 1280×720 to 2560×1440.

### Core methods
| | |
|---|---|
| `ui.screen(name, data)` | `'title' \| 'charselect' \| 'create' \| 'loading' \| 'game' \| 'results' \| 'death'`. Calling again with the same name updates in place. `'death'` is an overlay (HUD stays visible). |
| `ui.hud.update(HudState)` | see HudState below |
| `ui.hud.press(key)` | flash a slot for a key press: `'Q'…'F'`, `'1'…'4'`, `'V'`, `'Space'` |
| `ui.hud.loot(item)` | right-side pickup feed (`Item`-like: `{ name, grade, count, icon, kind }`) |
| `ui.hud.badge(id, n)` | notification badge on a menu button (`'mail'`, `'guild'`, …) |
| `ui.setHudVisible(on)` / `ui.hudVisible` | photo mode (also Ctrl+Z) |
| `ui.banner(text, opts)` | big centred banner, see Banners |
| `ui.toast(text, kind)` | `'info' \| 'success' \| 'warn' \| 'error' \| 'loot' \| 'system' \| 'party'` |
| `ui.chat.add(msg)` | `{ channel, from?, text, you?, to?, item? }`, channels: `area shout party raid guild whisper system loot npc world` |
| `ui.chat.focus(prefill?)` | focus the chat input |
| `ui.dialog(npc, script)` → `Promise<choiceId\|null>` | NPC dialogue |
| `ui.open(id, data)` `ui.close(id)` `ui.toggle(id, data)` `ui.update(id, data)` `ui.isOpen(id)` `ui.get(id)` | windows |
| `ui.confirm({ title, text, ok, cancel, danger, match })` → `Promise<bool>` | `match`: type-to-confirm string |
| `ui.prompt({ title, text, value, placeholder, ok, cancel, maxLength, validate })` → `Promise<string\|null>` | |
| `ui.setTouch(on, { skills })` | touch HUD layout |
| `ui.setScale(m)` | user UI scale multiplier (persisted) |
| `ui.wantsKeyboard` | true while a UI text field has focus → the game should ignore keys |
| `ui.isOverUI(event)` | true if a pointer event hit interactive UI → the game should not move/attack |
| `ui.on(type, fn)` / `ui.off` | local listeners (`'*'` = all) in addition to `onAction` |
| `ui.dispose()` | |

Handled keys call `preventDefault()`; the game should skip events with `e.defaultPrevented` or when `ui.wantsKeyboard`.

## HudState
Exactly the ARCHITECTURE.md shape, plus optional extras (marked +):
```js
{ hp, hpMax, shield, mp, mpMax, level, xp, xpMax, iLvl,
  cls,                                   // + player class id (colours the identity gauge); else party[you].cls
  identity: { kind: 'gauge'|'orbs'|'stance'|'bubbles'|'demon', value, max, orbs, maxOrbs, stance, active, activeLeft, label },
  skills: [Skill|null ×8],               // Q W E R A S D F; Skill.active (+) glows the slot, Skill.stacks (+) count
  awaken: Skill,                         // + awaken.uses shows remaining uses
  dash: { cd, cdLeft, charges, maxCharges },
  items: [{ id, icon, count, cd, cdLeft, name } ×4],
  buffs: [{ id, icon, name, left, stacks, debuff, dur?, desc? }],   // dur (+) enables the remaining-time shade
  target: null | { name, level, hp, hpMax, kind: 'mob'|'elite'|'named'|'npc'|'player', title },  // shown when no boss
  party: [{ name, cls, hp, hpMax, shield, dead, you, support, level?, offline? }],  // 5–8 entries → raid frames
  boss: null | { name, title, hp, hpMax, barHp, stagger: null|{ v, max }, destruction: null|{ v, max }, enrageLeft,
                 counter, buffs, groggy?, enraged?, showHp? },
  quests: [{ id, title, kind: 'msq'|'side'|'daily'|'weekly'|'event'|'guide', steps: [{ text, n, need, done }] }],
  zone: { name, sub },
  minimap: { canvas, x0, z0, size, you: { x, z, facing }, markers: [{ x, z, kind, label }] },
  progress: null | { label, pct },       // chaos dungeon %
  timer: null | { label, left, urgent? },
  cast: null | { label, t: 0..1, kind: 'cast'|'channel'|'charge'|'hold', perfect: [a, b], icon, left },   // +
  interact: null | { key: 'G', label: 'Talk', name, hold: 0..1 },                                       // +
  badges: { mail: 2, … },                                                                                // +
  currencies: { silver, gold, crystals } }
```
Minimap marker kinds: `party player npc vendor quest questdone objective portal dungeon boss elite mob seed ping poi triport`.
Cooldown sweeps are CSS animations started when a cooldown begins and re-synced only when `cdLeft` drifts (so
cooldown-rate effects like Overload ×3 are followed automatically).

## Banners
`ui.banner(text, { kind, sub, title, level, dur })`
| kind | look |
|---|---|
| `zone` | letter-spaced serif zone title, `sub` = region above |
| `boss` | cinematic title card: `title` (e.g. "the Horned Tyrant") above the huge name |
| `warn` | red mechanic warning band (replaces the current warning instantly) |
| `counter` / `stagger` | "COUNTER!" (blue) / "STAGGER BREAK" (purple) pop (instant) |
| `levelup` | rays + big level number (`level`), text below |
| `quest` / `clear` / `defeat` / `gate` / `success` / `fail` / `info` | band + over-line + title |
Major kinds queue one after another; `warn`, `counter`, `stagger` never wait.

## Actions (onAction type → payload)
| type | payload |
|---|---|
| `hud:skill` | `{ slot, key, id }` skill slot clicked |
| `hud:item` | `{ slot, key, id }` battle item clicked |
| `hud:awaken` / `hud:dash` | `{ key, id? }` |
| `hud:party` | `{ index, name }` party frame clicked |
| `hud:quest` | `{ id }` |
| `hud:minimap` | `{ x, z }` world position clicked on the minimap |
| `hud:compass` | `{}` event compass button |
| `hud:menu` | `{ id, key? }` menu button / window hotkey (`character inventory skills engravings cards map guild market mail stronghold tome partyfinder settings`) |
| `hud:escape` | `{}` Esc with nothing left to close |
| `hud:visible` | `{ visible }` photo mode toggled |
| `chat:send` | `{ channel, text, to? }` |
| `chat:command` | `{ cmd, args, raw }` any other `/command` |
| `window:open` / `window:close` | `{ id }` (push fresh data with `ui.update(id, data)`) |
| `screen` | `{ name }` |
| `resize` | `{ scale, width, height }` (virtual size) |
| `touch` | `{ on }` |

## Icons
`src/ui/core/icon.js` wraps `icon(id, size)` from `src/ui/icons/` (placeholder art until that lands; swapping is one
line). UI chrome glyphs (menu, close, dice…) are inline SVG line icons in `core/glyphs.js`.
