// Enemy templates. hp is × the content tier's reference attack power; atk is × the tier's reference hero HP
// (so atk 0.02 with coef 1 ≈ 2% of a hero's health before defence). Attacks run as small skills with windups.
const cone = (r, deg) => ({ shape: 'cone', r, angle: deg * Math.PI / 180 });
const circle = r => ({ shape: 'circle', r });
const rect = (len, width) => ({ shape: 'rect', len, width });

export const MOBS = {
  imp: { name: 'Abyssal Imp', model: 'imp', radius: 0.42, height: 1.05, hp: 14, atk: 0.018, speed: 4.8, aggro: 16, mass: 0.6, xp: 4,
    attacks: [{ id: 'claw', range: 1.5, cd: 1.5, windup: 0.4, dur: 0.8, anim: 'attack', hit: { ...cone(1.7, 110), coef: 1 } }] },
  hellhound: { name: 'Hellhound', model: 'hellhound', radius: 0.6, height: 1.2, hp: 22, atk: 0.024, speed: 6.2, aggro: 18, mass: 0.9, xp: 6,
    attacks: [{ id: 'bite', range: 1.8, cd: 1.8, windup: 0.35, dur: 0.8, anim: 'attack', hit: { ...cone(2.1, 90), coef: 1 } },
      { id: 'pounce', range: 6, minRange: 3, cd: 6, windup: 0.5, dur: 1.0, anim: 'attack_big', lunge: 4.5, hit: { ...circle(1.8), coef: 1.6, knock: 'down' }, tele: true }] },
  legionnaire: { name: 'Legion Spearman', model: 'legionnaire', radius: 0.6, height: 2.2, hp: 48, atk: 0.03, speed: 4.2, aggro: 16, mass: 1.6, xp: 10, poise: 30,
    attacks: [{ id: 'thrust', range: 2.6, cd: 2.2, windup: 0.55, dur: 1.1, anim: 'attack', hit: { ...rect(3.2, 1.4), coef: 1.2 } },
      { id: 'sweep', range: 2.4, cd: 5, windup: 0.8, dur: 1.4, anim: 'attack_big', hit: { ...circle(2.8), coef: 1.8, knock: 'push', kb: 2 }, tele: true }] },
  brute: { name: 'Abyssal Brute', model: 'brute', radius: 1.0, height: 3.0, hp: 260, atk: 0.06, speed: 3.6, aggro: 18, mass: 5, xp: 40, elite: true, superArmor: 1,
    attacks: [{ id: 'smash', range: 3.2, cd: 3.2, windup: 0.9, dur: 1.7, anim: 'attack_big', hit: { ...circle(3.2), coef: 1.4, knock: 'down', off: 2 }, tele: true },
      { id: 'swing', range: 3, cd: 2, windup: 0.6, dur: 1.2, anim: 'attack', hit: { ...cone(3.4, 140), coef: 1, knock: 'push', kb: 2.5 } }] },
  abyss_caster: { name: 'Abyss Invoker', model: 'abyss_caster', radius: 0.5, height: 2.0, hp: 30, atk: 0.028, speed: 3.6, aggro: 20, mass: 1, xp: 8, ranged: 9,
    attacks: [{ id: 'bolt', range: 11, cd: 2.6, windup: 0.6, dur: 1.1, anim: 'cast', proj: { speed: 13, range: 13, radius: 0.5, kind: 'dark_orb', color: 'purple', hit: { coef: 1.1 } } },
      { id: 'hex', range: 12, cd: 7, windup: 1.1, dur: 1.5, anim: 'cast', atTarget: true, hit: { ...circle(2.4), coef: 1.8 }, tele: true }] },
  gargoyle: { name: 'Gargoyle', model: 'gargoyle', radius: 0.7, height: 2.0, hp: 40, atk: 0.03, speed: 5.4, aggro: 18, mass: 1.4, xp: 9,
    attacks: [{ id: 'dive', range: 2.2, cd: 2.4, windup: 0.5, dur: 1.0, anim: 'attack', hit: { ...circle(2), coef: 1.2 } }] },
  skeleton: { name: 'Risen Skeleton', model: 'skeleton', radius: 0.45, height: 1.8, hp: 20, atk: 0.02, speed: 4.2, aggro: 14, mass: 0.8, xp: 5,
    attacks: [{ id: 'slash', range: 1.8, cd: 1.7, windup: 0.45, dur: 0.9, anim: 'attack', hit: { ...cone(2, 100), coef: 1 } }] },
  wolf: { name: 'Timber Wolf', model: 'wolf', radius: 0.55, height: 1.0, hp: 16, atk: 0.018, speed: 6.0, aggro: 12, mass: 0.8, xp: 5,
    attacks: [{ id: 'bite', range: 1.7, cd: 1.6, windup: 0.35, dur: 0.8, anim: 'attack', hit: { ...cone(1.9, 90), coef: 1 } }] },
  boar: { name: 'Bristleback Boar', model: 'boar', radius: 0.6, height: 1.0, hp: 20, atk: 0.02, speed: 5.0, aggro: 10, mass: 1.2, xp: 5,
    attacks: [{ id: 'gore', range: 1.8, cd: 2, windup: 0.45, dur: 0.9, anim: 'attack', hit: { ...cone(2, 80), coef: 1.1, knock: 'push', kb: 1.5 } }] },
  spider: { name: 'Thornwood Spider', model: 'spider', radius: 0.7, height: 1.0, hp: 26, atk: 0.022, speed: 5.2, aggro: 14, mass: 1, xp: 6,
    attacks: [{ id: 'bite', range: 1.8, cd: 1.7, windup: 0.4, dur: 0.9, anim: 'attack', hit: { ...cone(2, 90), coef: 1, status: [{ id: 'poison', dur: 4, power: 0.3 }] } }] },
  crystal_golem: { name: 'Crystal Golem', model: 'crystal_golem', radius: 0.9, height: 2.6, hp: 120, atk: 0.04, speed: 3.2, aggro: 14, mass: 4, xp: 20, elite: true, superArmor: 1,
    attacks: [{ id: 'slam', range: 2.6, cd: 3, windup: 0.8, dur: 1.5, anim: 'attack_big', hit: { ...circle(2.8), coef: 1.3, knock: 'down', off: 1.5 }, tele: true }] },
  wisp: { name: 'Rift Wisp', model: 'wisp', radius: 0.35, height: 1.4, hp: 10, atk: 0.016, speed: 5, aggro: 16, mass: 0.4, xp: 3, ranged: 7,
    attacks: [{ id: 'zap', range: 8, cd: 2.2, windup: 0.5, dur: 0.9, anim: 'cast', proj: { speed: 16, range: 10, radius: 0.4, kind: 'spark', color: 'cyan', hit: { coef: 1 } } }] },
};
