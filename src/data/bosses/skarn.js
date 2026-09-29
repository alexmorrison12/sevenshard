// LEGION RAID gate 1 — Skarn, the Cinder Hound (fire twin of Vesk; see hounds.js for the shared twin mechanics).
// Bites and claws, a tail whip for back attackers, fire breath, a burning charge that leaves fire in its wake, cinder
// rain under the raid, and an orange pounce. His flame mane is breakable (no more fire trails).
import { fwd, tele, wait, strike, smash, volley, act, marker, pool, onNav, rnd, farthest, someHeroes, fx } from './kit.js';
import { shared, charge, twinHowl, crossfire, onStart, onBossDeath, partMech, HOUND_ANIMS, other } from './hounds.js';

export default {
  id: 'skarn', model: 'skarn', name: 'Skarn', title: 'the Cinder Hound', kind: 'legion', element: 'fire',
  radius: 2.2, height: 4.1, hp: 33000, atk: 0.15, bars: 90, speed: 5.4, turnRate: 4, enrage: 600,
  music: 'boss_hounds', arena: 'kennels', anims: HOUND_ANIMS,
  moves: {
    ...shared,
    fire_breath: { range: 13, cd: 12, weight: 2, async run(B, t) {
      B.turnTo(t); act(B, 'breath', 1.1);
      const cone = { r: 12, deg: 55 };
      await strike(B, 'cone', { ...cone, dur: 1.1, color: 'orange', coef: 0.6, fx: 'fire_breath', fxLen: 12, sfx: 'fire_whoosh' });
      const mk = marker(B, 'cone', { ...cone, x: B.u.pos.x, z: B.u.pos.z, dir: fwd(B) });
      try { for (let i = 0; i < 3; i++) { await wait(B, 0.5); B.hit('cone', { ...cone, coef: 0.42 }); } }
      finally { mk.alive = false; }
      await wait(B, 0.5);
    } },
    flame_charge: { range: 30, cd: 15, weight: 2, recover: 1.0, async run(B, t) {
      await charge(B, t, 1.2, { coef: 1.1, trail: B.flags.partBroken ? null : 'fire' });
      await wait(B, 0.5);
    } },
    cinder_rain: { range: 30, cd: 18, weight: 1.5, recover: 1.0, async run(B) {
      act(B, 'howl', 0.6);
      const pts = someHeroes(B, 5).map(h => ({ x: h.pos.x, z: h.pos.z }));
      for (let i = 0; i < 3; i++) pts.push(onNav(B, { x: B.u.pos.x + rnd(B, -12, 12), z: B.u.pos.z + rnd(B, -12, 12) }));
      await volley(B, pts.map(p => ['circle', { x: p.x, z: p.z, r: 3 }]), 1.4, { coef: 1.0, color: 'orange', fx: 'fire_burst', fxR: 3, sfx: 'explosion' });
      if (!B.flags.partBroken) for (const p of pts.slice(0, 4)) pool(B, { x: p.x, z: p.z, r: 2, dur: 4, tick: 0.5, coef: 0.12, kind: 'fire' });
      await wait(B, 0.5);
    } },
    pounce: { range: 22, cd: 13, weight: 2, async run(B, t) {
      const tgt = B.level.rng() < 0.5 ? farthest(B) || t : t;
      const p = onNav(B, tgt.pos, B.u.radius);
      act(B, 'pounce', 1.3);
      const tg = tele(B, 'circle', { x: p.x, z: p.z, r: 4.5, dur: 1.3, color: 'orange' });
      await wait(B, 0.65);
      await B.leap(p.x, p.z, 0.65 * (B.flags.haste || 1), 3.5);
      tg.alive = false;
      smash(B, 'circle', { r: 4.5, coef: 1.1, knock: 'down', fx: 'crater', fxColor: 'fire', fxR: 4.5, sfx: 'impact_heavy', shake: 0.4 });
      await wait(B, 0.6);
    } },
  },
  mechanics: [
    partMech('mane', 'Skarn’s flame mane gutters out — his fire no longer lingers!'),
    { id: 'crossfire', at: 0.75, async run(B) { const o = other(B); if (o) { o.ctrl.mechDone.add('crossfire'); o.ctrl.phase = 1; } B.phase = 1; await crossfire(B); } },
    { id: 'twin_howl', at: 0.55, async run(B) { await twinHowl(B); } },
  ],
  onStart, onBossDeath,
};
