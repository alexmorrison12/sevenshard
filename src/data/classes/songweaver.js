// SONGWEAVER — harp mystic (SUPPORT). Brands foes with sound, raises the party's damage with Heavenly Tune, shields with
// Guardian Tune, heals and hastes. Identity: Serenade bubbles ×3 → Z Anthem of Courage (party damage +15%, 5 s per
// bubble) · X Hymn of Mending (healing zone, stronger per bubble). Both spend every bubble.
import { A, H, FX, S, K, M, P, Z, B, C, circle, cone, rect, hits } from '../../game/skills/dsl.js';
import { withEngr, hasEngr, evs, addEv, allyZone, partyBuffScaled, partyInvuln, partyCleanse, orbsSpent, finalize } from './common.js';

const MU = 'rose', HO = 'holy', GO = 'gold';
const icon = id => `skill:songweaver:${id}`;
const note = (t, o = {}) => P(t, { speed: 22, range: 12, radius: 0.7, kind: 'music_note', color: MU, ...o });

const anthem = {
  id: 'anthem_of_courage', name: 'Anthem of Courage', type: 'normal', orbs: 'all', perOrbMul: 1, dur: 0.9, superArmor: 'full', fixedSpeed: true,
  desc: 'Spend every Serenade bubble on a rousing anthem: the party deals 15% more damage for 5 s per bubble.', props: { superArmor: 'full' },
  events: [A(0, 'strum_big', 0.9), S(0.1, 'harp'), FX(0.25, 'music_burst', { color: MU, r: 8 }),
    partyBuffScaled(0.3, { id: 'anthem_of_courage', dur: 5, r: 16, name: 'Anthem of Courage', icon: 'skill:songweaver:identity_z',
      scale: run => orbsSpent(run) * (hasEngr(run.u.kit, 'heart_of_courage') ? 1.4 : 1),
      mods: run => ({ dmgMul: hasEngr(run.u.kit, 'heart_of_courage') ? 0.2 : 0.15 }) }),
    K(0.3, 0.15)],
};
const hymn = {
  id: 'hymn_of_mending', name: 'Hymn of Mending', type: 'normal', orbs: 'all', perOrbMul: 1, dur: 0.9, superArmor: 'full', fixedSpeed: true,
  desc: 'Spend every Serenade bubble on a healing hymn: a 6 m circle of song heals allies in it for 4% of max HP per second per bubble, for 6 s.', props: { superArmor: 'full' },
  events: [A(0, 'harp_loop', 0.9), S(0.1, 'harp'), FX(0.25, 'music_circle', { color: MU, r: 6, dur: 6 }),
    allyZone(0.3, { r: 6, dur: 6, tick: 1, first: 0, healPct: 0.04, scaleByMult: true, kind: 'music' })],
};

export default finalize({
  id: 'songweaver', name: 'Songweaver', archetype: 'Mystic', role: 'support', weapon: 'harp', difficulty: 3,
  blurb: 'A bard whose harp shields friends and shatters foes. The Songweaver keeps a raid alive, marks the enemy for the kill and plays the anthem that wins the fight.',
  palette: { main: 0xf09a8a, glow: [3, 1.2, 2.2], fx: MU },
  dash: { cd: 9, dist: 5.2, dur: 0.28 },
  stats: { hp: 0.95, atk: 1.0, def: 0.95 },
  basic: [
    { anim: 'atk1', dur: 0.36, hit: { t: 0.14, shape: 'none' }, proj: { t: 0.14, speed: 24, range: 11, radius: 0.6, kind: 'music_note', color: MU, hit: { coef: 1.0, stagger: 1.5 } }, sfx: 'note' },
    { anim: 'atk2', dur: 0.36, hit: { t: 0.14, shape: 'none' }, proj: { t: 0.14, speed: 24, range: 11, radius: 0.6, kind: 'music_note', color: MU, hit: { coef: 1.1, stagger: 1.5 } }, sfx: 'note' },
    { anim: 'atk3', dur: 0.5, hit: { t: 0.22, shape: 'none' }, proj: { t: 0.22, speed: 22, range: 11, radius: 0.7, count: 3, spread: 0.4, kind: 'music_note', color: MU, hit: { coef: 0.7, stagger: 1 } }, sfx: 'note' },
  ],
  identity: {
    handler: 'orbs', kind: 'bubbles', hudKind: 'bubbles', label: 'Serenade', perOrb: 100, maxOrbs: 3, gainPerHit: 1.6, gainBasic: 0.7, color: '#f09a8a',
    z: anthem, x: hymn,
  },
  awakening: {
    id: 'grand_finale', name: 'Grand Finale', type: 'normal', cd: 180, uses: 3, dur: 2.2, cancelAt: 2.0, superArmor: 'full', fixedSpeed: true,
    desc: 'Play the Grand Finale: the party is made invulnerable for 3 s and healed for 50% of max HP, then the last chord shatters everything around you.', props: { stagger: 'Very High', wp: 2, superArmor: 'full' },
    events: [
      A(0, 'awaken', 0.5), FX(0, 'awaken_aura', { color: MU }), S(0, 'awaken'),
      A(0.4, 'strum_big', 1.2), partyInvuln(0.45, 3, 18, { name: 'Grand Finale', icon: 'skill:songweaver:awakening' }), B(0.45, { target: 'party', heal: 0.5, healOf: 'max', r: 18 }), FX(0.45, 'music_burst', { color: MU, r: 10, big: true }),
      H(1.4, { ...circle(7), coef: 300, stagger: 60, wp: 2, brand: 12, knock: 'down', heavy: true }), FX(1.4, 'sound_shockwave', { color: MU, r: 7, big: true }), K(1.4, 0.8), S(1.4, 'explosion_big'),
    ],
  },
  skills: [
    {
      id: 'sound_shock', name: 'Sound Shock', type: 'normal', cd: 6, mp: 40, dur: 0.5,
      desc: 'Strike a harsh chord: a cone of sound that Brands enemies for 10 s (Branded foes take 10% more damage from the party).', props: { stagger: 'Low' },
      events: [A(0, 'strum', 0.5), H(0.2, { ...cone(5, 70), coef: 6.6, stagger: 6, brand: 10 }), FX(0.2, 'sound_wave', { color: MU, r: 5, arc: 70 }), S(0.2, 'harp')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['keen', 'crushing', { id: 'resonance', name: 'Resonance', desc: 'A second wave follows (+60% damage).', apply: d => { addEv(d.events, H(0.45, { ...cone(6, 70), coef: 3.9, stagger: 3 }), FX(0.45, 'sound_wave', { color: MU, r: 6, arc: 70 })); d.dur = 0.6; } }],
        [{ id: 'harmonic_brand', name: 'Harmonic Brand', desc: 'The Brand lasts 16 s.', apply: d => { evs(d.events, 'hit')[0].brand = 16; } }, 'enhanced:0.6']],
    },
    {
      id: 'harp_of_rhythm', name: 'Harp of Rhythm', type: 'normal', cd: 18, mp: 70, dur: 0.6, fixedSpeed: true,
      desc: 'Summon orbiting notes that strike nearby enemies every half second for 6 s.', props: { stagger: 'Low' },
      events: [A(0, 'strum', 0.6), S(0.2, 'harp'), Z(0.2, { r: 3.4, dur: 6, tick: 0.5, follow: true, kind: 'notes', hit: { coef: 1.8, stagger: 1 } }), FX(0.2, 'orbiting_notes', { color: MU, r: 3.4, dur: 6, follow: true }),
        H(6.2, { ...circle(3.6), coef: 11.5, stagger: 4, if: withEngr('last_refrain') }), FX(6.2, 'music_burst', { color: MU, r: 3.6, if: withEngr('last_refrain') })],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['keen', { id: 'tempo', name: 'Tempo', desc: 'The notes strike 40% more often.', apply: d => { evs(d.events, 'zone')[0].tick = 0.35; } }, 'shock'],
        [{ id: 'crescendo', name: 'Crescendo', desc: 'The notes explode when the song ends (coef 16).', apply: d => { addEv(d.events, H(6.2, { ...circle(3.6), coef: 13.1, stagger: 4 }), FX(6.2, 'music_burst', { color: MU, r: 3.6 })); } }, 'enhanced:0.5']],
    },
    {
      id: 'stigma', name: 'Stigma', type: 'normal', cd: 12, mp: 60, dur: 0.6,
      desc: 'Fling a heavy note that bursts on impact, Branding enemies for 12 s.', props: { stagger: 'Mid' },
      events: [A(0, 'strum', 0.6), note(0.22, { hit: { shape: 'circle', r: 3, coef: 11.5, stagger: 8, brand: 12 } }), S(0.22, 'note')],
      tripods: [['quick_prep', 'weak_point', 'wide'], ['keen', 'pierce', { id: 'heavy_stigma', name: 'Heavy Stigma', desc: 'Branded enemies are also slowed by 30% for 6 s, and the burst widens to 4 m.', apply: d => { const h = evs(d.events, 'proj')[0].hit; h.status = [{ id: 'slow', dur: 6 }]; h.r = 4; } }],
        [{ id: 'echo', name: 'Echo', desc: 'A second note follows the first (+70% damage).', apply: d => { addEv(d.events, note(0.4, { hit: { shape: 'circle', r: 3, coef: 8, stagger: 4 } })); d.dur = 0.7; } }, 'enhanced:0.5']],
    },
    {
      id: 'guardian_tune', name: 'Guardian Tune', type: 'normal', cd: 20, mp: 90, dur: 0.8, fixedSpeed: true,
      desc: 'Play a protective melody: allies within 16 m gain a shield worth 160% of your Attack Power for 6 s.', props: {},
      events: [A(0, 'strum_big', 0.8), B(0.3, { target: 'party', shield: 1.6, shieldDur: 6, shieldId: 'guardian_tune', r: 16 }), FX(0.3, 'music_shield', { color: MU, r: 3 }), S(0.3, 'shield')],
      tripods: [['quick_prep', 'mana_saver', { id: 'far_tune', name: 'Carrying Tune', desc: 'Reaches allies up to 24 m away.', apply: d => { evs(d.events, 'buff')[0].r = 24; } }],
        [{ id: 'bastion', name: 'Bastion', desc: 'Shield +40%.', apply: d => { evs(d.events, 'buff')[0].shield *= 1.4; } }, { id: 'swift_tune', name: 'Swift Tune', desc: 'Shielded allies also gain Move Speed +15% for 6 s.', apply: d => { addEv(d.events, B(0.31, { target: 'party', id: 'swift_tune', dur: 6, mods: { moveSpd: 0.15 }, r: 16, name: 'Swift Tune', icon: icon('guardian_tune') })); } }, { id: 'cleansing_tune', name: 'Cleansing Tune', desc: 'Also removes harmful effects.', apply: d => { addEv(d.events, partyCleanse(0.31, 16)); } }],
        [{ id: 'sanctuary_song', name: 'Sanctuary Song', desc: 'Shielded allies also take 10% less damage for 6 s.', apply: d => { addEv(d.events, B(0.31, { target: 'party', id: 'sanctuary_song', dur: 6, mods: { dmgTaken: -0.1 }, r: 16, name: 'Sanctuary Song', icon: icon('guardian_tune') })); } }, { id: 'long_tune', name: 'Long Tune', desc: 'The shield lasts 10 s.', apply: d => { evs(d.events, 'buff')[0].shieldDur = 10; } }]],
    },
    {
      id: 'heavenly_tune', name: 'Heavenly Tune', type: 'normal', cd: 18, mp: 100, dur: 0.8, fixedSpeed: true,
      desc: 'A radiant melody from on high: allies within 16 m deal 15% more damage for 9 s.', props: { stagger: 'Low' },
      events: [A(0, 'strum_big', 0.8), B(0.3, { target: 'party', id: 'heavenly_tune', dur: 9, mods: { dmgMul: 0.15 }, r: 16, name: 'Heavenly Tune', icon: icon('heavenly_tune') }), FX(0.3, 'music_burst', { color: GO, r: 6 }), H(0.35, { ...circle(3.8), coef: 6.6, stagger: 4 }), S(0.3, 'harp')],
      tripods: [['quick_prep', 'mana_saver', 'wide'], [{ id: 'lingering_tune', name: 'Lingering Tune', desc: 'The melody lasts 13 s.', apply: d => { evs(d.events, 'buff')[0].dur = 13; } }, { id: 'bright_tune', name: 'Bright Tune', desc: 'The melody also grants Crit Rate +6%.', apply: d => { evs(d.events, 'buff')[0].mods.crit = 0.06; } }, 'keen'],
        [{ id: 'quickstep', name: 'Quickstep', desc: 'The melody also grants Attack Speed +8%.', apply: d => { evs(d.events, 'buff')[0].mods.atkSpd = 0.08; } }, { id: 'serenade_tune', name: 'Serenade Tune', desc: 'Playing it charges half a Serenade bubble.', apply: d => { addEv(d.events, C(0.3, run => { const st = run.u.kit?.identity?.state; if (st && st.orbs < 3) { st.v += 50; while (st.v >= 100 && st.orbs < 3) { st.v -= 100; st.orbs++; } } })); } }]],
    },
    {
      id: 'rhapsody_of_light', name: 'Rhapsody of Light', type: 'casting', cd: 24, mp: 120, cast: 1.0, range: 10, dur: 0.6, fixedSpeed: true,
      desc: 'Play a rhapsody that calls a column of light onto the target point, damaging enemies and healing the party for 15% of max HP.', props: { stagger: 'Mid' },
      onStart: r => r.u.model?.play?.('harp_loop', { loop: true }),
      events: [A(0, 'strum_big', 0.6), B(0.05, { target: 'party', heal: 0.15, healOf: 'max', r: 16 }), H(0.05, { ...circle(4), at: 'point', coef: 24.6, stagger: 12 }), FX(0.05, 'light_pillar', { at: 'point', color: HO, r: 4, big: true }), S(0.05, 'heal')],
      tripods: [['quick_prep', 'weak_point', 'wide'], [{ id: 'quick_rhapsody', name: 'Quick Rhapsody', desc: 'Casting time −50%.', apply: d => { d.cast *= 0.5; } }, 'keen', 'crushing'],
        [{ id: 'radiant_rhapsody', name: 'Radiant Rhapsody', desc: 'Heals 60% more.', apply: d => { evs(d.events, 'buff')[0].heal *= 1.6; } }, { id: 'lingering_light', name: 'Lingering Light', desc: 'The light lingers for 5 s, healing allies in it 3% HP per second.', apply: d => { addEv(d.events, allyZone(0.1, { at: 'point', r: 4.5, dur: 5, tick: 1, healPct: 0.03, kind: 'holy' })); } }]],
    },
    {
      id: 'wind_of_music', name: 'Wind of Music', type: 'normal', cd: 20, mp: 60, dur: 0.6, fixedSpeed: true,
      desc: 'A light breeze of song: removes harmful effects from the party and grants Move Speed +20% and Attack Speed +8% for 6 s.', props: {},
      events: [A(0, 'strum', 0.6), B(0.2, { target: 'party', id: 'wind_of_music', dur: 6, mods: { moveSpd: 0.2, atkSpd: 0.08 }, r: 16, name: 'Wind of Music', icon: icon('wind_of_music') }), partyCleanse(0.2, 16), FX(0.2, 'music_wind', { color: MU, r: 5 }), S(0.2, 'buff')],
      tripods: [['quick_prep', 'mana_saver', { id: 'wide_wind', name: 'Wide Wind', desc: 'Reaches allies up to 24 m away.', apply: d => { evs(d.events, 'buff')[0].r = 24; } }],
        [{ id: 'tailwind', name: 'Tailwind', desc: 'The haste lasts 10 s.', apply: d => { evs(d.events, 'buff')[0].dur = 10; } }, { id: 'allegro', name: 'Allegro', desc: 'Attack Speed bonus doubled.', apply: d => { evs(d.events, 'buff')[0].mods.atkSpd = 0.16; } }, { id: 'gentle_breeze', name: 'Gentle Breeze', desc: 'Also heals the party for 8% of max HP.', apply: d => { evs(d.events, 'buff')[0].heal = 0.08; evs(d.events, 'buff')[0].healOf = 'max'; } }],
        [{ id: 'gale_song', name: 'Gale Song', desc: 'The wind also knocks nearby enemies away (coef 20).', apply: d => { addEv(d.events, H(0.25, { ...circle(4), coef: 16.4, stagger: 10, knock: 'push', kb: 3 }), FX(0.25, 'shockwave', { color: MU, r: 4 })); } }, { id: 'windwalker', name: 'Windwalker', desc: 'Allies also gain 1 s of evasion (invulnerability).', apply: d => { addEv(d.events, partyInvuln(0.21, 1, 16)); } }]],
    },
    {
      id: 'sonic_vibration', name: 'Sonic Vibration', type: 'point', cd: 18, mp: 110, range: 10, dur: 0.9, superArmor: 'push',
      desc: 'Pluck a note so deep the ground itself resonates at the target point. Very high stagger.', props: { stagger: 'Very High', wp: 1, superArmor: 'push' },
      events: [A(0, 'strum_big', 0.9), FX(0.2, 'sound_ring', { at: 'point', color: MU, r: 4.2 }), S(0.3, 'harp'),
        H(0.5, { ...circle(4.2), at: 'point', coef: 26.2, stagger: 66, wp: 1, knock: 'down', heavy: true }), FX(0.5, 'sound_shockwave', { at: 'point', color: MU, r: 4.2 }), K(0.5, 0.45), S(0.5, 'explosion')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['crushing', 'unstoppable', { id: 'shattering_note', name: 'Shattering Note', desc: 'Brands enemies for 10 s.', apply: d => { evs(d.events, 'hit')[0].brand = 10; } }],
        [{ id: 'aftershock_chord', name: 'Aftershock Chord', desc: 'Two more vibrations follow (+60% damage).', apply: d => { addEv(d.events, ...hits(2, 0.85, 0.3, { ...circle(4.6), at: 'point', coef: 15.7, stagger: 10 }), FX(0.85, 'sound_ring', { at: 'point', color: MU, r: 4.6 }), FX(1.15, 'sound_ring', { at: 'point', color: MU, r: 4.6 })); d.dur = 1.2; } }, 'enhanced:0.4']],
    },
    {
      id: 'prelude_of_storm', name: 'Prelude of Storm', type: 'holding', cd: 12, mp: 80, holdMax: 2.0,
      desc: 'Hold to pour waves of stormy sound ahead; release for a final crash.', props: { stagger: 'Mid' },
      onStart: r => r.u.model?.play?.('harp_loop', { loop: true }),
      events: [],
      loop: { every: 0.25, walk: 1.2, events: [H(0, { ...cone(5.5, 60), coef: 2.1, stagger: 2 }), FX(0, 'sound_wave', { color: MU, r: 5.5, arc: 60 }), S(0, 'note')] },
      end: [A(0, 'strum_big', 0.45), H(0.15, { ...cone(6, 70), coef: 7.4, stagger: 6, knock: 'push', kb: 2 }), FX(0.15, 'sound_wave', { color: MU, r: 6, arc: 70, big: true }), S(0.15, 'harp')],
      tripods: [['quick_prep', 'mobility', 'weak_point'], ['keen', 'shock', 'wide'],
        [{ id: 'thunderous_finale', name: 'Thunderous Finale', desc: 'The final crash deals +150% damage and Brands for 10 s.', apply: d => { const h = evs(d.end, 'hit')[0]; h.coef *= 2.5; h.brand = 10; } }, 'enhanced:0.4']],
    },
    {
      id: 'rhythm_buckshot', name: 'Rhythm Buckshot', type: 'combo', cd: 9, mp: 60,
      desc: 'Three bursts of scattering notes in rhythm.', props: { stagger: 'Mid' },
      stages: [
        { dur: 0.36, window: 0.12, events: [A(0, 'strum', 0.36), note(0.1, { count: 3, spread: 0.5, hit: { coef: 2.1, stagger: 2 } }), S(0.1, 'note')] },
        { dur: 0.36, window: 0.12, events: [A(0, 'strum', 0.36), note(0.1, { count: 3, spread: 0.5, hit: { coef: 2.1, stagger: 2 } }), S(0.1, 'note')] },
        { dur: 0.5, events: [A(0, 'strum_big', 0.5), note(0.16, { count: 5, spread: 0.8, hit: { coef: 2.3, stagger: 2 } }), S(0.16, 'harp')] },
      ],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['keen', 'pierce', 'wide'],
        [{ id: 'fortissimo', name: 'Fortissimo', desc: 'The notes burst on impact (small area, +40% damage).', apply: d => { for (const s of d.stages) { const p = evs(s.events, 'proj')[0]; p.hit = { ...p.hit, shape: 'circle', r: 1.8, coef: p.hit.coef * 1.4 }; } } }, 'enhanced:0.4']],
    },
    {
      id: 'soundholic', name: 'Soundholic', type: 'point', cd: 14, mp: 90, range: 10, dur: 0.7,
      desc: 'Throw a pulsing sound bomb that detonates at the target point.', props: { stagger: 'Mid' },
      events: [A(0, 'throw', 0.7), FX(0.2, 'sound_bomb', { at: 'point', color: MU, r: 1 }), H(0.6, { ...circle(3.6), at: 'point', coef: 23, stagger: 12, knock: 'push', kb: 2 }), FX(0.6, 'sound_shockwave', { at: 'point', color: MU, r: 3.6 }), S(0.6, 'explosion')],
      tripods: [['quick_prep', 'wide', 'weak_point'], ['keen', 'crushing', { id: 'lingering_hum', name: 'Lingering Hum', desc: 'The bomb hums for 3 s after exploding, damaging enemies around it.', apply: d => { addEv(d.events, Z(0.65, { at: 'point', r: 3.2, dur: 3, tick: 0.5, kind: 'music', hit: { coef: 1.5, stagger: 1 } })); } }],
        [{ id: 'double_bomb', name: 'Encore', desc: 'A second bomb follows (+60% damage).', apply: d => { addEv(d.events, H(0.95, { ...circle(3.6), at: 'point', coef: 13.8, stagger: 6 }), FX(0.95, 'sound_shockwave', { at: 'point', color: MU, r: 3.6 })); d.dur = 1.0; } }, 'enhanced:0.4']],
    },
    {
      id: 'tempest_chord', name: 'Tempest Chord', type: 'charge', cd: 14, mp: 80, chargeTime: 0.8, perfect: [0.75, 1.0], perfectMul: 1.2, dur: 0.5, superArmor: 'push',
      desc: 'Build a chord to a crescendo and release it as a blast of sound. Counter. Release in the gold zone for a Perfect chord.', props: { stagger: 'High', counter: true, superArmor: 'push' },
      onStart: r => r.u.model?.play?.('harp_loop', { loop: true }),
      events: [A(0, 'strum_big', 0.5), H(0.08, { ...cone(5.5, 80), coef: 19.7, stagger: 18, counter: true, knock: 'push', kb: 3 }), FX(0.08, 'sound_wave', { color: MU, r: 5.5, arc: 80, big: true }), K(0.08, 0.3), S(0.08, 'harp')],
      tripods: [['quick_prep', 'swift', 'weak_point'], ['crushing', 'unstoppable', 'keen'],
        [{ id: 'storm_chord', name: 'Storm Chord', desc: 'The chord also Brands enemies for 10 s and deals +40% damage.', apply: d => { const h = evs(d.events, 'hit')[0]; h.brand = 10; h.coef *= 1.4; } }, { id: 'overture', name: 'Overture', desc: 'Perfect release damage +50%.', apply: d => { d.perfectMul *= 1.5; } }]],
    },
  ],
  defaultBar: ['heavenly_tune', 'sound_shock', 'guardian_tune', 'rhapsody_of_light', 'stigma', 'sonic_vibration', 'tempest_chord', 'rhythm_buckshot'],
  engravings: [
    { id: 'last_refrain', name: 'Last Refrain', desc: 'Damage focus: Damage +20%, and Harp of Rhythm\'s notes explode when the song ends.', mods: { dmgMul: 0.2 } },
    { id: 'heart_of_courage', name: 'Heart of Courage', desc: 'Anthem of Courage grants +20% damage (instead of +15%) and lasts 40% longer. Shields +10%.', mods: { shieldMul: 0.1 } },
  ],
});
