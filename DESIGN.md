# SEVENSHARD — design bible

> A Lost Ark–style isometric action MMO that runs in one browser tab. Eight classes, skill tripods, engravings,
> honing, chaos dungeons, guardian hunts, an eight-player legion raid, sailing, islands, a stronghold, trade skills,
> collectibles, rapport, PvP — and real co-op with friends by room code.

Everything here is original: names, characters, places, art, music. The *systems* are an homage to Lost Ark
(isometric skill combat, tripods, identity gauges, awakenings, counters, stagger, back attacks, layered boss HP bars,
chaos dungeons, guardian raids, abyss dungeons, legion raids with gates, honing with artisan's energy, engravings,
ability-stone faceting, card sets, gems, rapport, songs, emotes, sailing, island souls, stronghold, trade skills,
collectible seeds, adventure tome, roster level, powerpass). Never use Lost Ark/Smilegate/Amazon names, logos, fonts,
characters or art. No "Mokoko", "Arkesia", "Kazeros", "Valtan", "Luterra" etc.

## 1. Fiction

- **Solmara** — a world of continents and islands scattered across the **Glass Sea**.
- **The Sunheart** — a divine prism forged by the Seven Lights that kept the **Abyss** sealed. When the Abyss first
  broke through (*the Sundering*), the Sunheart shattered into **seven Shards** that fell across Solmara.
- **The Abyssal Legion** — demon armies of the Emperor **Vorrathis**, led by six Legion Commanders. They hunt the
  Shards to break the last seal. First commander you face: **Gorrath, the Horned Tyrant** (minotaur demon lord).
- **The player** — a **Shardbearer**: a hero whose soul resonates with the Shards. Mentors: **Commander Brannoc Hale**
  (grizzled knight of Brighthold) and **Seraphine** (young oracle who hears the Shards sing).
- **Pips** — tiny round sprout-folk (leaf on the head, big eyes, squeaky voices) of **Pipsprout Hollow**. They hide
  **Pip Seeds** all over the world (the collectible everyone hunts). Elder: **Bramblebeard** (moss beard, walking twig).
  The Pip is the game's mascot — cute, round, readable at any size.
- Early villain: **Varkhul the Ravager**, a demon general with a burning greatsword who razes Brighthold in the prologue.

## 2. Pillars

1. **Combat that feels like Lost Ark.** Huge flashy skills, crowds that scatter, telegraphs you dodge, blue counter
   windows, stagger checks, back/head attacks, big numbers, hit-stop and shake.
2. **The whole game, not a demo.** Every Lost Ark system exists in some playable form, from honing to Pip Seeds.
3. **A living, funny world.** The city is full of AI adventurers who chat, sell, party, carry and fail mechanics.
4. **Real friends, real competition.** Co-op by room code (up to 8 players), weekly legion race, share cards.
5. **One HTML file.** Every mesh, texture, animation, sound and song is generated in code.

## 3. Session flow

Title (animated key scene, "Server: Solmara-1 · Busy") → **Character Select** (your roster stands in a row; up to
6 characters; roster level) → **Create** (8 classes, male/female, face/hair/colours; *Play the Story* or *Powerpass*
straight to endgame) → **Prologue: The Siege of Brighthold** (5-minute cinematic tutorial) → **Solhaven** (capital
hub) → MSQ through Valemont (Goldmeadow → Thornwood → Ashen Ridge, levels 1–50) → endgame loop:
- **Daily**: 2 Chaos Dungeons, 2 Guardian Hunts, 3 Una-style tasks (*Wayfarer's Tasks*), events.
- **Weekly**: Abyssal Dungeon, Legion Raid gates, Trial Guardian, weekly tasks, guild missions.
- **Anytime**: honing, engravings, stone faceting, cards, gems, market, sailing & islands, stronghold, trade skills,
  collectibles, rapport, PvP, Inferno Descent.
Resets: daily 10:00 UTC, weekly Wednesday 10:00 UTC. Rest bonus accrues for skipped dailies.

## 4. Classes

Eight advanced classes. Both sexes for every class. Each: 12 skills (8 on the bar), 3 tripod tiers per skill,
an identity (Z / X), an awakening (V), 2 class engravings. Space = dash (class-tuned cooldown).
Supports make parties: 4-player content wants 3 DPS + 1 support; the legion raid wants 2 supports.

| Class | Archetype | Weapon | Role | Identity | Awakening |
|---|---|---|---|---|---|
| **Reaver** | Warrior | Greatsword (huge) | DPS | **Bloodlust** gauge → Z *Burst Mode* (25 s: +atk speed, +move, +crit, crimson glow; Z again = *Crimson Finale*) | *Worldsplitter* |
| **Oathkeeper** | Warrior | Longsword + holy tome on the hip | Support | **Sanctity** gauge → Z *Aegis of Dawn* (party −20% dmg taken, heal) · X *Sacred Punishment* | *Radiant Judgment* (party invuln + heal) |
| **Stormfist** | Fighter | Gauntlets | DPS | **Chi** orbs ×3 → Z *Dragon Ascent* (1 orb) · X *Thunder Tiger* (2 orbs) | *Heaven's Fury* |
| **Pistoleer** | Gunner | Twin pistols / shotgun / rifle | DPS | **Stances**: each skill belongs to a weapon; casting swaps instantly (*Quickdraw* +dmg) · Z cycles stance · X *Deadeye Focus* when gauge full | *Last Rites* |
| **Starcaller** | Mystic | Staff with star orb | DPS | **Arcane Surge** gauge → Z *Overload* (6 s: instant casts, cooldowns tick ×3) | *Stellar Collapse* |
| **Songweaver** | Mystic | Harp | Support | **Serenade** bubbles ×3 → Z *Anthem of Courage* (party atk) · X *Hymn of Mending* (heal zone) | *Grand Finale* (party heal + invuln) |
| **Bladedancer** | Shade | Twin blades + greatblade | DPS | **Surge** orbs ×3 → Z *Surge* (dash-through, scales with orbs) | *Thousand Cuts* |
| **Demonbound** | Shade | Demonic glaive / claws | DPS | **Demon** gauge → Z *Demonform* (20 s transformation: horns, wings, claws; skill bar swaps to 4 demon skills) | *Abyssal Rupture* |

### Skills (12 per class; type in brackets; ★ = counter, ◆ = very high stagger, ↺ = back attack, ↑ = head attack)
- **Reaver**: Whirlwind Edge [holding], Tempest Slash [combo], Diving Slash [point] ↑, Sword Storm, Mountain Cleave ★↑,
  Hell Blade [charge] ◆, Red Dust (crimson wave + self atk buff), Chain Sword (pull), Strike Wave (projectile),
  Shoulder Charge (dash, super armor), Finish Strike [charge] ↺, Wind Blade (cross slash waves).
  Demon-free. Engravings: *Bloodfrenzy* (low max HP, big dmg, less healing), *Tempered Fury* (burst crit dmg).
- **Oathkeeper**: Holy Bulwark (party shield), Heavenly Blessing (party atk zone), Light Shock (brand: +10% dmg taken),
  Sword of Justice [combo], Godsent Law [casting] ◆, Holy Explosion, Flash Slash, Execution of Justice [holding],
  Wrath of Heaven [point], Charging Blade (dash), Sacred Chain (pull) ★, Rite of Mending (heal zone).
  Engravings: *Blessed Aura* (support), *Judgment* (DPS).
- **Stormfist**: Lightning Kick, Blazing Fist [combo], Tempest Barrage [holding], Sweeping Kick, Storm Dragon Upper
  (launch), Swiftwind Dash [chain], Ground Quake ◆, Thunder Palm [charge] ★, Moonflash Kick (backflip) ↑,
  Heavenly Strike [point], Lightning Whisper ↺, Soaring Tiger. Engravings: *Storm Conduit*, *Chi Master*.
- **Pistoleer** — pistol: Quick Shot (backstep + shots), Spiral Tracker (homing), Equilibrium [holding],
  Dexterous Shot [combo]; shotgun: Dual Buckshot [combo] ↺, Shotgun Rapid Fire [holding], Last Request (kick + blast) ★,
  Dragon Shot (flame slug); rifle: Focused Shot [casting], Perfect Shot [charge] ◆, Target Down [point],
  Catastrophe [point]. Engravings: *Quickdraw*, *Longshot*.
- **Starcaller**: Doomfall [point] (meteor rain), Blaze Nova, Frost Lance (pierce, freeze), Starfire Explosion [point],
  Punishing Bolt [casting] ◆ (giant lightning), Seraphic Hail [point], Esoteric Rune [point], Lightning Vortex [holding],
  Inferno Wave [charge], Blink (teleport), Void Rift [point] (black hole pull), Frost Nova ★.
  Engravings: *Ignition*, *Wellspring*.
- **Songweaver**: Sound Shock, Harp of Rhythm (orbiting notes), Stigma (brand), Guardian Tune (party shield),
  Heavenly Tune (party atk), Rhapsody of Light [casting], Wind of Music (party speed + cleanse), Sonic Vibration [point] ◆,
  Prelude of Storm [holding], Rhythm Buckshot [combo], Soundholic [point], Tempest Chord [charge] ★.
  Engravings: *Last Refrain*, *Heart of Courage*.
- **Bladedancer**: Blitz Rush [charge] ↺, Spincutter, Maelstrom, Void Strike ◆, Death Trance (self haste), Moonlight Sonic,
  Soul Absorber ↺, Wind Cut [chain], Dark Order (thrown blades return), Upper Slash (launch) ★, Blade Dance [holding],
  Shadow Step (teleport behind) ↺. Engravings: *Afterglow*, *Stormsurge*.
- **Demonbound**: Demonic Slash, Ruining Rush, Cruel Cutter (thrown glaive), Blood Massacre, Grind Chain (pull),
  Thrust of Destruction ↑, Demolition (ground spikes) ◆, Soul Chain [holding], Blood Pillars [point], Howl (fear) ★,
  Leaping Blow [point], Demon Vision (haste). Demonform skills: Abyss Claw (Q), Rending Talons (W), Hellfire Wings (E),
  Demonic Slam (R). Engravings: *Unleashed*, *Restraint* (never transform, +dmg).

Tripods: tier 1 (skill lvl 4) generic utility — Quick Prep (−CD), Excellent Mobility, Weak Point Detection, Enhanced Strike,
Wide Reach, Stabilized Stance (super armor)…; tier 2 (lvl 7) behaviour mods (extra hits, bleed/burn/freeze/shock,
pull, piercing, faster cast); tier 3 (lvl 10) transformations (element change, new final hit, zone left behind).

## 5. Combat rules

- Isometric camera looking north; right-click (default) moves & holds to follow the cursor; skills aim at the cursor.
- QWER ASDF skills, Z/X identity, V awakening, Space dash (knocked down: Space = *Stand Up* with brief invulnerability),
  C basic attack (hold), 1–4 battle items, G interact, T mount, Alt-click ping.
- Skill types: normal, combo (press again), chain (next cast within window), holding (hold key), charge (hold,
  release in the gold zone for a *Perfect* bonus), casting (cast bar), point (ground target circle), toggle.
- Hit properties: stagger (low/mid/high/very high), weak point (part break), counter ★ (hits a boss's blue-glow
  windup → *COUNTER!* stun), super armor (push or paralysis immunity), back/head attack bonus.
- Statuses: knockdown, knock-up, push, stun, freeze, fear, sleep, silence, slow; burn, bleed, poison, shock.
- Numbers: white normal, yellow crit, big orange back/head attack tag, blue counter, green heal, cyan shield.
- Boss HP is shown as layered bars (*×145*) in cycling colours; a purple stagger bar appears for stagger checks.
- Death in raids: revive at the gate entrance or by a party member (Resurrection feather); limited revives.

## 6. Stats, gear, and progression

- Combat level 1–60. **Item level** (iLvl) gates content (see §7). Roster level (shared) gives small stat bonuses.
- Main stat *Might* → Attack Power. Combat stats: **Crit, Specialization, Swiftness, Domination, Endurance, Expertise**.
- Gear slots: weapon, head, shoulders, chest, pants, gloves · necklace, 2 earrings, 2 rings · ability stone · bracelet.
- Grades (colour): Common (#e8e8e8), Uncommon (#8bd96b), Rare (#4fa3ff), Epic (#b86bff), Legendary (#ffae3a),
  Relic (#ff6a2a), Ancient (#e9d2a6 gradient), Primal (#39e6d8).
- Sets: story gear (levels 1–50) → **Vanguard** (iLvl 1100, hone +0…+20 → 1300) → **Horned Tyrant** legion set
  (1340, hone +0…+25 → 1590) with 2/4/6-piece set bonuses.
- **Honing**: materials (Destruction Stones = weapon, Guardian Stones = armor, Leapstones, Fusion Materials, Shards,
  Silver, Gold). Rates fall from 100% (+1…+3) to 3% (+22…+25). Each failure adds +10% of base (max +100%) and fills
  **Artisan's Energy** (46.5% of the attempt's chance); 100% energy = guaranteed. Boosters: Solar Grace/Blessing/Protection.
- **Quality** 0–100 per gear piece (bar colour), re-rollable for silver at the blacksmith.
- **Engravings**: nodes from 2 equipped engraving books, accessories and the ability stone; 5/10/15 nodes = levels
  1/2/3; the dream is "5×3". ~24 combat engravings (Vendetta, Hexed Idol, Keen Edge, Adrenaline, Backstabber,
  Frontliner, Wind Captain, Spirit Absorption, Precise Blade, Super Charge, Barricade, Expert, Awakening, Master Brawler,
  Ether Predator, Crisis Evasion, Stabilized Status, All-Out Attack, Mana Flow, Heavy Armor, Sight Focus, Drops of Ether,
  Propulsion, Increase Mass) + negatives (Atk Power, Atk Speed, Defense, Move Speed Reduction).
- **Ability stone faceting**: 3 lines × 10 facets (2 positive engravings, 1 negative). Success starts at 75%, −10% on
  success, +10% on failure (25–75%). The famous "97 stone" is a shareable moment.
- **Gems**: *Ruinstone* (+dmg to one skill) and *Swiftstone* (−CD to one skill), levels 1–10, 3 → 1 fusion, 11 slots.
- **Cards**: collect, awaken with duplicates (0–5), 6-card deck, set bonuses by count and total awakening.
- **Skill points** from level + skill-point potions (collectible rewards); skills level 1–12; tripods unlock at 4/7/10.
- Accessories roll 1–2 stats + 2 engravings + 1 negative; bracelets roll random effects.
- **Powerpass**: a new character can jump to level 50 / iLvl 1340 with a Vanguard set (Lost Ark's powerpass).

## 7. Content

### World
- **Prologue: the Siege of Brighthold** — a burning castle at night, demon waves, cannons vs the siege behemoth
  *Ashmaw*, duel with **Varkhul**. You are briefly given awakened power (taste of endgame), then lose it.
- **Valemont** (continent 1): **Solhaven** (capital hub: blacksmith/honing, market, bank, guild hall, card & engraving
  vendor, PvP gate, harbour, triport, song teacher, stronghold ferry, rapport NPCs), **Goldmeadow** (farmland, lvl 1–25,
  wolves, boars, bandits), **Thornwood** (dark forest, lvl 25–40, spiders, treants, cultists), **Ashen Ridge**
  (demon-scorched highlands and fortress, lvl 40–50, demons; ends with Varkhul and the first Shard).
- **Pipsprout Hollow** — giant mushrooms and flowers; you are *shrunk* to Pip size on arrival.
- **The Glass Sea** — sailing between the continent, Pipsprout Hollow, the stronghold and 8 islands.
- **Stronghold: Brightwater Isle** — your personal island.

### Instanced PvE
| Content | Players | Gate | Notes |
|---|---|---|---|
| **Chaos Dungeon** (*Demon Rift*, *Crystal Hollow*) | 1–4 | 1100 / 1250 / 1400 / 1500 | 3 stages, % progress bar, elites, rift crystals, final boss |
| **Guardian Hunt: Rimewing** | 1–4 | 1100 | ice wyvern: breath cones, ice spikes, flight dive, frozen floor |
| **Guardian Hunt: Cinderhorn** | 1–4 | 1250 | lava-crusted rhino beast: charges, lava pools, burrow eruptions |
| **Guardian Hunt: Sandmaw** | 1–4 | 1370 | sand wurm: burrow & emerge, tail sweeps, sandstorm |
| **Guardian Hunt: Kurai the Pyrefox** | 1–4 | 1460 | nine-tailed fire fox: clones (counter the real one), fire orbs |
| **Abyssal Dungeon: The Sunken Oratory** | 4 | 1325 | Gate 1 *Nerissa of the Drowned Choir* (siren), Gate 2 *the Deep Oracle* |
| **Legion Raid: Gorrath, the Horned Tyrant** | 8 | NM 1415 / HM 1445 | Gate 1 *Skarn & Vesk* (twin hounds), Gate 2 *Gorrath* (counters, stagger check, orb puzzle, 8-wedge rift carve, horn breaking, ghost phase at ×30) |
| **Inferno Descent** | 1–4 | any (normalised) | roguelite: 100 floors of mixed encounters, boon choice every 5 floors |
| **Events** | open | — | hourly Field Boss (*Old Thunderhoof*), Chaos Gate at :30, Adventure Island every 2 h, Ghost Ship at sea |

### PvP
- **Proving Grounds**: 3v3 Deathmatch and Elimination vs AI (friends can fill teams), normalised stats, rank tiers
  Bronze → Grandmaster. Arena: *the Crucible*. Duels anywhere.

## 8. MMO layer

- **SimPlayers**: 40+ AI adventurers in Solhaven (titles, guild tags, pets, mounts), playing songs, fishing, selling,
  shouting in chat ("LF1 support Gorrath NM 1415+ know mechs", "+19 weapon failed 11 times", "where is the last pip seed
  in Thornwood"), listing in the Party Finder, joining your runs as AI raiders with personalities (tryhard, carry,
  clueless, AFK, the support who forgets to shield).
- **Party (4) / Raid (8)**, Party Finder, matchmaking with AI fill.
- **Guild**: join an AI guild or found one; donations, bloodstones, research, weekly missions, guild shop.
- **Market** (auction house with simulated supply/demand) and **Crystal exchange**; vendors; mail
  ("Please accept our compensation" gifts).
- **Rapport**: 8 NPCs; play songs, perform emotes, give gifts → Neutral → Amicable → Friendly → Trusted → Honored → Devoted.
- **Songs** (played on your instrument with procedural music): *Hymn of Homeward* (return to city), *Serenade of Tides*
  (summon your ship), *Lullaby of Rest*, *Ballad of Valor*, *Song of Sunrise* (rapport) · **Emotes** (20+).
- **Collectibles**: Pip Seeds (120+), Island Souls, Giant's Hearts, Masterpieces, Omnium Stars, Sea Bounties,
  World Tree Leaves, Vistas → reward tiers; **Adventure Tome** per region (bosses, NPCs, seeds, vistas, lore, cuisine).
- **Stronghold**: buildings (Workshop, Research Hall, Crew Barracks, Garden, Pet Ranch), research perks, crafting
  (battle items, fusion materials), crew dispatch missions on real-time timers, decorations.
- **Trade skills**: Foraging, Logging, Mining, Hunting, Fishing, Archaeology; Life Energy; minigames (fishing timing,
  archaeology dig meter); materials feed crafting and the market.
- **Sailing**: your ship *Dawnrunner* with crew, ship skills (Full Sail, Repair, Cannon Volley, Brace), durability,
  storms, sea bounties, ghost ships, islands with Island Souls.
- **Titles, mounts, pets** (pets auto-loot), **wardrobe & dyes**, **photo mode**.

## 9. Real multiplayer (carried over from Everdawn, adapted)

- **Host a World** → six-letter room code; up to 7 friends join (8 players). WebRTC via PeerJS, no servers.
- Friends appear in the city/fields, party up, and run any instance together; AI SimPlayers fill empty slots.
- Each browser is authoritative for its own hero (instant controls); the host owns enemies, bosses and loot rolls.
- Party chat, emotes, pings (Alt-click), duels, custom PvP between friends, raid bidding (gold) for special drops.
- Refresh-safe: a friend who reloads takes their slot back. Every character stays saved in its owner's browser.

## 10. Competition

- **Weekly Legion Race** (resets Wednesday 10:00 UTC): World First, Fastest Clear (NM/HM), Top DPS per class, Top
  Support, Deathless. **Daily Guardian Hunt**: today's guardian, fastest kill. **Inferno Descent**: deepest floor.
  **PvP** rating. Fun boards: best ability stone, luckiest honing, most Pip Seeds.
- Built-in **combat log / DPS meter** (per-skill breakdown, crit %, back-attack %, counters, stagger share).
- Share cards (canvas images) for clears, honing taps, stones, character profiles; challenge links.
- Global boards via Supabase when configured; otherwise local boards.

## 11. Look & feel

- **Art**: stylised-realistic high fantasy with heroic proportions (≈7.5 heads), readable silhouettes at iso distance,
  oversized weapons, gold-trimmed armour, capes. Rich ground detail (the camera mostly sees the ground): cobbles,
  grass tufts, flowers, debris, decals. Warm golden cities, lush fields, moody purple/blue dungeons, lava reds.
  Skills are the fireworks: bloom, trails, shockwaves, particles, ground scorch.
- **UI**: Lost Ark-like: dark translucent navy panels (#0b0f1a at 88%), thin light borders (#3a4560 / gold #c9a45a for
  headers), clean condensed sans (system fonts: "Segoe UI", Roboto, sans-serif; display: Cinzel-like via Georgia small
  caps), grade-coloured item frames with gradient backgrounds, square skill icons with key labels, big centred banners
  for mechanics ("The Horned Tyrant is enraged!").
- **Audio**: orchestral-ish procedural score (strings, brass, choir pads, timpani), sea shanty for sailing, whimsical
  woodwinds for Pips; layered punchy combat SFX.
