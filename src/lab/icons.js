// Icons lab: gallery of every icon id. Pure DOM (no 3D scene needed).
//   ?prefix=skill:reaver        filter by id prefix (comma-separated list allowed)
//   ?ids=a,b,c                  explicit ids
//   ?size=64                    grid size            ?zoom=16   how many ids get the 128/32 zoom treatment (0 = none)
//   ?grade=4 / ?bare=1          item options          ?bg=light  light page (tests transparent icons)
//   ?hud=1                      show a mock skill bar / slot row at game sizes
import { icon, ICON_IDS, hasIcon, gradeFrame } from '../ui/icons/index.js';
import * as ICONS from '../ui/icons/index.js';

const q = Object.fromEntries(new URLSearchParams(location.search));
const prefixes = (q.prefix || '').split(',').filter(Boolean);
let ids = q.ids ? q.ids.split(',') : ICON_IDS.filter(id => !prefixes.length || prefixes.some(p => id.startsWith(p)));
const size = +(q.size || 64), zoomN = q.zoom != null ? +q.zoom : 16;
const opts = q.grade != null || q.bare ? { grade: q.grade != null ? +q.grade : undefined, bare: !!q.bare } : undefined;
const light = q.bg === 'light';

document.body.style.cssText = `margin:0;overflow:auto;height:auto;background:${light ? '#c9ccd4' : '#0b0f1a'};color:${light ? '#222' : '#cfd6ea'};font:11px system-ui,sans-serif`;
document.documentElement.style.cssText = 'overflow:auto;height:auto';
const root = document.createElement('div'); root.style.cssText = 'padding:10px 14px'; document.body.appendChild(root);
const h = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };

const head = h('div', 'display:flex;gap:16px;align-items:baseline;margin-bottom:8px');
head.appendChild(h('b', 'font-size:15px;color:#ffd98a', 'SEVENSHARD icons'));
const info = h('span', 'color:#8fa0c8;font:11px monospace'); head.appendChild(info);
root.appendChild(head);

// paint + time the grid size first (the timing that matters: 64 px incl. PNG encode)
const times = [];
const t0 = performance.now();
const urls = ids.map(id => { const a = performance.now(); const u = icon(id, size, opts); times.push([performance.now() - a, id]); return u; });
const total = performance.now() - t0;
const sorted = times.map(t => t[0]).sort((a, b) => a - b);
const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
const slow = times.slice().sort((a, b) => b[0] - a[0]).slice(0, 4).map(([t, id]) => `${id} ${t.toFixed(1)}`).join(', ');
const missing = ids.filter(id => !hasIcon(id)).length;
info.textContent = `${ids.length} ids · ${size}px paint total ${total.toFixed(0)} ms · median ${pct(0.5).toFixed(2)} · p95 ${pct(0.95).toFixed(2)} · max ${pct(1).toFixed(2)} ms · slowest: ${slow}${missing ? ` · ${missing} unknown→fallback` : ''}`;

// zoom: 128 + 32 side by side
if (zoomN > 0) {
  const z = h('div', 'display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px');
  for (const id of ids.slice(0, zoomN)) {
    const cell = h('div', 'display:flex;flex-direction:column;align-items:center;gap:3px;width:136px');
    const row = h('div', 'display:flex;align-items:flex-end;gap:4px');
    for (const s of [128, 32]) { const im = new Image(); im.src = icon(id, s, opts); im.width = im.height = s; im.style.cssText = slotCss(id); row.appendChild(im); }
    cell.appendChild(row);
    cell.appendChild(h('div', 'color:#9aa6c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:136px', id.split(':').slice(1).join(':')));
    z.appendChild(cell);
  }
  root.appendChild(z);
}
// ?px=32&mag=3 : true 32-px renders magnified with nearest-neighbour (judge small-size readability)
if (q.px) {
  const px = +q.px, mag = +(q.mag || 3);
  const wrap = h('div', `display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;padding:6px;background:${light ? '#aab' : '#070a12'}`);
  for (const id of ids) {
    const cell = h('div', `display:flex;flex-direction:column;align-items:center;width:${px * mag}px`);
    const im = new Image(); im.src = icon(id, px, opts); im.style.cssText = `width:${px * mag}px;height:${px * mag}px;image-rendering:pixelated;` + slotCss(id);
    cell.appendChild(im); cell.appendChild(h('div', 'color:#9aa6c4;font-size:9px;white-space:nowrap;overflow:hidden;max-width:100%', id.split(':').pop()));
    wrap.appendChild(cell);
  }
  root.appendChild(wrap);
}
// 32-px strip of everything (distinguishability check)
const strip = h('div', `display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px;padding:6px;background:${light ? '#aab' : '#070a12'};border:1px solid #2c3550`);
for (const id of ids) { const im = new Image(); im.src = icon(id, 32, opts); im.width = im.height = 32; im.title = id; im.style.cssText = slotCss(id); strip.appendChild(im); }
root.appendChild(strip);

if (q.hud) {
  const bar = h('div', 'display:flex;gap:4px;margin-bottom:12px;padding:6px;background:rgba(11,15,26,.88);border:1px solid #3a4560;width:max-content');
  for (const id of ids.slice(0, 12)) { const im = new Image(); im.src = icon(id, 48, opts); im.width = im.height = 48; bar.appendChild(im); }
  root.appendChild(bar);
}

// labelled grid
const grid = h('div', `display:grid;grid-template-columns:repeat(auto-fill,minmax(${Math.max(size + 18, 96)}px,1fr));gap:8px 6px`);
ids.forEach((id, i) => {
  const cell = h('div', 'display:flex;flex-direction:column;align-items:center;gap:2px');
  const im = new Image(); im.src = urls[i]; im.width = im.height = size; im.style.cssText = slotCss(id);
  cell.appendChild(im);
  cell.appendChild(h('div', `color:${hasIcon(id) ? '#9aa6c4' : '#ff8080'};font-size:10px;text-align:center;word-break:break-all;max-width:${Math.max(size + 18, 96)}px`, id.split(':').slice(1).join(':') || id));
  grid.appendChild(cell);
});
root.appendChild(grid);

function slotCss(id) {
  // bare items are shown on the grade slot background they are meant for
  if (opts && opts.bare && id.startsWith('item:')) return `background:${gradeFrame(opts.grade ?? 4)};border:1px solid #3a4560`;
  return '';
}
window.__icons = ICONS;
window.__lab = { ready: true, total, median: pct(0.5), p95: pct(0.95), max: pct(1) };
