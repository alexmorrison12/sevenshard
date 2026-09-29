// Loading screen: painted vista (by zone kind), zone name, region, rotating tips, progress bar with glowing head.
//   data: { zone, region?, kind?: 'field'|'city'|'dungeon'|'raid'|'sea'|'island'|'arena'|'stronghold', tip?, pct: 0..100,
//           image?: canvas | dataURL (replaces the painted vista) }
// Call ui.screen('loading', { pct }) repeatedly to advance (same screen → updates in place).
import { h, setText, setStyle, show } from '../core/util.js';
import { Screen } from './screen.js';

export const TIPS = [
  'Counter skills (★) interrupt a boss while it glows blue. Watch for the shimmer.',
  'Hitting a boss from behind with a Back Attack skill (↺) deals bonus damage and crits more often.',
  'Stagger checks: fill the purple bar before the attack lands, or the whole party pays for it.',
  'Artisan\'s Energy fills with every failed honing attempt. At 100% success is guaranteed.',
  'Engraving nodes add up across books, accessories and your ability stone: 5 / 10 / 15 nodes = level 1 / 2 / 3.',
  'Pip Seeds hide in the strangest places. Bramblebeard pays handsomely for them.',
  'Supports make parties: bring one per four players, two in a legion raid.',
  'Space dashes. While knocked down, Space stands you up with a moment of invulnerability.',
  'Battle items (1–4) have their own cooldowns. A Destruction Bomb can break a boss part in one throw.',
  'Chaos Dungeons reset daily at 10:00 UTC. Rest bonus builds up for the days you skip.',
];

export class LoadingScreen extends Screen {
  static id = 'loading';
  build() {
    const el = this.el;
    this.art = h('div', 'ss-ld-art', el);
    for (let i = 0; i < 3; i++) h('i', 'ss-ld-layer ss-ld-l' + i, this.art);
    h('div', 'ss-ld-vig', el);
    const tx = h('div', 'ss-ld-tx', el);
    this.region = h('div', 'ss-ld-region', tx);
    this.zone = h('div', 'ss-ld-zone', tx);
    h('i', 'ss-ld-rule', tx);
    const tipRow = h('div', 'ss-ld-tip', tx);
    h('b', '', tipRow, 'Tip');
    this.tip = h('span', '', tipRow);
    const pr = h('div', 'ss-ld-prog', el);
    this.pct = h('div', 'ss-ld-pct', pr);
    this.spin = h('i', 'ss-ld-spin', this.pct);
    this.pctT = h('span', '', this.pct);
    const bar = h('div', 'ss-ld-bar', pr);
    this.fill = h('i', '', bar);
    this.head = h('b', '', bar);
    this.ti = Math.floor(Math.random() * TIPS.length);
  }
  render(d) {
    if (d.zone == null && this.last) d = { ...this.last, ...d }; // partial update, e.g. ui.screen('loading', { pct: 80 })
    this.last = d;
    setText(this.zone, d.zone || 'Solmara');
    setText(this.region, d.region || '');
    show(this.region, !!d.region);
    this.el.dataset.kind = d.kind || 'field';
    // optional art: a canvas or image URL supplied by the game (e.g. a rendered vista)
    if (d.image !== this._imgSrc) {
      this._imgSrc = d.image;
      const img = d.image ? (d.image.toDataURL ? d.image.toDataURL('image/jpeg', 0.9) : d.image) : null;
      this.art.classList.toggle('has-img', !!img); this.art.style.backgroundImage = img ? `url("${img}")` : '';
    }
    const p = Math.max(0, Math.min(100, d.pct ?? 0));
    setStyle(this.fill, 'transform', `scaleX(${(p / 100).toFixed(4)})`);
    setStyle(this.head, 'left', p.toFixed(2) + '%');
    setText(this.pctT, Math.floor(p) + '%');
    if (d.tip) { setText(this.tip, d.tip); clearInterval(this._t); this._t = null; }
    else if (!this._t) { setText(this.tip, TIPS[this.ti]); this._t = setInterval(() => { this.ti = (this.ti + 1) % TIPS.length; setText(this.tip, TIPS[this.ti]); }, 6500); }
  }
  hidden() { clearInterval(this._t); this._t = null; }
}
