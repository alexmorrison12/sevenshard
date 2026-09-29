// Wire formats for co-op: unit spawn records, compact snapshot rows, hit specs, and quantisation helpers.
const q1 = v => Math.round(v * 10) / 10, q2 = v => Math.round(v * 100) / 100;
export { q1, q2 };

/** Everything a remote browser needs to build and label a unit. */
export function spawnRec(u) {
  const d = u.data;
  return {
    id: u.id, k: u.kind, n: u.name, t: u.type, c: u.cls, tm: u.team, x: q1(u.pos.x), z: q1(u.pos.z), f: q2(u.facing),
    hp: Math.round(u.hp), hm: u.hpMax, r: q2(u.radius), h: q2(u.height), atk: Math.round(u.st.atk), lv: u.lv,
    sx: d.sex, lk: d.look, gr: d.gear, wp: d.weapon, npc: d.npc, el: d.elite ? 1 : 0, sc: d.scale, mo: d.modelOpts, ti: d.title, tpl: d.tpl?.model,
    bars: d.bars, bh: d.barHp, def: d.def ? { id: d.def.id, name: d.def.name, title: d.def.title } : undefined, var: d.variant, lod: d.lod,
    sim: d.sim ? 1 : 0, own: d.owner || undefined, nd: d.npcDef?.id,
  };
}

// snapshot flags
export const F = { dead: 1, down: 2, stun: 4, groggy: 8, fly: 16, burrow: 32, ghost: 64, enraged: 128, untarget: 256, counter: 512, skill: 1024 };
export function flagsOf(u) {
  const d = u.data;
  return (u.dead ? F.dead : 0) | (u.cc.down > 0 || u.air.launched ? F.down : 0) | (u.cc.stun > 0 || u.cc.freeze > 0 ? F.stun : 0) |
    (d.groggy ? F.groggy : 0) | (d.fly ? F.fly : 0) | (d.burrowed ? F.burrow : 0) | (d.ghost ? F.ghost : 0) | (d.enraged ? F.enraged : 0) |
    (u.untargetable ? F.untarget : 0) | ((d.counterWindow || 0) > 0 ? F.counter : 0) | (u.skill ? F.skill : 0);
}
/** [id, x, z, facing, hp, flags, speed, lift] */
export function row(u) { return [u.id, q1(u.pos.x), q1(u.pos.z), q2(u.facing), Math.round(u.hp), flagsOf(u), q1(u.anim.speed || 0), q1((u.lift || 0) + (u.data.hover || 0) + (u.air.y || 0))]; }

/** strip a hit spec to plain data for the wire */
export function hitRec(h) {
  const o = {};
  for (const k of ['shape', 'r', 'inner', 'angle', 'len', 'width', 'back', 'off', 'coef', 'knock', 'kb', 'knockDur', 'status', 'heavy', 'elem', 'maxTargets', 'team']) if (h[k] !== undefined && h[k] !== null) o[k] = h[k];
  return o;
}
