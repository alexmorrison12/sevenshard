// Quest tracker (right side, under the minimap). Keyed by quest id; steps diffed in place; progress ticks pulse.
//   quests: [{ id, title, kind: 'msq'|'side'|'daily'|'event'|'guide', steps: [{ text, n, need, done }] }]
import { h, setText, setCls, show, replay, btn } from '../core/util.js';
import { glyph } from '../core/glyphs.js';

const KIND = { msq: 'Main Story', side: 'Side Quest', daily: 'Daily', event: 'Event', guide: 'Guide', weekly: 'Weekly' };

export class QuestTracker {
  constructor(ui, parent) {
    this.ui = ui;
    const el = this.el = h('div', 'ss-qt', parent);
    const hd = h('div', 'ss-qt-hd', el);
    h('span', 'ss-qt-title', hd, 'Quests');
    this.count = h('span', 'ss-qt-count', hd);
    this.tog = btn('ss-qt-tog', hd, null, () => this.collapse(!this.collapsed), 'Collapse quest tracker');
    this.tog.innerHTML = glyph('up');
    this.list = h('div', 'ss-qt-list', el);
    this.nodes = new Map();
    this.collapsed = false;
  }
  collapse(on) {
    this.collapsed = on;
    setCls(this.el, 'is-collapsed', on);
    this.tog.innerHTML = glyph(on ? 'down' : 'up');
    this.tog.setAttribute('aria-label', on ? 'Expand quest tracker' : 'Collapse quest tracker');
  }
  update(quests) {
    const list = quests || [];
    show(this.el, list.length > 0);
    setText(this.count, list.length ? list.length : '');
    const seen = new Set();
    let prev = null;
    for (const q of list) {
      seen.add(q.id);
      let n = this.nodes.get(q.id);
      if (!n) {
        const el = h('div', 'ss-q ss-ptr');
        el.setAttribute('role', 'button');
        const t = h('div', 'ss-q-t', el);
        const mark = h('i', 'ss-q-mark', t);
        const title = h('span', '', t);
        const steps = h('div', 'ss-q-steps', el);
        n = { el, mark, title, steps, rows: [], id: q.id };
        el.addEventListener('click', () => this.ui.emit('hud:quest', { id: q.id }));
        el._tip = () => ({ title: q.title, lines: [KIND[n.kind] || 'Quest', 'Click to track on the map.'] });
        this.nodes.set(q.id, n);
        replay(el, 'is-new');
      }
      // keep DOM order equal to list order
      const want = prev ? prev.el.nextSibling : this.list.firstChild;
      if (want !== n.el) this.list.insertBefore(n.el, want);
      prev = n;
      n.kind = q.kind || 'side';
      n.el.dataset.kind = n.kind;
      setText(n.title, q.title || '');
      const steps = q.steps || [];
      while (n.rows.length < steps.length) {
        const r = h('div', 'ss-q-s', n.steps);
        r._t = h('span', 'ss-q-st', r); r._n = h('span', 'ss-q-sn', r);
        n.rows.push(r);
      }
      let all = steps.length > 0;
      for (let i = 0; i < n.rows.length; i++) {
        const r = n.rows[i], s = steps[i];
        show(r, !!s);
        if (!s) continue;
        setText(r._t, s.text || '');
        const cnt = s.need > 1 ? `${Math.min(s.n || 0, s.need)}/${s.need}` : '';
        if (r._n._t !== cnt && r._n._t) replay(r, 'is-tick');
        setText(r._n, cnt);
        const done = !!s.done || (s.need > 0 && (s.n || 0) >= s.need);
        if (done && r._done === false) replay(r, 'is-done-now');
        r._done = done;
        setCls(r, 'is-done', done);
        if (!done) all = false;
      }
      setCls(n.el, 'is-complete', all);
    }
    for (const [id, n] of this.nodes) if (!seen.has(id)) { n.el.remove(); this.nodes.delete(id); }
  }
}
