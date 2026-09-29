// Sunheart Passive logic: ranks, tier gates, points, aggregated stat mods, and the window view.
import { TREES, TIER_GATE, SUNHEART_UNLOCK } from '../../data/sunheart.js';
import { itemLevel } from '../systems/stats.js';

const NODE = {}; for (const [tree, t] of Object.entries(TREES)) for (const n of t.nodes) NODE[n.id] = { ...n, tree };

export function sunState(char) { return char.sunheart ||= { points: 0, ranks: {} }; }
export const unlocked = char => itemLevel(char) >= SUNHEART_UNLOCK || (char.level >= 60 && char.premade);
function spentIn(st, tree) { let n = 0; for (const [id, r] of Object.entries(st.ranks)) if (NODE[id]?.tree === tree) n += r * NODE[id].cost; return n; }
function spentBelow(st, tree, tier) { let n = 0; for (const [id, r] of Object.entries(st.ranks)) { const d = NODE[id]; if (d?.tree === tree && d.tier < tier) n += r * d.cost; } return n; }
export function available(char) { const st = sunState(char); let spent = 0; for (const tree of Object.keys(TREES)) spent += spentIn(st, tree); return st.points - spent; }

export function canRank(char, id, delta = 1) {
  const d = NODE[id], st = sunState(char); if (!d) return 'unknown';
  if (!unlocked(char)) return 'locked';
  const r = st.ranks[id] || 0;
  if (delta > 0) {
    if (r >= d.max) return 'max';
    if (available(char) < d.cost) return 'points';
    if (spentBelow(st, d.tree, d.tier) < TIER_GATE[d.tier]) return 'tier';
    return null;
  }
  if (r <= 0) return 'min';
  // removing a rank must not strand higher tiers
  const test = { ...st, ranks: { ...st.ranks, [id]: r - 1 } };
  for (const [nid, nr] of Object.entries(test.ranks)) { const nd = NODE[nid]; if (nr > 0 && nd.tree === d.tree && nd.tier > d.tier && spentBelow(test, d.tree, nd.tier) < TIER_GATE[nd.tier]) return 'dependent'; }
  return null;
}
export function rank(char, id, delta = 1) {
  const why = canRank(char, id, delta); if (why) return { ok: false, why };
  const st = sunState(char); st.ranks[id] = (st.ranks[id] || 0) + delta; if (!st.ranks[id]) delete st.ranks[id];
  return { ok: true };
}
export function resetTree(char, tree) { const st = sunState(char); for (const id of Object.keys(st.ranks)) if (NODE[id]?.tree === tree) delete st.ranks[id]; }
/** sum of all node mods at their ranks */
export function sunMods(char) {
  const st = char.sunheart; const m = {}; if (!st || !unlocked(char)) return m;
  for (const [id, r] of Object.entries(st.ranks)) { const d = NODE[id]; if (!d) continue; for (const [k, v] of Object.entries(d.mods)) m[k] = (m[k] || 0) + v * r; }
  return m;
}
export function sunView(char) {
  const st = sunState(char);
  return {
    unlocked: unlocked(char), unlockAt: SUNHEART_UNLOCK, points: st.points, available: available(char),
    trees: Object.entries(TREES).map(([id, t]) => ({ id, name: t.name, color: t.color, blurb: t.blurb, spent: spentIn(st, id),
      tiers: [1, 2, 3, 4, 5].filter(tier => t.nodes.some(n => n.tier === tier)).map(tier => ({ tier, gate: TIER_GATE[tier], open: spentBelow(st, id, tier) >= TIER_GATE[tier],
        nodes: t.nodes.filter(n => n.tier === tier).map(n => ({ id: n.id, name: n.name, desc: n.desc, rank: st.ranks[n.id] || 0, max: n.max, cost: n.cost, can: !canRank(char, n.id, 1) })) })) })),
  };
}
