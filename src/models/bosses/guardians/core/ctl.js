// Guardian animation controller.
// Frame: channels reset → action pre-pass (actions drive state channels such as air / burrow / groggy / loco speed)
//        → state smoothing → gait update → base pose (spec.base: locomotion, idle, flight, groggy, burrow…)
//        → action pose deltas (def.fn, weighted) → spec.finish (channel-driven poses: jaw, wings…) → FK → leg IK
//        → spec.post → bones.
// Actions are authored in canonical seconds (BOSSES[id].actions[name].dur); play(name, {dur}) time-stretches them and
// scales the hit moments. Loop actions (def.loop) run their canonical cycle for `dur` real seconds (or until stopped).
import { clamp01 } from '../../../kit/rig.js';
import { Gait } from './gait.js';

const LOCO = new Set(['idle', 'walk', 'run', 'turn']);
// per-frame channels (reset every frame; actions and base layers combine into them with max / min / mix)
const CH_DEFAULT = { jaw: 0, throat: 0, eye: 1, flame: 1, flash: 0, groggy: 0, air: -1, burrow: -1, locoSpeed: 0, locoTurn: 0, locoMul: 1, altMul: 1, pitchAir: 0, heat: 0, sing: 0 };

export class BossCtl {
  constructor(boss, spec) {
    this.boss = boss; this.spec = spec;
    this.P = boss.pose; this.b = boss.pose.b;
    this.gait = spec.gait ? new Gait(this.P, spec.gait) : null;
    this.acts = [];
    this.t = Math.random() * 50;
    this.dead = false; this._sd = false;
    // smoothed state (0..1 unless noted)
    this.speed = 0; this.turn = 0; this.fly = 0; this.burrow = 0; this.groggy = 0; this.enrage = 0; this.ghost = 0;
    this.airLatch = 0; this.burrowLatch = 0; this.selfLift = true; this.liftK = 1;
    this.st = {};
    this.ch = { ...CH_DEFAULT };
    this.locoW = 1;
    this.broken = new Set();
    this.hitFlags = null;
    this.onEvent = null;           // (name, info) — footsteps / action events for FX & audio hooks
    if (spec.init) spec.init(this);
  }

  def(name) { const a = this.spec.aliases?.[name]; return this.spec.actions[a || name]; }
  has(name) { return this.acts.some(a => a.name === name && !a.out); }
  weight(name) { let w = 0; for (const a of this.acts) if (a.name === name) w = Math.max(w, a.w); return w; }
  active() { for (let i = this.acts.length - 1; i >= 0; i--) if (!this.acts[i].out) return this.acts[i]; return null; }

  play(name, opts = {}) {
    const d = this.def(name);
    if (!d) return { dur: 0, hits: [] };
    if (this.dead && name !== 'death') return { dur: 0, hits: [] };
    if (name === 'idle') { this.stop(); return { dur: d.dur, hits: [] }; }
    const reqDur = opts.dur > 0 ? opts.dur : null;
    if (name === 'death') { this.dead = true; for (const a of this.acts) a.out = true; }
    else if (!d.overlay) for (const a of this.acts) if (!a.def.overlay) a.out = true;
    const loop = !!d.loop;
    const speed = loop ? 1 : (reqDur ? d.dur / reqDur : 1);
    name = this.spec.aliases?.[name] || name;
    const inst = { name, def: d, t: 0, el: 0, speed, w: 0, out: false, outT: 0, until: loop ? (reqDur ?? Infinity) : Infinity, seed: Math.random() * 100, k: 0, fired: {}, dur: reqDur ?? d.dur };
    this.acts.push(inst);
    if (d.start) d.start(this, inst);
    const scale = reqDur && !loop ? reqDur / d.dur : 1;
    let hits = (d.hits || []).map(h => h * scale);
    if (loop && d.hits && d.hits.length && reqDur) { // repeat the cycle's hits over the requested duration
      hits = [];
      for (let c = 0; c * d.dur < reqDur; c++) for (const h of d.hits) { const t = c * d.dur + h; if (t < reqDur) hits.push(t); }
    }
    return { dur: reqDur ?? d.dur, hits };
  }
  stop(name) { for (const a of this.acts) if ((!name || a.name === name) && a.name !== 'death') a.out = true; }
  revive() { this.dead = false; this.acts.length = 0; this.airLatch = 0; this.burrowLatch = 0; if (this.gait) this.gait.resetFeet(); }

  _advance(dt) {
    for (const a of this.acts) {
      const d = a.def, D = d.dur;
      a.el += dt; a.t += dt * a.speed;
      if (d.loop) {
        a.k = (a.t % D) / D;
        if (a.el >= a.until && !a.out) a.out = true;
      } else if (d.hold) { if (a.t > D) a.t = D; a.k = a.t / D; }
      else { a.k = Math.min(1, a.t / D); if (a.t >= D && !a.out) a.done = true; }
      const fin = (d.fin ?? 0.15), fout = d.fout ?? 0.3;
      let w = fin > 0 ? clamp01(a.t / fin) : 1;
      if (!d.loop && !d.hold && fout > 0) w = Math.min(w, clamp01((D - a.t) / fout));
      if (a.out) { if (a.w0 === undefined) a.w0 = a.w; a.outT += dt; w = a.w0 * (1 - clamp01(a.outT / (d.fadeOut ?? 0.3))); if (w <= 0.001) a.done = true; }
      a.w = w;
    }
    let j = 0;
    for (let i = 0; i < this.acts.length; i++) { const a = this.acts[i]; if (!a.done) this.acts[j++] = a; else if (a.def.end) a.def.end(this, a); }
    this.acts.length = j;
  }

  update(dt, st = {}) {
    if (!(dt > 0)) return false;               // dt = 0 → hold the pose (hit-stop)
    dt = Math.min(dt, 0.1);
    const spec = this.spec, P = this.P;
    this.st = st; this.t += dt;
    // death / revive edges
    if (st.dead && !this.dead) this.play('death');
    if (this._sd && !st.dead && this.dead) this.revive();
    this._sd = !!st.dead;
    this._advance(dt);
    // channels
    const ch = this.ch;
    for (const k in ch) ch[k] = 0;
    Object.assign(ch, CH_DEFAULT);
    if (spec.channels) spec.channels(this, ch);
    for (const a of this.acts) if (a.def.pre && a.w > 0) a.def.pre(this, a, a.w);
    // latches set by takeoff / burrow actions drop on a state 1 → 0 edge
    const sf = st.fly ?? 0, sb = st.burrowed ?? 0;
    if (this._pf > 0.5 && sf <= 0.5) this.airLatch = 0;
    if (this._pb > 0.5 && sb <= 0.5) this.burrowLatch = 0;
    this._pf = sf; this._pb = sb;
    // state smoothing
    const k = (r) => 1 - Math.exp(-r * dt);
    const dead = this.dead;
    let speed = dead ? 0 : (st.speed ?? 0), turn = dead ? 0 : (st.turn ?? 0);
    if (Math.abs(ch.locoSpeed) > Math.abs(speed)) speed = ch.locoSpeed;
    if (Math.abs(ch.locoTurn) > Math.abs(turn)) turn = ch.locoTurn;
    this.speed += (speed - this.speed) * k(5); this.turn += (turn - this.turn) * k(4);
    const flyT = ch.air >= 0 ? ch.air : Math.max(st.fly ?? 0, this.airLatch);
    this.fly += (clamp01(flyT) - this.fly) * (ch.air >= 0 ? 1 : k(2.2));
    this.liftK += ((this.selfLift ? 1 : 0) - this.liftK) * k(2.5);      // external root lift → pose only
    const burT = ch.burrow >= 0 ? ch.burrow : Math.max(st.burrowed ?? 0, this.burrowLatch);
    this.burrow += (clamp01(burT) - this.burrow) * (ch.burrow >= 0 ? 1 : k(2.5));
    this.groggy += (Math.max(st.groggy ? 1 : 0, ch.groggy) - this.groggy) * k(3);
    this.enrage += ((st.enraged ? 1 : 0) - this.enrage) * k(2);
    this.ghost += ((typeof st.ghost === 'number' ? st.ghost : st.ghost ? 1 : 0) - this.ghost) * k(3);
    // locomotion
    this.locoW = (1 - clamp01(this.burrow * 1.5)) * (dead ? 0 : 1) * ch.locoMul;
    P.reset();
    if (this.gait) {
      this.gait.update(dt, this.speed * this.locoW, this.turn * this.locoW);
      this.gait.adaptBody(dt);
      for (const L of this.gait.legs) L.ikW = 1;
    }
    spec.base(this, dt);
    for (const a of this.acts) if (a.w > 0 && a.def.fn) a.def.fn(this, a, a.w);
    if (spec.finish) spec.finish(this, dt);
    const brk = this.boss.entry.def.breakable;
    if (brk) for (const [name, bp] of Object.entries(brk)) {
      const on = this.broken.has(name);
      if (on && bp.bone) P.sc[P.b[bp.bone]].setScalar(0);
      if (bp.stump) P.sc[P.b[bp.stump]].setScalar(on ? 1 : 0);
    }
    P.fk();
    if (this.gait) this.gait.solve(P, { air: 0 });
    if (spec.post) spec.post(this, dt);
    P.apply(this.boss.bones);
    // action events (hit moments) for hooks
    if (this.onEvent) for (const a of this.acts) {
      const hs = a.def.hits; if (!hs || a.out) continue;
      for (let i = 0; i < hs.length; i++) {
        const key = 'h' + i + (a.def.loop ? ':' + Math.floor(a.t / a.def.dur) : '');
        const th = a.def.loop ? (a.t % a.def.dur) : a.t;
        if (!a.fired[key] && th >= hs[i]) { a.fired[key] = 1; this.onEvent('hit', { action: a.name, index: i }); }
      }
    }
    return true;
  }
}

export { LOCO };
