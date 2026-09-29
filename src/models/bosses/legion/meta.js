// Boss metadata helpers.
/** BOSSES entry derived from a boss definition (pure data). */
export function metaOf(id, def) {
  const actions = {};
  for (const [name, a] of Object.entries(def.actions)) {
    const m = { dur: a.dur, hits: (a.hits || []).slice() };
    for (const k of ['counter', 'active', 'move', 'loop', 'hold', 'stretch', 'sustain']) if (a[k] !== undefined) m[k] = Array.isArray(a[k]) ? JSON.parse(JSON.stringify(a[k])) : a[k];
    actions[name] = m;
  }
  return { name: def.meta.name, title: def.meta.title, height: def.meta.height, radius: def.meta.radius, walkSpeed: def.meta.walkSpeed, runSpeed: def.meta.runSpeed, actions };
}

// Timing metadata for bosses whose models are still being built (index.js serves a stand-in model for them).
// Once a boss definition is registered, BOSSES[id] is derived from the definition itself.
const L = (dur, hits = [], extra = {}) => ({ dur, hits, ...extra });

export const PLACEHOLDER_META = {
  skarn: {
    name: 'Skarn', title: 'the Cinder Hound', height: 4.0, radius: 2.4, walkSpeed: 3.5, runSpeed: 11,
    actions: {
      idle: L(3), walk: L(0.9, [0, 0.45]), run: L(0.55, [0, 0.27]), intro: L(4.5, [1.2, 3.0]), bite: L(1.3, [0.62]), claw_swipe: L(1.4, [0.7]),
      pounce: L(2.2, [1.25], { move: [{ t: [0.55, 1.25], dist: 'target' }] }), breath: L(3.4, [1.1, 1.6, 2.1, 2.6], { active: [[1.0, 2.8]] }), howl: L(2.6, [1.0]),
      tail_whip: L(1.5, [0.75]), spin_attack: L(2.0, [0.8, 1.2]), charge: L(3.0, [1.1], { active: [[0.9, 2.3]], move: [{ t: [0.9, 2.3], dist: 16 }] }),
      groggy: L(5, [], { sustain: [1.0, 4.0] }), death: L(3.6, [1.8], { hold: true }),
    },
  },
  vesk: {
    name: 'Vesk', title: 'the Void Hound', height: 4.0, radius: 2.4, walkSpeed: 3.5, runSpeed: 11,
    actions: {
      idle: L(3), walk: L(0.9, [0, 0.45]), run: L(0.55, [0, 0.27]), intro: L(4.5, [1.2, 3.0]), bite: L(1.3, [0.62]), claw_swipe: L(1.4, [0.7]),
      pounce: L(2.2, [1.25], { move: [{ t: [0.55, 1.25], dist: 'target' }] }), breath: L(3.4, [1.1, 1.6, 2.1, 2.6], { active: [[1.0, 2.8]] }), howl: L(2.6, [1.0]),
      tail_whip: L(1.5, [0.75]), spin_attack: L(2.0, [0.8, 1.2]), charge: L(3.0, [1.1], { active: [[0.9, 2.3]], move: [{ t: [0.9, 2.3], dist: 16 }] }),
      groggy: L(5, [], { sustain: [1.0, 4.0] }), death: L(3.6, [1.8], { hold: true }),
    },
  },
  varkhul: {
    name: 'Varkhul', title: 'the Ravager', height: 3.5, radius: 1.3, walkSpeed: 2.4, runSpeed: 7,
    actions: {
      idle: L(3), walk: L(1.0, [0, 0.5]), run: L(0.65, [0, 0.32]), intro: L(5, [1.4, 3.4]), slash_combo: L(2.6, [0.55, 1.15, 1.9]), overhead: L(2.2, [1.2]),
      fire_wave: L(2.6, [1.35], { active: [[1.35, 2.2]] }), leap: L(2.6, [1.6], { move: [{ t: [0.6, 1.55], dist: 'target' }] }), summon: L(3.0, [1.8]), roar: L(2.4, [0.9]),
      groggy: L(5, [], { sustain: [1.0, 4.0] }), death: L(4.0, [1.5, 2.8], { hold: true }),
    },
  },
  ashmaw: {
    name: 'Ashmaw', title: 'the Siege Behemoth', height: 15, radius: 6, walkSpeed: 2.2, runSpeed: 3,
    actions: {
      idle: L(5), walk: L(2.6, [0, 1.3]), slam_wall: L(4.2, [2.3]), roar: L(4.0, [1.4]), breath: L(5.0, [1.8, 2.6, 3.4], { active: [[1.6, 4.0]] }),
      hit: L(1.2, []), death: L(6.0, [2.2, 4.0], { hold: true }),
    },
  },
  gatekeeper: {
    name: 'Gatekeeper', title: 'Warden of the Chaos Gate', height: 4.0, radius: 1.6, walkSpeed: 2.2, runSpeed: 6,
    actions: {
      idle: L(3), walk: L(1.1, [0, 0.55]), intro: L(4.0, [1.2, 2.8]), bash: L(1.8, [0.9]), spin: L(2.8, [0.9, 1.4, 1.9], { active: [[0.8, 2.1]] }),
      summon: L(2.8, [1.6]), groggy: L(5, [], { sustain: [1.0, 4.0] }), death: L(3.8, [1.6, 2.6], { hold: true }),
    },
  },
};
