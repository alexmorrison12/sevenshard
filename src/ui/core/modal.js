// Confirm / prompt modals (Promise-based). Enter confirms, Esc cancels, focus is trapped and restored.
//   ui.confirm({ title, text, ok, cancel, danger, match })  → Promise<boolean>   (match: type-to-confirm string)
//   ui.prompt({ title, text, value, placeholder, ok, cancel, maxLength, validate(v) → error|null }) → Promise<string|null>
import { h, btn } from './util.js';

export class Modals {
  constructor(ui, layer) { this.ui = ui; this.layer = layer; this.stack = []; }
  get open() { return this.stack.length > 0; }
  _make({ title, text, danger }) {
    const bg = h('div', 'ss-modal-bg', this.layer);
    const m = h('div', 'ss-modal ss-panel ss-orn', bg);
    m.setAttribute('role', 'alertdialog');
    m.setAttribute('aria-modal', 'true');
    if (title) { const t = h('div', 'ss-title', m, title); t.id = 'ss-m-' + Math.random().toString(36).slice(2); m.setAttribute('aria-labelledby', t.id); }
    if (text) h('p', 'ss-modal-tx', m, text);
    if (danger) m.classList.add('is-danger');
    return { bg, m };
  }
  _run(o, withInput) {
    return new Promise(resolve => {
      const prevFocus = document.activeElement;
      const { bg, m } = this._make(o);
      let input = null, hint = null;
      if (withInput) {
        input = h('input', 'ss-input', m);
        input.type = 'text'; input.value = o.value || ''; input.placeholder = o.placeholder || ''; input.maxLength = o.maxLength || 40;
        input.spellcheck = false; input.autocomplete = 'off';
        input.setAttribute('aria-label', o.title || 'Input');
        hint = h('div', 'ss-modal-hint', m, o.hint || '');
      }
      const row = h('div', 'ss-modal-row', m);
      const cancel = o.cancel === false ? null : btn('ss-btn', row, o.cancel || 'Cancel', () => done(false));
      const ok = btn('ss-btn ' + (o.danger ? 'ss-btn--danger' : 'ss-btn--primary'), row, o.ok || 'Confirm', () => done(true));
      const check = () => {
        let err = null;
        if (o.match != null) err = input.value.trim() === String(o.match) ? null : `Type "${o.match}" to confirm`;
        else if (o.validate) err = o.validate(input.value);
        ok.disabled = !!err;
        if (hint) { hint.textContent = err && input.value ? err : (o.hint || (o.match != null ? `Type "${o.match}" to confirm` : '')); hint.classList.toggle('is-bad', !!(err && input.value)); }
        return !err;
      };
      if (input) { input.addEventListener('input', check); check(); }
      const key = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!ok.disabled) done(true); }
        else if (e.key === 'Tab') { // trap focus
          const f = [...m.querySelectorAll('button, input')].filter(x => !x.disabled);
          const i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
        e.stopPropagation();
      };
      m.addEventListener('keydown', key);
      bg.addEventListener('pointerdown', e => { if (e.target === bg && o.cancel !== false) done(false); });
      const entry = { close: () => done(false) };
      this.stack.push(entry);
      let finished = false;
      const self = this;
      function done(yes) {
        if (finished) return; finished = true;
        if (yes && input && !check()) { finished = false; return; }
        self.stack = self.stack.filter(x => x !== entry);
        bg.classList.add('is-out');
        setTimeout(() => bg.remove(), 160);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch { /* gone */ }
        resolve(withInput ? (yes ? input.value.trim() : null) : !!yes);
      }
      requestAnimationFrame(() => (input || ok).focus());
      void cancel;
    });
  }
  confirm(o = {}) { if (o.match != null) return this._run({ ...o, value: '' }, true).then(v => v != null); return this._run(o, false); }
  prompt(o = {}) { return this._run(o, true); }
  closeTop() { const e = this.stack[this.stack.length - 1]; if (e) { e.close(); return true; } return false; }
}
