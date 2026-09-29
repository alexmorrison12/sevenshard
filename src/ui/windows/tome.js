// Adventure Tome (L) + Collectibles, Rapport, Raid Bid, Quest Journal (J).
//
// tome data: { tab?: 'tome'|'collectibles', selected?,
//   regions: [{ id, name, pct, cats: [{ id, label, have, total }], rewards: [{ pct, name, icon, grade, count?, claimed }] }],
//   collectibles: [{ id, name, icon, have, total, tiers: [{ n, name, icon, grade, count?, claimed }] }] }
//   Actions: tome:region { id } · tome:claim { region, pct } · collect:claim { id, n }
// rapport data: { npcs: [{ id, name, title, icon?, stage (0–5), points, max, daily?: { songs, songsMax, emotes, emotesMax },
//   songs: [{ id, name, locked? }], emotes: [{ id, name }], gifts: [Item], rewards: [{ stage, name, icon, grade, count?, claimed }] }], selected? }
//   Actions: rapport:select { id } · rapport:song { npc, id } · rapport:emote { npc, id } · rapport:gift { npc, uid } · rapport:claim { npc, stage }
// bid data: see the Raid Auction section below.
// quests data (optional; defaults to HudState.quests): { quests: [{ id, title, kind, desc?, giver?, zone?, level?, steps, rewards?: [Item] }], tracked?: [ids] }
//   Actions: quest:track { id, on } · quest:abandon { id }
import { h, btn, esc, fmtInt, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { slot, tabs } from '../core/kit.js';
import { grade } from '../core/data.js';
import { Win } from '../core/windows.js';

const ring = (pct, size = 64, c = '#f3c46a') => `<div class="ss-pring" style="--p:${Math.max(0, Math.min(100, pct)) / 100};--c:${c};width:${size}px;height:${size}px"><b>${Math.floor(pct)}%</b></div>`;

// ================================================================================================ adventure tome
export class TomeWin extends Win {
  static id = 'tome'; static title = 'Adventure Tome'; static glyph = 'tome'; static width = 940;
  build() {
    const b = this.body; b.classList.add('ss-tm');
    this.tab = 'tome';
    this.tabs = tabs(b, [{ id: 'tome', label: 'Adventure Tome' }, { id: 'collectibles', label: 'Collectibles' }], this.tab, id => { this.tab = id; this.render(this.d); });
    this.pane = h('div', 'ss-tm-pane', b);
  }
  render(d) {
    this.d = d = d || {};
    if (d.tab && d.tab !== this._dt) { this._dt = d.tab; this.tab = d.tab; this.tabs.set(d.tab); }
    const P = this.pane; clear(P); P.dataset.tab = this.tab;
    if (this.tab === 'tome') {
      const regs = d.regions || [];
      if (!this.sel || !regs.find(r => r.id === this.sel)) this.sel = d.selected || regs[0]?.id;
      const L = h('div', 'ss-tm-regs ss-scroll', P);
      for (const r of regs) {
        const e = h('div', 'ss-tm-reg ss-ptr' + (r.id === this.sel ? ' is-sel' : ''), L);
        e.innerHTML = `${ring(r.pct || 0, 40)}<div><b>${esc(r.name)}</b><span>${(r.rewards || []).filter(x => !x.claimed && (r.pct || 0) >= x.pct).length ? '<em>Reward ready</em>' : `${Math.floor(r.pct || 0)}% explored`}</span></div>`;
        e.addEventListener('click', () => { this.sel = r.id; this.ui.emit('tome:region', { id: r.id }); this.render(this.d); });
      }
      const r = regs.find(x => x.id === this.sel);
      const D = h('div', 'ss-tm-det', P);
      if (!r) { h('div', 'ss-empty', D, 'No regions discovered yet.'); return; }
      h('div', 'ss-tm-dhd', D).innerHTML = `${ring(r.pct || 0, 92)}<div><div class="ss-tm-over">Adventure Tome</div><div class="ss-tm-name">${esc(r.name)}</div><span>Complete entries to earn rewards at each milestone.</span></div>`;
      const cats = h('div', 'ss-tm-cats', D);
      const CG = { bosses: 'crown', npcs: 'users', seeds: 'leaf', vistas: 'eye', lore: 'tome', cuisine: 'heart', monsters: 'skull' };
      for (const c of r.cats || []) {
        const f = c.total ? c.have / c.total : 0;
        const e = h('div', 'ss-tm-cat' + (f >= 1 ? ' is-done' : ''), cats);
        e.innerHTML = `<i>${glyph(CG[c.id] || 'star')}</i><div><b>${esc(c.label)}</b><div class="ss-tm-bar"><u style="transform:scaleX(${f.toFixed(3)})"></u></div></div><em>${c.have}/${c.total}</em>`;
      }
      h('div', 'ss-h', D, 'Milestone Rewards');
      const track = h('div', 'ss-tm-track', D);
      h('i', 'ss-tm-line', track).style.setProperty('--p', ((r.pct || 0) / 100).toFixed(3));
      for (const w of r.rewards || []) {
        const ready = !w.claimed && (r.pct || 0) >= w.pct;
        const n = h('div', 'ss-tm-node' + (w.claimed ? ' is-claimed' : ready ? ' is-ready' : ''), track);
        n.style.left = w.pct + '%';
        n.appendChild(slot({ ...w, kind: w.kind || 'material' }, { size: 44, dim: w.claimed }));
        h('span', '', n, w.pct + '%');
        if (ready) btn('ss-btn ss-btn--sm ss-btn--primary', n, 'Claim', () => this.ui.emit('tome:claim', { region: r.id, pct: w.pct }));
      }
    } else {
      const g = h('div', 'ss-tm-coll ss-scroll', P);
      for (const c of d.collectibles || []) {
        const f = c.total ? c.have / c.total : 0;
        const next = (c.tiers || []).find(t => !t.claimed);
        const ready = next && c.have >= next.n;
        const e = h('div', 'ss-tm-cc' + (ready ? ' is-ready' : ''), g);
        e.innerHTML = `<i class="ss-tm-ci" style="background-image:url('${iconUrl(c.icon, 56, { bare: true })}')"></i><b>${esc(c.name)}</b><div class="ss-tm-bar"><u style="transform:scaleX(${f.toFixed(3)})"></u></div><span>${fmtInt(c.have)} / ${fmtInt(c.total)}</span>`;
        if (next) {
          const nx = h('div', 'ss-tm-next', e);
          nx.appendChild(slot({ ...next, kind: next.kind || 'material' }, { size: 36 }));
          h('span', '', nx, ready ? 'Ready!' : `At ${next.n}`);
          if (ready) btn('ss-btn ss-btn--sm ss-btn--primary', nx, 'Claim', () => this.ui.emit('collect:claim', { id: c.id, n: next.n }));
        } else h('div', 'ss-tm-all', e, 'All rewards claimed');
      }
      if (!(d.collectibles || []).length) h('div', 'ss-empty', g, 'Nothing collected yet.');
    }
  }
}

// ================================================================================================ rapport
export const STAGES = ['Neutral', 'Amicable', 'Friendly', 'Trusted', 'Honored', 'Devoted'];
export class RapportWin extends Win {
  static id = 'rapport'; static title = 'Rapport'; static glyph = 'heart'; static width = 900;
  build() { this.body.classList.add('ss-rp'); }
  render(d) {
    this.d = d = d || {};
    const B = this.body; clear(B);
    const npcs = d.npcs || [];
    if (!this.sel || !npcs.find(n => n.id === this.sel)) this.sel = d.selected || npcs[0]?.id;
    const L = h('div', 'ss-rp-list ss-scroll', B);
    for (const n of npcs) {
      const e = h('div', 'ss-rp-li ss-ptr' + (n.id === this.sel ? ' is-sel' : ''), L);
      e.innerHTML = `<i style="background-image:url('${iconUrl(n.icon || 'npc:' + n.id, 44)}')"></i><div><b>${esc(n.name)}</b><span>${STAGES[n.stage || 0]}</span></div><div class="ss-rp-hearts">${Array.from({ length: 5 }, (_, i) => `<s class="${i < (n.stage || 0) ? 'on' : ''}"></s>`).join('')}</div>`;
      e.addEventListener('click', () => { this.sel = n.id; this.ui.emit('rapport:select', { id: n.id }); this.render(this.d); });
    }
    const n = npcs.find(x => x.id === this.sel);
    const D = h('div', 'ss-rp-det', B);
    if (!n) { h('div', 'ss-empty', D, 'Befriend the people of Solmara to build rapport.'); return; }
    const f = n.max ? Math.min(1, (n.points || 0) / n.max) : 1;
    h('div', 'ss-rp-hd', D).innerHTML = `<div class="ss-rp-por" style="background-image:url('${iconUrl(n.icon || 'npc:' + n.id, 140)}')"></div>
      <div class="ss-rp-id"><div class="ss-rp-name">${esc(n.name)}</div><div class="ss-rp-title">${esc(n.title || '')}</div>
      <div class="ss-rp-stage"><b>${STAGES[n.stage || 0]}</b>${(n.stage || 0) < 5 ? `<span>→ ${STAGES[(n.stage || 0) + 1]}</span>` : ''}</div>
      <div class="ss-rp-bar"><u style="transform:scaleX(${f.toFixed(3)})"></u><em>${fmtInt(n.points || 0)} / ${fmtInt(n.max || 0)}</em></div>
      <div class="ss-rp-steps">${STAGES.map((s, i) => `<span class="${i <= (n.stage || 0) ? 'on' : ''}">${glyph('heart')}<small>${s}</small></span>`).join('')}</div></div>`;
    const dl = n.daily || {};
    const acts = h('div', 'ss-rp-acts', D);
    const sec = (title, sub) => { const s = h('div', 'ss-rp-sec', acts); h('div', 'ss-h', s, title); if (sub) h('span', 'ss-rp-sub', s, sub); return h('div', 'ss-rp-btns', s); };
    const sg = sec('Songs', dl.songsMax ? `${dl.songs || 0}/${dl.songsMax} today` : '');
    for (const s of n.songs || []) { const b = btn('ss-btn ss-btn--sm', sg, null, () => this.ui.emit('rapport:song', { npc: n.id, id: s.id }), s.name); b.innerHTML = glyph('music') + `<span>${esc(s.name)}</span>`; b.disabled = !!s.locked || (dl.songsMax && dl.songs >= dl.songsMax); }
    const em = sec('Emotes', dl.emotesMax ? `${dl.emotes || 0}/${dl.emotesMax} today` : '');
    for (const s of n.emotes || []) { const b = btn('ss-btn ss-btn--sm', em, null, () => this.ui.emit('rapport:emote', { npc: n.id, id: s.id }), s.name); b.innerHTML = glyph('heart') + `<span>${esc(s.name)}</span>`; b.disabled = dl.emotesMax && dl.emotes >= dl.emotesMax; }
    const gf = sec('Gifts', 'Click a gift to give it');
    for (const it of n.gifts || []) gf.appendChild(slot(it, { size: 40, onClick: () => this.ui.emit('rapport:gift', { npc: n.id, uid: it.uid }), hint: 'Click to give' }));
    if (!(n.gifts || []).length) h('span', 'ss-dim', gf, 'No gifts in your bags.');
    h('div', 'ss-h', D, 'Stage Rewards');
    const rw = h('div', 'ss-rp-rw', D);
    for (const r of n.rewards || []) {
      const ready = !r.claimed && (n.stage || 0) >= r.stage;
      const e = h('div', 'ss-rp-r' + (r.claimed ? ' is-claimed' : ready ? ' is-ready' : ''), rw);
      e.appendChild(slot({ ...r, kind: r.kind || 'material' }, { size: 40, dim: r.claimed }));
      h('span', '', e, STAGES[r.stage]);
      if (ready) btn('ss-btn ss-btn--sm ss-btn--primary', e, 'Claim', () => this.ui.emit('rapport:claim', { npc: n.id, stage: r.stage }));
    }
  }
}

// ================================================================================================ raid bid
// Data (lead: src/game/social/bidding.js; pushed every 0.25 s):
//   { item: Item, min, step, current: null | { amount, by }, left (s), split (gold each other raider gets if it wins),
//     gold (yours), you (your name), history: [{ by, amount }] (last 6), done?: { winner, amount } }
// Actions: bid:place { amount } · bid:raise { step } · bid:pass {}
// Lives in the modal layer so it shows above the results screen. Built once and updated in place (the custom
// amount field keeps its value and focus across the 4 Hz pushes).
export class BidWin extends Win {
  static id = 'bid'; static title = 'Raid Auction'; static glyph = 'crown'; static width = 540; static layer = 'modal';
  build() {
    const B = this.body; B.classList.add('ss-bd');
    const hd = h('div', 'ss-bd-hd', B);
    this.slotWrap = h('div', '', hd);
    this.itemTx = h('div', 'ss-bd-it', hd);
    this.clock = h('div', 'ss-pring ss-bd-ring', hd);
    this.clockT = h('b', '', this.clock);
    this.cur = h('div', 'ss-bd-cur', B);
    this.curL = h('span', '', this.cur);
    this.curV = h('b', '', this.cur);
    this.curBy = h('em', '', this.cur);
    this.splitEl = h('div', 'ss-bd-split', B);
    const ctl = h('div', 'ss-bd-ctl', B);
    this.r1 = btn('ss-btn', ctl, '+', () => this.raise(1));
    this.r5 = btn('ss-btn', ctl, '+', () => this.raise(5));
    this.inp = h('input', 'ss-input ss-bd-amt', ctl);
    this.inp.inputMode = 'numeric'; this.inp.setAttribute('aria-label', 'Custom bid amount');
    this.inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.place(); });
    this.inp.addEventListener('input', () => { this.dirty = true; this.check(); });
    this.placeB = btn('ss-btn ss-btn--primary', ctl, 'Bid', () => this.place());
    const row = h('div', 'ss-bd-row', B);
    this.have = h('span', 'ss-bd-have', row);
    this.pass = btn('ss-btn ss-btn--ghost', row, 'Pass', () => { this.passed = true; this.ui.emit('bid:pass', {}); this.check(); });
    this.hist = h('div', 'ss-bd-hist', B);
    this.res = h('div', 'ss-bd-res', B);
    this.total = 0; this._item = null;
  }
  shown() { this.passed = false; this.dirty = false; this.total = 0; }
  next() { const d = this.d || {}; return d.current ? d.current.amount + (d.step || 100) : (d.min || 0); }
  raise(k) {
    const d = this.d || {}; const step = (d.step || 100) * k;
    this.ui.emit('bid:raise', { step });
    const base = d.current ? d.current.amount : Math.max(0, (d.min || 0) - step);
    this.inp.value = base + step; this.dirty = false; this.check();
  }
  place() { const a = parseInt(this.inp.value) || 0; if (a >= this.next() && a <= (this.d?.gold ?? Infinity)) this.ui.emit('bid:place', { amount: a }); }
  check() {
    const d = this.d || {}, a = parseInt(this.inp.value) || 0, open = !d.done && (d.left ?? 1) > 0;
    this.placeB.disabled = !open || this.passed || a < this.next() || a > (d.gold ?? Infinity);
    for (const [b, k] of [[this.r1, 1], [this.r5, 5]]) { const nv = (d.current ? d.current.amount : Math.max(0, (d.min || 0) - (d.step || 100) * k)) + (d.step || 100) * k; b.disabled = !open || this.passed || nv > (d.gold ?? Infinity); }
    this.pass.disabled = !open || this.passed;
  }
  render(d) {
    this.d = d = d || {};
    const it = d.item || {};
    if (it !== this._item && (it.uid !== this._item?.uid || it.name !== this._item?.name)) {
      this._item = it; clear(this.slotWrap); this.slotWrap.appendChild(slot(it, { size: 64 }));
      this.itemTx.innerHTML = `<span>Up for auction</span><b style="color:${grade(it.grade).c}">${esc(it.name || '')}</b><em>Hover the item for details</em>`;
    }
    if ((d.left || 0) > this.total) this.total = d.left || 0;
    const left = Math.max(0, d.left || 0), f = this.total ? left / this.total : 0;
    this.clock.style.setProperty('--p', f.toFixed(3));
    this.clock.style.setProperty('--c', left < 5 ? '#ff7a64' : '#f3c46a');
    this.clock.classList.toggle('is-urgent', left < 5);
    this.clockT.textContent = Math.ceil(left);
    const cur = d.current;
    this.curL.textContent = cur ? 'Highest bid' : 'Opening bid';
    this.curV.innerHTML = `${fmtInt(cur ? cur.amount : d.min || 0)}<i style="background-image:url('${iconUrl('currency:gold', 22)}')"></i>`;
    this.curBy.textContent = cur ? (cur.by === d.you ? 'You lead!' : cur.by) : 'No bids yet';
    this.cur.classList.toggle('is-you', !!cur && cur.by === d.you);
    this.splitEl.innerHTML = d.split ? `If this bid wins, every other raider receives <b>${fmtInt(d.split)}</b> gold.` : '';
    this.r1.textContent = `+${fmtInt(d.step || 100)}`; this.r5.textContent = `+${fmtInt((d.step || 100) * 5)}`;
    if (!this.dirty || (parseInt(this.inp.value) || 0) < this.next()) { this.inp.value = this.next(); this.dirty = false; }
    this.have.innerHTML = `Your gold <b>${fmtInt(d.gold ?? 0)}</b>${this.passed ? ' · <em>You passed</em>' : ''}`;
    this.hist.innerHTML = (d.history || []).slice(-6).reverse().map((b, i) => `<div class="ss-bd-b${b.by === d.you ? ' is-you' : ''}${i === 0 ? ' is-top' : ''}"><span>${esc(b.by)}</span><b>${fmtInt(b.amount)}</b></div>`).join('') || '<div class="ss-empty">Be the first to bid.</div>';
    const done = d.done || (left <= 0 && this.total > 0 ? { winner: cur?.by, amount: cur?.amount } : null);
    this.res.className = 'ss-bd-res' + (done ? (done.winner === d.you ? ' is-won' : ' is-lost') : '');
    this.res.innerHTML = done ? (done.winner ? (done.winner === d.you ? `${glyph('crown')}<b>You won for ${fmtInt(done.amount || 0)} gold</b>` : `<b>${esc(done.winner)} won for ${fmtInt(done.amount || 0)} gold</b>`) : '<b>No bids — the item is split by roll</b>') : '';
    this.check();
  }
}

// ================================================================================================ quest journal
const QK = { msq: 'Main Story', side: 'Side Quest', daily: 'Daily', weekly: 'Weekly', event: 'Event', guide: 'Guide' };
export class QuestsWin extends Win {
  static id = 'quests'; static title = 'Quest Journal'; static glyph = 'quest'; static width = 820;
  build() { this.body.classList.add('ss-qj'); }
  render(d) {
    d = d && d.quests ? d : { quests: this.ui.hud.state?.quests || [], tracked: (this.ui.hud.state?.quests || []).map(q => q.id) };
    this.d = d;
    const B = this.body; clear(B);
    const qs = d.quests || [];
    if (!this.sel || !qs.find(q => q.id === this.sel)) this.sel = qs[0]?.id;
    const L = h('div', 'ss-qj-list ss-scroll', B);
    for (const k of Object.keys(QK)) {
      const grp = qs.filter(q => (q.kind || 'side') === k);
      if (!grp.length) continue;
      h('div', 'ss-qj-grp', L, QK[k]);
      for (const q of grp) {
        const e = h('div', 'ss-qj-li ss-ptr' + (q.id === this.sel ? ' is-sel' : ''), L);
        e.dataset.kind = q.kind || 'side';
        const done = (q.steps || []).length && q.steps.every(s => s.done || (s.need && s.n >= s.need));
        e.innerHTML = `<i></i><b>${esc(q.title)}</b>${done ? glyph('check') : ''}${(d.tracked || []).includes(q.id) ? `<em>${glyph('pin')}</em>` : ''}`;
        e.addEventListener('click', () => { this.sel = q.id; this.render(this.d); });
      }
    }
    if (!qs.length) h('div', 'ss-empty', L, 'Your journal is empty.');
    const q = qs.find(x => x.id === this.sel);
    const D = h('div', 'ss-qj-det', B);
    if (!q) return;
    D.dataset.kind = q.kind || 'side';
    h('div', 'ss-qj-hd', D).innerHTML = `<span>${QK[q.kind] || 'Quest'}${q.level ? ` · Lv ${q.level}` : ''}${q.zone ? ` · ${esc(q.zone)}` : ''}</span><b>${esc(q.title)}</b>${q.giver ? `<em>From ${esc(q.giver)}</em>` : ''}`;
    if (q.desc) h('p', 'ss-qj-desc', D, q.desc);
    h('div', 'ss-h', D, 'Objectives');
    const obj = h('div', 'ss-qj-obj', D);
    for (const s of q.steps || []) { const done = s.done || (s.need && s.n >= s.need); h('div', 'ss-qj-s' + (done ? ' is-done' : ''), obj).innerHTML = `${glyph(done ? 'check' : 'right')}<span>${esc(s.text)}</span>${s.need > 1 ? `<b>${Math.min(s.n || 0, s.need)}/${s.need}</b>` : ''}`; }
    if ((q.rewards || []).length) { h('div', 'ss-h', D, 'Rewards'); const rw = h('div', 'ss-qj-rw', D); for (const r of q.rewards) rw.appendChild(slot({ ...r, kind: r.kind || 'material' }, { size: 44 })); }
    const ft = h('div', 'ss-qj-ft', D);
    const tracked = (d.tracked || []).includes(q.id);
    const t = btn('ss-btn ss-btn--sm', ft, null, () => this.ui.emit('quest:track', { id: q.id, on: !tracked }), tracked ? 'Untrack' : 'Track'); t.innerHTML = glyph('pin') + `<span>${tracked ? 'Untrack' : 'Track'}</span>`;
    if (q.kind !== 'msq') btn('ss-btn ss-btn--sm ss-btn--ghost', ft, 'Abandon', async () => { if (await this.ui.confirm({ title: 'Abandon Quest', text: `Abandon "${q.title}"? Progress is lost.`, ok: 'Abandon', danger: true })) this.ui.emit('quest:abandon', { id: q.id }); });
  }
}
