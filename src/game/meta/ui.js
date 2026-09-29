// Meta overlays, built from the UI design system (src/ui/b-kit.css primitives + src/game/meta/meta.css) inside the
// UI's virtual 1600×900 space, in their own layer above screens: they stay visible on the title and results screens
// (where UI windows and toasts are hidden).
//   MetaUI      layer, ribbons (records / personal bests / challenges on any screen), share pills, title challenge card
//   BoardsPanel the leaderboards overlay with board tabs, variants, your best, your records
import { iconUrl } from '../../ui/core/icon.js';
import { glyph } from '../../ui/core/glyphs.js';
import { cls as clsInfo } from '../../ui/core/data.js';
import { BOARDS, BOARD, boardView, defOf, defaultVariant, periodEnd, remoteState, onBoardsChanged, bossName, todaysGuardian } from './boards.js';
import { recordRows } from './records.js';
import { esc, dur, int, clock } from './fmt.js';
import { db, saveDb } from './store.js';

export class MetaUI {
  constructor(meta) { this.meta = meta; this.el = null; this.ribbons = null; this.pillEl = null; this.modals = []; }
  get ui() { return this.meta.s?.ui; }
  /** the meta layer inside the UI's zoomed virtual space (created on first use) */
  layer() {
    if (this.el?.isConnected) return this.el;
    const v = this.ui?.v; if (!v) return null;
    this.el = document.createElement('div'); this.el.className = 'ss-layer ss-mx-layer';
    v.appendChild(this.el);
    this.ribbons = document.createElement('div'); this.ribbons.className = 'ss-mx-ribbons'; this.el.appendChild(this.ribbons);
    return this.el;
  }
  scale() { return this.ui?.scale || 1; }
  size() { return { w: this.ui?.vw || 1600, h: this.ui?.vh || 900 }; }
  /** Esc closes the top meta modal; returns true when one was open */
  escape() { const m = this.modals[this.modals.length - 1]; if (m) { m.close(); return true; } return false; }
  get modalOpen() { return this.modals.length > 0; }
  pushModal(m) { this.modals.push(m); }
  dropModal(m) { const i = this.modals.indexOf(m); if (i >= 0) this.modals.splice(i, 1); }

  /**
   * A celebration / record card at the top of the screen, visible on every screen.
   * o: { over, text, sub, kind: 'gold'|'good'|'info'|'bad', icon (icon id), dur (s), action: { label, fn } }
   */
  ribbon(o) {
    if (!this.layer()) return null;
    const el = document.createElement('div');
    el.className = `ss-mx-rib ss-panel ss-ptr is-${o.kind || 'gold'}`;
    el.innerHTML = `${o.icon ? `<i class="ss-mx-rib-ic" style="background-image:url('${iconUrl(o.icon, 44)}')"></i>` : `<i class="ss-mx-rib-gl">${glyph(o.glyph || 'trophy')}</i>`}
      <div class="ss-mx-rib-t">${o.over ? `<em>${esc(o.over)}</em>` : ''}<b>${esc(o.text || '')}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</div>
      ${o.action ? `<button type="button" class="ss-btn ss-btn--sm">${esc(o.action.label)}</button>` : ''}<button type="button" class="ss-close" aria-label="Dismiss">${glyph('close')}</button>`;
    const kill = () => { el.classList.add('is-out'); setTimeout(() => el.remove(), 260); };
    el.querySelector('.ss-close').onclick = kill;
    if (o.action) el.querySelector('.ss-btn').onclick = () => { kill(); try { o.action.fn(); } catch (e) { console.warn('[meta]', e); } };
    this.ribbons.appendChild(el);
    while (this.ribbons.children.length > 4) this.ribbons.firstChild.remove();
    setTimeout(kill, (o.dur || 7) * 1000);
    return el;
  }
  /** In-game: the UI's own toast when the HUD is up, a ribbon otherwise (toasts are hidden on screens). */
  note(text, kind = 'success', o = {}) {
    const ui = this.ui, inGame = ui && (ui.currentName === 'game' || ui.currentName === 'death') && ui.hudVisible !== false;
    if (inGame && !o.action && !o.force) ui.toast(text, kind === 'gold' ? 'success' : kind === 'bad' ? 'warn' : kind);
    else this.ribbon({ text, kind: kind === 'success' ? 'good' : kind, ...o });
  }
  /** A small "share this moment" prompt above the skill bar (in game) — o: { text, sub, icon, label, fn, dur } */
  pill(o) {
    if (!this.layer()) return;
    this.pillEl?.remove();
    const el = this.pillEl = document.createElement('div');
    el.className = 'ss-mx-pill ss-panel ss-ptr';
    el.innerHTML = `${o.icon ? `<i style="background-image:url('${iconUrl(o.icon, 34)}')"></i>` : ''}<div><b>${esc(o.text)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</div>
      <button type="button" class="ss-btn ss-btn--primary ss-btn--sm">${glyph('share')}<span>${esc(o.label || 'Share')}</span></button><button type="button" class="ss-close" aria-label="Dismiss">${glyph('close')}</button>`;
    const kill = () => { if (this.pillEl === el) this.pillEl = null; el.classList.add('is-out'); setTimeout(() => el.remove(), 240); };
    el.querySelector('.ss-btn').onclick = () => { kill(); o.fn?.(); };
    el.querySelector('.ss-close').onclick = kill;
    this.layer().appendChild(el);
    setTimeout(kill, (o.dur || 10) * 1000);
  }

  /** The challenge card on the title screen (bottom-left, mirroring the news card). */
  titleChallenge(ch, { onAccept, onDismiss } = {}) {
    this.hideTitleChallenge();
    if (!ch || !this.layer()) return;
    const el = this.chEl = document.createElement('aside');
    el.className = 'ss-mx-chal ss-panel ss-orn ss-ptr';
    const what = challengeWhat(ch);
    const icon = ch.boss ? `boss:${ch.boss}` : ch.kind === 'inferno' ? 'boss:gatekeeper' : ch.kind === 'chaos' ? 'boss:gatekeeper' : 'ui:pvp';
    el.innerHTML = `<header><em>${glyph('sword')} A challenge for you</em><button type="button" class="ss-close" aria-label="Dismiss challenge">${glyph('close')}</button></header>
      <div class="ss-mx-chal-b"><i class="ss-mx-chal-m" style="background-image:url('${iconUrl(icon, 72)}')"></i>
      <div><p><i class="ss-mx-cr" style="background-image:url('${iconUrl('class:' + (ch.cls || 'reaver'), 18)}')"></i><b></b> <span class="ss-mx-dim">dares you to beat</span></p>
      <h3></h3><div class="ss-mx-chal-v"></div></div></div>
      <footer><button type="button" class="ss-btn ss-btn--primary" data-a="ok">${glyph('sword')}<span>Accept</span></button><span class="ss-mx-dim">Enter the world and the rift opens for you.</span></footer>`;
    el.querySelector('p b').textContent = ch.name || 'A Shardbearer';
    el.querySelector('h3').textContent = what.title;
    el.querySelector('.ss-mx-chal-v').innerHTML = `<b>${esc(what.value)}</b><span>${esc(what.sub)}</span>`;
    el.querySelector('.ss-close').onclick = () => { this.hideTitleChallenge(); onDismiss?.(); };
    el.querySelector('[data-a="ok"]').onclick = () => { el.classList.add('is-ok'); el.querySelector('footer').innerHTML = `<span class="ss-mx-ok">${glyph('check')} Accepted — choose your character and enter the world.</span>`; onAccept?.(); };
    this.layer().appendChild(el);
  }
  hideTitleChallenge() { this.chEl?.remove(); this.chEl = null; }
}

/** Human description of a challenge: { title, value, sub } */
export function challengeWhat(ch) {
  const mode = ch.hard ? 'Hard' : 'Normal';
  if (ch.kind === 'guardian') return { title: bossName(ch.boss), value: clock(ch.time || 0), sub: `Guardian Hunt${ch.deaths === 0 ? ' · deathless' : ''}` };
  if (ch.kind === 'raid') return { title: ch.raid === 'gorrath' ? `Gorrath · Gate ${(ch.gate ?? 0) + 1}` : `${bossName(ch.boss)} · Gate ${(ch.gate ?? 0) + 1}`, value: clock(ch.time || 0), sub: `${ch.raid === 'gorrath' ? 'Legion Raid' : 'Abyssal Dungeon'} · ${mode}` };
  if (ch.kind === 'chaos') return { title: `Demon Rift ${['I', 'II', 'III', 'IV'][(ch.tier || 1) - 1] || ''}`.trim(), value: clock(ch.time || 0), sub: 'Chaos Dungeon' };
  if (ch.kind === 'inferno') return { title: 'Inferno Descent', value: `Floor ${ch.floor || 0}`, sub: ch.time ? `in ${clock(ch.time).replace(/\.\d$/, '')}` : 'How deep can you go?' };
  return { title: 'A challenge', value: clock(ch.time || 0), sub: '' };
}

// ================================================================================================== leaderboards
export class BoardsPanel {
  constructor(meta) {
    this.meta = meta; this.el = null; this.isOpen = false;
    const st = db().ui.boards || {};
    this.board = BOARD[st.board] ? st.board : 'legion_first'; this.variant = st.variant || defaultVariant(this.board);
    onBoardsChanged(() => { if (this.isOpen) this.render(); });
  }
  build() {
    const layer = this.meta.ui.layer(); if (!layer) return null;
    const bg = this.el = document.createElement('div');
    bg.className = 'ss-mx-modal ss-ptr';
    bg.innerHTML = `<section class="ss-mx-lb ss-panel ss-orn" role="dialog" aria-label="Leaderboards">
      <header class="ss-win-hd ss-mx-hd"><div class="ss-win-t">${glyph('trophy')}<span>Leaderboards</span></div><span class="ss-mx-net"></span>
        <button type="button" class="ss-close" data-a="close" aria-label="Close leaderboards">${glyph('close')}</button></header>
      <div class="ss-mx-lb-b"><nav class="ss-mx-lb-side ss-scroll"></nav><main class="ss-mx-lb-main"><div class="ss-mx-lb-top"></div><div class="ss-mx-lb-vars"></div>
        <div class="ss-mx-lb-th"></div><div class="ss-mx-lb-tbl ss-scroll"></div><footer class="ss-mx-lb-you"></footer></main></div></section>`;
    layer.appendChild(bg);
    this.side = bg.querySelector('.ss-mx-lb-side'); this.top = bg.querySelector('.ss-mx-lb-top'); this.vars = bg.querySelector('.ss-mx-lb-vars');
    this.th = bg.querySelector('.ss-mx-lb-th'); this.tbl = bg.querySelector('.ss-mx-lb-tbl'); this.you = bg.querySelector('.ss-mx-lb-you'); this.net = bg.querySelector('.ss-mx-net');
    bg.addEventListener('pointerdown', e => { if (e.target === bg) this.close(); });
    bg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'close') return this.close();
      if (b.dataset.board) { this.select(b.dataset.board, b.dataset.board === 'records' ? '' : defaultVariant(b.dataset.board)); return; }
      if (b.dataset.variant != null) { this.select(this.board, b.dataset.variant); return; }
      if (b.dataset.a === 'challenge') this.meta.challengeFromBoard?.(this.board, this.variant);
      if (b.dataset.a === 'play') this.meta.playBoard?.(this.board, this.variant);
    });
    return bg;
  }
  select(board, variant) {
    this.board = board; this.variant = variant ?? defaultVariant(board);
    (db().ui.boards = { board: this.board, variant: this.variant }); saveDb();
    this.render();
    this.tbl.scrollTop = 0;
  }
  open(board, variant) {
    if (!this.el && !this.build()) return;
    if (board && (BOARD[board] || board === 'records')) { this.board = board; this.variant = variant ?? defaultVariant(board); }
    this.el.style.display = ''; this.isOpen = true; this.meta.ui.pushModal(this);
    this.render();
    this.el.querySelector('.ss-mx-lb').classList.remove('ss-mx-pop'); void this.el.offsetWidth; this.el.querySelector('.ss-mx-lb').classList.add('ss-mx-pop');
  }
  close() { if (this.el) this.el.style.display = 'none'; if (this.isOpen) this.meta.ui.dropModal(this); this.isOpen = false; }
  toggle(b, v) { this.isOpen ? this.close() : this.open(b, v); }
  render() {
    if (!this.isOpen || !this.el) return;
    const now = Date.now();
    // side: groups
    let grp = null, side = '';
    for (const B of BOARDS) {
      if (B.group !== grp) { grp = B.group; side += `<div class="ss-mx-lb-grp">${esc(grp)}</div>`; }
      const label = B.id === 'guardian' ? `${B.label}<small>${esc(bossName(todaysGuardian(now)))}</small>` : esc(B.label);
      side += `<button type="button" class="ss-mx-lb-tab${B.id === this.board ? ' is-on' : ''}" data-board="${B.id}" aria-pressed="${B.id === this.board}">${label}</button>`;
    }
    side += `<div class="ss-mx-lb-grp">You</div><button type="button" class="ss-mx-lb-tab${this.board === 'records' ? ' is-on' : ''}" data-board="records">Personal Records</button>`;
    this.side.innerHTML = side;
    const online = remoteState.enabled ? (remoteState.ok === false ? 'offline' : 'global') : 'local';
    this.net.className = `ss-mx-net is-${online}`;
    this.net.innerHTML = `<i></i>${online === 'global' ? 'Global board' : online === 'offline' ? 'Global board unreachable · local' : 'Local realm'}`;
    if (this.board === 'records') return this.renderRecords();
    const v = boardView(this.board, this.variant, { now, limit: 100 }); if (!v) return;
    const def = v.def, B = BOARD[this.board];
    const reset = B.period === 'all' ? 'All time' : `Resets in ${dur(periodEnd(B, now) - now)}`;
    this.top.innerHTML = `<div><b>${esc(def.label)}${def.variantLabel && !def.cls ? ` <span>· ${esc(def.variantLabel)}</span>` : ''}${this.board === 'guardian' ? ` <span>· ${esc(v.guardianName)}</span>` : ''}</b><p>${esc(def.desc || '')}</p></div>
      <em>${glyph('clock')} ${esc(reset)} · ${int(v.total)} ${v.total === 1 ? 'entry' : 'entries'}</em>`;
    // variants: gates / inferno kinds as a segmented control, classes as crest chips
    if (B.variants) {
      this.vars.innerHTML = `<div class="${B.classVariants ? 'ss-mx-lb-cls' : 'ss-seg'}">${B.variants.map(x => `<button type="button" data-variant="${x.id}" aria-pressed="${x.id === def.variant}">${x.cls ? `<i class="ss-mx-cr" style="background-image:url('${iconUrl('class:' + x.cls, 20)}')"></i>` : ''}<span>${esc(x.label)}</span></button>`).join('')}</div>`;
      this.vars.style.display = '';
    } else { this.vars.innerHTML = ''; this.vars.style.display = 'none'; }
    const partyCol = v.rows.some(r => r.party?.length);
    this.th.className = `ss-mx-lb-th${partyCol ? ' has-party' : ''}`;
    this.th.innerHTML = `<span>#</span><span>Shardbearer</span>${partyCol ? '<span>Party</span>' : ''}<span>Details</span><span>${esc(unitLabel(def.unit))}</span>`;
    const crest = (c, s = 22) => `<i class="ss-mx-cr" style="width:${s}px;height:${s}px;background-image:url('${iconUrl('class:' + c, s)}')"></i>`;
    this.tbl.innerHTML = v.rows.length ? v.rows.map(r => {
      const tags = [r.you && '<em class="ss-mx-tg is-you">You</em>', r.friend && '<em class="ss-mx-tg">Friend</em>', r.remote && !r.you && '<em class="ss-mx-tg is-g">Global</em>', r.trial && '<em class="ss-mx-tg is-m" title="Trial run: stats raised to the raid minimum">Trial</em>', r.premade && '<em class="ss-mx-tg is-m" title="Premade (Raid Ready) character">Premade</em>', r.coop && '<em class="ss-mx-tg">Co-op</em>'].filter(Boolean).join('');
      return `<div class="ss-mx-lb-tr${partyCol ? ' has-party' : ''}${r.you ? ' is-you' : ''}${r.rank <= 3 ? ' is-top r' + r.rank : ''}" style="--cc:${clsInfo(r.cls).color}">
        <span class="ss-mx-lb-rank">${r.rank <= 3 ? `<i><b>${r.rank}</b></i>` : int(r.rank)}</span>
        <span class="ss-mx-lb-who">${crest(r.cls)}<b>${esc(r.name)}</b>${r.guild ? `<small>&lt;${esc(r.guild)}&gt;</small>` : ''}${tags}</span>
        ${partyCol ? `<span class="ss-mx-lb-party">${(r.party || []).slice(0, 8).map(c => crest(c, 16)).join('')}</span>` : ''}
        <span class="ss-mx-lb-sub">${esc(r.sub)}</span><span class="ss-mx-lb-val">${esc(r.display)}</span></div>`;
    }).join('') : `<div class="ss-mx-empty">${glyph('trophy')}<b>${B.period === 'week' ? 'The race has just begun' : 'No entries yet'}</b><span>Be the first name on this board.</span></div>`;
    const y = v.you;
    const playable = /^legion|guardian|inferno/.test(this.board);
    this.you.innerHTML = y ? `<span>Your best</span><b>#${int(y.rank)}</b><em>${esc(y.display)}</em><small>${esc(y.name)} · ${esc(y.sub || '')}</small><i></i>
        <button type="button" class="ss-btn ss-btn--sm" data-a="challenge">${glyph('send')}<span>Challenge a friend</span></button>`
      : `<span>${esc(noEntryHint(this.board))}</span><i></i>${playable && this.meta.s?.char && this.meta.s?.screen === 'game' && !this.meta.s?.guestMode ? `<button type="button" class="ss-btn ss-btn--sm ss-btn--primary" data-a="play">${glyph('sword')}<span>Take it on</span></button>` : ''}`;
  }
  renderRecords() {
    const rows = recordRows(this.meta.s?.account);
    this.top.innerHTML = `<div><b>Personal Records</b><p>Your roster’s best clears, damage and lucky moments. Records are saved with your roster.</p></div><em>${int(rows.length)} records</em>`;
    this.vars.innerHTML = ''; this.vars.style.display = 'none';
    this.th.className = 'ss-mx-lb-th is-rec'; this.th.innerHTML = '<span>Record</span><span>By</span><span>Details</span><span>Best</span>';
    const crest = c => (c ? `<i class="ss-mx-cr" style="background-image:url('${iconUrl('class:' + c, 20)}')"></i>` : '');
    this.tbl.innerHTML = rows.length ? rows.map(r => `<div class="ss-mx-lb-tr is-rec"><span class="ss-mx-lb-rl">${esc(r.label)}</span><span class="ss-mx-lb-who">${crest(r.cls)}<b>${esc(r.name || '')}</b></span>
      <span class="ss-mx-lb-sub">${esc(r.sub || '')}${r.prev ? ` · was ${esc(r.prev)}` : ''}</span><span class="ss-mx-lb-val">${esc(r.display)}</span></div>`).join('')
      : `<div class="ss-mx-empty">${glyph('star')}<b>No records yet</b><span>Clear a guardian, a raid gate, a chaos dungeon or the Inferno — every best is kept here.</span></div>`;
    this.you.innerHTML = '';
  }
}
const unitLabel = u => ({ time: 'Time', after: 'After reset', dps: 'DPS', score: 'Score', floor: 'Depth', rating: 'Rating', stone: 'Stone', luck: 'Odds', count: 'Seeds' }[u] || 'Value');
function noEntryHint(board) {
  if (board === 'legion_first') return 'Clear both gates of Gorrath this week to enter the race.';
  if (board === 'legion_dps') return 'Clear a Gorrath gate this week on a damage dealer to post your DPS.';
  if (board === 'legion_support') return 'Clear a Gorrath gate this week on a support to post your score.';
  if (board === 'legion_deathless') return 'Clear a Gorrath gate this week without a single death in the raid.';
  if (board.startsWith('legion_')) return 'Clear a Gorrath gate this week to post a time.';
  if (board === 'guardian') return `Hunt ${bossName(todaysGuardian())} today to post a time.`;
  if (board === 'inferno') return 'Descend into the Inferno to post your depth.';
  if (board === 'stone') return 'Finish faceting an ability stone this week.';
  if (board === 'honing') return 'Land a honing success this week.';
  if (board === 'seeds') return 'Find Pip Seeds around Solmara.';
  if (board === 'pvp') return 'Fight in the Proving Grounds to earn a rating.';
  return 'No entry yet.';
}
export { defOf };
