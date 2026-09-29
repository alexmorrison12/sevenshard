// DPS meter / combat log (toggle Y). Compact, draggable; push fresh data with ui.update('meter', data) ~2×/s.
//   data: { title?, time (s), rows: [{ name, cls, dmg, dps?, crit?, back?, counters?, you?, support?, dead? }],
//           skills?: [{ id, name, icon, dmg, hits?, crit? }] (your breakdown), log?: [{ t, text, kind }] }
//   log kinds: dmg heal death mech buff loot
// Actions: meter:reset {}
import { h, btn, esc, fmtShort, fmtClock } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { tabs } from '../core/kit.js';
import { cls as clsInfo } from '../core/data.js';
import { Win } from '../core/windows.js';

export class MeterWin extends Win {
  static id = 'meter'; static title = 'Damage Meter'; static glyph = 'bolt'; static width = 360; static pos = { right: 16, y: 300 };
  build() {
    const b = this.body;
    b.classList.add('ss-mt');
    const reset = btn('ss-close', this.tools, null, () => this.ui.emit('meter:reset', {}), 'Reset meter');
    reset.innerHTML = glyph('refresh');
    reset._tip = { title: 'Reset' };
    this.tab = 'damage';
    this.tabs = tabs(b, [{ id: 'damage', label: 'Damage' }, { id: 'skills', label: 'Skills' }, { id: 'log', label: 'Log' }], this.tab, id => { this.tab = id; this.render(this.d || {}); });
    this.sub = h('div', 'ss-mt-sub', b);
    this.out = h('div', 'ss-mt-out ss-scroll', b);
  }
  render(d) {
    this.d = d;
    const rows = [...(d.rows || [])].sort((a, b) => (b.dmg || 0) - (a.dmg || 0));
    const total = rows.reduce((a, r) => a + (r.dmg || 0), 0);
    const t = Math.max(1, d.time || 0);
    this.sub.innerHTML = `<span>${esc(d.title || 'Current fight')}</span><span>${glyph('clock')} ${fmtClock(d.time || 0)}</span><span><b>${fmtShort(total / t)}</b> party DPS</span>`;
    const o = this.out;
    if (this.tab === 'damage') {
      const top = rows[0]?.dmg || 1;
      o.innerHTML = rows.map((r, i) => {
        const c = clsInfo(r.cls);
        return `<div class="ss-mt-row${r.you ? ' is-you' : ''}${r.dead ? ' is-dead' : ''}" style="--cc:${c.color}"><u style="width:${((r.dmg || 0) / top * 100).toFixed(1)}%"></u>
          <span class="ss-mt-n">${i + 1}</span><i style="background-image:url('${iconUrl('class:' + r.cls, 20)}')"></i><b>${esc(r.name)}</b>
          <span class="ss-mt-v">${fmtShort(r.dmg || 0)}</span><span class="ss-mt-d">${fmtShort(r.dps ?? (r.dmg || 0) / t)}</span><span class="ss-mt-p">${total ? ((r.dmg || 0) / total * 100).toFixed(1) : '0.0'}%</span></div>`;
      }).join('') || '<div class="ss-empty">No damage yet.</div>';
    } else if (this.tab === 'skills') {
      const sk = [...(d.skills || [])].sort((a, b) => (b.dmg || 0) - (a.dmg || 0));
      const st = sk.reduce((a, s) => a + (s.dmg || 0), 0) || 1, top = sk[0]?.dmg || 1;
      o.innerHTML = sk.map(s => `<div class="ss-mt-row ss-mt-sk"><u style="width:${((s.dmg || 0) / top * 100).toFixed(1)}%"></u><i class="sq" style="background-image:url('${iconUrl(s.icon, 22)}')"></i><b>${esc(s.name)}</b>
        <span class="ss-mt-v">${fmtShort(s.dmg || 0)}</span><span class="ss-mt-d">${s.crit != null ? Math.round(s.crit * 100) + '% crit' : s.hits != null ? s.hits + ' hits' : ''}</span><span class="ss-mt-p">${((s.dmg || 0) / st * 100).toFixed(1)}%</span></div>`).join('') || '<div class="ss-empty">No skill data yet.</div>';
    } else {
      o.innerHTML = (d.log || []).slice(-120).map(l => `<div class="ss-mt-log is-${esc(l.kind || 'dmg')}"><span>${fmtClock(l.t || 0)}</span>${esc(l.text)}</div>`).join('') || '<div class="ss-empty">The log is empty.</div>';
      o.scrollTop = o.scrollHeight;
    }
  }
}
