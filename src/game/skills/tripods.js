// Tripods: three tiers of skill modifiers (unlocked at skill level 4 / 7 / 10). Generic ones live here; class kits
// add unique ones inline as { id, name, desc, apply(def) }. buildSkill() clones a kit skill and applies the picks.
const pct = v => `${Math.round(v * 100)}%`;

function eachEvent(d, fn) {
  const lists = [d.events, d.end, d.loop?.events, ...(d.stages || []).map(s => s.events)];
  for (const l of lists) if (l) for (const e of l) fn(e);
}
export function eachHit(d, fn) { eachEvent(d, e => { if (e.a === 'hit') fn(e); if (e.a === 'proj' && e.hit) fn(e.hit); if (e.a === 'zone' && e.hit) fn(e.hit); }); }
function lastHit(d) { let h = null; eachEvent(d, e => { if (e.a === 'hit') h = e; }); return h; }

export const GENERIC = {
  quick_prep: { name: 'Quick Prep', v: 0.2, desc: v => `Cooldown −${pct(v)}.`, apply(d, v) { d.cd *= 1 - v; } },
  mobility: { name: 'Excellent Mobility', v: 0.5, desc: v => `Travel distance +${pct(v)}; move while using the skill.`, apply(d, v) { eachEvent(d, e => { if (e.a === 'move' && e.dist) e.dist *= 1 + v; }); if (d.loop?.walk) d.loop.walk *= 1 + v; } },
  weak_point: { name: 'Weak Point Detection', desc: () => 'Weak Point +1.', apply(d) { eachHit(d, h => { h.wp = (h.wp || 0) + 1; }); d.props.wp = (d.props.wp || 0) + 1; } },
  enhanced: { name: 'Enhanced Strike', v: 0.3, desc: v => `Damage +${pct(v)}.`, apply(d, v) { d.mult = (d.mult || 1) * (1 + v); } },
  wide: { name: 'Wide Reach', v: 0.35, desc: v => `Attack area +${pct(v)}.`, apply(d, v) { eachHit(d, h => { if (h.r) h.r *= 1 + v; if (h.len) h.len *= 1 + v; if (h.width) h.width *= 1 + v; }); eachEvent(d, e => { if (e.a === 'fx') e.scale = (e.scale || 1) * (1 + v); if (e.a === 'zone') e.r *= 1 + v; }); } },
  stance: { name: 'Stabilized Stance', desc: () => 'Push Immunity while using the skill.', apply(d) { if (d.superArmor !== 'full') d.superArmor = 'push'; d.props.superArmor = d.superArmor; } },
  unstoppable: { name: 'Unstoppable', desc: () => 'Paralysis Immunity while using the skill.', apply(d) { d.superArmor = 'full'; d.props.superArmor = 'full'; } },
  swift: { name: 'Swift Hands', v: 0.25, desc: v => `Attack Speed +${pct(v)} for this skill.`, apply(d, v) { d.speedBonus = (d.speedBonus || 0) + v; } },
  mana_saver: { name: 'Mana Saver', v: 0.5, desc: v => `Mana cost −${pct(v)}.`, apply(d, v) { d.mp = Math.round(d.mp * (1 - v)); } },
  keen: { name: 'Keen Eye', v: 0.3, desc: v => `Crit Rate +${pct(v)}.`, apply(d, v) { eachHit(d, h => { h.crit = (h.crit || 0) + v; }); } },
  crushing: { name: 'Crushing Force', v: 0.6, desc: v => `Stagger +${pct(v)}.`, apply(d, v) { eachHit(d, h => { if (h.stagger) h.stagger *= 1 + v; }); } },
  bleed: { name: 'Lacerate', desc: () => 'Hits inflict Bleed for 5 s.', apply(d) { eachHit(d, h => { (h.status ||= []).push({ id: 'bleed', dur: 5, power: 1.2 }); }); } },
  burn: { name: 'Searing Heat', desc: () => 'Hits inflict Burn for 6 s.', apply(d) { d.elem = 'fire'; eachHit(d, h => { h.elem = 'fire'; (h.status ||= []).push({ id: 'burn', dur: 6, power: 1.2 }); }); } },
  freeze: { name: 'Frostbite', desc: () => '25% chance to Freeze for 1.5 s.', apply(d) { d.elem = 'ice'; eachHit(d, h => { h.elem = 'ice'; (h.status ||= []).push({ id: 'freeze', dur: 1.5, chance: 0.25 }); }); } },
  shock: { name: 'Static Charge', desc: () => 'Hits inflict Shock (damage + slow).', apply(d) { d.elem = 'lightning'; eachHit(d, h => { h.elem = 'lightning'; (h.status ||= []).push({ id: 'shock', dur: 4, power: 1 }); }); } },
  pull: { name: 'Gravity Pull', desc: () => 'The first hit pulls enemies in.', apply(d) { let done = false; eachHit(d, h => { if (!done) { h.knock = 'pull'; h.kb = 4; done = true; } }); } },
  pierce: { name: 'Piercing Shot', desc: () => 'Projectiles pierce through enemies.', apply(d) { eachEvent(d, e => { if (e.a === 'proj') e.pierce = 99; }); } },
  aftershock: { name: 'Aftershock', v: 0.4, desc: v => `An aftershock bursts where the last hit landed for +${pct(v)} damage.`, apply(d, v) { const h = lastHit(d); if (!h) return; const list = d.stages ? d.stages[d.stages.length - 1].events : d.end?.length ? d.end : d.events; list.push({ ...h, t: h.t + 0.35, coef: h.coef * v, shape: 'circle', r: (h.r || h.len || 3) * 0.9, knock: null }, { t: h.t + 0.35, a: 'fx', preset: 'shockwave', at: h.at, r: (h.r || 3) }); } },
  back: { name: 'Ambush', v: 0.25, desc: v => `Becomes a Back Attack; Back Attack damage +${pct(v)}.`, apply(d, v) { d.props.attack = 'back'; eachHit(d, h => { h.attack = 'back'; }); d.mult = (d.mult || 1) * (1 + v * 0.5); } },
  head: { name: 'Head-On', v: 0.25, desc: v => `Becomes a Head Attack; Head Attack damage +${pct(v)}.`, apply(d, v) { d.props.attack = 'head'; eachHit(d, h => { h.attack = 'head'; }); d.mult = (d.mult || 1) * (1 + v * 0.5); } },
  scorched: { name: 'Scorched Earth', desc: () => 'Leaves a burning zone for 4 s.', apply(d) { const h = lastHit(d); if (!h) return; const list = d.stages ? d.stages[d.stages.length - 1].events : d.events; list.push({ t: h.t + 0.1, a: 'zone', at: h.at, r: (h.r || 3), dur: 4, tick: 0.5, kind: 'fire', hit: { coef: (h.coef || 5) * 0.08, elem: 'fire' } }); } },
  vital: { name: 'Vital Point Strike', v: 0.4, desc: v => `Damage +${pct(v)} to staggered or downed enemies.`, apply(d, v) { d.domBonus = (d.domBonus || 0) + v; } },
};

/** deep clone plain data, keep functions by reference */
export function clone(o) {
  if (Array.isArray(o)) return o.map(clone);
  if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = clone(o[k]); return r; }
  return o;
}

/** Normalise a tripod entry (string id | 'id:value' | object) → { id, name, desc, apply, v } */
export function tripod(entry) {
  if (typeof entry === 'string') {
    const [id, v] = entry.split(':');
    const g = GENERIC[id]; if (!g) return { id, name: id, desc: '', apply() {} };
    const val = v !== undefined ? +v : g.v;
    return { id, name: g.name, desc: g.desc(val), apply: d => g.apply(d, val), icon: `tripod:${id}`, v: val };
  }
  return { icon: `tripod:${entry.icon || entry.id}`, ...entry };
}

export const TRIPOD_LEVELS = [4, 7, 10];
export const skillLevelMult = lv => 1 + 0.12 * (lv - 1);

/**
 * Build the runtime definition of a kit skill at a level with tripod picks [t1, t2, t3] (indices or -1).
 */
export function buildSkill(kit, level = 1, picks = [-1, -1, -1]) {
  const d = clone(kit);
  d.props = d.props || {};
  d.level = level;
  d.mult = (d.mult || 1) * skillLevelMult(level);
  d.picked = [];
  (kit.tripods || []).forEach((tier, i) => {
    const p = picks?.[i];
    if (p == null || p < 0 || level < TRIPOD_LEVELS[i] || !tier[p]) return;
    const tp = tripod(tier[p]);
    tp.apply(d);
    d.picked.push(tp.id);
  });
  // timelines run in array order: keep every list sorted by time
  const byT = (a, b) => (a.t || 0) - (b.t || 0);
  for (const l of [d.events, d.end, d.loop?.events, ...(d.stages || []).map(st => st.events)]) if (Array.isArray(l)) l.sort(byT);
  return d;
}
