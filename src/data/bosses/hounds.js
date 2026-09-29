// Shared script pieces for the twin hounds of the Horned Tyrant (legion raid gate 1): Skarn (fire) and Vesk (shadow).
//  • Twin Howl — when either hound drops to 55%, BOTH leap to the middle and howl as one: a single stagger bar shared by
//    the pair (damage to either hound depletes it). If it holds, both howls tear through the kennels (near-wipe).
//  • Crossfire — at 75% (and again later) the hounds take opposite edges and breathe across the arena: a burning line
//    and a void line cross; stand in a quadrant.
//  • Pack Grief — when one dies the other is enraged (+damage, faster, and a grief howl every 10 s that grows): bring
//    them down close together.
import { fwd, back, tele, wait, strike, smash, act, counter, pool, buff, reachAlong, center, onNav, behind, partners,
  command, scaleHp, sfx, fx } from './kit.js';

export const TWIN_HOWL = 575;   // shared Twin Howl stagger = 2 × this (8 raiders deal ~1100–1600 in 8.5 s)
export const cw = B => 2 * (B.u.radius + 0.6);
export const other = B => partners(B).find(u => !u.dead) || null;
const side = B => (B.def.id === 'skarn' ? -1 : 1);

// ---------------------------------------------------------------- moves both hounds share
export const shared = {
  bite: { range: 3.5, cd: 3.5, weight: 3, async run(B, t) {
    B.turnTo(t); act(B, 'bite', 0.65);
    await strike(B, 'cone', { r: 5, deg: 70, dur: 0.65, coef: 0.8, fx: 'bite', fxR: 3, sfx: 'bite' });
    await wait(B, 0.4);
  } },
  claw: { range: 4, cd: 5, weight: 2, async run(B, t) {
    B.turnTo(t); act(B, 'claw_swipe', 0.72);
    await strike(B, 'cone', { r: 5.5, deg: 150, dur: 0.72, coef: 0.9, knock: 'push', kb: 2.5, fx: 'abyss_claw', fxR: 5, fxColor: B.def.element, sfx: 'slash_heavy' });
    await wait(B, 0.4);
  } },
  tail_whip: { range: 8, cd: 6, weight: 4, when: B => behind(B, 6.5).length > 0, async run(B) {
    act(B, 'tail_whip', 0.78);
    const u = B.u, bk = back(B);
    await strike(B, 'cone', { dir: bk, r: 6.5, deg: 150, dur: 0.78, coef: 0.9, knock: 'down', kb: 3, fx: 'tail_sweep', fxR: 6.5, fxColor: B.def.element, sfx: 'whoosh_big', shake: 0.2 });
    if (B.def.id === 'vesk' && !B.flags.partBroken) pool(B, { x: u.pos.x + bk.x * 4, z: u.pos.z + bk.z * 4, r: 2.4, dur: 6, tick: 0.5, coef: 0.12, kind: 'void', status: [{ id: 'slow', dur: 1.5 }] });
    await wait(B, 0.4);
  } },
  spin: { range: 5, cd: 12, weight: 1.5, async run(B) {
    act(B, 'spin_attack', 0.85);
    await strike(B, 'circle', { r: 6, dur: 0.85, coef: 0.6, knock: 'push', kb: 2, fx: 'tail_sweep', fxR: 6, fxColor: B.def.element, sfx: 'whoosh_big' });
    await strike(B, 'circle', { r: 6.5, dur: 0.35, color: 'orange', coef: 0.8, knock: 'down', fx: 'shockwave', fxR: 6.5, fxColor: B.def.element, shake: 0.25 });
    await wait(B, 0.5);
  } },
  // combined: both hounds take opposite edges and breathe across the arena
  crossfire: { range: 99, cd: 80, weight: 8, minPhase: 1, when: B => B.fightT > 110 && !B.flags.grief, async run(B) { await crossfire(B); } },
};

export async function charge(B, tgt, teleDur, o = {}) {
  if (!tgt) return;
  B.turnTo(tgt);
  const dir = fwd(B), len = Math.max(6, reachAlong(B, dir, o.max ?? 20)), runT = Math.min(0.8, 0.3 + len / 32);
  const x0 = B.u.pos.x, z0 = B.u.pos.z;
  act(B, 'charge', teleDur);
  const tg = tele(B, 'rect', { len: len + 1.5, width: cw(B), dur: teleDur, color: 'orange' });
  await wait(B, teleDur); tg.alive = false;
  sfx(B, 'charge_roar'); fx(B, 'charge_dust', x0, z0, { follow: true, dur: runT + 0.3, color: B.def.element });
  await B.charge(len, runT * (B.flags.haste || 1), { coef: (o.coef ?? 1.1) * (B.mods.hard ? 1.25 : 1), knock: 'down', kb: 4 });
  if (o.trail) for (let d = 3; d < len; d += 4) pool(B, { x: x0 + dir.x * d, z: z0 + dir.z * d, r: 1.7, dur: 5, tick: 0.5, coef: 0.14, kind: o.trail, status: o.trailStatus });
}

// ---------------------------------------------------------------- Crossfire
async function crossLine(B, lead) {
  const c = center(B), u = B.u;
  // Skarn takes the west edge and breathes east; Vesk the north edge and breathes south (a cross)
  const west = B.def.id === 'skarn';
  const spot = onNav(B, west ? { x: c.x - 19, z: c.z } : { x: c.x, z: c.z - 19 }, u.radius);
  act(B, 'pounce', 0.9);
  await B.leap(spot.x, spot.z, 0.9 * (B.flags.haste || 1), 5);
  B.lookAt(c.x, c.z);
  if (lead) B.banner('CROSSFIRE — the hounds breathe across the kennels! Find a corner.', 'mechanic');
  act(B, 'breath', 2.0);
  const dir = fwd(B), len = reachAlong(B, dir, 44, u.pos, 0.2) + 3;
  await strike(B, 'rect', { len, width: 7, dur: 2.0, color: 'orange', coef: 3.0, knock: 'down', kb: 3,
    fx: west ? 'fire_breath' : 'dark_breath', fxLen: len, sfx: west ? 'fire_whoosh' : 'void_whoosh', shake: 0.4,
    status: west ? [{ id: 'def_down', dur: 6 }] : [{ id: 'weaken', dur: 6 }] });
  await wait(B, 0.8);
}
export async function crossfire(B) {
  const o = other(B);
  if (o && !o.data.groggy) { o.ctrl.cds.set('crossfire', o.ctrl.fightT + 80); command(o, B2 => crossLine(B2, false), 0.8); }
  await crossLine(B, true);
}

// ---------------------------------------------------------------- Twin Howl (one stagger bar shared by both hounds)
async function howl(B, lead, shared) {
  const c = center(B), u = B.u, L = B.level;
  B.flags.inMech = true; u.data.hpFloor = 0;
  const dur = 8.5;
  let tg = null;
  try {
    const spot = onNav(B, { x: c.x + side(B) * 3.5, z: c.z - 2 }, u.radius);
    act(B, 'pounce', 0.9);
    await B.leap(spot.x, spot.z, 0.9 * (B.flags.haste || 1), 5);
    B.lookAt(c.x + side(B) * 10, c.z + 6);
    B.anim('howl', dur);
    tg = B.tele('circle', { r: 5, dur, color: 'purple', follow: u, safe: true });
    const fail = async () => {
      tg.alive = false;
      act(B, 'howl', 0.6); await wait(B, 0.6);
      smash(B, 'all', { coef: 3.0, knock: 'down', fx: 'fear_howl', fxR: 16, fxColor: B.def.element, sfx: 'boss_roar', shake: 0.7 });
      B.banner(`${u.name}'s howl tears through the kennels!`, 'fail');
      await wait(B, 1.2);
    };
    if (lead) {
      if (shared.o) B.banner('TWIN HOWL — the hounds howl as one: stagger them together (one shared bar)!', 'stagger');
      await B.staggerCheck(shared.amount, dur, { groggy: 5, label: 'Twin Howl', onFail: fail });
    } else {
      // mirror the lead's stagger bar: damage to either hound depletes the same pool
      const t0 = L.time;
      while (!shared.sg && L.time - t0 < 1) await wait(B, 0.05);
      const sg = shared.sg; if (sg) u.data.stagger = sg;
      while (sg && !sg.broken && L.time - t0 < dur && !shared.lead.dead) await B.wait(0.1);
      u.data.stagger = null;
      if (sg?.broken) { B.interrupt(5); return; }
      await fail();
    }
  } finally { if (tg) tg.alive = false; B.flags.inMech = false; u.data.hpFloor = 0; }
}
export async function twinHowl(B) {
  const o = other(B);
  const shared = { o, lead: B.u, amount: Math.round(TWIN_HOWL * (o ? 2 : 1)), sg: null };
  if (o) { o.ctrl.mechDone.add('twin_howl'); o.data.hpFloor = 0; command(o, B2 => howl(B2, false, shared), 0.8); }
  // publish the lead's stagger object as soon as staggerCheck creates it
  const L = B.level, tm = L.every(0.05, () => { if (B.u.data.stagger) { shared.sg = B.u.data.stagger; L.cancelTimer(tm); } else if (B.u.dead) L.cancelTimer(tm); });
  try { await howl(B, true, shared); } finally { L.cancelTimer(tm); }
}

// ---------------------------------------------------------------- Pack Grief (survivor enrage) and hard-mode HP
export function onStart(enc) {
  if (enc.o.hard) for (const b of enc.bosses) scaleHp(b, 1.2);
  // both hounds stop at 55% until their shared howl has started
  for (const b of enc.bosses) b.data.hpFloor = b.hpMax * 0.55;
}
export function onBossDeath(enc, unit) {
  const sur = enc.bosses.find(b => b !== unit && !b.dead); if (!sur) return;
  const B = sur.ctrl, L = sur.level;
  B.flags.grief = true;
  B.banner(`${sur.name} howls over its fallen twin — it is enraged! Finish it quickly!`, 'warn');
  buff(B, 'pack_grief', 1e6, { dmgMul: 0.4 }, 'Pack Grief');
  B.flags.haste = 0.8; sur.st.speed *= 1.25; sur._statDirty = true;
  sur.data.enraged = true; sur.model?.setGlow?.('enrage', 1);
  let n = 0;
  const tm = L.every(10, () => {
    if (sur.dead) { L.cancelTimer(tm); return; }
    n++;
    smash(B, 'all', { id: 'grief_howl', coef: 0.3 + 0.25 * n, fx: 'fear_howl', fxR: 14, fxColor: B.def.element, sfx: 'boss_roar', shake: 0.35 });
    if (n % 2 === 1) B.banner(`${sur.name}'s grief grows (${n})…`, 'warn');
  });
}
// the part each hound can lose: Skarn's flame mane (no more fire trails), Vesk's scythe tail (no more void rifts)
export function partMech(part, text) {
  return { id: 'part', at: 0.97, async run(B) {
    B.destruction(part, Math.round(1000 * (B.mods.hard ? 1.2 : 1)), () => {
      B.flags.partBroken = true; B.banner(text, 'good');
      if (!B.flags.inMech) B.interrupt(3);
    });
  } };
}
export const HOUND_ANIMS = {
  bite: { dur: 1.3, hits: [0.62] }, claw_swipe: { dur: 1.4, hits: [0.72] }, pounce: { dur: 2.2, hits: [1.25] },
  breath: { dur: 3.4, hits: [1.1, 1.6, 2.1, 2.6] }, howl: { dur: 2.6, hits: [1.0] }, tail_whip: { dur: 1.5, hits: [0.78] },
  spin_attack: { dur: 2.0, hits: [0.85, 1.2] }, charge: { dur: 3.0, hits: [1.1] },
};
export { counter };
