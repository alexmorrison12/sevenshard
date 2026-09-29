// Sailing HUD: shown instead of the combat cluster while HudState.ship is set.
//   ship: { name, hp, hpMax, speed, speedMax, sails: 0..3, heading (rad, hero facing convention), wind (rad, where it blows TO, same convention),
//           windSpeed?, crew?, skills: [{ id, name, icon, key, cd, cdLeft }] (Q W E R), dest?: { name, dist (m) } }
// Ship skill slots emit hud:shipskill { slot, key, id } when clicked.
import { h, setText, setStyle, setCls, show, clamp, fmtInt } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { Slot } from './skillbar.js';

const KEYS = ['Q', 'W', 'E', 'R'];

export class ShipHud {
  constructor(ui, parent) {
    this.ui = ui;
    const el = this.el = h('div', 'ss-ship', parent);
    const top = h('div', 'ss-ship-top', el);
    this.name = h('b', 'ss-ship-name', top);
    this.crew = h('span', 'ss-ship-crew', top);
    this.dest = h('span', 'ss-ship-dest', top);
    const hull = this.hull = h('div', 'ss-ship-hull ss-ptr', el);
    this.hullFill = h('i', '', hull);
    this.hullT = h('span', '', hull);
    hull._tip = () => this.s && { title: 'Hull', lines: [`${fmtInt(this.s.hp)} / ${fmtInt(this.s.hpMax)}`, 'Repair (W) or dock to mend the hull.'] };
    const row = h('div', 'ss-ship-row ss-panel--flat', el);
    // speed dial
    const dial = h('div', 'ss-ship-dial', row);
    dial.innerHTML = '<svg viewBox="0 0 100 60"><path class="bg" d="M10 55 A40 40 0 0 1 90 55"/><path class="fg" d="M10 55 A40 40 0 0 1 90 55"/></svg>';
    this.arc = dial.querySelector('.fg');
    this.needle = h('i', 'ss-ship-needle', dial);
    this.spd = h('b', 'ss-ship-spd', dial);
    h('span', 'ss-ship-kn', dial, 'knots');
    // sails
    const sails = h('div', 'ss-ship-sails ss-ptr', row);
    sails._tip = { title: 'Sails', lines: ['Raise the sails for speed; furl them to turn tightly and brace against storms.'] };
    this.sailEls = [0, 1, 2].map(() => h('i', '', sails));
    h('span', '', sails, 'Sails');
    // skills
    const sk = h('div', 'ss-ship-skills', row);
    this.skills = KEYS.map((k, i) => new Slot(sk, 'skill', k, 50, () => ui.emit('hud:shipskill', { slot: i, key: k, id: this.skills[i].d?.id })));
    for (const s of this.skills) s.el._tip = () => s.d && { title: s.d.name, key: s.key, lines: [s.d.desc, s.d.cd ? `Cooldown ${s.d.cd}s` : null] };
    // compass
    const cp = h('div', 'ss-ship-compass', row);
    this.rose = h('div', 'ss-ship-rose', cp);
    this.rose.innerHTML = '<b>N</b><b>E</b><b>S</b><b>W</b><i></i>';
    this.windArrow = h('div', 'ss-ship-wind', cp);
    this.windArrow.innerHTML = glyph('up');
    this.windT = h('span', 'ss-ship-windt', cp);
    h('s', 'ss-ship-bow', cp);
    show(el, false); this._on = false;
  }
  update(s) {
    this.s = s;
    const on = !!s;
    if (on !== this._on) { this._on = on; show(this.el, on); }
    if (!s) return;
    setText(this.name, s.name || 'Dawnrunner');
    setText(this.crew, s.crew != null ? `Crew ${s.crew}` : '');
    setText(this.dest, s.dest ? `${s.dest.name} · ${s.dest.dist >= 1000 ? (s.dest.dist / 1000).toFixed(1) + ' km' : Math.round(s.dest.dist) + ' m'}` : '');
    show(this.dest, !!s.dest);
    const f = clamp((s.hp || 0) / Math.max(1, s.hpMax || 1), 0, 1);
    setStyle(this.hullFill, 'transform', `scaleX(${f.toFixed(4)})`);
    setText(this.hullT, `${fmtInt(s.hp || 0)} / ${fmtInt(s.hpMax || 0)}`);
    setCls(this.hull, 'is-low', f < 0.3);
    const sp = clamp((s.speed || 0) / Math.max(1, s.speedMax || 1), 0, 1);
    setStyle(this.arc, 'stroke-dashoffset', (126 * (1 - sp)).toFixed(1));
    setStyle(this.needle, 'transform', `rotate(${(-90 + sp * 180).toFixed(1)}deg)`);
    setText(this.spd, (s.speed || 0).toFixed(1));
    this.sailEls.forEach((e, i) => setCls(e, 'on', i < (s.sails || 0)));
    for (let i = 0; i < 4; i++) {
      const d = (s.skills || [])[i] || null, sl = this.skills[i];
      sl.set(d, d && (d.icon || 'skill:ship:' + d.id));
      if (d) sl.cool(d.cd || 0, d.cdLeft || 0);
    }
    // compass: heading/wind use the hero `facing` convention (0 = north, positive = counter-clockwise seen from above).
    // The rose turns so the fixed bow marker (top) reads the heading; the wind arrow stays world-relative.
    const hd = s.heading || 0;
    setStyle(this.rose, 'transform', `rotate(${(hd * 180 / Math.PI).toFixed(1)}deg)`);
    setStyle(this.windArrow, 'transform', `rotate(${((hd - (s.wind || 0)) * 180 / Math.PI).toFixed(1)}deg)`);
    setText(this.windT, s.windSpeed != null ? `Wind ${s.windSpeed.toFixed(0)} kn` : 'Wind');
  }
}
