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
