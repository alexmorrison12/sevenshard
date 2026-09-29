// GUARDIAN — Cinderhorn, the Molten Juggernaut. A lava-crusted rhino: horn gores, a stomp, a tail slam for back
// attackers, lobbed lava that leaves burning pools, a COUNTERABLE molten charge that trails lava (chained charges
// later), burrow & erupt under the party, and a Magma Overload stagger check. Its horn is a destruction part: break it
// and the charge loses its lava trail and knockdown.
//  90% horn bar · 65% Molten Core (chain charges, bigger pools) · 40% MAGMA OVERLOAD (stagger) · 20% eruption frenzy
import { fwd, back, rnd, tele, wait, strike, smash, volley, act, counter, pool, onNav, behind, farthest, reachAlong,
  someHeroes, scaleHp, fx, sfx, standardStart, partyK } from './kit.js';

const cw = B => 2 * (B.u.radius + 0.6);
const lavaR = B => (B.phase >= 1 ? 2.6 : 2.1);

async function moltenCharge(B, tgt, teleDur, withCounter) {
  if (!tgt) return;
  B.turnTo(tgt);
  const u = B.u, dir = fwd(B), len = Math.max(6, reachAlong(B, dir, 22)), x0 = u.pos.x, z0 = u.pos.z;
  act(B, 'charge', teleDur + 0.1);
  if (withCounter) counter(B, teleDur * 0.75, 4.5);
  const tg = tele(B, 'rect', { len: len + 1.5, width: cw(B), dur: teleDur, color: withCounter ? 'red' : 'orange' });
  await wait(B, teleDur); tg.alive = false;
  sfx(B, 'charge_roar'); fx(B, 'charge_dust', x0, z0, { follow: true, dur: 1.1, color: 'lava' });
  const horn = !B.flags.hornBroken;
  await B.charge(len, Math.min(0.9, 0.3 + len / 30) * (B.flags.haste || 1), { coef: (horn ? 1.3 : 1.0) * (B.mods.hard ? 1.25 : 1), knock: horn ? 'down' : 'push', kb: 4 });
  if (horn) for (let d = 3; d < len; d += 4.5) pool(B, { x: x0 + dir.x * d, z: z0 + dir.z * d, r: 1.8, dur: 6, tick: 0.5, coef: 0.15, kind: 'lava' });
}

export default {
  id: 'cinderhorn', model: 'cinderhorn', name: 'Cinderhorn', title: 'the Molten Juggernaut', kind: 'guardian',
  radius: 3, height: 4.6, hp: 44000, atk: 0.16, bars: 190, speed: 4.6, turnRate: 3, enrage: 600,
  music: 'boss', arena: 'frostmere',
  anims: {
    gore: { dur: 1.6, hits: [0.78] }, charge: { dur: 3.6, hits: [1.5, 2.1, 2.7] }, stomp: { dur: 2.0, hits: [1.05] },
    lava_spit: { dur: 2.2, hits: [0.85, 1.15, 1.45] }, burrow: { dur: 2.4, hits: [1.2] }, erupt: { dur: 2.0, hits: [0.45] },
    tail_slam: { dur: 2.2, hits: [1.2] }, roar: { dur: 2.6, hits: [1.0] },
  },
  moves: {
    gore: { range: 4, cd: 4, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'gore', 0.72);
      await strike(B, 'cone', { r: 6.2, deg: 80, dur: 0.72, coef: 0.9, knock: 'push', kb: 2.5, fx: 'slash_heavy', fxR: 5, fxColor: 'lava', sfx: 'impact_heavy' });
      await wait(B, 0.45);
    } },
    stomp: { range: 6, cd: 10, weight: 2, async run(B) {
      act(B, 'stomp', 1.0);
      await strike(B, 'circle', { r: 6.5, dur: 1.0, color: 'orange', coef: 1.0, knock: 'up', fx: 'impact_heavy', fxR: 6, sfx: 'stomp', shake: 0.45 });
      await wait(B, 0.5);
    } },
    tail_slam: { range: 9, cd: 7, weight: 4, when: B => behind(B, 7).length > 0, async run(B) {
      act(B, 'tail_slam', 0.9);
      await strike(B, 'cone', { dir: back(B), r: 7, deg: 150, dur: 0.9, coef: 0.9, knock: 'down', fx: 'tail_sweep', fxR: 7, fxColor: 'lava', sfx: 'impact_heavy', shake: 0.25 });
      await wait(B, 0.5);
    } },
    // COUNTER: blue glow during the scrape; chained charges from the Molten Core phase on
    molten_charge: { range: 30, cd: 15, weight: 3, recover: 1.0, async run(B, t) {
      await moltenCharge(B, t, 1.3, true);
      if (B.phase >= 1) { await wait(B, 0.3); await moltenCharge(B, B.randomHero(), 0.95, false); }
      if (B.phase >= 2 || B.mods.hard && B.phase >= 1) { await wait(B, 0.3); await moltenCharge(B, B.randomHero(), 0.9, false); }
      await wait(B, 0.6);
    } },
    lava_spit: { range: 25, cd: 11, weight: 2, async run(B, t) {
      B.turnTo(t); act(B, 'lava_spit', 0.85);
      const pts = someHeroes(B, 3).map(h => ({ x: h.pos.x, z: h.pos.z }));
      for (const p of pts) fx(B, 'lava_spit', B.u.pos.x, B.u.pos.z, { dir: { x: p.x - B.u.pos.x, z: p.z - B.u.pos.z } });
      await volley(B, pts.map(p => ['circle', { x: p.x, z: p.z, r: 3 }]), 1.4, { coef: 0.9, color: 'orange', fx: 'fire_burst', fxR: 3, sfx: 'lava_splash' });
      for (const p of pts) pool(B, { x: p.x, z: p.z, r: lavaR(B), dur: 7, tick: 0.5, coef: 0.15, kind: 'lava' });
      await wait(B, 0.5);
    } },
    burrow: { range: 99, cd: 28, weight: 2.5, minPhase: 1, recover: 1.2, async run(B) {
      const u = B.u, n = B.phase >= 2 ? 4 : 3;
      act(B, 'burrow', 1.2);
      B.banner('Cinderhorn burrows into the magma!', 'warn');
      await wait(B, 1.2);
      u.untargetable = true; u.data.burrowed = 1; fx(B, 'burrow_plume', u.pos.x, u.pos.z, { r: 4, color: 'lava' });
      try {
        let last = null;
        for (let i = 0; i < n; i++) {
          const h = B.randomHero(); if (!h) break;
          const p = onNav(B, h.pos, u.radius);
          last = p;
          await strike(B, 'circle', { x: p.x, z: p.z, r: 4.5, dur: i ? 1.1 : 1.5, color: 'orange', coef: 1.2, knock: 'up', fx: 'flame_pillar', fxR: 3, sfx: 'explosion', shake: 0.4 });
          pool(B, { x: p.x, z: p.z, r: lavaR(B), dur: 6, tick: 0.5, coef: 0.15, kind: 'lava' });
          await wait(B, 0.2);
        }
        if (last) { u.pos.x = last.x; u.pos.z = last.z; }
      } finally { u.untargetable = false; u.data.burrowed = 0; }
      act(B, 'erupt', 0.45);
      smash(B, 'circle', { r: 5, coef: 0.6, knock: 'push', kb: 4, fx: 'crater', fxColor: 'lava', fxR: 5, sfx: 'impact_heavy', shake: 0.5 });
      await wait(B, 0.8);
    } },
    magma_quake: { range: 10, cd: 18, weight: 2, minPhase: 1, async run(B) {
      act(B, 'stomp', 1.1);
      B.banner('The ground heaves with magma!', 'warn');
      await strike(B, 'circle', { r: 5.5, dur: 1.1, color: 'orange', coef: 0.9, knock: 'down', fx: 'ground_quake', fxR: 5.5, sfx: 'stomp', shake: 0.5 });
      await strike(B, 'donut', { r: 11, inner: 5.5, dur: 0.75, color: 'orange', coef: 0.7, knock: 'push', kb: 3, fx: 'shockwave', fxR: 11, fxColor: 'lava' });
      await strike(B, 'donut', { r: 16.5, inner: 11, dur: 0.75, color: 'orange', coef: 0.6, knock: 'push', kb: 3, fx: 'shockwave', fxR: 16.5, fxColor: 'lava' });
      await wait(B, 0.5);
    } },
  },
  mechanics: [
    { id: 'horn', at: 0.9, async run(B) {
      B.destruction('horn', Math.round(700 * (B.mods.hard ? 1.2 : 1)), () => {
        B.flags.hornBroken = true;
        B.banner('Cinderhorn’s molten horn cracks off — its charges lose their fire!', 'good');
        B.interrupt(4);
      });
      B.banner('The molten horn can be broken (weak point / destruction bombs).', 'info');
    } },
    { id: 'core', at: 0.65, async run(B) {
      act(B, 'roar', 1.0); await wait(B, 1.0);
      B.phase = 1;
      B.banner('MOLTEN CORE — Cinderhorn’s hide splits with magma!', 'warn');
      B.u.model?.setGlow?.('enrage', 0.6);
      smash(B, 'circle', { r: 9, coef: 0.4, knock: 'push', kb: 5, fx: 'roar_ring', fxR: 9, sfx: 'boss_roar', shake: 0.5 });
      await wait(B, 0.8);
    } },
    { id: 'overload', at: 0.4, async run(B) {
      const u = B.u, dur = 7;
      B.flags.inMech = true;
      act(B, 'roar', 1.0);
      B.banner('MAGMA OVERLOAD — stagger Cinderhorn before he erupts!', 'stagger');
      const tg = B.tele('circle', { r: 40, dur, color: 'purple', follow: u, safe: true });
      try {
        B.anim('stomp', dur);
        await B.staggerCheck(Math.round(440 * partyK(B) * (B.mods.hard ? 1.08 : 1)), dur, { groggy: 5, label: 'Magma Overload', onFail: async () => {
          tg.alive = false;
          smash(B, 'all', { coef: 3.2, knock: 'up', fx: 'explosion_big', fxR: 12, fxColor: 'lava', sfx: 'explosion_big', shake: 0.9 });
          B.banner('Cinderhorn erupts — the arena floods with lava!', 'fail');
          for (let i = 0; i < 6; i++) { const p = onNav(B, { x: u.pos.x + rnd(B, -14, 14), z: u.pos.z + rnd(B, -14, 14) }); pool(B, { x: p.x, z: p.z, r: 3, dur: 10, tick: 0.5, coef: 0.2, kind: 'lava' }); }
          await wait(B, 1.5);
        } });
      } finally { tg.alive = false; B.flags.inMech = false; }
    } },
    { id: 'frenzy', at: 0.2, async run(B) {
      B.phase = 2; B.flags.haste = 0.88; B.u.st.speed *= 1.15;
      B.banner('Cinderhorn’s core goes critical!', 'warn');
      B.u.model?.setGlow?.('enrage', 1);
      act(B, 'roar', 1.0); await wait(B, 1.2);
    } },
  ],
  onStart: standardStart,
};
