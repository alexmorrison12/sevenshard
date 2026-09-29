// Builds the HudState object (ARCHITECTURE.md "Shared data shapes") from the running game for the UI.
import { eff } from './combat.js';

const TYPE_NAME = { normal: 'Normal', combo: 'Combo', chain: 'Chain', holding: 'Holding', charge: 'Charge', casting: 'Casting', point: 'Point', toggle: 'Toggle' };
export function skillView(kit, def, key) {
  if (!def) return null;
  const u = kit.u;
  return {
    id: def.id, name: def.name, icon: `skill:${kit.cls.id}:${def.id}`, type: TYPE_NAME[def.type] || 'Normal', key,
    cd: def.cd * (1 - eff(u).cdr), cdLeft: u.cdLeft(def.id), mana: def.mp || 0, level: def.level || 1, maxLevel: 12,
    desc: def.desc || '', stagger: def.props?.stagger || null, weakPoint: def.props?.wp || 0, counter: !!def.props?.counter,
    attack: def.props?.attack === 'back' ? 'Back' : def.props?.attack === 'head' ? 'Head' : null, superArmor: def.props?.superArmor || null,
    noMana: (def.mp || 0) > u.mp, active: u.skill?.def.id === def.id,
    charge: u.skill?.def.id === def.id && def.type === 'charge' ? { pct: u.skill.charge, perfect: def.perfect } : null,
  };
}

export function buildHud(game) {
  const kit = game.hero; if (!kit) return null;
  const u = kit.u, L = game.level, e = eff(u);
  const keys = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];
  const boss = game.mode?.bossHud?.() || null;
  const party = game.mode?.partyHud?.() || (game.party ? game.party.hud() : [{ name: u.name, cls: u.cls, hp: u.hp, hpMax: u.hpMax, shield: u.shield, dead: u.dead, you: true }]);
  const buffs = u.statuses.map(s => ({ id: s.id, icon: s.icon, name: s.name, left: s.left, dur: s.dur, stacks: s.stacks, debuff: !!s.def.debuff }));
  for (const sh of u.shields) buffs.push({ id: 'shield', icon: 'status:shield', name: 'Shield', left: sh.left, dur: 6, stacks: 1, debuff: false });
  return {
    hp: u.hp, hpMax: u.hpMax, shield: u.shield, mp: u.mp, mpMax: u.mpMax,
    level: kit.char.level, xp: kit.char.xp || 0, xpMax: game.xpMax?.(kit.char.level) || 1, iLvl: Math.floor(u.st.ilvl || 0),
    identity: kit.hudIdentity(),
    skills: keys.map((k, i) => skillView(kit, kit.skillAt(i), k)),
    awaken: { ...skillView(kit, kit.awaken, 'V'), uses: kit.awakenUses },
    dash: { cd: kit.cls.dash.cd, cdLeft: Math.max(0, kit.dashCd), charges: 1, stand: kit.standCd, down: u.cc.down > 0 },
    items: kit.items.map((it, i) => ({ id: it.id, icon: `item:${it.id}`, count: it.count, cd: 1, cdLeft: Math.max(0, it.cd), key: String(i + 1) })),
    buffs, party, boss,
    cast: u.skill && (u.skill.castLeft > 0 || (u.skill.def.type === 'charge' && !u.skill.chargeDone)) ? { name: u.skill.def.name, pct: u.skill.castLeft > 0 ? 1 - u.skill.castLeft / u.skill.casting : u.skill.charge, perfect: u.skill.def.perfect || null, kind: u.skill.def.type } : null,
    dead: u.dead, down: u.cc.down > 0,
    quests: game.questHud?.() || [],
    zone: game.zoneHud?.() || { name: game.zone?.name || '', sub: '' },
    minimap: game.minimapHud?.() || null,
    progress: game.mode?.progressHud?.() || null,
    timer: game.mode?.timerHud?.() || null,
    currencies: game.currencies?.() || { silver: 0, gold: 0, crystals: 0 },
    fps: Math.round(game.renderer.fps),
    target: null,
  };
}
