// 彙整各回資料
import ch1 from './ch1.js';
import ch2 from './ch2.js';
import ch3 from './ch3.js';
import ch4 from './ch4.js';
import ch5 from './ch5.js';
import ch6 from './ch6.js';

const PARTS = [ch1, ch2, ch3, ch4, ch5, ch6];
export const MAPS = {}, SCRIPTS = {}, QUESTS = {}, CHAPTERS = {};
for (const p of PARTS) {
  Object.assign(MAPS, p.maps); Object.assign(SCRIPTS, p.scripts || {});
  Object.assign(QUESTS, p.quests || {}); Object.assign(CHAPTERS, p.chapters || {});
}
