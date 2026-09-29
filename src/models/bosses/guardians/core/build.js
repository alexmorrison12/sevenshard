// Builds (and caches) a guardian's geometry: rig → SDF sculpt (kit Sculpt: surface nets, skin weights, baked AO,
// painted vertex colours) → rigid / membrane / flame parts → up to three skinned geometries sharing one skeleton.
import * as THREE from 'three';
import { Rig } from '../../../kit/rig.js';
import { Sculpt } from '../../../kit/sdf.js';
import { BossAcc } from './acc.js';

const CACHE = new Map();

export function buildEntry(id, def, opts = {}) {
  const t0 = performance.now();
  const cfg = def.config ? def.config(opts) : {};
  const rig = new Rig();
  def.rig(rig, cfg);
  const S = new Sculpt(rig);
  def.sculpt(S, cfg);
  const acc = new BossAcc();
  const paint = (v) => {
    v.kind = 0; v.part = 0; v.gm = 1; v.u = 0; v.vv = 0;
    if (def.paint) def.paint(v, cfg);
    const c = acc.cur; c.kind = v.kind; c.part = v.part; c.gm = v.gm; c.u = v.u; c.v = v.vv;
  };
  const mcfg = {
    h: cfg.h ?? 0.07, hg: cfg.hg, paint,
    ao: cfg.ao ?? { dist: 0.09, str: 0.8 },
    grad: cfg.grad ?? { top: 0.14, bottom: 0.3, y0: 0, y1: 2, low: 0.18 },
    dtl: cfg.dtl ?? [0, 0.3, 0.25, 0], smoothW: cfg.smoothW ?? 2,
  };
  const st = S.mesh(acc, mcfg);
  acc.cur = { gm: 1, kind: 0, part: 0, u: 0, v: 0 };
  const sdfVerts = acc.count;
  const macc = new BossAcc(), facc = new BossAcc();
  const tp = performance.now();
  if (def.dress) def.dress({ acc, macc, facc, S, rig, cfg, b: (n) => rig.index(n) });
  const tParts = performance.now() - tp;
  const geos = { body: acc.build(), membrane: macc.count ? macc.build() : null, flame: facc.count ? facc.build() : null };
  const boneInverses = rig.bones.map(b => new THREE.Matrix4().makeTranslation(-b.rest.x, -b.rest.y, -b.rest.z));
  const bb = geos.body.boundingBox.clone();
  if (geos.membrane) bb.union(geos.membrane.boundingBox);
  const sphere = new THREE.Sphere(); bb.getBoundingSphere(sphere); sphere.radius *= cfg.boundsMul ?? 1.6;
  const sockets = {};
  for (const [name, s] of Object.entries(def.sockets || {})) sockets[name] = { bone: rig.index(s[0]), pos: new THREE.Vector3(...s[1]), rot: s[2] || null };
  let tris = 0; for (const g of Object.values(geos)) if (g) tris += g.index.count / 3;
  const entry = {
    id, def, cfg, rig, geos, boneInverses, sockets, sphere, bb,
    stats: {
      ms: +(performance.now() - t0).toFixed(1), sdfMs: +st.ms.toFixed(1), partsMs: +tParts.toFixed(1), sdfVerts,
      verts: Object.values(geos).reduce((s, g) => s + (g ? g.attributes.position.count : 0), 0), tris, bones: rig.bones.length,
      t: st.t,
    },
  };
  return entry;
}

export function getEntry(id, def, opts = {}) {
  const key = id + (def.cacheKey ? ':' + def.cacheKey(opts) : '');
  let e = CACHE.get(key);
  if (!e) { e = buildEntry(id, def, opts); CACHE.set(key, e); }
  return e;
}

export function disposeCache() {
  for (const e of CACHE.values()) for (const g of Object.values(e.geos)) if (g) g.dispose();
  CACHE.clear();
}
export function cacheStats() { return [...CACHE.entries()].map(([k, e]) => ({ key: k, ...e.stats })); }
