// REAVER — greatsword warrior (DPS). Identity: Bloodlust → Burst Mode (Z), Crimson Finale (Z during Burst).
import { A, H, FX, S, K, M, P, Z, B, circle, cone, rect, hits } from '../../game/skills/dsl.js';

const RED = 'crimson';
export default {
  id: 'reaver', name: 'Reaver', archetype: 'Warrior', role: 'dps', weapon: 'greatsword', difficulty: 2,
  blurb: 'A berserker who swings a sword taller than most men. Bloodlust builds with every hit until the Reaver erupts into Burst Mode and ends it with a crimson finale.',
  palette: { main: 0xc81e1e, glow: [4, 0.5, 0.35] },
  dash: { cd: 9, dist: 5.2, dur: 0.28 },
  stats: { hp: 1.15, atk: 1.0, def: 1.1 },
  basic: [
    { anim: 'atk1', dur: 0.42, hit: { t: 0.18, ...cone(2.8, 120), coef: 1.1, stagger: 2 }, fx: { t: 0.18, preset: 'slash', color: RED, r: 2.8, arc: 120 } },
    { anim: 'atk2', dur: 0.44, hit: { t: 0.2, ...cone(2.8, 130), coef: 1.2, stagger: 2 }, fx: { t: 0.2, preset: 'slash', color: RED, r: 2.8, arc: 130, flip: true } },
    { anim: 'atk3', dur: 0.62, hit: { t: 0.32, ...circle(3.0), coef: 1.8, stagger: 4, knock: 'push', kb: 1.5 }, fx: { t: 0.32, preset: 'slash', color: RED, r: 3, arc: 360 } },
  ],
  identity: {
    kind: 'gauge', label: 'Bloodlust', max: 100,
    gainPerHit: 2.6, gainBasic: 1.4,
    burst: { dur: 25, mods: { atkSpd: 0.2, moveSpd: 0.2, crit: 0.3 } },
    finale: { coef: 260, per: 9 }, // + per second of Burst left
  },
  awakening: {
    id: 'worldsplitter', name: 'Worldsplitter', type: 'point', cd: 180, uses: 3, range: 9, dur: 2.1, superArmor: 'full', fixedSpeed: true,
    desc: 'Leap high into the air and bring the greatsword down, splitting the earth in a crimson fissure.', props: { stagger: 'Very High', wp: 3 },
    events: [
      A(0, 'awaken', 2.1), FX(0, 'awaken_aura', { color: RED }), S(0, 'awaken'),
      M(0.25, 'leap', 9, 0.65, { height: 5, iframes: 1.4 }),
      H(0.92, { ...circle(5.5, 0), at: 'point', coef: 180, stagger: 60, wp: 3, knock: 'down', heavy: true }),
      H(1.05, { ...rect(15, 4.5, -2), at: 'point', coef: 520, stagger: 80, wp: 3, knock: 'up', heavy: true }),
      FX(0.92, 'worldsplitter', { at: 'point', color: RED, len: 15 }), K(0.92, 1), S(0.92, 'explosion_big'),
    ],
  },
  skills: [
    {
      id: 'whirlwind_edge', name: 'Whirlwind Edge', type: 'holding', cd: 12, mp: 90, holdMax: 2.6, superArmor: 'push',
      desc: 'Spin with the greatsword while held, shredding everything around you. Move slowly while spinning.', props: { stagger: 'Mid', superArmor: 'push' },
      events: [A(0, 'spin_loop', 0.4, { loop: true })],
      loop: { every: 0.3, walk: 2.6, events: [H(0, { ...circle(3.2), coef: 3.6, stagger: 3 }), FX(0, 'slash', { color: RED, r: 3.2, arc: 360, spin: true }), S(0, 'whoosh')] },
      end: [A(0, 'spin', 0.45), H(0.15, { ...circle(3.6), coef: 8, stagger: 8, knock: 'push', kb: 2.5 }), FX(0.15, 'shockwave', { color: RED, r: 3.6 })],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['bleed', 'wide', 'pull'], [{ id: 'crimson_gale', name: 'Crimson Gale', desc: 'The final spin releases a gale that deals 150% more damage.', apply: d => { d.end[1].coef *= 2.5; d.end[1].r = 4.6; } }, 'keen']],
    },
    {
      id: 'tempest_slash', name: 'Tempest Slash', type: 'combo', cd: 7, mp: 60,
      desc: 'Three heavy slashes; the third spins you forward.', props: { stagger: 'Mid' },
      stages: [
        { dur: 0.5, window: 0.18, events: [A(0, 'slash_h', 0.5), H(0.2, { ...cone(3.4, 150), coef: 7, stagger: 5 }), FX(0.2, 'slash', { color: RED, r: 3.4, arc: 150 }), S(0.2, 'greatsword'), M(0.05, 'dash', 0.8, 0.15)] },
        { dur: 0.5, window: 0.18, events: [A(0, 'slash_x', 0.5), H(0.2, { ...cone(3.4, 150), coef: 7, stagger: 5 }), FX(0.2, 'slash', { color: RED, r: 3.4, arc: 150, flip: true }), S(0.2, 'greatsword'), M(0.05, 'dash', 0.8, 0.15)] },
        { dur: 0.7, events: [A(0, 'spin', 0.7), M(0.05, 'dash', 3, 0.35), ...hits(3, 0.12, 0.12, { ...circle(3.2), coef: 15, stagger: 9 }), FX(0.12, 'slash', { color: RED, r: 3.2, arc: 360 }), S(0.12, 'whoosh_big')] },
      ],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['bleed', 'stance', 'wide'], [{ id: 'blood_edge', name: 'Blood Edge', desc: 'The third strike deals 80% more damage and knocks enemies down.', apply: d => { for (const e of d.stages[2].events) if (e.a === 'hit') { e.coef *= 1.8; e.knock = 'down'; } } }, 'aftershock']],
    },
    {
      id: 'diving_slash', name: 'Diving Slash', type: 'point', cd: 9, mp: 70, range: 8, dur: 0.95,
      desc: 'Leap to the target point and cleave the ground where you land. Head Attack.', props: { stagger: 'Mid', attack: 'head' },
      events: [A(0, 'leap', 0.55), M(0.05, 'leap', 8, 0.45, { height: 2.4 }), A(0.5, 'slam', 0.45), H(0.52, { ...circle(3.4), coef: 26, stagger: 14, knock: 'down', attack: 'head', heavy: true }), FX(0.52, 'crater', { color: RED, r: 3.4 }), K(0.52, 0.35), S(0.52, 'impact_heavy')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['wide', 'stance', 'crushing'], [{ id: 'earthshaker', name: 'Earthshaker', desc: 'Landing causes two aftershock rings.', apply: d => { d.events.push(H(0.8, { ...circle(5), coef: 10, stagger: 6 }), FX(0.8, 'shockwave', { color: RED, r: 5 }), H(1.05, { ...circle(6.5), coef: 10, stagger: 6 }), FX(1.05, 'shockwave', { color: RED, r: 6.5 })); d.dur = 1.15; } }, 'enhanced:0.4']],
    },
    {
      id: 'sword_storm', name: 'Sword Storm', type: 'normal', cd: 10, mp: 80, dur: 1.1,
      desc: 'Rush forward in a spinning storm of steel.', props: { stagger: 'Mid', superArmor: 'push' }, superArmor: 'push',
      events: [A(0, 'spin_loop', 1.0, { loop: true }), M(0.05, 'dash', 6, 0.9), ...hits(5, 0.1, 0.18, { ...circle(3.0), coef: 30, stagger: 12 }), FX(0.1, 'whirl', { color: RED, r: 3, dur: 0.95, follow: true }), S(0.1, 'whoosh_big'), A(1.0, 'atk3', 0.2)],
      tripods: [['quick_prep', 'mobility', 'mana_saver'], ['bleed', 'wide', 'pull'], ['keen', { id: 'storm_end', name: 'Eye of the Storm', desc: 'Ends with an explosive cleave (+120% damage).', apply: d => { d.events.push(H(1.05, { ...circle(3.8), coef: 36, stagger: 10, knock: 'push', kb: 3, heavy: true }), FX(1.05, 'shockwave', { color: RED, r: 3.8 })); d.dur = 1.3; } }]],
    },
    {
      id: 'mountain_cleave', name: 'Mountain Cleave', type: 'normal', cd: 10, mp: 90, dur: 1.05, cancelAt: 0.8, superArmor: 'push',
      desc: 'An upward slash followed by a mountain-splitting downward cleave. Counter. Head Attack.', props: { stagger: 'High', counter: true, attack: 'head', wp: 1, superArmor: 'push' },
      events: [A(0, 'slash_up', 0.45), H(0.18, { ...cone(3.2, 110), coef: 10, stagger: 10, counter: true, attack: 'head' }), FX(0.18, 'slash', { color: RED, r: 3.2, arc: 110, vertical: true }), S(0.18, 'greatsword'),
        A(0.45, 'slash_v', 0.6), H(0.66, { ...rect(5.2, 2.6), coef: 28, stagger: 26, wp: 1, knock: 'down', counter: true, attack: 'head', heavy: true }), FX(0.66, 'ground_crack', { color: RED, len: 5.2 }), K(0.66, 0.35), S(0.66, 'impact_heavy')],
      tripods: [['quick_prep', 'weak_point', 'swift'], ['crushing', 'wide', 'unstoppable'], [{ id: 'titan_cleave', name: 'Titan Cleave', desc: 'The downward cleave deals 90% more damage.', apply: d => { d.events[5].coef *= 1.9; } }, 'aftershock']],
    },
    {
      id: 'hell_blade', name: 'Hell Blade', type: 'charge', cd: 22, mp: 140, chargeTime: 1.1, perfect: [0.8, 1.0], perfectMul: 1.25, superArmor: 'push',
      desc: 'Charge the greatsword with rage, then unleash a devastating slash. Release in the gold zone for a Perfect strike.', props: { stagger: 'Very High', wp: 2, superArmor: 'push' },
      onStart: r => r.u.model?.play?.('charge_hold', { loop: true }),
      events: [A(0, 'charge_release', 0.7), M(0, 'dash', 2, 0.15), H(0.12, { ...cone(5.5, 170), coef: 72, stagger: 50, wp: 2, knock: 'down', heavy: true }), FX(0.12, 'slash', { color: RED, r: 5.5, arc: 170, big: true }), K(0.12, 0.55), S(0.12, 'slash_heavy')],
      dur: 0.75,
      tripods: [['quick_prep', 'weak_point', 'swift'], ['crushing', 'unstoppable', 'keen'], [{ id: 'infernal', name: 'Infernal Blade', desc: 'Perfect release damage +60%.', apply: d => { d.perfectMul *= 1.6; } }, 'burn']],
    },
    {
      id: 'red_dust', name: 'Red Dust', type: 'normal', cd: 16, mp: 70, dur: 0.8,
      desc: 'Unleash a crimson shockwave ahead and gain Attack Power +10% for 8 s.', props: { stagger: 'Low' },
      events: [A(0, 'buff', 0.8), B(0.2, { target: 'self', id: 'atk_up', dur: 8, mods: { dmgMul: 0.1 }, name: 'Red Dust' }), H(0.35, { ...cone(6, 70), coef: 12, stagger: 6 }), FX(0.35, 'wave', { color: RED, len: 6, width: 3 }), FX(0.2, 'aura_burst', { color: RED }), S(0.2, 'buff')],
      tripods: [['quick_prep', 'mana_saver', 'wide'], ['keen', { id: 'bloodthirst', name: 'Bloodthirst', desc: 'Also grants +10% Crit Rate.', apply: d => { d.events[1].mods.crit = 0.1; } }, 'enhanced:0.6'], [{ id: 'war_banner', name: 'War Cry', desc: 'The buff also applies to party members nearby.', apply: d => { d.events[1].target = 'party'; } }, 'bleed']],
    },
    {
      id: 'chain_sword', name: 'Chain Sword', type: 'normal', cd: 12, mp: 60, dur: 0.85,
      desc: 'Hurl the chained greatsword ahead, dragging enemies back to you.', props: { stagger: 'Mid' },
      events: [A(0, 'throw_weapon', 0.85), H(0.3, { ...rect(9, 2.2), coef: 14, stagger: 10, knock: 'pull', kb: 7 }), FX(0.3, 'chain', { color: RED, len: 9 }), S(0.3, 'whoosh')],
      tripods: [['quick_prep', 'weak_point', 'wide'], ['bleed', 'stance', 'keen'], [{ id: 'reel', name: 'Reel and Rend', desc: 'Follow up with a cleave (+180% damage).', apply: d => { d.events.push(A(0.8, 'slash_h', 0.4), H(0.95, { ...cone(3.4, 150), coef: 25, stagger: 12 }), FX(0.95, 'slash', { color: RED, r: 3.4, arc: 150 })); d.dur = 1.25; } }, 'enhanced:0.4']],
    },
    {
      id: 'strike_wave', name: 'Strike Wave', type: 'normal', cd: 8, mp: 50, dur: 0.7,
      desc: 'Slash the air, sending a crimson wave rolling forward.', props: { stagger: 'Low' },
      events: [A(0, 'slash_v', 0.7), P(0.3, { speed: 26, range: 12, radius: 1.6, pierce: 99, kind: 'wave', color: RED, hit: { coef: 18, stagger: 6, knock: 'push', kb: 2 } }), S(0.3, 'whoosh_big')],
      tripods: [['quick_prep', 'mana_saver', 'wide'], ['keen', 'bleed', { id: 'twin_wave', name: 'Twin Wave', desc: 'Fires two waves in a V.', apply: d => { d.events[1].count = 2; d.events[1].spread = 0.5; d.events[1].hit.coef *= 0.75; } }], ['enhanced:0.5', 'aftershock']],
    },
    {
      id: 'shoulder_charge', name: 'Shoulder Charge', type: 'normal', cd: 14, mp: 40, dur: 0.6, superArmor: 'push',
      desc: 'Barrel forward, bowling enemies over. Super Armor.', props: { stagger: 'High', superArmor: 'push' },
      events: [A(0, 'dash_strike', 0.6), M(0, 'dash', 7, 0.35), H(0.1, { ...circle(1.8), coef: 6, stagger: 18, knock: 'push', kb: 3, once: true }), H(0.25, { ...circle(1.8), coef: 6, stagger: 18, knock: 'push', kb: 3, once: true }), FX(0, 'dash_trail', { color: RED }), S(0, 'dash')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['crushing', 'unstoppable', 'enhanced:0.8'], [{ id: 'battering', name: 'Battering Ram', desc: 'Knocks enemies down.', apply: d => { d.events[2].knock = d.events[3].knock = 'down'; } }, 'keen']],
    },
    {
      id: 'finish_strike', name: 'Finish Strike', type: 'charge', cd: 18, mp: 110, chargeTime: 0.9, perfect: [0.75, 1.0], superArmor: 'push',
      desc: 'Charge, then lunge through the target with a rising cut. Back Attack.', props: { stagger: 'High', attack: 'back', superArmor: 'push' },
      onStart: r => r.u.model?.play?.('charge_hold', { loop: true }),
      events: [A(0, 'dash_strike', 0.6), M(0, 'dash', 5, 0.25, { iframes: 0.2 }), H(0.2, { ...rect(5.5, 2.6, -5), coef: 58, stagger: 30, attack: 'back', knock: 'up', heavy: true }), FX(0.2, 'slash', { color: RED, r: 4, arc: 90, vertical: true, big: true }), K(0.2, 0.4), S(0.2, 'slash_heavy')],
      dur: 0.7,
      tripods: [['quick_prep', 'weak_point', 'keen'], ['back', 'unstoppable', 'crushing'], [{ id: 'executioner', name: 'Executioner', desc: 'Deals 50% more damage to enemies below 30% HP.', apply: d => { d.executeBonus = 0.5; } }, 'enhanced:0.5']],
    },
    {
      id: 'wind_blade', name: 'Wind Blade', type: 'normal', cd: 6, mp: 40, dur: 0.6,
      desc: 'A fast cross-slash that sends two blades of wind ahead.', props: { stagger: 'Low' },
      events: [A(0, 'slash_x', 0.6), H(0.18, { ...cone(3.0, 120), coef: 6, stagger: 4 }), P(0.24, { speed: 30, range: 9, radius: 1.1, pierce: 99, kind: 'blade', color: RED, count: 2, spread: 0.3, hit: { coef: 5, stagger: 2 } }), S(0.18, 'blade')],
      tripods: [['quick_prep', 'swift', 'mana_saver'], ['keen', 'bleed', 'wide'], ['enhanced:0.5', { id: 'gale', name: 'Gale Blades', desc: 'Fires four blades.', apply: d => { d.events[2].count = 4; d.events[2].spread = 0.8; } }]],
    },
  ],
  defaultBar: ['whirlwind_edge', 'tempest_slash', 'diving_slash', 'mountain_cleave', 'hell_blade', 'red_dust', 'strike_wave', 'finish_strike'],
  engravings: [
    { id: 'bloodfrenzy', name: 'Bloodfrenzy', desc: 'Max HP −25%. Damage +16%, damage taken −35%, healing received −60%. Immune to push while using skills.', mods: { dmgMul: 0.16, dmgTaken: -0.35, healTaken: -0.6, hpMaxMul: -0.25 }, superArmor: 1 },
    { id: 'tempered_fury', name: 'Tempered Fury', desc: 'Burst Mode no longer exhausts you; Crit Damage +40% during Burst Mode.', burstCritDmg: 0.4 },
  ],
};
