// Honing (blacksmith): pick a piece, see materials / silver / gold, success chance (base + failure bonus + boosters),
// Artisan's Energy, add Solar boosters, strike the hammer. Success and failure get their own big moment.
//   data: { items?: [Item] (honable pieces, left list), item: Item (selected, with hone, iLvl),
//           iLvlFrom?, iLvlTo?, gains?: [{ label, from, to }],
//           chance: { base, bonus, boosters?, total } (0..1; bonus = failure bonus so far), maxBonus?,
//           energy: 0..1 (Artisan's Energy; 1 = guaranteed), mats: [{ id, name, icon, grade, need, have }],
//           cost: { silver, gold }, currencies: { silver, gold },
//           boosters: [{ id, name, icon, grade, have, max, add (chance per piece, 0..1) }],
//           result?: 'success'|'fail', resultKey?: any (change it to replay the moment), streak?, maxed?,
//           support?: { name, desc, ends (ms) } (weekly Honing Support), expected?: { taps, p90? },
//           transfer?: { ok, msg?, to: { set, hone, iLvl } } (reforge path), stats?: { taps, wins }, emptyMsg? }
// With no honable pieces the window shows an empty state (emptyMsg or the story-gear hint).
// Actions: hone:select { uid } · hone:tap { uid, boosters: { [id]: n } } · hone:booster { id, n }
// The window also exposes play('success'|'fail', { hone, energy }) for callers that prefer a method.
import { h, btn, esc, fmtInt, fmt2, clear, clamp, pretty } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { itemIcon, iconUrl } from '../core/icon.js';
import { slot } from '../core/kit.js';
import { grade } from '../core/data.js';
import { Win } from '../core/windows.js';

const pct = v => (Math.round((v || 0) * 1000) / 10).toFixed(v * 100 % 1 ? 1 : 0) + '%';
const daysLeft = sec => sec >= 86400 ? `${Math.floor(sec / 86400)}d ${Math.floor(sec % 86400 / 3600)}h` : sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor(sec % 3600 / 60)}m` : sec > 0 ? `${Math.ceil(sec / 60)}m` : '';

export class HoningWin extends Win {
  static id = 'honing'; static title = 'Honing'; static glyph = 'anvil'; static width = 900;
  build() {
    const b = this.body;
    b.classList.add('ss-hn');
    this.list = h('div', 'ss-hn-list ss-scroll', b);
    const main = this.main = h('div', 'ss-hn-main', b);
    this.head = h('div', 'ss-hn-head', main);
    this.anvil = h('div', 'ss-hn-anvil', main);
    this.stage = h('div', 'ss-hn-stage', this.anvil);
    this.itemSlot = h('div', 'ss-hn-item', this.stage);
    this.ring = h('div', 'ss-hn-ring', this.stage);
    this.ringT = h('div', 'ss-hn-ringt', this.stage);
    const col = h('div', 'ss-hn-col', main);
    this.chanceEl = h('div', 'ss-hn-chance', col);
    this.energyEl = h('div', 'ss-hn-energy ss-ptr', col);
    this.energyEl._tip = { title: "Artisan's Energy", lines: ['Every failed attempt adds energy (46.5% of that attempt\'s chance). At 100% the next attempt cannot fail.'] };
    h('div', 'ss-h', col, 'Materials');
    this.mats = h('div', 'ss-hn-mats', col);
    h('div', 'ss-h', col, 'Boosters');
    this.boost = h('div', 'ss-hn-boost', col);
    const ft = h('div', 'ss-hn-ft', main);
    this.costEl = h('div', 'ss-hn-cost', ft);
    this.shortEl = h('div', 'ss-hn-short', ft);
    this.empty = h('div', 'ss-hn-empty', main);
    this.hammer = btn('ss-hn-hammer', ft, null, () => this.tap(), 'Hone');
    this.hammer.innerHTML = `<span class="ss-hn-hg">${glyph('hammer')}</span><b>Hone</b>`;
    this.fx = h('div', 'ss-hn-fx', this.el);
    this.used = {};
    this.lastKey = undefined;
  }
  render(d) {
    this.d = d;
    const it = d.item;
    // left: honable pieces
    clear(this.list);
    const items = d.items || (it ? [it] : []);
    for (const x of items) {
      const r = h('div', 'ss-hn-li ss-ptr' + (it && x.uid === it.uid ? ' is-sel' : ''), this.list);
      r.appendChild(slot(x, { size: 42, tip: true }));
      const t = h('div', 'ss-hn-lt', r);
      t.innerHTML = `<b style="color:${grade(x.grade).c}">+${x.hone || 0} ${esc(shortName(x))}</b><span>${x.iLvl ? 'iLvl ' + fmtInt(x.iLvl) : ''}</span>`;
      r.addEventListener('click', () => { this.used = {}; this.ui.emit('hone:select', { uid: x.uid }); });
    }
    // weekly Honing Support + your record, pinned under the list
    if (d.support || d.stats?.taps) {
      const sp = h('div', 'ss-hn-sup', this.list);
      if (d.support) {
        const left = d.support.ends ? daysLeft((d.support.ends - Date.now()) / 1000) : '';
        sp.innerHTML = `<div class="ss-hn-suph">${glyph('sparkle')}<span>Honing Support</span>${left ? `<em>${left}</em>` : ''}</div><b>${esc(d.support.name || '')}</b><p>${esc(d.support.desc || '')}</p>`;
      }
      if (d.stats?.taps) h('div', 'ss-hn-rec', sp).innerHTML = `<span>Your record</span><b>${fmtInt(d.stats.wins || 0)}</b> successes · ${fmtInt(d.stats.taps)} taps`;
    }
    this.body.classList.toggle('is-empty', !it);
    if (!it) {
      clear(this.head);
      this.empty.innerHTML = items.length
        ? `${glyph('anvil')}<b>Select a piece of gear</b><span>Choose a piece on the left to see its chance, materials and boosters.</span>`
        : `${glyph('anvil')}<b>Nothing to hone yet</b><span>${esc(d.emptyMsg || 'Story gear can’t be honed. Reach level 50 or use a Powerpass to receive Vanguard gear.')}</span>`;
      return;
    }
    const g = grade(it.grade), next = (it.hone || 0) + 1;
    this.head.innerHTML = `<div class="ss-hn-name" style="color:${g.c}">${esc(it.name || 'Gear')}</div>
      <div class="ss-hn-step"><b>+${it.hone || 0}</b>${glyph('right')}<b class="ss-gold">+${next}</b>
      ${d.iLvlFrom != null ? `<span>Item Level ${fmt2(d.iLvlFrom)} ${glyph('right')} <em>${fmt2(d.iLvlTo)}</em></span>` : ''}</div>
      ${(d.gains || []).map(x => `<div class="ss-hn-gain"><span>${esc(x.label)}</span><b>${fmtInt(x.from)}</b>${glyph('right')}<em>${fmtInt(x.to)}</em></div>`).join('')}
      ${xferLine(d.transfer)}`;
    // anvil stage
    clear(this.itemSlot);
    const s = slot(it, { size: 88 }); s.classList.add('ss-hn-big'); this.itemSlot.appendChild(s);
    // chance
    const c = d.chance || {};
    const boostAdd = (d.boosters || []).reduce((a, b) => a + (this.used[b.id] || 0) * (b.add || 0), 0);
    const total = clamp((c.total ?? ((c.base || 0) + (c.bonus || 0))) + boostAdd, 0, 1);
    const energy = clamp(d.energy || 0, 0, 1);
    const sure = energy >= 1 || total >= 1;
    this.ring.style.setProperty('--p', (sure ? 1 : total).toFixed(4));
    this.ringT.innerHTML = `<b>${sure ? '100%' : pct(total)}</b><span>${sure && energy >= 1 ? 'Guaranteed' : 'Success'}</span>`;
    this.anvil.classList.toggle('is-sure', sure);
    this.chanceEl.innerHTML = `<div class="ss-kv"><span>Base chance</span><span>${pct(c.base || 0)}</span></div>
      <div class="ss-kv"><span>Failure bonus</span><span class="ss-good">+${pct(c.bonus || 0)}${d.maxBonus ? ` <small>/ ${pct(d.maxBonus)}</small>` : ''}</span></div>
      <div class="ss-kv"><span>Boosters</span><span class="ss-good">+${pct(boostAdd + (c.boosters || 0))}</span></div>
      ${d.expected?.taps && !sure ? `<div class="ss-kv ss-hn-exp"><span>Expected taps</span><span>≈ ${(Math.round(d.expected.taps * 10) / 10).toFixed(1)}${d.expected.p90 ? ` <small>· 90%: ${fmtInt(d.expected.p90)}</small>` : ''}</span></div>` : ''}`;
    this.energyEl.innerHTML = `<div class="ss-hn-el"><span>Artisan's Energy</span><b>${fmt2(energy * 100)}%</b></div><div class="ss-hn-eb"><i style="transform:scaleX(${energy.toFixed(4)})"></i></div>`;
    this.energyEl.classList.toggle('is-full', energy >= 1);
    // materials
    clear(this.mats);
    let short = false;
    for (const m of d.mats || []) {
      const ok = (m.have ?? Infinity) >= (m.need || 0);
      if (!ok) short = true;
      const r = h('div', 'ss-hn-mat' + (ok ? '' : ' is-short'), this.mats);
      r.innerHTML = `<i class="ss-slot ss-g${m.grade | 0}" style="--sz:34px"><i class="ss-slot-ic" style="background-image:url('${itemIcon(m.icon || 'item:' + m.id, 34)}')"></i></i><span>${esc(m.name)}</span><b>${fmtInt(m.have ?? 0)}</b><em>/ ${fmtInt(m.need || 0)}</em>`;
      r.firstChild._tip = { kind: 'item', item: { name: m.name, grade: m.grade, icon: m.icon || 'item:' + m.id, kind: 'material', count: m.have, desc: m.desc } };
    }
    // boosters
    clear(this.boost);
    for (const b of d.boosters || []) {
      const n = this.used[b.id] || 0;
      const r = h('div', 'ss-hn-bst', this.boost);
      r.innerHTML = `<i class="ss-slot ss-g${b.grade | 0}" style="--sz:34px"><i class="ss-slot-ic" style="background-image:url('${itemIcon(b.icon || 'item:' + b.id, 34)}')"></i></i><div><b>${esc(b.name)}</b><span>+${pct(b.add || 0)} each · have ${fmtInt(b.have || 0)}</span></div>`;
      const ctl = h('div', 'ss-hn-bctl', r);
      const minus = btn('ss-btn ss-btn--sm ss-btn--icon', ctl, null, () => this.setBoost(b, n - 1), `Fewer ${b.name}`); minus.innerHTML = glyph('minus'); minus.disabled = n <= 0;
      h('b', '', ctl, `${n}/${b.max ?? 0}`);
      const plus = btn('ss-btn ss-btn--sm ss-btn--icon', ctl, null, () => this.setBoost(b, n + 1), `More ${b.name}`); plus.innerHTML = glyph('plus'); plus.disabled = n >= Math.min(b.max ?? 0, b.have ?? 0) || sure;
      const max = btn('ss-btn ss-btn--sm', ctl, 'Max', () => this.setBoost(b, Math.min(b.max ?? 0, b.have ?? 0)), `Max ${b.name}`); max.disabled = sure;
    }
    if (!(d.boosters || []).length) h('div', 'ss-empty', this.boost, 'No boosters available.');
    // cost + hammer
    const cur = d.currencies || {}, cost = d.cost || {};
    this.costEl.innerHTML = ['silver', 'gold'].filter(k => cost[k]).map(k => `<span class="${(cur[k] ?? Infinity) < cost[k] ? 'is-short' : ''}"><i style="background-image:url('${iconUrl('currency:' + k, 18)}')"></i><b>${fmtInt(cost[k])}</b></span>`).join('');
    if (['silver', 'gold'].some(k => cost[k] && (cur[k] ?? Infinity) < cost[k])) short = true;
    this.hammer.disabled = !!d.maxed || short || this.busy;
    this.hammer.querySelector('b').textContent = d.maxed ? 'Max' : 'Hone';
    this.shortEl.textContent = d.maxed ? 'This piece is fully honed.' : short ? 'Not enough materials' : '';
    // result moment
    if (d.result && d.resultKey !== this.lastKey) { this.lastKey = d.resultKey; this.queue(d.result, { hone: it.hone, energy }); }
  }
  setBoost(b, n) {
    this.used[b.id] = clamp(n, 0, Math.min(b.max ?? 0, b.have ?? 0));
    this.ui.emit('hone:booster', { id: b.id, n: this.used[b.id] });
    this.render(this.d);
  }
  tap() {
    if (this.busy || !this.d?.item) return;
    this.busy = true; this.tapT = performance.now();
    this.hammer.disabled = true;
    this.anvil.classList.remove('is-strike'); void this.anvil.offsetWidth; this.anvil.classList.add('is-strike');
    this.ui.emit('hone:tap', { uid: this.d.item.uid, boosters: { ...this.used } });
    setTimeout(() => { if (this.busy && !this._pending) { this.busy = false; this.render(this.d); } }, 2500);
  }
  /** Wait for the hammer swing to finish before revealing (results often arrive synchronously). */
  queue(kind, o) {
    const wait = this.tapT ? Math.max(0, this.tapT + 950 - performance.now()) : 0;
    this._pending = true;
    setTimeout(() => { this._pending = false; this.play(kind, o); }, wait);
  }
  play(kind, o = {}) {
    this.busy = false; this.used = {};
    const fx = this.fx; clear(fx);
    fx.className = 'ss-hn-fx is-' + kind;
    if (kind === 'success') {
      h('i', 'ss-hn-rays', fx); h('i', 'ss-hn-flash', fx);
      for (let i = 0; i < 18; i++) { const p = h('i', 'ss-hn-spark', fx); p.style.setProperty('--a', (i / 18 * 360) + 'deg'); p.style.animationDelay = (Math.random() * 0.15) + 's'; }
      h('div', 'ss-hn-big-t', fx, `+${o.hone ?? ''}`);
      h('div', 'ss-hn-big-s', fx, 'Success');
    } else {
      h('i', 'ss-hn-crack', fx);
      h('div', 'ss-hn-big-t', fx, 'Failed');
      h('div', 'ss-hn-big-s', fx, o.energy != null ? `Artisan's Energy ${fmt2(o.energy * 100)}%` : 'The metal resists…');
    }
    clearTimeout(this._fxT);
    this._fxT = setTimeout(() => { fx.className = 'ss-hn-fx'; clear(fx); }, kind === 'success' ? 2600 : 2000);
    if (this.d) this.render(this.d);
  }
  hidden() { this.used = {}; this.busy = false; }
}
function shortName(it) { return { weapon: 'Weapon', head: 'Head', shoulder: 'Shoulders', chest: 'Chest', pants: 'Pants', gloves: 'Gloves' }[it.slot] || it.name || 'Gear'; }
/** Reforge path (e.g. Vanguard +12 → Horned Tyrant +6): ready line, or the reason it isn't available yet. */
function xferLine(x) {
  if (!x) return '';
  const to = x.to || {}, set = to.set ? pretty(to.set) : 'next set';
  if (x.ok || x.can) return `<div class="ss-hn-xfer is-ready">${glyph('swap')}<span>Reforge ready: <b>${esc(set)} +${to.hone ?? 0}</b>${to.iLvl ? ` · iLvl ${fmtInt(to.iLvl)}` : ''}</span><em>at the Blacksmith</em></div>`;
  return x.msg ? `<div class="ss-hn-xfer">${glyph('swap')}<span>${esc(x.msg)}</span></div>` : '';
}
