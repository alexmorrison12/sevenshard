// Bottom-centre skill cluster (Lost Ark layout):
//            [ buffs ····················· debuffs ]
//            [ ─────────── identity gauge ────────── ]
//       Lv ▕████████████ HP 45,210 / 52,000 ███▒▒▒▏
//          ▕██████████████ MP ███████████████████▏
//   [1][2]  [Q][W][E][R]  [ V ]
//   [3][4]  [A][S][D][F]  [Spc]
// Cooldown sweeps are CSS animations started once per cooldown (not per update); the 15 Hz HudState only
// re-syncs them when the game's cdLeft drifts from the animation (e.g. cooldown reduction, Overload ×3 tick).
import { h, setText, setCls, setSrc, show, setStyle, replay, fmtCD, fmtInt, clamp, now, Trail } from '../core/util.js';
import { iconUrl } from '../core/icon.js';
import { SKILL_KEYS, ITEM_KEYS } from '../core/data.js';
import { Identity } from './identity.js';
import { BuffRow } from './buffs.js';

// ------------------------------------------------------------------------------------------------ one slot
export class Slot {
  /** kind: 'skill' | 'item' | 'awaken' | 'dash' */
  constructor(parent, kind, key, size, onClick) {
    this.kind = kind; this.key = key; this.size = size;
    const el = this.el = h('div', `ss-sk ss-sk--${kind} ss-ptr is-empty`, parent);
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${kind === 'item' ? 'Battle item' : kind === 'dash' ? 'Dash' : kind === 'awaken' ? 'Awakening' : 'Skill'} ${key}`);
    this.ic = h('div', 'ss-sk-ic', el);
    this.mana = h('i', 'ss-sk-mana', el);
    this.cd = h('div', 'ss-sk-cd ss-sweep', el);
    this.t = h('span', 'ss-sk-t', el);
    this.k = h('span', 'ss-sk-k', el, key === 'Space' ? 'Spc' : key);
    this.n = h('span', 'ss-sk-n', el);
    this.fx = h('i', 'ss-sk-fx', el);
    this.d = null;
    this.endT = 0; this.rate = 1; this.dur = 0; this.flip = 0; this.lastT = 0; this.lastLeft = 0; this.txt = '';
    if (onClick) el.addEventListener('click', () => { this.press(); onClick(this); });
  }
  set(d, iconId, opts) {
    this.d = d;
    setCls(this.el, 'is-empty', !d);
    if (!d) { this.cool(0, 0); setSrc(this.ic, null); setText(this.n, ''); return; }
    setSrc(this.ic, iconUrl(iconId || d.icon, this.size, opts));
  }
  /** Sync the sweep with the game's cooldown (cd = full duration, left = remaining). */
  cool(cd, left) {
    const t = now();
    if (left > cd) cd = left; // tolerate placeholder cd values (e.g. cd: 1 with 30 s left)
    if (left > 0.04 && cd > 0) {
      const predicted = this.endT ? (this.endT - t) * this.rate : -1;
      if (!this.endT || cd !== this.dur || Math.abs(predicted - left) > 0.22) {
        // estimate the tick rate from the previous sample (cooldown reduction effects tick faster than real time)
        let rate = 1;
        if (this.endT && cd === this.dur && t - this.lastT > 0.03) {
          const r = (this.lastLeft - left) / (t - this.lastT);
          if (r > 0.3) rate = clamp(r, 0.25, 6);
          if (Math.abs(rate - 1) < 0.12) rate = 1;
        }
        this.rate = rate; this.dur = cd; this.endT = t + left / rate;
        const D = cd / rate, el = this.cd.style;
        el.animationName = (this.flip ^= 1) ? 'ss-cdA' : 'ss-cdB';
        el.animationDuration = D.toFixed(3) + 's';
        el.animationDelay = (-(cd - left) / rate).toFixed(3) + 's';
        setCls(this.el, 'is-cd', true);
      }
      this.lastT = t; this.lastLeft = left;
      const txt = fmtCD(left);
      if (txt !== this.txt) { this.txt = txt; setText(this.t, txt); setCls(this.t, 'is-soon', left < 1); }
    } else if (this.endT) {
      this.endT = 0; this.dur = 0; this.txt = '';
      setText(this.t, '');
      setCls(this.el, 'is-cd', false);
      this.cd.style.animationName = 'none';
      if (cd > 1.5) replay(this.fx, 'is-ready');
    }
  }
  press() { replay(this.fx, 'is-press'); }
}

// ------------------------------------------------------------------------------------------------ HP / MP / shield
export class Resources {
  constructor(parent) {
    const el = this.el = h('div', 'ss-res', parent);
    this.lv = h('div', 'ss-lv ss-ptr', el);
    this.lvN = h('b', '', this.lv);
    const bars = h('div', 'ss-res-bars', el);
    const hp = this.hp = h('div', 'ss-hpb ss-ptr', bars);
    this.hpLag = h('i', 'ss-hpb-lag', hp);
    this.hpFill = h('i', 'ss-hpb-fill', hp);
    this.trail = new Trail(this.hpLag);
    this.shield = h('i', 'ss-hpb-sh', hp);
    h('i', 'ss-hpb-gloss', hp);
    this.hpT = h('span', 'ss-hpb-t', hp);
    const mp = this.mp = h('div', 'ss-mpb ss-ptr', bars);
    this.mpFill = h('i', 'ss-mpb-fill', mp);
    h('i', 'ss-hpb-gloss', mp);
    this.mpT = h('span', 'ss-mpb-t', mp);
    this.lv._tip = () => this.s && { title: `Level ${this.s.level ?? ''}`, lines: [this.s.xpMax ? `Experience ${fmtInt(this.s.xp)} / ${fmtInt(this.s.xpMax)} (${Math.floor(this.s.xp / this.s.xpMax * 100)}%)` : 'Maximum level', this.s.iLvl ? `Item Level ${this.s.iLvl.toFixed ? this.s.iLvl.toFixed(2) : this.s.iLvl}` : null] };
    this.hp._tip = () => this.s && { title: 'Health', lines: [`${fmtInt(this.s.hp)} / ${fmtInt(this.s.hpMax)}`, this.s.shield ? `Shield ${fmtInt(this.s.shield)}` : null] };
    this.mp._tip = () => this.s && { title: 'Mana', lines: [`${fmtInt(this.s.mp)} / ${fmtInt(this.s.mpMax)}`, 'Skills cost mana; it regenerates over time.'] };
    this._hpF = -1; this._low = false;
  }
  update(s) {
    this.s = s;
    setText(this.lvN, s.level ?? '');
    const max = Math.max(1, s.hpMax || 1), f = clamp((s.hp || 0) / max, 0, 1);
    const sh = clamp((s.shield || 0) / max, 0, 1);
    if (f !== this._hpF) { this._hpF = f; setStyle(this.hpFill, 'transform', `scaleX(${f.toFixed(4)})`); }
    this.trail.set(f); // damage trail: holds, then chases; heals snap
    // shield: appended after HP, or overlapping from the right end when HP + shield > max
    const a = f + sh > 1 ? 1 - sh : f;
    setStyle(this.shield, 'transform', `translateX(${(a * 100).toFixed(2)}%) scaleX(${sh.toFixed(4)})`);
    show(this.shield, sh > 0);
    setText(this.hpT, `${fmtInt(s.hp)} / ${fmtInt(max)}` + (s.shield > 0 ? `  +${fmtInt(s.shield)}` : ''));
    const low = f < 0.3 && f > 0;
    if (low !== this._low) { this._low = low; setCls(this.hp, 'is-low', low); }
    const mf = clamp((s.mp || 0) / Math.max(1, s.mpMax || 1), 0, 1);
    setStyle(this.mpFill, 'transform', `scaleX(${mf.toFixed(4)})`);
    setText(this.mpT, `${fmtInt(s.mp)} / ${fmtInt(s.mpMax)}`);
  }
}

// ------------------------------------------------------------------------------------------------ XP line
export class XpBar {
  constructor(parent) {
    const el = this.el = h('div', 'ss-xp ss-ptr', parent);
    this.fill = h('i', 'ss-xp-fill', el);
    h('i', 'ss-xp-ticks', el);
    el._tip = () => this.s && (this.s.xpMax ? { title: `Level ${this.s.level} · ${(this.s.xp / this.s.xpMax * 100).toFixed(1)}%`, lines: [`${fmtInt(this.s.xp)} / ${fmtInt(this.s.xpMax)} experience`] } : { title: `Level ${this.s.level}`, lines: ['Maximum combat level'] });
  }
  update(s) {
    this.s = s;
    const f = s.xpMax ? clamp(s.xp / s.xpMax, 0, 1) : 1;
    setStyle(this.fill, 'transform', `scaleX(${f.toFixed(4)})`);
  }
}

// ------------------------------------------------------------------------------------------------ the cluster
export class SkillCluster {
  constructor(ui, parent) {
    this.ui = ui;
    const el = this.el = h('div', 'ss-sc', parent);
    this.buffs = new BuffRow(ui, h('div', 'ss-sc-buffs', el));
    this.identity = new Identity(ui, h('div', 'ss-sc-id', el));
    this.res = new Resources(el);
    const main = h('div', 'ss-sc-main ss-panel--flat', el);
    const items = h('div', 'ss-sc-items', main);
    const skills = h('div', 'ss-sc-skills', main);
    const side = h('div', 'ss-sc-side', main);
    const emit = (type, payload) => ui.emit(type, payload);
    this.items = ITEM_KEYS.map((k, i) => new Slot(items, 'item', k, 38, () => emit('hud:item', { slot: i, key: k, id: this.items[i].d?.id })));
    this.skills = SKILL_KEYS.map((k, i) => new Slot(skills, 'skill', k, 50, () => emit('hud:skill', { slot: i, key: k, id: this.skills[i].d?.id })));
    this.awaken = new Slot(side, 'awaken', 'V', 62, () => emit('hud:awaken', { key: 'V', id: this.awaken.d?.id }));
    this.dash = new Slot(side, 'dash', 'Space', 34, () => emit('hud:dash', { key: 'Space' }));
    this.dashPips = h('div', 'ss-sk-pips', this.dash.el);
    this.dash.set({ icon: 'skill:any:dash' });
    for (const s of this.skills) s.el._tip = () => s.d && { kind: 'skill', skill: s.d };
    this.awaken.el._tip = () => this.awaken.d && { kind: 'skill', skill: { type: 'Awakening', ...this.awaken.d } };
    for (const s of this.items) s.el._tip = () => s.d && { kind: 'item', item: { kind: 'battle', grade: 2, ...s.d } };
    this.dash.el._tip = () => ({ title: 'Dash', key: 'Space', lines: [this._dash ? `Cooldown ${this._dash.cd}s${this._dash.charges > 1 ? ` · ${this._dash.charges} charges` : ''}` : '', 'While knocked down: Stand Up (brief invulnerability).'] });
    this._mp = 0; this._pips = -1;
  }
  slotByKey(key) {
    key = String(key).toUpperCase();
    const i = SKILL_KEYS.indexOf(key); if (i >= 0) return this.skills[i];
    const j = ITEM_KEYS.indexOf(key); if (j >= 0) return this.items[j];
    if (key === 'V') return this.awaken;
    if (key === 'SPACE' || key === ' ') return this.dash;
    return null;
  }
  update(s) {
    this.res.update(s);
    this.identity.update(s.identity, s);
    this.buffs.update(s.buffs);
    const mp = s.mp ?? 1e9;
    const list = s.skills || [];
    for (let i = 0; i < 8; i++) {
      const d = list[i] || null, sl = this.skills[i];
      sl.set(d);
      if (!d) continue;
      sl.cool(d.cd || 0, d.cdLeft || 0);
      setCls(sl.el, 'is-nomana', d.noMana ?? (d.mana || 0) > mp);
      setCls(sl.el, 'is-active', !!d.active);
      setText(sl.n, d.stacks > 1 ? d.stacks : '');
    }
    const aw = s.awaken || null;
    this.awaken.set(aw);
    if (aw) { this.awaken.cool(aw.cd || 0, aw.cdLeft || 0); setText(this.awaken.n, aw.uses != null ? aw.uses : ''); setCls(this.awaken.el, 'is-nomana', (aw.mana || 0) > mp); }
    const dash = this._dash = s.dash || null;
    show(this.dash.el, !!dash);
    if (dash) {
      this.dash.cool(dash.cd || 0, dash.cdLeft || 0);
      setCls(this.dash.el, 'is-down', !!dash.down);
      const c = dash.charges ?? 1;
      if (c !== this._pips) {
        this._pips = c; this.dashPips.textContent = '';
        if ((dash.maxCharges || 0) > 1 || c > 1) for (let i = 0; i < Math.max(c, dash.maxCharges || 0); i++) h('i', i < c ? 'on' : '', this.dashPips);
      }
    }
    const items = s.items || [];
    for (let i = 0; i < 4; i++) {
      const d = items[i] || null, sl = this.items[i];
      sl.set(d, d && (d.icon || (d.id ? 'item:' + d.id : null)), d ? d.grade ?? 1 : undefined);
      if (!d) continue;
      sl.cool(d.cd || 0, d.cdLeft || 0);
      setText(sl.n, d.count != null ? d.count : '');
      setCls(sl.el, 'is-out', d.count === 0);
    }
  }
}
