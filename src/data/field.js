// Open-world field data: zone configs (levels, music, what lives at each pack tag), residents at npc:* anchors,
// humanoid enemy templates (bandits, cultists…, rendered with hero NPC outfits), named elites, trade-skill yields,
// lore/vista ids, and fallback layouts used while a zone's real builder hasn't landed (bound to a plain arena).
//   FIELD_MOBS[type] follows the src/data/mobs.js template shape (+ npc outfit, sex, family, xp).
const cone = (r, deg) => ({ shape: 'cone', r, angle: deg * Math.PI / 180 });
const circle = r => ({ shape: 'circle', r });
const rect = (len, width) => ({ shape: 'rect', len, width });

// ------------------------------------------------------------------------------------------------ enemy templates
export const FIELD_MOBS = {
  bandit: { name: 'Redscarf Cutthroat', npc: 'bandit', family: 'humanoid', radius: 0.45, height: 1.85, hp: 18, atk: 0.02, speed: 4.6, aggro: 12, mass: 1, xp: 6,
    attacks: [{ id: 'cut', range: 1.8, cd: 1.7, windup: 0.4, dur: 0.85, anim: 'slash_h', hit: { ...cone(2.2, 110), coef: 1 } },
      { id: 'lunge', range: 5, minRange: 2.5, cd: 6, windup: 0.5, dur: 0.95, anim: 'thrust', lunge: 3.2, hit: { ...rect(2.6, 1.3), coef: 1.4 }, tele: true }] },
  bandit_slinger: { name: 'Redscarf Knife-Thrower', npc: 'bandit', family: 'humanoid', radius: 0.45, height: 1.85, hp: 13, atk: 0.018, speed: 4.4, aggro: 14, mass: 1, xp: 6, ranged: 7,
    attacks: [{ id: 'knives', range: 9, cd: 2.2, windup: 0.45, dur: 0.9, anim: 'throw', proj: { speed: 17, range: 11, radius: 0.35, kind: 'blade', color: 'silver', hit: { coef: 1 } } }] },
  bandit_brute: { name: 'Redscarf Bruiser', npc: 'bandit', family: 'humanoid', radius: 0.55, height: 2.0, hp: 60, atk: 0.03, speed: 4.0, aggro: 12, mass: 2.4, xp: 16, poise: 30, scale: 1.15,
    attacks: [{ id: 'smash', range: 2.2, cd: 3.4, windup: 0.8, dur: 1.4, anim: 'slam', hit: { ...circle(2.6), coef: 1.6, knock: 'down', off: 1 }, tele: true },
      { id: 'swing', range: 2, cd: 1.9, windup: 0.5, dur: 1.0, anim: 'slash_h', hit: { ...cone(2.4, 130), coef: 1.1, knock: 'push', kb: 1.5 } }] },
  cultist: { name: 'Thorn Cultist', npc: 'cultist', family: 'humanoid', radius: 0.45, height: 1.85, hp: 16, atk: 0.02, speed: 4.2, aggro: 14, mass: 1, xp: 6, ranged: 8,
    attacks: [{ id: 'bolt', range: 10, cd: 2.5, windup: 0.6, dur: 1.1, anim: 'cast', proj: { speed: 12, range: 12, radius: 0.45, kind: 'dark_orb', color: 'purple', hit: { coef: 1.1 } } },
      { id: 'thorns', range: 11, cd: 8, windup: 1.0, dur: 1.4, anim: 'cast_ground', atTarget: true, hit: { ...circle(2.2), coef: 1.6, status: [{ id: 'bleed', dur: 4, power: 0.2 }] }, tele: true }] },
  cultist_zealot: { name: 'Thorn Zealot', npc: 'cultist', family: 'humanoid', radius: 0.45, height: 1.85, hp: 24, atk: 0.024, speed: 4.8, aggro: 14, mass: 1.2, xp: 8,
    attacks: [{ id: 'slash', range: 1.8, cd: 1.6, windup: 0.4, dur: 0.85, anim: 'slash_v', hit: { ...cone(2.2, 90), coef: 1.1 } },
      { id: 'frenzy', range: 2.4, cd: 7, windup: 0.6, dur: 1.3, anim: 'spin', hit: { ...circle(2.8), coef: 1.8, knock: 'push', kb: 2 }, tele: true }] },
  // named foes (spawned by quests / as elites)
  rusk: { name: 'Rusk the Gentleman', npc: 'bandit', family: 'humanoid', radius: 0.5, height: 1.9, hp: 150, atk: 0.034, speed: 5.2, aggro: 16, mass: 4, xp: 60, poise: 60, superArmor: 1, scale: 1.1,
    attacks: [{ id: 'flourish', range: 2.2, cd: 2.2, windup: 0.45, dur: 0.95, anim: 'slash_x', hit: { ...cone(2.8, 140), coef: 1.2 } },
      { id: 'riposte', range: 6, minRange: 2.4, cd: 5.5, windup: 0.55, dur: 1.0, anim: 'dash_strike', lunge: 4.5, hit: { ...rect(3, 1.4), coef: 1.8, knock: 'push', kb: 2 }, tele: true },
      { id: 'dirty_trick', range: 3, cd: 9, windup: 0.8, dur: 1.2, anim: 'throw', hit: { ...circle(3.2), coef: 1, status: [{ id: 'stun', dur: 1.2 }] }, tele: true }] },
  blightroot: { name: 'The Blightroot', model: 'treant', family: 'plant', radius: 1.3, height: 4.2, hp: 420, atk: 0.05, speed: 2.6, aggro: 18, mass: 8, xp: 120, poise: 120, superArmor: 1, scale: 1.1,
    attacks: [{ id: 'slam', range: 3.4, cd: 3.2, windup: 1.0, dur: 1.8, anim: 'attack_big', hit: { ...circle(3.6), coef: 1.6, knock: 'down', off: 2 }, tele: true },
      { id: 'sweep', range: 3.2, cd: 2.4, windup: 0.6, dur: 1.2, anim: 'attack', hit: { ...cone(4, 150), coef: 1.1, knock: 'push', kb: 2.5 } },
      { id: 'roots', range: 14, cd: 7, windup: 1.2, dur: 1.6, anim: 'cast', atTarget: true, hit: { ...circle(2.6), coef: 1.8, status: [{ id: 'slow', dur: 3 }] }, tele: true }] },
  grizzlefang: { name: 'Old Grizzlefang', model: 'wolf', family: 'beast', radius: 0.9, height: 1.6, hp: 170, atk: 0.034, speed: 6.4, aggro: 16, mass: 3, xp: 60, poise: 50, superArmor: 1, scale: 1.7,
    attacks: [{ id: 'maul', range: 2.2, cd: 1.8, windup: 0.4, dur: 0.9, anim: 'attack', hit: { ...cone(2.8, 100), coef: 1.3 } },
      { id: 'pounce', range: 8, minRange: 3, cd: 6, windup: 0.6, dur: 1.1, anim: 'attack_big', lunge: 5.5, hit: { ...circle(2.4), coef: 1.8, knock: 'down' }, tele: true },
      { id: 'howl', range: 5, cd: 12, windup: 0.9, dur: 1.4, anim: 'roar', hit: { ...circle(5), coef: 0.6, status: [{ id: 'fear', dur: 1.2 }] }, tele: true }] },
  broodmother: { name: 'The Broodmother', model: 'spider', family: 'beast', radius: 1.3, height: 1.8, hp: 220, atk: 0.036, speed: 4.4, aggro: 16, mass: 6, xp: 80, poise: 80, superArmor: 1, scale: 2.0,
    attacks: [{ id: 'fangs', range: 2.6, cd: 1.9, windup: 0.5, dur: 1.0, anim: 'attack', hit: { ...cone(3.2, 100), coef: 1.3, status: [{ id: 'poison', dur: 5, power: 0.3 }] } },
      { id: 'web', range: 12, cd: 7, windup: 0.9, dur: 1.3, anim: 'spit', atTarget: true, hit: { ...circle(3), coef: 1.2, status: [{ id: 'slow', dur: 3 }] }, tele: true }] },
  hollow_knight: { name: 'Sir Aldric, the Hollow Knight', model: 'skeleton', family: 'undead', radius: 0.6, height: 2.2, hp: 190, atk: 0.036, speed: 4.2, aggro: 14, mass: 3, xp: 70, poise: 70, superArmor: 1, scale: 1.3,
    attacks: [{ id: 'cleave', range: 2.3, cd: 2, windup: 0.55, dur: 1.1, anim: 'attack', hit: { ...cone(2.8, 130), coef: 1.3 } },
      { id: 'judgement', range: 3, cd: 7, windup: 1.0, dur: 1.6, anim: 'attack_big', hit: { ...circle(3.4), coef: 2, knock: 'down' }, tele: true }] },
  big_beetle: { name: 'The Very Large Beetle', model: 'crab', family: 'beast', radius: 1.2, height: 1.6, hp: 200, atk: 0.03, speed: 3.8, aggro: 14, mass: 6, xp: 60, poise: 80, superArmor: 1, scale: 2.2,
    attacks: [{ id: 'pinch', range: 2.4, cd: 1.8, windup: 0.5, dur: 1.0, anim: 'attack', hit: { ...cone(3, 90), coef: 1.2 } },
      { id: 'roll', range: 10, minRange: 3, cd: 6, windup: 0.8, dur: 1.2, anim: 'attack_big', lunge: 6, hit: { ...rect(4, 2.4), coef: 1.6, knock: 'down' }, tele: true }] },
  ash_warlord: { name: 'Skorn Ashbrand', npc: 'cultist', family: 'demon', radius: 0.6, height: 2.1, hp: 240, atk: 0.04, speed: 4.6, aggro: 16, mass: 5, xp: 90, poise: 90, superArmor: 1, scale: 1.2,
    attacks: [{ id: 'brand', range: 2.4, cd: 2.2, windup: 0.5, dur: 1.0, anim: 'slash_v', hit: { ...cone(2.8, 110), coef: 1.3, status: [{ id: 'burn', dur: 4, power: 0.25 }] } },
      { id: 'eruption', range: 12, cd: 7, windup: 1.1, dur: 1.5, anim: 'cast_ground', atTarget: true, hit: { ...circle(3), coef: 2, knock: 'up' }, tele: true }] },
  demon_totem: { name: 'Legion Spawning Totem', model: 'gargoyle', family: 'construct', radius: 0.8, height: 2.4, hp: 40, atk: 0, speed: 0, aggro: 0, mass: 1e3, xp: 10, attacks: [], immobile: true },
};

// what spawns at a pack:* anchor, by its tag (weights). Unknown tags fall back to the zone's `defaultPack`.
export const PACK_TAGS = {
  wolves: [['wolf', 1]], wolf: [['wolf', 1]],
  boars: [['boar', 1]], boar: [['boar', 1]],
  bandits: [['bandit', 5], ['bandit_slinger', 3], ['bandit_brute', 1]], bandit: [['bandit', 5], ['bandit_slinger', 3], ['bandit_brute', 1]],
  spiders: [['spider', 1]], spider: [['spider', 1]],
  cultists: [['cultist', 4], ['cultist_zealot', 3]], cultist: [['cultist', 4], ['cultist_zealot', 3]],
  treant: [['wisp', 3], ['spider', 1]], treants: [['wisp', 3], ['spider', 1]], wisps: [['wisp', 1]],
  skeletons: [['skeleton', 1]], undead: [['skeleton', 3], ['wisp', 1]],
  demons: [['imp', 5], ['hellhound', 3], ['legionnaire', 2], ['abyss_caster', 1]], imps: [['imp', 1]], hounds: [['hellhound', 1]], hellhounds: [['hellhound', 1]],
  legion: [['legionnaire', 3], ['abyss_caster', 1]], gargoyles: [['gargoyle', 1]], casters: [['abyss_caster', 1]],
  crabs: [['crab', 1]], beetles: [['crab', 1]], critters: [['crab', 2], ['spider', 1]],
};
// family of built-in mob types (for kill steps that ask for "beasts" or "demons")
export const FAMILY = { imp: 'demon', hellhound: 'demon', legionnaire: 'demon', brute: 'demon', abyss_caster: 'demon', gargoyle: 'demon', skeleton: 'undead', wolf: 'beast', boar: 'beast', spider: 'beast', crab: 'beast', treant: 'plant', crystal_golem: 'construct', wisp: 'spirit' };

// ------------------------------------------------------------------------------------------------ zones
// levels: [min, max] — mobs are scaled to the hero's level clamped into this range (+0..2 per pack, elites +2).
export const FIELDS = {
  goldmeadow: { name: 'Goldmeadow', region: 'Valemont', levels: [5, 25], music: 'field', ambience: 'meadow', defaultPack: 'wolves', tome: 'goldmeadow',
    elites: [{ tag: 'wolves', type: 'grizzlefang', name: 'Old Grizzlefang' }, { tag: 'bandits', type: 'bandit_brute', name: 'Big Maggie Redscarf', hpMul: 0.6 }, { tag: 'boars', type: 'boar', name: 'Sir Snortington', hpMul: 1.5, scale: 1.6 }, { tag: 'wolves', type: 'wolf', name: 'Ashfur the Pack-Mother', hpMul: 2, scale: 1.4 }],
    lore: ['lore:harvest', 'lore:windmill'], vistas: ['vista:windmill', 'vista:sunflower'] },
  thornwood: { name: 'Thornwood', region: 'Valemont', levels: [25, 40], music: 'field_dark', ambience: 'forest', defaultPack: 'spiders', tome: 'thornwood',
    elites: [{ tag: 'spiders', type: 'broodmother', name: 'The Broodmother' }, { tag: 'undead', type: 'hollow_knight', name: 'Sir Aldric, the Hollow Knight' }, { tag: 'cultists', type: 'cultist_zealot', name: 'High Zealot Morga', hpMul: 1.5, scale: 1.2 }],
    lore: ['lore:thorn_cult', 'lore:treants', 'lore:spiders'], vistas: ['vista:moonpool', 'vista:giant_tree'] },
  ashen_ridge: { name: 'Ashen Ridge', region: 'Valemont', levels: [40, 50], music: 'field_dark', ambience: 'lava', defaultPack: 'demons', tome: 'ashen_ridge',
    elites: [{ tag: 'demons', type: 'ash_warlord', name: 'Skorn Ashbrand' }, { tag: 'legion', type: 'brute', name: 'Gorehide the Breaker', hpMul: 0.6 }, { tag: 'gargoyles', type: 'gargoyle', name: 'Old Stoneclaw', hpMul: 1, scale: 1.5 }],
    lore: ['lore:sundering', 'lore:legion', 'lore:brighthold'], vistas: ['vista:lava_falls', 'vista:fortress'] },
  pipsprout: { name: 'Pipsprout Hollow', region: 'Glass Sea', levels: [15, 50], music: 'pip', ambience: 'meadow', defaultPack: 'imps', tome: 'pipsprout', shrink: 0.35,
    elites: [{ tag: 'critters', type: 'big_beetle', name: 'The Very Large Beetle' }, { tag: 'imps', type: 'imp', name: 'Sootling Boss Grubnik', hpMul: 2.5, scale: 1.3 }],
    lore: ['lore:pip_seeds', 'lore:shrinking'], vistas: ['vista:mushroom', 'vista:petal'] },
  solhaven: { name: 'Solhaven', lore: ['lore:founding', 'lore:seven_lights', 'lore:harbor'], vistas: ['vista:lighthouse', 'vista:cathedral'], tome: 'solhaven' },
};
/** neighbouring zones: which gate:* leads where (used to route objectives across zones) */
export const ROUTES = { solhaven: ['goldmeadow'], goldmeadow: ['solhaven', 'thornwood', 'pipsprout'], thornwood: ['goldmeadow', 'ashen_ridge'], ashen_ridge: ['thornwood'], pipsprout: ['goldmeadow'] };
/** anchors that stand in for a missing gate:<to> anchor */
export const GATE_FALLBACK = { 'goldmeadow>pipsprout': ['poi:mushroom_ring', 'poi:pip_ring', 'poi:hermit'], 'pipsprout>goldmeadow': ['gate:solhaven', 'spawn'] };

// ------------------------------------------------------------------------------------------------ residents
// Field residents stand at npc:* anchors. `at` lists the anchors they prefer (first match); residents without a match
// take the zone's remaining npc:* anchors in order; anchors nobody claims get a generic local.
const R = (id, name, title, o) => ({ id, name, title, sex: 'm', lines: [], ...o });
export const FIELD_NPCS = {
  goldmeadow: [
    R('farmer_hale', 'Gideon Hale', 'Farmer of Goldmeadow', { npc: 'farmer', at: ['npc:farmer_hale', 'npc:farmer'], lines: ['My brother fights demons. I fight weeds. Guess which of us wins more.', 'The wheat’s never been this tall. Or this nervous.'] }),
    R('miller', 'Mirabel Thresh', 'The Miller', { npc: 'villager', sex: 'f', at: ['npc:miller'], lines: ['Flour in my hair, flour in my tea. Flour is a lifestyle.', 'The mill turns backwards at night. I am NOT imagining it.'] }),
    R('captain', 'Captain Rowan Marsh', 'Goldmeadow Watch', { npc: 'guard', at: ['npc:captain', 'npc:guard'], lines: ['Six guards, forty farms, one road. I sleep standing up.', 'If it wears a red scarf, it’s a bandit. If it’s wearing two, it’s their boss.'] }),
    R('innkeeper', 'Bertha Oakbarrel', 'The Sleepy Sheaf Inn', { npc: 'villager', sex: 'f', at: ['npc:innkeeper', 'npc:inn'], lines: ['Pie’s hot, beds are cold, gossip is free.', 'You look like somebody who needs a bath. And a pie. Pie first.'] }),
    R('hunter', 'Fenn Greyfletch', 'Hunter of the Meadow', { npc: 'villager', at: ['npc:hunter'], lines: ['Wolves are smart. Smarter than the bandits, anyway.', 'Walk soft. The grass talks.'] }),
    R('child', 'Tilly Hale', 'Gideon’s Daughter', { npc: 'child', sex: 'f', at: ['npc:child'], lines: ['Are you a real hero? Can you lift a cow? Uncle Brannoc can lift a cow.', 'I’m not allowed past the fence. The fence is very boring.'] }),
    R('hermit', 'Old Tom of the Hill', 'The Hermit', { npc: 'villager', at: ['npc:hermit'], lines: ['Little green folk come to my garden at night. They leave the carrots. They take the hats.'] }),
    R('merchant', 'Pedlar Wick', 'Travelling Goods', { npc: 'merchant', action: 'shop:general', at: ['npc:merchant'], lines: ['Potions! Grenades! A slightly haunted spoon! Everything must go!'] }),
    R('beekeeper', 'Honeysuckle Nell', 'Beekeeper of the Orchard', { npc: 'farmer', sex: 'f', at: ['npc:beekeeper'], lines: ['The bees are cross today. Something big has been shaking the trees at night.'] }),
    R('guard', 'Watchman Pell Dunley', 'Sheafton Watch', { npc: 'guard', at: ['npc:guard'], lines: ['East road to Solhaven, north road to Thornwood. Don’t take the north road.'] }),
    R('shrinekeeper', 'Sister Aubade', 'Keeper of the Dawn Shrine', { npc: 'priest', sex: 'f', at: ['npc:shrinekeeper', 'npc:priest'], lines: ['The Dawn Light still answers here, faintly. Like someone humming in the next room.'] }),
  ],
  thornwood: [
    R('warden', 'Warden Sylva Thornwick', 'Keeper of the Thornwood', { npc: 'guard', sex: 'f', at: ['npc:warden', 'npc:ranger', 'npc:captain'], lines: ['Stay on the path. The path is the only thing here that doesn’t want to eat you.', 'The forest is sick. You can smell it.'] }),
    R('monk', 'Brother Aldous', 'Last Monk of the Abbey', { npc: 'priest', at: ['npc:monk', 'npc:brother', 'npc:priest', 'npc:abbey'], lines: ['Seven lights, seven candles. I keep them lit. Someone must.', 'The abbey was a place of song. Now only crows sing, and badly.'] }),
    R('herbalist', 'Nan Wicket', 'Herbalist of the Crooked Hut', { npc: 'villager', sex: 'f', at: ['npc:herbalist', 'npc:witch', 'npc:healer'], lines: ['Mushroom tea cures everything. Except mushroom poisoning.', 'I’m not a witch, dear. Witches have better hats.'] }),
    R('cult_defector', 'Morrow', 'A Nervous Cultist', { npc: 'cultist', at: ['npc:cult_defector', 'npc:defector', 'npc:cultist'], lines: ['I joined for the robes. The robes were a lie.', 'Please don’t tell them I’m here. Or anyone. Or me.'] }),
    R('woodcutter', 'Old Woodcutter Bex', 'Woodcutter', { npc: 'farmer', sex: 'f', at: ['npc:woodcutter', 'npc:logger'], lines: ['The trees here chop back.', 'Forty years of logging and I still say sorry to every oak.'] }),
    R('owl_sage', 'Hoot the Owl Sage', 'Scholar (Allegedly)', { npc: 'bard', at: ['npc:owl_sage', 'npc:owl', 'npc:sage'], lines: ['Whooo? Me. I’m the sage. It’s on the sign.', 'Wisdom is mostly knowing when to be quiet. Which I rarely am.'] }),
  ],
  ashen_ridge: [
    R('captain', 'Captain Darra Flint', 'Valemont Vanguard', { npc: 'knight', sex: 'f', at: ['npc:captain', 'npc:commander'], lines: ['We hold this ridge or we hold nothing.', 'The ash gets in everything. My boots. My tea. My soul.'] }),
    R('quartermaster', 'Quartermaster Pell', 'Vanguard Supplies', { npc: 'merchant', at: ['npc:quartermaster', 'npc:merchant', 'npc:supply'], lines: ['I have eleven crates of bandages and zero crates of patience.', 'Sign here. And here. And here. War is mostly paperwork.'] }),
    R('scout_ivy', 'Scout Ivy', 'Vanguard Pathfinder', { npc: 'villager', sex: 'f', at: ['npc:scout_ivy', 'npc:scout'], lines: ['I’ve counted the demons on the wall. Twice. Stopped counting after that.'] }),
    R('refugee', 'Brighthold Refugee', 'Survivor', { npc: 'villager', at: ['npc:refugee'], lines: ['I saw Brighthold burn from the hills. I keep seeing it.'] }),
    R('smith_ghost', 'The Ghost Smith', 'Echo of the Forge', { npc: 'blacksmith', at: ['npc:smith_ghost', 'npc:ghost', 'npc:smith'], lines: ['…clang… …clang… (the hammer passes straight through the anvil.)'] }),
    R('medic', 'Sister Maribel', 'Field Medic', { npc: 'priest', sex: 'f', at: ['npc:medic', 'npc:healer', 'npc:priest'], lines: ['Hold still. This will hurt. That’s how you know it’s working.'] }),
  ],
  pipsprout: [
    R('bramblebeard', 'Elder Bramblebeard', 'Elder of Pipsprout Hollow', { creature: 'pip', variant: 'elder', portrait: 'bramblebeard', at: ['npc:bramblebeard', 'npc:elder'], lines: ['Mind the dewdrops, small-one.', 'Long ago, the sky broke. We Pips caught what fell. Some of it, anyway.'] }),
    R('captain_acorn', 'Captain Acorn', 'Guard of the Acorn Gate', { creature: 'pip', variant: 'guard', at: ['npc:captain_acorn', 'npc:guard', 'npc:pip1'], lines: ['Pip! PIP! (He salutes with his whole body.)', 'Pip-pip. (He is very serious about the gate.)'] }),
    R('puddlebutton', 'Mayor Puddlebutton', 'Mayor of the Hollow', { creature: 'pip', variant: 'merchant', at: ['npc:puddlebutton', 'npc:mayor', 'npc:merchant', 'npc:pip2'], lines: ['Pip pip pip! (A speech. A long one. There is a lot of bowing.)'] }),
    R('mossy_gran', 'Mossy Gran', 'Keeper of the Roots', { creature: 'pip', variant: 'farmer', at: ['npc:mossy_gran', 'npc:gran', 'npc:farmer', 'npc:pip3'], lines: ['Pip… pip. (She pats your hand. Her hands are very small.)'] }),
    R('tadpole', 'Tadpole', 'Pip Child', { creature: 'pip', variant: 'child', at: ['npc:tadpole', 'npc:child', 'npc:pip4'], lines: ['PIP! (Tadpole runs a circle around you. Then another.)'] }),
    R('nib', 'Nib', 'Pip Trader', { creature: 'pip', variant: 'merchant', at: ['npc:nib', 'npc:trader', 'npc:pip5'], lines: ['Pip? (Nib offers you a button in exchange for… everything you own.)'] }),
  ],
};
/** generic locals for unclaimed npc:* anchors */
export const GENERIC_NPC = {
  goldmeadow: [{ name: 'Farmhand', npc: 'farmer', lines: ['Hot day. Good day. Too many wolves.'] }, { name: 'Travelling Tinker', npc: 'merchant', lines: ['Pots! Pans! Slightly used spoons!'] }],
  thornwood: [{ name: 'Lost Traveller', npc: 'villager', lines: ['Which way is out? Every tree looks like the last tree.'] }],
  ashen_ridge: [{ name: 'Vanguard Soldier', npc: 'guard', lines: ['Hold the line. Whatever the line is today.'] }],
  pipsprout: [{ name: 'Pip', creature: 'pip', variant: 'sprout', lines: ['Pip! (It waves with both arms.)'] }],
};

// ------------------------------------------------------------------------------------------------ trade-skill nodes
// what a node looks like and yields when the systems lifeskills module is missing
export const NODES = {
  forage: { label: 'Gather', anim: 'gather', dur: 1.6, color: 0x9ae06a, yield: [['herb', 3, 6], ['flower', 1, 2, 0.3]], name: 'Wild Herbs' },
  log: { label: 'Chop', anim: 'chop', dur: 2.0, color: 0xc89a5a, yield: [['timber', 3, 6], ['resin', 1, 2, 0.25]], name: 'Felled Log' },
  mine: { label: 'Mine', anim: 'mine', dur: 2.0, color: 0x9ab0d0, yield: [['ore', 3, 6], ['gem_ore', 1, 2, 0.25]], name: 'Ore Vein' },
  hunt: { label: 'Hunt', anim: 'throw', dur: 1.6, color: 0xd08a5a, yield: [['meat', 3, 6], ['hide', 1, 2, 0.25]], name: 'Animal Tracks' },
  fish: { label: 'Fish', anim: 'fish_cast', dur: 2.6, color: 0x6ac0ff, yield: [['fish', 2, 5], ['clam', 1, 2, 0.25]], name: 'Fishing Spot' },
  dig: { label: 'Excavate', anim: 'dig', dur: 2.4, color: 0xd8c08a, yield: [['relic_shard', 2, 5], ['buried_coin', 1, 2, 0.25]], name: 'Dig Site' },
};

// ------------------------------------------------------------------------------------------------ fallback layouts
// Used only when a zone has no real builder yet (the game then loads a plain 70×70 m arena): every anchor the story
// needs, laid out inside ±30 m so the content stays playable. Real zones replace all of this automatically.
const A = (x, z, f = 0, extra = null) => ({ x, z, facing: f, ...(extra || {}) });
export const FALLBACK_LAYOUT = {
  goldmeadow: {
    spawn: A(-26, 26, 0), 'gate:solhaven': A(-30, 30, Math.PI * 0.75), 'gate:thornwood': A(30, -30, -Math.PI / 4), 'gate:pipsprout': A(-28, -28, Math.PI / 4), 'triport:goldmeadow': A(-20, 22),
    'npc:farmer_hale': A(-14, 20, 0), 'npc:child': A(-11, 22, 0), 'npc:miller': A(4, 22, 0), 'npc:captain': A(-24, 10, Math.PI / 2), 'npc:innkeeper': A(-20, 14, 0), 'npc:hunter': A(12, 12, 0), 'npc:hermit': A(-24, -22, 0),
    'poi:farm': A(-14, 16), 'poi:windmill': A(8, 26), 'poi:bandit_camp': A(22, -8), 'poi:wolf_den': A(24, 18), 'poi:mushroom_ring': A(-28, -28), 'poi:scarecrows': A(-4, 12), 'poi:inn': A(-20, 12),
    'pack:1': A(20, 20, 0, { r: 5, tag: 'wolves' }), 'pack:2': A(10, 4, 0, { r: 5, tag: 'boars' }), 'pack:3': A(22, -12, 0, { r: 6, tag: 'bandits' }), 'pack:4': A(12, -20, 0, { r: 6, tag: 'bandits' }), 'pack:5': A(-6, -10, 0, { r: 5, tag: 'wolves' }), 'pack:6': A(-18, -8, 0, { r: 5, tag: 'boars' }),
    'elite:1': A(26, -20), 'elite:2': A(26, 26),
    'node:forage:1': A(-8, 26), 'node:log:1': A(-28, 4), 'node:mine:1': A(28, 4), 'node:dig:1': A(0, -26), 'node:hunt:1': A(16, 26), 'node:fish:1': A(-2, 0),
    'seed:1': A(9, 28.5), 'seed:2': A(-29, -12), 'seed:3': A(29, -2), 'seed:4': A(-4, -29),
    'lore:1': A(-18, 12), 'lore:2': A(6, 20), 'vista:1': A(10, 30), 'vista:2': A(-2, -18),
  },
  thornwood: {
    spawn: A(-26, 26, 0), 'gate:goldmeadow': A(-30, 30, Math.PI * 0.75), 'gate:ashen_ridge': A(30, -30, -Math.PI / 4), 'triport:thornwood': A(-20, 22),
    'npc:warden': A(-16, 20, 0), 'npc:woodcutter': A(-22, 12, 0), 'npc:owl_sage': A(-10, 26, 0), 'npc:herbalist': A(16, 22, 0), 'npc:monk': A(4, -16, 0), 'npc:cult_defector': A(-24, -6, Math.PI / 2),
    'poi:abbey': A(4, -20), 'poi:cult_circle': A(22, -6), 'poi:spider_hollow': A(18, 14), 'poi:treant_grove': A(-16, -20),
    'pack:1': A(18, 14, 0, { r: 5, tag: 'spiders' }), 'pack:2': A(8, 6, 0, { r: 5, tag: 'spiders' }), 'pack:3': A(22, -6, 0, { r: 6, tag: 'cultists' }), 'pack:4': A(12, -12, 0, { r: 6, tag: 'cultists' }), 'pack:5': A(-6, -8, 0, { r: 5, tag: 'undead' }), 'pack:6': A(-18, -14, 0, { r: 5, tag: 'treant' }),
    'elite:1': A(26, 22), 'elite:2': A(8, -26),
    'node:forage:1': A(-4, 22), 'node:log:1': A(-28, 0), 'node:hunt:1': A(26, 6),
    'seed:1': A(-29, -20), 'seed:2': A(29, 10), 'seed:3': A(0, -29),
    'lore:1': A(0, -20), 'lore:2': A(-18, -22), 'lore:3': A(20, -2), 'vista:1': A(-8, 30),
  },
  ashen_ridge: {
    spawn: A(-26, 26, 0), 'gate:thornwood': A(-30, 30, Math.PI * 0.75), 'triport:ashen_ridge': A(-20, 22),
    'npc:captain': A(-14, 20, 0), 'npc:quartermaster': A(-20, 14, 0), 'npc:scout_ivy': A(-8, 16, 0), 'npc:refugee': A(-24, 18, 0), 'npc:medic': A(-10, 22, 0), 'npc:smith_ghost': A(20, 24, 0),
    'poi:camp': A(-16, 18), 'poi:fortress_gate': A(0, -12), 'poi:tower1': A(26, 10), 'poi:tower2': A(-26, -4), 'poi:tower3': A(18, -22), duel: A(0, -22, 0), boss: A(0, -28, 0),
    'pack:1': A(14, 16, 0, { r: 6, tag: 'demons' }), 'pack:2': A(4, 6, 0, { r: 6, tag: 'imps' }), 'pack:3': A(22, 0, 0, { r: 6, tag: 'hounds' }), 'pack:4': A(-18, -4, 0, { r: 6, tag: 'legion' }), 'pack:5': A(-10, -18, 0, { r: 5, tag: 'gargoyles' }), 'pack:6': A(12, -16, 0, { r: 6, tag: 'demons' }),
    'elite:1': A(26, -26), 'elite:2': A(-26, -26),
    'node:mine:1': A(28, 22), 'node:dig:1': A(-28, 6),
    'seed:1': A(29, 29), 'seed:2': A(-29, -14), 'seed:3': A(8, 29),
    'lore:1': A(-4, 24), 'lore:2': A(24, -12), 'lore:3': A(-20, -26), 'vista:1': A(-28, -28),
  },
  pipsprout: {
    spawn: A(-24, 24, 0), 'gate:goldmeadow': A(-29, 29, Math.PI * 0.75), 'triport:pipsprout': A(-18, 22),
    'npc:bramblebeard': A(-6, 6, 0), 'npc:captain_acorn': A(8, -4, 0), 'npc:puddlebutton': A(-12, 0, 0), 'npc:mossy_gran': A(4, 14, 0), 'npc:tadpole': A(-2, 12, 0), 'npc:nib': A(-14, 8, 0),
    'poi:acorn_gate': A(10, -10), 'poi:seed_vault': A(-2, -18), 'poi:dewdrop_pond': A(16, 16), 'poi:garden': A(6, 20), 'poi:hide1': A(24, 24), 'poi:hide2': A(-26, -8), 'poi:hide3': A(22, -24),
    'pack:1': A(18, -14, 0, { r: 5, tag: 'imps' }), 'pack:2': A(4, -24, 0, { r: 5, tag: 'imps' }), 'pack:3': A(22, 4, 0, { r: 5, tag: 'critters' }), 'pack:4': A(-20, -18, 0, { r: 5, tag: 'imps' }),
    'elite:1': A(-24, -26),
    'node:forage:1': A(12, 26), 'node:forage:2': A(-26, 14),
    'seed:1': A(28, 12), 'seed:2': A(-10, -28), 'seed:3': A(26, -6), 'seed:4': A(-28, 2),
    'lore:1': A(-8, 2), 'lore:2': A(14, 8), 'vista:1': A(0, 28),
  },
  brighthold: {
    spawn: A(0, 28, 0), 'poi:start': A(0, 26), 'poi:lower_town': A(-4, 16), 'poi:gate': A(0, 8), 'poi:courtyard': A(0, -2), 'poi:ramparts': A(-10, -10), 'poi:harbor': A(24, 24), 'poi:sallyport': A(24, 24),
    'cannon:1': A(-20, -14, 0), 'cannon:2': A(-10, -16, 0), 'cannon:3': A(10, -16, 0), 'cannon:4': A(20, -14, 0),
    breach: A(0, -26, 0), duel: A(0, -10, 0),
  },
};
