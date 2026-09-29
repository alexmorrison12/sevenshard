// FIELD / EVENT — the Gatekeeper, Warden of the Chaos Gate (Chaos Gate event lord, Inferno Descent floors). A
// shield-and-halberd sentinel: a COUNTERABLE shield bash, a three-turn spin, a shield charge, a ground slam, and gate
// spawn summons. At half health the gate tears open behind him: rift pools and faster summons.
import { fwd, back, rnd, tele, wait, strike, smash, volley, act, counter, pool, onNav, behind, reachAlong, adds,
  clearAdds, scaleHp, fx, standardStart } from './kit.js';

const RIFT = 'demon';
const cw = B => 2 * (B.u.radius + 0.6);

export default {
  id: 'gatekeeper', model: 'gatekeeper', name: 'The Gatekeeper', title: 'Warden of the Chaos Gate', kind: 'field',
  radius: 1.6, height: 4, hp: 26000, atk: 0.12, bars: 110, speed: 4.4, turnRate: 4, enrage: 540,
  music: 'boss', arena: 'inferno',
  anims: { bash: { dur: 1.8, hits: [0.9] }, spin: { dur: 2.8, hits: [0.9, 1.4, 1.9] }, summon: { dur: 2.8, hits: [1.6] } },
  moves: {
    // COUNTER: the shield glows blue as he winds up
    bash: { range: 4, cd: 9, weight: 2.5, async run(B, t) {
      B.turnTo(t); act(B, 'bash', 1.0);
      counter(B, 0.85, 4);
      await strike(B, 'cone', { r: 5, deg: 90, dur: 1.0, coef: 1.1, knock: 'down', kb: 4, fx: 'impact_heavy', fxR: 3, sfx: 'impact_heavy', shake: 0.35 });
      await wait(B, 0.5);
    } },
    spin: { range: 5, cd: 9, weight: 3, async run(B) {
      act(B, 'spin', 0.9);
      await strike(B, 'circle', { r: 5.5, dur: 0.9, coef: 0.55, knock: 'push', kb: 1.5, fx: 'tail_sweep', fxR: 5.5, fxColor: RIFT, sfx: 'whoosh_big' });
      await strike(B, 'circle', { r: 5.5, dur: 0.5, coef: 0.55, knock: 'push', kb: 1.5, fx: 'tail_sweep', fxR: 5.5, fxColor: RIFT, sfx: 'whoosh_big' });
      await strike(B, 'circle', { r: 6, dur: 0.5, color: 'orange', coef: 0.8, knock: 'down', fx: 'shockwave', fxR: 6, fxColor: RIFT, sfx: 'slash_heavy', shake: 0.3 });
      await wait(B, 0.5);
    } },
    swing: { range: 4, cd: 4, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'bash', 0.7);
      await strike(B, 'cone', { r: 5, deg: 130, dur: 0.7, coef: 0.8, fx: 'slash_heavy', fxR: 4.5, fxColor: RIFT, sfx: 'slash_heavy' });
      await wait(B, 0.4);
    } },
    shield_charge: { range: 25, cd: 12, weight: 2, async run(B, t) {
      B.turnTo(t);
      const dir = fwd(B), len = Math.max(6, reachAlong(B, dir, 18));
      act(B, 'bash', 1.1);
      const tg = tele(B, 'rect', { len: len + 1, width: cw(B), dur: 1.1, color: 'orange' });
      await wait(B, 1.1); tg.alive = false;
      await B.charge(len, Math.min(0.7, 0.25 + len / 32) * (B.flags.haste || 1), { coef: 1.0 * (B.mods.hard ? 1.25 : 1), knock: 'down', kb: 4 });
      await wait(B, 0.5);
    } },
    slam: { range: 6, cd: 10, weight: 2, async run(B) {
      act(B, 'bash', 1.1);
      await strike(B, 'circle', { r: 6, dur: 1.1, color: 'orange', coef: 1.0, knock: 'up', fx: 'crater', fxR: 6, fxColor: RIFT, sfx: 'impact_heavy', shake: 0.4 });
      if (B.phase >= 1) pool(B, { x: B.u.pos.x, z: B.u.pos.z, r: 3.5, dur: 6, tick: 0.5, coef: 0.12, kind: 'void' });
      await wait(B, 0.5);
    } },
    guard_back: { range: 8, cd: 6, weight: 3, when: B => behind(B, 5).length > 0, async run(B) {
      act(B, 'spin', 0.6);
      await strike(B, 'cone', { dir: back(B), r: 5.5, deg: 160, dur: 0.6, coef: 0.8, knock: 'push', kb: 3, fx: 'tail_sweep', fxR: 5, fxColor: RIFT, sfx: 'whoosh_big' });
      await wait(B, 0.4);
    } },
    summon: { range: 99, cd: 28, weight: 1.5, when: B => B.fightT > 15, async run(B) {
      act(B, 'summon', 1.6);
      B.banner('The Gatekeeper calls the Gate’s spawn!', 'warn');
      await wait(B, 1.6);
      adds(B, 'legionnaire', B.phase >= 1 ? 3 : 2, { name: 'Gate Legionnaire', r: 7 });
      adds(B, 'imp', 3, { name: 'Gate Imp', r: 7 });
      fx(B, 'dark_burst', B.u.pos.x, B.u.pos.z, { r: 5, color: RIFT });
      await wait(B, 0.5);
    } },
  },
  mechanics: [
    { id: 'gate', at: 0.5, async run(B) {
      act(B, 'summon', 1.6);
      B.banner('The Chaos Gate tears open behind the Warden!', 'warn');
      await wait(B, 1.6);
      B.phase = 1; B.flags.haste = 0.9;
      for (let i = 0; i < 4; i++) { const p = onNav(B, { x: B.u.pos.x + rnd(B, -12, 12), z: B.u.pos.z + rnd(B, -12, 12) }); pool(B, { x: p.x, z: p.z, r: 2.8, dur: 14, tick: 0.5, coef: 0.12, kind: 'void' }); }
      await wait(B, 0.5);
    } },
  ],
  onStart: standardStart,
  onBossDeath(enc, unit) { clearAdds(unit.ctrl); },
};
