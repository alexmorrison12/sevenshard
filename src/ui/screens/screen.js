// Base class for full-screen UI states. A screen builds its DOM once (lazily), re-renders from data on every
// ui.screen(name, data) call, and may handle keys (return true when handled).
//   static overlay = true → the HUD stays visible underneath (death screen).
import { h } from '../core/util.js';

export class Screen {
  static id = 'screen';
  static overlay = false;
  constructor(ui, layer) {
    this.ui = ui;
    this.el = h('div', `ss-scr ss-scr--${this.constructor.id}`, layer);
    this.el.style.display = 'none';
    this.data = {};
    this.build();
  }
  build() {}
  render() {}
  resize() {}
  key() { return false; }
  shown() {}
  hidden() {}
  _show(d) {
    this.el.style.display = '';
    this.el.classList.remove('is-out');
    void this.el.offsetWidth;
    this.el.classList.add('is-in');
    this.data = d || {};
    this.render(this.data);
    this.shown();
  }
  _hide() {
    this.el.classList.remove('is-in');
    this.el.style.display = 'none';
    this.hidden();
  }
  emit(type, payload) { this.ui.emit(type, payload); }
}
