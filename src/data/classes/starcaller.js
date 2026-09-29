// STARCALLER — star-orb staff mystic (DPS). Big point-target spells: meteor rain, giant lightning, a black hole.
// Identity: Arcane Surge gauge → Z Overload (6 s: every cast is instant, cooldowns tick three times as fast).
import { A, H, FX, S, K, M, P, Z, C, circle, cone, rect, hits } from '../../game/skills/dsl.js';
import { eff } from '../../game/combat.js';
import { hasEngr, evs, addEv, finalize } from './common.js';

const AR = 'arcane', FI = 'fire', IC = 'ice', LI = 'lightning', DK = 'dark';
const burn = { id: 'burn', dur: 6, power: 1 }, chill = { id: 'freeze', dur: 1.5, chance: 0.3 };

const identity = {
  handler: 'gaugeSkills', kind: 'gauge', label: 'Arcane Surge', activeLabel: 'Overload', max: 100,
  gainPerHit: 1.1, gainBasic: 0.8, gainPerCast: 3.5, noGainWhileActive: true, color: '#9d6bff',
  z: {
    mode: true, id: 'overload', name: 'Overload', dur: 6, mods: { atkSpd: 0.2, moveSpd: 0.15 }, glow: 0xa070ff, fx: 'overload', color: AR,
    onStart(kit, st) {
      kit.u.cdRate = 3;
      if (hasEngr(kit, 'wellspring')) { st.active += 2; st.activeMax += 2; }
    },
  },
  onEnd(kit) { kit.u.cdRate = 1; },
  // Overload behaviour lives in hooks (the default gauge gain is re-implemented here because hooks replace it).
  hooks(kit, st) {
    const I = kit.cls.identity, u = kit.u;
    const add = v => { st.v = Math.min(I.max, st.v + v * (eff(u).identityGain || 1)); };
    const rolled = new WeakSet();
    return {
      onHit(evs, hs, ctx) {
        if (st.active > 0) {
          // Ignition: during Overload a critical hit may refresh that skill's cooldown (one roll per cast)
          if (hasEngr(kit, 'ignition') && ctx.kind === 'skill' && ctx.hitSet && !rolled.has(ctx.hitSet) && evs.some(e => e.crit)) {
            rolled.add(ctx.hitSet);
            if (kit.level.rng() < 0.3) { u.cd.delete(ctx.skill); kit.level.emit('fx', { unit: u, preset: 'arcane_spark', x: u.pos.x, z: u.pos.z, ev: { color: AR, r: 1.5 } }); }
          }
          return;
        }
        add(ctx.kind === 'basic' ? I.gainBasic : I.gainPerHit);
      },
      onCast(def, run) {
        if (st.active > 0) {                       // Overload: instant casts
          if (run.castLeft > 0) run.castLeft = 0;
          if (def.type === 'charge') run.charge = 1;
          return;
        }
        if (def.id !== 'basic') add(I.gainPerCast);
      },
    };
  },
};

const skills = [
  {
    id: 'doomfall', name: 'Doomfall', type: 'point', cd: 24, mp: 115, range: 12, dur: 1.0, cancelAt: 0.8,
    desc: 'Tear open the sky above the target area: meteors rain down for 2.5 s.', props: { stagger: 'High', wp: 1 },
    events: [A(0, 'cast_up', 1.0), FX(0, 'staff_glow', { color: FI, r: 1.2 }), S(0, 'cast'), FX(0.35, 'meteor_rain', { at: 'point', color: FI, r: 4.6, dur: 2.6 }),
      Z(0.35, { at: 'point', r: 4.6, dur: 2.5, tick: 0.25, first: 0.55, kind: 'meteor', hit: { coef: 10, stagger: 4, wp: 0.3, elem: FI } }), S(0.9, 'meteor'), S(1.9, 'meteor')],
    tripods: [['quick_prep', 'wide', 'weak_point'], ['burn', 'crushing', { id: 'meteor_swarm', name: 'Meteor Swarm', desc: 'Twice as many, smaller meteors (+20% damage).', apply: d => { const z = evs(d.events, 'zone')[0]; z.tick /= 2; z.hit.coef *= 0.6; } }],
      [{ id: 'cataclysm', name: 'Cataclysm', desc: 'A final giant meteor slams the centre of the storm (+50% damage).', apply: d => { addEv(d.events, H(3.1, { ...circle(5), at: 'point', coef: 45, stagger: 20, wp: 1, elem: FI, knock: 'down', heavy: true }), FX(3.1, 'meteor_strike', { at: 'point', color: FI, r: 5, big: true }), K(3.1, 0.6), S(3.1, 'explosion_big')); } }, 'enhanced:0.4']],
  },
  {
    id: 'blaze_nova', name: 'Blaze Nova', type: 'normal', cd: 7, mp: 45, dur: 0.6,
    desc: 'A ring of fire bursts outward from your staff, pushing enemies back.', props: { stagger: 'Mid' },
    events: [A(0, 'cast_ground', 0.6), H(0.26, { ...circle(4.2), coef: 16, stagger: 8, elem: FI, knock: 'push', kb: 2 }), FX(0.26, 'fire_nova', { color: FI, r: 4.2 }), S(0.26, 'fire')],
    tripods: [['quick_prep', 'wide', 'weak_point'], ['burn', 'stance', { id: 'double_nova', name: 'Double Nova', desc: 'A second nova follows 0.4 s later (+50% damage).', apply: d => { addEv(d.events, H(0.66, { ...circle(5), coef: 8, stagger: 4, elem: FI }), FX(0.66, 'fire_nova', { color: FI, r: 5 })); d.dur = 0.8; } }],
      [{ id: 'solar_flare', name: 'Solar Flare', desc: 'The nova scorches the ground around you for 4 s.', apply: d => { addEv(d.events, Z(0.3, { r: 4, dur: 4, tick: 0.5, kind: 'fire', hit: { coef: 1.1, elem: FI } })); } }, 'enhanced:0.4']],
  },
  {
    id: 'frost_lance', name: 'Frost Lance', type: 'normal', cd: 6, mp: 40, dur: 0.55,
    desc: 'Hurl a lance of ice that pierces every enemy in its path and may freeze them.', props: { stagger: 'Low' },
    events: [A(0, 'cast', 0.55), P(0.22, { speed: 32, range: 14, radius: 1.0, pierce: 99, kind: 'frost_lance', color: IC, hit: { coef: 14.4, stagger: 5, elem: IC, status: [chill] } }), S(0.22, 'frost')],
    tripods: [['quick_prep', 'swift', 'weak_point'], ['keen', 'freeze', { id: 'triple_lance', name: 'Triple Lance', desc: 'Three lances in a fan (each 45% damage).', apply: d => { const p = evs(d.events, 'proj')[0]; p.count = 3; p.spread = 0.5; p.hit.coef *= 0.45; } }],
      [{ id: 'shatter', name: 'Shatter', desc: 'The lance shatters where it stops: a 3 m burst of ice shards (+40% damage).', apply: d => { addEv(d.events, H(0.66, { ...circle(3), at: 12.5, coef: 5.8, stagger: 3, elem: IC }), FX(0.66, 'ice_shatter', { at: 12.5, color: IC, r: 3 })); d.dur = 0.7; } }, 'enhanced:0.4']],
  },
  {
    id: 'starfire_explosion', name: 'Starfire Explosion', type: 'point', cd: 12, mp: 70, range: 11, dur: 0.75,
    desc: 'Ignite a mote of starfire at the target point; it detonates a moment later.', props: { stagger: 'Mid' },
    events: [A(0, 'cast', 0.75), FX(0.1, 'star_mote', { at: 'point', color: AR, r: 1 }), S(0.1, 'cast'),
      H(0.55, { ...circle(3.4), at: 'point', coef: 38, stagger: 12, elem: AR, heavy: true }), FX(0.55, 'starfire_burst', { at: 'point', color: AR, r: 3.4 }), K(0.55, 0.3), S(0.55, 'explosion')],
    tripods: [['quick_prep', 'wide', 'weak_point'], ['keen', 'burn', 'crushing'],
      [{ id: 'supernova', name: 'Supernova', desc: 'A second, larger detonation follows (+50% damage).', apply: d => { addEv(d.events, H(1.0, { ...circle(4.6), at: 'point', coef: 19, stagger: 6, elem: AR }), FX(1.0, 'starfire_burst', { at: 'point', color: AR, r: 4.6, big: true }), S(1.0, 'explosion')); d.dur = 1.05; } }, 'enhanced:0.4']],
  },
  {
    id: 'punishing_bolt', name: 'Punishing Bolt', type: 'casting', cd: 22, mp: 110, cast: 1.1, range: 10, dur: 0.6,
    desc: 'Chant, then call a colossal bolt of lightning down on the target point. Very high stagger.', props: { stagger: 'Very High', wp: 2 },
    onStart: r => r.u.model?.play?.('channel', { loop: true }),
    events: [A(0, 'cast_up', 0.6), H(0.05, { ...circle(4), at: 'point', coef: 92, stagger: 64, wp: 2, elem: LI, heavy: true }), FX(0.05, 'giant_lightning', { at: 'point', color: LI, r: 4, big: true }), K(0.05, 0.7), S(0.05, 'thunder')],
    tripods: [['quick_prep', 'weak_point', 'wide'], ['shock', 'crushing', { id: 'quick_chant', name: 'Quick Chant', desc: 'Casting time −40%.', apply: d => { d.cast *= 0.6; } }],
      [{ id: 'judgment_bolts', name: 'Judgment Bolts', desc: 'Three more bolts strike around the target point (+40% damage).', apply: d => { addEv(d.events, ...hits(3, 0.25, 0.12, { ...circle(3.2), at: 'point', coef: 36.8, stagger: 6, elem: LI }), FX(0.25, 'lightning_bolt', { at: 'point', color: LI, r: 3.2 }), FX(0.49, 'lightning_bolt', { at: 'point', color: LI, r: 3.2 })); d.dur = 0.75; } }, 'enhanced:0.4']],
  },
  {
    id: 'seraphic_hail', name: 'Seraphic Hail', type: 'point', cd: 14, mp: 80, range: 11, dur: 0.8,
    desc: 'Six spears of ice fall from above onto the target area.', props: { stagger: 'Mid' },
    events: [A(0, 'cast_up', 0.8), FX(0.2, 'ice_spears', { at: 'point', color: IC, r: 3.6, dur: 1 }), S(0.3, 'frost'),
      ...hits(6, 0.45, 0.13, { ...circle(3.6), at: 'point', coef: 42, stagger: 12, elem: IC, status: [{ ...chill, chance: 0.12 }] })],
    tripods: [['quick_prep', 'wide', 'weak_point'], ['freeze', 'keen', 'crushing'],
      [{ id: 'glacial_field', name: 'Glacial Field', desc: 'The spears leave a freezing field for 4 s that slows and chills.', apply: d => { addEv(d.events, Z(1.1, { at: 'point', r: 3.6, dur: 4, tick: 0.5, kind: 'frost', hit: { coef: 1.5, elem: IC, status: [{ id: 'slow', dur: 1 }] } })); } }, 'enhanced:0.4']],
  },
  {
    id: 'esoteric_rune', name: 'Esoteric Rune', type: 'point', cd: 16, mp: 70, range: 10, dur: 0.7,
    desc: 'Inscribe a rune of stars on the ground: it pulses three times, then detonates.', props: { stagger: 'Mid' },
    events: [A(0, 'cast_ground', 0.7), FX(0.2, 'rune_circle', { at: 'point', color: AR, r: 3.2, dur: 1.4 }), S(0.2, 'cast'),
      Z(0.2, { at: 'point', r: 3.2, dur: 1.2, tick: 0.4, first: 0.2, kind: 'rune', hit: { coef: 4.8, stagger: 3, elem: AR } }),
      H(1.45, { ...circle(3.4), at: 'point', coef: 25.6, stagger: 12, elem: AR, heavy: true }), FX(1.45, 'arcane_burst', { at: 'point', color: AR, r: 3.4 }), S(1.45, 'explosion')],
    tripods: [['quick_prep', 'wide', 'weak_point'], ['keen', 'crushing', { id: 'binding_rune', name: 'Binding Rune', desc: 'The rune binds foes in place (stuns non-boss enemies for 2 s).', apply: d => { const z = evs(d.events, 'zone')[0]; z.hit.knock = 'stun'; z.hit.knockDur = 2; } }],
      [{ id: 'twin_rune', name: 'Twin Rune', desc: 'A second rune is drawn under your feet (+60% damage around you).', apply: d => { addEv(d.events, Z(0.2, { r: 3, dur: 1.2, tick: 0.4, first: 0.2, kind: 'rune', hit: { coef: 2.9, elem: AR } }), H(1.45, { ...circle(3.2), coef: 15.2, stagger: 6, elem: AR }), FX(1.45, 'arcane_burst', { color: AR, r: 3.2 })); } }, 'enhanced:0.4']],
  },
  {
    id: 'lightning_vortex', name: 'Lightning Vortex', type: 'holding', cd: 12, mp: 70, holdMax: 2.4, range: 8,
    desc: 'Hold to conjure a crackling vortex that follows your aim, then release it in a final burst.', props: { stagger: 'Mid' },
    onStart: r => r.u.model?.play?.('channel', { loop: true }),
    events: [],
    loop: { every: 0.25, events: [H(0, { ...circle(2.9), at: 'point', coef: 4, stagger: 2, elem: LI }), FX(0, 'lightning_vortex', { at: 'point', color: LI, r: 2.9 }), S(0, 'lightning')] },
    end: [A(0, 'cast', 0.4), H(0.12, { ...circle(3.4), at: 'point', coef: 12, stagger: 6, elem: LI, heavy: true }), FX(0.12, 'lightning_burst', { at: 'point', color: LI, r: 3.4 }), S(0.12, 'thunder')],
    tripods: [['quick_prep', 'weak_point', 'keen'], ['shock', 'wide', 'stance'],
      [{ id: 'thunder_crown', name: 'Thunder Crown', desc: 'The final burst is a crown of lightning: +150% damage and knockdown.', apply: d => { const h = evs(d.end, 'hit')[0]; h.coef *= 2.5; h.knock = 'down'; h.r = 4.2; } }, 'enhanced:0.4']],
  },
  {
    id: 'inferno_wave', name: 'Inferno Wave', type: 'charge', cd: 18, mp: 95, chargeTime: 1.1, perfect: [0.8, 1.0], perfectMul: 1.2, dur: 0.6,
    desc: 'Gather flame in the staff, then release a rolling wall of fire. Release in the gold zone for a Perfect wave.', props: { stagger: 'High' },
    onStart: r => r.u.model?.play?.('charge_hold', { loop: true }),
    events: [A(0, 'charge_release', 0.6), P(0.05, { speed: 17, range: 12, radius: 2.3, pierce: 99, kind: 'fire_wave', color: FI, hit: { coef: 52, stagger: 16, elem: FI, knock: 'push', kb: 1.5 } }), K(0.05, 0.3), S(0.05, 'fire')],
    tripods: [['quick_prep', 'weak_point', 'swift'], ['burn', 'wide', 'crushing'],
      [{ id: 'hellfire', name: 'Hellfire', desc: 'The wave leaves a trail of burning ground for 4 s.', apply: d => { addEv(d.events, Z(0.35, { at: 5, r: 2.4, dur: 4, tick: 0.5, kind: 'fire', hit: { coef: 1.5, elem: FI } }), Z(0.55, { at: 9, r: 2.4, dur: 4, tick: 0.5, kind: 'fire', hit: { coef: 1.5, elem: FI } })); } },
        { id: 'overcharge', name: 'Overcharge', desc: 'Perfect release damage +60%.', apply: d => { d.perfectMul *= 1.6; } }]],
  },
  {
    id: 'blink', name: 'Blink', type: 'normal', cd: 10, mp: 25, dur: 0.3, fixedSpeed: true,
    desc: 'Teleport 7 m in the aimed direction, leaving a burst of starlight behind.', props: { stagger: 'Low' },
    events: [A(0, 'vanish', 0.15), H(0, { ...circle(2.4), coef: 5, stagger: 3, elem: AR }), FX(0, 'arcane_burst', { color: AR, r: 2.4 }), M(0.05, 'blink', 7, 0), A(0.06, 'appear', 0.24), S(0.05, 'blink')],
    tripods: [['quick_prep', 'mobility', 'mana_saver'], [{ id: 'star_trail', name: 'Star Trail', desc: 'Leave a pulsing star field at the departure point for 3 s.', apply: d => { addEv(d.events, Z(0.01, { r: 2.6, dur: 3, tick: 0.5, kind: 'arcane', hit: { coef: 2.2, elem: AR } })); } }, 'keen', 'weak_point'],
      [{ id: 'arrival_burst', name: 'Arrival Burst', desc: 'Arrive in a burst of starfire (+200% damage).', apply: d => { addEv(d.events, H(0.08, { ...circle(3), coef: 10, stagger: 4, elem: AR }), FX(0.08, 'starfire_burst', { color: AR, r: 3 })); } }, 'enhanced:1.0']],
  },
  {
    id: 'void_rift', name: 'Void Rift', type: 'point', cd: 20, mp: 100, range: 10, dur: 0.8,
    desc: 'Open a black hole at the target point that drags enemies into its heart, then implodes.', props: { stagger: 'High', wp: 1 },
    events: [A(0, 'cast', 0.8), FX(0.3, 'black_hole', { at: 'point', color: DK, r: 5, dur: 2.2 }), S(0.3, 'void'),
      Z(0.3, { at: 'point', r: 5, dur: 2, tick: 0.25, kind: 'void', hit: { coef: 4, stagger: 2, knock: 'pull', kb: 1.2 } }),
      H(2.4, { ...circle(4), at: 'point', coef: 38, stagger: 18, wp: 1, heavy: true }), FX(2.4, 'void_implosion', { at: 'point', color: DK, r: 4 }), K(2.4, 0.45), S(2.4, 'explosion_big')],
    tripods: [['quick_prep', 'wide', 'weak_point'], ['crushing', 'keen', { id: 'event_horizon', name: 'Event Horizon', desc: 'The rift lasts 1 s longer and pulls harder.', apply: d => { const z = evs(d.events, 'zone')[0]; z.dur += 1; z.hit.kb = 1.8; for (const e of d.events) if (e.t >= 2.4) e.t += 1; } }],
      [{ id: 'singularity', name: 'Singularity', desc: 'The implosion deals +100% damage.', apply: d => { const h = evs(d.events, 'hit')[0]; h.coef *= 2; } }, 'enhanced:0.4']],
  },
  {
    id: 'frost_nova', name: 'Frost Nova', type: 'normal', cd: 12, mp: 60, dur: 0.5, superArmor: 'push',
    desc: 'A burst of frost around you that interrupts charging foes and freezes the weak. Counter.', props: { stagger: 'High', counter: true, superArmor: 'push' },
    events: [A(0, 'cast_ground', 0.5), H(0.16, { ...circle(4), coef: 24, stagger: 16, counter: true, elem: IC, status: [{ id: 'freeze', dur: 1.5 }] }), FX(0.16, 'frost_nova', { color: IC, r: 4 }), K(0.16, 0.25), S(0.16, 'frost')],
    tripods: [['quick_prep', 'wide', 'weak_point'], ['crushing', 'keen', { id: 'permafrost', name: 'Permafrost', desc: 'Frozen enemies stay frozen 1.5 s longer; +20% damage.', apply: d => { const h = evs(d.events, 'hit')[0]; h.status = [{ id: 'freeze', dur: 3 }]; h.coef *= 1.2; } }],
      [{ id: 'ice_age', name: 'Ice Age', desc: 'A second, larger nova shatters outward (+80% damage).', apply: d => { addEv(d.events, H(0.5, { ...circle(5.5), coef: 19.2, stagger: 6, elem: IC }), FX(0.5, 'frost_nova', { color: IC, r: 5.5, big: true })); d.dur = 0.7; } }, 'enhanced:0.5']],
  },
];

export default finalize({
  id: 'starcaller', name: 'Starcaller', archetype: 'Mystic', role: 'dps', weapon: 'staff', difficulty: 3,
  blurb: 'A scholar of the night sky who calls meteors, lightning and frost. Few can match a Starcaller mid-Overload, when every spell is instant and the cooldowns melt away.',
  palette: { main: 0x9d6bff, glow: [2.2, 0.8, 3.6], fx: AR },
  dash: { cd: 9, dist: 5.2, dur: 0.26 },
  stats: { hp: 0.9, atk: 1.0, def: 0.9 },
  basic: [
    { anim: 'atk1', dur: 0.36, proj: { t: 0.14, speed: 30, range: 12, radius: 0.6, kind: 'arcane', color: AR, hit: { coef: 1.1, stagger: 1.5 } }, hit: { t: 0.14, shape: 'none' }, sfx: 'cast' },
    { anim: 'atk2', dur: 0.36, proj: { t: 0.14, speed: 30, range: 12, radius: 0.6, kind: 'arcane', color: AR, hit: { coef: 1.2, stagger: 1.5 } }, hit: { t: 0.14, shape: 'none' }, sfx: 'cast' },
    { anim: 'atk3', dur: 0.52, proj: { t: 0.22, speed: 28, range: 12, radius: 0.7, count: 3, spread: 0.35, kind: 'arcane', color: AR, hit: { coef: 0.8, stagger: 1 } }, hit: { t: 0.22, shape: 'none' }, sfx: 'cast' },
  ],
  identity,
  awakening: {
    id: 'stellar_collapse', name: 'Stellar Collapse', type: 'point', cd: 180, uses: 3, range: 12, dur: 2.6, cancelAt: 2.4, superArmor: 'full', fixedSpeed: true,
    desc: 'Pull a dying star down onto the target area: it drags everything in, then collapses in a blinding explosion.', props: { stagger: 'Very High', wp: 3, superArmor: 'full' },
    events: [
      A(0, 'awaken', 0.6), FX(0, 'awaken_aura', { color: AR }), S(0, 'awaken'), A(0.5, 'cast_up', 1.4),
      FX(0.5, 'falling_star', { at: 'point', color: AR, r: 6, dur: 1.6 }),
      Z(0.6, { at: 'point', r: 7, dur: 1.4, tick: 0.2, kind: 'void', hit: { coef: 20, stagger: 6, knock: 'pull', kb: 1.5 } }),
      H(2.05, { ...circle(7), at: 'point', coef: 560, stagger: 80, wp: 3, knock: 'down', heavy: true }), FX(2.05, 'stellar_collapse', { at: 'point', color: AR, r: 7, big: true }), K(2.05, 1), S(2.05, 'explosion_big'),
    ],
  },
  skills,
  defaultBar: ['doomfall', 'starfire_explosion', 'punishing_bolt', 'seraphic_hail', 'lightning_vortex', 'inferno_wave', 'void_rift', 'frost_nova'],
  engravings: [
    { id: 'ignition', name: 'Ignition', desc: 'During Overload, a critical hit has a 30% chance to refresh that skill\'s cooldown (once per cast). Crit Rate +8%.', mods: { crit: 0.08 } },
    { id: 'wellspring', name: 'Wellspring', desc: 'Arcane Surge builds 50% faster and Overload lasts 2 s longer.', mods: { identityGain: 0.5 } },
  ],
});
