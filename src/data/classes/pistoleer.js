// PISTOLEER — gunner (DPS) who weaves three weapons. Every skill belongs to a stance (pistol · shotgun · rifle); casting
// it swaps weapons instantly with a Quickdraw damage bonus (identity handler 'pistoleer'). X fires Deadeye Focus when the
// Focus gauge is full. Basic attacks follow the weapon in hand.
import { A, H, FX, S, K, M, P, Z, C, circle, cone, rect, hits } from '../../game/skills/dsl.js';
import { resolveHit } from '../../game/combat.js';
import { hasEngr, evs, addEv, finalize } from './common.js';

const G = 'gold', F = 'fire', W = 'white';
const stanceIs = s => run => run.u.kit?.identity?.state?.stance === s;
const stanceNot = s => run => run.u.kit?.identity?.state?.stance !== s;
const bullet = (t, o = {}) => P(t, { speed: 42, range: 13, radius: 0.55, kind: 'bullet', color: G, ...o });

const skills = [
  // ---------------------------------------------------------------- pistol
  {
    id: 'quick_shot', name: 'Quick Shot', type: 'normal', stance: 'pistol', cd: 5, mp: 40, dur: 0.72,
    desc: 'Hop back and empty both pistols into the target: four quick shots.', props: { stagger: 'Low' },
    events: [A(0, 'dash_back', 0.25), M(0, 'back', 3, 0.2, { iframes: 0.15 }), A(0.2, 'shoot_dual', 0.5),
      bullet(0.26, { hit: { coef: 4, stagger: 2 } }), bullet(0.34, { hit: { coef: 4, stagger: 2 } }), bullet(0.42, { hit: { coef: 4, stagger: 2 } }), bullet(0.5, { hit: { coef: 4, stagger: 2 } }), S(0.26, 'gunshot'), S(0.42, 'gunshot')],
    tripods: [['quick_prep', 'mobility', 'weak_point'], ['keen', 'pierce', { id: 'hollow_point', name: 'Hollow Point', desc: 'Bullets burst on impact, hitting everything within 2 m (+40% damage).', apply: d => { for (const p of evs(d.events, 'proj')) p.hit = { ...p.hit, shape: 'circle', r: 2, coef: p.hit.coef * 1.4 }; } }],
      [{ id: 'double_tap', name: 'Double Tap', desc: 'Fire eight shots instead of four (each 70% damage).', apply: d => { const ps = evs(d.events, 'proj'); for (const p of ps) p.hit.coef *= 0.7; addEv(d.events, ...ps.map(p => ({ ...p, t: p.t + 0.04, hit: { ...p.hit } }))); } }, 'enhanced:0.4']],
  },
  {
    id: 'spiral_tracker', name: 'Spiral Tracker', type: 'normal', stance: 'pistol', cd: 10, mp: 65, dur: 0.6,
    desc: 'Fire three spinning rounds that curve toward the nearest enemy.', props: { stagger: 'Low' },
    events: [A(0, 'shoot_dual', 0.6), P(0.2, { speed: 24, range: 16, radius: 0.8, kind: 'tracer', color: G, count: 3, spread: 0.9, homing: true, turn: 7, hit: { coef: 9, stagger: 3 } }), S(0.2, 'gunshot'), FX(0.2, 'muzzle_flash', { color: G, r: 1 })],
    tripods: [['quick_prep', 'weak_point', 'keen'], ['pierce', 'shock', { id: 'swarm', name: 'Swarm', desc: 'Fire five tracking rounds (each 75% damage).', apply: d => { const p = evs(d.events, 'proj')[0]; p.count = 5; p.spread = 1.3; p.hit.coef *= 0.75; } }],
      [{ id: 'exploding_rounds', name: 'Exploding Rounds', desc: 'Rounds explode in a 2.5 m blast (+50% damage).', apply: d => { const p = evs(d.events, 'proj')[0]; p.hit = { ...p.hit, shape: 'circle', r: 2.5, coef: p.hit.coef * 1.5, elem: 'fire' }; } }, 'enhanced:0.4']],
  },
  {
    id: 'equilibrium', name: 'Equilibrium', type: 'holding', stance: 'pistol', cd: 12, mp: 95, holdMax: 2.4,
    desc: 'Hold to spin in place firing both pistols in every direction; you can walk slowly.', props: { stagger: 'Low' },
    onStart: r => r.u.model?.play?.('shoot_loop', { loop: true }),
    events: [],
    loop: { every: 0.15, walk: 1.8, events: [H(0, { ...circle(5.5), coef: 2.2, stagger: 1 }), FX(0, 'gun_spin', { color: G, r: 5.5 }), S(0, 'gunshot')] },
    end: [A(0, 'shoot_dual', 0.35), H(0.1, { ...circle(5.5), coef: 6.6, stagger: 4, knock: 'push', kb: 1.5 }), FX(0.1, 'shockwave', { color: G, r: 5.5 })],
    tripods: [['quick_prep', 'mobility', 'weak_point'], ['keen', 'stance', 'wide'],
      [{ id: 'steady_aim', name: 'Steady Aim', desc: 'Aim every shot forward instead: a 60° cone reaching 8 m with +50% damage.', apply: d => { const h = evs(d.loop.events, 'hit')[0]; Object.assign(h, { shape: 'cone', r: 8, angle: Math.PI / 3, coef: h.coef * 1.5 }); } }, 'enhanced:0.4']],
  },
  {
    id: 'dexterous_shot', name: 'Dexterous Shot', type: 'combo', stance: 'pistol', cd: 8, mp: 65,
    desc: 'Two flashy pistol volleys, then a spinning kick with a point-blank shot.', props: { stagger: 'Mid' },
    stages: [
      { dur: 0.36, window: 0.12, events: [A(0, 'shoot_dual', 0.36), bullet(0.1, { count: 2, spread: 0.12, hit: { coef: 3.7, stagger: 2 } }), S(0.1, 'gunshot')] },
      { dur: 0.36, window: 0.12, events: [A(0, 'shoot_dual', 0.36), bullet(0.1, { count: 2, spread: 0.12, hit: { coef: 3.7, stagger: 2 } }), S(0.1, 'gunshot')] },
      { dur: 0.6, events: [A(0, 'kick_spin', 0.6), H(0.2, { ...circle(2.8), coef: 6.6, stagger: 5, knock: 'push', kb: 1.5 }), FX(0.2, 'slash', { color: G, r: 2.8, arc: 300, spin: true }), S(0.2, 'kick'),
        bullet(0.38, { hit: { coef: 9.8, stagger: 4 } }), FX(0.38, 'muzzle_flash', { color: G, r: 1.2 }), S(0.38, 'gunshot_heavy')] },
    ],
    tripods: [['quick_prep', 'swift', 'weak_point'], ['keen', 'pierce', { id: 'dual_volley', name: 'Dual Volley', desc: 'The volleys fire four rounds each (+50% damage).', apply: d => { for (const s of d.stages.slice(0, 2)) { const p = evs(s.events, 'proj')[0]; p.count = 4; p.spread = 0.3; p.hit.coef *= 0.75; } } }],
      [{ id: 'finishing_round', name: 'Finishing Round', desc: 'The point-blank round knocks down and deals +80% damage.', apply: d => { const p = evs(d.stages[2].events, 'proj')[0]; p.hit.coef *= 1.8; p.hit.knock = 'down'; } }, 'enhanced:0.4']],
  },
  // ---------------------------------------------------------------- shotgun
  {
    id: 'dual_buckshot', name: 'Dual Buckshot', type: 'combo', stance: 'shotgun', cd: 9, mp: 75, superArmor: 'push',
    desc: 'Two thunderous shotgun blasts, stepping in between. Back Attack.', props: { stagger: 'Mid', attack: 'back', superArmor: 'push' },
    stages: [
      { dur: 0.5, window: 0.2, events: [A(0, 'shotgun', 0.5), H(0.16, { ...cone(5.2, 60), coef: 13.9, stagger: 7, attack: 'back', knock: 'push', kb: 1 }), FX(0.16, 'shotgun_blast', { color: G, r: 5.2, arc: 60 }), K(0.16, 0.2), S(0.16, 'shotgun')] },
      { dur: 0.6, events: [M(0, 'dash', 1.4, 0.12), A(0.05, 'shotgun', 0.55), H(0.22, { ...cone(5.2, 60), coef: 17.2, stagger: 8, attack: 'back', knock: 'push', kb: 1.5 }), FX(0.22, 'shotgun_blast', { color: G, r: 5.2, arc: 60 }), K(0.22, 0.25), S(0.22, 'shotgun')] },
    ],
    tripods: [['quick_prep', 'swift', 'weak_point'], ['keen', 'crushing', 'wide'],
      [{ id: 'slug_shells', name: 'Slug Shells', desc: 'Load slugs: a narrow 7 m line that deals +60% damage.', apply: d => { for (const s of d.stages) for (const h of evs(s.events, 'hit')) Object.assign(h, { shape: 'rect', len: 7, width: 1.8, coef: h.coef * 1.6 }); } }, 'enhanced:0.4']],
  },
  {
    id: 'shotgun_rapid_fire', name: 'Shotgun Rapid Fire', type: 'holding', stance: 'shotgun', cd: 12, mp: 95, holdMax: 2.1, superArmor: 'push',
    desc: 'Hold to pump out shotgun blasts as fast as the action cycles.', props: { stagger: 'Mid', superArmor: 'push' },
    onStart: r => r.u.model?.play?.('shotgun', { dur: 0.35 }),
    events: [],
    loop: { every: 0.35, walk: 0.8, events: [A(0, 'shotgun', 0.35), H(0.02, { ...cone(5.2, 60), coef: 6.2, stagger: 3.5, knock: 'push', kb: 0.5 }), FX(0.02, 'shotgun_blast', { color: G, r: 5.2, arc: 60 }), S(0.02, 'shotgun')] },
    end: [A(0, 'shotgun', 0.4), H(0.12, { ...cone(5.5, 70), coef: 9.8, stagger: 6, knock: 'push', kb: 2, heavy: true }), FX(0.12, 'shotgun_blast', { color: G, r: 5.5, arc: 70, big: true }), K(0.12, 0.3), S(0.12, 'shotgun')],
    tripods: [['quick_prep', 'mobility', 'weak_point'], ['keen', 'burn', 'stance'],
      [{ id: 'dragonfire_shells', name: 'Dragonfire Shells', desc: 'Every blast sets the ground ablaze (burning zone for 3 s).', apply: d => { const l = d.loop.events; l.push(Z(0.05, { at: 3, r: 2.4, dur: 3, tick: 0.5, kind: 'fire', hit: { coef: 0.7, elem: 'fire' } })); for (const h of evs(l, 'hit')) h.elem = 'fire'; } }, 'enhanced:0.4']],
  },
  {
    id: 'last_request', name: 'Last Request', type: 'normal', stance: 'shotgun', cd: 12, mp: 85, dur: 0.95, cancelAt: 0.75, superArmor: 'push',
    desc: 'A snap kick, then a point-blank shotgun blast. Counter.', props: { stagger: 'High', counter: true, superArmor: 'push' },
    events: [A(0, 'kick_high', 0.35), H(0.15, { ...cone(2.8, 90), coef: 7.4, stagger: 10, counter: true, knock: 'push', kb: 1.2 }), FX(0.15, 'slash', { color: W, r: 2.4, arc: 80 }), S(0.15, 'kick'),
      A(0.35, 'shotgun', 0.6), H(0.52, { ...cone(5, 70), coef: 23, stagger: 14, counter: true, knock: 'push', kb: 3, heavy: true }), FX(0.52, 'shotgun_blast', { color: G, r: 5, arc: 70, big: true }), K(0.52, 0.35), S(0.52, 'shotgun')],
    tripods: [['quick_prep', 'swift', 'weak_point'], ['crushing', 'keen', 'stance'],
      [{ id: 'final_verdict', name: 'Final Verdict', desc: 'The blast deals +80% damage and knocks enemies down.', apply: d => { const h = evs(d.events, 'hit')[1]; h.coef *= 1.8; h.knock = 'down'; } }, 'enhanced:0.4']],
  },
  {
    id: 'dragon_shot', name: 'Dragon Shot', type: 'normal', stance: 'shotgun', cd: 10, mp: 75, dur: 0.7,
    desc: 'Fire a flaming slug that bursts into a roaring dragon of fire on impact.', props: { stagger: 'Mid' },
    events: [A(0, 'shotgun', 0.7), P(0.22, { speed: 30, range: 11, radius: 0.8, kind: 'flame_slug', color: F, hit: { shape: 'circle', r: 3, coef: 25.1, stagger: 10, elem: 'fire' } }), FX(0.22, 'muzzle_flash', { color: F, r: 1.4 }), S(0.22, 'shotgun'), M(0.24, 'back', 1, 0.15)],
    tripods: [['quick_prep', 'weak_point', 'wide'], ['burn', 'keen', 'crushing'],
      [{ id: 'dragon_breath', name: 'Dragon Breath', desc: 'The burst leaves a 3.5 m sea of flame for 4 s.', apply: d => { const p = evs(d.events, 'proj')[0]; p.onEnd = (pr, L, run) => { L.groundZone({ src: run.u, x: pr.x, z: pr.z, r: 3.5, dur: 4, tick: 0.5, first: 0.3, kind: 'fire', hit: { coef: 1.5, elem: 'fire' }, ctx: { ...run.ctx, hitSet: null } }); }; } }, 'enhanced:0.4']],
  },
  // ---------------------------------------------------------------- rifle
  {
    id: 'focused_shot', name: 'Focused Shot', type: 'casting', stance: 'rifle', cd: 16, mp: 115, cast: 0.8, dur: 0.5,
    desc: 'Steady the rifle, then fire a round that punches through every enemy in line.', props: { stagger: 'High' },
    onStart: r => r.u.model?.play?.('rifle_aim', { loop: true }),
    events: [A(0, 'rifle_fire', 0.5), P(0.02, { speed: 64, range: 18, radius: 0.9, pierce: 99, kind: 'rifle_round', color: G, hit: { coef: 47.6, stagger: 18, heavy: true } }), FX(0.02, 'muzzle_flash', { color: G, r: 1.8, big: true }), K(0.02, 0.25), S(0.02, 'rifle'), M(0.05, 'back', 1, 0.15)],
    tripods: [['quick_prep', 'keen', 'weak_point'], ['crushing', 'swift', { id: 'quick_aim', name: 'Quick Aim', desc: 'Aiming time −50%.', apply: d => { d.cast *= 0.5; } }],
      [{ id: 'armor_piercer', name: 'Armor Piercer', desc: 'Struck enemies take 12% more damage from all sources for 8 s.', apply: d => { const p = evs(d.events, 'proj')[0]; p.hit.status = [{ id: 'armor_break', dur: 8 }]; } }, 'enhanced:0.4']],
  },
  {
    id: 'perfect_shot', name: 'Perfect Shot', type: 'charge', stance: 'rifle', cd: 20, mp: 135, chargeTime: 1.5, perfect: [0.85, 1.0], perfectMul: 1.3, dur: 0.6, superArmor: 'push',
    desc: 'Take aim and hold your breath; release in the gold zone for a devastating Perfect shot. Very high stagger.', props: { stagger: 'Very High', wp: 2, superArmor: 'push' },
    onStart: r => r.u.model?.play?.('rifle_aim', { loop: true }),
    events: [A(0, 'rifle_fire', 0.6), P(0, { speed: 80, range: 18, radius: 1.2, pierce: 99, kind: 'rifle_round', color: G, hit: { coef: 72.2, stagger: 62, wp: 2, heavy: true } }), FX(0, 'muzzle_flash', { color: G, r: 2.2, big: true }), K(0, 0.45), S(0, 'rifle'), M(0.02, 'back', 1.4, 0.18)],
    tripods: [['quick_prep', 'keen', 'weak_point'], ['crushing', 'unstoppable', 'swift'],
      [{ id: 'deadeye', name: 'Deadeye', desc: 'Perfect release damage +50%.', apply: d => { d.perfectMul *= 1.5; } },
        { id: 'penetrator', name: 'Penetrator', desc: 'The round detonates where it stops: a 4 m blast for +40% damage.', apply: d => { const p = evs(d.events, 'proj')[0]; const coef = p.hit.coef * 0.4; p.onEnd = (pr, L, run) => { L.emit('fx', { unit: run.u, preset: 'explosion', x: pr.x, z: pr.z, dx: pr.dx, dz: pr.dz, ev: { color: 'fire', r: 4 } }); resolveHit(L, run.u, { shape: 'circle', r: 4, coef, stagger: 10, elem: 'fire' }, pr.x, pr.z, pr.dx, pr.dz, { ...run.ctx, hitSet: null }); }; } }]],
  },
  {
    id: 'target_down', name: 'Target Down', type: 'point', stance: 'rifle', cd: 18, mp: 115, range: 12, dur: 1.35, cancelAt: 1.2,
    desc: 'Mark a target area and put three rifle rounds through it.', props: { stagger: 'High', wp: 1 },
    events: [A(0, 'rifle_aim', 1.35), FX(0, 'crosshair', { at: 'point', color: 'red', r: 2.4 }),
      H(0.42, { ...circle(2.4), at: 'point', coef: 15.5, stagger: 7 }), FX(0.42, 'bullet_impact', { at: 'point', color: G, r: 2.4 }), S(0.42, 'rifle'),
      H(0.82, { ...circle(2.4), at: 'point', coef: 15.5, stagger: 7 }), FX(0.82, 'bullet_impact', { at: 'point', color: G, r: 2.4 }), S(0.82, 'rifle'),
      H(1.22, { ...circle(2.8), at: 'point', coef: 25.1, stagger: 10, wp: 1, heavy: true }), FX(1.22, 'bullet_impact', { at: 'point', color: G, r: 2.8, big: true }), K(1.22, 0.3), S(1.22, 'rifle')],
    tripods: [['quick_prep', 'weak_point', 'wide'], ['keen', 'crushing', { id: 'rapid_sights', name: 'Rapid Sights', desc: 'Fire the three rounds twice as fast.', apply: d => { for (const e of d.events) if (e.t > 0) e.t = e.t * 0.55; d.dur = 0.8; d.cancelAt = 0.7; } }],
      [{ id: 'fourth_round', name: 'Fourth Round', desc: 'Chamber a fourth, explosive round (+40% damage).', apply: d => { addEv(d.events, H(1.5, { ...circle(3.4), at: 'point', coef: 22.3, stagger: 8, elem: 'fire' }), FX(1.5, 'explosion', { at: 'point', color: F, r: 3.4 }), S(1.5, 'explosion')); d.dur = 1.6; d.cancelAt = 1.5; } }, 'enhanced:0.4']],
  },
  {
    id: 'catastrophe', name: 'Catastrophe', type: 'point', stance: 'rifle', cd: 24, mp: 145, range: 14, dur: 0.8, cancelAt: 0.6,
    desc: 'Fire a flare into the sky; a barrage of shells rains on the target area, then a final blast.', props: { stagger: 'High', wp: 1 },
    events: [A(0, 'rifle_fire', 0.8), FX(0, 'flare_shot', { color: 'red', r: 1 }), S(0, 'rifle'), FX(0.3, 'barrage', { at: 'point', color: F, r: 4.2, dur: 1.8 }),
      Z(0.3, { at: 'point', r: 4.2, dur: 1.7, tick: 0.2, first: 0.4, kind: 'barrage', hit: { coef: 6.1, stagger: 3, elem: 'fire' } }),
      H(2.2, { ...circle(4.8), at: 'point', coef: 21.2, stagger: 12, wp: 1, elem: 'fire', heavy: true }), FX(2.2, 'explosion', { at: 'point', color: F, r: 4.8, big: true }), K(2.2, 0.4), S(2.2, 'explosion_big')],
    tripods: [['quick_prep', 'wide', 'weak_point'], ['burn', 'keen', 'stance'],
      [{ id: 'carpet_bomb', name: 'Carpet Bomb', desc: 'The barrage lasts 60% longer.', apply: d => { const z = evs(d.events, 'zone')[0]; z.dur *= 1.6; } }, 'enhanced:0.4']],
  },
];

// Longshot (class engraving): rifle skills hit much harder, pistol and shotgun skills weaker.
for (const s of skills) {
  const prev = s.onStart;
  s.onStart = run => { prev?.(run); if (hasEngr(run.u.kit, 'longshot')) run.mult *= s.stance === 'rifle' ? 1.4 : 0.8; };
}

export default finalize({
  id: 'pistoleer', name: 'Pistoleer', archetype: 'Gunner', role: 'dps', weapon: 'pistols', difficulty: 3,
  blurb: 'A duelist who juggles twin pistols, a shotgun and a long rifle mid-fight. Every skill swaps the weapon in hand; master the rhythm and the Pistoleer never stops firing.',
  palette: { main: 0xe0913a, glow: [3, 1.8, 0.6], fx: G },
  dash: { cd: 8, dist: 5.6, dur: 0.26 },
  stats: { hp: 0.95, atk: 1.0, def: 0.95 },
  basic: [
    { anim: 'atk1', dur: 0.32, hit: { t: 0.12, ...cone(4.6, 60), coef: 1.3, stagger: 2, if: stanceIs('shotgun') }, proj: { t: 0.12, speed: 44, range: 13, radius: 0.5, kind: 'bullet', color: G, hit: { coef: 1.0, stagger: 1 }, if: stanceNot('shotgun') }, fx: { t: 0.12, preset: 'muzzle_flash', color: G, r: 0.8 }, sfx: 'gunshot' },
    { anim: 'atk2', dur: 0.32, hit: { t: 0.12, ...cone(4.6, 60), coef: 1.3, stagger: 2, if: stanceIs('shotgun') }, proj: { t: 0.12, speed: 44, range: 13, radius: 0.5, kind: 'bullet', color: G, hit: { coef: 1.0, stagger: 1 }, if: stanceNot('shotgun') }, fx: { t: 0.12, preset: 'muzzle_flash', color: G, r: 0.8 }, sfx: 'gunshot' },
    { anim: 'atk3', dur: 0.5, hit: { t: 0.22, ...cone(5, 70), coef: 2.2, stagger: 3, knock: 'push', kb: 1, if: stanceIs('shotgun') }, proj: { t: 0.22, speed: 50, range: 15, radius: 0.6, pierce: 2, kind: 'bullet', color: G, hit: { coef: 1.8, stagger: 2 }, if: stanceNot('shotgun') }, fx: { t: 0.22, preset: 'muzzle_flash', color: G, r: 1.1 }, sfx: 'gunshot_heavy' },
  ],
  identity: {
    handler: 'pistoleer', kind: 'stance', label: 'Focus', max: 100, gainPerHit: 0.3,
    focus: { dur: 10, mods: { crit: 0.25, critDmg: 0.35, atkSpd: 0.1 } },
  },
  awakening: {
    id: 'last_rites', name: 'Last Rites', type: 'point', cd: 180, uses: 3, range: 14, dur: 2.6, cancelAt: 2.4, superArmor: 'full', fixedSpeed: true,
    desc: 'Leap back and unload every gun you own: a storm of pistol fire, a shotgun volley and a final rifle round that levels the target area.', props: { stagger: 'Very High', wp: 3, superArmor: 'full' },
    events: [
      A(0, 'awaken', 0.4), FX(0, 'awaken_aura', { color: G }), S(0, 'awaken'), M(0.05, 'back', 3, 0.25, { iframes: 2.4 }),
      A(0.35, 'shoot_loop', 0.9, { loop: true }), ...hits(10, 0.4, 0.08, { ...circle(4), at: 'point', coef: 180, stagger: 20 }), FX(0.4, 'barrage', { at: 'point', color: G, r: 4, dur: 0.9 }), S(0.4, 'gunshot'),
      A(1.3, 'shotgun', 0.4), H(1.4, { ...circle(4.4), at: 'point', coef: 160, stagger: 20, knock: 'down' }), FX(1.4, 'shotgun_blast', { color: G, r: 6, arc: 60, big: true }), S(1.4, 'shotgun'),
      A(1.75, 'rifle_fire', 0.8), H(2.05, { ...circle(5.5), at: 'point', coef: 400, stagger: 40, wp: 3, heavy: true }), FX(2.05, 'explosion', { at: 'point', color: F, r: 5.5, big: true }), K(2.05, 1), S(2.05, 'explosion_big'),
    ],
  },
  skills,
  defaultBar: ['dual_buckshot', 'shotgun_rapid_fire', 'last_request', 'dexterous_shot', 'equilibrium', 'spiral_tracker', 'focused_shot', 'perfect_shot'],
  engravings: [
    { id: 'quickdraw', name: 'Quickdraw', desc: 'Swapping weapons by casting grants Quickdraw: +15% damage for 3 s (instead of +6%). Move Speed +5%.', mods: { moveSpd: 0.05 } },
    { id: 'longshot', name: 'Longshot', desc: 'Rifle skills deal +40% damage; pistol and shotgun skills deal −20%. Crit Damage +10%.', mods: { critDmg: 0.1 } },
  ],
});
