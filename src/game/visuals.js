// Keeps a visual model for every unit in the level: creates it on spawn, syncs transform and animation state each
// frame, flashes on hits, plays knockdown/get-up/death, fades corpses, and disposes on despawn.
// Real model providers (heroes, creatures, bosses) are registered by the game; placeholders fill any gaps.
import * as THREE from 'three';
import { placeholderHero, placeholderCreature, placeholderBoss } from './placeholders.js';

export const PROVIDERS = { hero: null, creature: null, boss: null };

export function makeModel(u) {
  try {
    if (u.kind === 'hero' || (u.kind === 'npc' && u.data.look) || u.data.npcBody) {
      if (PROVIDERS.hero) {
        const m = PROVIDERS.hero({ cls: u.cls, sex: u.data.sex || 'm', look: u.data.look || {}, gear: u.data.gear, weapon: u.data.weapon, npc: u.data.npc || null, lod: u.data.lod || (u.data.npcBody ? 'crowd' : 'full') });
        if (u.data.npcBody && u.data.scale && u.data.scale !== 1) m.root.scale.setScalar(u.data.scale);
        return m;
      }
      return placeholderHero({ cls: u.cls, npc: u.data.npc });
    }
    if (u.kind === 'boss') {
      if (PROVIDERS.boss) { const m = PROVIDERS.boss(u.type, u.data.modelOpts || {}); if (m) return m; }
      return placeholderBoss(u.type, { height: u.height, radius: u.radius });
    }
    const type = u.data.tpl?.model || u.type;
    if (PROVIDERS.creature) { const m = PROVIDERS.creature(type, { scale: u.data.scale, elite: u.data.elite, variant: u.data.variant }); if (m) return m; }
    return placeholderCreature(type, { height: u.height, radius: u.radius, scale: 1 });
  } catch (e) {
    console.warn('[visuals] model failed for', u.kind, u.type || u.cls, e);
    return u.kind === 'hero' ? placeholderHero({ cls: u.cls }) : placeholderCreature(u.type, { height: u.height, radius: u.radius });
  }
}

export class Visuals {
  constructor(scene, level) {
    this.scene = scene; this.level = level; this.models = new Map();
    this.off = [
      level.on('spawn', ({ unit }) => this.attach(unit)),
      level.on('despawn', ({ unit }) => this.detach(unit)),
      // hit flash: your hits (and hits on you) only — eight raiders flashing a boss would keep it permanently white
      level.on('damage', ev => {
        if (!(ev.amount > 0) || ev.dot) return;
        const me = level.localHero, t = ev.tgt;
        if (me && ev.src !== me && t !== me && ev.src?.kind === 'hero') return;
        const k = t.kind === 'boss' ? (ev.crit ? 0.26 : 0.18) : ev.crit ? 0.5 : 0.35;
        t._flash = Math.max(t._flash || 0, k);
      }),
      level.on('death', ({ unit }) => { unit.model?.play?.('death', { dur: 1.2 }); }),
      level.on('knock', ({ tgt, knock }) => { if (knock === 'down' || knock === 'up') { tgt.model?.play?.('knockdown', { dur: 0.6 }); tgt._wasDown = true; } else if ((knock === 'push' || knock === 'pull') && tgt.kind !== 'boss' && !tgt.skill) tgt.model?.play?.('knockback', { dur: 0.5 }); }),
      level.on('standUp', ({ unit }) => { unit.model?.play?.('getup', { dur: 0.35 }); unit._wasDown = false; }),
    ];
    for (const u of level.units) this.attach(u);
  }
  attach(u) {
    if (this.models.has(u.id) || u.data.noModel) return;
    const m = u.model = u.model || makeModel(u);
    m.root.position.copy(u.pos); m.root.rotation.y = u.facing;
    m.root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { if (o.castShadow === undefined || o.userData.noShadow !== true) o.castShadow = true; o.receiveShadow = o.receiveShadow ?? false; } });
    this.scene.add(m.root);
    this.models.set(u.id, u);
    if (u.kind === 'mob' || u.kind === 'boss') u.model.play?.('spawn', { dur: 0.8 });
  }
  detach(u) {
    if (!this.models.has(u.id)) return;
    this.models.delete(u.id);
    if (u.model) { this.scene.remove(u.model.root); if (!u.data.keepModel) u.model.dispose?.(); }
  }
  update(dt) {
    for (const u of this.models.values()) {
      const m = u.model; if (!m) continue;
      const r = m.root;
      r.position.copy(u.pos);
      // shortest-arc facing smoothing for AI, snap for skills
      let d = u.facing - r.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      r.rotation.y += u.skill ? d : d * Math.min(1, dt * 18);
      const down = u.cc.down > 0 || u.air.launched;
      if (u._wasDown && !down && !u.dead) { m.play?.('getup', { dur: 0.35 }); u._wasDown = false; }
      if (down) u._wasDown = true;
      // hit flash (models may keep tints until told otherwise, so drive the fade here)
      if (u._flash > 0) { u._flash = Math.max(0, u._flash - dt * 4); m.setTint?.(0xffffff, u._flash); if (u._flash === 0) m.setTint?.(0xffffff, 0); }
      const udt = u.udt ?? dt;
      m.update(udt, {
        speed: u.anim.speed, turn: u.anim.turn || 0, combat: u.combatT > 0 || !!u.skill, dead: u.dead, down,
        stunned: u.cc.stun > 0 || u.cc.freeze > 0, mounted: !!u.data.mounted, sit: !!u.data.sit, groggy: !!u.data.groggy,
        enraged: !!u.data.enraged, fly: u.data.fly || 0, burrowed: u.data.burrowed || 0, ghost: u.data.ghost || 0,
      });
      if (u.dead && u.deadT > (u.data.corpseTime ?? 4) - 1 && u.kind !== 'hero') {
        // corpses burn away (creature models dissolve) or sink into the ground
        const k = Math.min(1, u.deadT - (u.data.corpseTime ?? 4) + 1);
        if (m.setDissolve) m.setDissolve(k); else r.position.y -= k * 1.2;
      }
    }
  }
  dispose() { for (const f of this.off) f(); for (const u of [...this.models.values()]) this.detach(u); }
}
