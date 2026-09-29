// FIELD BOSS — Old Thunderhoof, the Storm Stag of the Goldmeadow plains (hourly world event; many players). Antler
// gores, a rearing stomp that throws a lightning ring, stampede charges (orange lines), lightning called down under
// the crowd, and a thunder ring you dodge by stepping in close. Break his antlers to stop the storm calls; at half
// health the sky joins in (random strikes), and at 25% he calls the Thunderhead — stagger him or the storm breaks.
import { fwd, back, rnd, tele, wait, strike, smash, volley, act, counter, onNav, behind, farthest, reachAlong,
  someHeroes, scaleHp, fx, sfx, standardStart } from './kit.js';

const ZAP = 'lightning';
const cw = B => 2 * (B.u.radius + 0.6);

export default {
  id: 'thunderhoof', model: 'thunderhoof', name: 'Old Thunderhoof', title: 'the Storm Stag', kind: 'field',
  radius: 2.6, height: 5.2, hp: 34000, atk: 0.12, bars: 150, speed: 6.2, turnRate: 3.6, enrage: 720,
  music: 'boss', arena: 'crucible',
  anims: {
    gore: { dur: 1.5, hits: [0.75] }, rear: { dur: 2.2, hits: [1.2] }, charge: { dur: 2.6, hits: [1.1] },
    call_lightning: { dur: 2.4, hits: [1.3] }, roar: { dur: 2.4, hits: [1.0] },
  },
  moves: {
    gore: { range: 4.5, cd: 4, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'gore', 0.7);
      await strike(B, 'cone', { r: 6, deg: 90, dur: 0.7, coef: 0.9, knock: 'push', kb: 3, fx: 'slash_heavy', fxR: 5, fxColor: ZAP, sfx: 'impact_heavy' });
      await wait(B, 0.45);
    } },
    kick: { range: 8, cd: 6, weight: 4, when: B => behind(B, 6).length > 0, async run(B) {
      act(B, 'gore', 0.65);
      await strike(B, 'cone', { dir: back(B), r: 6, deg: 120, dur: 0.65, coef: 0.9, knock: 'down', kb: 4, fx: 'dust_burst', fxR: 4, sfx: 'impact_heavy' });
      await wait(B, 0.4);
    } },
    // COUNTER: he rears up, crackling blue, before the stomp
    rear: { range: 7, cd: 12, weight: 2.5, async run(B) {
      act(B, 'rear', 1.2);
      counter(B, 0.95, 4);
      await strike(B, 'circle', { r: 6.5, dur: 1.2, color: 'orange', coef: 1.1, knock: 'up', fx: 'lightning_burst', fxR: 6, sfx: 'thunder', shake: 0.5 });
      await strike(B, 'donut', { r: 11, inner: 6.5, dur: 0.55, color: 'orange', coef: 0.6, status: [{ id: 'slow', dur: 2 }], fx: 'shockwave', fxR: 11, fxColor: ZAP });
      await wait(B, 0.5);
    } },
    stampede: { range: 35, cd: 13, weight: 2.5, recover: 1.0, async run(B, t) {
      const n = B.phase >= 1 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const tgt = i === 0 ? t : B.randomHero(); if (!tgt) break;
        B.turnTo(tgt);
        const dir = fwd(B), len = Math.max(6, reachAlong(B, dir, 22)), td = i ? 0.9 : 1.2;
        act(B, 'charge', td);
        const tg = tele(B, 'rect', { len: len + 1.5, width: cw(B), dur: td, color: 'orange' });
        await wait(B, td); tg.alive = false;
        fx(B, 'charge_dust', B.u.pos.x, B.u.pos.z, { follow: true, dur: 0.9 });
        await B.charge(len, Math.min(0.8, 0.3 + len / 32) * (B.flags.haste || 1), { coef: 1.1 * (B.mods.hard ? 1.25 : 1), knock: 'down', kb: 4 });
        await wait(B, 0.25);
      }
      await wait(B, 0.5);
    } },
    call_lightning: { range: 40, cd: 12, weight: 2.5, when: B => !B.flags.antlersBroken || B.phase >= 1, async run(B) {
      act(B, 'call_lightning', 1.3);
      const pts = someHeroes(B, 6).map(h => ({ x: h.pos.x, z: h.pos.z }));
      for (let i = 0; i < 4; i++) pts.push(onNav(B, { x: B.u.pos.x + rnd(B, -14, 14), z: B.u.pos.z + rnd(B, -14, 14) }));
      await volley(B, pts.map(p => ['circle', { x: p.x, z: p.z, r: 3 }]), 1.4, { coef: 0.9, color: 'orange', status: [{ id: 'stun', dur: 0.8, chance: 0.3 }], fx: 'lightning_strike', fxR: 2.5, fxMax: 8, sfx: 'thunder', shake: 0.3 });
      await wait(B, 0.5);
    } },
    thunder_ring: { range: 12, cd: 16, weight: 2, async run(B) {
      act(B, 'rear', 1.3);
      B.banner('Old Thunderhoof gathers the storm around him — get close!', 'warn');
      await strike(B, 'donut', { r: 16, inner: 5, dur: 1.5, color: 'orange', coef: 1.3, knock: 'push', kb: 4, fx: 'lightning_burst', fxR: 14, sfx: 'thunder', shake: 0.5 });
      await wait(B, 0.5);
    } },
  },
  mechanics: [
    { id: 'antlers', at: 0.85, async run(B) {
      B.destruction('antlers', Math.round(800 * (B.mods.hard ? 1.2 : 1)), () => { B.flags.antlersBroken = true; B.banner('His storm-antlers crack — the sky falls quiet (until he grows desperate)!', 'good'); B.interrupt(4); });
      B.banner('His storm-antlers can be broken (weak point / destruction bombs).', 'info');
    } },
    { id: 'storm', at: 0.5, async run(B) {
      const u = B.u, L = B.level;
      act(B, 'roar', 1.0);
      B.banner('The storm answers Old Thunderhoof!', 'warn');
      await wait(B, 1.0);
      B.phase = 1; B.flags.haste = 0.92;
      // random strikes around the herd every few seconds for the rest of the fight
      const tm = L.every(6, () => {
        if (u.dead) { L.cancelTimer(tm); return; }
        for (const h of someHeroes(B, 2)) {
          const p = { x: h.pos.x + rnd(B, -2, 2), z: h.pos.z + rnd(B, -2, 2) };
          const tg = B.tele('circle', { x: p.x, z: p.z, r: 2.6, dur: 1.2, color: 'orange' });
          L.after(1.2, () => { tg.alive = false; if (!u.dead) smash(B, 'circle', { id: 'storm', x: p.x, z: p.z, r: 2.6, coef: 0.7, fx: 'lightning_bolt', fxR: 2, sfx: 'thunder' }); });
        }
      });
    } },
    { id: 'thunderhead', at: 0.25, async run(B) {
      const u = B.u, dur = 7.5;
      B.flags.inMech = true;
      act(B, 'call_lightning', 1.3);
      B.banner('THUNDERHEAD — stagger Old Thunderhoof before the storm breaks!', 'stagger');
      const tg = B.tele('circle', { r: 40, dur, color: 'purple', follow: u, safe: true });
      try {
        await B.staggerCheck(Math.round(110 * Math.max(1, B.heroes().length) * (B.mods.hard ? 1.08 : 1)), dur, { groggy: 6, label: 'Thunderhead', onFail: async () => {
          tg.alive = false;
          smash(B, 'all', { coef: 3.0, knock: 'down', status: [{ id: 'stun', dur: 1.2 }], fx: 'lightning_strike', fxR: 14, sfx: 'thunder', shake: 0.9 });
          B.banner('The storm breaks over the plains!', 'fail');
          await wait(B, 1.4);
        } });
      } finally { tg.alive = false; B.flags.inMech = false; B.flags.haste = 0.85; }
    } },
  ],
  onStart: standardStart,
};
