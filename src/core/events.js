// Tiny synchronous event bus. Game systems emit; UI, FX, audio, net and the combat log listen.
export class Emitter {
  constructor() { this.h = new Map(); }
  on(type, fn) { let a = this.h.get(type); if (!a) this.h.set(type, a = []); a.push(fn); return () => this.off(type, fn); }
  once(type, fn) { const off = this.on(type, (...a) => { off(); fn(...a); }); return off; }
  off(type, fn) { const a = this.h.get(type); if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  emit(type, ev) {
    const a = this.h.get(type);
    if (a) for (let i = 0; i < a.length; i++) { try { a[i](ev); } catch (e) { console.error(`[event ${type}]`, e); } }
    const any = this.h.get('*');
    if (any) for (let i = 0; i < any.length; i++) { try { any[i](type, ev); } catch (e) { console.error('[event *]', e); } }
  }
}
