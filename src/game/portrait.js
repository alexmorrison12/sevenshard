// Live 3D character portrait for the Character window (Lost Ark shows your hero standing in the paper doll).
// Renders a separate little studio scene with the game's WebGL renderer into an offscreen target, tone-maps it,
// reads the pixels back and paints them into a 2D canvas mounted in the window. ~20 fps while the window is open;
// drag to turn the hero. No second WebGL context, so every shader the hero uses is already compiled.
import * as THREE from 'three';
import { PROVIDERS } from './visuals.js';

const W = 500, H = 780;   // 2× the window's 250×390 portrait area

const Tonemap = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    vec3 neutral(vec3 color) {
      const float S = 0.76; const float D = 0.15;
      float x = min(color.r, min(color.g, color.b));
      float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
      color -= off;
      float peak = max(color.r, max(color.g, color.b));
      if (peak < S) return color;
      float d = 1.0 - S;
      float np = 1.0 - d * d / (peak + d - S);
      color *= np / peak;
      float g = 1.0 - 1.0 / (D * (peak - np) + 1.0);
      return mix(color, vec3(np), g);
    }
    vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main() {
      vec4 s = texture2D(tDiffuse, vUv);
      vec3 c = s.a > 0.0 ? s.rgb / max(s.a, 1e-4) : vec3(0.0);
      gl_FragColor = vec4(toSRGB(neutral(c * 1.2)), s.a);
    }`,
};

export class Portrait {
  constructor(game) {
    this.g = game;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(24, W / H, 0.1, 40);
    const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x302418, 1.25);
    const key = new THREE.DirectionalLight(0xfff0dc, 3.4); key.position.set(-2.2, 3.4, 3.2);
    const rim = new THREE.DirectionalLight(0x9ab8ff, 2.2); rim.position.set(2.6, 2.4, -3.4);
    const fill = new THREE.DirectionalLight(0xffc890, 0.5); fill.position.set(3, 0.6, 2);
    this.scene.add(hemi, key, rim, fill);
    this.model = null; this.el = null; this.canvas = null; this.spin = -0.35; this.t = 0; this.acc = 0;
    this.drag = null;
  }
  ensureTargets() {
    if (this.rt) return;
    this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    this.out = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ ...Tonemap, uniforms: { tDiffuse: { value: null } }, depthTest: false, depthWrite: false }));
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.px = new Uint8Array(W * H * 4);
    this.img = new ImageData(W, H);
  }
  /** Mount into the window's portrait element for this character (c: session heroChar + look/gear). */
  mount(el, c) {
    if (!el || !PROVIDERS.hero) return;
    const key = JSON.stringify([c.cls, c.sex, c.look, c.gear, c.weapon]);
    if (this.el === el && this.key === key) return;
    this.unmountModel();
    this.key = key; this.el = el;
    try { this.model = PROVIDERS.hero({ cls: c.cls, sex: c.sex || 'm', look: c.look, gear: c.gear, weapon: c.weapon, lod: 'full' }); }
    catch (e) { console.warn('[portrait]', e); return; }
    this.scene.add(this.model.root);
    this.model.root.rotation.y = Math.PI + this.spin;   // models face −Z; turn toward the camera
    const h = this.model.height || 1.8;
    this.cam.position.set(0, h * 0.58, h * 2.95); this.cam.lookAt(0, h * 0.49, 0);
    if (!this.canvas) {
      this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
      Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' });
      this.ctx = this.canvas.getContext('2d');
      this.canvas.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, s: this.spin }; this.canvas.setPointerCapture(e.pointerId); this.canvas.style.cursor = 'grabbing'; });
      this.canvas.addEventListener('pointermove', e => { if (this.drag) this.spin = this.drag.s + (e.clientX - this.drag.x) * 0.012; });
      const up = () => { this.drag = null; this.canvas.style.cursor = 'grab'; };
      this.canvas.addEventListener('pointerup', up); this.canvas.addEventListener('pointercancel', up);
    }
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(this.canvas);
    this.acc = 1;   // draw on the next frame
  }
  unmountModel() {
    if (this.model) { this.scene.remove(this.model.root); this.model.dispose?.(); this.model = null; }
    this.key = null;
  }
  /** Per frame from the game loop; cheap when nothing is mounted. */
  update(dt) {
    if (!this.model) return;
    if (!this.el?.isConnected || !this.el.offsetParent) { this.unmountModel(); this.canvas?.remove(); this.el = null; return; }
    this.t += dt; this.acc += dt;
    if (this.acc < 0.05) return;           // ~20 fps is plenty for an idle pose
    const step = this.acc; this.acc = 0;
    this.model.update(step, { speed: 0, turn: 0, combat: false });
    const r = this.model.root, want = Math.PI + this.spin; r.rotation.y += (want - r.rotation.y) * Math.min(1, step * 10);
    this.render();
  }
  render() {
    const R = this.g.renderer?.r || this.g.renderer?.renderer; if (!R) return;
    this.ensureTargets();
    const prevTarget = R.getRenderTarget(), prevClear = R.getClearColor(new THREE.Color()), prevAlpha = R.getClearAlpha(), prevAuto = R.autoClear;
    const prevTone = R.toneMapping, prevShadow = R.shadowMap.enabled;
    try {
      R.toneMapping = THREE.NoToneMapping; R.shadowMap.enabled = false; R.autoClear = true;
      R.setClearColor(0x000000, 0);
      R.setRenderTarget(this.rt); R.clear(); R.render(this.scene, this.cam);
      this.quad.material.uniforms.tDiffuse.value = this.rt.texture;
      R.setRenderTarget(this.out); R.clear(); R.render(this.quadScene, this.quadCam);
      R.readRenderTargetPixels(this.out, 0, 0, W, H, this.px);
    } finally {
      R.setRenderTarget(prevTarget); R.setClearColor(prevClear, prevAlpha); R.autoClear = prevAuto; R.toneMapping = prevTone; R.shadowMap.enabled = prevShadow;
    }
    // GL rows are bottom-up
    const src = this.px, dst = this.img.data, row = W * 4;
    for (let y = 0; y < H; y++) dst.set(src.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    this.ctx.putImageData(this.img, 0, 0);
  }
  dispose() { this.unmountModel(); this.canvas?.remove(); this.rt?.dispose(); this.out?.dispose(); this.quad?.material.dispose(); this.quad?.geometry.dispose(); }
}
