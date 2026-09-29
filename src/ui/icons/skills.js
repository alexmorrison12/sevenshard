// Skill icon registry: `skill:<class>:<key>` → painter. Awakening icons get a gold inner frame.
import { PI, lg, poly, rgba, metalLG, glow } from './core.js';
import { REAVER } from './skills_reaver.js';
import { OATHKEEPER } from './skills_oathkeeper.js';
import { STORMFIST } from './skills_stormfist.js';
import { PISTOLEER } from './skills_pistoleer.js';
import { STARCALLER } from './skills_starcaller.js';
import { SONGWEAVER } from './skills_songweaver.js';
import { BLADEDANCER } from './skills_bladedancer.js';
import { DEMONBOUND, ANY } from './skills_demonbound.js';

const TABLES = { reaver: REAVER, oathkeeper: OATHKEEPER, stormfist: STORMFIST, pistoleer: PISTOLEER, starcaller: STARCALLER, songweaver: SONGWEAVER, bladedancer: BLADEDANCER, demonbound: DEMONBOUND, any: ANY };

/** Gold filigree inner frame marking awakening skills. */
export function awakenFrame(x) {
  glow(x, 50, 50, 70, '#ffd070', 0.12);
  x.lineCap = 'butt';
  x.lineWidth = 2.2; x.strokeStyle = 'rgba(0,0,0,.6)'; x.strokeRect(6.2, 6.2, 87.6, 87.6);
  x.lineWidth = 1.3; x.strokeStyle = metalLG(x, 0, 0, 100, 100, 'gold'); x.strokeRect(6, 6, 88, 88);
  for (const [cx, cy, sx, sy] of [[6, 6, 1, 1], [94, 6, -1, 1], [6, 94, 1, -1], [94, 94, -1, -1]]) {
    poly(x, [[cx - sx * 1, cy - sy * 1], [cx + sx * 15, cy], [cx + sx * 5, cy + sy * 5], [cx, cy + sy * 15]]);
    x.fillStyle = metalLG(x, cx, cy, cx + sx * 15, cy + sy * 15, 'gold'); x.fill();
    x.lineWidth = 0.7; x.strokeStyle = 'rgba(40,20,0,.9)'; x.stroke();
    poly(x, [[cx + sx * 3.5, cy + sy * 3.5], [cx + sx * 7.5, cy + sy * 2.2], [cx + sx * 2.2, cy + sy * 7.5]]); x.fillStyle = rgba('#fff4c0', 0.9); x.fill();
  }
  x.lineCap = 'round';
  void lg; void PI;
}

export const SKILL_PAINT = {};
for (const cls in TABLES) {
  for (const key in TABLES[cls]) {
    const fn = TABLES[cls][key];
    SKILL_PAINT[`skill:${cls}:${key}`] = key === 'awakening' ? (x, R, o) => { fn(x, R, o); awakenFrame(x); } : fn;
  }
}
