// NPC dialogue (Lost Ark style): cinematic bottom panel with portrait, name plate, typed text and choices.
//   ui.dialog(npc, script) → Promise<choiceId | null>
//   npc: { id?, name, title?, portrait?: canvas | dataURL, cls? }
//   script: string | [string | { text, speaker?, choices?: [{ id, text, kind?: 'quest'|'shop'|'leave'|'talk' }] }]
// Space / Enter / click advance (finishing the typing first), 1–9 pick a choice, Esc closes (→ null).
// Also emits dialog:choice { id, npc } and dialog:close {}.
import { h, btn, esc, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { slug } from '../core/data.js';

const KIND_G = { quest: 'quest', shop: 'market', leave: 'exit', talk: 'chat' };
const CPS = 60; // typing speed, characters per second

export class NpcDialog {
  constructor(ui, layer) {
    this.ui = ui; this.active = false;
    const el = this.el = h('div', 'ss-dlg', layer);
    el.style.display = 'none';
    h('div', 'ss-dlg-shade', el);
    const box = this.box = h('div', 'ss-dlg-box ss-panel', el);
    box.setAttribute('role', 'dialog');
    this.por = h('div', 'ss-dlg-por', box);
    const main = h('div', 'ss-dlg-main', box);
    const plate = h('div', 'ss-dlg-plate', main);
    this.name = h('b', '', plate);
    this.title = h('span', '', plate);
    this.text = h('div', 'ss-dlg-text', main);
    this.text.setAttribute('aria-live', 'polite');
    this.more = h('i', 'ss-dlg-more', main);
    this.choices = h('div', 'ss-dlg-choices', box);
    const x = btn('ss-close ss-dlg-x', box, null, () => this.finish(null), 'Close dialogue');
    x.innerHTML = glyph('close');
    box.addEventListener('click', e => { if (!e.target.closest('button')) this.advance(); });
  }
  run(npc = {}, script = []) {
    if (this.active) this.finish(null);
    const lines = (Array.isArray(script) ? script : [script]).map(l => typeof l === 'string' ? { text: l } : l);
    this.npc = npc; this.lines = lines; this.i = -1; this.active = true;
    this.name.textContent = npc.name || '';
    this.title.textContent = npc.title || '';
    clear(this.por);
    const p = npc.portrait;
    if (p && p.tagName === 'CANVAS') this.por.appendChild(p);
    else {
      // portrait: supplied image → npc:<id> → npc:<slug(name)> (the icon set paints named NPCs, a hooded bust otherwise) → class crest
      const key = npc.id || slug(npc.name || '');
      const i = h('i', 'ss-dlg-pi', this.por);
      i.style.backgroundImage = `url("${p || iconUrl(key ? 'npc:' + key : 'class:' + (npc.cls || 'oathkeeper'), 150)}")`;
      if (!p && !key) i.classList.add('is-crest');
    }
    this.el.style.display = '';
    this.el.classList.remove('is-out'); void this.el.offsetWidth; this.el.classList.add('is-in');
    this.ui.tip.hide();
    this.ui.root.classList.add('ss-in-dialog');
    return new Promise(res => { this.resolve = res; this.next(); });
  }
  next() {
    this.i++;
    if (this.i >= this.lines.length) return this.finish(null);
    const L = this.lines[this.i];
    if (L.speaker) this.name.textContent = L.speaker; else this.name.textContent = this.npc.name || '';
    this.full = String(L.text || '');
    this.shown = 0; this.t0 = performance.now();
    clear(this.choices); this.choices.classList.remove('is-on'); this.more.classList.remove('is-on');
    cancelAnimationFrame(this.raf);
    const step = () => {
      this.shown = Math.min(this.full.length, Math.floor((performance.now() - this.t0) / 1000 * CPS));
      this.text.textContent = this.full.slice(0, this.shown);
      if (this.shown < this.full.length) this.raf = requestAnimationFrame(step); else this.done();
    };
    step();
  }
  done() {
    this.text.textContent = this.full;
    this.shown = this.full.length;
    const L = this.lines[this.i];
    if (L.choices && L.choices.length) {
      clear(this.choices);
      L.choices.forEach((c, k) => {
        const b = btn('ss-dlg-ch' + (c.kind ? ' is-' + c.kind : ''), this.choices, null, () => this.pick(c), c.text);
        b.innerHTML = `<span class="ss-dlg-n">${k + 1}</span>${glyph(KIND_G[c.kind] || 'chat')}<span>${esc(c.text)}</span>`;
        b.style.animationDelay = (k * 0.06) + 's';
      });
      this.choices.classList.add('is-on');
      this.choices.querySelector('button')?.focus({ preventScroll: true });
    } else this.more.classList.add('is-on');
  }
  advance() {
    if (!this.active) return;
    if (this.shown < this.full.length) { cancelAnimationFrame(this.raf); this.done(); return; }
    if (this.lines[this.i]?.choices?.length) return;
    this.next();
  }
  pick(c) {
    this.ui.emit('dialog:choice', { id: c.id, npc: this.npc.id || this.npc.name });
    this.finish(c.id);
  }
  finish(result) {
    if (!this.active) return;
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.el.classList.add('is-out');
    this.ui.root.classList.remove('ss-in-dialog');
    setTimeout(() => { if (!this.active) this.el.style.display = 'none'; }, 220);
    if (result == null) this.ui.emit('dialog:close', {});
    const r = this.resolve; this.resolve = null;
    r && r(result ?? null);
  }
  key(e) {
    if (!this.active) return false;
    if (e.key === 'Escape') { this.finish(null); return true; }
    if (e.key === ' ' || e.key === 'Enter') { if (document.activeElement?.closest?.('.ss-dlg-ch') && this.shown >= this.full.length) return false; this.advance(); return true; }
    const n = +e.key;
    const L = this.lines[this.i];
    if (n >= 1 && L?.choices && L.choices[n - 1] && this.shown >= this.full.length) { this.pick(L.choices[n - 1]); return true; }
    return true; // the dialogue owns the keyboard while open
  }
}
