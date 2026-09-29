// Local player controller: mouse movement (hold or click, pathing around walls), skills aimed at the cursor,
// dash, identity, awakening, battle items, basic attack. Also supports a gamepad (left stick move, right stick aim)
// and a touch layer that calls the same methods.
import { SLOT_KEYS } from './hero.js';

export class PlayerCtrl {
  constructor(kit, game) {
    this.kit = kit; this.u = kit.u; this.game = game;
    this.aim = { x: this.u.pos.x, z: this.u.pos.z - 3 };
    this.dest = null; this.path = null; this.moveBtn = 2; // right mouse by default (Lost Ark style)
    this.stick = null;         // touch / gamepad movement vector
    this.touchAim = null;
    this.held = new Set();
    this.u.ctrl = this;
  }
  setMoveButton(which) { this.moveBtn = which === 'left' ? 0 : 2; }
  /** called by the game each frame before the level update */
  input(dt, inp, cam) {
    const u = this.u, kit = this.kit;
    if (!inp.enabled || u.dead) { u.move.x = u.move.z = 0; this.dest = null; return; }
    // aim from cursor (mouse) unless a stick/touch aim is active
    if (this.touchAim) { this.aim.x = this.touchAim.x; this.aim.z = this.touchAim.z; }
    else { const p = cam.groundAt(inp.mouse.x, inp.mouse.y, u.pos.y); this.aim.x = p.x; this.aim.z = p.z; }
    const pad = inp.pad();
    if (pad) this.padInput(pad, dt);
    // movement
    const atkBtn = this.moveBtn === 2 ? 0 : 2;
    if (inp.btn(this.moveBtn) && inp.mouse.over && !this.game.hoverTarget) this.setDest(this.aim.x, this.aim.z, inp.clicked(this.moveBtn));
    // skills
    for (let i = 0; i < 8; i++) {
      if (inp.hit('skill' + i)) { this.cast(i); }
      if (inp.up('skill' + i)) kit.release(i);
    }
    if (inp.hit('dash')) this.dash();
    if (inp.hit('idZ')) this.identity('z');
    if (inp.hit('idX')) this.identity('x');
    if (inp.hit('awaken')) this.awaken();
    for (let i = 0; i < 4; i++) if (inp.hit('item' + i)) kit.useItem(i, this.aim);
    if (inp.down('basic') || (inp.btn(atkBtn) && inp.mouse.over && !this.game.hoverTarget && this.game.basicOnClick !== false)) this.basic();
  }
  cast(slot) { if (this.kit.press(slot, this.aim)) this.stop(); }
  dash() { if (this.kit.dash(this.aim)) this.stop(); }
  identity(k) { if (this.kit.identityKey(k, this.aim)) this.stop(); }
  awaken() { if (this.kit.awakenCast(this.aim)) this.stop(); }
  basic() { if (this.kit.basic(this.aim)) this.stop(); }
  stop() { this.dest = null; this.path = null; }
  setDest(x, z, fresh = true) {
    const u = this.u, L = this.game.level;
    const p = L.nav.nearest(x, z, 8, 0.3) || { x, z };
    if (!fresh && this.dest && Math.hypot(p.x - this.dest.x, p.z - this.dest.z) < 0.4) return;
    this.dest = p;
    this.path = L.nav.los(u.pos.x, u.pos.z, p.x, p.z, 0.3) ? [p] : L.nav.path(u.pos.x, u.pos.z, p.x, p.z, 0.3) || [p];
    if (fresh) this.game.emitClickMarker?.(p);
  }
  /** level update hook (runs inside Level.update before skills/movement) */
  update(dt, L) {
    const u = this.u;
    this.kit.update(dt);
    u.move.x = u.move.z = 0;
    if (u.skill || u.disabled) { if (u.skill && !u.skill.def.basic && !u.skill.def.loop) this.path = this.path; return; }
    if (this.stick && (this.stick.x || this.stick.z)) {
      const s = u.st.speed; u.move.x = this.stick.x * s; u.move.z = this.stick.z * s; this.path = null; return;
    }
    if (!this.path || !this.path.length) return;
    const p = this.path[0];
    const dx = p.x - u.pos.x, dz = p.z - u.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { this.path.shift(); if (!this.path.length) this.dest = null; return; }
    const s = u.st.speed;
    u.move.x = dx / d * s; u.move.z = dz / d * s;
    if (u.blocked && d < 1) this.path.shift();
  }
  padInput(p, dt) {
    const dz = v => Math.abs(v) < 0.18 ? 0 : v;
    const lx = dz(p.axes[0]), ly = dz(p.axes[1]), rx = dz(p.axes[2]), ry = dz(p.axes[3]);
    this.stick = { x: lx, z: ly };
    const u = this.u;
    if (rx || ry) { const n = Math.hypot(rx, ry); this.aim.x = u.pos.x + rx / n * 7; this.aim.z = u.pos.z + ry / n * 7; }
    else if (lx || ly) { this.aim.x = u.pos.x + lx * 6; this.aim.z = u.pos.z + ly * 6; }
    const prev = this._pb || [];
    const b = p.buttons.map(x => x.pressed);
    const edge = i => b[i] && !prev[i], up = i => !b[i] && prev[i];
    // A X Y B → Q W E R ; LB/RB with face buttons → A S D F ; LT dash ; RT basic ; LS click Z ; RS click X ; Start = menu ; Select/back = awaken
    const shift = b[4] || b[5];
    const map = [[0, 0], [2, 1], [3, 2], [1, 3]];
    for (const [btn, slot] of map) { const s = shift ? slot + 4 : slot; if (edge(btn)) this.cast(s); if (up(btn)) this.kit.release(s); }
    if (edge(6)) this.dash();
    if (b[7]) this.basic();
    if (edge(10)) this.identity('z');
    if (edge(11)) this.identity('x');
    if (edge(8)) this.awaken();
    for (let i = 0; i < 4; i++) if (edge(12 + i)) this.kit.useItem(i, this.aim);
    this._pb = b;
  }
}
export { SLOT_KEYS };
