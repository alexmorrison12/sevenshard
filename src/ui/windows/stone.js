// Ability stone faceting: 3 lines × 10 facets (two engravings + one negative). Each attempt succeeds at the shown
// chance, which moves −10% after a success and +10% after a failure (clamped 25–75%). The finished stone gets a
// big "9 / 7 / 2" result with a share button.
//   data: { stones?: [Item], stone: Item (engr: [{id},{id}], neg: {id}, facets: [[1|0|null ×10] ×3]),
//           chance: 0..1, cost?: { silver }, currencies?, last?: { line, ok }, lastKey?: any }
// Actions: stone:select { uid } · stone:facet { uid, line: 0|1|2 } · stone:share { uid }
import { h, btn, esc, fmtInt, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { slot } from '../core/kit.js';
import { engr, engrIcon, grade } from '../core/data.js';
import { Win } from '../core/windows.js';

export class StoneWin extends Win {
  static id = 'stone'; static title = 'Ability Stone'; static glyph = 'gem'; static width = 860;
  build() {
    const b = this.body; b.classList.add('ss-st');
    this.list = h('div', 'ss-st-list ss-scroll', b);
    this.main = h('div', 'ss-st-main', b);
  }
  render(d) {
    const prevChance = this.d?.chance;
    this.d = d;
    const s = d.stone;
    clear(this.list);
    for (const x of d.stones || (s ? [s] : [])) {
      const r = h('div', 'ss-st-li ss-ptr' + (s && x.uid === s.uid ? ' is-sel' : ''), this.list);
      r.appendChild(slot(x, { size: 40 }));
      const sc = (x.facets || []).map(l => l.filter(v => v === 1).length);
      h('div', 'ss-st-lt', r).innerHTML = `<b style="color:${grade(x.grade).c}">${esc(x.name || 'Ability Stone')}</b><span>${sc.length ? sc.join(' / ') : 'Uncut'}</span>`;
      r.addEventListener('click', () => this.ui.emit('stone:select', { uid: x.uid }));
    }
    const M = this.main; clear(M);
    if (!s) { h('div', 'ss-empty', M, 'Choose an ability stone to facet.'); return; }
    const lines = [...(s.engr || []).slice(0, 2).map(e => ({ ...e, neg: false })), s.neg ? { ...s.neg, neg: true } : null].filter(Boolean);
    const facets = s.facets || [[], [], []];
    const done = facets.every(l => l.length >= 10 && l.every(v => v === 0 || v === 1));
    const chance = d.chance ?? 0.75;
    const hd = h('div', 'ss-st-hd', M);
    const big = slot(s, { size: 72 }); hd.appendChild(big);
    h('div', 'ss-st-ht', hd).innerHTML = `<b style="color:${grade(s.grade).c}">${esc(s.name || 'Ability Stone')}</b><span>${done ? 'Faceting complete' : 'Each facet succeeds or fails; the chance shifts after every attempt.'}</span>`;
    const ring = h('div', 'ss-st-ring' + (done ? ' is-done' : ''), hd);
    ring.style.setProperty('--p', chance);
    ring.innerHTML = `<b>${Math.round(chance * 100)}%</b><span>Success</span>`;
    if (prevChance != null && prevChance !== chance && !done) {
      const dlt = h('em', 'ss-st-delta ' + (chance > prevChance ? 'is-up' : 'is-down'), ring, `${chance > prevChance ? '+' : '−'}${Math.round(Math.abs(chance - prevChance) * 100)}%`);
      void dlt;
    }
    const L = h('div', 'ss-st-lines', M);
    lines.forEach((e, li) => {
      const E = engr(e.id), row = facets[li] || [];
      const nodes = row.filter(v => v === 1).length, tries = row.filter(v => v === 0 || v === 1).length;
      const r = h('div', 'ss-st-line' + (e.neg ? ' is-neg' : '') + (d.last && d.last.line === li && d.lastKey !== this._lk ? (d.last.ok ? ' is-hit' : ' is-miss') : ''), L);
      r.innerHTML = `<i class="ss-st-ei" style="background-image:url('${iconUrl(engrIcon(e.id), 32)}')"></i><div class="ss-st-en"><b>${esc(E.name)}</b><span>${e.neg ? 'Negative engraving' : 'Engraving'}</span></div>
        <div class="ss-st-cells">${Array.from({ length: 10 }, (_, i) => { const v = row[i]; return `<i class="${v === 1 ? 'on' : v === 0 ? 'off' : ''}${i === tries - 1 && d.last?.line === li ? ' is-last' : ''}"></i>`; }).join('')}</div>
        <div class="ss-st-n"><b>+${nodes}</b><span>${tries}/10</span></div>`;
      const b = btn('ss-btn ss-btn--sm ' + (e.neg ? 'ss-btn--danger' : 'ss-btn--primary'), r, 'Facet', () => this.ui.emit('stone:facet', { uid: s.uid, line: li }), `Facet ${E.name}`);
      b.disabled = tries >= 10;
    });
    this._lk = d.lastKey;
    const ft = h('div', 'ss-st-ft', M);
    if (done) {
      const sc = facets.map(l => l.filter(v => v === 1).length);
      const great = sc[0] + sc[1] >= 16;
      const res = h('div', 'ss-st-res' + (great ? ' is-great' : ''), ft);
      res.innerHTML = `<span>Result</span><b>${sc[0]}<i>/</i>${sc[1]}<i>/</i><em>${sc[2]}</em></b>${great ? `<strong>${sc[0]}${sc[1]} Stone!</strong>` : ''}`;
      const sh = btn('ss-btn', ft, null, () => this.ui.emit('stone:share', { uid: s.uid }), 'Share stone'); sh.innerHTML = glyph('share') + '<span>Share</span>';
    } else {
      const c = d.cost || {};
      h('div', 'ss-st-cost', ft).innerHTML = c.silver ? `Cost per facet <i style="background-image:url('${iconUrl('currency:silver', 16)}')"></i><b>${fmtInt(c.silver)}</b>` : '';
      h('div', 'ss-st-hint', ft, 'Chance −10% after a success, +10% after a failure (25–75%).');
    }
  }
}
