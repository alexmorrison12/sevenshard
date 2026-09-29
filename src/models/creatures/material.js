// Creature material (copy of kit/material.js with SEVENSHARD extras; own program key so the kit's stays untouched).
// Stylized lambert + rest-space triplanar painted detail (fur / scales / mottle / weave), per-vertex emissive,
// hackle raise, candle-flame flicker (aux.y < 0), hit tint, plus:
//   uGlow      emissive multiplier (enrage / charge-up pulses; 1 = authored)
//   uDissolve  0..1 burn-away with ember edges (death clean-up, spawn-in reversed)
//   uFlame     0 = flames out (discards flame verts)
import * as THREE from 'three';
import { lambert } from '../../engine/materials.js';
import { detailTexture } from '../kit/material.js';

export { detailTexture };

const VERT_PARS = /* glsl */`
attribute vec4 dtl; attribute vec2 aux;
varying vec4 vDtl; varying float vEmis; varying float vFlame; varying vec3 vRP; varying vec3 vRN;
uniform float uHackle; uniform float uFlame; uniform float uFlameAmp;
`;
const VERT_BODY = /* glsl */`
vRP = position; vRN = normal; vDtl = dtl; vEmis = aux.x; vFlame = 0.0;
if ( aux.y > 0.0 ) {
  transformed.y += aux.y * uHackle * 0.05;
} else if ( aux.y < 0.0 ) {
  float f = -aux.y * uFlameAmp; vFlame = 1.0;
  float t = uTime + position.x * 3.1 + position.z * 2.3;
  transformed.x += ( sin( t * 9.0 + position.y * 40.0 ) * 0.6 + sin( t * 17.3 ) * 0.4 ) * 0.012 * f;
  transformed.z += cos( t * 11.0 + position.y * 35.0 ) * 0.009 * f;
  transformed.y += ( sin( t * 13.0 ) * 0.5 + 0.5 ) * 0.015 * f;
}
`;
const FRAG_PARS = /* glsl */`
varying vec4 vDtl; varying float vEmis; varying float vFlame; varying vec3 vRP; varying vec3 vRN;
uniform sampler2D uDetail; uniform float uDFreq; uniform float uFurAxis; uniform vec3 uTint; uniform float uTintAmt; uniform float uFlame;
uniform float uEmisK; uniform vec3 uColorMul; uniform float uGlow; uniform float uDissolve; uniform vec3 uDissolveCol; uniform vec3 uGlowCol; uniform float uGlowAdd;
float gDis = 0.0;
`;
const FRAG_DETAIL = /* glsl */`
#include <color_fragment>
{
  if ( vFlame > 0.5 && uFlame < 0.02 ) discard;
  vec3 an = abs( normalize( vRN ) ); vec3 bw = an * an; bw *= bw; bw /= ( bw.x + bw.y + bw.z );
  vec3 P = vRP * uDFreq;
  vec4 tX = texture2D( uDetail, mix( P.zy, P.yz, uFurAxis ) );
  vec4 tY = texture2D( uDetail, P.zx );
  vec4 tZ = texture2D( uDetail, P.yx );
  vec4 tt = tX * bw.x + tY * bw.y + tZ * bw.z;
  diffuseColor.rgb *= max( 0.0, 1.0 + dot( tt - 0.5, vDtl ) * 2.0 ) * uColorMul;
  if ( uDissolve > 0.0 ) {
    // burn from the top down-ish with a noisy front (rest-space so it sticks to the body)
    vec3 Q = vRP * 1.7;
    vec4 n2 = texture2D( uDetail, Q.xz + Q.y * 0.37 ) * 0.5 + texture2D( uDetail, Q.zy * 1.9 ) * 0.5;
    float h = n2.b * 0.75 + n2.g * 0.25;
    float thr = uDissolve * 1.25 - 0.1;
    if ( h < thr ) discard;
    gDis = 1.0 - smoothstep( 0.0, 0.09, h - thr );
  }
}
`;
const FRAG_EMIS = /* glsl */`
#include <emissivemap_fragment>
{
  float fl = vFlame > 0.5 ? uFlame * ( 0.85 + 0.15 * sin( uTime * 23.0 ) * sin( uTime * 7.3 + 1.0 ) ) : 1.0;
  totalEmissiveRadiance += vColor.rgb * vEmis * uEmisK * uGlow * fl;
  totalEmissiveRadiance += uGlowCol * uGlowAdd;
  totalEmissiveRadiance += uDissolveCol * gDis * 6.0;
}
`;

/** One material per creature instance (all share one GL program). cfg: dfreq, furAxis (0 quadruped, 1 upright), wrap, rim */
export function creatureMaterial(cfg = {}) {
  const u = {
    uTint: { value: new THREE.Color(1, 1, 1) }, uTintAmt: { value: 0 },
    uHackle: { value: 0 }, uFlame: { value: 1 }, uFlameAmp: { value: cfg.flameAmp ?? 1 }, uEmisK: { value: 1 }, uColorMul: { value: new THREE.Color(1, 1, 1) },
    uDetail: { value: detailTexture() }, uDFreq: { value: cfg.dfreq ?? 3.0 }, uFurAxis: { value: cfg.furAxis ?? 0 },
    uGlow: { value: 1 }, uGlowCol: { value: new THREE.Color(0, 0, 0) }, uGlowAdd: { value: 0 },
    uDissolve: { value: 0 }, uDissolveCol: { value: new THREE.Color(cfg.dissolveCol ?? 0xff6a1a) },
  };
  const m = lambert({ vertexColors: true }, {
    key: 'sevenshard-creature', wrap: cfg.wrap ?? 0.5, rim: cfg.rim ?? 0.28, rimColor: cfg.rimColor ?? 0xfff2dc, spec: cfg.spec ?? 0, shine: cfg.shine ?? 24, uniforms: u,
    cacheKey: cfg.spec ? ':spec' : '',
    vertex: vs => vs.replace('#include <common>', '#include <common>\n' + VERT_PARS).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY),
    fragment: fs => fs.replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <color_fragment>', FRAG_DETAIL)
      .replace('#include <emissivemap_fragment>', FRAG_EMIS)
      .replace('#include <opaque_fragment>', 'outgoingLight = mix( outgoingLight, uTint, uTintAmt );\n#include <opaque_fragment>'),
  });
  return m;
}
