// Guardian material: the shared stylised lambert (engine/materials.js) + boss features, one GL program per variant:
//   rest-space triplanar detail (kit detail atlas: fur / scales / mottle / weave, weighted per vertex by `dtl`),
//   per-vertex emissive (aux.x) tinted towards the boss glow colour (aux.y), surface kinds (aux.z: see core/acc.js K),
//   crystal fresnel + sparkle, membrane veins + translucency + billow, flame flicker, lava flow, eye / throat glow,
//   combat highlights: 'counter' (shimmering blue), 'enrage' (hot red rim + boiling glow), 'ghost' (translucent),
//   hit / freeze tint. Per-instance uniforms are shared by every material of one boss (body, membranes, flames).
import * as THREE from 'three';
import { lambert } from '../../../../engine/materials.js';
import { detailTexture } from '../../../kit/material.js';

const VERT_PARS = /* glsl */`
attribute vec4 dtl; attribute vec4 aux;
varying vec4 vDtl; varying vec4 vAux; varying vec3 vRP; varying vec3 vRN; varying vec2 vUv2; flat varying float vKind;
uniform vec2 uBillow; uniform float uFlameAmp;
`;
const VERT_BODY = /* glsl */`
vRP = position; vRN = normal; vDtl = dtl; vAux = aux; vUv2 = uv; vKind = aux.z;
{
  float kind = floor( aux.z + 0.5 );
  if ( abs( kind - 3.0 ) < 0.5 ) {           // membrane billow (along the normal, per side)
    float b = sin( clamp( uv.x, 0.0, 1.0 ) * 3.14159 ) * sin( clamp( uv.y, 0.0, 1.0 ) * 3.14159 );
    transformed += normal * b * ( position.x < 0.0 ? uBillow.x : uBillow.y );
  } else if ( abs( kind - 4.0 ) < 0.5 || abs( kind - 8.0 ) < 0.5 ) {    // flame / hair flicker (rest space)
    float f = clamp( uv.y, 0.0, 1.0 ); f *= f;
    float t = uTime * ( kind > 5.0 ? 0.35 : 1.0 );
    float a = uFlameAmp * ( kind > 5.0 ? 0.6 : 1.0 );
    transformed.x += ( sin( t * 9.0 + position.y * 2.1 + position.z * 1.7 ) * 0.6 + sin( t * 15.3 + position.x * 3.0 ) * 0.4 ) * 0.07 * f * a;
    transformed.y += sin( t * 11.0 + position.z * 2.3 + position.x ) * 0.05 * f * a;
    transformed.z += cos( t * 10.0 + position.y * 2.5 ) * 0.06 * f * a;
  }
}
`;

const FRAG_PARS = /* glsl */`
varying vec4 vDtl; varying vec4 vAux; varying vec3 vRP; varying vec3 vRN; varying vec2 vUv2; flat varying float vKind;
uniform sampler2D uDetail; uniform float uDFreq; uniform vec3 uColorMul;
uniform vec3 uGlowCol; uniform vec3 uGlow2Col; uniform float uGlowK; uniform float uPulseF;
uniform float uCounter; uniform vec3 uCounterCol; uniform float uEnrage; uniform vec3 uEnrageCol;
uniform float uGhost; uniform vec3 uGhostCol; uniform vec3 uTint; uniform float uTintAmt;
uniform float uThroat; uniform float uEye; uniform float uFlame; uniform float uHeat; uniform float uMemGlow; uniform float uAlpha;
uniform vec3 uFlashCol; uniform float uFlash; uniform float uCrackF; float gCrack = 0.0;
float gSpecMask = 1.0; float gTransMask = 0.0; float gVein = 0.0; float gKind = 0.0; float gFlameA = 1.0;
float gH3( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
vec3 gHash3( vec3 p ) {
  p = vec3( dot( p, vec3( 127.1, 311.7, 74.7 ) ), dot( p, vec3( 269.5, 183.3, 246.1 ) ), dot( p, vec3( 113.5, 271.9, 124.6 ) ) );
  return fract( sin( p ) * 43758.5453 );
}
vec3 gVoro( vec3 x ) {   // (F1, F2, cell id)
  vec3 p = floor( x ), f = fract( x );
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for ( int k = -1; k <= 1; k++ ) for ( int j = -1; j <= 1; j++ ) for ( int i = -1; i <= 1; i++ ) {
    vec3 b = vec3( float( i ), float( j ), float( k ) );
    vec3 h = gHash3( p + b );
    vec3 r = b - f + h * 0.8 + 0.1;
    float d = dot( r, r );
    if ( d < d1 ) { d2 = d1; d1 = d; id = h.x; } else if ( d < d2 ) d2 = d;
  }
  return vec3( sqrt( d1 ), sqrt( d2 ), id );
}
float gNoise( vec3 p ) {
  vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  float a = gH3( i ), b = gH3( i + vec3( 1, 0, 0 ) ), c = gH3( i + vec3( 0, 1, 0 ) ), d = gH3( i + vec3( 1, 1, 0 ) );
  float e = gH3( i + vec3( 0, 0, 1 ) ), g = gH3( i + vec3( 1, 0, 1 ) ), h = gH3( i + vec3( 0, 1, 1 ) ), k = gH3( i + vec3( 1, 1, 1 ) );
  return mix( mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y ), mix( mix( e, g, f.x ), mix( h, k, f.x ), f.y ), f.z );
}
`;

const FRAG_COLOR = /* glsl */`
#include <color_fragment>
{
  float kind = floor( vKind + 0.5 ); gKind = kind;
  vec3 an = abs( vRN ) + 1e-4; vec3 bw = an * an; bw *= bw; bw /= ( bw.x + bw.y + bw.z );
  vec3 P = vRP * uDFreq;
  vec4 tX = texture2D( uDetail, P.zy ); vec4 tY = texture2D( uDetail, P.zx ); vec4 tZ = texture2D( uDetail, P.xy );
  vec4 tt = tX * bw.x + tY * bw.y + tZ * bw.z;
  diffuseColor.rgb *= max( 0.0, 1.0 + dot( tt - 0.5, vDtl ) * 2.0 ) * uColorMul;
  gSpecMask = kind < 0.5 ? 0.12 : kind < 1.5 ? 1.0 : kind < 2.5 ? 2.2 : kind < 3.5 ? 0.25 : kind < 4.5 ? 0.0 : kind < 5.5 ? 2.0 : kind < 6.5 ? 0.6 : kind < 7.5 ? 1.4 : kind < 8.5 ? 0.3 : 1.2;
  if ( abs( kind - 3.0 ) < 0.5 ) {
    // membrane: veins radiating from the bones, capillary net, frosted underside
    float u = vUv2.x, v = vUv2.y;
    float vein = 0.0;
    for ( int i = 1; i <= 3; i++ ) {
      float fi = float( i );
      float c = fi / 4.0 + 0.05 * sin( v * 3.14159 ) * ( fi - 2.0 ) + 0.012 * sin( v * 17.0 + fi * 4.0 );
      float w = 0.004 + 0.012 * ( 1.0 - v );
      vein = max( vein, 1.0 - smoothstep( w * 0.5, w, abs( u - c ) ) );
    }
    float cap = gNoise( vec3( u * 22.0, v * 14.0, 0.5 ) );
    cap = ( 1.0 - smoothstep( 0.0, 0.05, abs( cap - 0.5 ) ) ) * 0.3 * smoothstep( 0.15, 0.6, v );
    vein *= smoothstep( 0.02, 0.12, v );
    diffuseColor.rgb *= 1.0 - max( vein, cap ) * 0.4;
    gVein = vein;
    if ( !gl_FrontFacing ) diffuseColor.rgb *= 1.18;
    gTransMask = 1.0;
  } else if ( abs( kind - 4.0 ) < 0.5 ) {
    diffuseColor.rgb *= 0.25;
  } else if ( abs( kind - 7.0 ) < 0.5 ) {
    // obsidian plates: per-pixel voronoi plates with molten seams (crisp at any mesh density)
    vec3 vr = gVoro( vRP * uCrackF );
    float edge = vr.y - vr.x;
    float fw = length( fwidth( vRP * uCrackF ) );
    gCrack = ( 1.0 - smoothstep( 0.02, 0.07 + fw * 0.6, edge ) ) * step( 0.02, vAux.x );
    float dome = 1.0 - smoothstep( 0.0, 0.7, vr.x );
    diffuseColor.rgb *= ( 0.8 + 0.25 * dome + 0.12 * vr.z ) * ( 1.0 - 0.75 * gCrack );
  }
}
`;

const FRAG_EMIS = /* glsl */`
#include <emissivemap_fragment>
{
  vec3 Vd = normalize( vViewPosition );
  float fres = 1.0 - saturate( dot( normal, Vd ) );
  float kind = gKind;
  float pulse = 0.82 + 0.18 * sin( uTime * uPulseF + vRP.y * 0.7 + vRP.z * 0.45 );
  vec3 gcol = vAux.y >= 0.0 ? uGlowCol : uGlow2Col;
  gcol = mix( gcol, uEnrageCol * 0.6, uEnrage * 0.5 );
  vec3 ec = mix( vColor.rgb * 2.0, gcol, clamp( abs( vAux.y ), 0.0, 1.0 ) );
  float em = vAux.x * uGlowK * pulse * ( 1.0 + uEnrage * 0.6 );
  if ( abs( kind - 2.0 ) < 0.5 ) {           // crystal / ice: edge glow + sparkle
    vec3 cell = floor( vRP * 6.0 );
    float r = gH3( cell );
    float sp = step( 0.9, r ) * pow( 0.5 + 0.5 * sin( uTime * 4.0 + r * 60.0 ), 6.0 );
    em += ( fres * fres * 0.3 + sp * 1.2 ) * uGlowK * ( 0.15 + vAux.x );
  } else if ( abs( kind - 3.0 ) < 0.5 ) {    // membrane veins
    em += gVein * uMemGlow * uGlowK * pulse;
  } else if ( abs( kind - 4.0 ) < 0.5 ) {    // flame: licking tongues scrolling towards the tip, deep base → bright tips
    float f = clamp( vUv2.y, 0.0, 1.0 );
    float n = gNoise( vec3( vUv2.x * 7.0, f * 5.0 - uTime * 2.6, uTime * 0.7 + vRP.x * 0.3 ) ) * 0.65 + gNoise( vec3( vUv2.x * 15.0, f * 11.0 - uTime * 4.5, uTime ) ) * 0.35;
    float tongue = smoothstep( 0.25, 0.75, n + 0.55 - f * 0.75 );
    float fl = 0.85 + 0.15 * sin( uTime * 23.0 + vRP.x * 3.0 ) * sin( uTime * 7.3 + vRP.z * 2.0 );
    ec = mix( uGlowCol, uGlow2Col, smoothstep( 0.1, 1.0, f * 0.7 + n * 0.5 ) );
    em = vAux.x * uFlame * fl * uGlowK * ( 0.55 + 0.9 * tongue ) * ( 1.0 + uEnrage * 0.5 );
    gFlameA = tongue * ( 1.0 - smoothstep( 0.8, 1.0, f ) ) * clamp( vAux.x, 0.0, 1.5 );
  } else if ( abs( kind - 5.0 ) < 0.5 ) {    // eye
    em *= uEye;
  } else if ( abs( kind - 6.0 ) < 0.5 ) {    // mouth / throat
    em = vAux.x * ( 0.15 + uThroat ) * uGlowK;
  } else if ( abs( kind - 7.0 ) < 0.5 ) {    // lava: molten seams between obsidian plates, slow boiling flow
    float n = gNoise( vRP * 1.7 + vec3( 0.0, -uTime * 0.45, uTime * 0.21 ) ) * 0.65 + gNoise( vRP * 4.3 - vec3( uTime * 0.3, 0.0, 0.0 ) ) * 0.35;
    em = uGlowK * ( min( vAux.x, 1.5 ) * gCrack * ( 0.45 + 1.1 * n ) + max( 0.0, vAux.x - 1.5 ) * ( 0.5 + 0.5 * n ) ) * ( 1.0 + uHeat ) * ( 0.9 + 0.1 * sin( uTime * uPulseF ) );
  }
  gEmis += ec * em;
  gEmis += uEnrageCol * uEnrage * ( pow( fres, 2.5 ) * 1.4 + 0.04 ) * ( 0.8 + 0.2 * sin( uTime * 7.0 ) );
  if ( uFlash > 0.001 ) gEmis += uFlashCol * uFlash * ( pow( fres, 1.5 ) * 2.0 + 0.25 );
  if ( uCounter > 0.001 ) {
    float bands = 0.5 + 0.5 * sin( vWPos.y * 2.4 - uTime * 9.0 + sin( vWPos.x * 1.3 + vWPos.z * 1.1 + uTime * 2.0 ) * 2.2 );
    float fl = 0.78 + 0.22 * sin( uTime * 17.0 );
    gEmis += uCounterCol * uCounter * ( pow( fres, 1.6 ) * 2.4 + bands * bands * 0.5 + 0.12 ) * fl;
  }
  totalEmissiveRadiance += gEmis;
}
`;

const FRAG_OUT = /* glsl */`
outgoingLight = mix( outgoingLight, uTint, uTintAmt );
diffuseColor.a *= uAlpha;
#ifdef GUARDIAN_FLAME
diffuseColor.a *= gFlameA;
#endif
if ( uGhost > 0.001 ) {
  vec3 Vd = normalize( vViewPosition );
  float fr = 1.0 - saturate( dot( normal, Vd ) );
  float l = dot( outgoingLight, vec3( 0.3, 0.5, 0.2 ) );
  outgoingLight = mix( outgoingLight, vec3( l ) * 0.35 + uGhostCol * ( 0.25 + fr * fr * 1.8 ) + gEmis * 0.5, uGhost );
  diffuseColor.a *= mix( 1.0, 0.16 + 0.75 * fr * fr, uGhost );
}
#include <opaque_fragment>
`;

/** Per-boss uniform block (shared by all its materials). o: { glow, glow2, glowK, pulse, dfreq, counter, enrage, ghost } */
export function guardianUniforms(o = {}) {
  const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  return {
    uDetail: { value: detailTexture() }, uDFreq: { value: o.dfreq ?? 1.1 }, uColorMul: { value: new THREE.Color(1, 1, 1) },
    uGlowCol: { value: hdr(o.glow ?? 0x60d8ff, o.glowI ?? 2.2) }, uGlow2Col: { value: hdr(o.glow2 ?? o.glow ?? 0x60d8ff, o.glow2I ?? 2.2) },
    uGlowK: { value: o.glowK ?? 1 }, uPulseF: { value: o.pulse ?? 2.2 },
    uCounter: { value: 0 }, uCounterCol: { value: hdr(o.counter ?? 0x4aa8ff, 2.6) },
    uEnrage: { value: 0 }, uEnrageCol: { value: hdr(o.enrage ?? 0xff3a12, 2.4) },
    uGhost: { value: 0 }, uGhostCol: { value: hdr(o.ghost ?? 0x8fc8ff, 1.3) },
    uTint: { value: new THREE.Color(1, 1, 1) }, uTintAmt: { value: 0 },
    uThroat: { value: 0 }, uEye: { value: 1 }, uFlame: { value: 1 }, uHeat: { value: 0 }, uMemGlow: { value: o.memGlow ?? 0.35 },
    uBillow: { value: new THREE.Vector2() }, uFlameAmp: { value: 1 }, uAlpha: { value: 1 },
    uFlash: { value: 0 }, uFlashCol: { value: hdr(o.flash ?? o.glow ?? 0xffffff, 2.0) }, uCrackF: { value: o.crackF ?? 1.5 },
  };
}

/**
 * variant: 'body' (front faces, opaque) | 'membrane' (double sided, translucent lighting) | 'flame' (additive, unlit-ish)
 * o: { wrap, rim, rimColor, spec, shine }
 */
export function guardianMaterial(U, variant = 'body', o = {}) {
  const params = { vertexColors: true };
  if (variant === 'membrane') params.side = THREE.DoubleSide;
  if (variant === 'flame') Object.assign(params, { side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const m = lambert(params, {
    key: 'guardian-' + variant, defines: variant === 'flame' ? { GUARDIAN_FLAME: 1 } : undefined, wrap: o.wrap ?? (variant === 'membrane' ? 0.5 : 0.42), rim: o.rim ?? 0.3, rimColor: o.rimColor ?? 0xe8f4ff,
    spec: o.spec ?? 0.45, shine: o.shine ?? 26, trans: variant === 'membrane' ? (o.trans ?? 0.6) : 0, uniforms: U,
    vertex: vs => vs.replace('#include <common>', '#include <common>\n' + VERT_PARS).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY),
    fragment: fs => fs.replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <emissivemap_fragment>', 'vec3 gEmis = vec3( 0.0 );\n' + FRAG_EMIS)
      .replace('#include <opaque_fragment>', FRAG_OUT)
      .replace('* uSpec * saturate( nl * 4.0 )', '* uSpec * gSpecMask * saturate( nl * 4.0 )')
      .replace('irradiance += uTrans * saturate( -nl ) * directLight.color * vec3( 0.9, 1.0, 0.6 );', 'irradiance += uTrans * gTransMask * saturate( -nl ) * directLight.color * vec3( 0.75, 0.9, 1.0 );'),
  });
  m.userData.variant = variant;
  return m;
}
