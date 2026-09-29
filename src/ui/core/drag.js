// Pointer drag & drop for items and skills. A source gets draggable(el, () => payload); any element (or ancestor)
// with `el._drop = payload => (fn | null)` is a drop target — return a function to accept, null to refuse.
//   payload: { type: 'item', item } | { type: 'skill', skill } | { type: 'slot', key, skill }  (+ icon for the ghost)
// A drag starts after 6 px of movement, so plain clicks and right-clicks keep working.
import { h } from './util.js';
import { iconUrl } from './icon.js';

let ui = null, ghost = null, active = null, over = null;
export function initDrag(u) { ui = u; }
export function draggable(el, getPayload) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !ui) return;
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let started = false;
    const move = ev => {
      if (ev.pointerId !== pid) return;
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        const p = getPayload();
        if (!p) return end();
        started = true; active = p;
        ui.tip.hide();
        ghost = h('div', 'ss-drag', ui.layers.top);
        ghost.style.backgroundImage = `url("${iconUrl(p.icon || p.item?.icon || p.skill?.icon, 48, p.type === 'item' ? { bare: true } : undefined)}")`;
        if (p.item) ghost.classList.add('ss-g' + (p.item.grade | 0));
        ui.root.classList.add('is-dragging');
      }
      const s = ui.scale;
      ghost.style.transform = `translate(${ev.clientX / s - 24}px, ${ev.clientY / s - 24}px)`;
      const t = target(ev.clientX, ev.clientY);
      if (t !== over) { if (over) over.el.classList.remove('is-drop'); over = t; if (over) over.el.classList.add('is-drop'); }
    };
    const end = ev => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
      if (!started) return;
      const t = ev && ev.type === 'pointerup' ? target(ev.clientX, ev.clientY) : null;
      if (over) over.el.classList.remove('is-drop');
      over = null; ghost?.remove(); ghost = null; ui.root.classList.remove('is-dragging');
      const p = active; active = null;
      if (t) t.fn(p);
      // swallow the click that follows a drag (and only that one)
      const swallow = ce => { ce.stopPropagation(); ce.preventDefault(); };
      addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => removeEventListener('click', swallow, true), 0);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  });
}
function target(x, y) {
  let n = document.elementFromPoint(x, y);
  while (n && n !== document.body) {
    if (n._drop) { const fn = n._drop(active); return fn ? { el: n, fn } : null; }
    n = n.parentElement;
  }
  return null;
}
export const isDragging = () => !!active;
