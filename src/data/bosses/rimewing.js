// GUARDIAN — Rimewing, Tyrant of the Frozen Sky. Ice wyvern: bites and a COUNTERABLE claw up front, a tail that
// punishes back attackers, frost breath, erupting ice spikes, a swooping lunge, flight dives, and an Absolute Zero
// stagger check (she rises into the storm; break her or the arena freezes). Her crystal crest is breakable: once it
// shatters the frozen sky no longer answers her (no more dives).
import { fwd, back, rnd, tele, wait, strike, smash, volley, act, counter, marker, onNav, behind, farthest, reachAlong, scaleHp, fx, standardStart, partyK } from './kit.js';

export default {
  id: 'rimewing', model: 'rimewing', name: 'Rimewing', title: 'Tyrant of the Frozen Sky', kind: 'guardian',
  radius: 2.8, height: 6, hp: 40000, atk: 0.14, bars: 180, speed: 5.2, turnRate: 3.2, enrage: 540,
  music: 'boss', arena: 'frostmere',
  anims: {
    bite: { dur: 1.35, hits: [0.62] }, claw: { dur: 1.6, hits: [0.86] }, tail_sweep: { dur: 2.1, hits: [1.0] },
    breath: { dur: 3.8, hits: [1.35, 1.75, 2.15, 2.55, 2.95] }, takeoff: { dur: 2.4, hits: [0.8] }, dive: { dur: 2.9, hits: [1.42] },
    land: { dur: 2.0, hits: [1.15] }, ice_spikes: { dur: 3.1, hits: [1.6, 2.15] }, wing_gust: { dur: 2.5, hits: [1.2, 1.6] },
  },
  moves: {
    bite: { range: 4, cd: 3.5, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'bite', 0.62);
      await strike(B, 'cone', { r: 5.5, deg: 80, dur: 0.62, coef: 0.6, fx: 'bite', fxR: 3.5, sfx: 'bite' });
      await wait(B, 0.5);
    } },
    // COUNTER: the model's claw wind-up carries the blue window
    claw: { range: 5, cd: 9, weight: 2.5, async run(B, t) {
      B.turnTo(t); act(B, 'claw', 1.05);
      counter(B, 0.8, 4);
      await strike(B, 'cone', { r: 6, deg: 150, dur: 1.05, coef: 0.8, knock: 'push', kb: 3, fx: 'claw_swipe', fxR: 6, fxColor: 'frost', sfx: 'slash_heavy', shake: 0.2 });
      await wait(B, 0.5);
    } },
    tail_sweep: { range: 9, cd: 7, weight: 4, when: B => behind(B, 8).length > 0, async run(B) {
      act(B, 'tail_sweep', 0.9);
      await strike(B, 'cone', { dir: back(B), r: 8, deg: 200, dur: 0.9, coef: 0.9, knock: 'down', color: 'orange', fx: 'tail_sweep', fxR: 8, sfx: 'whoosh_big', shake: 0.3 });
      await wait(B, 0.6);
    } },
    breath: { range: 13, cd: 11, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'breath', 1.35);
      B.banner('Rimewing inhales the frozen wind…', 'warn');
      const cone = { r: 14, deg: 55 };
      await strike(B, 'cone', { ...cone, dur: 1.35, color: 'orange', coef: 0.4, status: [{ id: 'freeze', dur: 1.2, chance: 0.3 }], fx: 'frost_breath', fxLen: 14, sfx: 'ice' });
      const mk = marker(B, 'cone', { ...cone, x: B.u.pos.x, z: B.u.pos.z, dir: fwd(B) });
      try { for (let i = 0; i < 4; i++) { await wait(B, 0.4); B.hit('cone', { ...cone, coef: 0.3, status: [{ id: 'freeze', dur: 1.2, chance: 0.2 }] }); } }
      finally { mk.alive = false; }
      await wait(B, 0.4);
    } },
    ice_spikes: { range: 22, cd: 14, weight: 2, async run(B) {
      act(B, 'ice_spikes', 1.6);
      B.banner('The ice answers her roar!', 'warn');
      const pts = [];
      for (const h of B.heroes()) pts.push({ x: h.pos.x + rnd(B, -1.5, 1.5), z: h.pos.z + rnd(B, -1.5, 1.5) });
      for (let i = 0; i < 6; i++) pts.push(onNav(B, { x: B.u.pos.x + rnd(B, -11, 11), z: B.u.pos.z + rnd(B, -11, 11) }));
      await volley(B, pts.map(p => ['circle', { x: p.x, z: p.z, r: 2.4 }]), 1.3, { coef: 0.8, knock: 'up', fx: 'ice_spike', fxR: 2.4, sfx: 'ice_shatter', shake: 0.3 });
      await wait(B, 0.6);
    } },
    // a swooping lunge onto a raider (the dive action, low)
    swoop: { range: 16, cd: 15, weight: 2, async run(B, t) {
      const tgt = B.level.rng() < 0.5 ? farthest(B) || t : t;
      B.turnTo(tgt); act(B, 'dive', 1.2);
      const p = onNav(B, { x: tgt.pos.x - B.u.fx * 1.5, z: tgt.pos.z - B.u.fz * 1.5 }, B.u.radius);
      const tg = tele(B, 'circle', { x: tgt.pos.x, z: tgt.pos.z, r: 4, dur: 1.2, color: 'orange' });
      await wait(B, 0.75);
      await B.leap(p.x, p.z, 0.45 * (B.flags.haste || 1), 3);
      tg.alive = false;
      smash(B, 'circle', { x: tgt.pos.x, z: tgt.pos.z, r: 4.2, coef: 1.1, knock: 'down', fx: 'crater', fxColor: 'frost', fxR: 4, sfx: 'impact_heavy', shake: 0.45, heavy: true });
      await wait(B, 0.7);
    } },
    dive: { range: 40, cd: 24, weight: 2, minPhase: 1, when: B => !B.flags.grounded, async run(B, t) {
      const u = B.u;
      act(B, 'takeoff', 0.8); u.untargetable = true;
      B.banner('Rimewing takes to the frozen sky!', 'warn');
      await wait(B, 0.9);
      u.data.fly = 1;
      await B.leap(u.pos.x - u.fx * 6, u.pos.z - u.fz * 6, 0.6, 8);
      u.data.hover = 5.5;
      const tgt = B.randomHero() || t; B.turnTo(tgt);
      const dir = fwd(B), len = Math.max(10, reachAlong(B, dir, 26));
      act(B, 'dive', 1.4);
      const tg = tele(B, 'rect', { len, width: 2 * (u.radius + 0.6), dur: 1.4, color: 'orange' });
      await wait(B, 1.4); tg.alive = false;
      u.data.hover = 1.5;
      await B.charge(len, 0.55, { coef: 1.3 * (B.mods.hard ? 1.25 : 1), knock: 'down', kb: 6 });
      u.data.hover = 0; u.data.fly = 0; u.untargetable = false;
      act(B, 'land', 0.5);
      smash(B, 'circle', { r: 5, coef: 0.5, knock: 'push', kb: 3, fx: 'frost_burst', fxR: 5, shake: 0.4 });
      await wait(B, 0.9);
    } },
  },
  mechanics: [
    { id: 'crest', at: 0.85, async run(B) {
      B.destruction('crest', Math.round(600 * (B.mods.hard ? 1.2 : 1)), () => { B.banner('Her crystal crest shatters — the frozen sky no longer answers her!', 'good'); B.flags.grounded = true; B.interrupt(3); });
      B.banner('Her crystal crest can be broken (weak point / destruction bombs).', 'info');
    } },
    { id: 'phase2', at: 0.65, async run(B) {
      B.phase = 1; act(B, 'wing_gust', 1.2); B.banner('Rimewing is enraged by the cold!', 'warn');
      await wait(B, 1.2);
      smash(B, 'circle', { r: 9, coef: 0.3, knock: 'push', kb: 5, fx: 'wing_gust', fxR: 9, sfx: 'boss_roar', shake: 0.4 });
      await wait(B, 1.0);
    } },
    { id: 'absolute_zero', at: 0.4, async run(B) {
      const u = B.u, dur = 7;
      act(B, 'takeoff', 0.8); u.data.fly = 1;
      B.banner('ABSOLUTE ZERO — she gathers the storm! Stagger her before it breaks!', 'stagger');
      const tg = B.tele('circle', { r: 40, dur, color: 'purple', follow: u, safe: true });
      try {
        await B.staggerCheck(Math.round(430 * partyK(B) * (B.mods.hard ? 1.08 : 1)), dur, { groggy: 5, label: 'Absolute Zero', onFail: async () => {
          tg.alive = false;
          act(B, 'land', 0.5); await wait(B, 0.5);
          smash(B, 'all', { coef: 3.4, knock: 'down', status: [{ id: 'freeze', dur: 2.5 }], fx: 'absolute_zero', fxR: 20, sfx: 'explosion_big', shake: 0.9 });
          B.banner('The world freezes.', 'fail');
          await wait(B, 1.5);
        } });
      } finally { tg.alive = false; u.data.fly = 0; }
    } },
    { id: 'desperation', at: 0.15, async run(B) {
      B.banner('Rimewing fights with the last of her strength!', 'warn');
      B.phase = 2; B.u.st.speed *= 1.2; B.flags.haste = 0.88;
      act(B, 'wing_gust', 1.2); await wait(B, 1.4);
    } },
  ],
  onStart: standardStart,
};
