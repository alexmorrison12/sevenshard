// GUARDIAN — Sandmaw, the Dune Devourer. A colossal sand wurm that fights half-buried: a lunging bite, a wide tail
// sweep behind and beside it, fans of sand-spit lines, burrow & emerge under a raider (the circle tracks its prey, then
// locks), quicksand, and a Sandstorm that drags everyone toward its maw before it snaps shut.
//  75% the dunes shift (burrow chain) · 50% SANDMAW COILS TO DEVOUR (stagger) · 25% frenzy
import { DEG, rot, fwd, back, rnd, tele, wait, strike, smash, volley, act, counter, pool, onNav, behind, farthest, dirTo,
  someHeroes, visual, scaleHp, fx, sfx, standardStart, partyK } from './kit.js';

async function emergeUnder(B, prey, track = 1.1, lock = 0.95) {
  const u = B.u, L = B.level;
  if (!prey) return;
  // a ring follows the prey, then locks in place (orange)
  const trk = B.tele('circle', { r: 2.2, dur: track, color: 'yellow', follow: prey, safe: true });
  const t0 = L.time;
  while (L.time - t0 < track && !prey.dead) await B.wait(0.05);
  trk.alive = false;
  const p = onNav(B, prey.pos, u.radius);
  fx(B, 'burrow_plume', p.x, p.z, { r: 2 });
  await strike(B, 'circle', { x: p.x, z: p.z, r: 5, dur: lock, color: 'orange', coef: 1.3, knock: 'up', fx: 'burrow_plume', fxR: 5, sfx: 'explosion', shake: 0.5 });
  u.pos.x = p.x; u.pos.z = p.z;
  pool(B, { x: p.x, z: p.z, r: 3, dur: 6, tick: 0.5, coef: 0.08, kind: 'swirl', status: [{ id: 'slow', dur: 1 }] });
}

export default {
  id: 'sandmaw', model: 'sandmaw', name: 'Sandmaw', title: 'the Dune Devourer', kind: 'guardian',
  radius: 3.2, height: 9.8, hp: 48000, atk: 0.155, bars: 200, speed: 3.2, turnRate: 2.6, enrage: 600,
  music: 'boss', arena: 'sunscar',
  anims: {
    burrow: { dur: 2.6, hits: [1.3] }, emerge: { dur: 2.4, hits: [0.5] }, bite: { dur: 1.9, hits: [1.02] },
    tail_sweep: { dur: 2.6, hits: [1.35] }, sand_spit: { dur: 2.3, hits: [0.95, 1.3, 1.65] }, sandstorm: { dur: 4.2, hits: [1.4, 2, 2.6, 3.2] },
  },
  moves: {
    bite: { range: 5, cd: 4, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'bite', 0.85);
      await strike(B, 'cone', { r: 7.5, deg: 70, dur: 0.85, coef: 1.0, knock: 'down', fx: 'bite', fxR: 4, sfx: 'claw', shake: 0.3 });
      await wait(B, 0.5);
    } },
    // COUNTER: it rears back before a deep lunge
    lunge: { range: 10, cd: 13, weight: 2.5, async run(B, t) {
      B.turnTo(t); act(B, 'bite', 1.25);
      counter(B, 1.0, 4.5);
      await strike(B, 'rect', { len: 11, width: 4.5, dur: 1.25, coef: 1.3, knock: 'down', fx: 'burrow_plume', fxR: 3, sfx: 'impact_heavy', shake: 0.4 });
      await wait(B, 0.6);
    } },
    tail_sweep: { range: 11, cd: 7, weight: 4, when: B => behind(B, 10, 0.2).length > 0, async run(B) {
      act(B, 'tail_sweep', 1.05);
      await strike(B, 'cone', { dir: back(B), r: 10, deg: 250, dur: 1.05, coef: 0.9, knock: 'push', kb: 4, color: 'orange', fx: 'tail_sweep', fxR: 9, fxColor: 'sand', sfx: 'whoosh_big', shake: 0.3 });
      await wait(B, 0.5);
    } },
    sand_spit: { range: 26, cd: 10, weight: 2.5, async run(B, t) {
      B.turnTo(t); act(B, 'sand_spit', 0.95);
      const f = fwd(B), n = B.phase >= 1 ? 5 : 3, spread = B.phase >= 1 ? 18 : 22;
      const dirs = Array.from({ length: n }, (_, i) => rot(f, (i - (n - 1) / 2) * spread * DEG));
      // lines detonate one after another, sweeping across the fan
      const tgs = dirs.map((d, i) => tele(B, 'rect', { dir: d, len: 20, width: 2.6, dur: 0.95 + i * 0.3, color: 'orange' }));
      for (let i = 0; i < n; i++) {
        await wait(B, i ? 0.3 : 0.95); tgs[i].alive = false;
        const u = B.u, d = dirs[i];
        visual(B, { x: u.pos.x + d.x * 2, z: u.pos.z + d.z * 2 }, { x: u.pos.x + d.x * 20, z: u.pos.z + d.z * 20 }, { kind: 'wave', color: 'sand', speed: 40, radius: 1.3 });
        smash(B, 'rect', { dir: d, len: 20, width: 2.6, coef: 0.8, status: [{ id: 'slow', dur: 2 }], sfx: 'whoosh' });
      }
      await wait(B, 0.5);
    } },
    burrow: { range: 99, cd: 22, weight: 2.5, recover: 1.0, async run(B) {
      const u = B.u, n = B.phase >= 1 ? (B.phase >= 2 ? 3 : 2) : 1;
      act(B, 'burrow', 1.3);
      await wait(B, 1.3);
      u.untargetable = true; u.data.burrowed = 1;
      try { for (let i = 0; i < n; i++) { await emergeUnder(B, B.randomHero()); if (i < n - 1) await wait(B, 0.35); } }
      finally { u.untargetable = false; u.data.burrowed = 0; }
      act(B, 'emerge', 0.5);
      await wait(B, 0.9);
    } },
    sandstorm: { range: 99, cd: 32, weight: 2, minPhase: 1, recover: 1.0, async run(B) {
      const u = B.u;
      act(B, 'sandstorm', 1.4);
      B.banner('SANDSTORM — Sandmaw drags everything toward its maw! Fight the pull!', 'warn');
      fx(B, 'sandstorm', u.pos.x, u.pos.z, { dur: 5 });
      for (let i = 0; i < 4; i++) {
        await wait(B, 0.6);
        smash(B, 'all', { coef: 0.08, knock: 'pull', kb: 2.2 });
      }
      await strike(B, 'circle', { r: 8, dur: 1.2, color: 'orange', coef: 1.8, knock: 'up', fx: 'burrow_plume', fxR: 7, sfx: 'explosion_big', shake: 0.6 });
      await wait(B, 0.6);
    } },
    quicksand: { range: 30, cd: 16, weight: 1.5, async run(B) {
      act(B, 'sand_spit', 0.9);
      const pts = someHeroes(B, 3).map(h => ({ x: h.pos.x, z: h.pos.z }));
      await volley(B, pts.map(p => ['circle', { x: p.x, z: p.z, r: 3.2 }]), 1.2, { coef: 0.7, color: 'orange', status: [{ id: 'slow', dur: 2 }], fx: 'dust_burst', fxR: 3, sfx: 'whoosh' });
      for (const p of pts) pool(B, { x: p.x, z: p.z, r: 3.2, dur: 8, tick: 0.5, coef: 0.08, kind: 'swirl', status: [{ id: 'slow', dur: 1 }] });
      await wait(B, 0.5);
    } },
  },
  mechanics: [
    { id: 'dunes', at: 0.75, async run(B) {
      const u = B.u;
      B.phase = 1;
      B.banner('The dunes shift — Sandmaw hunts beneath the sand!', 'mechanic');
      act(B, 'burrow', 1.3); await wait(B, 1.3);
      u.untargetable = true; u.data.burrowed = 1;
      try { for (let i = 0; i < 4; i++) { await emergeUnder(B, B.randomHero(), 0.9, 0.9); await wait(B, 0.3); } }
      finally { u.untargetable = false; u.data.burrowed = 0; }
      act(B, 'emerge', 0.5); await wait(B, 1.0);
    } },
    { id: 'devour', at: 0.5, async run(B) {
      const u = B.u, dur = 7.5;
      B.flags.inMech = true;
      act(B, 'sandstorm', 1.4);
      B.banner('SANDMAW COILS TO DEVOUR — stagger it before it swallows the arena!', 'stagger');
      const tg = B.tele('circle', { r: 11, dur, color: 'purple', follow: u, safe: true });
      const pull = B.level.every(1.2, () => { if (!u.dead && u.data.stagger) smash(B, 'all', { coef: 0.05, knock: 'pull', kb: 1.4 }); });
      try {
        await B.staggerCheck(Math.round(460 * partyK(B) * (B.mods.hard ? 1.08 : 1)), dur, { groggy: 5, label: 'Devour', onFail: async () => {
          tg.alive = false;
          smash(B, 'circle', { r: 11, coef: 3.6, knock: 'up', fx: 'burrow_plume', fxR: 10, sfx: 'explosion_big', shake: 0.9 });
          smash(B, 'donut', { r: 40, inner: 11, coef: 1.2, knock: 'push', kb: 4 });
          B.banner('Sandmaw devours everything within reach!', 'fail');
          await wait(B, 1.5);
        } });
      } finally { tg.alive = false; B.level.cancelTimer(pull); B.flags.inMech = false; }
    } },
    { id: 'frenzy', at: 0.25, async run(B) {
      B.phase = 2; B.flags.haste = 0.88;
      B.banner('Sandmaw thrashes in a frenzy!', 'warn');
      act(B, 'sandstorm', 1.4); await wait(B, 1.4);
    } },
  ],
  onStart: standardStart,
};
