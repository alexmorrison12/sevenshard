// LEGION RAID — Gorrath, the Horned Tyrant (gate 2, 8 players). The flagship fight.
//
//  100% → 70%  axe cleaves & sweeps, a counterable triple sweep (Tyrant's Reaping), orange horn-charge lines, tremor
//              stomp rings, leap slam onto a raider, a returning axe throw, a whirling back-swipe for back attackers,
//              a fear roar. HORNED FURY: every ~55 s his horns blaze (+30% damage, faster) and only then can they be
//              broken (destruction bar; bombs / weak-point skills). Breaking a horn ends the fury; break both and it
//              never returns.
//  70%         RIFT CARVE — he leaps to the centre and splits the throne into eight 45° wedges that erupt in two
//              alternating waves (odd wedges, then even; a third wave in hard mode). His cleaves now leave burning scars.
//  50%         THE HORNED TYRANT GATHERS HIS WRATH — raid stagger check; failure is a near-wipe.
//  40%         SOULFIRE — he plants his axe and turns untargetable; destroy the Soulfire Orbs before he devours them
//              (each devoured orb = heavy raid-wide blast + permanent damage). Success leaves him exposed and stunned.
//  30%         GHOST PHASE — the Tyrant's Spectre: 20% faster, spectral axe rain under everyone, the Wheel of Ruin
//              (in/out), counterable spectral lunges, double horn charges, and Spectral Dread pulses that grow every
//              20 s (soft enrage). Hard enrage at 15:00.
import { DEG, fwd, back, angDir, rnd, tele, wait, strike, smash, volley, act, hold, counter, pool, fearHit, buff, unbuff,
  reachAlong, center, onNav, behind, farthest, visual, adds, clearAdds, scaleHp, sfx, fx } from './kit.js';

const HORN_HP = 1200;         // destruction per horn (a bomb deals ~60, weak-point skills 10–30 per hit)
const ORB_HP = 100;           // Soulfire Orb hp (× wisp template × tier attack power)
const WRATH = 1000;           // stagger needed at 50% (8 players deal ~1100–1600 in 9 s)
const GHOST = 'arcane';       // FX colour of the spectre

function setHaste(B) { B.flags.haste = (B.flags.hasteBase || 1) * (B.flags.fury ? 0.85 : 1); }
// His horns can only be broken while they blaze (Horned Fury); progress carries over between furies.
function showHorn(B) {
  if (B.flags.hornsBroken) return;
  const part = B.flags.hornLBroken ? 'hornR' : 'hornL', max = Math.round(HORN_HP * (B.mods.hard ? 1.25 : 1));
  B.destruction(part, max, () => {
    if (part === 'hornL') { B.flags.hornLBroken = true; B.banner('Gorrath’s left horn shatters! The fury dies down.', 'good'); }
    else { B.flags.hornsBroken = true; B.banner('Both horns are broken — the Tyrant’s fury is spent for good!', 'good'); }
    endFury(B);
    if (!B.flags.inMech) B.interrupt(3.5);
  });
  B.u.data.destruction.v = B.flags.hornV?.[part] ?? max;
}
function hideHorn(B) {
  const ds = B.u.data.destruction;
  if (ds && !ds.broken) (B.flags.hornV ||= {})[ds.part] = ds.v;
  B.u.data.destruction = null;
}
function endFury(B) {
  if (!B.flags.fury) return;
  B.flags.fury = false; unbuff(B, 'horned_fury'); setHaste(B); hideHorn(B);
  B.u.model?.setGlow?.('enrage', 0); if (!B.enraged) B.u.data.enraged = false;   // data.enraged is co-op synced
}
const cw = B => 2 * (B.u.radius + 0.6);   // width of the strip a charge actually sweeps
const ghostly = B => B.phase >= 3;

async function hornCharge(B, tgt, teleDur) {
  if (!tgt) return;
  B.turnTo(tgt);
  const dir = fwd(B), len = Math.max(6, reachAlong(B, dir, 24)), runT = Math.min(0.95, 0.35 + len / 30);
  act(B, 'horn_charge', teleDur);
  const tg = tele(B, 'rect', { len: len + 1.5, width: cw(B), dur: teleDur, color: 'orange' });
  await wait(B, teleDur); tg.alive = false;
  sfx(B, 'charge_roar'); fx(B, 'charge_dust', B.u.pos.x, B.u.pos.z, { follow: true, dur: runT + 0.3, color: ghostly(B) ? GHOST : null });
  await B.charge(len, runT * (B.flags.haste || 1), { coef: 1.3 * (B.mods.hard ? 1.25 : 1), knock: 'down', kb: 5 });
  smash(B, 'circle', { r: 3.6, coef: 0.3, knock: 'push', kb: 3, fx: 'dust_burst', sfx: 'impact_heavy', shake: 0.35 });
}

export default {
  id: 'gorrath', model: 'gorrath', name: 'Gorrath', title: 'the Horned Tyrant', kind: 'legion',
  radius: 2.3, height: 7, hp: 90000, atk: 0.13, bars: 185, speed: 4.6, turnRate: 3, enrage: 900,
  music: 'boss_gorrath', arena: 'throne_of_horns',
  // canonical action timings (the live model's metadata wins; this table serves headless runs and stand-ins)
  anims: {
    axe_cleave: { dur: 2.6, hits: [1.45] }, stomp: { dur: 2.0, hits: [1.05] }, axe_sweep: { dur: 2.4, hits: [1.25] },
    triple_sweep: { dur: 4.8, hits: [2.05, 2.8, 3.6] }, horn_charge: { dur: 3.4, hits: [1.15] }, leap_slam: { dur: 3.0, hits: [1.85] },
    axe_throw: { dur: 3.4, hits: [1.0, 2.7] }, roar: { dur: 2.8, hits: [1.0] }, rift_carve: { dur: 4.2, hits: [2.55] },
    channel: { dur: 6, hits: [5.5] }, ghost_form: { dur: 3.2, hits: [2.2] }, enrage: { dur: 3.2, hits: [1.35] }, turn: { dur: 1.2, hits: [0.6] },
  },
  moves: {
    cleave: { range: 5.5, cd: 5, weight: 3, recover: 0.8, async run(B, t) {
      B.turnTo(t); act(B, 'axe_cleave', 0.95);
      const u = B.u, dir = fwd(B), x = u.pos.x, z = u.pos.z;
      await strike(B, 'rect', { len: 11, width: 3.6, dur: 0.95, coef: 1.0, knock: 'down', fx: 'axe_shockwave', fxLen: 11, fxColor: ghostly(B) ? GHOST : null, sfx: 'impact_heavy', shake: 0.35, heavy: true });
      if (B.phase >= 1) for (const d of [3.2, 6.2, 9.2]) pool(B, { x: x + dir.x * d, z: z + dir.z * d, r: 1.6, dur: 6, tick: 0.5, coef: 0.18, kind: 'fire' });
      await wait(B, 0.5);
    } },
    sweep: { range: 5, cd: 6, weight: 3, recover: 0.8, async run(B, t) {
      B.turnTo(t); act(B, 'axe_sweep', 0.8);
      await strike(B, 'cone', { r: 7.5, deg: 190, dur: 0.8, coef: 0.7, knock: 'push', kb: 3.5, fx: 'slash_heavy', fxR: 7, fxColor: ghostly(B) ? GHOST : null, sfx: 'whoosh_big', shake: 0.25 });
      await wait(B, 0.4);
    } },
    // COUNTER: blue glow during the long wind-up of the first sweep (model counter window 0.35–1.85 of 4.8 s)
    reaping: { range: 6, cd: 21, weight: 3, recover: 1.0, async run(B, t) {
      B.turnTo(t); act(B, 'triple_sweep', 1.85);
      await wait(B, 0.3);
      counter(B, 1.35, 4.5);
      await strike(B, 'cone', { r: 8, deg: 180, dur: 1.55, coef: 0.7, knock: 'push', kb: 2.5, fx: 'slash_heavy', fxR: 7.5, sfx: 'whoosh_big' });
      if (B.target && !B.target.dead) B.turnTo(B.target);
      await strike(B, 'cone', { r: 8, deg: 180, dur: 0.67, coef: 0.7, knock: 'push', kb: 2.5, fx: 'slash_heavy', fxR: 7.5, sfx: 'whoosh_big' });
      await strike(B, 'circle', { r: 8.5, dur: 0.72, color: 'orange', coef: 1.0, knock: 'down', fx: 'shockwave', fxColor: 'crimson', sfx: 'slash_heavy', shake: 0.45, heavy: true });
      await wait(B, 0.6);
    } },
    horn_charge: { range: 40, cd: 17, weight: 2, recover: 1.2, async run(B, t) {
      const n = (B.phase >= 1 ? 2 : 1) + (B.mods.hard && B.phase >= 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        await hornCharge(B, i === 0 ? t : B.randomHero(), i === 0 ? 1.3 : 0.95);
        await wait(B, 0.25);
      }
      await wait(B, 0.5);
    } },
    stomp: { range: 7, cd: 15, weight: 2, recover: 1.2, async run(B) {
      act(B, 'stomp', 1.0);
      await strike(B, 'circle', { r: 4.5, dur: 1.0, color: 'orange', coef: 1.0, knock: 'down', fx: 'impact_heavy', sfx: 'stomp', shake: 0.5 });
      await strike(B, 'donut', { r: 9, inner: 4.5, dur: 0.75, color: 'orange', coef: 0.6, knock: 'push', kb: 2.5, fx: 'shockwave', fxR: 9 });
      await strike(B, 'donut', { r: 13.5, inner: 9, dur: 0.75, color: 'orange', coef: 0.5, knock: 'push', kb: 2.5, fx: 'shockwave', fxR: 13.5 });
      await wait(B, 0.5);
    } },
    leap_slam: { range: 50, cd: 21, weight: 2, recover: 1.2, async run(B, t) {
      const tgt = B.level.rng() < 0.5 ? farthest(B) || t : B.randomHero() || t;
      const p = onNav(B, tgt.pos, B.u.radius);
      act(B, 'leap_slam', 1.5);
      const tg = tele(B, 'circle', { x: p.x, z: p.z, r: 6, dur: 1.5, color: 'orange' });
      await wait(B, 0.45);
      await B.leap(p.x, p.z, 1.05 * (B.flags.haste || 1), 7);
      tg.alive = false;
      smash(B, 'circle', { r: 6, coef: 1.6, knock: 'up', fx: 'crater', fxColor: ghostly(B) ? GHOST : 'crimson', sfx: 'impact_heavy', shake: 0.6, heavy: true });
      await strike(B, 'donut', { r: 11, inner: 6, dur: 0.6, color: 'orange', coef: 0.4, knock: 'push', kb: 3, fx: 'shockwave', fxR: 11 });
      await wait(B, 0.5);
    } },
    // returning axe: the line is dangerous on the way out, at the far end, and on the way back
    axe_throw: { range: 40, cd: 15, weight: 2, recover: 1.0, async run(B, t) {
      B.turnTo(t);
      const u = B.u, dir = fwd(B), len = Math.max(10, reachAlong(B, dir, 24, u.pos, 0.5));
      const start = { x: u.pos.x + dir.x * 1.5, z: u.pos.z + dir.z * 1.5 }, end = { x: u.pos.x + dir.x * len, z: u.pos.z + dir.z * len };
      const m = u.model, k = (B.flags.haste || 1) * (1 / ((B.enraged ? 1.3 : 1) * (B.mods.hard ? 1.12 : 1)));
      // the model flies its own axe (release → catch); stand-ins get a spinning glaive
      const ownAxe = !!m?.entry?.actions?.axe_throw;
      if (ownAxe) m.play('axe_throw', { dur: 3.4 * 1.1 * k, dist: len }); else act(B, 'axe_throw', 1.1);
      await strike(B, 'rect', { len, width: 3.4, dur: 1.1, coef: 0.8, knock: 'push', kb: 2.5, sfx: 'whoosh_big' });
      if (!ownAxe) visual(B, start, end, { kind: 'glaive', speed: 38, color: 'orange', radius: 1.2 });
      await strike(B, 'circle', { x: end.x, z: end.z, r: 3.4, dur: 0.7, coef: 0.5, knock: 'push', kb: 3, fx: 'dust_burst', fxR: 3.4 });
      if (!ownAxe) visual(B, end, start, { kind: 'glaive', speed: 30, color: 'orange', radius: 1.2 });
      await strike(B, 'rect', { len, width: 3.4, dur: 1.17, coef: 0.8, knock: 'down', sfx: 'whoosh_big' });
      await wait(B, 0.4);
    } },
    // whirl on those behind him (the tail/axe haft swipe)
    back_swipe: { range: 12, cd: 6, weight: 5, when: B => behind(B, 7).length > 0, async run(B) {
      act(B, 'turn', 0.7);
      await strike(B, 'cone', { dir: back(B), r: 7, deg: 130, dur: 0.7, coef: 0.7, knock: 'down', kb: 4, fx: 'tail_sweep', fxR: 7, sfx: 'impact_heavy', shake: 0.2 });
      await wait(B, 0.4);
    } },
    roar: { range: 60, cd: 36, weight: 1.5, phase: [0, 1], when: B => B.fightT > 30, recover: 1.0, async run(B) {
      act(B, 'roar', 1.2);
      B.banner('Gorrath roars — dread grips the throne!', 'warn');
      const tg = tele(B, 'circle', { r: 13, dur: 1.2, color: 'purple', follow: B.u });
      await wait(B, 1.2); tg.alive = false;
      fearHit(B, 'circle', { r: 13, coef: 0.3, fear: 2.2, fx: 'roar_ring', fxR: 13, sfx: 'boss_roar', shake: 0.5 });
      await wait(B, 0.4);
      await hornCharge(B, B.randomHero(), 1.0);
      await wait(B, 0.5);
    } },
    horned_fury: { range: 99, cd: 55, weight: 40, when: B => !B.flags.hornsBroken && !B.flags.fury && B.phase < 3 && B.fightT > 40, async run(B) {
      act(B, 'enrage', 1.2);
      await wait(B, 1.2);
      B.banner('HORNED FURY — his horns blaze! Break a horn to quell it.', 'warn');
      B.flags.fury = true; setHaste(B); showHorn(B);
      const id = B.flags.furyId = (B.flags.furyId || 0) + 1;
      buff(B, 'horned_fury', 22, { dmgMul: 0.3 }, 'Horned Fury');
      B.u.model?.setGlow?.('enrage', 1); B.u.data.enraged = true;
      B.level.after(22, () => { if (B.flags.furyId === id) endFury(B); });
      smash(B, 'circle', { r: 8, coef: 0.3, knock: 'push', kb: 4, fx: 'enrage', fxR: 8, sfx: 'boss_roar', shake: 0.4 });
      await wait(B, 0.6);
    } },
    // ---- ghost phase
    spectral_rain: { range: 60, cd: 15, weight: 3, phase: 3, recover: 1.0, async run(B) {
      act(B, 'roar', 0.9);
      for (let v = 0; v < (B.mods.hard ? 3 : 2); v++) {
        const list = B.heroes().map(h => ['circle', { x: h.pos.x, z: h.pos.z, r: 2.4 }]);
        for (let i = 0; i < 3; i++) { const p = onNav(B, { x: B.u.pos.x + rnd(B, -14, 14), z: B.u.pos.z + rnd(B, -14, 14) }); list.push(['circle', { x: p.x, z: p.z, r: 2.4 }]); }
        const last = v === (B.mods.hard ? 2 : 1);
        await volley(B, list, v === 0 ? 1.15 : 0.85, { coef: B.mods.hard ? 0.8 : 1.0, knock: last ? 'down' : undefined, color: 'orange', fx: 'dark_burst', fxColor: GHOST, fxMax: 11, sfx: 'ghost_slam', shake: 0.3 });
      }
      await wait(B, 0.5);
    } },
    wheel_of_ruin: { range: 60, cd: 20, weight: 3, phase: 3, recover: 1.2, async run(B) {
      const outFirst = B.level.rng() < 0.5;
      act(B, 'rift_carve', 2.0);
      B.banner(outFirst ? 'Wheel of Ruin — OUT, then IN!' : 'Wheel of Ruin — IN, then OUT!', 'mechanic');
      const inner = ['circle', { r: 8.5, fxR: 8.5 }], outer = ['donut', { r: 34, inner: 8.5, fxR: 20 }];
      const [a, b] = outFirst ? [inner, outer] : [outer, inner];
      await strike(B, a[0], { ...a[1], dur: 2.0, color: 'orange', coef: B.mods.hard ? 3.4 : 4.0, knock: 'push', kb: 3, fx: 'shockwave', fxColor: GHOST, sfx: 'ghost_slam', shake: 0.5 });
      act(B, 'stomp', 1.25);
      await strike(B, b[0], { ...b[1], dur: 1.25, color: 'orange', coef: B.mods.hard ? 3.4 : 4.0, knock: 'down', fx: 'shockwave', fxColor: GHOST, sfx: 'ghost_slam', shake: 0.5 });
      await wait(B, 0.6);
    } },
    // COUNTER in the ghost phase
    spectral_lunge: { range: 14, cd: 16, weight: 2.5, phase: 3, async run(B, t) {
      B.turnTo(t); act(B, 'horn_charge', 1.1);
      counter(B, 0.95, 4);
      const dir = fwd(B), len = Math.max(6, reachAlong(B, dir, 12));
      const tg = tele(B, 'rect', { len: len + 2, width: cw(B), dur: 1.1, color: 'red' });
      await wait(B, 1.1); tg.alive = false;
      await B.charge(len, 0.3 * (B.flags.haste || 1), { coef: 1.1 * (B.mods.hard ? 1.25 : 1), knock: 'down', kb: 4 });
      smash(B, 'cone', { r: 6, deg: 120, coef: 1.0, knock: 'push', kb: 3, fx: 'slash_heavy', fxR: 6, fxColor: GHOST, sfx: 'ghost_slam' });
      await wait(B, 0.6);
    } },
  },
  mechanics: [
    { id: 'horns', at: 1.0, async run(B) { B.u.data.hpFloor = B.u.hpMax * 0.7; } },
    { id: 'rift_carve', at: 0.7, async run(B) {
      const u = B.u, c = center(B);
      B.flags.inMech = true;
      try {
        B.banner('RIFT CARVE — the throne splits into eight! Stand in the golden wedges.', 'mechanic');
        act(B, 'leap_slam', 1.1);
        await B.leap(c.x, c.z, 1.1 * (B.flags.haste || 1), 6);
        smash(B, 'circle', { r: 5, coef: 0.6, knock: 'push', kb: 5, fx: 'crater', fxColor: 'crimson', sfx: 'impact_heavy', shake: 0.5 });
        act(B, 'rift_carve', 3.2);
        const a0 = rnd(B, 0, Math.PI * 2);
        // danger wedges in purple (wipe colour, readable on the bloodstone), the safe ones marked yellow
        const wave = async (odd, dur, last) => {
          const list = [], safe = [];
          for (let i = 0; i < 8; i++) {
            const d = angDir(a0 + i * 45 * DEG);
            if ((i % 2 === 1) === odd) list.push(['cone', { r: 40, deg: 45, dir: d }]);
            else safe.push(tele(B, 'cone', { r: 40, deg: 45, dir: d, dur, color: 'yellow', safe: true }));
          }
          try { return await volley(B, list, dur, { color: 'purple', coef: 6, knock: last ? 'up' : 'push', kb: 1.5, fx: 'axe_shockwave', fxLen: 24, fxR: 4, fxColor: 'demon', sfx: 'explosion_big', shake: 0.6, heavy: true }); }
          finally { for (const t of safe) t.alive = false; }
        };
        await wait(B, 0.6);
        await wave(true, 2.6, false);
        await wave(false, 1.8, !B.mods.hard);
        if (B.mods.hard) { act(B, 'rift_carve', 1.4); await wave(true, 1.4, true); }
        B.phase = 1;
      } finally { B.flags.inMech = false; u.data.hpFloor = u.hpMax * 0.5; }
      await wait(B, 0.8);
    } },
    { id: 'wrath', at: 0.5, async run(B) {
      const u = B.u, c = center(B);
      B.flags.inMech = true;
      const dur = 9;
      let tg = null;
      try {
        act(B, 'leap_slam', 1.0);
        await B.leap(c.x, c.z, 1.0 * (B.flags.haste || 1), 5);
        B.banner('THE HORNED TYRANT GATHERS HIS WRATH — stagger him!', 'stagger');
        B.anim('channel', dur + 0.5);
        tg = B.tele('circle', { r: 40, dur, color: 'purple', follow: u, safe: true });
        await B.staggerCheck(Math.round(WRATH * (B.mods.hard ? 1.05 : 1)), dur, { groggy: 6, label: 'Wrath of the Tyrant', onFail: async () => {
          tg.alive = false;
          smash(B, 'all', { coef: 7.5, knock: 'down', fx: 'explosion_big', fxR: 14, fxColor: 'crimson', sfx: 'explosion_big', shake: 1.0, heavy: true });
          fx(B, 'roar_ring', u.pos.x, u.pos.z, { r: 20 });
          B.banner('The Tyrant’s wrath engulfs the throne!', 'fail');
          await wait(B, 1.3);
          smash(B, 'all', { coef: 6, fx: 'ground_quake', fxR: 16, sfx: 'explosion_big', shake: 0.7 });
          await wait(B, 1.2);
        } });
      } finally { if (tg) tg.alive = false; B.flags.inMech = false; u.data.hpFloor = u.hpMax * 0.4; }
    } },
    { id: 'soulfire', at: 0.4, async run(B) {
      const u = B.u, L = B.level, c = center(B);
      B.flags.inMech = true;
      let orbs = [], barrier = null;
      try {
        act(B, 'leap_slam', 1.0);
        await B.leap(c.x, c.z, 1.0 * (B.flags.haste || 1), 5);
        B.banner('Gorrath plants his axe — destroy the Soulfire Orbs before he devours them!', 'mechanic');
        B.anim('channel', 26);
        u.untargetable = true;
        barrier = B.tele('circle', { r: 4.5, dur: 40, color: 'purple', follow: u, safe: true });
        const n = B.mods.hard ? 6 : 4, R = 13, a0 = rnd(B, 0, Math.PI * 2);
        orbs = adds(B, 'wisp', n, { name: 'Soulfire Orb', hpMul: ORB_HP * (B.mods.hard ? 1.15 : 1), scale: 1.6,
          at: i => onNav(B, { x: c.x + Math.cos(a0 + i * 2 * Math.PI / n) * R, z: c.z + Math.sin(a0 + i * 2 * Math.PI / n) * R }, 1),
          brain: o => ({ update() { o.move.x = o.move.z = 0; } }) });
        for (const o of orbs) { o.data.immovable = true; o.baseSuperArmor = 2; fx(B, 'flame_pillar', o.pos.x, o.pos.z, { r: 1.5 }); }
        const T = B.mods.hard ? 22 : 25, t0 = L.time;
        while (L.time - t0 < T && orbs.some(o => !o.dead)) {
          await wait(B, 2.2);
          const live = orbs.filter(o => !o.dead);
          if (!live.length || L.time - t0 >= T) break;
          await volley(B, live.map(o => ['circle', { x: o.pos.x, z: o.pos.z, r: 3.6 }]), 1.0, { coef: 0.7, knock: 'push', kb: 3, color: 'orange', fx: 'fire_burst', fxR: 3.6, sfx: 'fire_burst' });
        }
        barrier.alive = false;
        const alive = orbs.filter(o => !o.dead);
        u.untargetable = false;
        if (!alive.length) {
          B.banner('The Soulfire is extinguished — Gorrath is exposed!', 'good');
          buff(B, 'exposed', 12, { dmgTaken: 0.2 }, 'Exposed');
          B.flags.inMech = false; u.data.hpFloor = u.hpMax * 0.3;
          B.interrupt(6);
          return;
        }
        for (const o of alive) visual(B, o.pos, u.pos, { kind: 'fire', speed: 16, color: 'fire', radius: 1 });
        clearAdds(B, x => alive.includes(x));
        act(B, 'roar', 1.0);
        await wait(B, 1.0);
        smash(B, 'all', { coef: Math.min(12, 5 * alive.length), knock: 'down', fx: 'explosion_big', fxR: 12, sfx: 'explosion_big', shake: 0.8, heavy: true });
        B.banner(`Gorrath devours ${alive.length} Soulfire Orb${alive.length > 1 ? 's' : ''}!`, 'fail');
        buff(B, 'soulfire', 1e6, { dmgMul: 0.1 * alive.length }, 'Devoured Soulfire');
        await wait(B, 1.0);
      } finally {
        if (barrier) barrier.alive = false;
        u.untargetable = false;
        clearAdds(B, x => orbs.includes(x));
        B.flags.inMech = false; u.data.hpFloor = u.hpMax * 0.3;
      }
    } },
    { id: 'ghost', at: 0.3, async run(B) {
      const u = B.u, L = B.level;
      B.flags.inMech = true;
      try {
        B.banner('Gorrath tears free of his flesh — the Tyrant’s Spectre rises!', 'mechanic');
        act(B, 'ghost_form', 1.6);
        await wait(B, 1.6);
        u.data.ghost = 1; u.model?.setGlow?.('ghost', 1);
        smash(B, 'circle', { r: 12, coef: 0.6, knock: 'push', kb: 6, fx: 'dark_burst', fxR: 8, fxColor: GHOST, sfx: 'ghost_wail', shake: 0.6 });
        endFury(B);
        B.phase = 3; u.st.speed *= 1.2; u._statDirty = true;
        B.flags.hasteBase = 0.85; setHaste(B);
        let n = 0;
        const every = B.mods.hard ? 18 : 20, c = center(B);
        fx(B, 'ghost_mist', c.x, c.z, { r: 24, dur: every + 1 });
        const tm = L.every(every, () => {
          if (u.dead) { L.cancelTimer(tm); return; }
          n++;
          fx(B, 'ghost_mist', c.x, c.z, { r: 24, dur: every + 1 });
          smash(B, 'all', { id: 'spectral_dread', coef: 0.25 + 0.12 * n, fx: 'fear_howl', fxR: 14, fxColor: GHOST, sfx: 'ghost_wail', shake: 0.3 });
          if (n === 1 || n % 3 === 0) B.banner(`Spectral Dread deepens (${n})…`, 'warn');
        });
      } finally { B.flags.inMech = false; u.data.hpFloor = 0; }
      await wait(B, 1.0);
    } },
  ],
  onStart(enc) { if (enc.o.hard) for (const b of enc.bosses) scaleHp(b, 1.12); },
};
