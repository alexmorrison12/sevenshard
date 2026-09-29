// Adventure Tome (L) + Collectibles, Rapport, Raid Bid, Quest Journal (J).
//
// tome data: { tab?: 'tome'|'collectibles', selected?,
//   regions: [{ id, name, pct, cats: [{ id, label, have, total }], rewards: [{ pct, name, icon, grade, count?, claimed }] }],
//   collectibles: [{ id, name, icon, have, total, tiers: [{ n, name, icon, grade, count?, claimed }] }] }
//   Actions: tome:region { id } · tome:claim { region, pct } · collect:claim { id, n }
// rapport data: { npcs: [{ id, name, title, icon?, stage (0–5), points, max, daily?: { songs, songsMax, emotes, emotesMax },
//   songs: [{ id, name, locked? }], emotes: [{ id, name }], gifts: [Item], rewards: [{ stage, name, icon, grade, count?, claimed }] }], selected? }
//   Actions: rapport:select { id } · rapport:song { npc, id } · rapport:emote { npc, id } · rapport:gift { npc, uid } · rapport:claim { npc, stage }
// bid data: { item: Item, bids: [{ name, cls?, amount, you? }], min, step, left (s), gold, status: 'open'|'won'|'lost'|'closed', winner?, note? }
//   Actions: bid:place { amount } · bid:pass {}
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
export class BidWin extends Win {
  static id = 'bid'; static title = 'Auction'; static glyph = 'crown'; static width = 520;
  build() {
    this.body.classList.add('ss-bd');
    this.amt = 0;
  }
  shown() { clearInterval(this._iv); this._iv = setInterval(() => this.tick(), 250); }
  hidden() { clearInterval(this._iv); }
  render(d) {
    this.d = d = d || {}; this.t0 = performance.now();
    const B = this.body; clear(B);
    const it = d.item || {};
    const bids = [...(d.bids || [])].sort((a, b) => b.amount - a.amount);
    const top = bids[0];
    const minNext = top ? top.amount + (d.step || 100) : (d.min || 0);
    if (!this.amt || this.amt < minNext) this.amt = minNext;
    const hd = h('div', 'ss-bd-hd', B);
    hd.appendChild(slot(it, { size: 64 }));
    h('div', 'ss-bd-it', hd).innerHTML = `<b style="color:${grade(it.grade).c}">${esc(it.name || '')}</b><span>${esc(d.note || 'Gold is split between the other raid members.')}</span>`;
    this.clock = h('div', 'ss-bd-clock', hd);
    const cur = h('div', 'ss-bd-cur', B);
    cur.innerHTML = top ? `<span>Highest bid</span><b>${fmtInt(top.amount)}<i style="background-image:url('${iconUrl('currency:gold', 22)}')"></i></b><em>${esc(top.name)}${top.you ? ' (you)' : ''}</em>` : `<span>Opening bid</span><b>${fmtInt(d.min || 0)}<i style="background-image:url('${iconUrl('currency:gold', 22)}')"></i></b><em>No bids yet</em>`;
    if (d.status && d.status !== 'open') {
      const res = h('div', 'ss-bd-res is-' + d.status, B);
      res.innerHTML = d.status === 'won' ? `${glyph('crown')}<b>You won the auction</b>` : d.status === 'lost' ? `<b>${esc(d.winner || 'Someone')} won the auction</b>` : '<b>The auction has closed</b>';
    } else {
      const ctl = h('div', 'ss-bd-ctl', B);
      const inp = h('input', 'ss-input ss-bd-amt', ctl); inp.value = this.amt; inp.inputMode = 'numeric'; inp.setAttribute('aria-label', 'Bid amount');
      inp.addEventListener('keydown', e => e.stopPropagation());
      inp.addEventListener('input', () => { this.amt = parseInt(inp.value) || 0; place.disabled = this.amt < minNext || this.amt > (d.gold ?? Infinity); });
      for (const inc of [d.step || 100, (d.step || 100) * 5, (d.step || 100) * 10]) btn('ss-btn ss-btn--sm', ctl, `+${fmtInt(inc)}`, () => { this.amt = Math.max(this.amt, minNext - inc) + inc; inp.value = this.amt; place.disabled = this.amt > (d.gold ?? Infinity); });
      const row = h('div', 'ss-bd-row', B);
      h('span', 'ss-bd-have', row).innerHTML = `You have <b>${fmtInt(d.gold ?? 0)}</b> gold`;
      btn('ss-btn ss-btn--ghost', row, 'Pass', () => this.ui.emit('bid:pass', {}));
      const place = btn('ss-btn ss-btn--primary', row, 'Place Bid', () => this.ui.emit('bid:place', { amount: this.amt }));
      place.disabled = this.amt < minNext || this.amt > (d.gold ?? Infinity);
    }
    const hist = h('div', 'ss-bd-hist ss-scroll', B);
    for (const b of bids.slice(0, 8)) h('div', 'ss-bd-b' + (b.you ? ' is-you' : ''), hist).innerHTML = `<span>${b.cls ? `<i class="ss-crest" style="width:16px;height:16px;background-image:url('${iconUrl('class:' + b.cls, 16)}')"></i>` : ''}${esc(b.name)}</span><b>${fmtInt(b.amount)}</b>`;
    this.tick();
  }
  tick() {
    const d = this.d || {}; if (!this.clock) return;
    const left = Math.max(0, (d.left || 0) - (performance.now() - this.t0) / 1000);
    this.clock.innerHTML = `<div class="ss-pring sm${left < 5 ? ' is-urgent' : ''}" style="--p:${d.total ? (left / d.total).toFixed(3) : 1};--c:${left < 5 ? '#ff7a64' : '#f3c46a'}"><b>${Math.ceil(left)}</b></div>`;
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
