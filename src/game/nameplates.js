// Floating names over NPCs, players, elites and bosses (Lost Ark style: gold NPC names with <titles>, white player
// names with guild tags, red elite names with a slim HP bar). DOM labels pooled and positioned per frame.
const CSS = `
.ss-np-layer{position:fixed;inset:0;pointer-events:none;z-index:4;overflow:hidden}
.ss-np{position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;text-align:center;font:600 13px/1.15 "Segoe UI",Roboto,system-ui,sans-serif;color:#f4f1e8;text-shadow:0 1px 2px #000,0 0 4px rgba(0,0,0,.9);will-change:transform;transition:opacity .2s}
.ss-np b{display:block;font-weight:700;letter-spacing:.01em}
.ss-np i{display:block;font:500 11px/1.2 "Segoe UI",Roboto,system-ui,sans-serif;font-style:normal;color:#d7c9a0;opacity:.95}
.ss-np.npc b{color:#ffd76a}
.ss-np.npc i{color:#e8d9b0}
.ss-np.party b{color:#7fd4ff}
.ss-np.elite b{color:#ff8a5a}
.ss-np.boss b{color:#ff5a4a;font-size:15px}
.ss-np .hp{width:64px;height:4px;margin:3px auto 0;background:rgba(0,0,0,.6);border:1px solid rgba(0,0,0,.8)}
.ss-np .hp s{display:block;height:100%;background:linear-gradient(#ff6a4a,#b01a10);text-decoration:none}
.ss-np.party .hp s{background:linear-gradient(#6aff8a,#1a9a3a)}
.ss-np .tl{color:#b9a3ff;font:600 11px/1.2 "Segoe UI",Roboto,system-ui,sans-serif}
`;
let styled = false;
export class Nameplates {
  constructor(game) {
    if (!styled) { styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
    this.game = game; this.layer = document.createElement('div'); this.layer.className = 'ss-np-layer'; document.body.appendChild(this.layer);
    this.map = new Map(); this.p = { x: 0, y: 0 }; this.enabled = true;
  }
  plate(u) {
    let el = this.map.get(u);
    if (!el) {
      el = document.createElement('div'); el.className = 'ss-np';
      const me = this.game.hero?.u;
      const party = u.kind === 'hero' && u.team === 0 && u !== me;
      el.classList.add(u.kind === 'npc' ? 'npc' : u.kind === 'boss' ? 'boss' : u.data.elite ? 'elite' : party ? 'party' : 'player');
      const title = u.kind === 'npc' ? (u.data.title ? `&lt;${esc(u.data.title)}&gt;` : '') : u.data.guild ? `&lt;${esc(u.data.guild)}&gt;` : '';
      const hp = u.kind === 'mob' || party ? '<div class="hp"><s></s></div>' : '';
      el.innerHTML = `${u.data.title && u.kind !== 'npc' ? `<span class="tl">${esc(u.data.title)}</span>` : ''}<b>${esc(u.name)}</b>${title ? `<i>${title}</i>` : ''}${hp}`;
      el._hp = el.querySelector('.hp s');
      this.layer.appendChild(el); this.map.set(u, el);
    }
    return el;
  }
  update() {
    const g = this.game, L = g.level, me = g.hero?.u;
    if (!L || !this.enabled || !me) { for (const el of this.map.values()) el.style.display = 'none'; return; }
    const seen = new Set();
    for (const u of L.units) {
      if (u === me || u.dead || u.data.noModel) continue;
      const show = u.kind === 'npc' || (u.kind === 'hero') || (u.kind === 'mob' && (u.data.elite || u.hp < u.hpMax)) ;
      if (!show || u.kind === 'boss') continue;
      const d = Math.hypot(u.pos.x - me.pos.x, u.pos.z - me.pos.z);
      if (d > (u.kind === 'npc' ? 26 : 22)) continue;
      const s = g.cam.toScreen({ x: u.pos.x, y: u.pos.y + (u.model?.height || u.height) + 0.35, z: u.pos.z }, this.p);
      if (!s) continue;
      const el = this.plate(u); seen.add(u);
      el.style.display = '';
      el.style.transform = `translate(${s.x | 0}px,${s.y | 0}px) translate(-50%,-100%)`;
      if (el._hp) el._hp.style.width = `${Math.max(0, u.hp / u.hpMax * 100)}%`;
    }
    for (const [u, el] of this.map) if (!seen.has(u)) { if (!L.byId.has(u.id)) { el.remove(); this.map.delete(u); } else el.style.display = 'none'; }
  }
  clear() { for (const el of this.map.values()) el.remove(); this.map.clear(); }
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
