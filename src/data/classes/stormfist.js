// STORMFIST — gauntlet fighter (DPS). Fast combo chains and lightning dragons. Identity: Chi orbs ×3 →
// Z Dragon Ascent (1 orb) · X Thunder Tiger (2 orbs). Short cooldowns, quick animations, lots of multi-hit lightning.
import { A, H, FX, S, K, M, P, Z, C, circle, cone, rect, hits } from '../../game/skills/dsl.js';
import { withEngr, evs, addEv, phase, finalize } from './common.js';

const L = 'lightning', F = 'fire';
const zap = { id: 'shock', dur: 4, power: 1 };

// Chi skills (identity). Built at level 1 → coefficients are ×2 a normal skill's.
const dragonAscent = {
  id: 'dragon_ascent', name: 'Dragon Ascent', type: 'normal', orbs: 1, dur: 1.0, cancelAt: 0.85, superArmor: 'full', fixedSpeed: true,
  desc: 'Spend 1 Chi: a rising uppercut that looses a lightning dragon spiralling into the sky.', props: { stagger: 'High', superArmor: 'full' },
  events: [
    A(0, 'uppercut', 1.0), M(0.05, 'dash', 2, 0.15), S(0.05, 'chi'),
    H(0.22, { ...cone(3.2, 140), coef: 41.4, stagger: 16, knock: 'up', elem: L }), FX(0.22, 'lightning_burst', { color: L, r: 2.4 }),
    H(0.45, { ...circle(3.6), coef: 85.1, stagger: 16, elem: L, heavy: true }), FX(0.45, 'lightning_dragon', { color: L, r: 3.6 }), K(0.45, 0.4), S(0.45, 'thunder'),
    H(0.6, { ...circle(3.6), coef: 46, elem: L, status: [zap], if: withEngr('storm_conduit') }), FX(0.6, 'lightning_bolt', { color: L, r: 3, if: withEngr('storm_conduit') }),
  ],
};
const thunderTiger = {
  id: 'thunder_tiger', name: 'Thunder Tiger', type: 'normal', orbs: 2, dur: 1.35, cancelAt: 1.1, superArmor: 'full', fixedSpeed: true,
  desc: 'Spend 2 Chi: a roaring thunder tiger bursts from the fists and mauls everything ahead.', props: { stagger: 'Very High', wp: 2, superArmor: 'full' },
  events: [
    A(0, 'palm', 0.6), S(0, 'chi'), FX(0, 'chi_burst', { color: L, r: 2 }),
    M(0.25, 'dash', 3, 0.2),
    H(0.35, { ...rect(9, 3.6), coef: 138, stagger: 30, wp: 2, knock: 'down', elem: L, heavy: true }), FX(0.35, 'thunder_tiger', { color: L, len: 9, width: 3.6 }), K(0.35, 0.55), S(0.35, 'thunder'),
    A(0.6, 'ground_punch', 0.75),
    H(0.95, { ...circle(4.4, 0), at: 5, coef: 172.5, stagger: 30, elem: L, heavy: true }), FX(0.95, 'lightning_strike', { at: 5, color: L, r: 4.4 }), K(0.95, 0.7), S(0.95, 'explosion_big'),
    H(1.1, { ...circle(4.4, 0), at: 5, coef: 103.5, elem: L, status: [zap], if: withEngr('storm_conduit') }), FX(1.1, 'lightning_bolt', { at: 5, color: L, r: 4, if: withEngr('storm_conduit') }),
  ],
};

export default finalize({
  id: 'stormfist', name: 'Stormfist', archetype: 'Fighter', role: 'dps', weapon: 'gauntlets', difficulty: 3,
  blurb: 'A martial artist who channels the storm through fist and heel. Lightning-fast chains build Chi for dragon and tiger finishers.',
  palette: { main: 0x46b4ff, glow: [0.6, 1.6, 4], fx: L },
  dash: { cd: 7, dist: 5.8, dur: 0.24 },
  stats: { hp: 1.05, atk: 1.0, def: 1.0 },
  basic: [
    { anim: 'atk1', dur: 0.3, hit: { t: 0.1, ...cone(2.5, 90), coef: 0.9, stagger: 1.5 }, fx: { t: 0.1, preset: 'slash', color: L, r: 2.2, arc: 70 }, sfx: 'punch' },
    { anim: 'atk2', dur: 0.32, hit: { t: 0.11, ...cone(2.5, 90), coef: 1.0, stagger: 1.5 }, fx: { t: 0.11, preset: 'slash', color: L, r: 2.2, arc: 70, flip: true }, sfx: 'punch' },
    { anim: 'atk3', dur: 0.48, hit: { t: 0.22, ...circle(2.8), coef: 1.7, stagger: 3, knock: 'push', kb: 1 }, fx: { t: 0.22, preset: 'slash', color: L, r: 2.8, arc: 300, spin: true }, sfx: 'kick' },
  ],
  identity: {
    handler: 'orbs', kind: 'orbs', hudKind: 'orbs', label: 'Chi', perOrb: 100, maxOrbs: 3, gainPerHit: 1.8, gainBasic: 1.2, color: '#46b4ff',
    z: dragonAscent, x: thunderTiger,
  },
  awakening: {
    id: 'heavens_fury', name: "Heaven's Fury", type: 'normal', cd: 180, uses: 3, dur: 2.6, cancelAt: 2.4, superArmor: 'full', fixedSpeed: true,
    desc: 'Become the storm: a blur of a hundred lightning fists, then an uppercut that calls down the heavens.', props: { stagger: 'Very High', wp: 3, superArmor: 'full' },
    events: [
      A(0, 'awaken', 0.5), FX(0, 'awaken_aura', { color: L }), S(0, 'awaken'),
      A(0.35, 'punch_loop', 1.3, { loop: true }), FX(0.35, 'lightning_aura', { color: L, r: 3, follow: true, dur: 1.4 }),
      ...hits(12, 0.4, 0.1, { ...cone(3.6, 150), coef: 300, stagger: 60, elem: L }), S(0.4, 'punch'),
      A(1.65, 'uppercut', 0.7), M(1.65, 'dash', 1.5, 0.15),
      H(1.85, { ...circle(6.5), coef: 460, stagger: 60, wp: 3, knock: 'up', elem: L, heavy: true }), FX(1.85, 'lightning_dragon', { color: L, r: 6.5, big: true }),
      FX(1.9, 'lightning_strike', { color: L, r: 6.5, big: true }), K(1.85, 1), S(1.85, 'thunder'),
    ],
  },
  skills: [
    {
      id: 'lightning_kick', name: 'Lightning Kick', type: 'normal', cd: 5, mp: 40, dur: 0.5,
      desc: 'A snapping front kick that looses a bolt of lightning straight ahead.', props: { stagger: 'Low' },
      events: [A(0, 'kick_high', 0.5), H(0.18, { ...cone(2.8, 80), coef: 8.6, stagger: 4, elem: L }), FX(0.18, 'lightning_burst', { color: L, r: 1.4 }), S(0.18, 'kick'),
        P(0.2, { speed: 36, range: 9, radius: 1.0, pierce: 99, kind: 'lightning_bolt', color: L, hit: { coef: 11, stagger: 3, elem: L } }), S(0.2, 'lightning')],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['shock', 'wide', { id: 'forked_bolt', name: 'Forked Bolt', desc: 'The bolt splits into three (each 60% damage).', apply: d => { const p = evs(d.events, 'proj')[0]; p.count = 3; p.spread = 0.55; p.hit.coef *= 0.6; } }],
        [{ id: 'thunderclap', name: 'Thunderclap', desc: 'The bolt bursts where it stops: a 3 m thunderclap for +70% damage.', apply: d => { const p = evs(d.events, 'proj')[0]; addEv(d.events, H(0.46, { ...circle(3), at: 8.5, coef: 13.5, stagger: 4, elem: L }), FX(0.46, 'lightning_burst', { at: 8.5, color: L, r: 3 })); d.dur = 0.62; } }, 'enhanced:0.4']],
    },
    {
      id: 'blazing_fist', name: 'Blazing Fist', type: 'combo', cd: 6, mp: 50,
      desc: 'Two blurring jabs, a second pair, then a blazing palm that blasts enemies back.', props: { stagger: 'Mid' },
      stages: [
        { dur: 0.34, window: 0.1, events: [A(0, 'atk1', 0.34), M(0.02, 'dash', 0.7, 0.12), ...hits(2, 0.08, 0.1, { ...cone(2.8, 100), coef: 7.1, stagger: 3 }), FX(0.08, 'slash', { color: F, r: 2.4, arc: 70 }), S(0.08, 'punch')] },
        { dur: 0.34, window: 0.1, events: [A(0, 'atk2', 0.34), M(0.02, 'dash', 0.7, 0.12), ...hits(2, 0.08, 0.1, { ...cone(2.8, 100), coef: 7.1, stagger: 3 }), FX(0.08, 'slash', { color: F, r: 2.4, arc: 70, flip: true }), S(0.08, 'punch')] },
        { dur: 0.6, events: [A(0, 'palm', 0.6), M(0.05, 'dash', 1, 0.12), H(0.22, { ...rect(4.2, 2.6), coef: 16.4, stagger: 7, knock: 'push', kb: 2.5, heavy: true }), FX(0.22, 'fire_palm', { color: F, len: 4.2, r: 2 }), K(0.22, 0.25), S(0.22, 'punch_heavy')] },
      ],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['burn', 'stance', { id: 'flurry', name: 'Flurry', desc: 'Each jab stage strikes three times (+45% damage).', apply: d => { for (const s of d.stages.slice(0, 2)) { const hs = evs(s.events, 'hit'); addEv(s.events, { ...hs[1], t: 0.24 }); for (const h of evs(s.events, 'hit')) h.coef *= 0.97; } } }],
        [{ id: 'inferno_palm', name: 'Inferno Palm', desc: 'The palm erupts into a pillar of flame that burns the ground for 3 s.', apply: d => { const l = d.stages[2].events; addEv(l, Z(0.3, { at: 2.4, r: 2.6, dur: 3, tick: 0.5, kind: 'fire', hit: { coef: 2.2, elem: F } }), FX(0.3, 'flame_pillar', { at: 2.4, color: F, r: 2.6 })); for (const h of evs(l, 'hit')) { h.elem = F; h.status = [{ id: 'burn', dur: 5, power: 1 }]; } } }, 'enhanced:0.4']],
    },
    {
      id: 'tempest_barrage', name: 'Tempest Barrage', type: 'holding', cd: 10, mp: 80, holdMax: 1.9, superArmor: 'push',
      desc: 'Hold to unleash a storm of lightning-quick punches while stepping forward, ending in a rising blow.', props: { stagger: 'Mid', superArmor: 'push' },
      onStart: r => r.u.model?.play?.('punch_loop', { loop: true }),
      events: [],
      loop: { every: 0.1, walk: 1.6, events: [H(0, { ...cone(3.2, 110), coef: 1.8, stagger: 1.2, elem: L }), FX(0, 'slash', { color: L, r: 2.8, arc: 60 }), S(0, 'punch')] },
      end: [A(0, 'uppercut', 0.45), H(0.16, { ...cone(3.4, 130), coef: 12.2, stagger: 6, knock: 'push', kb: 2, elem: L, heavy: true }), FX(0.16, 'lightning_burst', { color: L, r: 3 }), S(0.16, 'thunder')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['shock', 'keen', 'stance'],
        [{ id: 'dragon_finisher', name: 'Dragon Finisher', desc: 'The final blow becomes a lightning dragon fist: +150% damage and launches enemies.', apply: d => { const h = evs(d.end, 'hit')[0]; h.coef *= 2.5; h.knock = 'up'; h.r = 4; addEv(d.end, FX(0.18, 'lightning_dragon', { color: L, r: 3.4 })); } },
          { id: 'eye_of_the_storm', name: 'Eye of the Storm', desc: 'Every punch drags nearby enemies inward and reaches 40% further.', apply: d => { const h = evs(d.loop.events, 'hit')[0]; h.shape = 'circle'; h.r = 4.2; h.knock = 'pull'; h.kb = 0.6; h.coef *= 1.1; } }]],
    },
    {
      id: 'sweeping_kick', name: 'Sweeping Kick', type: 'normal', cd: 7, mp: 50, dur: 0.55,
      desc: 'A low spinning sweep that knocks down everything around you.', props: { stagger: 'Mid' },
      events: [A(0, 'kick_spin', 0.55), H(0.22, { ...circle(3.2), coef: 19.6, stagger: 10, knock: 'down' }), FX(0.22, 'slash', { color: L, r: 3.2, arc: 360, spin: true }), S(0.22, 'kick')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['crushing', 'stance', { id: 'double_sweep', name: 'Double Sweep', desc: 'Spin twice: a second sweep for +60% damage.', apply: d => { addEv(d.events, A(0.45, 'kick_spin', 0.45), H(0.62, { ...circle(3.2), coef: 11.8, stagger: 6, knock: 'down' }), FX(0.62, 'slash', { color: L, r: 3.2, arc: 360, spin: true, flip: true })); d.dur = 0.95; } }],
        [{ id: 'static_ring', name: 'Static Ring', desc: 'The sweep releases a 5 m ring of lightning (+50% damage, Shock).', apply: d => { addEv(d.events, H(0.3, { ...circle(5), coef: 9.8, stagger: 3, elem: L, status: [zap] }), FX(0.3, 'shockwave', { color: L, r: 5 })); } }, 'enhanced:0.5']],
    },
    {
      id: 'storm_dragon_upper', name: 'Storm Dragon Upper', type: 'normal', cd: 12, mp: 80, dur: 0.95, superArmor: 'push',
      desc: 'Dash in with a launching uppercut; a lightning dragon coils up from the impact.', props: { stagger: 'Mid', superArmor: 'push' },
      events: [A(0, 'uppercut', 0.7), M(0.02, 'dash', 3, 0.18), H(0.22, { ...cone(3.2, 120), coef: 16.4, stagger: 9, knock: 'up', elem: L }), FX(0.22, 'lightning_burst', { color: L, r: 2 }), S(0.22, 'punch_heavy'),
        H(0.5, { ...circle(3.6), coef: 28.6, stagger: 8, elem: L, heavy: true }), FX(0.5, 'lightning_dragon', { color: L, r: 3.6 }), K(0.5, 0.3), S(0.5, 'thunder')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['shock', 'crushing', 'keen'],
        [{ id: 'twin_dragons', name: 'Twin Dragons', desc: 'A second dragon dives back down onto the same spot (+70% damage).', apply: d => { addEv(d.events, H(0.8, { ...circle(3.8), coef: 31.4, stagger: 6, elem: L, knock: 'down' }), FX(0.8, 'lightning_strike', { color: L, r: 3.8 }), S(0.8, 'thunder')); d.dur = 1.1; } },
          { id: 'dragon_flight', name: 'Dragon Flight', desc: 'The dragon flies forward instead, tearing through a 12 m line (+40% damage).', apply: d => { const h = evs(d.events, 'hit')[1]; d.events.splice(d.events.indexOf(h), 1); addEv(d.events, P(0.5, { speed: 24, range: 12, radius: 1.8, pierce: 99, kind: 'lightning_dragon', color: L, hit: { coef: h.coef * 1.4, stagger: 8, elem: L } })); } }]],
    },
    {
      id: 'swiftwind_dash', name: 'Swiftwind Dash', type: 'chain', cd: 10, mp: 60, chainWindow: 2,
      desc: 'Up to three wind-fast dashing strikes; press again after each dash.', props: { stagger: 'Mid' },
      stages: [
        { dur: 0.36, window: 0.2, events: [A(0, 'dash_strike', 0.36), M(0, 'dash', 4.2, 0.18, { iframes: 0.15 }), H(0.1, { ...circle(1.9), coef: 4.6, stagger: 3, once: true }), H(0.18, { ...circle(1.9), coef: 4.6, stagger: 3, once: true }), FX(0, 'lightning_trail', { color: L, len: 4 }), S(0, 'dash')] },
        { dur: 0.36, window: 0.2, events: [A(0, 'dash_strike', 0.36), M(0, 'dash', 4.2, 0.18, { iframes: 0.15 }), H(0.1, { ...circle(1.9), coef: 4.6, stagger: 3, once: true }), H(0.18, { ...circle(1.9), coef: 4.6, stagger: 3, once: true }), FX(0, 'lightning_trail', { color: L, len: 4 }), S(0, 'dash')] },
        { dur: 0.55, events: [A(0, 'kick_flip', 0.55), M(0, 'dash', 3, 0.2), H(0.22, { ...circle(2.8), coef: 14.2, stagger: 6, knock: 'down', elem: L }), FX(0.22, 'lightning_burst', { color: L, r: 2.8 }), S(0.22, 'kick')] },
      ],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['shock', 'stance', { id: 'gale_steps', name: 'Gale Steps', desc: 'Each dash leaves a crackling trail that zaps enemies for 2 s.', apply: d => { for (const s of d.stages.slice(0, 2)) addEv(s.events, Z(0.18, { at: -2, r: 2.2, dur: 2, tick: 0.5, kind: 'lightning', hit: { coef: 1.1, elem: L } })); } }],
        [{ id: 'fourth_step', name: 'Fourth Step', desc: 'Adds a fourth step: a leaping thunder kick (+50% damage).', apply: d => { d.stages.push({ dur: 0.6, events: [A(0, 'leap', 0.3), M(0, 'dash', 2.5, 0.25, { height: 1.4 }), A(0.28, 'slam', 0.32), H(0.32, { ...circle(3.2), coef: 16.4, stagger: 8, knock: 'down', elem: L, heavy: true }), FX(0.32, 'lightning_strike', { color: L, r: 3.2 }), K(0.32, 0.3), S(0.32, 'thunder')] }); } }, 'enhanced:0.4']],
    },
    {
      id: 'ground_quake', name: 'Ground Quake', type: 'normal', cd: 18, mp: 110, dur: 1.0, cancelAt: 0.8, superArmor: 'push',
      desc: 'Leap up and drive both fists into the earth, shattering it around you. Very high stagger.', props: { stagger: 'Very High', wp: 1, superArmor: 'push' },
      events: [A(0, 'leap', 0.4), M(0.02, 'dash', 1, 0.3, { height: 1.2 }), A(0.38, 'ground_punch', 0.6),
        H(0.5, { ...circle(4.3), coef: 49, stagger: 62, wp: 1, knock: 'down', heavy: true }), FX(0.5, 'crater', { color: L, r: 4.3 }), FX(0.5, 'shockwave', { color: L, r: 4.5 }), K(0.5, 0.55), S(0.5, 'impact_heavy')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['crushing', 'unstoppable', { id: 'aftershocks', name: 'Aftershocks', desc: 'Two tremor rings follow the impact (+30% damage each).', apply: d => { addEv(d.events, H(0.8, { ...circle(5.5), coef: 14.7, stagger: 8 }), FX(0.8, 'shockwave', { color: L, r: 5.5 }), H(1.1, { ...circle(6.5), coef: 14.7, stagger: 8 }), FX(1.1, 'shockwave', { color: L, r: 6.5 })); d.dur = 1.25; } }],
        [{ id: 'earth_splitter', name: 'Earth Splitter', desc: 'The quake tears a 10 m fissure ahead (+50% damage).', apply: d => { addEv(d.events, H(0.62, { ...rect(10, 3), coef: 24.5, stagger: 14 }), FX(0.62, 'ground_crack', { color: L, len: 10 })); } }, 'enhanced:0.4']],
    },
    {
      id: 'thunder_palm', name: 'Thunder Palm', type: 'charge', cd: 14, mp: 90, chargeTime: 0.8, perfect: [0.75, 1.0], perfectMul: 1.2, superArmor: 'push', dur: 0.6,
      desc: 'Gather lightning in the palm, then release a thunderclap straight ahead. Counter. Release in the gold zone for a Perfect strike.', props: { stagger: 'High', counter: true, superArmor: 'push' },
      onStart: r => r.u.model?.play?.('charge_hold', { loop: true }),
      events: [A(0, 'palm', 0.6), M(0, 'dash', 1, 0.1), H(0.1, { ...rect(6.5, 2.8), coef: 42.8, stagger: 22, counter: true, knock: 'push', kb: 3, elem: L, heavy: true }), FX(0.1, 'thunder_palm', { color: L, len: 6.5, width: 2.8 }), K(0.1, 0.4), S(0.1, 'thunder')],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['crushing', 'unstoppable', 'keen'],
        [{ id: 'heavens_palm', name: "Heaven's Palm", desc: 'The palm also calls a lightning bolt down on the struck area (+60% damage).', apply: d => { addEv(d.events, H(0.35, { ...circle(3.4), at: 4, coef: 25.7, stagger: 8, elem: L, status: [zap] }), FX(0.35, 'lightning_bolt', { at: 4, color: L, r: 3.4 })); d.dur = 0.75; } },
          { id: 'overcharge', name: 'Overcharge', desc: 'Perfect release damage +50%.', apply: d => { d.perfectMul *= 1.5; } }]],
    },
    {
      id: 'moonflash_kick', name: 'Moonflash Kick', type: 'normal', cd: 9, mp: 60, dur: 0.7,
      desc: 'A crescent backflip kick that launches enemies, landing you a step back. Head Attack.', props: { stagger: 'Mid', attack: 'head' },
      events: [A(0, 'kick_flip', 0.7), H(0.26, { ...cone(3.3, 140), coef: 27.5, stagger: 11, attack: 'head', knock: 'up' }), FX(0.26, 'slash', { color: L, r: 3.3, arc: 150, vertical: true }), S(0.26, 'kick'), M(0.32, 'back', 2, 0.25)],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['crushing', 'shock', 'keen'],
        [{ id: 'crescent_wave', name: 'Crescent Wave', desc: 'The kick sends a crescent of light rolling forward (+50% damage).', apply: d => { addEv(d.events, P(0.3, { speed: 26, range: 10, radius: 1.5, pierce: 99, kind: 'crescent', color: L, hit: { coef: 13.8, stagger: 4, attack: 'head' } })); } }, 'enhanced:0.4']],
    },
    {
      id: 'heavenly_strike', name: 'Heavenly Strike', type: 'point', cd: 16, mp: 100, range: 8, dur: 1.0, cancelAt: 0.85, superArmor: 'push',
      desc: 'Spring into the sky and dive-kick the target area riding a bolt of lightning.', props: { stagger: 'High', superArmor: 'push' },
      events: [A(0, 'leap', 0.5), M(0.05, 'leap', 8, 0.45, { height: 3 }), A(0.5, 'slam', 0.45),
        H(0.52, { ...circle(3.6), coef: 42.8, stagger: 18, knock: 'down', elem: L, heavy: true }), FX(0.52, 'lightning_strike', { color: L, r: 3.6 }), FX(0.52, 'crater', { color: L, r: 3.2 }), K(0.52, 0.45), S(0.52, 'thunder')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['shock', 'wide', 'stance'],
        [{ id: 'thunder_rain', name: 'Thunder Rain', desc: 'Four bolts rain around the landing point (+60% damage).', apply: d => { addEv(d.events, ...hits(4, 0.7, 0.12, { ...circle(3.8), coef: 25.7, stagger: 6, elem: L }), FX(0.7, 'lightning_bolt', { color: L, r: 3.8 }), FX(0.94, 'lightning_bolt', { color: L, r: 3.8 })); d.dur = 1.2; } }, 'enhanced:0.4']],
    },
    {
      id: 'lightning_whisper', name: 'Lightning Whisper', type: 'normal', cd: 12, mp: 70, dur: 0.75,
      desc: 'Flash through the enemy as lightning, slashing it from behind as you pass. Back Attack.', props: { stagger: 'Mid', attack: 'back' },
      events: [A(0, 'dash_strike', 0.5), phase(0, 0.35), M(0, 'dash', 6, 0.22, { iframes: 0.25 }), FX(0, 'lightning_trail', { color: L, len: 6 }), S(0, 'lightning'),
        H(0.24, { ...rect(6.6, 2.6, -6.3), coef: 30.6, stagger: 10, attack: 'back', elem: L }), FX(0.24, 'lightning_burst', { at: -3, color: L, r: 2.4 }),
        A(0.4, 'palm', 0.35), H(0.5, { ...circle(2.6), at: -2.6, coef: 10.2, stagger: 4, attack: 'back', elem: L }), FX(0.5, 'lightning_burst', { at: -2.6, color: L, r: 2.6 }), S(0.5, 'thunder')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['shock', 'keen', 'crushing'],
        [{ id: 'afterimage', name: 'Afterimage', desc: 'An afterimage repeats the dash back through the enemy (+60% damage).', apply: d => { addEv(d.events, phase(0.62, 0.35), M(0.62, 'back', 6, 0.22, { iframes: 0.25 }), H(0.8, { ...rect(6.6, 2.6), coef: 24.5, stagger: 6, attack: 'back', elem: L }), FX(0.62, 'lightning_trail', { color: L, len: 6 })); d.dur = 1.0; } }, 'enhanced:0.4']],
    },
    {
      id: 'soaring_tiger', name: 'Soaring Tiger', type: 'normal', cd: 24, mp: 130, dur: 1.1, cancelAt: 0.9, superArmor: 'push',
      desc: 'Unleash a spectral lightning tiger that pounces ahead and explodes where it lands.', props: { stagger: 'High', wp: 1, superArmor: 'push' },
      events: [A(0, 'palm', 0.7), FX(0.1, 'chi_burst', { color: L, r: 1.8 }), S(0.1, 'chi'),
        H(0.35, { ...rect(10, 3.2), coef: 51.7, stagger: 16, knock: 'down', elem: L }), FX(0.35, 'thunder_tiger', { color: L, len: 10, width: 3.2 }), S(0.35, 'thunder'),
        H(0.7, { ...circle(3.8), at: 8, coef: 46.2, stagger: 14, wp: 1, elem: L, heavy: true }), FX(0.7, 'lightning_strike', { at: 8, color: L, r: 3.8 }), K(0.7, 0.4), S(0.7, 'explosion')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['shock', 'crushing', 'keen'],
        [{ id: 'tiger_king', name: 'Tiger King', desc: 'The tiger roars on landing: +80% explosion damage and enemies are stunned.', apply: d => { const h = evs(d.events, 'hit')[1]; h.coef *= 1.8; h.knock = 'stun'; h.knockDur = 2; } }, 'enhanced:0.4']],
    },
  ],
  defaultBar: ['lightning_kick', 'blazing_fist', 'tempest_barrage', 'storm_dragon_upper', 'ground_quake', 'thunder_palm', 'moonflash_kick', 'lightning_whisper'],
  engravings: [
    { id: 'storm_conduit', name: 'Storm Conduit', desc: 'Chi skills call down an extra lightning bolt (Dragon Ascent +35%, Thunder Tiger +25%). Lightning Shock lingers on struck foes.', mods: { dmgMul: 0.04 } },
    { id: 'chi_master', name: 'Chi Master', desc: 'Chi fills 60% faster and Crit Rate +6%.', mods: { identityGain: 0.6, crit: 0.06 } },
  ],
});
