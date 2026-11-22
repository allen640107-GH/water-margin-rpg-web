// 遊玩時間估算（交叉驗證用的另一套假設）：node tools/playtime_alt.mjs
// 方法（保守、以「第一次遊玩、正常閱讀」為準，不含刷怪與死亡重來）：
//  對話：每句 2.5 秒（點擊/換行）＋每字 0.12 秒（約每秒 8 字閱讀）
//  戰鬥：以 tools/sim.mjs 模擬的平均回合數 × 每回合 12 秒（雜兵；選指令＋動畫）／15 秒（頭目），另加 15／30 秒進出場與結算
//  探索：每張地圖可走格數 × 0.6 秒（含走動、轉彎、回頭、調查）
//  謎題：推石 5 分、機關/閘門 3 分、水路迷宮 3 分
//  選單/裝備/商店/客棧：上述總和的 10%
import { execFileSync } from 'node:child_process';
import { MAPS } from '../js/data/world.js';
const val = execFileSync('node', ['tools/validate.mjs']).toString();
const byCh = JSON.parse(val.split('\n').find(l => l.startsWith('byCh ')).slice(5));
const simOut = execFileSync('node', ['tools/sim.mjs']).toString().split('\n').map(l => l.split('\t')).filter(r => r.length >= 5 && r[1] !== '--- end');
const SIDE = new Set(['liaoerwa', 'cave', 'yanwu']);
const NAMES = { 1: '第一回 林沖風雪', 2: '第二回 武松打虎', 3: '第三回 智取生辰綱', 4: '第四回 梁山聚義', 5: '第五回 宋江・江州', 6: '第六回 三打祝家莊' };
const T = {}; const side = { battle: 0, n: 0, maps: [] }; const post = { battle: 0, n: 0 };
const ch = id => MAPS[id] ? MAPS[id].ch : 0;
for (const [map, spec, , wr, rounds, tag] of simOut) {
  const boss = /BOSS|arena/.test(tag || '') || !spec.includes('@');
  const sec = +rounds * (boss ? 15 : 12) + (boss ? 30 : 15);
  if (map === 'postgame') { post.battle += sec; post.n++; continue; }
  if (SIDE.has(map)) { side.battle += sec; side.n++; }
  const c = ch(map); T[c] = T[c] || { battle: 0, n: 0, boss: 0 }; T[c].battle += sec; T[c].n++; if (boss) T[c].boss++;
}
const rows = []; let tot = 0, fast = 0;
for (const c of Object.keys(NAMES)) {
  const s = byCh[c] || {}, t = T[c] || { battle: 0, n: 0, boss: 0 };
  const talk = s.lines * 2.5 + s.chars * 0.12, walk = s.steps * 0.6, puz = (s.puzzles || 0) * 200;
  const sum = (talk + walk + puz + t.battle) * 1.1; tot += sum;
  // 快速玩家下限：快速點過對話（每句1.2秒＋每字0.05秒）、戰鬥多用自動（×0.6）、探索×0.5、謎題×0.5、選單5%
  const f = (s.lines * 1.2 + s.chars * 0.05 + walk * 0.5 + puz * 0.5 + t.battle * 0.6) * 1.05; fast += f;
  rows.push({ 章節: NAMES[c], 地圖: s.maps, 對話句: s.lines, 戰鬥: t.n, 頭目: t.boss, 謎題: s.puzzles, 對話分: (talk / 60).toFixed(0), 戰鬥分: (t.battle / 60).toFixed(0), 探索分: (walk / 60).toFixed(0), 謎題分: (puz / 60).toFixed(0), 合計分: (sum / 60).toFixed(0), 快速下限分: (f / 60).toFixed(0) });
}
console.table(rows);
console.log(`主線＋各章支線合計：約 ${(tot / 3600).toFixed(2)} 小時（${(tot / 60).toFixed(0)} 分）`);
console.log(`快速玩家（跳讀對話、多用自動戰鬥）下限：約 ${(fast / 3600).toFixed(2)} 小時`);
console.log(`其中支線地圖（蓼兒洼、黑風洞、演武場）戰鬥 ${side.n} 場 ≈ ${(side.battle / 60).toFixed(0)} 分`);
console.log(`通關後演武場挑戰 ${post.n} 場 ≈ ${(post.battle * 1.1 / 60).toFixed(0)} 分（另計）`);
