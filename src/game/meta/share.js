// Share cards: build card data from game moments, render (cards.js), preview in a modal with Save image (download),
// Share… (Web Share API with the PNG), Copy image (clipboard) and Copy challenge link.
//   const m = new ShareModal(meta); await m.open('clear', data, { challenge })   → the rendered canvas
//   clearData(meta, clear) · honeData(…) · stoneData(…) · profileData(meta) · infernoData(…)
import { renderCard, CARD_W, CARD_H } from './cards.js';
import { heroPortrait } from './portrait.js';
import { challengeLink, challengeText } from './challenge.js';
import { RAIDS, GUARDIANS } from '../../data/raids.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';
import { CLASSES } from '../../data/classes/index.js';
import { engravingLevels } from '../../data/engravings.js';
import { itemLevel } from '../systems/stats.js';
import { engr as engrInfo } from '../../ui/core/data.js';
import { glyph } from '../../ui/core/glyphs.js';
import { bossName, todaysGuardian, fmtValue } from './boards.js';
import { pbStore } from './records.js';
import { clock, esc, pretty } from './fmt.js';

const CHAOS_NAMES = ['Demon Rift I', 'Demon Rift II', 'Demon Rift III', 'Demon Rift IV'];
export const rankOf = (cleared, time) => (!cleared ? 'D' : time < 150 ? 'S' : time < 240 ? 'A' : time < 360 ? 'B' : 'C');
const safeName = s => String(s || 'card').replace(/[^A-Za-z0-9À-ÿ_-]+/g, '').slice(0, 24) || 'card';

// ---------------------------------------------------------------------------------------------- card data
/** clear = { content, result, char, t, board: { label, rank, total }, pb, badges, challenge } (see index.js onClear) */
export function clearData(meta, clear) {
  const c = clear.content || {}, r = clear.result || {}, ch = clear.char || meta.s?.char || {};
  if (c.kind === 'inferno') return infernoData(meta, clear);
  let over = 'Cleared', title = r.name || '', sub = '', boss = r.boss || c.boss || null;
  if (c.kind === 'guardian') { boss = c.boss || boss; over = c.boss === todaysGuardian(clear.t) ? 'Guardian Hunt · Daily Guardian' : 'Guardian Hunt'; title = bossName(boss); sub = BOSS_DEFS[boss]?.title || ''; }
  else if (c.kind === 'raid') {
    const R = RAIDS[c.raid], gate = R?.gates?.[c.gate ?? 0];
    const names = (gate?.bosses || []).map(b => bossName(b.boss));
    boss = gate?.bosses?.[gate.bosses.length - 1]?.boss || boss;
    over = `${R?.kind === 'legion' ? 'Legion Raid' : 'Abyssal Dungeon'} · Gate ${(c.gate ?? 0) + 1}${R?.kind === 'legion' ? ` · ${c.hard ? 'Hard' : 'Normal'}` : ''}`;
    title = names.length > 1 ? names.join(' & ') : names[0] || title; sub = gate?.name || R?.name || '';
    if (c.gate === 0 && c.raid === 'gorrath') boss = 'skarn';
  } else if (c.kind === 'chaos') { over = 'Chaos Dungeon'; title = CHAOS_NAMES[(c.tier || 1) - 1] || 'Demon Rift'; sub = r.kills ? `${r.kills} demons purged` : 'Three stages of demon hordes'; boss = 'gatekeeper'; }
  else if (c.kind) { over = pretty(c.kind); title = title || 'Victory'; }
  if (!r.cleared) over = over === 'Cleared' ? 'Defeated' : `${over} · Defeated`;
  const party = (r.meter || []).map(m => ({ name: m.name, cls: m.cls, dps: m.dps, dmg: m.dmg, share: m.share, you: !!m.you }));
  const me = party.find(m => m.you) || { name: ch.name, cls: ch.cls };
  const badges = [...(clear.badges || [])];
  return { content: c.kind, boss, over, title, sub, time: r.time, rank: r.cleared ? rankOf(true, r.time || 0) : null, failed: !r.cleared, deaths: r.deaths, kills: r.kills, board: clear.board || null, badges, party,
    you: { name: me.name || ch.name, cls: me.cls || ch.cls, iLvl: ch.equip ? Math.floor(itemLevel(ch)) : null }, date: clear.t || Date.now() };
}
export function infernoData(meta, clear) {
  const c = clear.content || {}, r = clear.result || {}, ch = clear.char || meta.s?.char || {};
  const mode = meta.s?.game?.mode;
  const boons = mode?.kind === 'inferno' && mode.boonOrder ? mode.boonOrder.map(id => pretty(id) + (mode.boons?.[id] > 1 ? ` ×${mode.boons[id]}` : '')) : (clear.boons || []);
  const floor = r.floor || 0;
  return { floor, time: r.time, kills: r.kills, conquered: floor >= 100, boons, board: clear.board || null, best: meta.s?.account?.roster?.records?.inferno?.best,
    sub: r.cleared ? `Descended from floor ${c.start || 1}` : 'The Inferno claims another', name: ch.name, cls: ch.cls, date: clear.t || Date.now() };
}
/** h = the honing tracker's success record (index.js) */
export function honeData(meta, h) {
  const ch = meta.s?.char || {};
  return { name: ch.name, cls: ch.cls, item: { name: h.item?.name, icon: h.item?.icon || (h.item?.slot ? `item:${h.item.slot}` : 'item:weapon'), grade: h.item?.grade ?? 5 },
    to: h.to, taps: h.taps, chance: h.chance, base: h.base, energy: h.energy, luck: h.luck, odds: h.odds, guaranteed: h.guaranteed, iLvl: h.item?.iLvl, date: h.t || Date.now() };
}
/** v = a StoneView (systems/engravings.js stoneView) or the stone window's shape */
export function stoneData(meta, v) {
  const ch = meta.s?.char || {};
  const lines = (v.lines || []).map((l, i) => ({ id: l.id, name: l.name || engrInfo(l.id)?.name || pretty(l.id), slots: l.slots || [], nodes: l.nodes ?? (l.slots || []).filter(x => x === 1).length, negative: l.negative || i === 2 }));
  const score = v.score || lines.map(l => l.nodes);
  return { name: ch.name, cls: ch.cls, label: v.label, score, lines, grade: v.grade ?? 5, stoneName: v.name || '', date: Date.now() };
}
export async function profileData(meta) {
  const s = meta.s, ch = s?.char; if (!ch) return null;
  const lv = engravingLevels(ch) || {};
  const engravings = Object.entries(lv).filter(([, l]) => l > 0).sort((a, b) => b[1] - a[1] || (a[0].startsWith('neg_') ? 1 : -1)).map(([id, level]) => ({ id, level, name: engrInfo(id)?.name || pretty(id), neg: id.startsWith('neg_') }));
  const pb = pbStore(s.account);
  const weight = k => (/^raid:.*full/.test(k) ? 5 : /^raid:/.test(k) ? 4 : /^inferno/.test(k) ? 3 : /^guardian:/.test(k) ? 2 : /^dps:/.test(k) ? 2 : 1);
  const recs = Object.entries(pb).sort((a, b) => weight(b[0]) - weight(a[0]) || (b[1].t || 0) - (a[1].t || 0)).slice(0, 2).map(([, r]) => `${r.label} ${fmtValue(r.unit || 'time', r.v)}`);
  const w = ch.equip?.weapon;
  const titleName = typeof ch.title === 'string' ? pretty(ch.title) : null;
  const portrait = await heroPortrait(ch);
  return { name: ch.name, cls: ch.cls, level: ch.level, iLvl: itemLevel(ch), title: titleName, guild: s.account?.roster?.guild?.name || null, roster: s.account?.roster?.level,
    engravings, weapon: w ? { name: w.name, hone: w.hone, grade: w.grade } : null, records: recs, portrait, date: Date.now() };
}

// ---------------------------------------------------------------------------------------------- the modal
const TITLES = { clear: 'Share your clear', hone: 'Share your honing', stone: 'Share your stone', profile: 'Share your Shardbearer', inferno: 'Share your descent' };
export class ShareModal {
  constructor(meta) { this.meta = meta; this.el = null; this.isOpen = false; this.canvas = null; }
  build() {
    const layer = this.meta.ui.layer(); if (!layer) return null;
    const bg = this.el = document.createElement('div');
    bg.className = 'ss-mx-modal ss-mx-share-bg ss-ptr';
    bg.innerHTML = `<section class="ss-mx-share ss-panel ss-orn" role="dialog" aria-label="Share card">
      <header class="ss-win-hd ss-mx-hd"><div class="ss-win-t">${glyph('share')}<span></span></div><button type="button" class="ss-close" data-a="close" aria-label="Close">${glyph('close')}</button></header>
      <div class="ss-mx-share-pv"><div class="ss-mx-spin"><i></i><span>Painting your card…</span></div></div>
      <div class="ss-mx-share-row"></div><p class="ss-mx-share-note" aria-live="polite"></p></section>`;
    layer.appendChild(bg);
    this.pv = bg.querySelector('.ss-mx-share-pv'); this.row = bg.querySelector('.ss-mx-share-row'); this.note = bg.querySelector('.ss-mx-share-note'); this.tt = bg.querySelector('.ss-win-t span');
    bg.addEventListener('pointerdown', e => { if (e.target === bg) this.close(); });
    bg.querySelector('[data-a="close"]').onclick = () => this.close();
    return bg;
  }
  /** Render and preview a card. o: { challenge?: challenge object for a link, file?: name } → canvas */
  async open(kind, data, o = {}) {
    if (!this.el && !this.build()) return null;
    const token = this.token = (this.token || 0) + 1;
    this.el.style.display = ''; if (!this.isOpen) this.meta.ui.pushModal(this); this.isOpen = true;
    this.tt.textContent = TITLES[kind] || 'Share';
    this.pv.innerHTML = '<div class="ss-mx-spin"><i></i><span>Painting your card…</span></div>'; this.row.innerHTML = ''; this.note.textContent = '';
    this.el.querySelector('.ss-mx-share').classList.remove('ss-mx-pop'); void this.el.offsetWidth; this.el.querySelector('.ss-mx-share').classList.add('ss-mx-pop');
    await new Promise(r => setTimeout(r, 30));                   // let the spinner paint
    if (kind === 'profile' && data?.then) data = await data;
    const canvas = await renderCard(kind, data || {});
    if (token !== this.token || !this.isOpen) return canvas;
    this.canvas = canvas; this.meta.lastCard = canvas; this.meta.lastCardKind = kind;
    canvas.className = 'ss-mx-share-img'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${kind} share card`);
    this.pv.innerHTML = ''; this.pv.appendChild(canvas);
    const who = data?.name || data?.you?.name || 'hero';
    const file = o.file || `sevenshard-${kind}-${safeName(who)}-${new Date().toISOString().slice(0, 10)}.png`;
    const blob = new Promise(res => { try { canvas.toBlob(b => res(b), 'image/png'); } catch { res(null); } });
    const btn = (label, g, fn, primary) => { const b = document.createElement('button'); b.type = 'button'; b.className = `ss-btn${primary ? ' ss-btn--primary' : ''}`; b.innerHTML = `${glyph(g)}<span>${esc(label)}</span>`; b.onclick = fn; this.row.appendChild(b); return b; };
    const say = m => { this.note.textContent = m; };
    btn('Save image', 'down', async () => {
      const b = await blob; if (!b) return say('Your browser could not create the image.');
      const dl = typeof window !== 'undefined' && window.claude?.use ? await window.claude.use('downloads').catch(() => null) : null;
      if (dl) { try { await dl.save({ filename: file, data: b }); say('Saved.'); } catch { say('Download cancelled.'); } return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = file; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000); say(`Saved ${file}.`);
    }, true);
    const text = o.text || (o.challenge ? challengeText(o.challenge) : 'SEVENSHARD — a Lost Ark-style action MMO in one browser tab.');
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      btn('Share…', 'share', async () => {
        const b = await blob; if (!b) return;
        const f = new File([b], file, { type: 'image/png' });
        const payload = { files: [f], title: 'SEVENSHARD', text: o.challenge ? `${text} ${challengeLink(o.challenge)}` : text };
        if (!navigator.canShare(payload)) return say('Sharing images is not supported here — use Save image.');
        try { await navigator.share(payload); say('Shared!'); } catch (e) { if (e?.name !== 'AbortError') say('Sharing failed — use Save image.'); }
      });
    }
    if (typeof window !== 'undefined' && window.ClipboardItem && navigator.clipboard?.write) {
      btn('Copy image', 'photo', () => navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob.then(b => b || new Blob()) })])
        .then(() => say('Image copied — paste it anywhere.'), () => say('Your browser blocked image copying. Use Save image instead.')));
    }
    if (o.challenge) btn('Copy challenge link', 'send', () => copyText(`${text} ${challengeLink(o.challenge)}`, say));
    btn('Close', 'close', () => this.close());
    say(o.challenge ? 'Send the card with a challenge link: your friends can launch the same fight and try to beat you.' : `${CARD_W}×${CARD_H} — perfect for Discord, X and Reddit.`);
    return canvas;
  }
  close() { if (this.el) this.el.style.display = 'none'; if (this.isOpen) this.meta.ui.dropModal(this); this.isOpen = false; this.token = (this.token || 0) + 1; }
}
/** clipboard text with a selectable fallback (some embeds refuse clipboard access) */
export function copyText(text, say = () => {}) {
  const fallback = () => {
    const box = document.createElement('textarea'); box.value = text; box.readOnly = true; box.className = 'ss-mx-copybox';
    document.body.appendChild(box); box.focus(); box.select();
    const done = () => setTimeout(() => box.remove(), 100);
    box.addEventListener('blur', done); box.addEventListener('keydown', e => { if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'c')) { e.stopPropagation(); setTimeout(done, 150); } });
    say('Press Cmd/Ctrl+C to copy.');
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => say('Copied — send it to a friend.'), fallback); else fallback();
}
export { GUARDIANS, CLASSES };
