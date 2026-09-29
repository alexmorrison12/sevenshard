// Sunheart Passive (endgame passive trees, the Ark Passive analog). Three columns — one per tree, tinted by its
// colour — with tiers stacked top (I) to bottom (V). Left-click a node to rank it up, right-click to rank it down.
//   data (src/game/progression/sunheart.js sunView): { unlocked, unlockAt, points, available, iLvl?,
//     trees: [{ id: 'evolution'|'enlightenment'|'leap', name, color, blurb, spent,
//               tiers: [{ tier, gate, open, nodes: [{ id, name, desc, rank, max, cost, can }] }] }] }
// Actions: sunheart:rank { id, delta: +1 | -1 } · sunheart:reset { tree }
import { h, btn, esc, fmtInt, clear, hashStr, mix } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { Win } from '../core/windows.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const NODE_G = ['bolt', 'sword', 'shield', 'flame', 'star', 'heart', 'target', 'sparkle', 'crown', 'gem', 'leaf', 'eye'];

export class SunheartWin extends Win {
  static id = 'sunheart'; static title = 'Sunheart Passive'; static glyph = 'sun'; static width = 1120;
  build() { this.body.classList.add('ss-sh'); }
  render(d) {
    this.d = d;
    const B = this.body; clear(B);
    B.classList.toggle('is-locked', !d.unlocked);
    if (!d.unlocked) return this.locked(d);
    const hd = h('div', 'ss-sh-hd', B);
    hd.innerHTML = `<div class="ss-sh-sun"><i></i>${glyph('sun')}</div>
      <div class="ss-sh-ht"><b>The Sunheart</b><span>Power drawn from the seven Shards. Points come from item level and endgame clears.</span></div>
      <div class="ss-sh-pts"><span>Available</span><b>${fmtInt(d.available ?? 0)}</b><em>/ ${fmtInt(d.points ?? 0)}</em></div>`;
    const cols = h('div', 'ss-sh-cols', B);
    for (const t of d.trees || []) this.tree(cols, t, d);
  }
  tree(parent, t, d) {
    const col = h('section', 'ss-sh-tree', parent);
    const c = t.color || '#c9a45a';
    col.style.setProperty('--tc', c); col.style.setProperty('--tc2', mix(c, '#ffffff', 0.5));
    const th = h('header', 'ss-sh-th', col);
    th.innerHTML = `<div><b>${esc(t.name)}</b><span>${esc(t.blurb || '')}</span></div><em>${fmtInt(t.spent || 0)}<small>spent</small></em>`;
    const rs = btn('ss-btn ss-btn--ghost ss-btn--sm ss-sh-reset', th, null, async () => {
      if (!(t.spent > 0)) return;
      if (await this.ui.confirm({ title: `Reset ${t.name}`, text: `Refund all ${t.spent} points spent in ${t.name}?`, ok: 'Reset' })) this.ui.emit('sunheart:reset', { tree: t.id });
    }, `Reset ${t.name}`);
    rs.innerHTML = glyph('refresh'); rs.disabled = !(t.spent > 0); rs._tip = { title: 'Reset tree' };
    const tiers = h('div', 'ss-sh-tiers ss-scroll', col);
    for (const tr of t.tiers || []) {
      const row = h('div', 'ss-sh-tier' + (tr.open ? '' : ' is-locked'), tiers);
      const lab = h('div', 'ss-sh-tl', row);
      lab.innerHTML = `<b>${ROMAN[tr.tier] || tr.tier}</b>${tr.gate ? `<span>${fmtInt(tr.gate)}</span>` : ''}`;
      lab._tip = { title: `Tier ${ROMAN[tr.tier] || tr.tier}`, lines: [tr.gate ? `Opens after ${tr.gate} points in the tiers above.` : 'Always open.'] };
      const nodes = h('div', 'ss-sh-nodes', row);
      for (const n of tr.nodes || []) {
        const nd = h('button', 'ss-sh-node' + (n.rank > 0 ? ' is-on' : '') + (n.rank >= n.max ? ' is-max' : '') + (n.can ? ' is-can' : ''), nodes);
        nd.type = 'button';
        nd.setAttribute('aria-label', `${n.name}, rank ${n.rank} of ${n.max}`);
        const g = NODE_G[hashStr(n.id) % NODE_G.length];
        nd.innerHTML = `<i class="ss-sh-ng">${glyph(g)}</i><b>${esc(n.name)}</b><span class="ss-sh-pips">${Array.from({ length: n.max }, (_, i) => `<s class="${i < n.rank ? 'on' : ''}"></s>`).join('')}</span><em>${n.rank}/${n.max}</em><small>◆${n.cost}</small>`;
        const why = !tr.open ? 'Tier locked' : n.rank >= n.max ? 'Maximum rank' : (d.available ?? 0) < n.cost ? 'Not enough points' : null;
        nd._tip = { title: `${n.name} · ${n.rank}/${n.max}`, color: c, lines: [n.desc, `Cost ${n.cost} point${n.cost > 1 ? 's' : ''} per rank`, why ? `⛔ ${why}` : n.can ? 'Left-click: rank up · Right-click: rank down' : 'Right-click: rank down'] };
        nd.addEventListener('click', () => { if (tr.open && n.can) this.ui.emit('sunheart:rank', { id: n.id, delta: 1 }); else nd.classList.add('is-deny'), setTimeout(() => nd.classList.remove('is-deny'), 300); });
        nd.addEventListener('contextmenu', e => { e.preventDefault(); if (n.rank > 0) this.ui.emit('sunheart:rank', { id: n.id, delta: -1 }); });
      }
      if (!tr.open) {
        const spentAbove = (t.tiers || []).filter(x => x.tier < tr.tier).reduce((a, x) => a + (x.nodes || []).reduce((b, n) => b + n.rank * n.cost, 0), 0);
        const need = Math.max(0, (tr.gate || 0) - spentAbove);
        const lk = h('div', 'ss-sh-lock', row);
        lk.innerHTML = `${glyph('lock')}<span>Spend ${need} more point${need === 1 ? '' : 's'} in the tiers above</span>`;
      }
    }
  }
  locked(d) {
    const B = this.body;
    const L = h('div', 'ss-sh-locked', B);
    L.innerHTML = `<div class="ss-sh-bigsun"><i class="r1"></i><i class="r2"></i><i class="core"></i>${glyph('sun')}</div>
      <div class="ss-sh-lt">The Sunheart Slumbers</div>
      <div class="ss-sh-ls">It awakens at item level <b>${fmtInt(d.unlockAt || 1400)}</b>${d.iLvl ? ` · yours is <em>${fmtInt(Math.floor(d.iLvl))}</em>` : ''}</div>
      ${d.iLvl ? `<div class="ss-sh-lbar"><i style="transform:scaleX(${Math.min(1, d.iLvl / (d.unlockAt || 1400))})"></i></div>` : ''}
      <div class="ss-sh-ltrees">${(d.trees || [{ name: 'Evolution', color: '#ff9a4a' }, { name: 'Enlightenment', color: '#6fb8ff' }, { name: 'Leap', color: '#9fe07a' }]).map(t => `<span style="--tc:${esc(t.color || '#c9a45a')}"><i></i>${esc(t.name)}</span>`).join('')}</div>
      <p>Three trees of power — Evolution, Enlightenment and Leap — answer to those who carry the Shards far enough. Hone your gear and return.</p>`;
  }
}
