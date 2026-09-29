// DEMONBOUND — shade with a demonic glaive (DPS). Identity: Demon gauge → Z Demonform (20 s: horns, wings, claws; the
// Q W E R skills become four demon skills). Restraint instead never transforms and hits harder (handled by the handler).
import { A, H, FX, S, K, M, P, Z, B, C, circle, cone, rect, hits } from '../../game/skills/dsl.js';
import { hasEngr, evs, addEv, phase, finalize } from './common.js';

const DM = 'demon', DK = 'dark', BL = 'crimson';
const bleed = { id: 'bleed', dur: 5, power: 1 };

// Unleashed (class engraving): demon skills +20% damage and each cast feeds the form 0.5 s (up to its full duration).
const unleash = C(0, run => {
  if (!hasEngr(run.u.kit, 'unleashed')) return;
  run.mult *= 1.2;
  const st = run.u.kit.identity.state, max = run.u.kit.cls.identity.dur;
  if (st.form > 0) st.form = Math.min(max, st.form + 0.5);
});

// Demon skills (Q W E R during Demonform). Built at level 1: coefficients are ~2× a normal skill's.
const demonSkills = [
  {
    id: 'abyss_claw', name: 'Abyss Claw', type: 'normal', cd: 3, mp: 0, dur: 0.5,
    desc: 'Two raking swipes of the demon claws.', props: { stagger: 'Mid' },
    events: [unleash, A(0, 'slash_h', 0.5), ...hits(2, 0.12, 0.14, { ...cone(3.8, 160), coef: 53.9, stagger: 10, elem: DM }), FX(0.12, 'claw_slash', { color: DM, r: 3.6, arc: 160 }), FX(0.26, 'claw_slash', { color: DM, r: 3.6, arc: 160, flip: true }), S(0.12, 'claw')],
  },
  {
    id: 'rending_talons', name: 'Rending Talons', type: 'normal', cd: 6, mp: 0, dur: 0.7, superArmor: 'push',
    desc: 'Lunge through the enemy and rend it three times on the way.', props: { stagger: 'Mid', superArmor: 'push' },
    events: [unleash, A(0, 'dash_strike', 0.7), phase(0, 0.35), M(0, 'dash', 4.5, 0.22, { iframes: 0.2 }), ...hits(3, 0.18, 0.1, { ...rect(5, 3, -4.2), coef: 107.9, stagger: 16, elem: DM, status: [bleed] }), FX(0.18, 'claw_slash', { at: -2, color: DM, r: 3, arc: 200 }), S(0.18, 'claw'), K(0.3, 0.25)],
  },
  {
    id: 'hellfire_wings', name: 'Hellfire Wings', type: 'normal', cd: 9, mp: 0, dur: 0.8, superArmor: 'push',
    desc: 'Unfurl the wings in a blast of hellfire that hurls enemies into the air and scorches the ground.', props: { stagger: 'High', superArmor: 'push' },
    events: [unleash, A(0, 'spin', 0.8), H(0.3, { ...circle(5), coef: 111.6, stagger: 20, knock: 'up', elem: 'fire', heavy: true }), FX(0.3, 'demon_wings', { color: DM, r: 5 }), FX(0.3, 'fire_nova', { color: 'fire', r: 5 }), K(0.3, 0.4), S(0.3, 'fire'),
      Z(0.35, { r: 4.5, dur: 2.4, tick: 0.4, kind: 'hellfire', hit: { coef: 8.4, stagger: 1, elem: 'fire' } })],
  },
  {
    id: 'demonic_slam', name: 'Demonic Slam', type: 'point', cd: 14, mp: 0, range: 8, dur: 1.1, cancelAt: 0.95, superArmor: 'full',
    desc: 'Leap on beating wings and crash down on the target area.', props: { stagger: 'Very High', wp: 2, superArmor: 'full' },
    events: [unleash, A(0, 'leap', 0.55), M(0.05, 'leap', 8, 0.5, { height: 3.5 }), A(0.55, 'slam', 0.5),
      H(0.6, { ...circle(5.5), coef: 279, stagger: 50, wp: 2, knock: 'down', elem: DM, heavy: true }), FX(0.6, 'demon_crater', { color: DM, r: 5.5 }), FX(0.6, 'shockwave', { color: DM, r: 6 }), K(0.6, 0.7), S(0.6, 'explosion_big')],
  },
];

export default finalize({
  id: 'demonbound', name: 'Demonbound', archetype: 'Shade', role: 'dps', weapon: 'glaive', difficulty: 3,
  blurb: 'A warrior who made a pact with the thing inside. The glaive feeds the Demon gauge; when it is full the demon comes out to play — horns, wings, claws and four brutal demon skills.',
  palette: { main: 0xa0283a, glow: [2.4, 0.3, 2.8], fx: DM },
  dash: { cd: 8, dist: 5.6, dur: 0.26 },
  stats: { hp: 1.0, atk: 1.0, def: 1.0 },
  basic: [
    { anim: 'atk1', dur: 0.38, hit: { t: 0.15, ...cone(3.2, 140), coef: 1.0, stagger: 2 }, fx: { t: 0.15, preset: 'slash', color: DM, r: 3.2, arc: 140 }, sfx: 'slash' },
    { anim: 'atk2', dur: 0.4, hit: { t: 0.16, ...cone(3.2, 140), coef: 1.1, stagger: 2 }, fx: { t: 0.16, preset: 'slash', color: DM, r: 3.2, arc: 140, flip: true }, sfx: 'slash' },
    { anim: 'atk3', dur: 0.56, hit: { t: 0.28, ...circle(3.2), coef: 1.8, stagger: 4, knock: 'push', kb: 1.5 }, fx: { t: 0.28, preset: 'slash', color: DM, r: 3.2, arc: 360, spin: true }, sfx: 'slash_heavy' },
  ],
  identity: {
    handler: 'demonbound', kind: 'demon', label: 'Demon', max: 100, gainPerHit: 0.8, gainBasic: 0.5, dur: 20,
    mods: { atkSpd: 0.15, moveSpd: 0.2, crit: 0.1 },
    demonSkills,
  },
  awakening: {
    id: 'abyssal_rupture', name: 'Abyssal Rupture', type: 'normal', cd: 180, uses: 3, dur: 2.4, cancelAt: 2.2, superArmor: 'full', fixedSpeed: true,
    desc: 'Plunge the glaive into the ground and tear open the Abyss: a field of demonic spikes, then an eruption of darkness.', props: { stagger: 'Very High', wp: 3, superArmor: 'full' },
    events: [
      A(0, 'awaken', 0.5), FX(0, 'awaken_aura', { color: DM }), S(0, 'awaken'), A(0.45, 'slam', 0.8), K(0.6, 0.4),
      FX(0.6, 'demon_spikes', { color: DM, r: 6, dur: 1.2 }), ...hits(6, 0.6, 0.18, { ...circle(6), coef: 300, stagger: 36, elem: DM }), S(0.6, 'spike'),
      H(1.8, { ...circle(7), coef: 420, stagger: 44, wp: 3, knock: 'up', elem: DM, heavy: true }), FX(1.8, 'abyss_eruption', { color: DK, r: 7, big: true }), K(1.8, 1), S(1.8, 'explosion_big'),
    ],
  },
  skills: [
    {
      id: 'demonic_slash', name: 'Demonic Slash', type: 'normal', cd: 6, mp: 50, dur: 0.55,
      desc: 'Two quick sweeps of the glaive.', props: { stagger: 'Low' },
      events: [A(0, 'slash_h', 0.55), ...hits(2, 0.16, 0.16, { ...cone(3.4, 150), coef: 15.8, stagger: 6 }), FX(0.16, 'slash', { color: DM, r: 3.4, arc: 150 }), FX(0.32, 'slash', { color: DM, r: 3.4, arc: 150, flip: true }), S(0.16, 'slash')],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['bleed', 'wide', 'keen'],
        [{ id: 'third_sweep', name: 'Third Sweep', desc: 'A third, spinning sweep (+60% damage).', apply: d => { addEv(d.events, A(0.45, 'spin', 0.4), H(0.62, { ...circle(3.4), coef: 9.5, stagger: 4 }), FX(0.62, 'slash', { color: DM, r: 3.4, arc: 360, spin: true })); d.dur = 0.85; } }, 'enhanced:0.4']],
    },
    {
      id: 'ruining_rush', name: 'Ruining Rush', type: 'normal', cd: 10, mp: 85, dur: 0.85, superArmor: 'push',
      desc: 'Rush forward with the glaive whirling, shredding everything in your path.', props: { stagger: 'Mid', superArmor: 'push' },
      events: [A(0, 'spin_loop', 0.8), M(0.02, 'dash', 6, 0.6), ...hits(4, 0.12, 0.14, { ...circle(2.9), coef: 29.8, stagger: 12 }), FX(0.1, 'whirl', { color: DM, r: 2.9, dur: 0.65, follow: true }), S(0.1, 'whoosh_big')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['bleed', 'stance', 'keen'],
        [{ id: 'ruin_end', name: 'Ruination', desc: 'End the rush with a crushing overhead blow (+70% damage).', apply: d => { addEv(d.events, A(0.72, 'slash_v', 0.4), H(0.85, { ...cone(3.4, 120), coef: 20.8, stagger: 8, knock: 'down', heavy: true }), FX(0.85, 'slash', { color: DM, r: 3.4, arc: 120, vertical: true })); d.dur = 1.1; } }, 'enhanced:0.4']],
    },
    {
      id: 'cruel_cutter', name: 'Cruel Cutter', type: 'normal', cd: 8, mp: 75, dur: 0.95,
      desc: 'Hurl the glaive like a spinning disc; it tears through a line of enemies and returns.', props: { stagger: 'Mid' },
      events: [A(0, 'throw_weapon', 0.95), P(0.2, { speed: 26, range: 9, radius: 1.4, pierce: 99, kind: 'glaive_disc', color: DM, hit: { coef: 12.1, stagger: 5 } }), S(0.2, 'whoosh'),
        H(0.75, { ...rect(9.5, 2.8), coef: 12.1, stagger: 5 }), FX(0.75, 'blade_return', { color: DM, len: 9.5 }), S(0.75, 'whoosh')],
      tripods: [['quick_prep', 'weak_point', 'wide'], ['bleed', 'pull', 'keen'],
        [{ id: 'grinding_disc', name: 'Grinding Disc', desc: 'The glaive hovers at the end of its flight, grinding for 1.2 s (+60% damage).', apply: d => { addEv(d.events, Z(0.55, { at: 8.5, r: 2.4, dur: 1.2, tick: 0.2, kind: 'blades', hit: { coef: 2.2, stagger: 1 } })); } }, 'enhanced:0.4']],
    },
    {
      id: 'blood_massacre', name: 'Blood Massacre', type: 'normal', cd: 16, mp: 120, dur: 1.05, superArmor: 'push',
      desc: 'A frenzy of blood-red cuts in every direction, ending in a wide spray of crimson.', props: { stagger: 'Mid', superArmor: 'push' },
      events: [A(0, 'spin_loop', 1.0), ...hits(6, 0.12, 0.12, { ...circle(3.8), coef: 44.6, stagger: 14, status: [bleed] }), FX(0.12, 'blood_whirl', { color: BL, r: 3.8, dur: 0.75, follow: true }), S(0.12, 'slash'),
        H(0.9, { ...circle(4.4), coef: 14.9, stagger: 6, knock: 'push', kb: 2 }), FX(0.9, 'blood_burst', { color: BL, r: 4.4 }), S(0.9, 'slash_heavy')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['bleed', 'stance', 'keen'],
        [{ id: 'crimson_tide', name: 'Crimson Tide', desc: 'The spray leaves a pool of blood that bleeds enemies for 4 s (+40% damage).', apply: d => { addEv(d.events, Z(0.95, { r: 4, dur: 4, tick: 0.5, kind: 'blood', hit: { coef: 3, stagger: 1, status: [bleed] } })); } }, 'enhanced:0.4']],
    },
    {
      id: 'grind_chain', name: 'Grind Chain', type: 'normal', cd: 12, mp: 75, dur: 1.0,
      desc: 'Lash out with soul-chains that drag enemies in and grind them against the glaive.', props: { stagger: 'Mid' },
      events: [A(0, 'pull', 0.5), H(0.25, { ...rect(8.5, 2.6), coef: 9.3, stagger: 6, knock: 'pull', kb: 6 }), FX(0.25, 'chain', { color: DK, len: 8.5 }), S(0.25, 'chain'),
        A(0.5, 'spin', 0.5), ...hits(3, 0.6, 0.12, { ...circle(3), coef: 22.3, stagger: 9 }), FX(0.6, 'slash', { color: DM, r: 3, arc: 360, spin: true }), S(0.6, 'slash')],
      tripods: [['quick_prep', 'weak_point', 'wide'], ['bleed', 'keen', 'crushing'],
        [{ id: 'soul_shackle', name: 'Soul Shackle', desc: 'Chained enemies are stunned for 2 s (non-bosses) and take +50% grinding damage.', apply: d => { const hs = evs(d.events, 'hit'); hs[0].knock = 'stun'; hs[0].knockDur = 2; for (const h of hs.slice(1)) h.coef *= 1.5; } }, 'enhanced:0.4']],
    },
    {
      id: 'thrust_of_destruction', name: 'Thrust of Destruction', type: 'normal', cd: 12, mp: 100, dur: 0.8, superArmor: 'push',
      desc: 'Drive the glaive forward with demonic force, piercing a long line. Head Attack.', props: { stagger: 'High', attack: 'head', superArmor: 'push' },
      events: [A(0, 'thrust', 0.8), M(0.1, 'dash', 2, 0.15), H(0.32, { ...rect(6.5, 2.4), coef: 42.8, stagger: 18, attack: 'head', knock: 'push', kb: 2.5, heavy: true }), FX(0.32, 'demon_thrust', { color: DM, len: 6.5 }), K(0.32, 0.35), S(0.32, 'slash_heavy')],
      tripods: [['quick_prep', 'weak_point', 'swift'], ['crushing', 'keen', 'stance'],
        [{ id: 'impaler', name: 'Impaler', desc: 'The thrust erupts from the far end of the line (+60% damage).', apply: d => { addEv(d.events, H(0.55, { ...circle(3), at: 6.5, coef: 25.7, stagger: 6, attack: 'head' }), FX(0.55, 'demon_spikes', { at: 6.5, color: DM, r: 3 })); d.dur = 0.9; } }, 'enhanced:0.4']],
    },
    {
      id: 'demolition', name: 'Demolition', type: 'normal', cd: 20, mp: 145, dur: 1.2, cancelAt: 1.0, superArmor: 'push',
      desc: 'Slam the glaive down: three waves of demonic spikes erupt along a line. Very high stagger.', props: { stagger: 'Very High', wp: 2, superArmor: 'push' },
      events: [A(0, 'slam', 0.7), K(0.4, 0.3), S(0.4, 'impact_heavy'),
        H(0.45, { ...rect(4, 3.2), coef: 20.5, stagger: 20, wp: 1 }), FX(0.45, 'demon_spikes', { at: 2, color: DM, r: 2 }),
        H(0.6, { ...rect(7, 3.2), coef: 20.5, stagger: 20, wp: 1 }), FX(0.6, 'demon_spikes', { at: 5, color: DM, r: 2.2 }),
        H(0.75, { ...rect(10, 3.2), coef: 24.2, stagger: 24, wp: 1, knock: 'up', heavy: true }), FX(0.75, 'demon_spikes', { at: 8.5, color: DM, r: 2.5 }), S(0.75, 'spike')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['crushing', 'unstoppable', 'bleed'],
        [{ id: 'cataclysm_spikes', name: 'Abyssal Spikes', desc: 'A final ring of spikes erupts around you (+50% damage).', apply: d => { addEv(d.events, H(1.0, { ...circle(4.5), coef: 32.6, stagger: 10 }), FX(1.0, 'demon_spikes', { color: DM, r: 4.5 })); d.dur = 1.3; } }, 'enhanced:0.4']],
    },
    {
      id: 'soul_chain', name: 'Soul Chain', type: 'holding', cd: 12, mp: 110, holdMax: 2.0, superArmor: 'push',
      desc: 'Hold to lash the chained souls again and again at enemies ahead; release to reel them in.', props: { stagger: 'Mid', superArmor: 'push' },
      onStart: r => r.u.model?.play?.('pull', { loop: true }),
      events: [],
      loop: { every: 0.2, walk: 1.2, events: [H(0, { ...cone(4.8, 100), coef: 3.3, stagger: 2 }), FX(0, 'chain', { color: DK, len: 4.8 }), S(0, 'chain')] },
      end: [A(0, 'pull', 0.45), H(0.15, { ...cone(5, 100), coef: 11.2, stagger: 6, knock: 'pull', kb: 3 }), FX(0.15, 'chain', { color: DK, len: 5 }), S(0.15, 'chain')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['bleed', 'keen', 'wide'],
        [{ id: 'soul_rend', name: 'Soul Rend', desc: 'Reeling in tears the souls out: the finisher deals +150% damage.', apply: d => { const h = evs(d.end, 'hit')[0]; h.coef *= 2.5; h.heavy = true; } }, 'enhanced:0.4']],
    },
    {
      id: 'blood_pillars', name: 'Blood Pillars', type: 'point', cd: 14, mp: 110, range: 9, dur: 0.9,
      desc: 'Three pillars of boiling blood erupt one after another at the target area.', props: { stagger: 'Mid' },
      events: [A(0, 'cast_ground', 0.9), S(0.2, 'spike'), ...hits(3, 0.45, 0.2, { ...circle(3.2), at: 'point', coef: 40.9, stagger: 12, status: [bleed] }),
        FX(0.45, 'blood_pillar', { at: 'point', color: BL, r: 3.2 }), FX(0.65, 'blood_pillar', { at: 'point', color: BL, r: 3.2 }), FX(0.85, 'blood_pillar', { at: 'point', color: BL, r: 3.2 })],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['bleed', 'keen', 'crushing'],
        [{ id: 'blood_geyser', name: 'Blood Geyser', desc: 'A fourth, giant pillar erupts (+50% damage).', apply: d => { addEv(d.events, H(1.1, { ...circle(4), at: 'point', coef: 20.5, stagger: 8, knock: 'up' }), FX(1.1, 'blood_pillar', { at: 'point', color: BL, r: 4, big: true })); d.dur = 1.15; } }, 'enhanced:0.4']],
    },
    {
      id: 'howl', name: 'Howl', type: 'normal', cd: 16, mp: 75, dur: 0.7, superArmor: 'push',
      desc: 'A demonic howl that interrupts charging foes and sends lesser ones fleeing. Counter.', props: { stagger: 'High', counter: true, superArmor: 'push' },
      events: [A(0, 'taunt', 0.7), H(0.25, { ...circle(5.2), coef: 18.6, stagger: 18, counter: true, status: [{ id: 'fear', dur: 2.5 }] }), FX(0.25, 'demon_howl', { color: DM, r: 5.2 }), K(0.25, 0.3), S(0.25, 'roar')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['crushing', 'keen', { id: 'dread', name: 'Dread', desc: 'Struck enemies deal 20% less damage for 6 s.', apply: d => { const h = evs(d.events, 'hit')[0]; h.status = [...(h.status || []), { id: 'weaken', dur: 6 }]; } }],
        [{ id: 'hellhound_howl', name: 'Hellhound Howl', desc: 'The howl tears at the ears: +120% damage.', apply: d => { evs(d.events, 'hit')[0].coef *= 2.2; } }, 'enhanced:0.6']],
    },
    {
      id: 'leaping_blow', name: 'Leaping Blow', type: 'point', cd: 10, mp: 85, range: 8, dur: 0.95,
      desc: 'Vault to the target area and bring the glaive down on landing.', props: { stagger: 'Mid' },
      events: [A(0, 'leap', 0.5), M(0.05, 'leap', 8, 0.42, { height: 2.6 }), A(0.47, 'slam', 0.45),
        H(0.5, { ...circle(3.6), coef: 29.8, stagger: 12, knock: 'down', heavy: true }), FX(0.5, 'crater', { color: DM, r: 3.6 }), K(0.5, 0.35), S(0.5, 'impact_heavy')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['crushing', 'stance', 'keen'],
        [{ id: 'double_leap', name: 'Rending Descent', desc: 'The landing sends a crimson shockwave outward (+50% damage).', apply: d => { addEv(d.events, H(0.7, { ...circle(5.5), coef: 14.9, stagger: 5 }), FX(0.7, 'shockwave', { color: DM, r: 5.5 })); d.dur = 1.0; } }, 'enhanced:0.4']],
    },
    {
      id: 'demon_vision', name: 'Demon Vision', type: 'normal', cd: 24, mp: 60, dur: 0.6, fixedSpeed: true,
      desc: 'Open the demon eye: Attack and Move Speed +15% and Crit Rate +10% for 10 s, and the Demon gauge surges.', props: { stagger: 'Low' },
      events: [A(0, 'buff', 0.6), B(0.2, { target: 'self', id: 'demon_vision', dur: 10, mods: { atkSpd: 0.15, moveSpd: 0.15, crit: 0.1 }, name: 'Demon Vision', icon: 'skill:demonbound:demon_vision' }), FX(0.2, 'demon_eye', { color: DM, r: 1.6 }), S(0.2, 'buff'),
        C(0.2, run => { const st = run.u.kit?.identity?.state; if (st && !(st.form > 0)) st.v = Math.min(run.u.kit.cls.identity.max, st.v + 12); })],
      tripods: [['quick_prep', 'mana_saver', { id: 'far_sight', name: 'Far Sight', desc: 'The vision lasts 14 s.', apply: d => { evs(d.events, 'buff')[0].dur = 14; } }], ['keen', { id: 'hunger', name: 'Hunger', desc: 'The gauge surge is doubled.', apply: d => { const c = evs(d.events, 'call')[0]; const f = c.fn; c.fn = (run, L) => { f(run, L); f(run, L); }; } }, 'enhanced:1'],
        [{ id: 'predator', name: 'Predator', desc: 'The vision also grants Damage +8%.', apply: d => { evs(d.events, 'buff')[0].mods.dmgMul = 0.08; } }, { id: 'abyss_gaze', name: 'Abyssal Gaze', desc: 'Open the eye with a burst of dark energy around you (coef 30).', apply: d => { addEv(d.events, H(0.25, { ...circle(4), coef: 27.9, stagger: 8 }), FX(0.25, 'shockwave', { color: DK, r: 4 })); } }]],
    },
  ],
  defaultBar: ['demonic_slash', 'ruining_rush', 'leaping_blow', 'howl', 'thrust_of_destruction', 'demolition', 'blood_massacre', 'soul_chain'],
  engravings: [
    { id: 'unleashed', name: 'Unleashed', desc: 'Demon skills deal +20% damage, and each one feeds Demonform 0.5 s (up to its full duration). Demon gauge +20% faster.', mods: { identityGain: 0.2 } },
    { id: 'restraint', name: 'Restraint', desc: 'Never transform. All skills deal +30% damage; Damage +10% and Mana Regeneration +25%.', mods: { dmgMul: 0.1, mpRegenMul: 0.25 } },
  ],
});
