// Ground decals: cracks, rubble, leaves, puddles, moss, blood, scorch, stains, rune circles, pebbles, petals, drain
// grates, glowing fissures, frost, straw, sun-emblem inlays. All decals of a zone merge into ONE mesh whose small
// grids hug the heightfield. They carry their own normals (cracks read as grooves under a low sun) and emissive.
//   const d = new Decals(heightAt); d.add('cracks', x, z, { size, rot, alpha, tint, emit }); zone.root.add(d.build())
import * as THREE from 'three';
import { lambert, G } from '../engine/materials.js';
import { linColor } from '../engine/geom.js';
import { decalAtlas } from './textures.js';

export class Decals {
  constructor(heightAt) { this.heightAt = heightAt; this.list = []; }
  add(kind, x, z, { size = 2, rot = Math.random() * Math.PI * 2, alpha = 1, tint = 0xffffff, emit = 0x000000, emitI = 0, lift = 0.03, sx = 1, sz = 1 } = {}) {
    this.list.push({ kind, x, z, size, rot, alpha, tint, emit, emitI, lift, sx, sz });
  }
  build() {
    if (!this.list.length) return null;
    const A = decalAtlas();
    const pos = [], uv = [], tint = [], emit = [], tan = [], idx = [];
    for (const d of this.list) {
      const N = Math.max(4, Math.min(28, Math.ceil(d.size * Math.max(d.sx, d.sz) / 1.2))); // grid hugs the ground
      const slot = A.slots[d.kind] ?? 0;
      const su = (slot % 4) / 4, sv = Math.floor(slot / 4) / 4;
      const c = Math.cos(d.rot), s = Math.sin(d.rot);
      const tc = linColor(d.tint), ec = linColor(d.emit);
      const base = pos.length / 3;
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const u = i / N, v = j / N;
        const lx = (u - 0.5) * d.size * d.sx, lz = (v - 0.5) * d.size * d.sz;
        const x = d.x + lx * c + lz * s, z = d.z - lx * s + lz * c;
        pos.push(x, this.heightAt(x, z) + d.lift, z);
        uv.push(su + (0.004 + u * 0.992) / 4, sv + (0.004 + v * 0.992) / 4);
        tint.push(tc[0], tc[1], tc[2], d.alpha);
        emit.push(ec[0] * d.emitI, ec[1] * d.emitI, ec[2] * d.emitI);
        tan.push(c, -s);
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = base + j * (N + 1) + i, b = a + 1, cc = a + N + 1, dd = cc + 1;
        idx.push(a, cc, dd, a, dd, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('dtint', new THREE.Float32BufferAttribute(tint, 4));
    g.setAttribute('demit', new THREE.Float32BufferAttribute(emit, 3));
    g.setAttribute('dtan', new THREE.Float32BufferAttribute(tan, 2));
    g.setIndex(idx); g.computeBoundingSphere();
    const mat = lambert({ color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, {
      wrap: 0.3, spec: 0.8, shine: 70, key: 'decals', uniforms: { uAtlas: { value: A.map }, uAtlasN: { value: A.normal } },
      vertex: vs => vs.replace('#include <common>', '#include <common>\nattribute vec4 dtint; attribute vec3 demit; attribute vec2 dtan;\nvarying vec4 vTint; varying vec3 vEmit; varying vec2 vTan; varying vec2 vDUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = dtint; vEmit = demit; vTan = dtan; vDUv = uv;'),
      fragment: fs => fs.replace('#include <common>', '#include <common>\nuniform sampler2D uAtlas; uniform sampler2D uAtlasN;\nvarying vec4 vTint; varying vec3 vEmit; varying vec2 vTan; varying vec2 vDUv;\nfloat gSpecMask = 0.0; vec4 gDN;')
        .replace('if ( uSpec > 0.0 ) {', 'if ( uSpec * gSpecMask > 0.0 ) {')
        .replace('* uSpec * saturate( nl * 4.0 );', '* uSpec * gSpecMask * saturate( nl * 4.0 );')
        .replace('#include <map_fragment>', `
vec4 dt = texture2D(uAtlas, vDUv);
gDN = texture2D(uAtlasN, vDUv);
diffuseColor.rgb *= dt.rgb * vTint.rgb * mix(0.6, 1.0, gDN.z);
diffuseColor.a *= dt.a * vTint.a;
if (diffuseColor.a < 0.01) discard;
totalEmissiveRadiance += vEmit * gDN.w;
gSpecMask = gDN.w * step(dot(vEmit, vEmit), 0.0001) * 1.8;`)
        .replace('#include <normal_fragment_maps>', `
{ vec2 n2 = gDN.xy * 2.0 - 1.0;
  vec3 T = vec3(vTan.x, 0.0, vTan.y), B = vec3(-vTan.y, 0.0, vTan.x);
  vec3 nw = normalize(T * n2.x + B * n2.y + vec3(0.0, 1.0, 0.0));
  normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }`),
    });
    const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.renderOrder = 2; mesh.name = 'decals';
    return mesh;
  }
}
