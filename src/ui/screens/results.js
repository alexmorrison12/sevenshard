// Results screen (dungeon / raid / guardian clear or wipe): header with rank medallion, clear-time stats,
// rewards grid with grade frames, DPS meter table, share / retry / continue.
//   data: { kind: 'clear'|'fail', over?: 'Chaos Dungeon', title, sub?, rank?: 'S'|'A'|'B'|'C'|'D', time, best?,
//           stats?: [{ label, value }], loot: [Item], currencies?: { silver, gold, xp },
//           dps: [{ name, cls, dmg, dps, crit, back, counters, stagger, deaths, you, support }],
//           retry?: bool, continueLabel? }
// Actions: results:continue {} · results:retry {} · results:share {} · results:item { uid } (loot slot clicked)
import { h, btn, esc, fmtInt, fmtShort, fmtClockMs, show } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl, itemIcon } from '../core/icon.js';
import { cls as clsInfo } from '../core/data.js';
import { Screen } from './screen.js';

export class ResultsScreen extends Screen {
  static id = 'results';
  build() {
    const el = this.el;
    h('div', 'ss-rs-bg', el);
    const p = this.panel = h('div', 'ss-rs ss-panel ss-orn', el);
    const hd = this.hd = h('header', 'ss-rs-hd', p);
    this.over = h('div', 'ss-rs-over', hd);
    this.title = h('div', 'ss-rs-title', hd);
    this.sub = h('div', 'ss-rs-sub', hd);
    this.rank = h('div', 'ss-rs-rank', p);
    this.rankT = h('b', '', this.rank);
    h('span', '', this.rank, 'Rank');
    this.stats = h('div', 'ss-rs-stats', p);
    const cols = h('div', 'ss-rs-cols', p);
    const L = h('section', 'ss-rs-loot', cols);
    h('div', 'ss-h', L, 'Rewards');
    this.grid = h('div', 'ss-rs-grid', L);
    this.cur = h('div', 'ss-rs-cur', L);
    const R = h('section', 'ss-rs-dps', cols);
    h('div', 'ss-h', R, 'Damage Meter');
    this.table = h('div', 'ss-rs-table', R);
    const ft = h('footer', 'ss-rs-ft', p);
    const share = btn('ss-btn', ft, null, () => this.emit('results:share', {}), 'Share result card');
    share.innerHTML = glyph('share') + '<span>Share</span>';
    this.retry = btn('ss-btn', ft, null, () => this.emit('results:retry', {}), 'Retry');
    this.retry.innerHTML = glyph('refresh') + '<span>Retry</span>';
    h('i', 'ss-rs-sp', ft);
    this.cont = btn('ss-btn ss-btn--primary ss-rs-cont', ft, 'Continue', () => this.emit('results:continue', {}));
  }
  render(d) {
    const fail = d.kind === 'fail';
    this.panel.classList.toggle('is-fail', fail);
    this.over.textContent = d.over || (fail ? 'Defeated' : 'Cleared');
    this.title.textContent = d.title || (fail ? 'Party Wiped' : 'Dungeon Cleared');
    this.sub.textContent = d.sub || '';
    show(this.rank, !!d.rank && !fail);
    this.rankT.textContent = d.rank || '';
    this.rank.dataset.rank = d.rank || '';
    // stats strip
    const st = [];
    if (d.time != null) st.push({ label: 'Clear Time', value: fmtClockMs(d.time), tag: d.best != null && d.time <= d.best ? 'New Record' : null });
    if (d.best != null) st.push({ label: 'Personal Best', value: fmtClockMs(Math.min(d.best, d.time ?? d.best)) });
    for (const s of d.stats || []) st.push(s);
    this.stats.innerHTML = st.map(s => `<div class="ss-rs-stat"><span>${esc(s.label)}</span><b>${esc(s.value)}</b>${s.tag ? `<em>${esc(s.tag)}</em>` : ''}</div>`).join('');
    // loot
    this.grid.textContent = '';
    (d.loot || []).forEach((it, i) => {
      const s = h('div', `ss-slot ss-g${it.grade | 0} ss-ptr ss-rs-item`, this.grid);
      s.style.setProperty('--sz', '56px');
      s.style.animationDelay = (0.25 + i * 0.07) + 's';
      const ic = h('div', 'ss-slot-ic', s); ic.style.backgroundImage = `url("${itemIcon(it.icon || 'item:' + (it.kind || 'material'), 56)}")`;
      if (it.count > 1) h('span', 'ss-slot-n', s, fmtShort(it.count));
      if (it.grade >= 4) h('i', 'ss-rs-shine', s);
      s._tip = { kind: 'item', item: it };
      s.addEventListener('click', () => this.emit('results:item', { uid: it.uid, id: it.id }));
    });
    if (!(d.loot || []).length) h('div', 'ss-rs-none', this.grid, fail ? 'No rewards this time.' : 'No drops.');
    const c = d.currencies || {};
    this.cur.innerHTML = [c.xp ? `<span>${glyph('star')}<b>${fmtInt(c.xp)}</b> XP</span>` : '', c.silver ? `<span><i style="background-image:url('${iconUrl('currency:silver', 18)}')"></i><b>${fmtInt(c.silver)}</b></span>` : '', c.gold ? `<span><i style="background-image:url('${iconUrl('currency:gold', 18)}')"></i><b>${fmtInt(c.gold)}</b></span>` : ''].join('');
    // dps meter
    const rows = [...(d.dps || [])].sort((a, b) => (b.dmg || 0) - (a.dmg || 0));
    const total = rows.reduce((a, r) => a + (r.dmg || 0), 0) || 1, top = rows[0]?.dmg || 1;
    this.table.innerHTML = `<div class="ss-rs-tr ss-rs-th"><span>#</span><span>Player</span><span>Damage</span><span>DPS</span><span>Crit</span><span>Back</span><span title="Counters">★</span></div>` +
      rows.map((r, i) => {
        const c = clsInfo(r.cls);
        return `<div class="ss-rs-tr${r.you ? ' is-you' : ''}" style="--cc:${c.color}">
          <span class="ss-rs-n">${i + 1}</span>
          <span class="ss-rs-who"><i style="background-image:url('${iconUrl('class:' + r.cls, 22)}')"></i><b>${esc(r.name)}</b>${r.support ? `<em>${glyph('cross')}</em>` : ''}${r.deaths ? `<s>${glyph('skull')}${r.deaths}</s>` : ''}<u style="width:${((r.dmg || 0) / top * 100).toFixed(1)}%"></u></span>
          <span><b>${fmtShort(r.dmg || 0)}</b> <small>${((r.dmg || 0) / total * 100).toFixed(1)}%</small></span>
          <span>${fmtShort(r.dps || 0)}</span><span>${r.crit != null ? Math.round(r.crit * 100) + '%' : '–'}</span><span>${r.back != null ? Math.round(r.back * 100) + '%' : '–'}</span><span>${r.counters ?? '–'}</span></div>`;
      }).join('');
    show(this.retry, !!d.retry);
    this.cont.textContent = d.continueLabel || 'Continue';
    this.panel.classList.remove('is-anim'); void this.panel.offsetWidth; this.panel.classList.add('is-anim');
  }
  key(e) { if (e.key === 'Enter' || e.key === 'Escape') { this.emit('results:continue', {}); return true; } return false; }
}
