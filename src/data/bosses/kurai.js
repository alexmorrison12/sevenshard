// GUARDIAN — Kurai the Pyrefox. A nine-tailed fox of blue fox-fire: claws, a flaming tail whip for back attackers,
// fox-fire breath, a COUNTERABLE pounce, a blazing dash that leaves fire, and Foxfire Wisps that hunt raiders in hops.
//  • MIRAGE (85%): she vanishes and three foxes crouch around the arena, all glowing blue — only the real Kurai's
//    counter matters (countering her stuns her and bursts the illusions; a countered illusion just pops). If she is
//    not countered, every fox still standing pounces.
//  • 60% nine tails ignite (faster, more wisps).
//  • FOXFIRE INFERNO (40%): she and her illusions channel together; only the real fox has a stagger bar that counts.
//    Illusions are fragile — cut them down and focus the real one before the inferno breaks.
import { makeBoss } from '../../game/ai/boss.js';
import { fwd, back, rnd, tele, wait, strike, smash, volley, act, counter, marker, pool, onNav, behind, farthest,
  reachAlong, center, someHeroes, visual, scaleHp, clearAdds, fx, sfx, shuffle, standardStart, partyK } from './kit.js';

const FOX = 'foxfire';
const cw = B => 2 * (B.u.radius + 0.6);

// ---------------------------------------------------------------- illusions
function spawnClone(B, x, z, hpFrac) {
  const d = B.def;
  const def = { id: 'kurai_mirage', model: 'kurai', name: 'Kurai', title: 'Mirage', kind: 'guardian', radius: d.radius, height: d.height,
    hp: d.hp * hpFrac, atk: d.atk, bars: 1, speed: 0, moves: {}, modelOpts: { clone: true } };
  const c = makeBoss(def, { ref: B.o.ref, partySize: B.o.partySize, x, z, facing: B.u.facing, mods: B.mods });
  c.data.clone = true; c.data.corpseTime = 0.35; c.data.owner = B.u;
  B.level.add(c);
  fx(B, 'fire_burst', x, z, { r: 2.5, color: FOX });
  return c;
}
function popClone(B, c) {
  if (!c || c.dead) return;
  fx(B, 'dark_burst', c.pos.x, c.pos.z, { r: 2.5, color: FOX }); sfx(B, 'fire_burst', c.pos);
  c.hp = 0; c.dead = true; c.data.counterWindow = 0; B.level.remove(c);   // silent removal (no boss death fanfare)
}
const liveClones = B => B.level.units.filter(u => u.data.clone && u.data.owner === B.u && !u.dead);
function clearClones(B) { for (const c of liveClones(B)) popClone(B, c); }

/** real Kurai + n illusions on a ring around the arena centre, shuffled; returns the units (real one included) */
async function scatter(B, n, r, cloneHp) {
  const u = B.u, c = center(B);
  u.untargetable = true;
  fx(B, 'dark_burst', u.pos.x, u.pos.z, { r: 3, color: FOX }); sfx(B, 'void_whoosh');
  act(B, 'clone', 0.5);
  await wait(B, 0.6);
  const a0 = rnd(B, 0, Math.PI * 2), spots = [];
  for (let i = 0; i <= n; i++) spots.push(onNav(B, { x: c.x + Math.cos(a0 + i * 2 * Math.PI / (n + 1)) * r, z: c.z + Math.sin(a0 + i * 2 * Math.PI / (n + 1)) * r }, u.radius));
  const order = shuffle(B, spots);
  u.pos.x = order[0].x; u.pos.z = order[0].z; u.untargetable = false;
  B.lookAt(c.x, c.z);
  const foxes = [u];
  for (let i = 1; i <= n; i++) { const cl = spawnClone(B, order[i].x, order[i].z, cloneHp); cl.facing = Math.atan2(-(c.x - cl.pos.x), -(c.z - cl.pos.z)); foxes.push(cl); }
  fx(B, 'fire_burst', u.pos.x, u.pos.z, { r: 2.5, color: FOX });
  return foxes;
}

// ---------------------------------------------------------------- moves
async function wispHunt(B, n, hops = 3) {
  // fox-fire wisps: each picks a raider and dives at where they stand, hop after hop
  const u = B.u;
  let from = someHeroes(B, n).map(h => ({ h, x: u.pos.x, z: u.pos.z }));
  if (!from.length) return;
  fx(B, 'foxfire_orbs', u.pos.x, u.pos.z, { r: 3, dur: 0.9, color: FOX });
  for (let k = 0; k < hops; k++) {
    const list = [];
    for (const w of from) {
      const tgt = w.h.dead ? B.randomHero() : w.h; if (!tgt) continue;
      w.h = tgt;
      visual(B, { x: w.x, z: w.z }, tgt.pos, { kind: 'foxfire', color: FOX, speed: 24, radius: 0.5, arc: 2 });
      w.x = tgt.pos.x; w.z = tgt.pos.z;
      list.push(['circle', { x: w.x, z: w.z, r: 2.3 }]);
    }
    await volley(B, list, k ? 0.8 : 1.0, { coef: 0.6, color: 'orange', fx: 'fire_burst', fxR: 2.3, fxColor: FOX, sfx: 'fire_burst' });
  }
}

export default {
  id: 'kurai', model: 'kurai', name: 'Kurai', title: 'the Pyrefox', kind: 'guardian',
  radius: 2.4, height: 5.2, hp: 50000, atk: 0.14, bars: 210, speed: 6.4, turnRate: 4.5, enrage: 600,
  music: 'boss', arena: 'frostmere',
  anims: {
    claw: { dur: 1.2, hits: [0.55] }, tail_whip: { dur: 1.9, hits: [0.9] }, fire_orbs: { dur: 2.3, hits: [0.95, 1.3, 1.65] },
    pounce: { dur: 1.8, hits: [1.12] }, clone: { dur: 1.9, hits: [0.95] }, foxfire_breath: { dur: 3.3, hits: [1.05, 1.45, 1.85, 2.25, 2.65] },
    dash: { dur: 1.0, hits: [0.42] }, howl: { dur: 2.7, hits: [1.2] },
  },
  moves: {
    claw: { range: 4, cd: 3.5, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'claw', 0.6);
      await strike(B, 'cone', { r: 5, deg: 110, dur: 0.6, coef: 0.8, fx: 'claw_swipe', fxR: 4.5, fxColor: FOX, sfx: 'slash_heavy' });
      await wait(B, 0.4);
    } },
    tail_whip: { range: 9, cd: 6, weight: 4, when: B => behind(B, 7).length > 0, async run(B) {
      act(B, 'tail_whip', 0.9);
      await strike(B, 'cone', { dir: back(B), r: 7.5, deg: 220, dur: 0.9, coef: 0.9, knock: 'down', color: 'orange', fx: 'tail_flame_whip', fxR: 7, fxColor: FOX, sfx: 'whoosh_big', shake: 0.25 });
      await wait(B, 0.5);
    } },
    breath: { range: 12, cd: 12, weight: 2, async run(B, t) {
      B.turnTo(t); act(B, 'foxfire_breath', 1.05);
      const cone = { r: 11, deg: 50 };
      await strike(B, 'cone', { ...cone, dur: 1.05, color: 'orange', coef: 0.45, fx: 'fire_breath', fxLen: 11, fxColor: FOX, sfx: 'fire_whoosh' });
      const mk = marker(B, 'cone', { ...cone, x: B.u.pos.x, z: B.u.pos.z, dir: fwd(B) });
      try { for (let i = 0; i < 4; i++) { await wait(B, 0.4); B.hit('cone', { ...cone, coef: 0.3 }); } }
      finally { mk.alive = false; }
      await wait(B, 0.5);
    } },
    // COUNTER: she crouches low, tails flared
    pounce: { range: 18, cd: 12, weight: 3, async run(B, t) {
      const tgt = B.level.rng() < 0.4 ? farthest(B) || t : t;
      B.turnTo(tgt); act(B, 'pounce', 1.4);
      counter(B, 1.1, 4.5);
      const p = onNav(B, tgt.pos, B.u.radius);
      const tg = tele(B, 'circle', { x: p.x, z: p.z, r: 4.5, dur: 1.4, color: 'red' });
      await wait(B, 0.8);
      await B.leap(p.x, p.z, 0.6 * (B.flags.haste || 1), 3);
      tg.alive = false;
      smash(B, 'circle', { r: 4.5, coef: 1.2, knock: 'down', fx: 'fire_burst', fxR: 4.5, fxColor: FOX, sfx: 'impact_heavy', shake: 0.4 });
      await wait(B, 0.6);
    } },
    dash: { range: 25, cd: 9, weight: 2, async run(B, t) {
      B.turnTo(t);
      const u = B.u, dir = fwd(B), len = Math.max(6, reachAlong(B, dir, 16)), x0 = u.pos.x, z0 = u.pos.z;
      act(B, 'dash', 0.85);
      const tg = tele(B, 'rect', { len: len + 1, width: cw(B), dur: 0.85, color: 'orange' });
      await wait(B, 0.85); tg.alive = false;
      await B.charge(len, 0.35 * (B.flags.haste || 1), { coef: 1.0 * (B.mods.hard ? 1.25 : 1), knock: 'down', kb: 3 });
      for (let d = 3; d < len; d += 4) pool(B, { x: x0 + dir.x * d, z: z0 + dir.z * d, r: 1.6, dur: 4, tick: 0.5, coef: 0.12, kind: 'fire' });
      await wait(B, 0.4);
    } },
    wisps: { range: 30, cd: 14, weight: 2.5, recover: 1.0, async run(B) {
      act(B, 'fire_orbs', 0.95);
      await wispHunt(B, B.phase >= 1 ? 4 : 3);
      await wait(B, 0.4);
    } },
  },
  mechanics: [
    { id: 'mirage', at: 0.85, async run(B) {
      const u = B.u;
      B.flags.inMech = true;
      B.banner('MIRAGE — three foxes crouch… counter the REAL Kurai!', 'mechanic');
      try {
        const foxes = await scatter(B, 2, 9, 0.003);
        act(B, 'pounce', 1.6);
        counter(B, 1.3, 5);
        for (const c of foxes.slice(1)) { c.model?.play?.('pounce', { dur: 1.9 }); c.ctrl.counterWindow(1.3 * (B.mods.hard ? 1 / 1.12 : 1), 0); c.data.onCounter = () => popClone(B, c); }
        const marks = foxes.map(f => { const h = B.randomHero(); return h ? { f, p: onNav(B, h.pos, 1) } : null; }).filter(Boolean);
        const tgs = marks.map(m => tele(B, 'circle', { x: m.p.x, z: m.p.z, r: 4.2, dur: 1.6, color: 'red' }));
        await wait(B, 1.6);
        tgs.forEach(t => t.alive = false);
        // not countered: every fox still standing pounces
        for (const m of marks) {
          if (m.f !== u && m.f.dead) continue;
          visual(B, m.f.pos, m.p, { kind: 'foxfire', color: FOX, speed: 30, radius: 1 });
          smash(B, 'circle', { x: m.p.x, z: m.p.z, r: 4.2, coef: 1.3, knock: 'down', fx: 'fire_burst', fxR: 4.2, fxColor: FOX, sfx: 'impact_heavy', shake: 0.3 });
        }
        const p = marks.find(m => m.f === u)?.p; if (p) { u.pos.x = p.x; u.pos.z = p.z; }
        B.banner('The mirage bursts into fox-fire!', 'warn');
        await wait(B, 0.8);
      } finally { clearClones(B); B.flags.inMech = false; }
    } },
    { id: 'nine_tails', at: 0.6, async run(B) {
      B.phase = 1; B.flags.haste = 0.9; B.u.st.speed *= 1.1;
      act(B, 'howl', 1.2);
      B.banner('Kurai’s nine tails ignite!', 'warn');
      await wait(B, 1.2);
      smash(B, 'circle', { r: 9, coef: 0.4, knock: 'push', kb: 5, fx: 'roar_ring', fxR: 9, fxColor: FOX, sfx: 'boss_roar', shake: 0.4 });
      B.u.model?.setGlow?.('enrage', 0.7);
      await wait(B, 0.6);
    } },
    { id: 'inferno', at: 0.4, async run(B) {
      const u = B.u, dur = 9.5;
      B.flags.inMech = true;
      B.banner('FOXFIRE INFERNO — find the real Kurai and stagger her! Cut down the illusions.', 'stagger');
      let tg = null;
      try {
        const foxes = await scatter(B, B.mods.hard ? 3 : 2, 8, 0.002);
        act(B, 'howl', 1.2); B.anim('howl', dur);
        // illusions carry a bar too (it never breaks): stagger spent on them is wasted
        for (const c of foxes.slice(1)) { c.model?.play?.('howl', { dur }); c.data.stagger = { v: 1e9, max: 1e9, broken: false, label: 'Foxfire Inferno', left: dur, fake: true }; }
        tg = B.tele('circle', { r: 40, dur, color: 'purple', follow: u, safe: true });
        await B.staggerCheck(Math.round(360 * partyK(B) * (B.mods.hard ? 1.08 : 1)), dur, { groggy: 5, label: 'Foxfire Inferno', onFail: async () => {
          tg.alive = false;
          const n = 1 + liveClones(B).length;
          smash(B, 'all', { coef: 2.2 + 0.6 * n, knock: 'down', fx: 'fire_nova', fxR: 14, fxColor: FOX, sfx: 'explosion_big', shake: 0.9 });
          B.banner(n > 1 ? `The inferno erupts from ${n} foxes!` : 'The foxfire inferno erupts!', 'fail');
          for (let i = 0; i < 5; i++) { const p = onNav(B, { x: u.pos.x + rnd(B, -12, 12), z: u.pos.z + rnd(B, -12, 12) }); pool(B, { x: p.x, z: p.z, r: 2.6, dur: 8, tick: 0.5, coef: 0.15, kind: 'fire' }); }
          await wait(B, 1.4);
        } });
      } finally { if (tg) tg.alive = false; clearClones(B); B.flags.inMech = false; }
    } },
    { id: 'pyre', at: 0.15, async run(B) {
      B.phase = 2; B.flags.haste = 0.82;
      B.banner('Kurai burns with the last of her fox-fire!', 'warn');
      B.u.model?.setGlow?.('enrage', 1);
      act(B, 'howl', 1.2); await wait(B, 1.2);
      await wispHunt(B, 4, 3);
    } },
  ],
  onStart: standardStart,
  onBossDeath(enc, unit) { for (const u of enc.game.level.units.slice()) if (u.data.clone && u.data.owner === unit && !u.dead) { u.hp = 0; u.dead = true; enc.game.level.remove(u); } },
};
