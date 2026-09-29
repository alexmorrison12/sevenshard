// Phone / tablet controls (landscape): a floating virtual joystick on the left half, the UI's touch skill cluster on
// the right (touch:skill events), tap to basic-attack, pinch to zoom. Skills auto-aim at the nearest enemy (Lost Ark
// Mobile style) or along the stick.
export class TouchControls {
  constructor(game) {
    this.game = game; this.on = false; this.stickId = null; this.origin = null; this.vec = { x: 0, z: 0 };
    this.pinch = null; this.touches = new Map();
    const el = this.el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:0;top:0;width:180px;height:180px;margin:-90px 0 0 -90px;border-radius:50%;pointer-events:none;z-index:19;display:none;background:radial-gradient(circle,rgba(255,255,255,.08),rgba(255,255,255,.02) 60%,transparent 70%);border:1.5px solid rgba(241,220,166,.35)';
    const knob = this.knob = document.createElement('div');
    knob.style.cssText = 'position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(255,240,200,.55),rgba(201,164,90,.35));border:1.5px solid rgba(241,220,166,.6);box-shadow:0 0 18px rgba(0,0,0,.4)';
    el.appendChild(knob); document.body.appendChild(el);
    const cv = game.renderer.canvas;
    cv.addEventListener('touchstart', e => this.start(e), { passive: false });
    cv.addEventListener('touchmove', e => this.move(e), { passive: false });
    cv.addEventListener('touchend', e => this.end(e), { passive: false });
    cv.addEventListener('touchcancel', e => this.end(e), { passive: false });
  }
  enable(on) { this.on = on; if (!on) this.release(); }
  start(e) {
    if (!this.on) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      this.touches.set(t.identifier, { x: t.clientX, y: t.clientY, t: performance.now() });
      if (this.stickId == null && t.clientX < innerWidth * 0.45) {
        this.stickId = t.identifier; this.origin = { x: t.clientX, y: t.clientY };
        this.el.style.display = 'block'; this.el.style.left = t.clientX + 'px'; this.el.style.top = t.clientY + 'px'; this.knob.style.transform = '';
      }
    }
    if (this.touches.size === 2 && this.stickId == null) { const [a, b] = [...this.touches.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  }
  move(e) {
    if (!this.on) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const rec = this.touches.get(t.identifier); if (rec) { rec.x = t.clientX; rec.y = t.clientY; }
      if (t.identifier === this.stickId) {
        let dx = t.clientX - this.origin.x, dy = t.clientY - this.origin.y;
        const d = Math.hypot(dx, dy), max = 70;
        if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        this.knob.style.transform = `translate(${dx}px,${dy}px)`;
        const k = Math.min(1, d / max);
        this.vec = d > 8 ? { x: dx / (Math.hypot(dx, dy) || 1) * k, z: dy / (Math.hypot(dx, dy) || 1) * k } : { x: 0, z: 0 };
      }
    }
    if (this.pinch && this.touches.size === 2) { const [a, b] = [...this.touches.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.game.cam.zoomBy((this.pinch - d) * 0.03); this.pinch = d; }
  }
  end(e) {
    if (!this.on) return;
    for (const t of e.changedTouches) {
      const rec = this.touches.get(t.identifier); this.touches.delete(t.identifier);
      if (t.identifier === this.stickId) this.release();
      else if (rec && performance.now() - rec.t < 250 && t.clientX >= innerWidth * 0.45) this.tap(t.clientX, t.clientY);
    }
    if (this.touches.size < 2) this.pinch = null;
  }
  release() { this.stickId = null; this.vec = { x: 0, z: 0 }; this.el.style.display = 'none'; }
  tap(x, y) {
    const g = this.game, p = g.player; if (!p) return;
    const pt = g.cam.groundAt(x, y, g.hero.u.pos.y);
    const t = this.nearest(14);
    p.touchAim = t ? { x: t.pos.x, z: t.pos.z } : { x: pt.x, z: pt.z };
    p.aim.x = p.touchAim.x; p.aim.z = p.touchAim.z;
    p.basic();
  }
  nearest(r) { const g = this.game; return g.level?.nearestEnemy(g.hero.u, r) || null; }
  /** aim for a touch skill: nearest enemy, else along the stick, else forward */
  aim() {
    const u = this.game.hero.u, t = this.nearest(14);
    if (t) return { x: t.pos.x, z: t.pos.z };
    const v = this.vec; if (v.x || v.z) return { x: u.pos.x + v.x * 6, z: u.pos.z + v.z * 6 };
    return { x: u.pos.x + u.fx * 6, z: u.pos.z + u.fz * 6 };
  }
  key(key, phase) {
    const g = this.game, p = g.player, kit = g.hero; if (!p || !kit) return;
    const a = this.aim(); p.touchAim = a; p.aim.x = a.x; p.aim.z = a.z;
    const slot = 'QWERASDF'.indexOf(key);
    if (slot >= 0) { if (phase === 'down') p.cast(slot); else kit.release(slot); return; }
    if (phase !== 'down') return;
    if (key === 'Space') p.dash(); else if (key === 'Z') p.identity('z'); else if (key === 'X') p.identity('x'); else if (key === 'V') p.awaken();
    else if (/^[1-4]$/.test(key)) kit.useItem(+key - 1, a);
  }
  update() {
    const p = this.game.player; if (!this.on || !p) return;
    p.stick = (this.vec.x || this.vec.z) ? { x: this.vec.x, z: this.vec.z } : null;
    if (!p.stick && this.touches.size === 0) p.touchAim = null;
  }
}
