// Title screen: CSS-rendered SEVENSHARD logo with the seven-shard motif, main menu, server line, news carousel,
// version. The lead renders the animated key scene behind it (the screen only vignettes the edges).
//   data: { server: 'Solmara-1', status: 'Good'|'Busy'|'Full'|'Maintenance', version, news: [{ tag, title, date, body }],
//           continue?: { name, cls, level } }
// Actions: title:enter · title:together · title:leaderboards · title:watch · title:settings · title:server · title:news {index}
import { h, btn, esc, setText, show } from '../core/util.js';
import { Screen } from './screen.js';

const MENU = [
  { id: 'enter', label: 'Enter World', primary: true },
  { id: 'together', label: 'Play Together', sub: 'Host or join a world with friends' },
  { id: 'leaderboards', label: 'Leaderboards', sub: 'Weekly Legion Race' },
  { id: 'watch', label: 'Watch the Raid', sub: 'Spectate eight AI raiders vs Gorrath' },
  { id: 'settings', label: 'Settings' },
];
const STATUS = { good: '#6fdc5a', busy: '#ffae3a', full: '#ff5d4d', maintenance: '#8c95ab' };

export class TitleScreen extends Screen {
  static id = 'title';
  build() {
    const el = this.el;
    h('div', 'ss-ti-vig', el);
    const motes = h('div', 'ss-ti-motes', el);
    for (let i = 0; i < 26; i++) {
      const m = h('i', '', motes);
      m.style.left = (8 + ((i * 37) % 84)) + '%';
      m.style.animationDelay = -(i * 1.37 % 14).toFixed(2) + 's';
      m.style.animationDuration = (11 + (i * 7) % 9) + 's';
      m.style.setProperty('--dx', ((i % 5) - 2) * 14 + 'px');
      m.style.setProperty('--s', (0.5 + (i % 4) * 0.25).toFixed(2));
    }
    // ---------------------------------------------------------------- logo
    const logo = h('div', 'ss-logo', el);
    const mark = h('div', 'ss-logo-mark', logo);
    h('i', 'ss-logo-rays', mark);
    h('i', 'ss-logo-halo', mark);
    // seven shards: one heart shard + three on each side on a gentle arc
    const pos = [[-150, 58, -26, .42], [-102, 30, -17, .56], [-54, 10, -8, .72], [0, 0, 0, 1], [54, 10, 8, .72], [102, 30, 17, .56], [150, 58, 26, .42]];
    pos.forEach(([x, y, r, s], i) => {
      const sh = h('i', 'ss-shard' + (i === 3 ? ' is-heart' : ''), mark);
      sh.style.setProperty('--x', x + 'px'); sh.style.setProperty('--y', y + 'px');
      sh.style.setProperty('--r', r + 'deg'); sh.style.setProperty('--k', s);
      sh.style.animationDelay = (-i * 0.6) + 's';
      h('b', '', sh);
    });
    const word = h('h1', 'ss-logo-word', logo);
    word.setAttribute('aria-label', 'SEVENSHARD');
    word.innerHTML = '<span class="ss-logo-t" data-t="SEVENSHARD">SEVENSHARD</span>';
    const tag = h('div', 'ss-logo-tag', logo);
    tag.innerHTML = '<i></i><span>The Sundered Light</span><i></i>';
    // ---------------------------------------------------------------- menu
    const menu = this.menu = h('nav', 'ss-ti-menu', el);
    menu.setAttribute('aria-label', 'Main menu');
    this.btns = MENU.map((m, i) => {
      const b = btn('ss-ti-b' + (m.primary ? ' is-primary' : ''), menu, null, () => this.emit('title:' + m.id, {}), m.label);
      b.innerHTML = `<i class="ss-ti-m"></i><i class="ss-ti-m ss-ti-m--r"></i><span class="ss-ti-bl">${esc(m.label)}</span>` + (m.sub ? `<span class="ss-ti-bs">${esc(m.sub)}</span>` : '');
      b.addEventListener('pointerenter', () => this.focusIdx(i, false));
      return b;
    });
    this.cont = h('div', 'ss-ti-cont', menu);
    const srv = this.srv = btn('ss-ti-srv', el, null, () => this.emit('title:server', {}), 'Change server');
    this.srvDot = h('i', '', srv);
    this.srvT = h('span', '', srv);
    // ---------------------------------------------------------------- news
    const news = this.news = h('aside', 'ss-ti-news ss-panel ss-orn', el);
    news.setAttribute('aria-label', 'News');
    this.newsArt = h('div', 'ss-ti-art', news);
    this.newsTag = h('span', 'ss-tag ss-ti-ntag', this.newsArt);
    const body = h('div', 'ss-ti-nbody', news);
    this.newsTitle = h('div', 'ss-ti-ntitle', body);
    this.newsDate = h('div', 'ss-ti-ndate', body);
    this.newsText = h('p', 'ss-ti-ntext', body);
    this.dots = h('div', 'ss-ti-dots', news);
    news.addEventListener('click', e => { if (!e.target.closest('.ss-ti-dots')) this.emit('title:news', { index: this.ni }); });
    this.ver = h('div', 'ss-ti-ver', el);
    this.hint = h('div', 'ss-ti-hint', el);
    this.hint.innerHTML = `<span class="ss-kbd">Enter</span> Enter World`;
    this.fi = 0; this.ni = 0;
  }
  render(d) {
    const status = String(d.status || 'Busy');
    setText(this.srvT, `Server: ${d.server || 'Solmara-1'} · ${status}`);
    this.srvDot.style.background = STATUS[status.toLowerCase()] || STATUS.good;
    this.srvDot.style.boxShadow = `0 0 8px ${STATUS[status.toLowerCase()] || STATUS.good}`;
    setText(this.ver, d.version || 'v0.1.0');
    show(this.cont, !!d.continue);
    if (d.continue) this.cont.innerHTML = `Last played: <b>${esc(d.continue.name)}</b> · Lv ${esc(d.continue.level)} ${esc(d.continue.clsName || '')}`;
    this.newsList = d.news && d.news.length ? d.news : [{ tag: 'Event', title: 'The Horned Tyrant Awakens', date: 'Legion Raid · Now Open', body: 'Gorrath gathers the Abyssal Legion at the Ashen Ridge. Form a raid of eight, break his horns, and claim the Tyrant set.' }];
    this.dots.textContent = '';
    this.newsList.forEach((n, i) => { const b = btn('ss-ti-dot', this.dots, null, () => this.showNews(i), `News ${i + 1}`); b.setAttribute('aria-pressed', i === this.ni); });
    show(this.dots, this.newsList.length > 1);
    this.showNews(Math.min(this.ni, this.newsList.length - 1));
    clearInterval(this._rot);
    if (this.newsList.length > 1) this._rot = setInterval(() => this.showNews((this.ni + 1) % this.newsList.length), 8000);
  }
  showNews(i) {
    this.ni = i;
    const n = this.newsList[i];
    setText(this.newsTag, n.tag || 'News');
    this.newsTag.style.setProperty('--tc', n.tag && /event|raid/i.test(n.tag) ? '#ffae3a' : n.tag && /update|patch/i.test(n.tag) ? '#72b6ff' : '#86e070');
    setText(this.newsTitle, n.title || '');
    setText(this.newsDate, n.date || '');
    setText(this.newsText, n.body || '');
    this.newsArt.dataset.art = n.art || (i % 3);
    [...this.dots.children].forEach((d, k) => d.setAttribute('aria-pressed', k === i));
    this.news.classList.remove('is-swap'); void this.news.offsetWidth; this.news.classList.add('is-swap');
  }
  focusIdx(i, focus = true) {
    this.fi = (i + this.btns.length) % this.btns.length;
    this.btns.forEach((b, k) => b.classList.toggle('is-hot', k === this.fi));
    if (focus) this.btns[this.fi].focus();
  }
  shown() { this.focusIdx(0, false); }
  hidden() { clearInterval(this._rot); }
  key(e) {
    if (e.key === 'ArrowDown') { this.focusIdx(this.fi + 1); return true; }
    if (e.key === 'ArrowUp') { this.focusIdx(this.fi - 1); return true; }
    if (e.key === 'Enter' && !(document.activeElement && document.activeElement.tagName === 'BUTTON' && this.el.contains(document.activeElement))) { this.emit('title:' + MENU[this.fi].id, {}); return true; }
    return false;
  }
}
