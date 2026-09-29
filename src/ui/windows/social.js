// Social windows: Party Finder (O), Mail, Guild (U), Leaderboards.
//
// partyfinder data: { tab?: 'find'|'mine', contents?: [{ id, label }], filter?: contentId,
//   listings: [{ id, title, content, sub?, icon?, leader: { name, cls, iLvl }, size: 4|8, members: [{ name, cls, support?, you? }],
//                req: { iLvl, supports? }, tags?: [], note?, age?: s, joined?: bool }], mine?: listing|null }
//   Actions: pf:join { id } · pf:leave { id } · pf:create { content, title, iLvl, size, note } · pf:cancel {} · pf:refresh {} · pf:filter { content }
// mail data: { mails: [{ id, from, subject, body, date, read, kind?: 'system'|'player'|'guild', attachments?: [Item], claimed?, expires? }] }
//   Actions: mail:open { id } · mail:claim { id } · mail:claimAll {} · mail:delete { id }
// guild data: { guild: null | { name, tag, level, xp, xpMax, motto, bloodstones, rank, emblem?: { color },
//                 members: [{ name, cls, level, iLvl, rank, online, weekly }], research: [{ id, name, level, max, desc }],
//                 missions: [{ id, name, n, need, reward }] }, browse?: [{ id, name, tag, level, members, max, motto, req }] }
//   Actions: guild:donate { kind } · guild:join { id } · guild:create { name, tag } · guild:leave {} · guild:research { id } · guild:mission { id }
// leaderboards data: { board, sub?, boards?: [{ id, label, subs? }], rows: [{ rank, name, cls, value, sub?, you?, party?: [cls], date? }],
//                      you?: { rank, value }, note? }
//   Actions: lb:board { board, sub }
import { h, btn, esc, fmtInt, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { slot, tabs, select, seg } from '../core/kit.js';
import { cls as clsInfo, CLASS_IDS } from '../core/data.js';
import { Win } from '../core/windows.js';

const crest = (c, s = 22) => `<i class="ss-crest" style="width:${s}px;height:${s}px;background-image:url('${iconUrl('class:' + c, s)}')"></i>`;

// ================================================================================================ party finder
export class PartyFinderWin extends Win {
  static id = 'partyfinder'; static title = 'Party Finder'; static glyph = 'finder'; static width = 860;
  build() {
    const b = this.body; b.classList.add('ss-pfw');
    this.tab = 'find';
    this.tabs = tabs(b, [{ id: 'find', label: 'Find a Party' }, { id: 'mine', label: 'My Listing' }], this.tab, id => { this.tab = id; this.fill(); });
    this.pane = h('div', 'ss-pfw-pane', b);
  }
  render(d) { this.d = d; if (d.tab && d.tab !== this._dt) { this._dt = d.tab; this.tab = d.tab; this.tabs.set(d.tab); } this.fill(); }
  fill() {
    const d = this.d || {}, P = this.pane; clear(P);
    const contents = d.contents || [...new Map((d.listings || []).map(l => [l.content, { id: l.content, label: l.content }])).values()];
    if (this.tab === 'find') {
      const bar = h('div', 'ss-pfw-bar', P);
      select(bar, [{ id: '', label: 'All content' }, ...contents], d.filter || '', v => this.ui.emit('pf:filter', { content: v }));
      const r = btn('ss-btn ss-btn--sm', bar, null, () => this.ui.emit('pf:refresh', {}), 'Refresh'); r.innerHTML = glyph('refresh') + '<span>Refresh</span>';
      h('span', 'ss-pfw-count', bar, `${(d.listings || []).length} listings`);
      const list = h('div', 'ss-pfw-list ss-scroll', P);
      const ls = (d.listings || []).filter(l => !d.filter || l.content === d.filter);
      if (!ls.length) h('div', 'ss-empty', list, 'No parties are recruiting for this right now. Why not post your own?');
      for (const l of ls) {
        const row = h('div', 'ss-pfw-row' + (l.joined ? ' is-joined' : ''), list);
        const sup = (l.members || []).filter(m => m.support).length;
        const slots = Array.from({ length: l.size || 4 }, (_, i) => { const m = (l.members || [])[i]; return m ? `<i class="ss-pfw-m${m.support ? ' is-sup' : ''}" style="background-image:url('${iconUrl('class:' + m.cls, 24)}')" title="${esc(m.name)}"></i>` : '<i class="ss-pfw-m is-open"></i>'; }).join('');
        row.innerHTML = `<i class="ss-pfw-ic" style="background-image:url('${iconUrl(l.icon || 'ui:party', 40)}')"></i>
          <div class="ss-pfw-tx"><b>“${esc(l.title || l.content)}”</b><span>${esc(l.content)}${l.sub ? ' · ' + esc(l.sub) : ''}</span>${(l.tags || []).length ? `<div class="ss-pfw-tags">${l.tags.map(t => `<em>${esc(t)}</em>`).join('')}</div>` : ''}</div>
          <div class="ss-pfw-slots">${slots}</div>
          <div class="ss-pfw-req"><span class="${l.req?.iLvl ? '' : 'ss-dim'}">iLvl ${l.req?.iLvl ? fmtInt(l.req.iLvl) + '+' : 'any'}</span><span>${glyph('cross')} ${sup}/${l.req?.supports ?? (l.size > 4 ? 2 : 1)}</span></div>
          <div class="ss-pfw-lead">${crest(l.leader?.cls || 'reaver', 18)}<span>${esc(l.leader?.name || '')}</span></div>`;
        const full = (l.members || []).length >= (l.size || 4);
        const b = btn('ss-btn ss-btn--sm' + (l.joined ? '' : ' ss-btn--primary'), row, l.joined ? 'Leave' : full ? 'Full' : 'Join', () => this.ui.emit(l.joined ? 'pf:leave' : 'pf:join', { id: l.id }));
        b.disabled = full && !l.joined;
        if (l.note) row._tip = { title: l.title || l.content, lines: [l.note] };
      }
    } else {
      const mine = d.mine;
      if (mine) {
        h('div', 'ss-h', P, 'Your Listing');
        const c = h('div', 'ss-pfw-mine', P);
        c.innerHTML = `<b>“${esc(mine.title || mine.content)}”</b><span>${esc(mine.content)} · ${(mine.members || []).length}/${mine.size || 4} · iLvl ${fmtInt(mine.req?.iLvl || 0)}+</span>`;
        btn('ss-btn ss-btn--danger ss-btn--sm', c, 'Take Down', () => this.ui.emit('pf:cancel', {}));
        return;
      }
      h('div', 'ss-h', P, 'Post a Listing');
      const f = h('div', 'ss-pfw-form', P);
      const row = (l) => { const r = h('label', 'ss-pfw-f', f); h('span', 'ss-label', r, l); return r; };
      const cSel = select(row('Content'), contents.length ? contents : [{ id: 'Chaos Dungeon', label: 'Chaos Dungeon' }], contents[0]?.id || '', () => {});
      const t = h('input', 'ss-input', row('Title')); t.maxLength = 48; t.placeholder = 'e.g. Gorrath NM · know mechs · 1415+'; t.addEventListener('keydown', e => e.stopPropagation());
      const il = h('input', 'ss-input', row('Min. Item Level')); il.type = 'number'; il.value = d.iLvl ? Math.floor(d.iLvl) : 1100; il.addEventListener('keydown', e => e.stopPropagation());
      let size = 4; seg(row('Party Size'), [{ id: '4', label: '4 players' }, { id: '8', label: '8 players' }], '4', v => { size = +v; });
      const note = h('input', 'ss-input', row('Note')); note.maxLength = 80; note.placeholder = 'Optional'; note.addEventListener('keydown', e => e.stopPropagation());
      btn('ss-btn ss-btn--primary', h('div', 'ss-pfw-post', f), 'Post Listing', () => this.ui.emit('pf:create', { content: cSel.value, title: t.value.trim(), iLvl: +il.value || 0, size, note: note.value.trim() }));
    }
  }
}

// ================================================================================================ mail
export class MailWin extends Win {
  static id = 'mail'; static title = 'Mail'; static glyph = 'mail'; static width = 780;
  build() {
    const b = this.body; b.classList.add('ss-mail');
    const L = h('div', 'ss-mail-l', b);
    const bar = h('div', 'ss-mail-bar', L);
    this.count = h('span', '', bar);
    this.all = btn('ss-btn ss-btn--sm', bar, 'Claim All', () => this.ui.emit('mail:claimAll', {}));
    this.list = h('div', 'ss-mail-list ss-scroll', L);
    this.view = h('div', 'ss-mail-view', b);
  }
  render(d) {
    this.d = d;
    const mails = d.mails || [];
    if (!this.sel || !mails.find(m => m.id === this.sel)) this.sel = mails[0]?.id;
    this.count.textContent = `${mails.filter(m => !m.read).length} unread · ${mails.length} total`;
    this.all.disabled = !mails.some(m => (m.attachments || []).length && !m.claimed);
    clear(this.list);
    for (const m of mails) {
      const r = h('div', 'ss-mail-row ss-ptr' + (m.id === this.sel ? ' is-sel' : '') + (m.read ? '' : ' is-unread'), this.list);
      r.innerHTML = `<i class="ss-mail-k">${glyph(m.kind === 'system' ? 'crown' : m.kind === 'guild' ? 'guild' : 'mail')}</i><div><b>${esc(m.subject)}</b><span>${esc(m.from)} · ${esc(fmtDate(m.date))}</span></div>${(m.attachments || []).length && !m.claimed ? `<em>${glyph('inventory')}</em>` : ''}`;
      r.addEventListener('click', () => { this.sel = m.id; if (!m.read) this.ui.emit('mail:open', { id: m.id }); this.render(this.d); });
    }
    if (!mails.length) h('div', 'ss-empty', this.list, 'Your mailbox is empty.');
    const m = mails.find(x => x.id === this.sel);
    const V = this.view; clear(V);
    if (!m) return;
    const hd = h('div', 'ss-mail-hd', V);
    hd.innerHTML = `<b>${esc(m.subject)}</b><span>From <em>${esc(m.from)}</em> · ${esc(fmtDate(m.date))}${m.expires ? ` · expires ${esc(m.expires)}` : ''}</span>`;
    h('div', 'ss-mail-body ss-scroll', V, m.body || '');
    if ((m.attachments || []).length) {
      h('div', 'ss-h', V, 'Attachments');
      const at = h('div', 'ss-mail-att', V);
      for (const it of m.attachments) at.appendChild(slot(it, { size: 46, dim: !!m.claimed }));
    }
    const ft = h('div', 'ss-mail-ft', V);
    const del = btn('ss-btn ss-btn--ghost ss-btn--sm', ft, null, () => this.ui.emit('mail:delete', { id: m.id }), 'Delete mail'); del.innerHTML = glyph('trash') + '<span>Delete</span>';
    del.disabled = (m.attachments || []).length > 0 && !m.claimed;
    if ((m.attachments || []).length) { const c = btn('ss-btn ss-btn--primary', ft, m.claimed ? 'Claimed' : 'Claim', () => this.ui.emit('mail:claim', { id: m.id })); c.disabled = !!m.claimed; }
  }
}
function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d;
  const dt = new Date(d), now = Date.now(), diff = (now - dt) / 1000;
  if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm ago';
  if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ================================================================================================ guild
export class GuildWin extends Win {
  static id = 'guild'; static title = 'Guild'; static glyph = 'guild'; static width = 860;
  build() { this.body.classList.add('ss-gd'); this.tab = 'overview'; }
  render(d) {
    this.d = d;
    const B = this.body; clear(B);
    const g = d.guild;
    if (!g) return this.browse(d);
    const hd = h('div', 'ss-gd-hd', B);
    hd.innerHTML = `<div class="ss-gd-emb" style="--gc:${esc(g.emblem?.color || '#c9a45a')}">${glyph('guild')}</div>
      <div class="ss-gd-id"><div class="ss-gd-name">${esc(g.name)} <span>&lt;${esc(g.tag || '')}&gt;</span></div><div class="ss-gd-motto">${esc(g.motto || '')}</div>
      <div class="ss-gd-lv"><span>Guild Level ${g.level}</span><div class="ss-bar ss-bar--gold"><i class="ss-fill" style="transform:scaleX(${g.xpMax ? Math.min(1, g.xp / g.xpMax) : 1})"></i></div><em>${fmtInt(g.xp || 0)} / ${fmtInt(g.xpMax || 0)}</em></div></div>
      <div class="ss-gd-bs"><span>Bloodstones</span><b>${fmtInt(g.bloodstones || 0)}</b></div>`;
    const T = tabs(B, [{ id: 'overview', label: 'Overview' }, { id: 'members', label: 'Members', count: (g.members || []).length }, { id: 'research', label: 'Research' }, { id: 'missions', label: 'Missions' }], this.tab, id => { this.tab = id; this.render(this.d); });
    void T;
    const P = h('div', 'ss-gd-pane ss-scroll', B);
    if (this.tab === 'overview') {
      const on = (g.members || []).filter(m => m.online).length;
      const s = h('div', 'ss-gd-ov', P);
      s.innerHTML = `<div class="ss-gd-stat"><span>Members</span><b>${(g.members || []).length}</b></div><div class="ss-gd-stat"><span>Online</span><b class="ss-good">${on}</b></div><div class="ss-gd-stat"><span>Your Rank</span><b>${esc(g.rank || 'Member')}</b></div>`;
      h('div', 'ss-h', P, 'Weekly Donation');
      const dn = h('div', 'ss-gd-don', P);
      for (const [k, label, amt] of [['silver', 'Donate Silver', '10,000 silver'], ['gold', 'Donate Gold', '100 gold']]) {
        const c = h('div', 'ss-gd-dc', dn);
        c.innerHTML = `<i style="background-image:url('${iconUrl('currency:' + k, 36)}')"></i><div><b>${label}</b><span>${amt} → Bloodstones & guild XP</span></div>`;
        btn('ss-btn ss-btn--primary ss-btn--sm', c, 'Donate', () => this.ui.emit('guild:donate', { kind: k }));
      }
      const lv = h('div', 'ss-gd-leave', P);
      btn('ss-btn ss-btn--ghost ss-btn--sm', lv, 'Leave Guild', async () => { if (await this.ui.confirm({ title: 'Leave Guild', text: `Leave ${g.name}? Your weekly contribution is lost.`, ok: 'Leave', danger: true })) this.ui.emit('guild:leave', {}); });
    } else if (this.tab === 'members') {
      const t = h('div', 'ss-gd-tbl', P);
      t.innerHTML = `<div class="ss-gd-tr ss-gd-th"><span>Name</span><span>Class</span><span>Lv</span><span>iLvl</span><span>Rank</span><span>Weekly</span></div>` +
        [...(g.members || [])].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.iLvl || 0) - (a.iLvl || 0)).map(m => `<div class="ss-gd-tr${m.online ? '' : ' is-off'}"><span><i class="ss-dot${m.online ? ' is-on' : ''}"></i>${esc(m.name)}</span><span>${crest(m.cls, 18)}${esc(clsInfo(m.cls).name)}</span><span>${m.level ?? ''}</span><span>${m.iLvl ? fmtInt(m.iLvl) : ''}</span><span>${esc(m.rank || 'Member')}</span><span>${fmtInt(m.weekly || 0)}</span></div>`).join('');
    } else if (this.tab === 'research') {
      for (const r of g.research || []) {
        const c = h('div', 'ss-gd-rs', P);
        c.innerHTML = `<div><b>${esc(r.name)}</b><span>${esc(r.desc || '')}</span></div><div class="ss-pips">${Array.from({ length: r.max || 5 }, (_, i) => `<i class="${i < r.level ? 'on' : ''}"></i>`).join('')}</div>`;
        const b = btn('ss-btn ss-btn--sm', c, r.level >= (r.max || 5) ? 'Max' : 'Research', () => this.ui.emit('guild:research', { id: r.id })); b.disabled = r.level >= (r.max || 5);
      }
      if (!(g.research || []).length) h('div', 'ss-empty', P, 'No research available.');
    } else {
      for (const m of g.missions || []) {
        const c = h('div', 'ss-gd-ms', P);
        const f = Math.min(1, (m.n || 0) / Math.max(1, m.need || 1));
        c.innerHTML = `<div><b>${esc(m.name)}</b><span>${esc(m.reward || '')}</span></div><div class="ss-gd-mbar"><i style="transform:scaleX(${f})"></i><em>${fmtInt(m.n || 0)} / ${fmtInt(m.need || 0)}</em></div>`;
        const b = btn('ss-btn ss-btn--sm', c, f >= 1 ? 'Complete' : 'Track', () => this.ui.emit('guild:mission', { id: m.id }));
        if (f >= 1) b.classList.add('ss-btn--primary');
      }
      if (!(g.missions || []).length) h('div', 'ss-empty', P, 'No missions this week.');
    }
  }
  browse(d) {
    const B = this.body;
    h('div', 'ss-h', B, 'Find a Guild');
    const list = h('div', 'ss-gd-browse ss-scroll', B);
    for (const g of d.browse || []) {
      const r = h('div', 'ss-gd-brow', list);
      r.innerHTML = `<div class="ss-gd-emb sm">${glyph('guild')}</div><div><b>${esc(g.name)} <span>&lt;${esc(g.tag)}&gt;</span></b><em>${esc(g.motto || '')}</em></div><div class="ss-gd-bm"><span>Lv ${g.level}</span><span>${g.members}/${g.max || 100}</span>${g.req ? `<span>${esc(g.req)}</span>` : ''}</div>`;
      btn('ss-btn ss-btn--primary ss-btn--sm', r, 'Apply', () => this.ui.emit('guild:join', { id: g.id }));
    }
    if (!(d.browse || []).length) h('div', 'ss-empty', list, 'No guilds are recruiting.');
    h('div', 'ss-h', B, 'Found a Guild');
    const f = h('div', 'ss-gd-create', B);
    const n = h('input', 'ss-input', f); n.placeholder = 'Guild name'; n.maxLength = 20; n.addEventListener('keydown', e => e.stopPropagation());
    const t = h('input', 'ss-input ss-gd-tag', f); t.placeholder = 'TAG'; t.maxLength = 4; t.addEventListener('keydown', e => e.stopPropagation());
    btn('ss-btn ss-btn--primary', f, 'Found Guild', () => { if (n.value.trim().length >= 3) this.ui.emit('guild:create', { name: n.value.trim(), tag: t.value.trim().toUpperCase() }); });
  }
}

// ================================================================================================ leaderboards
export const BOARDS = [
  { id: 'legion_first', label: 'World First', group: 'Weekly Legion Race' },
  { id: 'legion_nm', label: 'Fastest · Normal', group: 'Weekly Legion Race' },
  { id: 'legion_hm', label: 'Fastest · Hard', group: 'Weekly Legion Race' },
  { id: 'legion_dps', label: 'Top DPS', group: 'Weekly Legion Race', subs: CLASS_IDS.filter(c => clsInfo(c).role !== 'Support').map(c => ({ id: c, label: clsInfo(c).name })) },
  { id: 'legion_support', label: 'Top Support', group: 'Weekly Legion Race' },
  { id: 'legion_deathless', label: 'Deathless', group: 'Weekly Legion Race' },
  { id: 'guardian', label: 'Daily Guardian', group: 'Daily' },
  { id: 'inferno', label: 'Inferno Descent', group: 'Challenges' },
  { id: 'pvp', label: 'Proving Grounds', group: 'Challenges' },
  { id: 'stone', label: 'Best Ability Stone', group: 'Just for Fun' },
  { id: 'honing', label: 'Luckiest Honing', group: 'Just for Fun' },
  { id: 'seeds', label: 'Most Pip Seeds', group: 'Just for Fun' },
];
export class LeaderboardsWin extends Win {
  static id = 'leaderboards'; static title = 'Leaderboards'; static glyph = 'trophy'; static width = 900;
  build() {
    const b = this.body; b.classList.add('ss-lb');
    this.side = h('div', 'ss-lb-side ss-scroll', b);
    this.main = h('div', 'ss-lb-main', b);
  }
  render(d) {
    this.d = d;
    const boards = d.boards || BOARDS;
    const board = d.board || this.board || boards[0].id; this.board = board;
    const B = boards.find(x => x.id === board) || boards[0];
    clear(this.side);
    let grp = null;
    for (const x of boards) {
      if (x.group && x.group !== grp) { grp = x.group; h('div', 'ss-lb-grp', this.side, grp); }
      const b = btn('ss-lb-tab' + (x.id === board ? ' is-on' : ''), this.side, x.label, () => { this.board = x.id; this.ui.emit('lb:board', { board: x.id, sub: x.subs?.[0]?.id }); this.render({ ...this.d, board: x.id }); });
      b.setAttribute('aria-pressed', x.id === board);
    }
    const M = this.main; clear(M);
    const top = h('div', 'ss-lb-top', M);
    top.innerHTML = `<div><b>${esc(B.label)}</b><span>${esc(B.group || '')}</span></div>${d.note ? `<em>${glyph('clock')} ${esc(d.note)}</em>` : ''}`;
    if (B.subs) {
      const sub = d.sub || B.subs[0].id;
      const st = h('div', 'ss-lb-subs', M);
      for (const s of B.subs) { const b = btn('ss-lb-sub' + (s.id === sub ? ' is-on' : ''), st, null, () => this.ui.emit('lb:board', { board: B.id, sub: s.id }), s.label); b.innerHTML = crest(s.id, 20) + `<span>${esc(s.label)}</span>`; }
    }
    const t = h('div', 'ss-lb-tbl ss-scroll', M);
    const rows = d.rows || [];
    t.innerHTML = rows.map(r => `<div class="ss-lb-tr${r.you ? ' is-you' : ''}${r.rank <= 3 ? ' is-top r' + r.rank : ''}">
      <span class="ss-lb-rank">${r.rank <= 3 ? `<i>${r.rank}</i>` : r.rank}</span>
      <span class="ss-lb-who">${r.cls ? crest(r.cls, 22) : ''}<b>${esc(r.name)}</b>${r.party ? `<span class="ss-lb-party">${r.party.map(c => crest(c, 16)).join('')}</span>` : ''}</span>
      <span class="ss-lb-note">${esc(r.sub || '')}</span><span class="ss-lb-val">${esc(r.value)}</span></div>`).join('') || '<div class="ss-empty">No entries yet. Be the first.</div>';
    if (d.you) { const y = h('div', 'ss-lb-you', M); y.innerHTML = `<span>Your best</span><b>#${fmtInt(d.you.rank)}</b><em>${esc(d.you.value)}</em>`; }
  }
}
