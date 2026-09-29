// Shared UI helpers: DOM creation, diffed setters (touch the DOM only when a value really changes),
// number/time formatting, colour maths. Every HUD component is built on these so a 15 Hz HudState push costs
// a few property compares per field and zero layout work when nothing moved.

// ------------------------------------------------------------------------------------------------ DOM
/** h('div', 'ss-a ss-b', parent?, text?) → element */
export function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
/** Parse a static HTML template into one element. Never pass untrusted strings (use esc()). */
export function tpl(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
/** Collect [data-r] children into an object: refs(root) → { name: el } */
export function refs(root) {
  const o = {};
  root.querySelectorAll('[data-r]').forEach(e => { o[e.dataset.r] = e; });
  return o;
}
export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }
/** Button with aria-label; fn(e) on click. */
export function btn(cls, parent, label, fn, aria) {
  const b = h('button', cls, parent);
  b.type = 'button';
  if (label != null) b.textContent = label;
  if (aria) b.setAttribute('aria-label', aria);
  if (fn) b.addEventListener('click', fn);
  return b;
}

// Diffed setters: the last value is cached on the element (expando), so an unchanged value costs one compare.
export function setText(el, v) {
  v = v == null ? '' : '' + v;
  if (el._t !== v) { el._t = v; el.textContent = v; }
}
export function setHTML(el, v) { if (el._h !== v) { el._h = v; el.innerHTML = v; } }
export function setCls(el, cls, on) {
  on = !!on;
  const k = '_c_' + cls;
  if (el[k] !== on) { el[k] = on; el.classList.toggle(cls, on); }
}
/** One class out of a family: setVariant(el, 'ss-g', 3) → 'ss-g3' (removes the previous one). */
export function setVariant(el, prefix, v) {
  if (el._v === v) return;
  if (el._v != null && el._v !== '') el.classList.remove(prefix + el._v);
  el._v = v;
  if (v != null && v !== '') el.classList.add(prefix + v);
}
export function show(el, on) {
  on = !!on;
  if (el._s !== on) { el._s = on; el.style.display = on ? '' : 'none'; }
}
export function setStyle(el, prop, v) {
  const k = '_st_' + prop;
  if (el[k] !== v) { el[k] = v; el.style.setProperty(prop, v); }
}
/** Horizontal fill through a compositor-only transform. Quantised to 1/2000 so tiny jitters are ignored. */
export function setFill(el, frac) {
  frac = frac > 1 ? 1 : frac > 0 ? Math.round(frac * 2000) / 2000 : 0;
  if (el._f !== frac) { el._f = frac; el.style.transform = `scaleX(${frac})`; }
}
/** Vertical fill (bottom-up). */
export function setFillY(el, frac) {
  frac = frac > 1 ? 1 : frac > 0 ? Math.round(frac * 2000) / 2000 : 0;
  if (el._f !== frac) { el._f = frac; el.style.transform = `scaleY(${frac})`; }
}
/** <img> src or background-image, whichever the element is. */
export function setSrc(el, url) {
  if (el._src === url) return;
  el._src = url;
  if (el.tagName === 'IMG') el.src = url || '';
  else el.style.backgroundImage = url ? `url("${url}")` : 'none';
}
export function setAttr(el, name, v) {
  const k = '_a_' + name;
  if (el[k] !== v) { el[k] = v; if (v == null || v === false) el.removeAttribute(name); else el.setAttribute(name, v === true ? '' : v); }
}
/** Restart a one-shot CSS animation class on one element. */
export function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // intentional reflow of this element only: restarts the keyframes
  el.classList.add(cls);
}
/** Keep a pool of child nodes in sync with a list: make(i) creates node i, the caller fills it. Returns the pool. */
export function pool(parent, arr, n, make) {
  while (arr.length < n) { const e = make(arr.length); arr.push(e); parent.appendChild(e.el || e); }
  for (let i = 0; i < arr.length; i++) show(arr[i].el || arr[i], i < n);
  return arr;
}

// ------------------------------------------------------------------------------------------------ numbers & time
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
const NF = new Intl.NumberFormat('en-US');
const NF2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 1234567 → "1,234,567" */
export function fmtInt(n) { return NF.format(Math.round(n || 0)); }
/** 1415.8333 → "1,415.83" (item level) */
export function fmt2(n) { return NF2.format(n || 0); }
/** 950 → "950", 12345 → "12.3K", 1234567 → "1.23M", 2.5e9 → "2.50B" */
export function fmtShort(n) {
  n = Math.round(n || 0);
  const a = Math.abs(n);
  if (a < 1000) return '' + n;
  if (a < 10000) return (n / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
  if (a < 1e6) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (a < 1e9) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
}
/** Seconds → "1:05", "12:34", "1:02:03" */
export function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const hh = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return (hh ? hh + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
/** Clock with tenths ("1:05.4") for clear times. */
export function fmtClockMs(sec) {
  sec = Math.max(0, sec || 0);
  const t = Math.floor((sec % 1) * 10);
  return fmtClock(sec) + '.' + t;
}
/** Skill cooldown label: "4:12" (≥60 s), "23" (≥1 s), "0.4". */
export function fmtCD(sec) {
  if (sec >= 60) return fmtClock(Math.ceil(sec));
  if (sec >= 1) return '' + Math.ceil(sec);
  return sec > 0 ? sec.toFixed(1) : '';
}
/** Buff timer: "2h", "12m", "43s", "3.2" */
export function fmtLeft(sec) {
  if (sec == null || sec === Infinity || sec < 0) return '';
  if (sec >= 3600) return Math.ceil(sec / 3600) + 'h';
  if (sec >= 60) return Math.ceil(sec / 60) + 'm';
  if (sec >= 5) return Math.ceil(sec) + 's';
  return sec.toFixed(1);
}
/** "12.5%" with sensible precision. */
export function fmtPct(v, digits = 1) { return (Math.round(v * Math.pow(10, digits)) / Math.pow(10, digits)).toFixed(digits) + '%'; }

// ------------------------------------------------------------------------------------------------ strings
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** 'keen_edge' | 'keenEdge' → 'Keen Edge' */
export function pretty(id) {
  return String(id ?? '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// ------------------------------------------------------------------------------------------------ colour
export function hexToRgb(hex) {
  if (typeof hex === 'number') return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  hex = String(hex).replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function toHex(c) { return typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c; }
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
/** f < 0 darkens, f > 0 lightens (towards white). */
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const m = v => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255);
  return '#' + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------------------------------------ random
/** mulberry32 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let x = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

// ------------------------------------------------------------------------------------------------ storage
/** localStorage JSON get/set that never throws (private mode, blocked storage, previews). */
export const store = {
  get(key, def) { try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

export const now = () => performance.now() / 1000;

/**
 * Damage trail for bars: holds the old value briefly after a hit, then chases the current one; heals snap.
 * Works under continuous 15 Hz pushes (a delayed CSS transition would restart forever and never move).
 */
export class Trail {
  constructor(el, hold = 0.38) { this.el = el; this.v = -1; this.hold = hold; this.hitT = 0; this.last = 0; this.caught = true; }
  set(cur, snap = false) {
    const t = now();
    const dt = this.last ? Math.min(0.25, t - this.last) : 0;
    this.last = t;
    if (snap || this.v < 0 || cur >= this.v - 1e-4) { this.v = cur; this.caught = true; }
    else {
      if (this.caught) { this.caught = false; this.hitT = t; }
      if (t - this.hitT > this.hold) this.v = Math.max(cur, this.v - Math.max((this.v - cur) * 3.4 * dt, 0.06 * dt));
      if (this.v - cur < 1e-4) { this.v = cur; this.caught = true; }
    }
    const k = '_st_transform', v = `scaleX(${this.v.toFixed(4)})`;
    if (this.el[k] !== v) { this.el[k] = v; this.el.style.transform = v; }
  }
}
