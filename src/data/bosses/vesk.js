// LEGION RAID gate 1 — Vesk, the Void Hound (shadow twin of Skarn; see hounds.js for the shared twin mechanics).
// Bites and claws, a scythe-tail whip that leaves void rifts, a sweeping void breath, a shadow step behind a raider,
// and the COUNTERABLE shadow pounce. Its scythe tail is breakable (no more void rifts).
import { fwd, rot, DEG, tele, wait, strike, smash, act, counter, onNav, behind, farthest, dirTo, fx, sfx } from './kit.js';
import { shared, charge, twinHowl, crossfire, onStart, onBossDeath, partMech, HOUND_ANIMS, other } from './hounds.js';

export default {
  id: 'vesk', model: 'vesk', name: 'Vesk', title: 'the Void Hound', kind: 'legion', element: 'void',
  radius: 2.2, height: 4.1, hp: 33000, atk: 0.15, bars: 90, speed: 5.6, turnRate: 4.5, enrage: 600,
  music: 'boss_hounds', arena: 'kennels', anims: HOUND_ANIMS,
  moves: {
    ...shared,
    // COUNTER: blue shimmer during the crouch
    shadow_pounce: { range: 22, cd: 14, weight: 3, async run(B, t) {
      const tgt = B.level.rng() < 0.4 ? farthest(B) || t : t;
      B.turnTo(tgt); act(B, 'pounce', 1.35);
      counter(B, 1.05, 4);
      const p = onNav(B, tgt.pos, B.u.radius);
      const tg = tele(B, 'circle', { x: p.x, z: p.z, r: 4.5, dur: 1.35, color: 'red' });
      await wait(B, 0.7);
      await B.leap(p.x, p.z, 0.65 * (B.flags.haste || 1), 3.5);
      tg.alive = false;
      smash(B, 'circle', { r: 4.5, coef: 1.2, knock: 'down', fx: 'dark_burst', fxR: 4.5, fxColor: 'void', sfx: 'impact_heavy', shake: 0.4 });
      await wait(B, 0.6);
    } },
    // a void beam that sweeps across 70° in three pulses
    void_breath: { range: 16, cd: 12, weight: 2, recover: 0.8, async run(B, t) {
      B.turnTo(t); act(B, 'breath', 1.0);
      const f = fwd(B), side = B.level.rng() < 0.5 ? 1 : -1;
      const dirs = [-35, 0, 35].map(a => rot(f, side * a * DEG));
      await strike(B, 'rect', { dir: dirs[0], len: 17, width: 3.6, dur: 1.0, color: 'orange', coef: 0.8, status: [{ id: 'weaken', dur: 5 }], fx: 'dark_breath', fxLen: 17, sfx: 'void_whoosh' });
      await strike(B, 'rect', { dir: dirs[1], len: 17, width: 3.6, dur: 0.45, color: 'orange', coef: 0.8, status: [{ id: 'weaken', dur: 5 }], fx: 'dark_breath', fxLen: 17 });
      await strike(B, 'rect', { dir: dirs[2], len: 17, width: 3.6, dur: 0.45, color: 'orange', coef: 0.8, status: [{ id: 'weaken', dur: 5 }], fx: 'dark_breath', fxLen: 17 });
      await wait(B, 0.5);
    } },
    // vanish and strike from behind a raider
    shadow_step: { range: 20, cd: 11, weight: 2, async run(B, t) {
      const u = B.u, tgt = t;
      u.untargetable = true; fx(B, 'dark_burst', u.pos.x, u.pos.z, { r: 2.5, color: 'void' }); sfx(B, 'void_whoosh');
      await wait(B, 0.45);
      const d = dirTo(B, tgt.pos), p = onNav(B, { x: tgt.pos.x + d.x * 3.2, z: tgt.pos.z + d.z * 3.2 }, u.radius);
      u.pos.x = p.x; u.pos.z = p.z; u.untargetable = false;
      B.turnTo(tgt); fx(B, 'dark_burst', u.pos.x, u.pos.z, { r: 2.5, color: 'void' });
      act(B, 'bite', 0.7);
      await strike(B, 'cone', { r: 5.5, deg: 100, dur: 0.7, coef: 1.0, knock: 'push', kb: 3, fx: 'bite', fxR: 3, sfx: 'bite' });
      await wait(B, 0.4);
    } },
    lunge: { range: 30, cd: 16, weight: 1.5, recover: 1.0, async run(B, t) {
      await charge(B, t, 1.1, { coef: 1.0 });
      await wait(B, 0.4);
    } },
  },
  mechanics: [
    partMech('tail', 'Vesk’s scythe tail shatters — no more void rifts!'),
    { id: 'crossfire', at: 0.75, async run(B) { const o = other(B); if (o) { o.ctrl.mechDone.add('crossfire'); o.ctrl.phase = 1; } B.phase = 1; await crossfire(B); } },
    { id: 'twin_howl', at: 0.55, async run(B) { await twinHowl(B); } },
  ],
  onStart, onBossDeath,
};
