// Class identities (Z / X). Each handler owns its resource and exposes hooks the HeroKit calls:
//   onHit(evs, hitSpec, ctx)  onCast(def, run, opts)  update(dt)  key('z'|'x', aim) → bool  hud() → HudState.identity
//   skillMul(def, opts)  cdMul(def)  mpMul()  overrideSkill(slot)
import { SkillRun } from './skills/runner.js';
import { buildSkill } from './skills/tripods.js';
import { applyStatus, removeStatus, eff } from './combat.js';

const gain = (kit, v) => v * (eff(kit.u).identityGain || 1);

function castIdentity(kit, def, aim, opts = {}) {
  const u = kit.u, L = kit.level;
  if (u.dead || (u.disabled && !opts.anyState)) return false;
  if (u.skill) u.skill.cancel('identity');
  const built = def.built || (def.built = buildSkill(def, 1, []));
  u.skill = new SkillRun(L, u, built, { aimX: aim.x, aimZ: aim.z }, { kind: 'identity', mult: opts.mult ?? 1 });
  L.emit('identity', { unit: u, def: built });
  return true;
}

const H = {
  // ------------------------------------------------ REAVER: Bloodlust → Burst Mode, Crimson Finale
  reaver(kit) {
    const I = kit.cls.identity, u = kit.u, L = kit.level;
    const st = { v: 0, burst: 0, exhaust: 0 };
    const tempered = () => kit.char.engr?.includes('tempered_fury');
    return {
      onHit(evs, h, ctx) { if (st.burst > 0) return; st.v = Math.min(I.max, st.v + gain(kit, ctx.kind === 'basic' ? I.gainBasic : I.gainPerHit)); },
      update(dt) {
        if (st.burst > 0) {
          st.burst -= dt;
          if (st.burst <= 0) { this.endBurst(); }
        }
        if (st.exhaust > 0) st.exhaust -= dt;
      },
      endBurst(finale) {
        st.burst = 0; removeStatus(L, u, 'burst_mode'); u.model?.setGlow?.(0, 0);
        if (!tempered() && !finale) { applyStatus(L, u, 'slow', { dur: 5, name: 'Exhaustion', src: u }); }
        L.emit('identityEnd', { unit: u });
      },
      key(k, aim) {
        if (k !== 'z') return false;
        if (st.burst > 0) { // Crimson Finale
          const left = st.burst;
          const def = { id: 'crimson_finale', name: 'Crimson Finale', type: 'normal', dur: 1.2, superArmor: 'full', fixedSpeed: true, props: { stagger: 'High' },
            events: [{ t: 0, a: 'anim', name: 'identity', dur: 1.2 }, { t: 0.1, a: 'move', kind: 'dash', dist: 3, dur: 0.25 },
              { t: 0.45, a: 'hit', shape: 'cone', r: 7, angle: 2.6, coef: I.finale.coef + I.finale.per * left, stagger: 40, wp: 2, knock: 'down', heavy: true },
              { t: 0.45, a: 'fx', preset: 'crimson_finale', color: 'crimson', r: 7 }, { t: 0.45, a: 'shake', v: 0.7 }, { t: 0.45, a: 'sfx', name: 'slash_heavy' }] };
          this.endBurst(true);
          return castIdentity(kit, def, aim, { anyState: true });
        }
        if (st.v < I.max) { L.emit('denied', { unit: u, why: 'identity' }); return false; }
        st.v = 0; st.burst = I.burst.dur;
        const mods = { ...I.burst.mods }; if (tempered()) mods.critDmg = 0.4;
        applyStatus(L, u, 'burst_mode', { dur: I.burst.dur, src: u, mods, name: 'Burst Mode', icon: 'skill:reaver:identity_z' });
        u.model?.setGlow?.(0xff2a1a, 2.5);
        u.model?.play?.('identity', { dur: 0.7 });
        u.invuln = Math.max(u.invuln, 0.4);
        L.emit('fx', { unit: u, preset: 'burst_mode', x: u.pos.x, z: u.pos.z, color: 'crimson' });
        L.emit('identity', { unit: u, def: { id: 'burst_mode', name: 'Burst Mode' } });
        return true;
      },
      hud: () => ({ kind: 'gauge', label: st.burst > 0 ? 'Burst Mode' : 'Bloodlust', value: st.burst > 0 ? st.burst : st.v, max: st.burst > 0 ? I.burst.dur : I.max, active: st.burst > 0, activeLeft: st.burst, ready: st.v >= I.max || st.burst > 0, color: '#ff3030' }),
      state: st,
    };
  },

  // ------------------------------------------------ generic "fill a gauge, spend on Z/X skill defs" (Oathkeeper, Starcaller…)
  gaugeSkills(kit) {
    const I = kit.cls.identity, u = kit.u, L = kit.level;
    const st = { v: 0, active: 0, activeMax: 0 };
    const h = {
      onHit(evs, hs, ctx) { if (st.active > 0 && I.noGainWhileActive) return; st.v = Math.min(I.max, st.v + gain(kit, (ctx.kind === 'basic' ? I.gainBasic : I.gainPerHit) || 2)); },
      onCast(def) { if (I.gainPerCast) st.v = Math.min(I.max, st.v + gain(kit, I.gainPerCast)); },
      update(dt) { if (st.active > 0) { st.active -= dt; if (st.active <= 0) { st.active = 0; I.onEnd?.(kit, st); u.model?.setGlow?.(0, 0); L.emit('identityEnd', { unit: u }); } } },
      key(k, aim) {
        const def = I[k]; if (!def) return false;
        const cost = def.cost ?? I.max;
        if (st.v < cost) { L.emit('denied', { unit: u, why: 'identity' }); return false; }
        if (def.mode) { // timed mode (Overload…)
          st.v -= cost; st.active = st.activeMax = def.dur;
          applyStatus(L, u, def.status || 'identity_mode', { dur: def.dur, src: u, mods: def.mods, name: def.name, icon: `skill:${kit.cls.id}:identity_${k}` });
          def.onStart?.(kit, st); u.model?.setGlow?.(def.glow || 0xa070ff, 2.2); u.model?.play?.('identity', { dur: 0.6 });
          L.emit('fx', { unit: u, preset: def.fx || 'identity_burst', x: u.pos.x, z: u.pos.z, color: def.color });
          L.emit('identity', { unit: u, def: { id: def.id, name: def.name } });
          return true;
        }
        st.v -= cost;
        return castIdentity(kit, def, aim);
      },
      hud: () => ({ kind: 'gauge', label: st.active > 0 ? (I.activeLabel || I.label) : I.label, value: st.active > 0 ? st.active : st.v, max: st.active > 0 ? st.activeMax : I.max, active: st.active > 0, activeLeft: st.active, ready: st.v >= (I.z?.cost ?? I.max), color: I.color }),
      state: st,
    };
    if (I.hooks) Object.assign(h, I.hooks(kit, st));
    return h;
  },

  // ------------------------------------------------ orbs: gauge fills orbs one by one (Stormfist Chi, Bladedancer Surge, Songweaver bubbles)
  orbs(kit) {
    const I = kit.cls.identity, u = kit.u, L = kit.level;
    const st = { v: 0, orbs: 0, active: 0, activeMax: 0 };
    const h = {
      onHit(evs, hs, ctx) {
        if (st.orbs >= I.maxOrbs) return;
        st.v += gain(kit, (ctx.kind === 'basic' ? I.gainBasic : I.gainPerHit) || 3);
        while (st.v >= I.perOrb && st.orbs < I.maxOrbs) { st.v -= I.perOrb; st.orbs++; L.emit('identityOrb', { unit: u, orbs: st.orbs }); }
        if (st.orbs >= I.maxOrbs) st.v = 0;
      },
      update(dt) { if (st.active > 0) { st.active -= dt; if (st.active <= 0) { st.active = 0; L.emit('identityEnd', { unit: u }); } } },
      key(k, aim) {
        const def = I[k]; if (!def) return false;
        const need = def.orbs === 'all' ? 1 : def.orbs;
        if (st.orbs < need) { L.emit('denied', { unit: u, why: 'identity' }); return false; }
        const spent = def.orbs === 'all' ? st.orbs : need;
        st.orbs -= spent;
        const mult = def.perOrbMul ? 1 + def.perOrbMul * (spent - 1) : 1;
        if (def.dur) { st.active = st.activeMax = def.dur * (def.perOrbDur ? spent : 1); }
        return castIdentity(kit, def, aim, { mult, spent });
      },
      hud: () => ({ kind: I.hudKind || 'orbs', label: I.label, value: st.v, max: I.perOrb, orbs: st.orbs, maxOrbs: I.maxOrbs, active: st.active > 0, activeLeft: st.active, ready: st.orbs > 0, color: I.color }),
      state: st,
    };
    if (I.hooks) Object.assign(h, I.hooks(kit, st));
    return h;
  },

  // ------------------------------------------------ PISTOLEER: stances + Deadeye Focus
  pistoleer(kit) {
    const I = kit.cls.identity, u = kit.u, L = kit.level;
    const order = ['pistol', 'shotgun', 'rifle'];
    const st = { stance: 'pistol', v: 0, quick: 0, focus: 0 };
    const setStance = (s, quick) => {
      if (st.stance === s) return;
      st.stance = s; u.model?.setStance?.(s);
      if (quick) { st.quick = 3; applyStatus(L, u, 'quickdraw', { dur: 3, src: u, mods: { dmgMul: kit.char.engr?.includes('quickdraw') ? 0.15 : 0.06 }, name: 'Quickdraw', icon: 'skill:pistoleer:identity_z' }); }
      L.emit('stance', { unit: u, stance: s });
    };
    return {
      onCast(def) { if (def.stance) setStance(def.stance, true); },
      onHit() { st.v = Math.min(I.max, st.v + gain(kit, I.gainPerHit)); },
      update(dt) { if (st.focus > 0) st.focus -= dt; if (st.quick > 0) st.quick -= dt; },
      key(k, aim) {
        if (k === 'z') { setStance(order[(order.indexOf(st.stance) + 1) % 3], false); u.model?.play?.('buff', { dur: 0.35 }); return true; }
        if (k === 'x') {
          if (st.v < I.max) { L.emit('denied', { unit: u, why: 'identity' }); return false; }
          st.v = 0; st.focus = I.focus.dur;
          applyStatus(L, u, 'deadeye_focus', { dur: I.focus.dur, src: u, mods: I.focus.mods, name: 'Deadeye Focus', icon: 'skill:pistoleer:identity_x' });
          L.emit('fx', { unit: u, preset: 'identity_burst', x: u.pos.x, z: u.pos.z, color: 'brass' });
          L.emit('identity', { unit: u, def: { id: 'deadeye_focus', name: 'Deadeye Focus' } });
          return true;
        }
        return false;
      },
      basicStance: () => st.stance,
      hud: () => ({ kind: 'stance', label: 'Focus', stance: st.stance, value: st.focus > 0 ? st.focus : st.v, max: st.focus > 0 ? I.focus.dur : I.max, active: st.focus > 0, activeLeft: st.focus, ready: st.v >= I.max, color: '#ffb347' }),
      state: st,
    };
  },

  // ------------------------------------------------ DEMONBOUND: Demon gauge → Demonform (bar swaps to demon skills)
  demonbound(kit) {
    const I = kit.cls.identity, u = kit.u, L = kit.level;
    const st = { v: 0, form: 0 };
    const restraint = () => kit.char.engr?.includes('restraint');
    const demonSkills = I.demonSkills.map(s => buildSkill(s, 1, []));
    return {
      onHit(evs, hs, ctx) { if (st.form > 0 || restraint()) return; st.v = Math.min(I.max, st.v + gain(kit, ctx.kind === 'basic' ? I.gainBasic : I.gainPerHit)); },
      update(dt) { if (st.form > 0) { st.form -= dt; if (st.form <= 0) this.end(); } },
      end() { st.form = 0; removeStatus(L, u, 'demonform'); u.model?.setDemonForm?.(false); u.radius = 0.45; L.emit('identityEnd', { unit: u }); L.emit('barChanged', { unit: u }); },
      key(k, aim) {
        if (k !== 'z') return false;
        if (restraint()) return false;
        if (st.form > 0) { this.end(); return true; }
        if (st.v < I.max) { L.emit('denied', { unit: u, why: 'identity' }); return false; }
        st.v = 0; st.form = I.dur;
        applyStatus(L, u, 'demonform', { dur: I.dur, src: u, mods: I.mods, name: 'Demonform', icon: 'skill:demonbound:identity_z' });
        u.model?.setDemonForm?.(true); u.model?.play?.('transform', { dur: 0.9 }); u.invuln = Math.max(u.invuln, 0.9); u.radius = 0.7;
        L.emit('fx', { unit: u, preset: 'demon_transform', x: u.pos.x, z: u.pos.z, color: 'demon' });
        L.emit('identity', { unit: u, def: { id: 'demonform', name: 'Demonform' } });
        L.emit('barChanged', { unit: u });
        return true;
      },
      overrideSkill(slot) { return st.form > 0 && slot < 4 ? demonSkills[slot] : null; },
      demonActive: () => st.form > 0,
      skillMul: (def) => restraint() && def.kind !== 'identity' ? 1.3 : 1,
      hud: () => ({ kind: 'demon', label: st.form > 0 ? 'Demonform' : 'Demon', value: st.form > 0 ? st.form : st.v, max: st.form > 0 ? I.dur : I.max, active: st.form > 0, activeLeft: st.form, ready: st.v >= I.max, color: '#b040ff' }),
      state: st,
    };
  },
};

export function makeIdentity(kit) {
  const id = kit.cls.id, kind = kit.cls.identity.handler || id;
  const f = H[kind] || (kit.cls.identity.kind === 'orbs' || kit.cls.identity.kind === 'bubbles' ? H.orbs : H.gaugeSkills);
  return f(kit);
}
