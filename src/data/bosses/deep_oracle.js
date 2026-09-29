// ABYSSAL DUNGEON gate 2 — the Deep Oracle (4 players). A vast eye in the black water, ringed by tentacles. It never
// moves: tentacles slam lines toward raiders from all around, sweep the front, a COUNTERABLE grasp, ink pools, and a
// gaze beam that sweeps across the arena. Twice it sinks and sends the drowned (adds) while tentacles lash from the
// dark; leave any alive and it feeds on them. At 20% it opens its eye fully — stagger it or face the Gaze of the Deep.
//  66% / 33% SUBMERGE (adds) · 20% THE ORACLE OPENS ITS EYE (stagger)
import { DEG, rot, fwd, back, norm, rnd, tele, wait, strike, smash, volley, act, counter, pool, onNav, someHeroes,
  center, adds, clearAdds, scaleHp, fearHit, fx, sfx, partyK } from './kit.js';

const INK = 'void';

/** tentacles erupt beside raiders and slam toward them (lines) */
async function tentacles(B, prey, dur, coef = 1.0) {
  const lines = [];
  for (const h of prey) {
    const a = rnd(B, 0, Math.PI * 2), o = onNav(B, { x: h.pos.x + Math.cos(a) * 9, z: h.pos.z + Math.sin(a) * 9 }, 0.5);
    const d = norm(h.pos.x - o.x, h.pos.z - o.z);
    lines.push(['rect', { x: o.x, z: o.z, dir: d, len: 14, width: 3, fx: 'tentacle_slam', fxR: 3, off: 0 }]);
  }
  if (!lines.length) return;
  await volley(B, lines, dur, { coef, knock: 'down', color: 'orange', sfx: 'wave_splash', shake: 0.3 });
}

export default {
  id: 'deep_oracle', model: 'deep_oracle', name: 'The Deep Oracle', title: 'Eye Beneath the Oratory', kind: 'abyss',
  radius: 3.5, height: 8, hp: 54000, atk: 0.16, bars: 190, speed: 0.001, turnRate: 2.4, enrage: 660,
  music: 'boss', arena: 'frostmere',
  anims: {
    tentacle_slam: { dur: 1.8, hits: [1.0] }, tentacle_sweep: { dur: 2.2, hits: [1.1] }, gaze: { dur: 3.6, hits: [1.4] },
    grasp: { dur: 2.0, hits: [1.2] }, submerge: { dur: 2.4, hits: [1.4] }, emerge: { dur: 2.2, hits: [0.6] }, roar: { dur: 2.4, hits: [1.0] },
  },
  moves: {
    slam: { range: 60, cd: 5, weight: 3, async run(B, t) {
      act(B, 'tentacle_slam', 1.1);
      await tentacles(B, [t, ...someHeroes(B, B.phase >= 1 ? 2 : 1).filter(h => h !== t)], 1.1);
      await wait(B, 0.5);
    } },
    sweep: { range: 12, cd: 8, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'tentacle_sweep', 1.0);
      await strike(B, 'cone', { r: 12, deg: 200, dur: 1.0, coef: 0.9, knock: 'push', kb: 4, fx: 'tail_sweep', fxR: 11, fxColor: INK, sfx: 'whoosh_big', shake: 0.3 });
      await wait(B, 0.5);
    } },
    // the gaze: the whole arc is marked, then the beam sweeps across it
    gaze: { range: 40, cd: 16, weight: 2, recover: 1.0, async run(B, t) {
      B.turnTo(t); act(B, 'gaze', 1.4);
      const f = fwd(B), sd = B.level.rng() < 0.5 ? 1 : -1, arc = 130;
      const warn = tele(B, 'cone', { r: 28, deg: arc, dur: 1.4, color: 'orange' });
      await wait(B, 1.4); warn.alive = false;
      for (let i = 0; i <= 6; i++) {
        const d = rot(f, sd * (-arc / 2 + arc * i / 6) * DEG);
        smash(B, 'rect', { dir: d, len: 28, width: 4.5, coef: 0.55, fx: i % 2 ? null : 'eye_beam', fxLen: 28, fxColor: INK, sfx: i ? null : 'beam' });
        await wait(B, 0.22);
      }
      await wait(B, 0.5);
    } },
    // COUNTER: the eye flares blue before a tentacle closes on its prey
    grasp: { range: 30, cd: 14, weight: 2.5, async run(B, t) {
      B.turnTo(t); act(B, 'grasp', 1.3);
      counter(B, 1.1, 4.5);
      await strike(B, 'circle', { x: t.pos.x, z: t.pos.z, r: 3.5, dur: 1.3, color: 'red', coef: 1.3, status: [{ id: 'stun', dur: 1.5 }], fx: 'tentacle_slam', fxR: 3.5, sfx: 'wave_splash' });
      await wait(B, 0.5);
    } },
    ink: { range: 40, cd: 13, weight: 2, async run(B) {
      act(B, 'roar', 0.9);
      const pts = someHeroes(B, 3).map(h => ({ x: h.pos.x, z: h.pos.z }));
      await volley(B, pts.map(p => ['circle', { x: p.x, z: p.z, r: 3 }]), 1.2, { coef: 0.7, color: 'orange', status: [{ id: 'weaken', dur: 5 }], fx: 'dark_burst', fxR: 3, fxColor: INK, sfx: 'wave_splash' });
      for (const p of pts) pool(B, { x: p.x, z: p.z, r: 3, dur: 7, tick: 0.5, coef: 0.08, kind: 'void', status: [{ id: 'slow', dur: 1 }] });
      await wait(B, 0.4);
    } },
  },
  mechanics: [
    { id: 'sink1', at: 0.66, async run(B) { await submerge(B, 1); } },
    { id: 'sink2', at: 0.33, async run(B) { await submerge(B, 2); } },
    { id: 'eye', at: 0.2, async run(B) {
      const u = B.u, dur = 7.5;
      B.flags.inMech = true;
      act(B, 'gaze', 1.0);
      B.banner('THE ORACLE OPENS ITS EYE — stagger it before its gaze falls on you!', 'stagger');
      const tg = B.tele('circle', { r: 40, dur, color: 'purple', follow: u, safe: true });
      try {
        await B.staggerCheck(Math.round(470 * partyK(B) * (B.mods.hard ? 1.08 : 1)), dur, { groggy: 6, label: 'Gaze of the Deep', onFail: async () => {
          tg.alive = false;
          fearHit(B, 'all', { coef: 3.2, knock: 'down', fear: 2, fx: 'fear_howl', fxR: 18, fxColor: INK, sfx: 'boss_roar', shake: 0.9 });
          B.banner('The Gaze of the Deep falls upon you.', 'fail');
          await wait(B, 1.5);
        } });
      } finally { tg.alive = false; B.flags.inMech = false; B.phase = 2; B.flags.haste = 0.88; }
    } },
  ],
  onStart(enc) { if (enc.o.hard) for (const b of enc.bosses) scaleHp(b, 1.2); },
};

async function submerge(B, n) {
  const u = B.u, L = B.level, c = center(B);
  B.flags.inMech = true;
  let spawned = [];
  try {
    act(B, 'submerge', 1.4);
    B.banner(n === 1 ? 'The Oracle sinks into the black water — destroy the drowned before it rises!' : 'The Oracle sinks again — the drowned rise in numbers!', 'mechanic');
    await wait(B, 1.4);
    u.untargetable = true; u.data.burrowed = 1;
    const ring = (i, k, r) => onNav(B, { x: c.x + Math.cos(i / k * Math.PI * 2 + 0.4) * r, z: c.z + Math.sin(i / k * Math.PI * 2 + 0.4) * r }, 0.6);
    const acolytes = adds(B, 'abyss_caster', n === 1 ? 2 : 3, { name: 'Drowned Acolyte', hpMul: 3.5, at: (i, k) => ring(i, k, 11) });
    const dead = adds(B, 'skeleton', n === 1 ? 4 : 5, { name: 'Drowned Dead', hpMul: 3.5, at: (i, k) => ring(i + 0.5, k, 7) });
    spawned = [...acolytes, ...dead];
    for (const a of spawned) fx(B, 'tentacle_slam', a.pos.x, a.pos.z, { r: 1.5 });
    const T = 26, t0 = L.time;
    while (L.time - t0 < T && spawned.some(a => !a.dead)) {
      await tentacles(B, someHeroes(B, 2), 1.2, 0.8);
      await wait(B, 2.3);
    }
    const alive = spawned.filter(a => !a.dead);
    u.untargetable = false; u.data.burrowed = 0;
    act(B, 'emerge', 0.6);
    if (alive.length) {
      clearAdds(B, x => alive.includes(x));
      u.hp = Math.min(u.hpMax, u.hp + u.hpMax * 0.02 * alive.length);
      smash(B, 'all', { coef: 0.7 * Math.min(4, alive.length), knock: 'down', fx: 'fear_howl', fxR: 16, fxColor: INK, sfx: 'boss_roar', shake: 0.6 });
      B.banner(`The Oracle feeds on ${alive.length} of the drowned!`, 'fail');
    } else B.banner('The drowned are laid to rest — the Oracle rises weakened!', 'good');
    await strike(B, 'circle', { r: 7, dur: 0.9, color: 'orange', coef: 1.0, knock: 'up', fx: 'tentacle_slam', fxR: 6, sfx: 'wave_splash', shake: 0.5 });
    if (!alive.length) B.interrupt(4);
    B.phase = Math.max(B.phase, 1);
  } finally { u.untargetable = false; u.data.burrowed = 0; clearAdds(B, x => spawned.includes(x)); B.flags.inMech = false; }
}
