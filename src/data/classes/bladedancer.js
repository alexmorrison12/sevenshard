// BLADEDANCER — shade with twin blades that merge into a greatblade (DPS). Dash-through strikes and back attacks.
// Identity: Surge orbs ×3 → Z Surge (dash through the target; the more orbs spent, the harder it lands).
import { A, H, FX, S, K, M, P, Z, B, C, circle, cone, rect, hits } from '../../game/skills/dsl.js';
import { withEngr, evs, addEv, phase, reaim, orbsSpent, hasEngr, finalize } from './common.js';

const D = 'dark', V = 'arcane';

const surge = {
  id: 'surge', name: 'Surge', type: 'normal', orbs: 'all', perOrbMul: 1, dur: 1.0, cancelAt: 0.8, superArmor: 'full', fixedSpeed: true,
  desc: 'Spend every Surge orb: flash through the target, then the cut detonates behind you. Damage ×1 / ×2.4 / ×4 with 1 / 2 / 3 orbs. Back Attack.', props: { stagger: 'High', attack: 'back', superArmor: 'full' },
  events: [
    // damage scales 1 / 2.4 / 4 with orbs (run.mult = orbs spent; the extra per orb is added here)
    C(0, run => { const n = orbsSpent(run); run.mult = n === 3 ? 4 : n === 2 ? 2.4 : 1; if (n === 3 && hasEngr(run.u.kit, 'stormsurge')) run.mult *= 1.25; }),
    A(0, 'dash_strike', 0.5), phase(0, 0.4), M(0, 'dash', 7, 0.2, { iframes: 0.35 }), FX(0, 'shadow_dash', { color: D, len: 7 }), S(0, 'dash'),
    H(0.2, { ...rect(7.6, 2.8, -7.3), coef: 44, stagger: 16, attack: 'back' }), FX(0.2, 'surge_slash', { at: -3.5, color: V, len: 7 }), S(0.2, 'blade'),
    A(0.45, 'slash_x', 0.5), H(0.6, { ...circle(3.4), at: -3.2, coef: 56, stagger: 16, attack: 'back', heavy: true }), FX(0.6, 'surge_burst', { at: -3.2, color: V, r: 3.4 }), K(0.6, 0.45), S(0.6, 'slash_heavy'),
    Z(0.65, { at: -3.2, r: 3, dur: 3, tick: 0.5, kind: 'blades', hit: { coef: 4, stagger: 1, attack: 'back' }, if: withEngr('afterglow') }),
  ],
};

export default finalize({
  id: 'bladedancer', name: 'Bladedancer', archetype: 'Shade', role: 'dps', weapon: 'blades', difficulty: 4,
  blurb: 'A shadow that fights up close, flickering behind foes with twin blades that lock into a greatblade. Every cut charges a Surge orb for one blinding, orb-fuelled strike.',
  palette: { main: 0xb58cff, glow: [1.4, 0.3, 2.4], fx: D },
  dash: { cd: 7, dist: 6, dur: 0.24 },
  stats: { hp: 0.95, atk: 1.0, def: 0.95 },
  basic: [
    { anim: 'atk1', dur: 0.3, hit: { t: 0.1, ...cone(2.7, 110), coef: 0.9, stagger: 1.5 }, fx: { t: 0.1, preset: 'slash', color: D, r: 2.6, arc: 110 }, sfx: 'blade' },
    { anim: 'atk2', dur: 0.3, hit: { t: 0.1, ...cone(2.7, 110), coef: 1.0, stagger: 1.5 }, fx: { t: 0.1, preset: 'slash', color: D, r: 2.6, arc: 110, flip: true }, sfx: 'blade' },
    { anim: 'atk3', dur: 0.46, hit: { t: 0.2, ...circle(3), coef: 1.7, stagger: 3, knock: 'push', kb: 1 }, fx: { t: 0.2, preset: 'slash', color: D, r: 3, arc: 360, spin: true }, sfx: 'slash' },
  ],
  identity: {
    handler: 'orbs', kind: 'orbs', hudKind: 'orbs', label: 'Surge', perOrb: 100, maxOrbs: 3, gainPerHit: 2.2, gainBasic: 1.2, color: '#b58cff',
    z: surge,
  },
  awakening: {
    id: 'thousand_cuts', name: 'Thousand Cuts', type: 'normal', cd: 180, uses: 3, dur: 2.5, cancelAt: 2.3, superArmor: 'full', fixedSpeed: true,
    desc: 'Vanish into a storm of blades: a thousand cuts in the blink of an eye, then the greatblade falls.', props: { stagger: 'Very High', wp: 3, superArmor: 'full' },
    events: [
      A(0, 'awaken', 0.4), FX(0, 'awaken_aura', { color: D }), S(0, 'awaken'), A(0.3, 'vanish', 0.2), C(0.3, run => { run.u.invuln = Math.max(run.u.invuln, 1.6); }),
      FX(0.35, 'blade_storm', { color: D, r: 5.5, dur: 1.3 }), ...hits(14, 0.4, 0.09, { ...circle(5.5), coef: 420, stagger: 40, attack: 'back' }), S(0.4, 'blade'), S(0.9, 'blade'),
      A(1.65, 'appear', 0.2), A(1.75, 'slash_v', 0.7), H(2.0, { ...circle(6), coef: 340, stagger: 40, wp: 3, knock: 'down', heavy: true }), FX(2.0, 'surge_burst', { color: V, r: 6, big: true }), K(2.0, 1), S(2.0, 'explosion_big'),
    ],
  },
  skills: [
    {
      id: 'blitz_rush', name: 'Blitz Rush', type: 'charge', cd: 14, mp: 100, chargeTime: 0.8, perfect: [0.7, 1.0], perfectMul: 1.2, dur: 0.6, superArmor: 'push',
      desc: 'Coil like a spring, then blitz through the enemy in a flurry of cuts. Back Attack. Release in the gold zone for a Perfect rush.', props: { stagger: 'High', attack: 'back', superArmor: 'push' },
      onStart: r => r.u.model?.play?.('charge_hold', { loop: true }),
      events: [A(0, 'dash_strike', 0.6), phase(0, 0.4), M(0, 'dash', 6.5, 0.2, { iframes: 0.25 }), FX(0, 'shadow_dash', { color: D, len: 6.5 }), S(0, 'dash'),
        ...hits(3, 0.18, 0.07, { ...rect(7, 2.6, -6.8), coef: 48.6, stagger: 20, attack: 'back' }), FX(0.18, 'slash', { at: -3, color: D, r: 3, arc: 200 }), K(0.2, 0.3), S(0.18, 'slash_heavy')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['keen', 'crushing', 'unstoppable'],
        [{ id: 'return_blitz', name: 'Return Blitz', desc: 'Blitz straight back through the enemy (+60% damage).', apply: d => { addEv(d.events, phase(0.42, 0.4), M(0.42, 'back', 6.5, 0.2, { iframes: 0.25 }), ...hits(2, 0.58, 0.07, { ...rect(7, 2.6), coef: 29.2, stagger: 8, attack: 'back' }), FX(0.42, 'shadow_dash', { color: D, len: 6.5 })); d.dur = 0.85; } },
          { id: 'overcharge', name: 'Overcharge', desc: 'Perfect release damage +50%.', apply: d => { d.perfectMul *= 1.5; } }]],
    },
    {
      id: 'spincutter', name: 'Spincutter', type: 'normal', cd: 8, mp: 65, dur: 0.65,
      desc: 'Glide forward spinning both blades around you.', props: { stagger: 'Mid' },
      events: [A(0, 'spin', 0.65), M(0.02, 'dash', 3, 0.5), ...hits(4, 0.1, 0.12, { ...circle(3.2), coef: 28.8, stagger: 10 }), FX(0.1, 'slash', { color: D, r: 3.2, arc: 360, spin: true }), FX(0.34, 'slash', { color: D, r: 3.2, arc: 360, spin: true, flip: true }), S(0.1, 'whoosh')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['bleed', 'wide', 'keen'],
        [{ id: 'spinning_blades', name: 'Spinning Blades', desc: 'Leave a whirl of spectral blades behind for 3 s.', apply: d => { addEv(d.events, Z(0.5, { r: 3, dur: 3, tick: 0.3, kind: 'blades', hit: { coef: 1.4, stagger: 1 } })); } }, 'enhanced:0.4']],
    },
    {
      id: 'maelstrom', name: 'Maelstrom', type: 'normal', cd: 10, mp: 80, dur: 0.85, superArmor: 'push',
      desc: 'Become a whirlpool of steel that drags nearby enemies into the cuts.', props: { stagger: 'Mid', superArmor: 'push' },
      events: [A(0, 'spin_loop', 0.85), H(0.1, { ...circle(4.2), coef: 3.6, stagger: 3, knock: 'pull', kb: 2.5 }), ...hits(5, 0.2, 0.12, { ...circle(3.6), coef: 30.6, stagger: 12 }), FX(0.1, 'blade_vortex', { color: D, r: 3.8, dur: 0.8, follow: true }), S(0.1, 'whoosh_big')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['bleed', 'keen', 'stance'],
        [{ id: 'eye_of_the_maelstrom', name: 'Eye of the Maelstrom', desc: 'The whirl ends in an eruption of shadow (+60% damage).', apply: d => { addEv(d.events, H(0.85, { ...circle(4.4), coef: 19.8, stagger: 8, knock: 'push', kb: 2 }), FX(0.85, 'shockwave', { color: D, r: 4.4 })); d.dur = 1.0; } }, 'enhanced:0.4']],
    },
    {
      id: 'void_strike', name: 'Void Strike', type: 'normal', cd: 18, mp: 125, dur: 1.0, cancelAt: 0.8, superArmor: 'push',
      desc: 'Lock the blades into the greatblade and bring it down with the weight of the void. Very high stagger.', props: { stagger: 'Very High', wp: 2, superArmor: 'push' },
      events: [A(0, 'slash_v', 1.0), FX(0.1, 'blade_merge', { color: V, r: 1.5 }), S(0.1, 'whoosh'), M(0.3, 'dash', 1.5, 0.15),
        H(0.52, { ...rect(5.8, 3.4), coef: 59.4, stagger: 64, wp: 2, knock: 'down', heavy: true }), FX(0.52, 'ground_crack', { color: V, len: 5.8 }), FX(0.52, 'slash', { color: V, r: 4, arc: 60, vertical: true, big: true }), K(0.52, 0.55), S(0.52, 'impact_heavy')],
      tripods: [['quick_prep', 'weak_point', 'swift'], ['crushing', 'unstoppable', 'keen'],
        [{ id: 'rift_rend', name: 'Rift Rend', desc: 'The strike tears a rift that detonates a moment later (+50% damage).', apply: d => { addEv(d.events, H(0.95, { ...rect(7, 3.6), coef: 29.7, stagger: 12 }), FX(0.95, 'void_implosion', { at: 3.5, color: D, r: 3.5 })); d.dur = 1.15; } }, 'enhanced:0.4']],
    },
    {
      id: 'death_trance', name: 'Death Trance', type: 'normal', cd: 24, mp: 65, dur: 0.6, fixedSpeed: true,
      desc: 'Slip into a killing trance: Attack and Move Speed +20% and Crit Rate +12% for 10 s.', props: { stagger: 'Low' },
      events: [A(0, 'buff', 0.6), B(0.2, { target: 'self', id: 'death_trance', dur: 10, mods: { atkSpd: 0.2, moveSpd: 0.2, crit: 0.12 }, name: 'Death Trance', icon: 'skill:bladedancer:death_trance' }), FX(0.2, 'dark_aura', { color: D, r: 1.6 }), H(0.25, { ...circle(3), coef: 7.2, stagger: 4 }), FX(0.25, 'shockwave', { color: D, r: 3 }), S(0.2, 'buff')],
      tripods: [['quick_prep', 'mana_saver', 'wide'], [{ id: 'bloodlust_trance', name: 'Deep Trance', desc: 'The trance lasts 14 s.', apply: d => { evs(d.events, 'buff')[0].dur = 14; } }, 'keen', 'enhanced:1'],
        [{ id: 'reaper_trance', name: 'Reaper Trance', desc: 'The trance also grants Damage +8%.', apply: d => { evs(d.events, 'buff')[0].mods.dmgMul = 0.08; } }, { id: 'surge_trance', name: 'Surge Trance', desc: 'Entering the trance charges half a Surge orb.', apply: d => { addEv(d.events, C(0.2, run => { const st = run.u.kit?.identity?.state; if (st && st.orbs < 3) { st.v += 50; while (st.v >= 100 && st.orbs < 3) { st.v -= 100; st.orbs++; } } })); } }]],
    },
    {
      id: 'moonlight_sonic', name: 'Moonlight Sonic', type: 'normal', cd: 12, mp: 90, dur: 0.7,
      desc: 'A spinning crescent cut that sends a ring of moonlight rolling outward.', props: { stagger: 'Mid' },
      events: [A(0, 'spin', 0.7), H(0.28, { ...circle(4.6), coef: 34.2, stagger: 12 }), FX(0.28, 'moon_ring', { color: 'silver', r: 4.6 }), FX(0.28, 'slash', { color: V, r: 4.6, arc: 360, spin: true }), S(0.28, 'slash_heavy')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['keen', 'bleed', 'crushing'],
        [{ id: 'crescent_echo', name: 'Crescent Echo', desc: 'A second, wider ring follows (+60% damage).', apply: d => { addEv(d.events, H(0.6, { ...circle(6), coef: 20.5, stagger: 6 }), FX(0.6, 'moon_ring', { color: 'silver', r: 6 })); d.dur = 0.85; } }, 'enhanced:0.4']],
    },
    {
      id: 'soul_absorber', name: 'Soul Absorber', type: 'normal', cd: 16, mp: 110, dur: 0.85, superArmor: 'push',
      desc: 'Sweep the greatblade in a full circle that drinks the souls of those it cuts. Back Attack.', props: { stagger: 'High', attack: 'back', superArmor: 'push' },
      events: [A(0, 'spin', 0.85), FX(0.1, 'blade_merge', { color: V, r: 1.5 }), H(0.4, { ...circle(4.4), coef: 55.8, stagger: 18, attack: 'back', heavy: true }), FX(0.4, 'slash', { color: V, r: 4.4, arc: 360, spin: true, big: true }), FX(0.4, 'soul_drain', { color: D, r: 4.4 }), K(0.4, 0.35), S(0.4, 'slash_heavy')],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['keen', 'crushing', 'wide'],
        [{ id: 'soul_harvest', name: 'Soul Harvest', desc: 'Each enemy struck restores 2% of your max HP and the cut deals +25% damage.', apply: d => { const h = evs(d.events, 'hit')[0]; h.coef *= 1.25; addEv(d.events, C(0.42, (run, L) => { run.u.hp = Math.min(run.u.hpMax, run.u.hp + run.u.hpMax * 0.02); })); } }, 'enhanced:0.4']],
    },
    {
      id: 'wind_cut', name: 'Wind Cut', type: 'chain', cd: 10, mp: 65, chainWindow: 2,
      desc: 'Up to three cutting dashes; press again after each one.', props: { stagger: 'Mid' },
      stages: [
        { dur: 0.36, window: 0.2, events: [A(0, 'slash_h', 0.36), phase(0, 0.25), M(0, 'dash', 3.6, 0.16), H(0.14, { ...rect(3.6, 2.6, -3.2), coef: 9, stagger: 4 }), FX(0.14, 'slash', { color: D, r: 3, arc: 140 }), S(0.14, 'blade')] },
        { dur: 0.36, window: 0.2, events: [A(0, 'slash_x', 0.36), phase(0, 0.25), M(0, 'dash', 3.6, 0.16), H(0.14, { ...rect(3.6, 2.6, -3.2), coef: 9, stagger: 4 }), FX(0.14, 'slash', { color: D, r: 3, arc: 140, flip: true }), S(0.14, 'blade')] },
        { dur: 0.55, events: [A(0, 'slash_v', 0.55), M(0, 'dash', 2, 0.14), H(0.22, { ...cone(3.4, 140), coef: 15.3, stagger: 7, knock: 'down' }), FX(0.22, 'slash', { color: V, r: 3.4, arc: 140, vertical: true }), S(0.22, 'slash_heavy')] },
      ],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['bleed', 'keen', 'back'],
        [{ id: 'gale_finale', name: 'Gale Finale', desc: 'The last cut launches a blade of wind 8 m forward (+50% damage).', apply: d => { addEv(d.stages[2].events, P(0.24, { speed: 28, range: 8, radius: 1.4, pierce: 99, kind: 'wind_blade', color: D, hit: { coef: 16.7, stagger: 4 } })); } }, 'enhanced:0.4']],
    },
    {
      id: 'dark_order', name: 'Dark Order', type: 'normal', cd: 12, mp: 80, dur: 0.95,
      desc: 'Hurl both blades: they carve outward 8 m and whirl back to your hands.', props: { stagger: 'Mid' },
      events: [A(0, 'throw_weapon', 0.95), P(0.2, { speed: 24, range: 8, radius: 1.3, pierce: 99, count: 2, spread: 0.25, kind: 'spinning_blade', color: D, hit: { coef: 10.8, stagger: 5 } }), S(0.2, 'whoosh'),
        H(0.75, { ...rect(8.5, 2.6), coef: 19.8, stagger: 6 }), FX(0.75, 'blade_return', { color: D, len: 8.5 }), S(0.75, 'blade')],
      tripods: [['quick_prep', 'weak_point', 'wide'], ['bleed', 'keen', 'pull'],
        [{ id: 'tri_blade', name: 'Third Blade', desc: 'A third, larger blade is thrown (+45% damage).', apply: d => { const p = evs(d.events, 'proj')[0]; p.count = 3; p.spread = 0.45; p.hit.coef *= 1.3; evs(d.events, 'hit')[0].coef *= 1.5; } }, 'enhanced:0.4']],
    },
    {
      id: 'upper_slash', name: 'Upper Slash', type: 'normal', cd: 10, mp: 65, dur: 0.6, superArmor: 'push',
      desc: 'A rising slash that interrupts and launches. Counter.', props: { stagger: 'High', counter: true, superArmor: 'push' },
      events: [A(0, 'slash_up', 0.6), H(0.2, { ...cone(3.4, 120), coef: 23.4, stagger: 18, counter: true, knock: 'up' }), FX(0.2, 'slash', { color: V, r: 3.4, arc: 120, vertical: true }), K(0.2, 0.25), S(0.2, 'slash_heavy')],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['crushing', 'keen', 'bleed'],
        [{ id: 'skyfall', name: 'Skyfall', desc: 'Leap after the enemy and slam it back down (+70% damage).', apply: d => { addEv(d.events, A(0.45, 'leap', 0.25), M(0.45, 'dash', 0.5, 0.2, { height: 1.5 }), A(0.65, 'slam', 0.35), H(0.72, { ...circle(3), coef: 16.4, stagger: 8, knock: 'down' }), FX(0.72, 'crater', { color: D, r: 3 })); d.dur = 1.0; } }, 'enhanced:0.5']],
    },
    {
      id: 'blade_dance', name: 'Blade Dance', type: 'holding', cd: 14, mp: 100, holdMax: 2.0, superArmor: 'push',
      desc: 'Hold to become a blur of blades cutting everything ahead; release for a crossing finisher.', props: { stagger: 'Mid', superArmor: 'push' },
      onStart: r => r.u.model?.play?.('spin_loop', { loop: true }),
      events: [],
      loop: { every: 0.1, walk: 1.5, events: [H(0, { ...cone(3.4, 150), coef: 2.1, stagger: 1.2 }), FX(0, 'slash', { color: D, r: 3.2, arc: 120 }), S(0, 'blade')] },
      end: [A(0, 'slash_x', 0.45), H(0.16, { ...cone(3.6, 150), coef: 12.6, stagger: 6, knock: 'push', kb: 2, heavy: true }), FX(0.16, 'slash', { color: V, r: 3.6, arc: 150, big: true }), S(0.16, 'slash_heavy')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['bleed', 'keen', 'stance'],
        [{ id: 'crimson_waltz', name: 'Shadow Waltz', desc: 'The finisher becomes a triple cross cut (+150% damage).', apply: d => { const h = evs(d.end, 'hit')[0]; h.coef *= 2.5; addEv(d.end, FX(0.26, 'slash', { color: V, r: 3.6, arc: 150, flip: true, big: true })); } }, 'enhanced:0.4']],
    },
    {
      id: 'shadow_step', name: 'Shadow Step', type: 'normal', cd: 12, mp: 65, dur: 0.6,
      desc: 'Melt into shadow and reappear behind the nearest enemy with a vicious cut. Back Attack.', props: { stagger: 'Mid', attack: 'back' },
      events: [A(0, 'vanish', 0.12), FX(0, 'shadow_burst', { color: D, r: 1.2 }), S(0, 'vanish'), M(0.1, 'blink', 0, 0, { to: 'behind' }), reaim(0.105), A(0.11, 'appear', 0.12), FX(0.11, 'shadow_burst', { color: D, r: 1.2 }),
        A(0.2, 'slash_x', 0.4), H(0.3, { ...cone(3.2, 130), coef: 28.8, stagger: 10, attack: 'back' }), FX(0.3, 'slash', { color: D, r: 3.2, arc: 130 }), S(0.3, 'blade')],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['keen', 'bleed', 'crushing'],
        [{ id: 'assassinate', name: 'Assassinate', desc: 'The cut deals +20% damage, and a further +35% to enemies below 30% HP.', apply: d => { const h = evs(d.events, 'hit')[0]; h.coef *= 1.2; d.executeBonus = 0.35; } }, 'enhanced:0.4']],
    },
  ],
  defaultBar: ['blitz_rush', 'death_trance', 'void_strike', 'soul_absorber', 'wind_cut', 'upper_slash', 'blade_dance', 'shadow_step'],
  engravings: [
    { id: 'afterglow', name: 'Afterglow', desc: 'Surge leaves lingering spectral blades behind the target for 3 s. Back Attack damage +8%.', mods: { backMul: 0.08 } },
    { id: 'stormsurge', name: 'Stormsurge', desc: 'Surge orbs charge 50% faster; a three-orb Surge deals +25% damage.', mods: { identityGain: 0.5 } },
  ],
});
