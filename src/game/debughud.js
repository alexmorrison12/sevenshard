// Bare-bones HUD for dev testing before the real UI is wired (and as a fallback). Reads the same HudState.
export class DebugHud {
  constructor() {
    const el = this.el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:20;font:600 12px system-ui;color:#fff;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none';
    el.innerHTML = `<div id="dh-id" style="width:360px;height:8px;background:#222;border:1px solid #555"><i style="display:block;height:100%;width:0;background:#f33"></i></div>
      <div style="display:flex;gap:8px;align-items:center"><div id="dh-hp" style="width:220px;height:14px;background:#300;border:1px solid #733;position:relative"><i style="display:block;height:100%;background:linear-gradient(#e33,#911)"></i><b style="position:absolute;inset:0;text-align:center;font-size:11px;line-height:14px"></b></div>
      <div id="dh-mp" style="width:220px;height:14px;background:#003;border:1px solid #337;position:relative"><i style="display:block;height:100%;background:linear-gradient(#39f,#136)"></i></div></div>
      <div id="dh-sk" style="display:grid;grid-template-columns:repeat(4,46px);gap:4px"></div><div id="dh-misc" style="font-size:11px;color:#bbb"></div>`;
    document.body.appendChild(el);
    this.sk = el.querySelector('#dh-sk');
    this.cells = [];
    for (let i = 0; i < 8; i++) { const c = document.createElement('div'); c.style.cssText = 'width:46px;height:46px;background:#1a1f2e;border:1px solid #445;position:relative;font-size:9px;overflow:hidden'; c.innerHTML = '<span style="position:absolute;left:2px;top:1px;color:#ffd98a"></span><em style="position:absolute;left:2px;bottom:2px;right:2px;font-style:normal;line-height:1.05"></em><i style="position:absolute;inset:0;background:rgba(0,0,0,.65);transform-origin:bottom;transform:scaleY(0)"></i><b style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px"></b>'; this.sk.appendChild(c); this.cells.push(c); }
    this.boss = document.createElement('div');
    this.boss.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);width:560px;z-index:20;font:600 13px system-ui;color:#fff;text-align:center;display:none;pointer-events:none';
    this.boss.innerHTML = '<div id="db-n"></div><div style="height:16px;background:#200;border:1px solid #844;position:relative"><i style="display:block;height:100%;background:#c22"></i><b style="position:absolute;right:6px;top:0;font-size:12px"></b></div><div id="db-st" style="height:6px;margin-top:3px;background:#213;display:none"><i style="display:block;height:100%;background:#a5f"></i></div>';
    document.body.appendChild(this.boss);
  }
  update(h) {
    const pct = (a, b) => `${Math.max(0, Math.min(100, a / b * 100))}%`;
    this.el.querySelector('#dh-hp i').style.width = pct(h.hp, h.hpMax);
    this.el.querySelector('#dh-hp b').textContent = `${Math.round(h.hp).toLocaleString()} / ${h.hpMax.toLocaleString()}${h.shield ? ` (+${Math.round(h.shield).toLocaleString()})` : ''}`;
    this.el.querySelector('#dh-mp i').style.width = pct(h.mp, h.mpMax);
    const id = h.identity; if (id) { const i = this.el.querySelector('#dh-id i'); i.style.width = pct(id.value, id.max); i.style.background = id.active ? '#fc3' : id.color || '#f33'; }
    h.skills.forEach((s, i) => {
      const c = this.cells[i]; c.querySelector('span').textContent = 'QWERASDF'[i];
      c.querySelector('em').textContent = s ? s.name : '';
      c.querySelector('i').style.transform = `scaleY(${s && s.cd ? Math.min(1, s.cdLeft / s.cd) : 0})`;
      c.querySelector('b').textContent = s && s.cdLeft > 0 ? Math.ceil(s.cdLeft) : '';
    });
    this.el.querySelector('#dh-misc').textContent = `Space ${h.dash.cdLeft > 0 ? Math.ceil(h.dash.cdLeft) : 'ready'} · V awaken ×${h.awaken?.uses ?? 0}${h.awaken?.cdLeft > 0 ? ` (${Math.ceil(h.awaken.cdLeft)})` : ''} · ${id?.label || ''} ${id ? Math.round(id.value) : ''}${id?.orbs != null ? ` orbs ${id.orbs}` : ''}${id?.stance ? ` [${id.stance}]` : ''} · iLvl ${h.iLvl} · ${h.fps} fps`;
    const b = h.boss;
    this.boss.style.display = b ? 'block' : 'none';
    if (b) {
      this.boss.querySelector('#db-n').textContent = `${b.name} — ${b.title || ''}  ×${Math.ceil(b.hp / b.barHp)}`;
      this.boss.querySelector('i').style.width = pct(b.hp % b.barHp || (b.hp > 0 ? b.barHp : 0), b.barHp);
      this.boss.querySelector('b').textContent = `${Math.round(b.hp / b.hpMax * 100)}%`;
      const st = this.boss.querySelector('#db-st'); st.style.display = b.stagger ? 'block' : 'none'; if (b.stagger) st.querySelector('i').style.width = pct(b.stagger.v, b.stagger.max);
    }
  }
}
