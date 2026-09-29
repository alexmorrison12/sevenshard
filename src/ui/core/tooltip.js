// Tooltip manager + renderers. Any element can carry `el._tip` (object or function returning one):
//   { title, lines: [string|null], key?, color? }        plain text tooltip
//   { kind: 'item', item: Item, compare?: Item }          Lost Ark-style item tooltip
//   { kind: 'skill', skill: Skill }                      skill tooltip with tags and tripods
// Hover shows it (mouse/pen); on touch a long-press (450 ms) shows it until the next tap.
import { h, esc, fmtInt, clamp, pretty } from './util.js';
import { iconUrl, itemIcon } from './icon.js';
import { grade, qualityColor, STATS, COMBAT_STATS, SLOTS, KINDS, BOUND, engr, SKILL_TYPES, STAGGER } from './data.js';

export class Tooltip {
  constructor(ui, layer) {
    this.ui = ui;
    this.el = h('div', 'ss-tip', layer);
    this.el.setAttribute('role', 'tooltip');
    this.anchor = null; this.data = null;
  }
  showFor(anchor, d) {
    if (!d) return this.hide();
    this.anchor = anchor; this.data = d;
    const el = this.el;
    el.className = 'ss-tip ' + (d.kind === 'item' ? 'ss-tip--item' : d.kind === 'skill' ? 'ss-tip--skill' : 'ss-tip--text');
    el.innerHTML = d.kind === 'item' ? itemTip(d.item, d) : d.kind === 'skill' ? skillTip(d.skill, d) : textTip(d);
    this.place(anchor);
    el.classList.add('is-on');
  }
  refresh() {
    const a = this.anchor;
    if (!a) return;
    if (!a.isConnected || a.offsetParent === null) return this.hide();
    const d = typeof a._tip === 'function' ? a._tip() : a._tip;
    if (!d) return this.hide();
    this.el.innerHTML = d.kind === 'item' ? itemTip(d.item, d) : d.kind === 'skill' ? skillTip(d.skill, d) : textTip(d);
  }
  place(anchor) {
    const s = this.ui.scale;
    const r = anchor.getBoundingClientRect();
    const a = { l: r.left / s, t: r.top / s, r: r.right / s, b: r.bottom / s };
    const el = this.el;
    el.style.left = '0px'; el.style.top = '0px';
    const tr = el.getBoundingClientRect();
    const w = tr.width / s, ht = tr.height / s;
    const W = this.ui.vw, H = this.ui.vh, m = 8;
    let x, y;
    const lowHalf = a.t > H * 0.62;
    if (lowHalf) { // HUD slots near the bottom: above, centred
      x = (a.l + a.r) / 2 - w / 2; y = a.t - ht - 10;
      if (y < m) y = a.b + 10;
    } else if (a.r + 12 + w < W - m) { x = a.r + 12; y = a.t; }
    else { x = a.l - 12 - w; y = a.t; }
    x = clamp(x, m, W - w - m); y = clamp(y, m, H - ht - m);
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
  }
  hide() { this.anchor = null; this.data = null; this.el.classList.remove('is-on'); }
}

// ------------------------------------------------------------------------------------------------ text
function textTip(d) {
  let s = '';
  if (d.title) s += `<b${d.color ? ` style="color:${esc(d.color)}"` : ''}>${esc(d.title)}</b>`;
  for (const l of d.lines || []) if (l) s += `<div>${esc(l)}</div>`;
  if (d.key) s += `<div class="ss-tip-key">Hotkey <span class="ss-kbd">${esc(d.key)}</span></div>`;
  return s;
}

// ------------------------------------------------------------------------------------------------ item
export function itemTip(it, o = {}) {
  if (!it) return '';
  const g = grade(it.grade);
  const kind = KINDS[it.kind] || pretty(it.kind || 'Item');
  const slotName = it.slot ? SLOTS[it.slot] || pretty(it.slot) : null;
  const gearish = ['weapon', 'armor', 'accessory', 'stone', 'bracelet'].includes(it.kind);
  let s = `<div class="ss-it-hd ss-g${it.grade | 0}">`;
  s += `<div class="ss-slot ss-g${it.grade | 0}" style="--sz:52px"><div class="ss-slot-ic" style="background-image:url('${itemIcon(it.icon || 'item:' + (it.kind || 'material'), 52)}')"></div></div>`;
  s += `<div class="ss-it-hd-tx"><div class="ss-it-name ss-gt">${it.hone ? `<span class="ss-it-hone">+${it.hone}</span> ` : ''}${esc(it.name || 'Unknown Item')}</div>`;
  s += `<div class="ss-it-type"><span class="ss-gt">${g.name}</span> ${esc(slotName || kind)}</div>`;
  if (it.iLvl) s += `<div class="ss-it-ilvl">Item Level <b>${fmtInt(it.iLvl)}</b>${it.tier ? ` <span>(Tier ${it.tier})</span>` : ''}</div>`;
  s += `</div></div>`;
  if (it.quality != null && gearish) {
    const q = clamp(it.quality, 0, 100), qc = qualityColor(q);
    s += `<div class="ss-it-q"><span>Quality</span><div class="ss-it-qbar"><i style="width:${q}%;background:${qc}"></i></div><b style="color:${qc}">${q}</b></div>`;
  }
  const sec = (title, body, cls = '') => body ? `<div class="ss-it-sec ${cls}"><div class="ss-it-sh">${title}</div>${body}</div>` : '';
  // bound / trade
  let meta = '';
  if (it.bound) meta += `<div class="ss-it-bound">${esc(BOUND[it.bound] || pretty(it.bound))}</div>`;
  if (it.trades != null) meta += `<div class="ss-it-dim">${it.trades > 0 ? `Tradable ${it.trades} more time${it.trades > 1 ? 's' : ''}` : 'Cannot be traded'}</div>`;
  if (meta) s += `<div class="ss-it-meta">${meta}</div>`;
  // stats
  const st = it.stats || {};
  let basic = '', extra = '';
  for (const k of ['atk', 'might', 'hp', 'vit', 'def']) if (st[k]) basic += `<div class="ss-it-stat"><span>${STATS[k]}</span><b>+${fmtInt(st[k])}</b></div>`;
  for (const k of COMBAT_STATS) if (st[k]) extra += `<div class="ss-it-stat"><span>${STATS[k]}</span><b>+${fmtInt(st[k])}</b></div>`;
  s += sec('Basic Effect', basic);
  s += sec('Additional Effect', extra);
  // bracelet / misc effects
  if (it.effects && it.effects.length) s += sec('Effects', it.effects.map(e => `<div class="ss-it-eff">${esc(e)}</div>`).join(''));
  // engravings (+ negative)
  const eng = [...(it.engr || [])];
  if (it.neg) eng.push({ ...it.neg, neg: true });
  if (eng.length && it.kind !== 'stone') {
    s += sec('Engraving Effects', eng.map(e => {
      const E = engr(e.id); const neg = e.neg || E.neg;
      return `<div class="ss-it-engr${neg ? ' is-neg' : ''}"><span>[${esc(e.name || E.name)}]</span> Node <b>+${e.v}</b></div>`;
    }).join(''));
  }
  // ability stone facets
  if (it.facets) {
    const lines = (it.facetNames || (it.engr || []).map(e => e.id).concat(it.neg ? [it.neg.id] : [])).slice(0, 3);
    s += sec('Faceting', it.facets.map((row, i) => {
      const E = engr(lines[i]); const neg = i === 2;
      const pips = row.map(v => `<i class="${v === 1 ? 'on' : v === 0 ? 'off' : ''}"></i>`).join('');
      const nodes = row.filter(v => v === 1).length;
      return `<div class="ss-it-facet${neg ? ' is-neg' : ''}"><span>${esc(E.name)}</span><span class="ss-facets">${pips}</span><b>+${nodes}</b></div>`;
    }).join(''));
  }
  // gem
  if (it.kind === 'gem' && it.gem) s += sec('Gem Effect', `<div class="ss-it-eff">${esc(it.gem.skill || 'Skill')}: ${esc(it.gem.effect || '')}</div>`);
  // card
  if (it.kind === 'card' && it.awaken != null) s += sec('Card Awakening', `<div class="ss-it-stars">${'★'.repeat(it.awaken)}<span>${'★'.repeat(Math.max(0, 5 - it.awaken))}</span></div>`);
  // set
  if (it.set) {
    const set = typeof it.set === 'string' ? { name: pretty(it.set) } : it.set;
    let body = '';
    for (const b of set.bonuses || []) body += `<div class="ss-it-set${(set.have || 0) >= b.n ? ' is-on' : ''}"><b>${b.n}-Set</b> ${esc(b.text)}</div>`;
    s += sec(`Set Effect · ${esc(set.name)}${set.have != null ? ` <span>(${set.have}/${set.pieces || 6})</span>` : ''}`, body || `<div class="ss-it-dim">Part of the ${esc(set.name)} set.</div>`);
  }
  if (it.desc) s += `<div class="ss-it-desc">${esc(it.desc)}</div>`;
  if (it.use) s += `<div class="ss-it-use">Use: ${esc(it.use)}</div>`;
  if (it.cd) s += `<div class="ss-it-dim">Cooldown ${it.cd}s</div>`;
  // footer
  let ft = '';
  if (it.count > 1) ft += `<span>Quantity ${fmtInt(it.count)}</span>`;
  if (it.value) ft += `<span class="ss-it-val">${fmtInt(it.value)}<i class="ss-cur ss-cur--silver"></i></span>`;
  if (ft) s += `<div class="ss-it-ft">${ft}</div>`;
  if (o.hint) s += `<div class="ss-it-hint">${esc(o.hint)}</div>`;
  return s;
}

// ------------------------------------------------------------------------------------------------ skill
export function skillTip(sk, o = {}) {
  if (!sk) return '';
  const type = SKILL_TYPES[sk.type] || (sk.type ? sk.type + ' Skill' : 'Skill');
  let s = `<div class="ss-sk-hd"><div class="ss-sk-hd-ic" style="background-image:url('${iconUrl(sk.icon, 52)}')"></div><div class="ss-sk-hd-tx">`;
  s += `<div class="ss-sk-name">${esc(sk.name || 'Skill')}</div>`;
  s += `<div class="ss-sk-type">${esc(type)}${sk.level ? ` · <span>Skill Lv. ${sk.level}${sk.maxLevel ? '/' + sk.maxLevel : ''}</span>` : ''}</div>`;
  const meta = [];
  if (sk.cd) meta.push(`Cooldown <b>${sk.cd}s</b>`);
  if (sk.mana) meta.push(`Mana <b>${fmtInt(sk.mana)}</b>`);
  if (sk.key) meta.push(`<span class="ss-kbd">${esc(sk.key)}</span>`);
  if (meta.length) s += `<div class="ss-sk-meta">${meta.join('<i></i>')}</div>`;
  s += `</div></div>`;
  const tags = [];
  if (sk.stagger) tags.push(['Stagger', STAGGER[String(sk.stagger).toLowerCase()] || pretty(sk.stagger), '#b58cff']);
  if (sk.weakPoint) tags.push(['Weak Point', 'Lv. ' + sk.weakPoint, '#ffb43c']);
  if (sk.counter) tags.push(['Counter', 'Yes', '#52d4ff']);
  if (sk.attack) tags.push(['Attack Type', sk.attack + ' Attack', '#ff8a5a']);
  if (sk.superArmor) tags.push(['Super Armor', typeof sk.superArmor === 'string' ? sk.superArmor : 'Push Immunity', '#9fb8e0']);
  if (tags.length) s += `<div class="ss-sk-tags">${tags.map(([k, v, c]) => `<div class="ss-sk-tag" style="--tc:${c}"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  if (sk.desc) s += `<div class="ss-sk-desc">${esc(sk.desc)}</div>`;
  const tri = sk.tripods;
  if (tri && tri.length) {
    let t = '';
    tri.forEach((tier, i) => {
      const p = (tier || []).find(x => x && x.picked);
      if (p) t += `<div class="ss-sk-tri ss-tri${i + 1}"><i class="ss-tri-ic" style="background-image:url('${iconUrl(p.icon || 'tripod:' + p.id, 24)}')"></i><div><b>${esc(p.name)}</b>${p.desc ? `<span>${esc(p.desc)}</span>` : ''}</div></div>`;
      else t += `<div class="ss-sk-tri ss-tri${i + 1} is-empty"><i class="ss-tri-ic"></i><div><b>Tier ${i + 1}</b><span>${(sk.level || 0) >= [4, 7, 10][i] ? 'No tripod selected' : `Unlocks at skill level ${[4, 7, 10][i]}`}</span></div></div>`;
    });
    s += `<div class="ss-sk-tris"><div class="ss-it-sh">Tripods</div>${t}</div>`;
  }
  if (o.hint) s += `<div class="ss-it-hint">${esc(o.hint)}</div>`;
  return s;
}
