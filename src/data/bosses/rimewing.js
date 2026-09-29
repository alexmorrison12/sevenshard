// GUARDIAN — Rimewing, Tyrant of the Frozen Sky. Ice wyvern: bites and claws up front, a tail that punishes back
// attackers, frost breath, erupting ice spikes, a counterable pounce, flight dives, and an Absolute Zero stagger check.
export default {
  id: 'rimewing', model: 'rimewing', name: 'Rimewing', title: 'Tyrant of the Frozen Sky', kind: 'guardian',
  radius: 2.8, height: 6, hp: 36000, atk: 0.1, bars: 180, speed: 5.2, turnRate: 3.2, enrage: 540,
  music: 'boss', arena: 'frostmere',
  moves: {
    bite: { range: 4, cd: 3.5, weight: 3, async run(B, t) {
      B.turnTo(t); const a = B.anim('bite', 1.2);
      await B.strike('cone', { r: 5.5, deg: 80, dur: 0.6, coef: 0.55, fx: 'bite', sfx: 'monster_hit' });
      await B.wait(0.5);
    } },
    claw: { range: 5, cd: 5, weight: 2, async run(B, t) {
      B.turnTo(t); B.anim('claw', 1.3);
      await B.strike('cone', { r: 6, deg: 150, dur: 0.75, coef: 0.7, knock: 'push', kb: 3, fx: 'claw_swipe', sfx: 'slash_heavy', shake: 0.2 });
      await B.wait(0.5);
    } },
    tail_sweep: { range: 9, cd: 7, weight: 4, when: B => B.heroes().some(h => { const u = B.u; const dx = h.pos.x - u.pos.x, dz = h.pos.z - u.pos.z; return (dx * u.fx + dz * u.fz) < -1 && Math.hypot(dx, dz) < 9; }), async run(B) {
      B.anim('tail_sweep', 1.6);
      const back = { x: -B.u.fx, z: -B.u.fz };
      await B.strike('cone', { r: 8, deg: 200, dir: back, dur: 0.9, coef: 0.9, knock: 'down', color: 'orange', fx: 'tail_sweep', sfx: 'whoosh_big', shake: 0.3 });
      await B.wait(0.6);
    } },
    breath: { range: 13, minRange: 3, cd: 11, weight: 3, async run(B, t) {
      B.turnTo(t); B.anim('breath', 2.4);
      B.banner('Rimewing inhales the frozen wind…', 'warn');
      const tg = B.tele('cone', { r: 14, deg: 55, dur: 1.2, color: 'orange' }); await B.wait(1.2); tg.alive = false;
      for (let i = 0; i < 5; i++) { B.hit('cone', { r: 14, deg: 55, coef: 0.3, status: [{ id: 'freeze', dur: 1.2, chance: 0.35 }], fx: i === 0 ? 'frost_breath' : null, sfx: i === 0 ? 'ice' : null }); await B.wait(0.18); }
      await B.wait(0.4);
    } },
    ice_spikes: { range: 22, cd: 14, weight: 2, async run(B) {
      B.anim('ice_spikes', 2);
      B.banner('The ice answers her roar!', 'warn');
      await B.wait(0.4);
      const pts = []; for (const h of B.heroes()) for (let i = 0; i < 2; i++) pts.push({ x: h.pos.x + (Math.random() - 0.5) * 3, z: h.pos.z + (Math.random() - 0.5) * 3 });
      for (let i = 0; i < 6; i++) pts.push({ x: B.u.pos.x + (Math.random() - 0.5) * 22, z: B.u.pos.z + (Math.random() - 0.5) * 22 });
      const tgs = pts.map(p => B.tele('circle', { x: p.x, z: p.z, r: 2.6, dur: 1.3 }));
      await B.wait(1.3);
      tgs.forEach(t => t.alive = false);
      for (const p of pts) B.hit('circle', { x: p.x, z: p.z, r: 2.6, coef: 0.8, knock: 'up', fx: 'ice_spike', sfx: 'ice_shatter' });
      B.level.emit('shake', { unit: B.u, v: 0.3 });
      await B.wait(0.6);
    } },
    pounce: { range: 14, minRange: 5, cd: 16, weight: 2, async run(B, t) {
      B.turnTo(t); B.anim('pounce', 2.2);
      B.counterWindow(1.0);
      const tg = B.tele('circle', { x: t.pos.x, z: t.pos.z, r: 4, dur: 1.1, color: 'blue' });
      await B.wait(1.1); tg.alive = false;
      await B.leap(t.pos.x - B.u.fx * 1.5, t.pos.z - B.u.fz * 1.5, 0.45, 3);
      B.hit('circle', { r: 4.2, coef: 1.2, knock: 'down', fx: 'crater', sfx: 'impact_heavy', shake: 0.45, heavy: true });
      await B.wait(0.7);
    } },
    dive: { range: 30, minRange: 6, cd: 22, weight: 2, minPhase: 1, when: B => !B.flags.grounded, async run(B, t) {
      const u = B.u;
      B.anim('takeoff', 1); u.data.fly = 1; u.untargetable = true;
      B.banner('Rimewing takes to the frozen sky!', 'warn');
      await B.wait(1.0);
      await B.leap(u.pos.x - u.fx * 6, u.pos.z - u.fz * 6, 0.6, 8);
      u.data.hover = 7;
      const tgt = B.randomHero() || t; B.turnTo(tgt);
      const tg = B.tele('rect', { len: 26, width: 6, dur: 1.4, color: 'orange' });
      await B.wait(1.4); tg.alive = false;
      B.anim('dive', 0.8); u.data.hover = 1.5;
      await B.charge(24, 0.5, { coef: 1.5, knock: 'down', kb: 6 });
      u.data.hover = 0; u.data.fly = 0; u.untargetable = false;
      B.anim('land', 0.8); B.hit('circle', { r: 5, coef: 0.6, knock: 'push', kb: 3, fx: 'shockwave', shake: 0.4 });
      await B.wait(0.9);
    } },
  },
  mechanics: [
    { id: 'wings', at: 0.85, async run(B) {
      B.destruction('wings', 120, () => { B.banner('Rimewing’s wing shatters — she can no longer fly!', 'good'); B.flags.grounded = true; });
      B.banner('Her crystal wings can be broken (weak point / destruction bombs).', 'info');
    } },
    { id: 'phase2', at: 0.65, async run(B) {
      B.phase = 1; B.anim('roar', 1.6); B.banner('Rimewing is enraged by the cold!', 'warn');
      B.hit('circle', { r: 9, coef: 0.2, knock: 'push', kb: 5, fx: 'roar_ring', sfx: 'boss_roar', shake: 0.4 });
      await B.wait(1.4);
    } },
    { id: 'absolute_zero', at: 0.4, async run(B) {
      const u = B.u;
      B.anim('channel', 7); B.banner('ABSOLUTE ZERO — stagger her before the storm breaks!', 'stagger');
      const tg = B.tele('circle', { r: 40, dur: 7, color: 'purple', follow: u });
      try {
        await B.staggerCheck(420, 7, { groggy: 5, onFail: async () => {
          tg.alive = false;
          B.hit('all', { coef: 2.2, knock: 'down', status: [{ id: 'freeze', dur: 3 }], fx: 'absolute_zero', sfx: 'explosion_big', shake: 0.9 });
          B.banner('The world freezes.', 'fail');
          await B.wait(1.5);
        } });
      } finally { tg.alive = false; }
    } },
    { id: 'desperation', at: 0.15, async run(B) {
      B.banner('Rimewing fights with the last of her strength!', 'warn');
      B.phase = 2; B.u.st.speed *= 1.2;
      B.anim('roar', 1.4); await B.wait(1.2);
    } },
  ],
};
