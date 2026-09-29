// Character profile: paper doll (6 gear left, 5 accessories + stone + bracelet right) around a portrait area the
// lead fills with a 3D render (ui.get('character').portrait is the element to mount into), combat stats, item level,
// engravings summary, cards summary.
//   data: { name, cls, level, iLvl, title?, guild?, roster?,
//           gear: { weapon, head, shoulder, chest, pants, gloves, necklace, earring1, earring2, ring1, ring2, stone, bracelet },
//           stats: { atk, hp, crit, spec, swift, dom, endur, expert },
//           engravings: [{ id, nodes, neg? }], cards?: { set, count, awaken, bonuses: [{ text, active }] } }
// Actions: char:slot { slot } (click) · char:unequip { slot, uid } (right-click) · inv:equip { uid, slot } (drop from inventory)
import { h, esc, fmtInt, fmt2, clear } from '../core/util.js';
import { iconUrl } from '../core/icon.js';
import { slot } from '../core/kit.js';
import { cls as clsInfo, STATS, COMBAT_STATS, STAT_DESC, engr, engrLevel, qualityColor, grade } from '../core/data.js';
import { Win } from '../core/windows.js';

const LEFT = [['head', 'Head'], ['shoulder', 'Shoulders'], ['chest', 'Chest'], ['pants', 'Pants'], ['gloves', 'Gloves'], ['weapon', 'Weapon']];
const RIGHT = [['necklace', 'Necklace'], ['earring1', 'Earring'], ['earring2', 'Earring'], ['ring1', 'Ring'], ['ring2', 'Ring'], ['stone', 'Ability Stone'], ['bracelet', 'Bracelet']];
const SLOT_KIND = { weapon: 'weapon', head: 'armor', shoulder: 'armor', chest: 'armor', pants: 'armor', gloves: 'armor', necklace: 'accessory', earring1: 'accessory', earring2: 'accessory', ring1: 'accessory', ring2: 'accessory', stone: 'stone', bracelet: 'bracelet' };
const EMPTY_ICON = { weapon: 'item:weapon:reaver:t0', head: 'item:head:t0', shoulder: 'item:shoulder:t0', chest: 'item:chest:t0', pants: 'item:pants:t0', gloves: 'item:gloves:t0', necklace: 'item:necklace', earring1: 'item:earring', earring2: 'item:earring', ring1: 'item:ring', ring2: 'item:ring', stone: 'item:stone', bracelet: 'item:bracelet' };

export class CharacterWin extends Win {
  static id = 'character'; static title = 'Character Profile'; static glyph = 'character'; static width = 940; static pos = 'left';
  build() {
    const b = this.body;
    b.classList.add('ss-cp');
    this.hdr = h('div', 'ss-cp-hdr', b);
    const main = h('div', 'ss-cp-main', b);
    this.left = h('div', 'ss-cp-col', main);
    const mid = h('div', 'ss-cp-mid', main);
    /** Mount point for the lead's 3D portrait (canvas). Size: 250×390 virtual px. */
    this.portrait = h('div', 'ss-cp-portrait', mid);
    this.portraitBg = h('div', 'ss-cp-pbg', this.portrait);
    this.ilvl = h('div', 'ss-cp-ilvl', mid);
    this.right = h('div', 'ss-cp-col ss-cp-col--r', main);
    this.side = h('div', 'ss-cp-side ss-scroll', main);
  }
  render(d) {
    const c = clsInfo(d.cls);
    this.el.style.setProperty('--cc', c.color);
    this.hdr.innerHTML = `<i class="ss-cp-crest" style="background-image:url('${iconUrl('class:' + d.cls, 44)}')"></i>
      <div class="ss-cp-id"><div class="ss-cp-name">${esc(d.name || '')}${d.title ? ` <span>${esc(d.title)}</span>` : ''}</div>
      <div class="ss-cp-sub">Lv ${esc(d.level ?? 1)} <b style="color:${c.color}">${esc(c.name)}</b>${d.guild ? ` · &lt;${esc(d.guild)}&gt;` : ''}${d.roster ? ` · Roster Lv ${esc(d.roster)}` : ''}</div></div>`;
    this.portraitBg.style.backgroundImage = `url('${iconUrl('class:' + d.cls, 160)}')`;
    const gear = d.gear || {};
    const row = (parent, [k, label], right) => {
      const it = gear[k] || null;
      const r = h('div', 'ss-cp-slot' + (right ? ' is-r' : ''), parent);
      r.dataset.slot = k;
      const s = slot(it, {
        size: 50, empty: { icon: EMPTY_ICON[k], tip: label }, hone: false,
        onClick: () => this.ui.emit('char:slot', { slot: k, uid: it?.uid }),
        onContext: it ? () => this.ui.emit('char:unequip', { slot: k, uid: it.uid }) : null,
        hint: it ? 'Right-click to unequip' : null,
      });
      r.appendChild(s);
      s._drop = drag => drag.item && (SLOT_KIND[k] === drag.item.kind) ? () => this.ui.emit('inv:equip', { uid: drag.item.uid, slot: k }) : null;
      const t = h('div', 'ss-cp-st', r);
      if (it) {
        const g = grade(it.grade);
        t.innerHTML = `<div class="ss-cp-sn" style="color:${g.c}">${it.hone ? `+${it.hone} ` : ''}${esc(label)}</div>` +
          (it.quality != null && it.kind !== 'stone' && it.kind !== 'bracelet' ? `<div class="ss-cp-q"><i style="width:${it.quality}%;background:${qualityColor(it.quality)}"></i></div><div class="ss-cp-sm"><span style="color:${qualityColor(it.quality)}">${it.quality}</span>${it.iLvl ? ` · ${fmtInt(it.iLvl)}` : ''}</div>` : '') +
          ((it.kind === 'accessory' || it.kind === 'stone') && it.engr ? `<div class="ss-cp-en">${it.engr.map(e => `${esc(engr(e.id).name.split(' ')[0])} +${e.v}`).join(' · ')}</div>` : '');
      } else t.innerHTML = `<div class="ss-cp-sn is-empty">${esc(label)}</div><div class="ss-cp-sm">Empty</div>`;
    };
    clear(this.left); clear(this.right);
    LEFT.forEach(x => row(this.left, x, false));
    RIGHT.forEach(x => row(this.right, x, true));
    this.ilvl.innerHTML = `<span>Item Level</span><b>${fmt2(d.iLvl || 0)}</b>`;
    // side panel: stats, engravings, cards
    const st = d.stats || {};
    const s = this.side; clear(s);
    const sec = t => { const x = h('section', 'ss-cp-sec', s); h('div', 'ss-h', x, t); return x; };
    const a = sec('Basic');
    a.insertAdjacentHTML('beforeend', `<div class="ss-cp-big"><div class="ss-ptr" data-k="atk"><span>Attack Power</span><b>${fmtInt(st.atk || 0)}</b></div><div class="ss-ptr" data-k="hp"><span>Max HP</span><b>${fmtInt(st.hp || 0)}</b></div></div>`);
    const b = sec('Combat Stats');
    const total = COMBAT_STATS.reduce((m, k) => Math.max(m, st[k] || 0), 1);
    for (const k of COMBAT_STATS) {
      const r = h('div', 'ss-cp-stat ss-ptr', b);
      r.innerHTML = `<span>${STATS[k]}</span><i><u style="width:${((st[k] || 0) / total * 100).toFixed(1)}%"></u></i><b>${fmtInt(st[k] || 0)}</b>`;
      r._tip = { title: STATS[k], lines: [STAT_DESC[k]] };
    }
    for (const el of a.querySelectorAll('[data-k]')) el._tip = { title: STATS[el.dataset.k], lines: [STAT_DESC[el.dataset.k]] };
    const e = sec('Engravings');
    const list = d.engravings || [];
    if (!list.length) h('div', 'ss-empty', e, 'No active engravings.');
    for (const x of list) {
      const E = engr(x.id), neg = x.neg || E.neg, lv = x.level ?? engrLevel(x.nodes);
      const r = h('div', 'ss-cp-engr ss-ptr' + (neg ? ' is-neg' : ''), e);
      r.innerHTML = `<i style="background-image:url('${iconUrl('engr:' + x.id, 26)}')"></i><span>${esc(E.name)}</span><em class="ss-lvl">Lv ${lv}</em>`;
      r._tip = { title: `${E.name} · Lv ${lv}`, lines: [E.desc, x.nodes != null ? `${x.nodes} / 15 nodes` : null], color: neg ? '#ff8a7a' : null };
    }
    if (d.cards) {
      const cs = sec('Cards');
      const cd = d.cards;
      cs.insertAdjacentHTML('beforeend', `<div class="ss-cp-cards"><b>${esc(cd.set || 'No set')}</b><span>${cd.count ?? 0} cards · ${cd.awaken ?? 0} awakenings</span></div>` +
        (cd.bonuses || []).map(x => `<div class="ss-cp-cb${x.active ? ' is-on' : ''}">${esc(x.text)}</div>`).join(''));
    }
  }
}
