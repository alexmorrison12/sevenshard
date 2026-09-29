// Character creation. Two steps; the centre stays clear for the lead's 3D hero.
//   Step 1 "Class": class grid (8) on the left, class details on the right (role, difficulty, identity, awakening,
//                   class engravings, skill preview), sex toggle at the bottom.
//   Step 2 "Appearance": categories (face, hair, hair colour, skin, eyes, body, marks) on the left; name + path
//                   ("Play the Story" / "Powerpass" / "Raid Ready") + Create on the right.
//   data: { cls, sex: 'm'|'f', look: { face, hair, hairColor, skin, eyes, height, build, marks, markColor },
//           name, step: 'class'|'look', classes?: [ids], taken?: [names] }
// Actions: create:change { cls, sex, look }  (every edit — update the 3D hero)
//          create:step { step }  create:camera { view: 'body'|'face' }
//          create:confirm { cls, sex, look, name, path: 'story'|'powerpass'|'raid' }  create:back {}
import { h, btn, esc, setText, show, clamp } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { CLASSES, CLASS_IDS, cls as clsInfo, LOOK, skillIconId, randomName, validateName, engr } from '../core/data.js';
import { Screen } from './screen.js';

const DEF_LOOK = { face: 0, hair: 0, hairColor: LOOK.hairColors[2], skin: 1, eyes: LOOK.eyes[0], height: 1, build: 0.5, marks: 0, markColor: LOOK.markColors[0] };
const CATS = [
  { id: 'face', name: 'Face', g: 'character' }, { id: 'hair', name: 'Hair', g: 'sparkle' }, { id: 'hairColor', name: 'Hair Colour', g: 'flame' },
  { id: 'skin', name: 'Skin', g: 'heart' }, { id: 'eyes', name: 'Eyes', g: 'eye' }, { id: 'body', name: 'Body', g: 'expand' }, { id: 'marks', name: 'Marks', g: 'star' },
];
const TAG = { c: ['★', 'Counter', '#52d4ff'], s: ['◆', 'Very high stagger', '#b58cff'], b: ['↺', 'Back attack', '#ff8a5a'], hd: ['↑', 'Head attack', '#ffb43c'] };

export class CreateScreen extends Screen {
  static id = 'create';
  build() {
    const el = this.el;
    h('div', 'ss-cc-vig', el);
    // steps
    const steps = this.steps = h('div', 'ss-cc-steps', el);
    this.stepBtns = ['class', 'look'].map((s, i) => {
      const b = btn('ss-cc-step', steps, null, () => this.setStep(s), i ? 'Appearance' : 'Class');
      b.innerHTML = `<i>${i + 1}</i><span>${i ? 'Appearance' : 'Class'}</span>`;
      if (!i) h('b', 'ss-cc-steprule', steps);
      return b;
    });
    // left: class grid | appearance editor
    const L = this.left = h('section', 'ss-cc-left ss-panel ss-orn', el);
    this.gridWrap = h('div', 'ss-cc-gridwrap', L);
    h('div', 'ss-h', this.gridWrap, 'Choose Your Class');
    this.grid = h('div', 'ss-cc-grid', this.gridWrap);
    this.tiles = {};
    this.lookWrap = h('div', 'ss-cc-lookwrap', L);
    h('div', 'ss-h', this.lookWrap, 'Appearance');
    const lk = h('div', 'ss-cc-look', this.lookWrap);
    this.cats = h('div', 'ss-vtabs ss-cc-cats', lk);
    this.catBtns = {};
    for (const c of CATS) {
      const b = btn('ss-tab', this.cats, null, () => this.setCat(c.id), c.name);
      b.innerHTML = glyph(c.g) + `<span>${c.name}</span>`;
      b.setAttribute('role', 'tab');
      this.catBtns[c.id] = b;
    }
    this.opts = h('div', 'ss-cc-opts', lk);
    const lf = h('div', 'ss-cc-lookft', this.lookWrap);
    const rnd = btn('ss-btn ss-btn--sm', lf, null, () => this.randomLook(), 'Randomize appearance');
    rnd.innerHTML = glyph('dice') + '<span>Randomize</span>';
    const rst = btn('ss-btn ss-btn--sm ss-btn--ghost', lf, null, () => { this.look = { ...DEF_LOOK }; this.changed(); this.renderOpts(); }, 'Reset appearance');
    rst.innerHTML = glyph('refresh') + '<span>Reset</span>';
    // right: class info | name & path
    const R = this.right = h('section', 'ss-cc-right ss-panel ss-orn', el);
    this.info = h('div', 'ss-cc-info ss-scroll', R);
    this.fin = h('div', 'ss-cc-fin', R);
    // bottom centre: sex toggle + camera
    const bot = h('div', 'ss-cc-bot', el);
    const seg = this.sexSeg = h('div', 'ss-seg ss-cc-sex', bot);
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Body type');
    this.sexBtns = { m: btn('', seg, null, () => this.setSex('m'), 'Male'), f: btn('', seg, null, () => this.setSex('f'), 'Female') };
    this.sexBtns.m.innerHTML = glyph('male') + 'Male'; this.sexBtns.f.innerHTML = glyph('female') + 'Female';
    const cam = this.camSeg = h('div', 'ss-seg ss-cc-cam', bot);
    this.camBtns = { body: btn('', cam, 'Body', () => this.setCam('body')), face: btn('', cam, 'Face', () => this.setCam('face')) };
    // footer nav
    const foot = h('div', 'ss-cc-foot', el);
    this.backBtn = btn('ss-btn ss-btn--ghost', foot, null, () => this.back(), 'Back');
    this.backBtn.innerHTML = glyph('left') + '<span>Back</span>';
    this.nextBtn = btn('ss-btn ss-btn--primary ss-btn--lg ss-cc-next', el, null, () => this.setStep('look'), 'Next: Appearance');
    this.nextBtn.innerHTML = '<span>Appearance</span>' + glyph('right');
    this.cat = 'face'; this.cam = 'body'; this.path = 'story';
  }
  render(d) {
    this.d = d;
    const ids = d.classes || CLASS_IDS;
    if (!this._built || this._ids !== ids.join()) {
      this._ids = ids.join(); this._built = true;
      this.grid.textContent = ''; this.tiles = {};
      for (const id of ids) {
        const c = clsInfo(id);
        const t = btn('ss-cc-tile', this.grid, null, () => this.setCls(id), c.name);
        t.style.setProperty('--cc', c.color); t.style.setProperty('--cc2', c.color2);
        t.innerHTML = `<i class="ss-cc-crest" style="background-image:url('${iconUrl('class:' + id, 44)}')"></i><b>${esc(c.name)}</b><span>${esc(c.archetype)}</span><em class="${c.role === 'Support' ? 'is-sup' : ''}">${esc(c.role)}</em>`;
        this.tiles[id] = t;
      }
    }
    this.clsId = d.cls && CLASSES[d.cls] ? d.cls : this.clsId || ids[0];
    this.sex = d.sex || this.sex || 'm';
    this.look = { ...DEF_LOOK, ...(this.look || {}), ...(d.look || {}) };
    if (d.name != null) this.name = d.name;
    if (this.name == null) this.name = '';
    this.taken = d.taken || [];
    this.setStep(d.step || this.step || 'class', true);
    this.markCls(); this.markSex(); this.markCam();
    this.renderInfo(); this.renderFin(); this.setCat(this.cat);
  }
  // ---------------------------------------------------------------- state changes
  changed() { this.emit('create:change', { cls: this.clsId, sex: this.sex, look: { ...this.look } }); }
  setCls(id) { if (id === this.clsId) return; this.clsId = id; this.markCls(); this.renderInfo(); this.renderFin(); this.changed(); }
  setSex(s) { if (s === this.sex) return; this.sex = s; this.markSex(); this.changed(); }
  setCam(v) { this.cam = v; this.markCam(); this.emit('create:camera', { view: v }); }
  setStep(s, silent) {
    if (s !== 'look') s = 'class'; // unknown steps fall back to the class picker
    this.step = s;
    this.el.dataset.step = s;
    this.stepBtns.forEach((b, i) => { b.classList.toggle('is-on', (i ? 'look' : 'class') === s); b.classList.toggle('is-done', !i && s === 'look'); });
    show(this.gridWrap, s === 'class'); show(this.lookWrap, s === 'look');
    show(this.info, s === 'class'); show(this.fin, s === 'look');
    show(this.nextBtn, s === 'class'); show(this.camSeg, s === 'look');
    if (!silent) { this.emit('create:step', { step: s }); if (s === 'look') this.setCam('face'); else this.setCam('body'); }
  }
  back() { if (this.step === 'look') this.setStep('class'); else this.emit('create:back', {}); }
  markCls() { for (const [id, t] of Object.entries(this.tiles)) { t.classList.toggle('is-sel', id === this.clsId); t.setAttribute('aria-pressed', id === this.clsId); } }
  markSex() { for (const [k, b] of Object.entries(this.sexBtns)) b.setAttribute('aria-pressed', k === this.sex); }
  markCam() { for (const [k, b] of Object.entries(this.camBtns)) b.setAttribute('aria-pressed', k === this.cam); }
  // ---------------------------------------------------------------- class details
  renderInfo() {
    const id = this.clsId, c = clsInfo(id);
    const idn = c.identity || {};
    const diff = [1, 2, 3, 4, 5].map(i => `<i class="${i <= (c.difficulty || 1) ? 'on' : ''}"></i>`).join('');
    const skills = (c.skills || []).map(s => {
      const tags = String(s.tags || '').split(/\s+/).filter(Boolean).map(t => TAG[t] ? `<i title="${TAG[t][1]}" style="color:${TAG[t][2]}">${TAG[t][0]}</i>` : '').join('');
      return `<div class="ss-cc-sk"><span class="ss-cc-skic" style="background-image:url('${iconUrl(skillIconId(id, s.name), 28)}')"></span><div><b>${esc(s.name)}</b><span>${esc(s.type)}</span></div><em>${tags}</em></div>`;
    }).join('');
    this.info.style.setProperty('--cc', c.color); this.info.style.setProperty('--cc2', c.color2);
    this.info.innerHTML = `
      <div class="ss-cc-ihd">
        <i class="ss-cc-icrest" style="background-image:url('${iconUrl('class:' + id, 72)}')"></i>
        <div><div class="ss-cc-iname">${esc(c.name)}</div><div class="ss-cc-isub">${esc(c.archetype)} · ${esc(c.weapon)}</div>
          <div class="ss-cc-imeta"><span class="ss-tag" style="--tc:${c.role === 'Support' ? '#86e070' : '#ff7a64'}">${esc(c.role)}</span><span class="ss-cc-diff">Difficulty <span class="ss-pips">${diff}</span></span></div></div>
      </div>
      <p class="ss-cc-blurb">${esc(c.blurb || '')}</p>
      <div class="ss-cc-box">
        <div class="ss-cc-bt">Identity · <b>${esc(idn.name || '')}</b></div>
        <p>${esc(idn.desc || '')}</p>
        <div class="ss-cc-keys">${idn.z ? `<span><span class="ss-kbd">Z</span> ${esc(idn.z)}</span>` : ''}${idn.x ? `<span><span class="ss-kbd">X</span> ${esc(idn.x)}</span>` : ''}</div>
      </div>
      <div class="ss-cc-row2">
        <div class="ss-cc-box"><div class="ss-cc-bt">Awakening</div><div class="ss-cc-awk"><span class="ss-cc-skic" style="background-image:url('${iconUrl('skill:' + id + ':awakening', 32)}')"></span><b>${esc(c.awakening || '')}</b><span class="ss-kbd">V</span></div></div>
        <div class="ss-cc-box"><div class="ss-cc-bt">Class Engravings</div><div class="ss-cc-engr">${(c.engravings || []).map(e => `<span><i style="background-image:url('${iconUrl('engr:' + e, 22)}')"></i>${esc(engr(e).name)}</span>`).join('')}</div></div>
      </div>
      <div class="ss-h ss-cc-skh">Skills</div>
      <div class="ss-cc-skills">${skills}</div>`;
  }
  // ---------------------------------------------------------------- appearance options
  setCat(id) {
    this.cat = id;
    for (const [k, b] of Object.entries(this.catBtns)) b.setAttribute('aria-selected', k === id);
    this.renderOpts();
  }
  renderOpts() {
    const o = this.opts, L = this.look, id = this.cat;
    o.textContent = '';
    const set = (k, v) => { this.look[k] = v; this.changed(); this.renderOpts(); };
    const tiles = (key, names) => {
      const g = h('div', 'ss-cc-tiles', o);
      names.forEach((n, i) => { const b = btn('ss-cc-opt', g, null, () => set(key, i), n); b.innerHTML = `<b>${i + 1}</b><span>${esc(n)}</span>`; b.setAttribute('aria-pressed', L[key] === i); });
    };
    const swatches = (key, cols, byIndex = false) => {
      const g = h('div', 'ss-cc-sw', o);
      cols.forEach((c, i) => { const v = byIndex ? i : c; const b = btn('ss-cc-swb', g, null, () => set(key, v), `${key} ${i + 1}`); b.style.setProperty('--sw', c); b.setAttribute('aria-pressed', L[key] === v); });
    };
    const slider = (key, label, min, max, step, fmt) => {
      const row = h('label', 'ss-cc-sl', o);
      const top = h('div', 'ss-cc-slt', row);
      h('span', '', top, label); const val = h('b', '', top, fmt(L[key]));
      const r = h('input', 'ss-range', row);
      r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = L[key];
      const upd = () => { r.style.setProperty('--p', ((r.value - min) / (max - min) * 100) + '%'); val.textContent = fmt(+r.value); };
      upd();
      r.addEventListener('input', () => { this.look[key] = +r.value; upd(); this.changed(); });
    };
    const head = t => h('div', 'ss-label ss-cc-ol', o, t);
    if (id === 'face') { head('Face'); tiles('face', LOOK.faces); }
    else if (id === 'hair') { head('Hairstyle'); tiles('hair', LOOK.hairs); }
    else if (id === 'hairColor') { head('Hair Colour'); swatches('hairColor', LOOK.hairColors); }
    else if (id === 'skin') { head('Skin Tone'); swatches('skin', LOOK.skins, true); }
    else if (id === 'eyes') { head('Eye Colour'); swatches('eyes', LOOK.eyes); }
    else if (id === 'body') {
      head('Body');
      slider('height', 'Height', 0.94, 1.06, 0.005, v => v < 0.97 ? 'Short' : v > 1.03 ? 'Tall' : 'Average');
      slider('build', 'Build', 0, 1, 0.01, v => v < 0.3 ? 'Lean' : v > 0.7 ? 'Heavy' : 'Athletic');
    } else if (id === 'marks') { head('Marks'); tiles('marks', LOOK.marks); if (L.marks) { head('Mark Colour'); swatches('markColor', LOOK.markColors); } }
  }
  randomLook() {
    const r = a => a[Math.floor(Math.random() * a.length)];
    this.look = { face: Math.floor(Math.random() * 6), hair: Math.floor(Math.random() * 8), hairColor: r(LOOK.hairColors), skin: Math.floor(Math.random() * 8), eyes: r(LOOK.eyes), height: +(0.95 + Math.random() * 0.1).toFixed(3), build: +Math.random().toFixed(2), marks: Math.random() < 0.5 ? 0 : 1 + Math.floor(Math.random() * 3), markColor: r(LOOK.markColors) };
    this.changed(); this.renderOpts();
  }
  // ---------------------------------------------------------------- name, path, create
  renderFin() {
    const f = this.fin, c = clsInfo(this.clsId);
    f.textContent = '';
    const hd = h('div', 'ss-cc-fhd', f);
    hd.innerHTML = `<i class="ss-cc-icrest sm" style="background-image:url('${iconUrl('class:' + this.clsId, 44)}')"></i><div><div class="ss-cc-fname">${esc(c.name)}</div><div class="ss-cc-isub">${esc(c.archetype)} · ${esc(c.role)}</div></div>`;
    h('div', 'ss-h', f, 'Name Your Hero');
    const row = h('div', 'ss-cc-namerow', f);
    const inp = this.nameInp = h('input', 'ss-input ss-cc-name', row);
    inp.type = 'text'; inp.maxLength = 16; inp.placeholder = 'Enter a name'; inp.value = this.name || ''; inp.spellcheck = false; inp.autocomplete = 'off';
    inp.setAttribute('aria-label', 'Character name');
    const dice = btn('ss-btn ss-btn--icon', row, null, () => { inp.value = randomName(this.sex); this.name = inp.value; this.checkName(); }, 'Random name');
    dice.innerHTML = glyph('dice');
    this.nameMsg = h('div', 'ss-cc-namemsg', f);
    inp.addEventListener('input', () => { this.name = inp.value; this.checkName(); });
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.confirm(); });
    h('div', 'ss-h ss-cc-pathh', f, 'Choose Your Path');
    const paths = h('div', 'ss-cc-paths', f);
    this.pathBtns = {};
    for (const p of [
      { id: 'story', t: 'Play the Story', s: 'Begin with the Siege of Brighthold and walk the road of the Shardbearer from level 1.', tag: 'Recommended', g: 'tome' },
      { id: 'powerpass', t: 'Powerpass', s: 'Start at level 60 in a Vanguard +10 set (Item Level 1,200) with a Starter Crate to hone toward the raid.', tag: 'Veteran', g: 'bolt' },
      { id: 'raid', t: 'Raid Ready', s: 'Level 60 in the Horned Tyrant +8 set (Item Level 1,420) with engravings, accessories and a cut stone.', tag: 'Instant', g: 'crown' },
    ]) {
      const b = btn('ss-cc-path', paths, null, () => { this.path = p.id; for (const [k, x] of Object.entries(this.pathBtns)) x.setAttribute('aria-pressed', k === p.id); }, p.t);
      b.innerHTML = `<span class="ss-cc-pathg">${glyph(p.g)}</span><div><b>${p.t}</b><span>${p.s}</span></div><em>${p.tag}</em>`;
      b.setAttribute('aria-pressed', this.path === p.id);
      this.pathBtns[p.id] = b;
    }
    this.createBtn = btn('ss-btn ss-btn--primary ss-btn--lg ss-cc-create', f, 'Create Character', () => this.confirm());
    this.checkName();
  }
  checkName() {
    const err = validateName(this.name, this.taken);
    const empty = !String(this.name || '').trim();
    setText(this.nameMsg, empty ? '2–16 letters. Your name is shared across the server.' : err || 'Name available');
    this.nameMsg.className = 'ss-cc-namemsg' + (empty ? '' : err ? ' is-bad' : ' is-ok');
    this.nameInp.classList.toggle('is-bad', !empty && !!err);
    this.createBtn.disabled = !!err;
    return !err;
  }
  confirm() {
    if (!this.checkName()) { this.nameInp.focus(); return; }
    this.emit('create:confirm', { cls: this.clsId, sex: this.sex, look: { ...this.look }, name: String(this.name).trim(), path: this.path });
  }
  key(e) {
    if (e.key === 'Escape') { this.back(); return true; }
    if (this.step === 'class' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const ids = Object.keys(this.tiles); const i = ids.indexOf(this.clsId);
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? 2 : -2;
      this.setCls(ids[clamp(i + d, 0, ids.length - 1)]); this.tiles[this.clsId].focus();
      return true;
    }
    if (this.step === 'class' && e.key === 'Enter') { this.setStep('look'); return true; }
    return false;
  }
}
