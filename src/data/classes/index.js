// All playable classes, in the order they appear on the creation screen.
import reaver from './reaver.js';
import oathkeeper from './oathkeeper.js';
import stormfist from './stormfist.js';
import pistoleer from './pistoleer.js';
import starcaller from './starcaller.js';
import songweaver from './songweaver.js';
import bladedancer from './bladedancer.js';
import demonbound from './demonbound.js';

export const CLASS_LIST = [reaver, oathkeeper, stormfist, pistoleer, starcaller, songweaver, bladedancer, demonbound];
export const CLASSES = Object.fromEntries(CLASS_LIST.map(c => [c.id, c]));
