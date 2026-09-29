// PROLOGUE SET PIECE — Ashmaw, the Siege Behemoth (the Siege of Brighthold). A 15 m siege beast that batters the
// walls: a colossal slam (orange strip), fire breath, a quaking stomp and a roar. Deliberately simple and slow — the
// prologue frames it with cannons and the awakened hero; as an encounter it is a big, readable damage sponge.
import { fwd, rnd, tele, wait, strike, smash, act, marker, onNav, scaleHp, fx, standardStart } from './kit.js';

export default {
  id: 'ashmaw', model: 'ashmaw', name: 'Ashmaw', title: 'the Siege Behemoth', kind: 'field',
  radius: 6, height: 15, hp: 30000, atk: 0.1, bars: 100, speed: 1.6, turnRate: 1.2, enrage: 600,
  music: 'boss', arena: 'test',
  anims: { slam_wall: { dur: 4.2, hits: [2.3] }, roar: { dur: 4.0, hits: [1.4] }, breath: { dur: 5.0, hits: [1.8, 2.6, 3.4] } },
  moves: {
    slam: { range: 12, cd: 7, weight: 3, recover: 1.2, async run(B, t) {
      B.turnTo(t); act(B, 'slam_wall', 2.0);
      await strike(B, 'rect', { len: 17, width: 7, dur: 2.0, color: 'orange', coef: 1.4, knock: 'up', fx: 'axe_shockwave', fxLen: 17, fxColor: 'fire', sfx: 'impact_heavy', shake: 0.7, heavy: true });
      await wait(B, 0.8);
    } },
    breath: { range: 22, cd: 12, weight: 2, recover: 1.0, async run(B, t) {
      B.turnTo(t); act(B, 'breath', 1.8);
      const cone = { r: 20, deg: 50 };
      await strike(B, 'cone', { ...cone, dur: 1.8, color: 'orange', coef: 0.7, fx: 'fire_breath', fxLen: 20, sfx: 'fire' });
      const mk = marker(B, 'cone', { ...cone, x: B.u.pos.x, z: B.u.pos.z, dir: fwd(B) });
      try { for (let i = 0; i < 2; i++) { await wait(B, 0.8); B.hit('cone', { ...cone, coef: 0.5 }); } }
      finally { mk.alive = false; }
      await wait(B, 0.6);
    } },
    quake: { range: 9, cd: 11, weight: 2, recover: 1.0, async run(B) {
      act(B, 'slam_wall', 1.5);
      await strike(B, 'circle', { r: 10, dur: 1.5, color: 'orange', coef: 1.0, knock: 'down', fx: 'ground_quake', fxR: 10, sfx: 'stomp', shake: 0.6 });
      await wait(B, 0.6);
    } },
    roar: { range: 99, cd: 22, weight: 1.5, recover: 1.0, async run(B) {
      act(B, 'roar', 1.4);
      await wait(B, 1.4);
      smash(B, 'circle', { r: 16, coef: 0.3, knock: 'push', kb: 6, fx: 'roar_ring', fxR: 16, sfx: 'boss_roar', shake: 0.6 });
      await wait(B, 0.6);
    } },
    // burning debris rains from the walls it batters
    debris: { range: 40, cd: 14, weight: 1.5, async run(B) {
      act(B, 'roar', 1.2);
      const pts = B.heroes().map(h => ({ x: h.pos.x + rnd(B, -1, 1), z: h.pos.z + rnd(B, -1, 1) }));
      const tgs = pts.map(p => tele(B, 'circle', { x: p.x, z: p.z, r: 2.8, dur: 1.5, color: 'orange' }));
      await wait(B, 1.5); tgs.forEach(t => t.alive = false);
      for (const p of pts) smash(B, 'circle', { x: p.x, z: p.z, r: 2.8, coef: 0.8, knock: 'down', fx: 'explosion', fxR: 2.5 });
      await wait(B, 0.4);
    } },
  },
  mechanics: [
    { id: 'rage', at: 0.4, async run(B) {
      act(B, 'roar', 1.4);
      B.banner('Ashmaw bellows — the walls shake!', 'warn');
      await wait(B, 1.4);
      smash(B, 'circle', { r: 18, coef: 0.4, knock: 'push', kb: 6, fx: 'roar_ring', fxR: 18, sfx: 'boss_roar', shake: 0.8 });
      B.phase = 1; B.flags.haste = 0.85;
      await wait(B, 0.6);
    } },
  ],
  onStart: standardStart,
};
