// Story boss definitions used when the encounters owner hasn't provided one in src/data/bosses/ (BOSS_DEFS wins).
//   varkhul — Varkhul the Ravager, the MSQ rematch at the Ashen Ridge fortress (solo story fight, ~80–100 s)
//   ashmaw  — the siege behemoth of the prologue (the set piece itself is scripted in src/game/modes/prologue.js)
// Same shape as src/game/ai/BOSSES.md; `storyHp` is the target HP in × attack power for a solo story fight.
import { fwd, rnd, tele, wait, strike, smash, volley, act, counter, onNav, behind, fx, standardStart, partyK, adds } from './bosses/kit.js';

export const STORY_BOSSES = {
  varkhul: {
    id: 'varkhul', model: 'varkhul', name: 'Varkhul', title: 'the Ravager', kind: 'field',
    radius: 1.3, height: 3.5, hp: 36000, storyHp: 2600, atk: 0.1, bars: 40, speed: 4.2, turnRate: 4.5, enrage: 300, music: 'boss',
    anims: {
      slash_combo: { dur: 2.6, hits: [0.55, 1.15, 1.9] }, overhead: { dur: 2.2, hits: [1.2] }, fire_wave: { dur: 2.6, hits: [1.35] },
      leap: { dur: 2.6, hits: [1.6] }, summon: { dur: 3.0, hits: [1.8] }, roar: { dur: 2.4, hits: [0.9] },
    },
    moves: {
      combo: { range: 4, cd: 4, weight: 4, async run(B, t) {
        B.turnTo(t); act(B, 'slash_combo', 0.55);
        await strike(B, 'cone', { r: 4.6, deg: 120, dur: 0.55, coef: 0.55, fx: 'slash_heavy', fxColor: 'fire', sfx: 'slash_heavy' });
        B.turnTo(t); await strike(B, 'cone', { r: 4.6, deg: 120, dur: 0.6, coef: 0.55, fx: 'slash_heavy', fxColor: 'fire', sfx: 'slash_heavy' });
        B.turnTo(t); await strike(B, 'cone', { r: 5.2, deg: 150, dur: 0.75, coef: 0.8, knock: 'down', color: 'orange', fx: 'slash_heavy', fxColor: 'fire', sfx: 'slash_heavy', shake: 0.25 });
        await wait(B, 0.6);
      } },
      // COUNTER: the overhead wind-up glows blue
      overhead: { range: 6, cd: 10, weight: 3, async run(B, t) {
        B.turnTo(t); act(B, 'overhead', 1.2);
        counter(B, 0.9, 4);
        B.banner('Varkhul raises the burning blade…', 'warn');
        await strike(B, 'rect', { len: 8, width: 3.2, dur: 1.2, coef: 1.4, knock: 'down', color: 'orange', fx: 'ground_crack', fxLen: 8, fxColor: 'fire', sfx: 'explosion', shake: 0.45, heavy: true });
        await wait(B, 0.7);
      } },
      fire_wave: { range: 12, cd: 9, weight: 2.5, async run(B, t) {
        B.turnTo(t); act(B, 'fire_wave', 1.35);
        await strike(B, 'rect', { len: 15, width: 4, dur: 1.35, coef: 0.9, color: 'orange', status: [{ id: 'burn', dur: 4, power: 0.3 }], fx: 'crimson_wave', fxLen: 15, fxColor: 'fire', sfx: 'fire_big', shake: 0.3 });
        await wait(B, 0.6);
      } },
      leap: { range: 18, minRange: 5, cd: 11, weight: 2.5, async run(B, t) {
        B.turnTo(t); act(B, 'leap', 1.6);
        const p = onNav(B, { x: t.pos.x, z: t.pos.z }, B.u.radius);
        const tg = tele(B, 'circle', { x: p.x, z: p.z, r: 4.5, dur: 1.6, color: 'orange' });
        await wait(B, 0.6);
        await B.leap(p.x, p.z, 0.9, 4.5);
        tg.alive = false;
        smash(B, 'circle', { x: p.x, z: p.z, r: 4.6, coef: 1.1, knock: 'up', fx: 'crater', fxColor: 'fire', fxR: 4.6, sfx: 'explosion_big', shake: 0.5, heavy: true });
        await wait(B, 0.8);
      } },
      summon: { range: 30, cd: 24, weight: 1.5, minPhase: 1, async run(B) {
        act(B, 'summon', 1.8);
        B.banner('Varkhul calls his imps!', 'warn');
        await wait(B, 1.8);
        adds(B, 'imp', 4, { r: 6 });
        await wait(B, 0.6);
      } },
      tail: { range: 6, cd: 7, weight: 3, when: B => behind(B, 6).length > 0, async run(B) {
        act(B, 'slash_combo', 0.55);
        B.u.facing += Math.PI;
        await strike(B, 'circle', { r: 5, dur: 0.7, coef: 0.8, knock: 'push', kb: 3, color: 'orange', fx: 'fire_burst', fxR: 5, sfx: 'whoosh_big', shake: 0.25 });
        await wait(B, 0.5);
      } },
    },
    mechanics: [
      { id: 'hellbrand', at: 0.7, async run(B) {
        act(B, 'roar', 0.9);
        B.banner('HELLBRAND — Varkhul gathers hellfire! Stagger him!', 'stagger');
        const tg = B.tele('circle', { r: 11, dur: 6, color: 'purple', follow: B.u, safe: true });
        try {
          await B.staggerCheck(Math.round(420 * partyK(B)), 6, { groggy: 5, label: 'Hellbrand', onFail: async () => {
            tg.alive = false;
            smash(B, 'circle', { r: 11, coef: 2.2, knock: 'down', status: [{ id: 'burn', dur: 5, power: 0.4 }], fx: 'explosion_big', fxR: 11, sfx: 'explosion_big', shake: 0.8, heavy: true });
            B.banner('The ground erupts in hellfire!', 'fail');
            await wait(B, 1.2);
          } });
        } finally { tg.alive = false; }
      } },
      { id: 'phase2', at: 0.5, async run(B) {
        B.phase = 1; act(B, 'roar', 0.9);
        B.banner('Varkhul’s blade ignites! He fights with burning fury!', 'warn');
        await wait(B, 0.9);
        smash(B, 'circle', { r: 7, coef: 0.4, knock: 'push', kb: 4, fx: 'fire_burst', fxR: 7, sfx: 'boss_roar', shake: 0.5 });
        B.flags.haste = (B.flags.hasteBase || 1) * 0.85;
        B.u.model?.setGlow?.('enrage', 0.6);
        await wait(B, 0.8);
      } },
      { id: 'inferno', at: 0.25, async run(B) {
        act(B, 'fire_wave', 1.35);
        B.banner('INFERNO — fire rains on the courtyard!', 'warn');
        const pts = [];
        for (const h of B.heroes()) pts.push({ x: h.pos.x, z: h.pos.z });
        for (let i = 0; i < 9; i++) pts.push(onNav(B, { x: B.u.pos.x + rnd(B, -12, 12), z: B.u.pos.z + rnd(B, -12, 12) }));
        await volley(B, pts.map(p => ['circle', { x: p.x, z: p.z, r: 3 }]), 1.6, { coef: 0.9, knock: 'down', color: 'orange', fx: 'fire_burst', fxR: 3, sfx: 'explosion', shake: 0.35, fxMax: 10 });
        await wait(B, 0.6);
      } },
    ],
    onStart(enc) { standardStart(enc); },
  },

  // The siege behemoth: stationary, huge. The prologue drives it (cannon phase, wall slams, fire breath); this def
  // only gives it stats and a name for the boss bar when no encounters-owner def exists.
  ashmaw: {
    id: 'ashmaw', model: 'ashmaw', name: 'Ashmaw', title: 'the Siege Behemoth', kind: 'field',
    radius: 6, height: 15, hp: 9000, storyHp: 900, atk: 0.08, bars: 30, speed: 0, turnRate: 1.2, music: 'boss',
    anims: { slam_wall: { dur: 4.2, hits: [2.3] }, roar: { dur: 4.0, hits: [1.4] }, breath: { dur: 5.0, hits: [1.8, 2.6, 3.4] } },
    moves: {},
  },
};
export { fwd, fx };
