// Share cards: 1200×630 canvases (the social-image size) painted with the 2D API, system fonts only.
//   renderCard(kind, data) → Promise<HTMLCanvasElement>
// kinds and data:
//   'clear'   { content: 'guardian'|'raid'|'chaos'|'abyss', boss, over, title, sub, time, rank, deaths, board?: { label, rank, total },
//               badges: [string], party: [{ name, cls, dps, dmg, share, you }], you: { name, cls }, date }
//   'hone'    { name, cls, item: { name, icon, grade }, to, taps, chance, base, energy, luck, label, iLvl, date }
//   'stone'   { name, cls, label ('97'), score: [a, b, neg], lines: [{ id, name, slots: [1|-1|0…], nodes, negative }], grade, date }
//   'profile' { name, cls, level, iLvl, title, guild, roster, engravings: [{ id, name, level }], weapon: { name, hone, grade }, records: [string], portrait?: canvas, date }
//   'inferno' { name, cls, floor, time, kills, boons: [string], conquered, board?: { rank, total }, date }
import { iconCanvas } from '../../ui/icons/index.js';
import { cls as clsInfo } from '../../ui/core/data.js';
import { PUBLIC_URL } from './remote.js';
import { short, clock, int, pct } from './fmt.js';

export const CARD_W = 1200, CARD_H = 630;
const W = CARD_W, H = CARD_H;
const SERIF = 'Georgia, "Times New Roman", "Palatino Linotype", serif';
const SANS = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const COND = '"Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
export const BOSS_ACCENT = {
  rimewing: ['#6fd0ff', '#3a6cff'], cinderhorn: ['#ff7a2a', '#ff2a1a'], sandmaw: ['#f0b860', '#c0702a'], kurai: ['#ff8a3a', '#ff3a6a'],
  nerissa: ['#3ae0d0', '#2a7aff'], deep_oracle: ['#9a7aff', '#4a2aff'], skarn: ['#ff5a3a', '#b01a2a'], vesk: ['#ff5a3a', '#b01a2a'],
  gorrath: ['#ff4a2a', '#ffb03a'], thunderhoof: ['#ffe060', '#60a0ff'], gatekeeper: ['#ff7a3a', '#ff3a1a'], varkhul: ['#ff5a2a', '#901a1a'],
  ashmaw: ['#ff7a2a', '#702010'], chaos: ['#b060ff', '#ff3a8a'],
};

// ---------------------------------------------------------------------------------------------- tiny helpers
function prng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex2 = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = hex2(h); return `rgba(${r},${g},${b},${a})`; };
const mixc = (a, b, t) => { const A = hex2(a), B = hex2(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function newCard() { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; }
function glow(x, cx, cy, r, col, a) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(0.45, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
function rr(x, px, py, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else { x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); } }
const goldGrad = (x, y0, y1) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#fff6d6'); g.addColorStop(0.42, '#f6d98c'); g.addColorStop(0.58, '#d9a650'); g.addColorStop(1, '#8a5a20'); return g; };
/** text with optional letter spacing (drawn per glyph: works on every canvas), stroke and shadow. Returns the width. */
function text(x, s, px, py, font, fill, o = {}) {
  s = String(s ?? ''); x.save();
  x.font = font; x.textBaseline = o.base || 'alphabetic';
  const ls = o.ls || 0, chars = [...s], w = ls ? chars.reduce((a, ch) => a + x.measureText(ch).width, 0) + ls * (chars.length - 1) : x.measureText(s).width;
  let sx = px; if (o.align === 'center') sx = px - w / 2; else if (o.align === 'right') sx = px - w;
  if (o.shadow !== false) { x.shadowColor = o.shadowColor || 'rgba(0,0,0,.8)'; x.shadowBlur = o.blur ?? 10; x.shadowOffsetY = o.dy ?? 2; }
  const draw = (fn) => { if (!ls) { fn(s, sx, py); return; } let cx = sx; for (const ch of chars) { fn(ch, cx, py); cx += x.measureText(ch).width + ls; } };
  if (o.stroke) { x.lineWidth = o.stroke; x.strokeStyle = o.strokeStyle || 'rgba(0,0,0,.92)'; x.lineJoin = 'round'; draw((t, a, b) => x.strokeText(t, a, b)); x.shadowBlur = 0; x.shadowOffsetY = 0; }
  x.fillStyle = fill; draw((t, a, b) => x.fillText(t, a, b));
  x.restore();
  return w;
}
/** shrink a font size until the text fits maxW */
function fit(x, s, weight, size, family, maxW, ls = 0) {
  for (let px = size; px > 10; px -= 2) { x.font = `${weight} ${px}px ${family}`; const w = x.measureText(s).width + ls * (s.length - 1); if (w <= maxW) return px; }
  return 10;
}
function wrap(x, s, font, maxW) { x.font = font; const words = String(s || '').split(/\s+/), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
function icon(id, size, opts) { try { return iconCanvas(id, size, opts); } catch { return null; } }
function drawIcon(x, id, px, py, size, opts) { const c = icon(id, Math.min(512, Math.max(32, Math.round(size * 1.5))), opts); if (c) x.drawImage(c, px, py, size, size); return !!c; }
const clsColor = c => clsInfo(c).color || '#c9a45a';
const clsName = c => clsInfo(c).name || 'Adventurer';
const dateStr = d => { const t = d ? new Date(d) : new Date(); return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
const host = () => { const u = PUBLIC_URL || (typeof location !== 'undefined' && /^https?:/.test(location.protocol) ? location.href : 'sevenshard'); return u.replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/index\.html$/, '').replace(/\/$/, ''); };

// ---------------------------------------------------------------------------------------------- scenery
/** painterly night backdrop: base gradient, two nebula glows in the card's accents, brush strokes, rays, dust, vignette */
function backdrop(x, a1, a2, seed = 7, focus = [300, 290]) {
  const R = prng(seed);
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a0e1c'); g.addColorStop(0.55, '#080b16'); g.addColorStop(1, '#04060c');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  glow(x, focus[0], focus[1], 560, a1, 0.34);
  glow(x, W * 0.86, H * 0.12, 520, a2, 0.18);
  glow(x, W * 0.62, H * 1.02, 460, a1, 0.12);
  x.save(); x.lineCap = 'round'; x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 150; i++) {
    const px = R() * W, py = R() * H, l = 60 + R() * 220, a = -0.55 + (R() - 0.5) * 0.4;
    x.strokeStyle = rgba(R() < 0.6 ? a1 : a2, 0.012 + R() * 0.03); x.lineWidth = 8 + R() * 34;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  // god rays behind the focus
  for (let i = 0; i < 9; i++) {
    const ang = -Math.PI / 2 + (i - 4) * 0.2 + (R() - 0.5) * 0.08, len = 640;
    const gr = x.createLinearGradient(focus[0], focus[1], focus[0] + Math.cos(ang) * len, focus[1] + Math.sin(ang) * len);
    gr.addColorStop(0, rgba(a1, 0.12)); gr.addColorStop(1, rgba(a1, 0));
    x.fillStyle = gr; x.beginPath(); x.moveTo(focus[0], focus[1]);
    x.lineTo(focus[0] + Math.cos(ang - 0.045) * len, focus[1] + Math.sin(ang - 0.045) * len); x.lineTo(focus[0] + Math.cos(ang + 0.045) * len, focus[1] + Math.sin(ang + 0.045) * len); x.closePath(); x.fill();
  }
  for (let i = 0; i < 140; i++) { const px = R() * W, py = R() * H, r = 0.5 + R() * 1.8; x.fillStyle = rgba(R() < 0.7 ? '#fff4d8' : a1, 0.25 + R() * 0.55); x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill(); if (R() < 0.12) glow(x, px, py, r * 7, a1, 0.3); }
  x.restore();
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.72)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
}
/** the seven-shard crest (the logo motif): one heart shard and three on each side on a gentle arc */
function shards(x, cx, cy, s = 1, glowCol = '#ffd98a') {
  const P = [[-150, 58, -26, 0.42], [-102, 30, -17, 0.56], [-54, 10, -8, 0.72], [0, 0, 0, 1], [54, 10, 8, 0.72], [102, 30, 17, 0.56], [150, 58, 26, 0.42]];
  glow(x, cx, cy - 10 * s, 150 * s, glowCol, 0.22);
  for (const [dx, dy, rot, k] of P) {
    x.save(); x.translate(cx + dx * s, cy + dy * s); x.rotate(rot * Math.PI / 180); x.scale(s * k, s * k);
    const g = x.createLinearGradient(0, -70, 0, 60); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.45, '#f3c96a'); g.addColorStop(1, '#8a4a12');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, -72); x.lineTo(15, 0); x.lineTo(0, 58); x.lineTo(-15, 0); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.moveTo(0, -72); x.lineTo(15, 0); x.lineTo(0, 6); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(40,20,4,.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, -72); x.lineTo(15, 0); x.lineTo(0, 58); x.lineTo(-15, 0); x.closePath(); x.stroke();
    x.restore();
  }
}
/** gold double frame with corner brackets and the shard crest at the top */
function frame(x, a1) {
  x.save();
  const gg = x.createLinearGradient(0, 0, W, H); gg.addColorStop(0, '#f6dc9c'); gg.addColorStop(0.5, '#a07a3a'); gg.addColorStop(1, '#f0d08a');
  x.strokeStyle = 'rgba(0,0,0,.85)'; x.lineWidth = 4; x.strokeRect(14, 14, W - 28, H - 28);
  x.strokeStyle = gg; x.lineWidth = 2; x.strokeRect(16, 16, W - 32, H - 32);
  x.strokeStyle = rgba('#f3dca0', 0.28); x.lineWidth = 1; x.strokeRect(24.5, 24.5, W - 49, H - 49);
  x.fillStyle = gg;
  for (const [cx, cy, sx, sy] of [[16, 16, 1, 1], [W - 16, 16, -1, 1], [16, H - 16, 1, -1], [W - 16, H - 16, -1, -1]]) {
    x.save(); x.translate(cx, cy); x.scale(sx, sy);
    x.fillRect(0, 0, 54, 4); x.fillRect(0, 0, 4, 54); x.fillRect(10, 10, 22, 2); x.fillRect(10, 10, 2, 22);
    x.translate(11, 11); x.rotate(Math.PI / 4); x.fillStyle = a1; x.fillRect(-3.5, -3.5, 7, 7); x.fillStyle = gg;
    x.restore();
  }
  x.restore();
}
/** footer: crest + SEVENSHARD wordmark (left), call to action + address + date (right) */
function footer(x, a1, right, date) {
  x.save();
  const y = H - 58;
  x.strokeStyle = rgba('#c9a45a', 0.35); x.lineWidth = 1; x.beginPath(); x.moveTo(60, y - 22); x.lineTo(W - 60, y - 22); x.stroke();
  shards(x, 88, y + 6, 0.2, a1);
  text(x, 'SEVENSHARD', 128, y + 16, `400 30px ${SERIF}`, goldGrad(x, y - 8, y + 18), { ls: 7, blur: 8 });
  text(x, 'THE SUNDERED LIGHT', 131, y + 36, `600 11px ${SANS}`, '#b9a37a', { ls: 4.2, shadow: false });
  text(x, right || 'Play free in your browser', W - 62, y + 8, `600 17px ${SANS}`, '#e8dcc0', { align: 'right' });
  text(x, `${host()}  ·  ${dateStr(date)}`, W - 62, y + 32, `500 14px ${SANS}`, '#a79a82', { align: 'right', ls: 0.6, shadow: false });
  x.restore();
}
function overline(x, s, px, py, col = '#d9b56a') { return text(x, s.toUpperCase(), px, py, `600 16px ${SANS}`, col, { ls: 5, blur: 6 }); }
function headline(x, s, px, py, maxW, size = 68) {
  const S = String(s).toUpperCase(), ls = size * 0.1, fs = fit(x, S, 400, size, SERIF, maxW, ls);
  text(x, S, px, py, `400 ${fs}px ${SERIF}`, goldGrad(x, py - fs * 0.8, py + 4), { ls: fs * 0.1, stroke: 5, blur: 16 });
  return fs;
}
function chip(x, s, px, py, col, filled = false) {
  x.save(); x.font = `700 15px ${SANS}`;
  const S = s.toUpperCase(), w = [...S].reduce((a, c) => a + x.measureText(c).width, 0) + 1.6 * (S.length - 1) + 26, h = 30;
  rr(x, px, py, w, h, 4); x.fillStyle = filled ? rgba(col, 0.9) : 'rgba(6,8,16,.62)'; x.fill();
  x.lineWidth = 1.5; x.strokeStyle = rgba(col, 0.95); x.stroke();
  text(x, S, px + 13, py + 20.5, `700 15px ${SANS}`, filled ? '#1a1004' : col, { ls: 1.6, shadow: false });
  x.restore();
  return w;
}
function chips(x, list, px, py, maxW) { let cx = px; for (const [s, col, filled] of list) { if (!s) continue; x.font = `700 15px ${SANS}`; const w = x.measureText(s).width + s.length * 1.6 + 26; if (cx + w > px + maxW) break; cx += chip(x, s, cx, py, col, filled) + 10; } }
function statBox(x, label, value, px, py, w, col = '#ffffff') {
  x.save(); rr(x, px, py, w, 80, 5); x.fillStyle = 'rgba(4,6,12,.55)'; x.fill(); x.strokeStyle = 'rgba(201,164,90,.35)'; x.lineWidth = 1; x.stroke();
  text(x, label.toUpperCase(), px + w / 2, py + 26, `700 13px ${SANS}`, '#b8a888', { align: 'center', ls: 2.4, shadow: false });
  const fs = fit(x, String(value), 700, 34, SANS, w - 20);
  text(x, value, px + w / 2, py + 64, `700 ${fs}px ${SANS}`, col, { align: 'center', stroke: 3 });
  x.restore();
}
function medallion(x, id, cx, cy, r, a1) {
  glow(x, cx, cy, r * 1.9, a1, 0.42);
  x.save(); x.beginPath(); x.arc(cx, cy, r + 10, 0, 6.283); x.fillStyle = 'rgba(0,0,0,.55)'; x.fill(); x.restore();
  const ok = drawIcon(x, id, cx - r, cy - r, r * 2);
  if (!ok) { x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fillStyle = rgba(a1, 0.3); x.fill(); x.restore(); }
  x.save(); x.lineWidth = 3; x.strokeStyle = goldGrad(x, cy - r, cy + r); x.beginPath(); x.arc(cx, cy, r + 9, 0, 6.283); x.stroke();
  x.lineWidth = 1; x.strokeStyle = rgba('#f3dca0', 0.4); x.beginPath(); x.arc(cx, cy, r + 17, 0, 6.283); x.stroke();
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; x.fillStyle = i % 4 ? rgba('#f3dca0', 0.6) : '#fff3cc'; x.beginPath(); x.arc(cx + Math.cos(a) * (r + 17), cy + Math.sin(a) * (r + 17), i % 4 ? 1.6 : 3, 0, 6.283); x.fill(); }
  x.restore();
}
function rankDiamond(x, letter, cx, cy, s = 46) {
  x.save(); x.translate(cx, cy);
  glow(x, 0, 0, s * 2.2, '#ffcf6a', 0.3);
  x.rotate(Math.PI / 4);
  const g = x.createLinearGradient(-s, -s, s, s); g.addColorStop(0, '#2a2010'); g.addColorStop(1, '#0a0806');
  x.fillStyle = g; x.fillRect(-s, -s, s * 2, s * 2);
  x.lineWidth = 3; x.strokeStyle = goldGrad(x, -s, s); x.strokeRect(-s, -s, s * 2, s * 2);
  x.lineWidth = 1; x.strokeStyle = 'rgba(243,220,160,.45)'; x.strokeRect(-s + 7, -s + 7, s * 2 - 14, s * 2 - 14);
  x.restore();
  text(x, letter, cx, cy + s * 0.34, `400 ${Math.round(s * 1.15)}px ${SERIF}`, goldGrad(x, cy - s * 0.6, cy + s * 0.4), { align: 'center', stroke: 4, blur: 14 });
  text(x, 'RANK', cx, cy + s * 0.78, `700 11px ${SANS}`, '#e8d4a0', { align: 'center', ls: 3, shadow: false });
}
function crest(x, c, px, py, size) { drawIcon(x, 'class:' + c, px, py, size); }
/** party DPS bars: rows of crest + name + bar + value; 5+ members use two columns */
function partyBars(x, party, px, py, w, h) {
  const list = [...(party || [])].sort((a, b) => (b.dmg || b.dps || 0) - (a.dmg || a.dps || 0)).slice(0, 8);
  if (!list.length) return;
  const cols = list.length > 4 ? 2 : 1, rows = Math.ceil(list.length / cols), cw = (w - (cols - 1) * 24) / cols, rh = Math.min(38, h / rows);
  const top = Math.max(1, ...list.map(m => m.dps || 0));
  list.forEach((m, i) => {
    const cx = px + Math.floor(i / rows) * (cw + 24), cy = py + (i % rows) * rh, col = clsColor(m.cls);
    x.save();
    rr(x, cx, cy + 3, cw, rh - 6, 3); x.fillStyle = m.you ? 'rgba(201,164,90,.14)' : 'rgba(4,6,12,.45)'; x.fill();
    const bw = Math.max(4, (cw - 40) * ((m.dps || 0) / top));
    const bg = x.createLinearGradient(cx + 36, 0, cx + 36 + bw, 0); bg.addColorStop(0, rgba(col, 0.55)); bg.addColorStop(1, rgba(col, 0.15));
    rr(x, cx + 36, cy + 5, bw, rh - 10, 2); x.fillStyle = bg; x.fill();
    if (m.you) { x.fillStyle = '#f3dca0'; x.fillRect(cx, cy + 5, 3, rh - 10); }
    crest(x, m.cls, cx + 6, cy + rh / 2 - 12, 24);
    const nfs = fit(x, m.name, 700, 17, SANS, cw * 0.45);
    text(x, m.name, cx + 42, cy + rh / 2 + 6, `700 ${nfs}px ${SANS}`, m.you ? '#fff0c4' : '#f2f4fa', { blur: 4 });
    text(x, short(m.dps || 0), cx + cw - 64, cy + rh / 2 + 6, `700 17px ${COND}`, '#ffffff', { align: 'right', blur: 4 });
    text(x, m.share != null ? pct(m.share) : '', cx + cw - 10, cy + rh / 2 + 6, `600 14px ${COND}`, '#b9c2d6', { align: 'right', shadow: false });
    x.restore();
  });
}

// ---------------------------------------------------------------------------------------------- cards
function clearCard(d) {
  const [c, x] = newCard();
  const [a1, a2] = BOSS_ACCENT[d.boss] || BOSS_ACCENT.chaos;
  backdrop(x, a1, a2, 11 + (d.time | 0), [250, 250]);
  frame(x, a1);
  medallion(x, d.boss ? `boss:${d.boss}` : 'ui:pvp', 250, 250, 150, a1);
  if (d.rank && /^[SAB]$/.test(d.rank)) rankDiamond(x, d.rank, 372, 382, 40);   // a brag card only wears good letters
  // hero block under the medallion
  const you = d.you || {};
  if (you.name) {
    const col = clsColor(you.cls);
    crest(x, you.cls, 110, 452, 40);
    const fs = fit(x, you.name, 700, 30, SERIF, 250);
    text(x, you.name, 160, 480, `700 ${fs}px ${SERIF}`, mixc(col, '#ffffff', 0.35), { stroke: 4 });
    text(x, `${clsName(you.cls)}${you.iLvl ? ` · ${int(you.iLvl)}` : ''}`, 161, 503, `600 15px ${SANS}`, '#c8bda4', { ls: 1, shadow: false });
  }
  const X0 = 470, MW = W - X0 - 64;
  overline(x, d.over || 'Cleared', X0, 92);
  const fs = headline(x, d.title || 'Victory', X0, 160, MW, 66);
  if (d.sub) text(x, d.sub, X0 + 2, 160 + 34, `italic 400 22px ${SERIF}`, '#d8ccb0', { blur: 6 });
  // the time
  const ty = 262 + Math.max(0, 66 - fs) * 0.2;
  const tw = text(x, clock(d.time || 0), X0 - 2, ty + 14, `700 72px ${SANS}`, '#ffffff', { stroke: 6, blur: 18, shadowColor: rgba(a1, 0.7) });
  text(x, 'CLEAR TIME', X0 + tw + 18, ty - 18, `700 14px ${SANS}`, '#c9b98e', { ls: 3, shadow: false });
  const b = d.board;
  if (b?.rank) text(x, `#${int(b.rank)} ${b.label || ''}`.trim(), X0 + tw + 18, ty + 10, `700 22px ${SANS}`, '#ffd680', { stroke: 3 });
  const badges = (d.badges || []).map(s => [s, /first|record|best|beat/i.test(s) ? '#ffcf6a' : /deathless/i.test(s) ? '#86e070' : /trial|premade/i.test(s) ? '#9fb0d0' : a1, /first|record|best/i.test(s)]);
  chips(x, badges, X0, ty + 38, MW);
  if ((d.party || []).length > 1) partyBars(x, d.party, X0, ty + 86, MW, 172);
  else {
    // solo: your numbers instead of a one-row meter
    const m = d.party?.[0] || {}, bx = (MW - 24) / 3, sy = ty + 92;
    statBox(x, 'Your DPS', short(m.dps || 0), X0, sy, bx, '#ffe6a8');
    statBox(x, d.kills ? 'Kills' : 'Damage', d.kills ? int(d.kills) : short(m.dmg || 0), X0 + bx + 12, sy, bx);
    statBox(x, 'Deaths', String(d.deaths ?? 0), X0 + (bx + 12) * 2, sy, bx, d.deaths ? '#ff9a8a' : '#a8f08a');
  }
  footer(x, a1, d.cta || (d.time ? `Beat ${clock(d.time)} — play free in your browser` : null), d.date);
  return c;
}
function honeCard(d) {
  const [c, x] = newCard();
  const a1 = '#ffc05a', a2 = '#ff7a2a';
  backdrop(x, a1, a2, 23 + (d.to | 0), [260, 270]);
  frame(x, a1);
  // the item on its grade frame, big
  glow(x, 260, 270, 300, a1, 0.5);
  x.save(); rr(x, 110, 120, 300, 300, 10); x.fillStyle = 'rgba(0,0,0,.5)'; x.fill(); x.restore();
  drawIcon(x, d.item?.icon || 'item:weapon:reaver:t2', 120, 130, 280, d.item?.grade ?? 5);
  x.save(); x.lineWidth = 3; x.strokeStyle = goldGrad(x, 120, 420); rr(x, 114, 124, 292, 292, 8); x.stroke(); x.restore();
  text(x, `+${d.to}`, 260, 500, `400 96px ${SERIF}`, goldGrad(x, 420, 505), { align: 'center', stroke: 7, blur: 24, shadowColor: 'rgba(255,170,60,.8)' });
  const X0 = 480, MW = W - X0 - 64;
  overline(x, d.guaranteed ? 'Honing · Artisan’s Energy' : 'Honing success', X0, 92);
  headline(x, `+${d.to} Success`, X0, 160, MW, 64);
  if (d.item?.name) text(x, d.item.name, X0 + 2, 196, `italic 400 22px ${SERIF}`, '#e0d2b0', { blur: 6 });
  const taps = d.taps || 1;
  const tw = text(x, String(taps), X0 - 2, 300, `700 84px ${SANS}`, '#ffffff', { stroke: 6, blur: 18, shadowColor: 'rgba(255,170,60,.6)' });
  text(x, taps === 1 ? 'TAP' : 'TAPS', X0 + tw + 14, 262, `700 16px ${SANS}`, '#e8c880', { ls: 3, shadow: false });
  const luckLine = d.guaranteed ? 'Guaranteed by a full Artisan’s Energy bar' : d.luck != null ? `Luckier than ${Math.round(d.luck * 100)}% of Shardbearers` : d.odds != null ? `1-in-${int(Math.max(1, 1 / d.odds))} luck` : '';
  text(x, luckLine, X0 + tw + 14, 294, `700 24px ${SANS}`, '#ffd680', { stroke: 3 });
  // Artisan's Energy bar
  const by = 340, bw = MW;
  text(x, 'ARTISAN’S ENERGY', X0, by, `700 13px ${SANS}`, '#c9b98e', { ls: 2.5, shadow: false });
  text(x, pct(d.energy || 0, 1), X0 + bw, by, `700 15px ${SANS}`, '#f3dca0', { align: 'right', shadow: false });
  x.save(); rr(x, X0, by + 10, bw, 16, 3); x.fillStyle = 'rgba(0,0,0,.6)'; x.fill(); x.strokeStyle = 'rgba(201,164,90,.5)'; x.lineWidth = 1; x.stroke();
  const eg = x.createLinearGradient(X0, 0, X0 + bw, 0); eg.addColorStop(0, '#8a4a12'); eg.addColorStop(1, '#ffd87a');
  rr(x, X0 + 2, by + 12, Math.max(0, (bw - 4) * Math.min(1, d.energy || 0)), 12, 2); x.fillStyle = eg; x.fill(); x.restore();
  const bx = (MW - 24) / 3;
  statBox(x, 'Base chance', pct(d.base ?? d.chance ?? 0, 1), X0, 392, bx);
  statBox(x, 'Final tap', pct(d.chance ?? 0, 1), X0 + bx + 12, 392, bx);
  statBox(x, 'Item level', d.iLvl ? int(d.iLvl) : '—', X0 + (bx + 12) * 2, 392, bx, '#ffe6a8');
  footer(x, a1, d.name ? `${d.name} · ${clsName(d.cls)}` : null, d.date);
  return c;
}
function stoneCard(d) {
  const [c, x] = newCard();
  const is97 = d.score && Math.max(d.score[0], d.score[1]) >= 9 && Math.min(d.score[0], d.score[1]) >= 7;
  const a1 = is97 ? '#6fe0ff' : '#9a7aff', a2 = is97 ? '#ffcf6a' : '#3a8aff';
  backdrop(x, a1, a2, 31 + (d.score?.[0] || 0) * 10 + (d.score?.[1] || 0), [250, 250]);
  frame(x, a1);
  glow(x, 250, 240, 280, a1, 0.45);
  drawIcon(x, 'item:stone', 110, 100, 280, d.grade ?? 5);
  const sc = d.score || [0, 0, 0];
  text(x, `${sc[0]} · ${sc[1]} · ${sc[2]}`, 250, 470, `700 50px ${SANS}`, '#ffffff', { align: 'center', stroke: 6, blur: 16, shadowColor: rgba(a1, 0.8) });
  text(x, 'POSITIVE · POSITIVE · NEGATIVE', 250, 500, `700 11px ${SANS}`, '#b8b0d8', { align: 'center', ls: 2.2, shadow: false });
  const X0 = 470, MW = W - X0 - 64;
  overline(x, 'Ability stone faceted', X0, 92, is97 ? '#ffd680' : '#d9b56a');
  headline(x, `${d.label || stoneLbl(sc)} Stone`, X0, 162, MW, 76);
  if (d.stoneName) text(x, d.stoneName, X0 + 2, 198, `italic 400 22px ${SERIF}`, '#d8ccf0', { blur: 6 });
  (d.lines || []).slice(0, 3).forEach((l, i) => {
    const y = 244 + i * 92, neg = l.negative || i === 2, col = neg ? '#ff6a58' : '#6ab8ff';
    x.save(); rr(x, X0, y, MW, 76, 6); x.fillStyle = 'rgba(4,6,14,.55)'; x.fill(); x.strokeStyle = rgba(col, 0.35); x.lineWidth = 1; x.stroke(); x.restore();
    drawIcon(x, 'engr:' + (l.id || 'keen_edge'), X0 + 12, y + 12, 52);
    const nfs = fit(x, l.name || '', 700, 21, SANS, 220);
    text(x, l.name || '', X0 + 76, y + 34, `700 ${nfs}px ${SANS}`, neg ? '#ffb0a4' : '#e8f0ff', { blur: 4 });
    text(x, neg ? 'negative' : 'engraving', X0 + 76, y + 56, `600 13px ${SANS}`, '#8f98b2', { ls: 1.5, shadow: false });
    const slots = l.slots || [], n = slots.length || 10, dx = Math.min(30, (MW - 380) / n), sx = X0 + 318;
    slots.forEach((v, k) => {
      const cx = sx + k * dx, cy = y + 38;
      x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4);
      if (v === 1) { const g = x.createLinearGradient(-9, -9, 9, 9); g.addColorStop(0, mixc(col, '#ffffff', 0.55)); g.addColorStop(1, col); x.fillStyle = g; x.shadowColor = col; x.shadowBlur = 10; x.fillRect(-8, -8, 16, 16); }
      else if (v === -1) { x.fillStyle = '#23262f'; x.fillRect(-8, -8, 16, 16); x.strokeStyle = '#4a4f5e'; x.lineWidth = 1.5; x.strokeRect(-8, -8, 16, 16); }
      else { x.strokeStyle = 'rgba(160,170,200,.5)'; x.lineWidth = 1.5; x.strokeRect(-8, -8, 16, 16); }
      x.restore();
    });
    text(x, String(l.nodes ?? slots.filter(v => v === 1).length), X0 + MW - 16, y + 50, `700 38px ${SANS}`, neg ? '#ff8a78' : '#ffffff', { align: 'right', stroke: 4 });
  });
  footer(x, a1, d.name ? `${d.name} · ${clsName(d.cls)}` : null, d.date);
  return c;
}
const stoneLbl = sc => { const [a, b] = [sc[0], sc[1]].sort((p, q) => q - p); return a >= 10 || b >= 10 ? `${a}/${b}` : `${a}${b}`; };
function profileCard(d) {
  const [c, x] = newCard();
  const col = clsColor(d.cls), a2 = clsInfo(d.cls).color2 || '#ffd98a';
  backdrop(x, col, a2, 41 + (d.level || 1), [270, 300]);
  frame(x, col);
  // stage: floor glow + portrait (or the class crest when WebGL isn't available)
  const fx = 270, fy = 540;
  x.save(); const fg = x.createRadialGradient(fx, fy, 0, fx, fy, 220); fg.addColorStop(0, rgba(col, 0.55)); fg.addColorStop(1, rgba(col, 0)); x.fillStyle = fg; x.scale(1, 0.22); x.beginPath(); x.arc(fx, fy / 0.22, 220, 0, 6.283); x.fill(); x.restore();
  glow(x, fx, 300, 300, col, 0.28);
  if (d.portrait) {
    const ph = 570, pw = ph * d.portrait.width / d.portrait.height;   // the portrait frames the figure in its middle 90%: feet at 95%
    x.drawImage(d.portrait, fx - pw / 2, fy + 8 - ph * 0.95, pw, ph);
  } else { drawIcon(x, 'class:' + d.cls, fx - 150, 140, 300); }
  const X0 = 520, MW = W - X0 - 64;
  overline(x, `${clsName(d.cls)} · Level ${d.level || 1}${d.roster ? ` · Roster ${d.roster}` : ''}`, X0, 90);
  const fs = fit(x, d.name || 'Shardbearer', 400, 72, SERIF, MW, 5);
  text(x, d.name || 'Shardbearer', X0, 168, `400 ${fs}px ${SERIF}`, goldGrad(x, 168 - fs * 0.8, 170), { ls: 5, stroke: 6, blur: 16 });
  const line2 = [d.title, d.guild ? `<${d.guild}>` : null].filter(Boolean).join('   ');
  if (line2) text(x, line2, X0 + 2, 204, `italic 400 22px ${SERIF}`, '#e0d2b0', { blur: 6 });
  // item level
  text(x, 'ITEM LEVEL', X0, 256, `700 14px ${SANS}`, '#c9b98e', { ls: 3, shadow: false });
  const iw = text(x, (d.iLvl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), X0 - 2, 318, `700 64px ${SANS}`, '#ffffff', { stroke: 6, blur: 16, shadowColor: rgba(col, 0.7) });
  if (d.weapon) text(x, `${d.weapon.name}${d.weapon.hone ? ` +${d.weapon.hone}` : ''}`, X0 + iw + 22, 314, `700 20px ${SANS}`, '#ffd680', { stroke: 3 });
  // engravings grid (up to 6)
  const eg = (d.engravings || []).slice(0, 6);
  if (eg.length) {
    text(x, 'ENGRAVINGS', X0, 362, `700 14px ${SANS}`, '#c9b98e', { ls: 3, shadow: false });
    const cw = (MW - 20) / 3;
    eg.forEach((e, i) => {
      const ex = X0 + (i % 3) * (cw + 10), ey = 376 + Math.floor(i / 3) * 58;
      x.save(); rr(x, ex, ey, cw, 50, 5); x.fillStyle = 'rgba(4,6,12,.5)'; x.fill(); x.strokeStyle = e.neg ? 'rgba(255,90,70,.4)' : 'rgba(201,164,90,.3)'; x.lineWidth = 1; x.stroke(); x.restore();
      drawIcon(x, 'engr:' + e.id, ex + 6, ey + 5, 40);
      const nfs = fit(x, e.name, 700, 16, SANS, cw - 64);
      text(x, e.name, ex + 52, ey + 22, `700 ${nfs}px ${SANS}`, e.neg ? '#ffb0a4' : '#f2f4fa', { blur: 3 });
      for (let k = 0; k < 3; k++) { x.save(); x.translate(ex + 58 + k * 16, ey + 37); x.rotate(Math.PI / 4); x.fillStyle = k < (e.level || 0) ? (e.neg ? '#ff6a58' : '#f3dca0') : 'rgba(255,255,255,.15)'; x.fillRect(-4.5, -4.5, 9, 9); x.restore(); }
    });
  }
  const recs = (d.records || []).slice(0, 2);
  if (recs.length) {
    const ry = eg.length > 3 ? 512 : eg.length ? 454 : 380;
    x.save(); x.font = `600 15px ${SANS}`;
    let rx = X0;
    for (const r of recs) { const s = `✦ ${r}`, w = x.measureText(s).width; if (rx + w > X0 + MW) break; text(x, s, rx, ry, `600 15px ${SANS}`, '#e8dcc0', { blur: 4 }); rx += w + 26; }
    x.restore();
  }
  footer(x, col, 'Join me in Solmara — play free in your browser', d.date);
  return c;
}
function infernoCard(d) {
  const [c, x] = newCard();
  const a1 = '#ff6a2a', a2 = '#ffb03a';
  backdrop(x, a1, a2, 53 + (d.floor | 0), [250, 270]);
  frame(x, a1);
  // the depth medallion: a burning ring with the floor number
  const cx = 250, cy = 262, r = 150;
  glow(x, cx, cy, r * 2, '#ff5a1a', 0.55);
  x.save();
  const R = prng(97 + (d.floor | 0));
  for (let i = 0; i < 70; i++) { const a = R() * 6.283, rr2 = r * (0.95 + R() * 0.25), len = 20 + R() * 60; const g = x.createLinearGradient(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2, cx + Math.cos(a) * (rr2 + len), cy + Math.sin(a) * (rr2 + len) - len * 0.6); g.addColorStop(0, 'rgba(255,190,90,.7)'); g.addColorStop(1, 'rgba(255,60,10,0)'); x.strokeStyle = g; x.lineWidth = 4 + R() * 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); x.quadraticCurveTo(cx + Math.cos(a) * (rr2 + len * 0.6), cy + Math.sin(a) * (rr2 + len * 0.6) - len * 0.2, cx + Math.cos(a) * (rr2 + len), cy + Math.sin(a) * (rr2 + len) - len * 0.6); x.stroke(); }
  const dg = x.createRadialGradient(cx, cy - 30, 10, cx, cy, r); dg.addColorStop(0, '#3a1206'); dg.addColorStop(1, '#0c0402');
  x.fillStyle = dg; x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fill();
  x.lineWidth = 5; x.strokeStyle = goldGrad(x, cy - r, cy + r); x.stroke();
  x.restore();
  text(x, 'FLOOR', cx, cy - 58, `700 16px ${SANS}`, '#ffcf8a', { align: 'center', ls: 5, shadow: false });
  text(x, String(d.floor || 0), cx, cy + 50, `400 ${d.floor >= 100 ? 118 : 136}px ${SERIF}`, goldGrad(x, cy - 60, cy + 52), { align: 'center', stroke: 7, blur: 26, shadowColor: 'rgba(255,120,30,.9)' });
  text(x, 'OF 100', cx, cy + 96, `700 14px ${SANS}`, '#e8a870', { align: 'center', ls: 4, shadow: false });
  const X0 = 470, MW = W - X0 - 64;
  overline(x, 'Inferno Descent', X0, 92, '#ffb070');
  headline(x, d.conquered ? 'The Inferno Conquered' : `Floor ${d.floor} Reached`, X0, 160, MW, 60);
  if (d.sub) text(x, d.sub, X0 + 2, 196, `italic 400 22px ${SERIF}`, '#e8c8a8', { blur: 6 });
  const bx = (MW - 24) / 3;
  statBox(x, 'Run time', clock(d.time || 0).replace(/\.\d$/, ''), X0, 236, bx);
  statBox(x, 'Kills', int(d.kills || 0), X0 + bx + 12, 236, bx);
  statBox(x, d.board?.rank ? 'This week' : 'Best ever', d.board?.rank ? `#${int(d.board.rank)}` : d.best ? `Floor ${d.best}` : '—', X0 + (bx + 12) * 2, 236, bx, '#ffd680');
  if (d.boons?.length) {
    text(x, 'BOONS', X0, 360, `700 14px ${SANS}`, '#c9b98e', { ls: 3, shadow: false });
    chips(x, d.boons.slice(0, 10).map(b => [b, '#ffb070']), X0, 374, MW);
    if (d.boons.length > 4) chips(x, d.boons.slice(4, 10).map(b => [b, '#ffb070']), X0, 414, MW);
  }
  if (d.name) { crest(x, d.cls, X0, 470, 36); text(x, d.name, X0 + 46, 497, `700 26px ${SERIF}`, mixc(clsColor(d.cls), '#ffffff', 0.4), { stroke: 4 }); }
  footer(x, a1, d.floor ? `How deep can you go? Play free in your browser` : null, d.date);
  return c;
}

const RENDER = { clear: clearCard, hone: honeCard, stone: stoneCard, profile: profileCard, inferno: infernoCard };
/** Paint a share card. Always resolves to a canvas (an error card if something went wrong). */
export async function renderCard(kind, data = {}) {
  const fn = RENDER[kind] || clearCard;
  try { return fn(data); }
  catch (e) {
    console.warn('[meta card]', kind, e);
    const [c, x] = newCard(); backdrop(x, '#c9a45a', '#3a6cff', 1); frame(x, '#c9a45a');
    text(x, 'SEVENSHARD', W / 2, H / 2, `400 64px ${SERIF}`, goldGrad(x, H / 2 - 50, H / 2 + 4), { align: 'center', ls: 10 });
    return c;
  }
}
