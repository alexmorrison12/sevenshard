// ABYSSAL DUNGEON gate 1 — Nerissa of the Drowned Choir (siren, 4 players). Tail slaps front and back, three-voice
// scream cones (silence), drowning bubbles that track a raider then burst (bubble prison), dives that surface under a
// raider, and the Drowned Choir: a song channel that must be staggered — it draws the party in, and if it completes,
// everyone is lulled to sleep before the tide crashes down. Her coral crown is breakable: it weakens the song
// (smaller stagger bar).
//  90% crown · 70% FIRST VERSE (song stagger) · 50% riptide (dives chain) · 30% FINAL VERSE (song, bigger)
import { DEG, rot, fwd, back, rnd, tele, wait, strike, smash, volley, act, counter, pool, onNav, behind, farthest,
  someHeroes, center, scaleHp, fx, sfx, partyK } from './kit.js';

const SEA = 'water';

async function song(B, verse) {
  const u = B.u, c = center(B), dur = verse === 2 ? 9 : 8;
  B.flags.inMech = true;
  let tg = null, pull = null;
  try {
    act(B, 'dive', 0.9); u.untargetable = true;
    await wait(B, 0.9);
    const p = onNav(B, { x: c.x, z: c.z - 4 }, u.radius); u.pos.x = p.x; u.pos.z = p.z;
    u.untargetable = false;
    fx(B, 'tentacle_slam', p.x, p.z, { r: 3.5 });
    B.banner(verse === 2 ? 'THE FINAL VERSE — stagger Nerissa before the song ends!' : 'THE DROWNED CHOIR SINGS — stagger Nerissa before the song ends!', 'stagger');
    B.anim('sing', dur);
    fx(B, 'music_buff_ring', u.pos.x, u.pos.z, { r: 8, color: SEA });
    tg = B.tele('circle', { r: 11, dur, color: 'purple', follow: u, safe: true });
    // the song draws everyone toward her
    pull = B.level.every(1.4, () => { if (!u.dead && u.data.stagger) smash(B, 'all', { coef: 0.04, knock: 'pull', kb: 1.2 }); });
    const amount = Math.round((verse === 2 ? 520 : 470) * partyK(B) * (B.flags.crownBroken ? 0.8 : 1) * (B.mods.hard ? 1.08 : 1));
    await B.staggerCheck(amount, dur, { groggy: 5.5, label: verse === 2 ? 'Final Verse' : 'Drowned Choir', onFail: async () => {
      tg.alive = false;
      B.banner('The song ends… the party is lulled into the deep.', 'fail');
      smash(B, 'all', { coef: 0.3, status: [{ id: 'sleep', dur: 2.5 }], fx: 'siren_scream', fxR: 14, sfx: 'ghost_wail' });
      await wait(B, 1.6);
      smash(B, 'circle', { r: 11, coef: verse === 2 ? 3.6 : 3.0, knock: 'up', fx: 'tentacle_slam', fxR: 8, sfx: 'wave_splash', shake: 0.8 });
      smash(B, 'donut', { r: 40, inner: 11, coef: 1.2, knock: 'push', kb: 4 });
      await wait(B, 1.2);
    } });
  } finally { if (tg) tg.alive = false; if (pull) B.level.cancelTimer(pull); u.untargetable = false; B.flags.inMech = false; }
}

async function surface(B, prey, telDur) {
  const u = B.u;
  if (!prey) return;
  const p = onNav(B, prey.pos, u.radius);
  await strike(B, 'circle', { x: p.x, z: p.z, r: 4.5, dur: telDur, color: 'orange', coef: 1.2, knock: 'up', fx: 'tentacle_slam', fxR: 4.5, sfx: 'wave_splash', shake: 0.4 });
  u.pos.x = p.x; u.pos.z = p.z;
  await strike(B, 'donut', { r: 9, inner: 4.5, dur: 0.6, color: 'orange', coef: 0.5, knock: 'push', kb: 3, fx: 'shockwave', fxR: 9, fxColor: SEA });
}

export default {
  id: 'nerissa', model: 'nerissa', name: 'Nerissa', title: 'of the Drowned Choir', kind: 'abyss',
  radius: 2, height: 5.6, hp: 48000, atk: 0.16, bars: 160, speed: 4.4, turnRate: 3.6, enrage: 600,
  music: 'boss', arena: 'frostmere',
  anims: {
    sing: { dur: 2.4, hits: [1.2], loop: true }, tail_slap: { dur: 2.0, hits: [1.05] }, water_orb: { dur: 2.2, hits: [1.25] },
    dive: { dur: 3.4, hits: [2.45] }, scream: { dur: 2.6, hits: [0.95, 1.35, 1.75] },
  },
  moves: {
    tail_slap: { range: 5, cd: 4.5, weight: 3, async run(B, t) {
      B.turnTo(t); act(B, 'tail_slap', 0.75);
      await strike(B, 'cone', { r: 6.5, deg: 150, dur: 0.75, coef: 0.9, knock: 'push', kb: 3, fx: 'tail_sweep', fxR: 6, fxColor: SEA, sfx: 'wave_splash' });
      await wait(B, 0.45);
    } },
    back_slap: { range: 9, cd: 6, weight: 4, when: B => behind(B, 7).length > 0, async run(B) {
      act(B, 'tail_slap', 0.8);
      await strike(B, 'cone', { dir: back(B), r: 7, deg: 160, dur: 0.8, coef: 0.9, knock: 'down', fx: 'tail_sweep', fxR: 7, fxColor: SEA, sfx: 'wave_splash', shake: 0.2 });
      await wait(B, 0.45);
    } },
    // three voices: cones fanned across the target, one after another (silence)
    scream: { range: 13, cd: 11, weight: 2.5, async run(B, t) {
      B.turnTo(t); act(B, 'scream', 0.95);
      const f = fwd(B), sd = B.level.rng() < 0.5 ? 1 : -1, dirs = [-40, 0, 40].map(a => rot(f, sd * a * DEG));
      const tgs = dirs.map((d, i) => tele(B, 'cone', { dir: d, r: 13, deg: 38, dur: 0.95 + i * 0.4, color: 'orange' }));
      for (let i = 0; i < 3; i++) {
        await wait(B, i ? 0.4 : 0.95); tgs[i].alive = false;
        smash(B, 'cone', { dir: dirs[i], r: 13, deg: 38, coef: 0.8, status: [{ id: 'silence', dur: 2 }], fx: 'siren_scream', fxR: 13, sfx: 'ghost_wail' });
      }
      await wait(B, 0.5);
    } },
    // drowning bubbles track a raider, then lock and burst (a trapped raider is stunned in the bubble)
    bubbles: { range: 30, cd: 12, weight: 2.5, async run(B) {
      act(B, 'water_orb', 1.25);
      const prey = someHeroes(B, B.phase >= 1 ? 3 : 2);
      const trk = prey.map(h => B.tele('circle', { r: 2.2, dur: 1.3, color: 'yellow', follow: h, safe: true }));
      for (const h of prey) fx(B, 'water_orb', B.u.pos.x, B.u.pos.z, { dir: { x: h.pos.x - B.u.pos.x, z: h.pos.z - B.u.pos.z } });
      await wait(B, 1.3);
      trk.forEach(t => t.alive = false);
      const pts = prey.map(h => ({ x: h.pos.x, z: h.pos.z }));
      await volley(B, pts.map(p => ['circle', { x: p.x, z: p.z, r: 2.8 }]), 0.9, { coef: 0.7, color: 'orange', status: [{ id: 'stun', dur: 1.4 }], fx: 'tentacle_slam', fxR: 2.5, sfx: 'wave_splash' });
      for (const p of pts) pool(B, { x: p.x, z: p.z, r: 2.4, dur: 5, tick: 0.5, coef: 0.06, kind: 'water', status: [{ id: 'slow', dur: 1 }] });
      await wait(B, 0.4);
    } },
    dive: { range: 99, cd: 17, weight: 2, recover: 1.0, async run(B, t) {
      const u = B.u;
      act(B, 'dive', 0.9);
      await wait(B, 0.9);
      u.untargetable = true;
      try {
        const n = B.phase >= 1 ? 2 : 1;
        for (let i = 0; i < n; i++) { await surface(B, i ? B.randomHero() : (B.level.rng() < 0.5 ? farthest(B) : t), i ? 1.1 : 1.4); u.untargetable = i < n - 1; }
      } finally { u.untargetable = false; }
      await wait(B, 0.6);
    } },
    // COUNTER: she draws a breath for a piercing high note (blue), then a long scream line
    high_note: { range: 14, cd: 15, weight: 2, async run(B, t) {
      B.turnTo(t); act(B, 'scream', 1.4);
      counter(B, 1.1, 4.5);
      await strike(B, 'rect', { len: 18, width: 4, dur: 1.4, coef: 1.3, knock: 'down', status: [{ id: 'silence', dur: 2.5 }], fx: 'siren_scream', fxR: 18, sfx: 'ghost_wail', shake: 0.3 });
      await wait(B, 0.5);
    } },
  },
  mechanics: [
    { id: 'crown', at: 0.9, async run(B) {
      B.destruction('crown', Math.round(1000 * (B.mods.hard ? 1.2 : 1)), () => { B.flags.crownBroken = true; B.banner('Her coral crown shatters — the choir falters (her songs are easier to break)!', 'good'); B.interrupt(3); });
      B.banner('Her coral crown can be broken (weak point / destruction bombs).', 'info');
    } },
    { id: 'verse1', at: 0.7, async run(B) { await song(B, 1); } },
    { id: 'riptide', at: 0.5, async run(B) {
      B.phase = 1; B.flags.haste = 0.92;
      B.banner('Riptide — Nerissa hunts from beneath the surface!', 'warn');
      act(B, 'scream', 0.95); await wait(B, 1.0);
    } },
    { id: 'verse2', at: 0.3, async run(B) { await song(B, 2); } },
  ],
  onStart(enc) { if (enc.o.hard) for (const b of enc.bosses) scaleHp(b, 1.2); },
};
