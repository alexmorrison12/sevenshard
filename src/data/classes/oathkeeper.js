// OATHKEEPER — longsword & holy tome warrior (SUPPORT). Brands foes (+10% damage taken), blesses the party (+13% damage),
// shields and heals. Identity: Sanctity gauge → Z Aegis of Dawn (party −20% damage taken + heal) · X Sacred Punishment.
import { A, H, FX, S, K, M, P, Z, B, C, circle, cone, rect, hits } from '../../game/skills/dsl.js';
import { withEngr, hasEngr, evs, addEv, allyZone, partyInvuln, partyCleanse, phase, finalize } from './common.js';

const HO = 'holy', GO = 'gold';
const icon = id => `skill:oathkeeper:${id}`;
const MEND = { r: 5.5, dur: 6, tick: 1, first: 1, healPct: 0.04, kind: 'holy' };
/** replace Rite of Mending's heal zone with changed parameters (the zone's tick logic lives in a closure) */
function swapZone(d, o) { const i = d.events.findIndex(e => e.a === 'zone'); const z = d.events[i]; const cur = { ...MEND, ...(z._p || {}), ...o }; d.events[i] = { ...allyZone(z.t, cur), _p: cur }; }
const blessing = { id: 'heavenly_blessing', dur: 10, mods: { dmgMul: 0.13 }, name: 'Heavenly Blessing', icon: icon('heavenly_blessing') };

const aegis = {
  id: 'aegis_of_dawn', name: 'Aegis of Dawn', type: 'normal', cost: 100, dur: 0.9, superArmor: 'full', fixedSpeed: true,
  desc: 'Raise the Aegis of Dawn: the party takes 20% less damage for 8 s and is healed for 20% of max HP.', props: { superArmor: 'full' },
  events: [A(0, 'identity', 0.9), S(0.1, 'holy'),
    B(0.3, { target: 'party', id: 'aegis_of_dawn', dur: 8, mods: { dmgTaken: -0.2 }, heal: 0.2, healOf: 'max', r: 16, name: 'Aegis of Dawn', icon: 'skill:oathkeeper:identity_z' }),
    B(0.3, { target: 'party', id: 'aegis_of_dawn', dur: 12, shield: 1.2, shieldDur: 12, shieldId: 'aegis_of_dawn', r: 16, name: 'Aegis of Dawn', icon: 'skill:oathkeeper:identity_z', if: withEngr('blessed_aura') }),
    FX(0.3, 'holy_aura', { color: HO, r: 8 }), K(0.3, 0.2)],
};
const punishment = {
  id: 'sacred_punishment', name: 'Sacred Punishment', type: 'normal', cost: 100, dur: 1.2, cancelAt: 1.0, superArmor: 'full', fixedSpeed: true,
  desc: 'A colossal sword of light falls on the enemy, branding it; allies nearby are Sanctified (+8% damage for 12 s).', props: { stagger: 'High', wp: 2, superArmor: 'full' },
  events: [C(0, run => { if (hasEngr(run.u.kit, 'judgment')) run.mult *= 1.6; }), A(0, 'cast_up', 0.5), S(0.05, 'holy'), FX(0.1, 'holy_sword', { at: 3.5, color: HO, r: 3.8, dur: 0.5 }),
    A(0.5, 'slash_v', 0.7), H(0.62, { ...circle(4.2), at: 3.5, coef: 168, stagger: 40, wp: 2, brand: 12, knock: 'down', elem: HO, heavy: true }), FX(0.62, 'holy_explosion', { at: 3.5, color: HO, r: 4.2, big: true }), K(0.62, 0.6), S(0.62, 'explosion_big'),
    B(0.62, { target: 'party', id: 'sanctified', dur: 12, mods: { dmgMul: 0.08 }, r: 16, name: 'Sanctified', icon: 'skill:oathkeeper:identity_x' }),
    B(0.65, { target: 'self', id: 'judgment', dur: 10, mods: { dmgMul: 0.15 }, name: 'Judgment', icon: 'engr:judgment', if: withEngr('judgment') })],
};

export default finalize({
  id: 'oathkeeper', name: 'Oathkeeper', archetype: 'Warrior', role: 'support', weapon: 'sword', difficulty: 3,
  blurb: 'A sworn knight of the Dawn whose blade guards and whose tome mends. Oathkeepers brand foes for the party, bless allies with holy might and wrap them in light.',
  palette: { main: 0xf2c14e, glow: [3, 2.6, 1.4], fx: HO },
  dash: { cd: 10, dist: 5, dur: 0.3 },
  stats: { hp: 1.1, atk: 1.0, def: 1.15 },
  basic: [
    { anim: 'atk1', dur: 0.4, hit: { t: 0.17, ...cone(2.9, 120), coef: 0.9, stagger: 2 }, fx: { t: 0.17, preset: 'slash', color: GO, r: 2.8, arc: 120 }, sfx: 'slash' },
    { anim: 'atk2', dur: 0.42, hit: { t: 0.18, ...cone(2.9, 120), coef: 1.0, stagger: 2 }, fx: { t: 0.18, preset: 'slash', color: GO, r: 2.8, arc: 120, flip: true }, sfx: 'slash' },
    { anim: 'atk3', dur: 0.58, hit: { t: 0.28, ...rect(3.6, 2.2), coef: 1.6, stagger: 4, knock: 'push', kb: 1.2 }, fx: { t: 0.28, preset: 'holy_thrust', color: HO, len: 3.6 }, sfx: 'slash_heavy' },
  ],
  identity: {
    handler: 'gaugeSkills', kind: 'gauge', label: 'Sanctity', max: 100, gainPerHit: 0.35, gainBasic: 0.15, gainPerCast: 1.6, color: '#f2c14e',
    z: aegis, x: punishment,
  },
  awakening: {
    id: 'radiant_judgment', name: 'Radiant Judgment', type: 'normal', cd: 180, uses: 3, dur: 2.2, cancelAt: 2.0, superArmor: 'full', fixedSpeed: true,
    desc: 'Invoke the Dawn itself: the party is made invulnerable for 3 s and healed for 40% of max HP, then judgment falls around you.', props: { stagger: 'Very High', wp: 2, superArmor: 'full' },
    events: [
      A(0, 'awaken', 0.6), FX(0, 'awaken_aura', { color: HO }), S(0, 'awaken'),
      partyInvuln(0.3, 3, 18, { name: 'Radiant Judgment', icon: 'skill:oathkeeper:awakening' }), B(0.3, { target: 'party', heal: 0.4, healOf: 'max', r: 18 }), FX(0.3, 'holy_aura', { color: HO, r: 10, big: true }),
      A(0.9, 'cast_up', 1.1), H(1.5, { ...circle(7), coef: 330, stagger: 60, wp: 2, brand: 12, knock: 'down', elem: HO, heavy: true }), FX(1.5, 'holy_pillars', { color: HO, r: 7, big: true }), K(1.5, 0.8), S(1.5, 'explosion_big'),
    ],
  },
  skills: [
    {
      id: 'holy_bulwark', name: 'Holy Bulwark', type: 'normal', cd: 18, mp: 80, dur: 0.7, fixedSpeed: true,
      desc: 'Raise the tome and cover nearby allies with a shield of light worth 150% of your Attack Power for 6 s.', props: {},
      events: [A(0, 'block', 0.7), B(0.25, { target: 'party', shield: 1.5, shieldDur: 6, shieldId: 'holy_bulwark', r: 16 }), FX(0.25, 'holy_shield', { color: HO, r: 3 }), S(0.25, 'shield')],
      tripods: [['quick_prep', 'mana_saver', { id: 'far_bulwark', name: 'Far Reach', desc: 'Reaches allies up to 24 m away.', apply: d => { evs(d.events, 'buff')[0].r = 24; } }],
        [{ id: 'steadfast', name: 'Steadfast', desc: 'Shield +40%.', apply: d => { evs(d.events, 'buff')[0].shield *= 1.4; } }, { id: 'purifying_light', name: 'Purifying Light', desc: 'Also removes harmful effects from the party.', apply: d => { addEv(d.events, partyCleanse(0.26, 16)); } }, { id: 'bulwark_guard', name: 'Guarded', desc: 'Allies also take 10% less damage for 6 s.', apply: d => { addEv(d.events, B(0.26, { target: 'party', id: 'bulwark_guard', dur: 6, mods: { dmgTaken: -0.1 }, r: 16, name: 'Guarded', icon: icon('holy_bulwark') })); } }],
        [{ id: 'radiant_wall', name: 'Radiant Wall', desc: 'The shield lasts 10 s.', apply: d => { evs(d.events, 'buff')[0].shieldDur = 10; } }, { id: 'bulwark_bash', name: 'Bulwark Bash', desc: 'Slam the shield outward: holy damage around you (coef 22) and a push.', apply: d => { addEv(d.events, H(0.3, { ...circle(3.6), coef: 15.4, stagger: 12, knock: 'push', kb: 2, elem: HO }), FX(0.3, 'holy_nova', { color: HO, r: 3.6 })); } }]],
    },
    {
      id: 'heavenly_blessing', name: 'Heavenly Blessing', type: 'normal', cd: 18, mp: 100, dur: 0.8, fixedSpeed: true,
      desc: 'Call down the Dawn\'s blessing: allies within 16 m deal 13% more damage for 10 s.', props: { stagger: 'Low' },
      events: [A(0, 'cast_up', 0.8), B(0.3, { target: 'party', ...blessing, r: 16 }), FX(0.3, 'holy_blessing', { color: GO, r: 6 }), H(0.35, { ...circle(4), coef: 6.3, stagger: 4, elem: HO }), S(0.3, 'holy')],
      tripods: [['quick_prep', 'mana_saver', 'wide'], [{ id: 'lasting_grace', name: 'Lasting Grace', desc: 'The blessing lasts 13 s.', apply: d => { evs(d.events, 'buff')[0].dur = 13; } }, { id: 'swift_grace', name: 'Swift Grace', desc: 'The blessing also grants Attack Speed +8%.', apply: d => { evs(d.events, 'buff')[0].mods.atkSpd = 0.08; } }, 'keen'],
        [{ id: 'dawn_zeal', name: 'Dawn\'s Zeal', desc: 'The blessing also grants Crit Rate +6%.', apply: d => { evs(d.events, 'buff')[0].mods.crit = 0.06; } }, { id: 'hallowed_ground', name: 'Hallowed Ground', desc: 'Consecrates the ground for 6 s: allies standing in it recover 2% HP per second.', apply: d => { addEv(d.events, allyZone(0.35, { r: 4.5, dur: 6, tick: 1, healPct: 0.02, kind: 'holy' })); } }]],
    },
    {
      id: 'light_shock', name: 'Light Shock', type: 'normal', cd: 8, mp: 50, dur: 0.55,
      desc: 'A lance of light that Brands everything it strikes for 12 s (Branded foes take 10% more damage from the party).', props: { stagger: 'Mid' },
      events: [A(0, 'cast', 0.55), H(0.22, { ...rect(7, 3.2), coef: 9.8, stagger: 8, brand: 12, elem: HO }), FX(0.22, 'holy_ray', { color: HO, len: 7, width: 3.2 }), S(0.22, 'holy')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['keen', { id: 'lasting_brand', name: 'Lasting Brand', desc: 'The Brand lasts 20 s.', apply: d => { evs(d.events, 'hit')[0].brand = 20; } }, 'crushing'],
        [{ id: 'blinding_light', name: 'Blinding Light', desc: 'Struck enemies also deal 20% less damage for 6 s.', apply: d => { (evs(d.events, 'hit')[0].status ||= []).push({ id: 'weaken', dur: 6 }); } }, 'enhanced:0.6']],
    },
    {
      id: 'sword_of_justice', name: 'Sword of Justice', type: 'combo', cd: 7, mp: 50,
      desc: 'Two measured cuts, then a downward stroke that sends a wave of light forward.', props: { stagger: 'Mid' },
      stages: [
        { dur: 0.42, window: 0.15, events: [A(0, 'slash_h', 0.42), H(0.17, { ...cone(3.2, 130), coef: 4.2, stagger: 4 }), FX(0.17, 'slash', { color: GO, r: 3, arc: 130 }), S(0.17, 'slash')] },
        { dur: 0.42, window: 0.15, events: [A(0, 'slash_x', 0.42), H(0.17, { ...cone(3.2, 130), coef: 4.2, stagger: 4 }), FX(0.17, 'slash', { color: GO, r: 3, arc: 130, flip: true }), S(0.17, 'slash')] },
        { dur: 0.6, events: [A(0, 'slash_v', 0.6), H(0.25, { ...rect(6, 2.4), coef: 8.4, stagger: 7, elem: HO }), FX(0.25, 'holy_wave', { color: HO, len: 6 }), S(0.25, 'slash_heavy')] },
      ],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['keen', 'wide', { id: 'branding_blade', name: 'Branding Blade', desc: 'The final wave Brands enemies for 10 s.', apply: d => { evs(d.stages[2].events, 'hit')[0].brand = 10; } }],
        [{ id: 'justice_wave', name: 'Justice Wave', desc: 'The wave travels 10 m and deals +60% damage.', apply: d => { const h = evs(d.stages[2].events, 'hit')[0]; h.len = 10; h.coef *= 1.6; } }, 'enhanced:0.4']],
    },
    {
      id: 'godsent_law', name: 'Godsent Law', type: 'casting', cd: 24, mp: 130, cast: 0.9, range: 8, dur: 0.6, superArmor: 'push',
      desc: 'Pray, and a giant sword of light descends on the target point. Very high stagger; Brands enemies.', props: { stagger: 'Very High', wp: 2, superArmor: 'push' },
      onStart: r => r.u.model?.play?.('channel', { loop: true }),
      events: [A(0, 'cast_up', 0.6), H(0.05, { ...circle(3.8), at: 'point', coef: 36.4, stagger: 70, wp: 2, brand: 12, knock: 'down', elem: HO, heavy: true }), FX(0.05, 'holy_sword', { at: 'point', color: HO, r: 3.8, big: true }), K(0.05, 0.55), S(0.05, 'explosion')],
      tripods: [['quick_prep', 'weak_point', 'wide'], ['crushing', 'unstoppable', { id: 'swift_prayer', name: 'Swift Prayer', desc: 'Casting time −50%.', apply: d => { d.cast *= 0.5; } }],
        [{ id: 'law_of_light', name: 'Law of Light', desc: 'The sword stays embedded for 4 s, healing allies around it for 3% HP per second.', apply: d => { addEv(d.events, allyZone(0.1, { at: 'point', r: 5, dur: 4, tick: 1, healPct: 0.03, kind: 'holy' })); } }, 'enhanced:0.4']],
    },
    {
      id: 'holy_explosion', name: 'Holy Explosion', type: 'normal', cd: 10, mp: 70, dur: 0.7,
      desc: 'Plant the sword and release a burst of holy light around you.', props: { stagger: 'Mid' },
      events: [A(0, 'slam', 0.7), H(0.3, { ...circle(4.2), coef: 16.8, stagger: 10, knock: 'push', kb: 2, elem: HO }), FX(0.3, 'holy_nova', { color: HO, r: 4.2 }), K(0.3, 0.25), S(0.3, 'explosion')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['keen', 'crushing', { id: 'mending_light', name: 'Mending Light', desc: 'The burst also heals allies within 6 m for 6% of their max HP.', apply: d => { addEv(d.events, B(0.3, { target: 'party', heal: 0.06, healOf: 'max', r: 6 })); } }],
        [{ id: 'twin_suns', name: 'Twin Suns', desc: 'A second, larger burst follows (+60% damage).', apply: d => { addEv(d.events, H(0.65, { ...circle(5.5), coef: 10.1, stagger: 5, elem: HO }), FX(0.65, 'holy_nova', { color: HO, r: 5.5 })); d.dur = 0.85; } }, 'enhanced:0.4']],
    },
    {
      id: 'flash_slash', name: 'Flash Slash', type: 'normal', cd: 6, mp: 40, dur: 0.5,
      desc: 'Dart forward with a gleaming cut.', props: { stagger: 'Low' },
      events: [A(0, 'dash_strike', 0.5), M(0, 'dash', 3.5, 0.16), H(0.14, { ...rect(4.2, 2.6, -2.5), coef: 9.1, stagger: 5 }), FX(0.14, 'slash', { color: GO, r: 3, arc: 140 }), S(0.14, 'slash')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['keen', 'wide', 'stance'],
        [{ id: 'double_flash', name: 'Double Flash', desc: 'Flash back to where you started with a second cut (+70% damage).', apply: d => { addEv(d.events, M(0.3, 'back', 3.5, 0.16), H(0.42, { ...rect(4.2, 2.6), coef: 6.4, stagger: 3 }), FX(0.42, 'slash', { color: GO, r: 3, arc: 140, flip: true })); d.dur = 0.65; } }, 'enhanced:0.5']],
    },
    {
      id: 'execution_of_justice', name: 'Execution of Justice', type: 'holding', cd: 14, mp: 90, holdMax: 2.0, superArmor: 'push',
      desc: 'Hold to drive a flurry of holy thrusts forward; release for a final lunge.', props: { stagger: 'Mid', superArmor: 'push' },
      onStart: r => r.u.model?.play?.('thrust', { loop: true, dur: 0.18 }),
      events: [],
      loop: { every: 0.18, walk: 1, events: [H(0, { ...rect(4.4, 2.2), coef: 1.8, stagger: 1.5, elem: HO }), FX(0, 'holy_thrust', { color: HO, len: 4.4 }), S(0, 'slash')] },
      end: [A(0, 'thrust', 0.45), M(0, 'dash', 1.5, 0.12), H(0.15, { ...rect(5.2, 2.6), coef: 7.7, stagger: 6, knock: 'push', kb: 2, elem: HO }), FX(0.15, 'holy_thrust', { color: HO, len: 5.2 }), S(0.15, 'slash_heavy')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['keen', 'stance', { id: 'judging_thrusts', name: 'Judging Thrusts', desc: 'Thrusts Brand enemies for 8 s.', apply: d => { evs(d.loop.events, 'hit')[0].brand = 8; } }],
        [{ id: 'final_judgment', name: 'Final Judgment', desc: 'The final lunge deals +150% damage.', apply: d => { evs(d.end, 'hit')[0].coef *= 2.5; } }, 'enhanced:0.4']],
    },
    {
      id: 'wrath_of_heaven', name: 'Wrath of Heaven', type: 'point', cd: 16, mp: 100, range: 10, dur: 0.8,
      desc: 'Pillars of light crash down on the target area four times.', props: { stagger: 'Mid' },
      events: [A(0, 'cast_up', 0.8), S(0.3, 'holy'), ...hits(4, 0.45, 0.2, { ...circle(3.3), at: 'point', coef: 25.2, stagger: 12, elem: HO }),
        FX(0.45, 'light_pillar', { at: 'point', color: HO, r: 3.3 }), FX(0.65, 'light_pillar', { at: 'point', color: HO, r: 3.3 }), FX(0.85, 'light_pillar', { at: 'point', color: HO, r: 3.3 }), FX(1.05, 'light_pillar', { at: 'point', color: HO, r: 3.3 })],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['keen', 'crushing', { id: 'branding_wrath', name: 'Branding Wrath', desc: 'The pillars Brand enemies for 12 s.', apply: d => { for (const h of evs(d.events, 'hit')) h.brand = 12; } }],
        [{ id: 'heavens_verdict', name: 'Heaven\'s Verdict', desc: 'A fifth, greater pillar lands last (+50% damage).', apply: d => { addEv(d.events, H(1.3, { ...circle(4), at: 'point', coef: 12.6, stagger: 6, elem: HO, knock: 'down' }), FX(1.3, 'light_pillar', { at: 'point', color: HO, r: 4, big: true })); d.dur = 1.35; } }, 'enhanced:0.4']],
    },
    {
      id: 'charging_blade', name: 'Charging Blade', type: 'normal', cd: 10, mp: 50, dur: 0.6, superArmor: 'push',
      desc: 'Charge forward behind the tome\'s light, bowling enemies over. Super Armor.', props: { stagger: 'High', superArmor: 'push' },
      events: [A(0, 'dash_strike', 0.6), M(0, 'dash', 7, 0.35), H(0.1, { ...circle(1.9), coef: 5.6, stagger: 16, knock: 'push', kb: 3, once: true }), H(0.25, { ...circle(1.9), coef: 5.6, stagger: 16, knock: 'push', kb: 3, once: true }), FX(0, 'dash_trail', { color: GO }), S(0, 'dash')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['crushing', 'unstoppable', 'keen'],
        [{ id: 'crusade', name: 'Crusade', desc: 'Allies you pass are healed for 5% HP and gain Move Speed +15% for 4 s.', apply: d => { addEv(d.events, B(0.3, { target: 'party', id: 'crusade', dur: 4, mods: { moveSpd: 0.15 }, heal: 0.05, healOf: 'max', r: 8, name: 'Crusade', icon: icon('charging_blade') })); } }, 'enhanced:0.6']],
    },
    {
      id: 'sacred_chain', name: 'Sacred Chain', type: 'normal', cd: 12, mp: 60, dur: 0.75, superArmor: 'push',
      desc: 'Hurl chains of light that snare enemies and drag them to you. Counter.', props: { stagger: 'High', counter: true, superArmor: 'push' },
      events: [A(0, 'pull', 0.75), H(0.28, { ...rect(8.5, 2.6), coef: 12.6, stagger: 16, counter: true, knock: 'pull', kb: 6, elem: HO }), FX(0.28, 'chain', { color: HO, len: 8.5 }), S(0.28, 'chain')],
      tripods: [['quick_prep', 'weak_point', 'wide'], ['crushing', 'keen', { id: 'binding_chain', name: 'Binding Chain', desc: 'Snared enemies are stunned for 2 s (non-bosses) and Branded for 8 s.', apply: d => { const h = evs(d.events, 'hit')[0]; h.knock = 'stun'; h.knockDur = 2; h.brand = 8; } }],
        [{ id: 'chain_of_judgment', name: 'Chain of Judgment', desc: 'Reel in and strike with the sword (+120% damage).', apply: d => { addEv(d.events, A(0.6, 'slash_h', 0.4), H(0.75, { ...cone(3.4, 140), coef: 15.1, stagger: 8 }), FX(0.75, 'slash', { color: GO, r: 3.4, arc: 140 })); d.dur = 1.05; } }, 'enhanced:0.5']],
    },
    {
      id: 'rite_of_mending', name: 'Rite of Mending', type: 'normal', cd: 24, mp: 110, dur: 0.9, fixedSpeed: true,
      desc: 'Consecrate the ground: allies are healed for 10% of max HP at once and 4% more every second for 6 s while they stand in the light.', props: {},
      events: [A(0, 'cast_ground', 0.9), B(0.3, { target: 'party', heal: 0.1, healOf: 'max', r: 16 }), allyZone(0.3, MEND), FX(0.3, 'holy_circle', { color: HO, r: 5.5, dur: 6 }), S(0.3, 'heal')],
      tripods: [['quick_prep', 'mana_saver', 'wide'], [{ id: 'deep_mending', name: 'Deep Mending', desc: 'Heals 40% more.', apply: d => { evs(d.events, 'buff')[0].heal *= 1.4; swapZone(d, { healPct: 0.056 }); } },
          { id: 'sanctuary', name: 'Sanctuary', desc: 'Allies standing in the light also take 10% less damage.', apply: d => { addEv(d.events, allyZone(0.3, { r: 5.5, dur: 6, tick: 0.5, buff: { id: 'sanctuary', dur: 0.8, mods: { dmgTaken: -0.1 }, name: 'Sanctuary', icon: icon('rite_of_mending') } })); } },
          { id: 'renewal', name: 'Renewal', desc: 'Also removes harmful effects.', apply: d => { addEv(d.events, partyCleanse(0.31, 16)); } }],
        [{ id: 'lasting_rite', name: 'Lasting Rite', desc: 'The light lingers for 10 s.', apply: d => { swapZone(d, { dur: 10 }); } }, { id: 'radiant_rite', name: 'Radiant Rite', desc: 'The consecration also scorches enemies in it (holy damage every second).', apply: d => { swapZone(d, { hit: { coef: 2.1, stagger: 1, elem: HO } }); } }]],
    },
  ],
  defaultBar: ['heavenly_blessing', 'light_shock', 'holy_bulwark', 'rite_of_mending', 'sword_of_justice', 'godsent_law', 'wrath_of_heaven', 'sacred_chain'],
  engravings: [
    { id: 'blessed_aura', name: 'Blessed Aura', desc: 'Aegis of Dawn also shields the party (120% of Attack Power) and its protection lasts 12 s. Healing and shields +10%.', mods: { healMul: 0.1, shieldMul: 0.1 } },
    { id: 'judgment', name: 'Judgment', desc: 'Sanctity fills 50% faster. Sacred Punishment deals +60% damage and grants you +15% damage for 10 s. Damage +10%; your shields and heals −30%.', mods: { identityGain: 0.5, dmgMul: 0.1, healMul: -0.3, shieldMul: -0.3 } },
  ],
});
