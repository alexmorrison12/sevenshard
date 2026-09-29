// Design-system primitives (JS side of b-kit.css). Every window is assembled from these so the whole UI stays
// consistent; later windows (market, guild, stronghold…) should use them too. All return plain elements.
//
//   slot(item, { size, onClick, onContext, tip, hint, empty, dim, sel, drag })  grade-framed item slot with tooltip
//   tabs(parent, [{ id, label, count? }], value, onChange) → { el, set(id) }
//   vtabs(...)                                                                 same, vertical
//   toggle(parent, label, value, onChange) → input         range(parent, { label, min, max, step, value, fmt, onChange })
//   select(parent, options, value, onChange) → select      seg(parent, [{ id, label }], value, onChange) → { el, set }
//   bar(parent, { cls, value, text }) → { el, set(frac, text?) }
//   money(parent, { silver, gold, crystals, …any wallet key }, { keys? })  currency line with icons (core/data CURRENCIES)
//   section(parent, title) → body element (gold rule header)
//   kv(parent, key, value) → row element                   empty(parent, text) → placeholder element
import { h, btn, esc, fmtInt, fmtShort, clamp } from './util.js';
import { itemIcon, iconUrl } from './icon.js';
import { qualityColor, currency, currencyList } from './data.js';

export function slot(item, o = {}) {
  const size = o.size || 48;
  const s = h('div', 'ss-slot ss-ptr' + (item ? ` ss-g${item.grade | 0}` : ' ss-slot--empty'));
  s.style.setProperty('--sz', size + 'px');
  if (item) {
    const ic = h('div', 'ss-slot-ic', s);
    ic.style.backgroundImage = `url("${itemIcon(item.icon || 'item:' + (item.kind || 'material'), size)}")`;
    if (item.count > 1) h('span', 'ss-slot-n', s, item.count >= 10000 ? fmtShort(item.count) : fmtInt(item.count));
    if (item.hone && o.hone !== false) h('span', 'ss-slot-hone', s, '+' + item.hone);
    if (item.quality != null && o.quality !== false && ['weapon', 'armor', 'accessory'].includes(item.kind)) {
      const q = h('div', 'ss-slot-q', s); const f = h('i', '', q);
      f.style.transform = `scaleX(${clamp(item.quality / 100, 0, 1)})`; f.style.setProperty('--qc', qualityColor(item.quality));
    }
    if (item.locked) { const l = h('span', 'ss-slot-lock', s); l.textContent = '●'; }
    if (item.isNew) h('i', 'ss-slot-new', s);
    s._tip = o.tip !== false ? () => ({ kind: 'item', item, hint: o.hint }) : null;
    s.setAttribute('aria-label', `${item.name}${item.count > 1 ? ' ×' + item.count : ''}`);
  } else if (o.empty) {
    const e = h('div', 'ss-slot-empty', s);
    if (o.empty.icon) e.style.backgroundImage = `url("${iconUrl(o.empty.icon, size)}")`;
    if (o.empty.label) { h('span', 'ss-slot-el', s, o.empty.label); }
    if (o.empty.tip) s._tip = { title: o.empty.tip };
  }
  if (o.dim) s.classList.add('is-dim');
  if (o.sel) s.classList.add('is-sel');
  if (o.onClick) s.addEventListener('click', e => o.onClick(item, e));
  if (o.onContext) s.addEventListener('contextmenu', e => { e.preventDefault(); o.onContext(item, e); });
  s.setAttribute('role', 'button');
  s.tabIndex = item || o.onClick ? 0 : -1;
  if (o.onClick) s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onClick(item, e); } });
  return s;
}

function tabStrip(cls, parent, items, value, onChange) {
  const el = h('div', cls, parent);
  el.setAttribute('role', 'tablist');
  const map = {};
  for (const t of items) {
    const b = btn('ss-tab', el, null, () => { set(t.id); onChange && onChange(t.id); });
    b.setAttribute('role', 'tab');
    b.innerHTML = (t.glyph || '') + `<span>${esc(t.label)}</span>` + (t.count != null ? `<span class="ss-count">${t.count}</span>` : '');
    map[t.id] = b;
  }
  const set = id => { for (const k in map) map[k].setAttribute('aria-selected', k === id); };
  set(value);
  return { el, set, map };
}
export const tabs = (parent, items, value, onChange) => tabStrip('ss-tabs', parent, items, value, onChange);
export const vtabs = (parent, items, value, onChange) => tabStrip('ss-vtabs', parent, items, value, onChange);

export function toggle(parent, label, value, onChange) {
  const l = h('label', 'ss-toggle', parent);
  const i = h('input', '', l); i.type = 'checkbox'; i.checked = !!value;
  h('i', '', l);
  if (label) h('span', '', l, label);
  i.addEventListener('change', () => onChange && onChange(i.checked));
  return i;
}
export function range(parent, o) {
  const wrap = h('div', 'ss-rangerow', parent);
  if (o.label) h('span', 'ss-rangerow-l', wrap, o.label);
  const r = h('input', 'ss-range', wrap);
  r.type = 'range'; r.min = o.min ?? 0; r.max = o.max ?? 1; r.step = o.step ?? 0.01; r.value = o.value ?? 0;
  if (o.label) r.setAttribute('aria-label', o.label);
  const v = h('b', 'ss-rangerow-v', wrap);
  const fmt = o.fmt || (x => Math.round(x * 100) + '%');
  const upd = () => { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); v.textContent = fmt(+r.value); };
  upd();
  r.addEventListener('input', () => { upd(); o.onChange && o.onChange(+r.value); });
  return r;
}
export function select(parent, options, value, onChange) {
  const s = h('select', 'ss-select', parent);
  for (const o of options) { const op = h('option', '', s, o.label ?? o); op.value = o.id ?? o; }
  s.value = value;
  s.addEventListener('change', () => onChange && onChange(s.value));
  return s;
}
export function seg(parent, items, value, onChange) {
  const el = h('div', 'ss-seg', parent);
  el.setAttribute('role', 'group');
  const map = {};
  for (const t of items) { const b = btn('', el, null, () => { set(t.id); onChange && onChange(t.id); }, t.label); b.innerHTML = (t.glyph || '') + esc(t.label); map[t.id] = b; }
  const set = id => { for (const k in map) map[k].setAttribute('aria-pressed', k === String(id)); };
  set(String(value));
  return { el, set, map };
}
export function bar(parent, o = {}) {
  const el = h('div', 'ss-bar ' + (o.cls || ''), parent);
  const f = h('i', 'ss-fill', el);
  const t = o.text != null ? h('span', 'ss-bar-t', el) : null;
  const set = (frac, text) => { f.style.transform = `scaleX(${clamp(frac, 0, 1)})`; if (t && text != null) t.textContent = text; };
  set(o.value || 0, o.text);
  return { el, set };
}
export function money(parent, c = {}, o = {}) {
  const el = h('div', 'ss-money' + (o.cls ? ' ' + o.cls : ''), parent);
  for (const [k, n] of currencyList(c, o.keys)) {
    const C = currency(k), s = h('span', 'ss-money-i ss-ptr', el);
    s.innerHTML = `<i style="background-image:url('${iconUrl(C.icon, 18)}')"></i><b>${fmtInt(n)}</b>`;
    s._tip = { title: C.name, lines: [fmtInt(n)] };
  }
  return el;
}
export function price(parent, cur, amount, afford = true) {
  const el = h('span', 'ss-price' + (afford ? '' : ' is-short'), parent);
  const C = currency(cur || 'silver');
  el.innerHTML = `<i style="background-image:url('${iconUrl(C.icon, 16)}')"></i><b>${fmtInt(amount)}</b>`;
  el.title = C.name;
  return el;
}
export function section(parent, title, cls = '') {
  const s = h('section', 'ss-sec ' + cls, parent);
  if (title) h('div', 'ss-h', s, title);
  return h('div', 'ss-sec-bd', s);
}
export function kv(parent, k, v, cls = '') {
  const r = h('div', 'ss-kv ' + cls, parent);
  h('span', '', r, k); h('span', '', r, v);
  return r;
}
export function empty(parent, text) { return h('div', 'ss-empty', parent, text); }
