// FIELD / STORY — Varkhul the Ravager, demon general with a burning greatsword (prologue duel at Brighthold and the
// Ashen Ridge fortress). Three-slash combos, a COUNTERABLE overhead that splits the ground in fire, rolling fire waves,
// a leaping slam, imp summons and a roar. At half health his greatsword ignites: fire waves fan out in three
// directions and the burning ground spreads.
//  50% BURNING GREATSWORD · 25% (story) he calls down the fortress fire
import { DEG, rot, fwd, back, rnd, tele, wait, strike, smash, volley, act, counter, pool, onNav, behind, farthest,
  reachAlong, adds, clearAdds, fearHit, scaleHp, fx, sfx, standardStart } from './kit.js';

const FIRE = 'fire';

async function fireWave(B, dir, t0 = 1.35) {
  // a wave that rolls forward in three bands
  const segs = [0, 6, 12].map((off, i) => ['rect', { dir, off, len: 6, width: 5, dur: t0 + i * 0.3 }]);
  const tgs = segs.map(([sh, o]) => tele(B, sh, { ...o, color: 'orange' }));
  for (let i = 0; i < 3; i++) {
    await wait(B, i ? 0.3 : t0); tgs[i].alive = false;
    smash(B, 'rect', { ...segs[i][1], coef: 0.8, knock: i === 2 ? 'down' : 'push', kb: 2, fx: i === 0 ? 'crimson_wave' : null, fxLen: 18, fxColor: FIRE, sfx: i === 0 ? 'fire_whoosh' : null });
  }
}

export default {
  id: 'varkhul', model: 'varkhul', name: 'Varkhul', title: 'the Ravager', kind: 'field',
  radius: 1.3, height: 3.5, hp: 30000, atk: 0.12, bars: 120, speed: 5.2, turnRate: 5, enrage: 600,
  music: 'boss_varkhul', arena: 'inferno',
  anims: {
    slash_combo: { dur: 2.6, hits: [0.55, 1.15, 1.9] }, overhead: { dur: 2.2, hits: [1.2] }, fire_wave: { dur: 2.6, hits: [1.35] },
    leap: { dur: 2.6, hits: [1.6] }, summon: { dur: 3.0, hits: [1.8] }, roar: { dur: 2.4, hits: [0.9] },
  },
  moves: {
    slash_combo: { range: 3.5, cd: 5, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'slash_combo', 0.65);
      for (let i = 0; i < 3; i++) {
        if (i && B.target && !B.target.dead) B.turnTo(B.target);
        await strike(B, 'cone', { r: 4.8, deg: 140, dur: i ? 0.55 : 0.65, coef: 0.7, knock: i === 2 ? 'down' : undefined, fx: 'dark_slash', fxR: 4.5, fxColor: FIRE, sfx: 'slash_heavy' });
      }
      await wait(B, 0.4);
    } },
    // COUNTER: blue glow while the burning blade is raised
    overhead: { range: 5, cd: 11, weight: 2.5, async run(B, t) {
      B.turnTo(t); act(B, 'overhead', 1.2);
      counter(B, 1.0, 4);
      const u = B.u, dir = fwd(B), x = u.pos.x, z = u.pos.z;
      await strike(B, 'rect', { len: 10, width: 3, dur: 1.2, coef: 1.3, knock: 'down', fx: 'ground_crack', fxLen: 10, fxColor: FIRE, sfx: 'impact_heavy', shake: 0.4 });
      for (const d of [3, 6, 9]) pool(B, { x: x + dir.x * d, z: z + dir.z * d, r: 1.4, dur: 5, tick: 0.5, coef: 0.14, kind: 'fire' });
      await wait(B, 0.5);
    } },
    fire_wave: { range: 14, cd: 9, weight: 2.5, async run(B, t) {
      B.turnTo(t); act(B, 'fire_wave', 1.35);
      if (B.phase >= 1) {
        const f = fwd(B);
        await Promise.all([-40, 0, 40].map(a => fireWave(B, rot(f, a * DEG))));
      } else await fireWave(B, fwd(B));
      await wait(B, 0.5);
    } },
    leap: { range: 25, cd: 13, weight: 2, async run(B, t) {
      const tgt = B.level.rng() < 0.5 ? farthest(B) || t : t;
      const p = onNav(B, tgt.pos, B.u.radius);
      act(B, 'leap', 1.6);
      const tg = tele(B, 'circle', { x: p.x, z: p.z, r: 4.5, dur: 1.6, color: 'orange' });
      await wait(B, 0.6);
      await B.leap(p.x, p.z, 1.0 * (B.flags.haste || 1), 4);
      tg.alive = false;
      smash(B, 'circle', { r: 4.5, coef: 1.2, knock: 'up', fx: 'crater', fxR: 4.5, fxColor: FIRE, sfx: 'impact_heavy', shake: 0.5 });
      pool(B, { x: p.x, z: p.z, r: 2.2, dur: 5, tick: 0.5, coef: 0.14, kind: 'fire' });
      await wait(B, 0.6);
    } },
    summon: { range: 99, cd: 30, weight: 1.5, when: B => B.fightT > 20, async run(B) {
      act(B, 'summon', 1.8);
      B.banner('Varkhul calls his imps from the flames!', 'warn');
      await wait(B, 1.8);
      adds(B, 'imp', B.phase >= 1 ? 5 : 4, { name: 'Cinder Imp', r: 7 });
      fx(B, 'fire_burst', B.u.pos.x, B.u.pos.z, { r: 5 });
      await wait(B, 0.5);
    } },
    back_kick: { range: 8, cd: 7, weight: 3, when: B => behind(B, 5).length > 0, async run(B) {
      act(B, 'slash_combo', 0.6);
      await strike(B, 'cone', { dir: back(B), r: 5, deg: 150, dur: 0.6, coef: 0.8, knock: 'push', kb: 3, fx: 'dark_slash', fxR: 5, fxColor: FIRE, sfx: 'slash_heavy' });
      await wait(B, 0.4);
    } },
  },
  mechanics: [
    { id: 'blade', at: 0.5, async run(B) {
      act(B, 'roar', 0.9);
      B.banner('Varkhul’s greatsword ignites — the Ravager burns everything!', 'warn');
      await wait(B, 0.9);
      fearHit(B, 'circle', { r: 8, coef: 0.4, fear: 1.5, fx: 'roar_ring', fxR: 8, fxColor: FIRE, sfx: 'boss_roar', shake: 0.5 });
      B.phase = 1; B.flags.haste = 0.9; B.u.model?.setGlow?.('enrage', 1);
      await wait(B, 0.8);
    } },
    { id: 'firefall', at: 0.25, async run(B) {
      act(B, 'summon', 1.8);
      B.banner('Burn, Brighthold! — fire rains on the ruins!', 'warn');
      for (let k = 0; k < 2; k++) {
        const pts = B.heroes().map(h => ({ x: h.pos.x, z: h.pos.z }));
        for (let i = 0; i < 3; i++) pts.push(onNav(B, { x: B.u.pos.x + rnd(B, -12, 12), z: B.u.pos.z + rnd(B, -12, 12) }));
        await volley(B, pts.map(p => ['circle', { x: p.x, z: p.z, r: 2.6 }]), k ? 1.0 : 1.4, { coef: 0.8, color: 'orange', fx: 'flame_pillar', fxR: 2.2, fxMax: 8, sfx: 'explosion' });
      }
      await wait(B, 0.6);
    } },
  ],
  onStart: standardStart,
  onBossDeath(enc, unit) { clearAdds(unit.ctrl); },
};
