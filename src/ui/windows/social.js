// Social windows: Party Finder (O), Mail, Guild (U), Leaderboards. (Party Finder data: see its section below.)
//
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
// Data (lead: src/game/social/partyfinder.js, session.windowData('partyfinder')):
//   { you: { name, cls, ilvl },
//     listings: [{ id, title, content: { kind: 'raid'|'guardian'|'chaos', raid?, gate?, hard?, boss?, tier? }, max, req, note, age (s),
//                  leader: Member, members: [Member], canApply }],
//     mine: null | { title, content, max, req, note, members: [Member], applicants: [Member] },
//     contents: [{ kind, raid?, gate?, hard?, boss?, tier?, title, max, req, locked }] }
//   Member = { name, cls, ilvl, support?, title? }
// Actions: pf:apply { id } · pf:create { content, note, req } · pf:accept { name } · pf:decline { name } · pf:cancel {} ·
//          pf:start {} · pf:match { content } · pf:refresh {}
const ABYSS = ['oratory'];
const PF_CATS = [{ id: 'legion', label: 'Legion Raid' }, { id: 'abyss', label: 'Abyss' }, { id: 'guardian', label: 'Guardian' }, { id: 'chaos', label: 'Chaos' }, { id: 'all', label: 'All' }];
export function pfCat(c) {
  if (!c) return 'all';
  if (c.kind === 'abyss' || (c.kind === 'raid' && (c.abyss || ABYSS.includes(c.raid)))) return 'abyss';
  return c.kind === 'raid' ? 'legion' : c.kind;
}
function pfIcon(c) {
  if (!c) return 'ui:party';
  if (c.kind === 'guardian') return 'boss:' + (c.boss || 'rimewing');
  if (c.kind === 'chaos') return 'boss:gatekeeper';
  return 'boss:' + ({ gorrath: c.gate === 0 ? 'skarn' : 'gorrath', oratory: c.gate === 0 ? 'nerissa' : 'deep_oracle' }[c.raid] || 'gorrath');
}
const sameContent = (a, b) => a && b && a.kind === b.kind && a.raid === b.raid && a.gate === b.gate && !!a.hard === !!b.hard && a.boss === b.boss && a.tier === b.tier;
const ago = s => s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : Math.floor(s / 3600) + 'h ago';
function seats(members, max) {
  let out = '';
  for (let i = 0; i < (max || 4); i++) {
    const m = (members || [])[i];
    out += m ? `<i class="ss-pfw-m${m.support ? ' is-sup' : ''}" style="background-image:url('${iconUrl('class:' + m.cls, 24)}')" title="${esc(m.name)} · ${esc(clsInfo(m.cls).name)} · ${fmtInt(m.ilvl || 0)}"></i>` : '<i class="ss-pfw-m is-open"></i>';
  }
  return out;
}

export class PartyFinderWin extends Win {
  static id = 'partyfinder'; static title = 'Party Finder'; static glyph = 'finder'; static width = 1080;
  build() {
    const b = this.body; b.classList.add('ss-pfw');
    this.cat = 'legion';
    const L = h('div', 'ss-pfw-main', b);
    this.tabs = tabs(L, PF_CATS, this.cat, id => { this.cat = id; this.render(this.d); });
    this.bar = h('div', 'ss-pfw-bar', L);
    this.list = h('div', 'ss-pfw-list ss-scroll', L);
    this.side = h('aside', 'ss-pfw-side', b);
  }
  render(d) {
    this.d = d = d || {};
    const you = d.you || {};
    // counts per category
    const all = d.listings || [];
    for (const c of PF_CATS) { const b = this.tabs.map[c.id]; b.querySelector('.ss-count')?.remove(); b.insertAdjacentHTML('beforeend', `<span class="ss-count">${c.id === 'all' ? all.length : all.filter(l => pfCat(l.content) === c.id).length}</span>`); }
    clear(this.bar);
    const rf = btn('ss-btn ss-btn--sm', this.bar, null, () => this.ui.emit('pf:refresh', {}), 'Refresh listings'); rf.innerHTML = glyph('refresh') + '<span>Refresh</span>';
    h('span', 'ss-pfw-you', this.bar).innerHTML = you.name ? `${glyph('character')} ${esc(you.name)} · Item Level <b>${fmtInt(you.ilvl || 0)}</b>` : '';
    clear(this.list);
    const ls = all.filter(l => this.cat === 'all' || pfCat(l.content) === this.cat);
    if (!ls.length) h('div', 'ss-empty', this.list, 'No parties are recruiting here right now. Post your own or try matchmaking.');
    for (const l of ls) {
      const low = (you.ilvl || 0) < (l.req || 0);
      const full = (l.members || []).length >= (l.max || 4);
      const row = h('div', 'ss-pfw-row' + (low ? ' is-low' : ''), this.list);
      row.innerHTML = `<i class="ss-pfw-ic" style="background-image:url('${iconUrl(pfIcon(l.content), 44)}')"></i>
        <div class="ss-pfw-tx"><b>${esc(l.title)}${l.content?.hard ? ' <em class="ss-pfw-hm">Hard</em>' : ''}</b><span>“${esc(l.note || '')}”</span></div>
        <div class="ss-pfw-slots">${seats(l.members, l.max)}<small>${(l.members || []).length}/${l.max || 4}</small></div>
        <div class="ss-pfw-req${low ? ' is-low' : ''}"><span>iLvl</span><b>${fmtInt(l.req || 0)}+</b></div>
        <div class="ss-pfw-lead"><i class="ss-crest" style="width:18px;height:18px;background-image:url('${iconUrl('class:' + (l.leader?.cls || 'reaver'), 18)}')"></i><div><b>${esc(l.leader?.name || '')}</b><span>${ago(l.age || 0)}</span></div></div>`;
      const b = btn('ss-btn ss-btn--sm' + (l.canApply ? ' ss-btn--primary' : ''), row, full ? 'Full' : 'Apply', () => this.ui.emit('pf:apply', { id: l.id }), `Apply to ${l.title}`);
      b.disabled = !l.canApply || full;
      row._tip = { title: l.title, lines: [`Leader: ${l.leader?.name || ''}${l.leader?.title ? ' — ' + l.leader.title : ''}`, `“${l.note || ''}”`, low ? `Your item level (${fmtInt(you.ilvl || 0)}) is below the requirement.` : null] };
    }
    this.renderSide(d);
  }
  renderSide(d) {
    const S = this.side; clear(S);
    const mine = d.mine;
    if (mine) {
      h('div', 'ss-h', S, 'My Party');
      const card = h('div', 'ss-pfw-mine', S);
      card.innerHTML = `<div class="ss-pfw-mh"><i class="ss-pfw-ic" style="background-image:url('${iconUrl(pfIcon(mine.content), 40)}')"></i><div><b>${esc(mine.title)}</b><span>“${esc(mine.note || '')}” · iLvl ${fmtInt(mine.req || 0)}+</span></div></div><div class="ss-pfw-slots is-big">${seats(mine.members, mine.max)}</div>`;
      h('div', 'ss-h', S, `Applicants · ${(mine.applicants || []).length}`);
      const ap = h('div', 'ss-pfw-apps ss-scroll', S);
      for (const a of mine.applicants || []) {
        const r = h('div', 'ss-pfw-app', ap);
        r.innerHTML = `<i class="ss-crest" style="width:26px;height:26px;background-image:url('${iconUrl('class:' + a.cls, 26)}')"></i><div><b>${esc(a.name)}${a.support ? ` <em>${glyph('cross')}</em>` : ''}</b><span>${esc(clsInfo(a.cls).name)} · ${fmtInt(a.ilvl || 0)}${a.title ? ' · ' + esc(a.title) : ''}</span></div>`;
        const ok = btn('ss-btn ss-btn--sm ss-btn--icon ss-btn--primary', r, null, () => this.ui.emit('pf:accept', { name: a.name }), `Accept ${a.name}`); ok.innerHTML = glyph('check');
        const no = btn('ss-btn ss-btn--sm ss-btn--icon', r, null, () => this.ui.emit('pf:decline', { name: a.name }), `Decline ${a.name}`); no.innerHTML = glyph('close');
      }
      if (!(mine.applicants || []).length) h('div', 'ss-empty', ap, 'Waiting for adventurers to apply…');
      const ft = h('div', 'ss-pfw-sft', S);
      btn('ss-btn ss-btn--ghost ss-btn--sm', ft, 'Take Down', () => this.ui.emit('pf:cancel', {}));
      btn('ss-btn ss-btn--primary', ft, 'Start', () => this.ui.emit('pf:start', {}));
      return;
    }
    h('div', 'ss-h', S, 'Post a Listing');
    const f = h('div', 'ss-pfw-form', S);
    const contents = d.contents || [];
    const inCat = contents.filter(c => this.cat === 'all' || pfCat(c) === this.cat);
    const pool = inCat.length ? inCat : contents;
    if (this.pick == null || !pool.includes(pool[this.pick])) this.pick = Math.max(0, pool.findIndex(c => !c.locked));
    const lab = (t) => { const r = h('label', 'ss-pfw-f', f); h('span', 'ss-label', r, t); return r; };
    const sel = h('select', 'ss-select', lab('Content'));
    pool.forEach((c, i) => { const o = h('option', '', sel, c.title + (c.locked ? ' (locked)' : '')); o.value = i; o.disabled = !!c.locked; });
    sel.value = this.pick;
    const note = h('input', 'ss-input', lab('Note')); note.maxLength = 40; note.placeholder = 'e.g. know mechs, chill run'; note.value = this.note || '';
    note.addEventListener('keydown', e => e.stopPropagation()); note.addEventListener('input', () => { this.note = note.value; });
    const req = h('input', 'ss-input', lab('Min. Item Level')); req.inputMode = 'numeric'; req.value = pool[this.pick]?.req || 0; req.addEventListener('keydown', e => e.stopPropagation());
    sel.addEventListener('change', () => { this.pick = +sel.value; req.value = pool[this.pick]?.req || 0; });
    const post = btn('ss-btn ss-btn--primary', f, 'Post Listing', () => { const c = pool[+sel.value]; if (!c || c.locked) return; this.ui.emit('pf:create', { content: strip(c), note: note.value.trim(), req: parseInt(req.value) || c.req || 0 }); });
    post.disabled = !pool.length;
    h('div', 'ss-h', S, 'Matchmaking');
    const mm = h('div', 'ss-pfw-mm ss-scroll', S);
    for (const c of pool) {
      const r = h('div', 'ss-pfw-mmr' + (c.locked ? ' is-locked' : ''), mm);
      r.innerHTML = `<i class="ss-crest" style="width:28px;height:28px;background-image:url('${iconUrl(pfIcon(c), 28)}')"></i><div><b>${esc(c.title)}</b><span>${c.max || 4} players · iLvl ${fmtInt(c.req || 0)}</span></div>`;
      const b = btn('ss-btn ss-btn--sm', r, null, () => this.ui.emit('pf:match', { content: strip(c) }), `Matchmake ${c.title}`);
      b.innerHTML = glyph('users') + '<span>Match</span>'; b.disabled = !!c.locked;
    }
    if (!pool.length) h('div', 'ss-empty', mm, 'Nothing to match for.');
  }
}
/** The content key the game expects back (drops UI-only fields). */
function strip(c) { const o = { kind: c.kind }; for (const k of ['raid', 'gate', 'hard', 'boss', 'tier']) if (c[k] != null) o[k] = c[k]; return o; }
export { sameContent };

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
