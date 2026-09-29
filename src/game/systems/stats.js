// Hero combat stats from a character record: level, gear (item level, honing, quality), accessories (combat stats),
// engravings, cards, gems, roster bonuses, stronghold research. Numbers aim for Lost Ark-like magnitudes:
// attack power 20k–45k and HP 140k–260k across the endgame item levels.
import { baseStats } from '../unit.js';
import { CLASSES } from '../../data/classes/index.js';
import { refFor } from '../ai/mob.js';
import { ENGRAVINGS, engravingLevels } from '../../data/engravings.js';

export const STAT_KEYS = ['crit', 'spec', 'swift', 'dom', 'endur', 'expert'];

/** item level of a character from equipped gear (6 pieces) — story characters use their level */
export function itemLevel(char) {
  const g = char.equip || {};
  const pieces = ['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves'].map(s => g[s]).filter(Boolean);
  if (!pieces.length) return Math.round((char.level || 1) * 20);
  const sum = pieces.reduce((a, p) => a + (p.iLvl || 0), 0);
  return Math.floor(sum / 6 * 100) / 100;
}

export function heroStats(char, ctx = {}) {
  const cls = CLASSES[char.cls] || { stats: {} };
  const ilvl = itemLevel(char);
  const ref = ilvl >= 1000 ? refFor(ilvl) : refFor(char.level || 1);
  // combat stats from accessories/bracelets (sum), default spread for fresh characters
  const cs = { crit: 0, spec: 0, swift: 0, dom: 0, endur: 0, expert: 0 };
  for (const it of Object.values(char.equip || {})) if (it?.stats) for (const k of STAT_KEYS) cs[k] += it.stats[k] || 0;
  if (ilvl >= 1000 && !Object.values(char.equip || {}).some(i => i?.slot === 'necklace')) { cs.crit += 400; cs.swift += 300; }
  const q = char.equip?.weapon?.quality ?? 70;
  let apMul = 1 + (q / 100) * 0.1;            // weapon quality: up to +10% damage (as "additional damage")
  let hpMul = 1;
  for (const s of ['head', 'shoulder', 'chest', 'pants', 'gloves']) { const p = char.equip?.[s]; if (p) hpMul += ((p.quality ?? 70) / 100) * 0.012; }
  const roster = ctx.rosterLevel || 1;
  const research = ctx.research || {};
  const cardSet = ctx.cardBonus || {};
  const st = baseStats({
    atk: Math.round(ref.ap * (cls.stats.atk || 1) * (1 + roster * 0.0015) * (research.atk || 1)),
    hpMax: Math.round(ref.hp * (cls.stats.hp || 1) * hpMul * (1 + roster * 0.002)),
    mpMax: 1400, mpRegen: 42,
    crit: 0.12 + cs.crit / 2800,
    critDmg: 2.0,
    atkSpd: 1 + cs.swift / 5800,
    moveSpd: 1 + cs.swift / 5800,
    cdr: Math.min(0.5, cs.swift / 4660 * 0.01 * 100 / 100),
    dmgAdd: apMul - 1 + (cardSet.dmgAdd || 0),
    def: Math.round((ref.ilvl ? 3200 + (ilvl - 1100) * 6 : 800 + (char.level || 1) * 60) * (cls.stats.def || 1)),
    identityGain: 1 + cs.spec / 2800, identityMul: 1 + cs.spec / 1500, awakenMul: 1 + cs.spec / 1100,
    domMul: cs.dom / 2800 * 0.8,
    healMul: 1 + cs.expert / 3000, shieldMul: 1 + cs.expert / 3000, healTaken: 1 + cs.endur / 5000,
    speed: 5.4,
  });
  st.cdr = Math.min(0.5, cs.swift / 4660 * 0.01 * 100 / 100 * 1);
  // engravings
  const lv = engravingLevels(char);
  for (const [id, level] of Object.entries(lv)) {
    const e = ENGRAVINGS[id] || cls.engravings?.find(x => x.id === id); if (!e || level <= 0) continue;
    const m = e.levels ? e.levels[Math.min(level, 3) - 1] : e.mods; if (!m) continue;
    for (const k in m) {
      if (k === 'hpMaxMul') st.hpMax = Math.round(st.hpMax * (1 + m[k]));
      else if (k.endsWith('Mul')) st[k] = (st[k] ?? 1) * (1 + m[k]);
      else st[k] = (st[k] ?? 0) + m[k];
    }
  }
  if (st.defMul) { st.def = Math.round(st.def * st.defMul); delete st.defMul; }
  if (st.mpRegenMul) { st.mpRegen *= st.mpRegenMul; delete st.mpRegenMul; }
  // special engraving multipliers resolved per hit
  const sp = {}; for (const k of ['bossMul', 'plainMul', 'chargeMul', 'shieldedMul', 'stableMul', 'holdMul', 'brandMul', 'dashMul', 'captain']) if (st[k]) { sp[k] = k === 'captain' ? st[k] : st[k] - 1; delete st[k]; }
  if (Object.keys(sp).length) st.onDamageMul = (src, tgt, o, back, head) => {
    let m = 1;
    if (sp.bossMul && tgt.kind === 'boss') m *= 1 + sp.bossMul;
    if (sp.plainMul && !o.attack && o.kind !== 'awaken') m *= 1 + sp.plainMul;
    if (sp.chargeMul && o.stype === 'charge') m *= 1 + sp.chargeMul;
    if (sp.holdMul && (o.stype === 'holding' || o.stype === 'casting')) m *= 1 + sp.holdMul;
    if (sp.shieldedMul && src.shields.length) m *= 1 + sp.shieldedMul;
    if (sp.stableMul && src.hp / src.hpMax > 0.8) m *= 1 + sp.stableMul;
    if (sp.brandMul && tgt.statuses.some(s => s.id === 'brand')) m *= 1 + sp.brandMul;
    if (sp.dashMul && src.data.propulsionT > 0) m *= 1 + sp.dashMul;
    if (sp.captain) m *= 1 + sp.captain * Math.max(0, (src._eff?.moveSpd || 1) - 1);
    return m;
  };
  st.ilvl = ilvl; st.combat = { ...cs };
  st.power = Math.round(st.atk * (1 + st.crit * (st.critDmg - 1)) * st.dmgMul * (1 + st.dmgAdd) / 100); // "combat power" summary
  return st;
}
