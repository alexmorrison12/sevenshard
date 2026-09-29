// Icon provider for the UI. The real procedural icons live in src/ui/icons/ (another owner). Until that module
// exists, `placeholderIcon` below draws simple, tasteful stand-ins with the same signature:
//     icon(id, size) → dataURL (cached)
// ids: 'skill:<class>:<key>' 'item:<kind|id>' 'currency:<id>' 'engr:<id>' 'status:<id>' 'class:<id>' 'ui:<id>'
//
// ─── ONE-LINE SWAP ─── the real provider (src/ui/icons/). To fall back to placeholders: `const provider = null;`
import { icon as provider } from '../icons/index.js';
import { hashStr, rng, shade, mix } from './util.js';
import { CLASSES } from './data.js';

let _scale = 1;
/** Called by the UI on resize so icon requests match the real pixel density. */
export function setIconScale(s) { _scale = s * (globalThis.devicePixelRatio || 1); }
const BUCKETS = [32, 48, 64, 96, 128, 192, 256];
const bucket = px => { for (const b of BUCKETS) if (b >= px) return b; return 256; };

/**
 * Icon URL for an element displayed at cssPx virtual pixels (the pixel size is bucketed and scaled by UI scale × DPR).
 * opts go to the provider: a grade 0–7 or { grade, bare } (items only). Falls back to the placeholder on any error.
 */
const memo = new Map();
export function iconUrl(id, cssPx = 48, opts) {
  if (!id) return '';
  if (typeof id === 'string' && (id.startsWith('data:') || id.startsWith('blob:') || id.startsWith('http'))) return id;
  const size = bucket(cssPx * _scale);
  const key = id + '|' + size + '|' + (opts == null ? '' : typeof opts === 'object' ? (opts.bare ? 'b' : '') + (opts.grade ?? '') : opts);
  let url = memo.get(key);
  if (url) return url;
  try { url = (provider && provider(id, size, opts)) || placeholderIcon(id, size); } catch { url = placeholderIcon(id, size); }
  if (url) memo.set(key, url);
  return url;
}
/** Item art for use inside a .ss-slot grade frame: transparent background (the slot paints the grade). */
export function itemIcon(id, cssPx = 48) { return iconUrl(id, cssPx, { bare: true }); }

// ================================================================================================ placeholder art
const cache = new Map();
const CLASS_HUE = Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [k, v.color]));
const KIND_COL = {
  weapon: '#c9a45a', armor: '#8ea3c4', accessory: '#d9b86a', stone: '#6fc4d9', bracelet: '#c48ad9', gem: '#e0506a',
  card: '#d9a45a', material: '#8a9ab0', consumable: '#e05050', battle: '#e0903a', book: '#7a9ae0', mount: '#b08a5a',
  pet: '#e0a0c0', cosmetic: '#e070c0', currency: '#e0c060', gift: '#e070a0', food: '#e0a050', quest: '#d0c080',
  collectible: '#7ad08a',
};

export function placeholderIcon(id, size = 64) {
  const key = id + '@' + size;
  let url = cache.get(key);
  if (url) return url;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const x = cv.getContext('2d');
  x.scale(size / 64, size / 64);
  const [cat, a = '', b = ''] = String(id).split(':');
  const r = rng(hashStr(id));
  try {
    if (cat === 'skill') drawSkill(x, a, b, r);
    else if (cat === 'item') drawItem(x, a, b, r);
    else if (cat === 'currency') drawCurrency(x, a);
    else if (cat === 'engr') drawEngr(x, a, r);
    else if (cat === 'status') drawStatus(x, a, r);
    else if (cat === 'class') drawClass(x, a);
    else drawGeneric(x, id, r);
  } catch { drawGeneric(x, id, r); }
  url = cv.toDataURL();
  cache.set(key, url);
  return url;
}

function bg(x, c1, c2, rad = true) {
  const g = rad ? x.createRadialGradient(22, 18, 4, 32, 32, 46) : x.createLinearGradient(0, 0, 64, 64);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
}
function vignette(x) {
  const g = x.createRadialGradient(32, 32, 20, 32, 32, 46);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
}
function glow(x, col, blur = 10) { x.shadowColor = col; x.shadowBlur = blur; }
function noGlow(x) { x.shadowBlur = 0; }
function path(x, pts, close = true) {
  x.beginPath(); x.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
  if (close) x.closePath();
}

function drawSkill(x, clsId, key, r) {
  const base = CLASS_HUE[clsId] || '#7a8ab0';
  bg(x, shade(base, 0.15), shade(base, -0.82));
  const hi = mix(base, '#ffffff', 0.55);
  const kind = Math.floor(r() * 7);
  x.lineCap = 'round'; x.lineJoin = 'round';
  glow(x, base, 12);
  x.strokeStyle = hi; x.fillStyle = hi;
  if (kind === 0) { // crescent slashes
    for (let i = 0; i < 3; i++) { x.lineWidth = 5 - i * 1.4; x.beginPath(); x.arc(30 + i * 3, 36 - i * 2, 20 - i * 4, -2.6 + r() * 0.3, 0.1); x.stroke(); }
  } else if (kind === 1) { // starburst
    x.beginPath();
    for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2, rr = i % 2 ? 9 : 24 + r() * 4; x.lineTo(32 + Math.cos(ang) * rr, 32 + Math.sin(ang) * rr); }
    x.closePath(); x.fill();
  } else if (kind === 2) { // lightning
    x.lineWidth = 4; path(x, [38, 8, 24, 34, 34, 34, 22, 58], false); x.stroke();
  } else if (kind === 3) { // rings / nova
    for (let i = 0; i < 3; i++) { x.lineWidth = 3; x.globalAlpha = 1 - i * 0.28; x.beginPath(); x.arc(32, 32, 8 + i * 8, 0, Math.PI * 2); x.stroke(); }
    x.globalAlpha = 1;
  } else if (kind === 4) { // crossed blades
    x.lineWidth = 5; path(x, [14, 50, 50, 14], false); x.stroke(); path(x, [14, 14, 50, 50], false); x.stroke();
  } else if (kind === 5) { // flame / arrow up
    path(x, [32, 8, 46, 34, 38, 34, 42, 56, 22, 56, 26, 34, 18, 34]); x.fill();
  } else { // spiral
    x.lineWidth = 3.5; x.beginPath();
    for (let t = 0; t < 14; t += 0.2) { const rr = t * 1.8; x.lineTo(32 + Math.cos(t) * rr, 32 + Math.sin(t) * rr); }
    x.stroke();
  }
  noGlow(x); vignette(x);
}

function drawItem(x, kind, sub, r) {
  const k = KIND_COL[kind] ? kind : (sub && KIND_COL[sub] ? sub : kind);
  const col = KIND_COL[k] || '#9aa8c0';
  bg(x, shade(col, -0.45), shade(col, -0.9));
  x.lineCap = 'round'; x.lineJoin = 'round';
  const hi = mix(col, '#ffffff', 0.35);
  const metal = x.createLinearGradient(10, 10, 54, 54);
  metal.addColorStop(0, '#ffffff'); metal.addColorStop(0.4, hi); metal.addColorStop(1, shade(col, -0.4));
  x.fillStyle = metal; x.strokeStyle = hi;
  glow(x, 'rgba(0,0,0,.8)', 6);
  switch (k) {
    case 'weapon': path(x, [46, 10, 54, 10, 54, 18, 26, 46, 18, 38]); x.fill(); x.fillStyle = shade(col, -0.2); path(x, [14, 36, 28, 50, 24, 54, 10, 40]); x.fill(); path(x, [18, 46, 12, 52, 14, 54, 20, 48]); x.fill(); break;
    case 'armor': path(x, [18, 16, 26, 12, 32, 16, 38, 12, 46, 16, 48, 34, 40, 52, 24, 52, 16, 34]); x.fill(); break;
    case 'accessory': x.lineWidth = 5; x.beginPath(); x.arc(32, 26, 13, 0.2, Math.PI - 0.2, true); x.stroke(); x.beginPath(); x.moveTo(32, 38); x.lineTo(38, 46); x.lineTo(32, 56); x.lineTo(26, 46); x.closePath(); x.fill(); break;
    case 'stone': path(x, [32, 8, 50, 20, 50, 44, 32, 56, 14, 44, 14, 20]); x.fill(); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.5; path(x, [32, 8, 32, 56], false); x.stroke(); path(x, [14, 20, 50, 44], false); x.stroke(); break;
    case 'bracelet': x.lineWidth = 7; x.beginPath(); x.ellipse(32, 34, 18, 12, 0, 0, Math.PI * 2); x.stroke(); break;
    case 'gem': path(x, [20, 22, 32, 12, 44, 22, 32, 54]); x.fill(); break;
    case 'card': x.fillRect(18, 10, 28, 44); x.fillStyle = shade(col, -0.6); x.fillRect(22, 14, 20, 26); break;
    case 'consumable': case 'food': x.beginPath(); x.arc(32, 40, 14, 0, Math.PI * 2); x.fill(); x.fillRect(27, 12, 10, 16); break;
    case 'battle': x.beginPath(); x.arc(30, 38, 15, 0, Math.PI * 2); x.fill(); x.lineWidth = 3; path(x, [38, 24, 46, 14, 52, 16], false); x.stroke(); break;
    case 'book': path(x, [14, 14, 32, 18, 50, 14, 50, 50, 32, 54, 14, 50]); x.fill(); x.strokeStyle = shade(col, -0.6); x.lineWidth = 2; path(x, [32, 18, 32, 54], false); x.stroke(); break;
    case 'currency': drawCurrency(x, sub || 'gold'); return;
    case 'material': default: {
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) { const cx = 20 + r() * 24, cy = 24 + r() * 22, s = 8 + r() * 8; path(x, [cx, cy - s, cx + s * 0.9, cy - s * 0.2, cx + s * 0.6, cy + s * 0.8, cx - s * 0.6, cy + s * 0.8, cx - s * 0.9, cy - s * 0.2]); x.fill(); }
    }
  }
  noGlow(x); vignette(x);
}

function drawCurrency(x, id) {
  x.clearRect(0, 0, 64, 64);
  if (id === 'crystals' || id === 'crystal') {
    const g = x.createLinearGradient(16, 8, 48, 56); g.addColorStop(0, '#e6f6ff'); g.addColorStop(0.5, '#6cc4ff'); g.addColorStop(1, '#1d4fb0');
    x.fillStyle = g; glow(x, 'rgba(90,180,255,.8)', 8); path(x, [32, 6, 50, 26, 32, 58, 14, 26]); x.fill(); noGlow(x);
    x.fillStyle = 'rgba(255,255,255,.55)'; path(x, [32, 6, 40, 26, 32, 30, 24, 26]); x.fill();
    return;
  }
  const c = id === 'silver' ? ['#ffffff', '#c8d0dc', '#6a7486'] : id === 'gold' ? ['#fff6c8', '#f2c24a', '#8a5a14'] : ['#ffe0c0', '#d08a4a', '#6a3a14'];
  const g = x.createRadialGradient(26, 22, 2, 32, 32, 26); g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]);
  x.fillStyle = g; glow(x, 'rgba(0,0,0,.6)', 4); x.beginPath(); x.arc(32, 32, 24, 0, Math.PI * 2); x.fill(); noGlow(x);
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; x.beginPath(); x.arc(32, 32, 17, 0, Math.PI * 2); x.stroke();
  x.fillStyle = c[2]; path(x, [32, 21, 38, 32, 32, 43, 26, 32]); x.fill();
}

function drawEngr(x, id, r) {
  const hue = Math.floor(r() * 360);
  bg(x, `hsl(${hue},45%,38%)`, `hsl(${hue},55%,8%)`);
  x.strokeStyle = 'rgba(255,230,170,.9)'; x.lineWidth = 2;
  x.beginPath(); x.arc(32, 32, 22, 0, Math.PI * 2); x.stroke();
  glow(x, 'rgba(255,210,120,.8)', 8);
  x.fillStyle = '#ffe9b0';
  const n = 3 + Math.floor(r() * 4);
  x.beginPath();
  for (let i = 0; i < n * 2; i++) { const ang = -Math.PI / 2 + i / (n * 2) * Math.PI * 2, rr = i % 2 ? 7 : 16; x.lineTo(32 + Math.cos(ang) * rr, 32 + Math.sin(ang) * rr); }
  x.closePath(); x.fill(); noGlow(x); vignette(x);
}

function drawStatus(x, id, r) {
  const neg = /bleed|burn|poison|shock|freeze|slow|stun|fear|silence|curse|debuff|brand|weak|vuln|down|break|sleep/.test(id);
  const hue = neg ? 0 + Math.floor(r() * 30) : 90 + Math.floor(r() * 140);
  bg(x, `hsl(${hue},60%,42%)`, `hsl(${hue},60%,10%)`);
  x.fillStyle = '#fff'; glow(x, `hsl(${hue},90%,60%)`, 8);
  if (neg) { path(x, [32, 50, 16, 26, 26, 26, 26, 12, 38, 12, 38, 26, 48, 26]); }
  else { path(x, [32, 12, 48, 36, 38, 36, 38, 52, 26, 52, 26, 36, 16, 36]); }
  x.fill(); noGlow(x); vignette(x);
}

function drawClass(x, id) {
  x.clearRect(0, 0, 64, 64);
  const c = CLASSES[id]?.color || '#c9a45a';
  const g = x.createLinearGradient(0, 4, 0, 60); g.addColorStop(0, mix(c, '#ffffff', 0.55)); g.addColorStop(1, shade(c, -0.35));
  x.fillStyle = g; x.strokeStyle = g; x.lineCap = 'round'; x.lineJoin = 'round';
  glow(x, c, 6);
  const P = {
    reaver: () => { path(x, [30, 4, 34, 4, 36, 44, 32, 50, 28, 44]); x.fill(); x.fillRect(20, 44, 24, 5); x.fillRect(29.5, 49, 5, 11); },
    oathkeeper: () => { path(x, [32, 6, 52, 14, 50, 38, 32, 58, 14, 38, 12, 14]); x.fill(); x.fillStyle = shade(c, -0.6); x.fillRect(29, 16, 6, 30); x.fillRect(21, 24, 22, 6); },
    stormfist: () => { path(x, [36, 4, 18, 36, 30, 36, 24, 60, 46, 26, 34, 26, 42, 4]); x.fill(); },
    pistoleer: () => { path(x, [8, 22, 50, 22, 56, 18, 58, 28, 30, 30, 26, 46, 16, 46, 18, 30, 8, 30]); x.fill(); },
    starcaller: () => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 10 : 26; x.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); } x.closePath(); x.fill(); },
    songweaver: () => { x.lineWidth = 4; x.beginPath(); x.moveTo(18, 56); x.quadraticCurveTo(10, 20, 30, 8); x.quadraticCurveTo(52, 16, 46, 56); x.stroke(); for (let i = 0; i < 4; i++) { x.lineWidth = 1.5; x.beginPath(); x.moveTo(24 + i * 5, 18 + i); x.lineTo(24 + i * 5, 54); x.stroke(); } },
    bladedancer: () => { x.lineWidth = 5; x.beginPath(); x.arc(22, 34, 20, -1.2, 0.9); x.stroke(); x.beginPath(); x.arc(42, 30, 20, 2.2, 4.3); x.stroke(); },
    demonbound: () => { path(x, [14, 58, 8, 10, 24, 32, 32, 20, 40, 32, 56, 10, 50, 58, 32, 46]); x.fill(); },
  }[id];
  if (P) P(); else { x.beginPath(); x.arc(32, 32, 20, 0, Math.PI * 2); x.fill(); }
  noGlow(x);
}

function drawGeneric(x, id, r) {
  const hue = Math.floor(r() * 360);
  bg(x, `hsl(${hue},40%,36%)`, `hsl(${hue},50%,9%)`);
  x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(32, 32, 10, 0, Math.PI * 2); x.fill(); vignette(x);
}
