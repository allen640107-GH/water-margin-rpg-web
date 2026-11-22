// 招式 / 法術。target: enemy|enemies|ally|allies|self|dead ; kind: phys|mag|heal|buff|debuff|revive|steal
// power: 威力倍率；hits: 段數；rand: 隨機目標；st: 附加狀態 [id, 機率, 回合]；buff: {stat: 倍率}, turns
export const SKILLS = {
  attack: { name: '攻擊', mp: 0, target: 'enemy', kind: 'phys', power: 1.0, fx: 'slash' },
  // 林沖
  lin_spear: { name: '林家槍法', mp: 4, target: 'enemy', kind: 'phys', power: 1.7, fx: 'thrust', desc: '家傳槍法，單體重擊。' },
  lin_snow: { name: '風雪迴馬槍', mp: 9, target: 'enemies', kind: 'phys', power: 1.05, fx: 'sweep', desc: '回身一槍掃過敵陣，攻擊全體。' },
  lin_leopard: { name: '豹子突', mp: 10, target: 'enemy', kind: 'phys', power: 2.1, st: ['stun', 0.45, 1], fx: 'thrust', desc: '如豹撲擊，可能使敵暈眩。' },
  lin_drill: { name: '禁軍操練', mp: 14, target: 'allies', kind: 'buff', buff: { atk: 1.3, def: 1.15 }, turns: 3, fx: 'buff', desc: '教頭號令，全隊攻防提升。' },
  lin_wrath: { name: '山神廟之怒', mp: 22, target: 'enemy', kind: 'phys', power: 3.4, crit: 0.25, fx: 'big', desc: '雪夜積怨一槍爆發，極大傷害。' },
  // 魯智深
  lu_sweep: { name: '禪杖橫掃', mp: 5, target: 'enemies', kind: 'phys', power: 0.85, fx: 'sweep', desc: '六十二斤水磨禪杖，橫掃全體。' },
  lu_glare: { name: '金剛怒目', mp: 4, target: 'self', kind: 'buff', buff: { def: 1.5 }, taunt: true, turns: 3, fx: 'buff', desc: '引敵攻擊自己，並大幅提升防禦。' },
  lu_willow: { name: '倒拔垂楊柳', mp: 10, target: 'enemy', kind: 'phys', power: 2.6, fx: 'big', desc: '連根拔起楊柳的神力，單體巨擊。' },
  lu_drunk: { name: '醉打山門', mp: 12, target: 'enemies', kind: 'phys', power: 0.75, hits: 4, rand: true, fx: 'multi', desc: '醉中亂打四記，隨機命中。' },
  lu_vajra: { name: '坐化金身', mp: 18, target: 'self', kind: 'heal', power: 0.6, buff: { def: 1.6, atk: 1.3 }, turns: 3, fx: 'heal', desc: '回復自身大量體力並提升攻防。' },
  // 武松
  wu_fist: { name: '醉拳三連', mp: 4, target: 'enemy', kind: 'phys', power: 0.7, hits: 3, fx: 'multi', desc: '三記連拳。' },
  wu_tiger: { name: '打虎拳', mp: 6, target: 'enemy', kind: 'phys', power: 1.6, vs: ['beast', 2.0], fx: 'big', desc: '對猛獸傷害加倍。' },
  wu_drunken: { name: '酒神步', mp: 8, target: 'self', kind: 'buff', buff: { atk: 1.45, eva: 1.3 }, turns: 3, fx: 'buff', desc: '越醉越勇，提升攻擊與閃避。' },
  wu_twin: { name: '雙戒刀', mp: 11, target: 'enemy', kind: 'phys', power: 1.25, hits: 2, crit: 0.15, fx: 'slash', desc: '雙刀齊下，高暴擊。' },
  wu_blood: { name: '血濺鴛鴦樓', mp: 20, target: 'enemies', kind: 'phys', power: 1.6, fx: 'big', desc: '殺盡仇人，攻擊全體大傷害。' },
  // 晁蓋
  chao_pagoda: { name: '托塔一擊', mp: 5, target: 'enemy', kind: 'phys', power: 1.8, st: ['stun', 0.25, 1], fx: 'big', desc: '托起寶塔般的重擊。' },
  chao_guard: { name: '天王護陣', mp: 6, target: 'allies', kind: 'buff', buff: { def: 1.35 }, turns: 3, fx: 'buff', desc: '全隊防禦提升。' },
  chao_oath: { name: '七星聚義', mp: 14, target: 'allies', kind: 'heal', power: 0.35, buff: { atk: 1.2 }, turns: 3, fx: 'heal', desc: '全隊回復並提升攻擊。' },
  chao_king: { name: '天王怒', mp: 20, target: 'enemies', kind: 'phys', power: 1.5, fx: 'big', desc: '攻擊全體。' },
  // 吳用
  wy_chain: { name: '銅鏈纏', mp: 3, target: 'enemy', kind: 'mag', power: 1.3, st: ['stun', 0.3, 1], fx: 'chain', desc: '以銅鏈纏敵，可能使其暈眩。' },
  wy_weak: { name: '智取', mp: 6, target: 'enemies', kind: 'debuff', buff: { def: 0.7 }, turns: 3, fx: 'debuff', desc: '看穿破綻，敵全體防禦下降。' },
  wy_plan: { name: '運籌帷幄', mp: 10, target: 'allies', kind: 'buff', buff: { spd: 1.4, atk: 1.15 }, turns: 3, fx: 'buff', desc: '全隊速度、攻擊提升。' },
  wy_lure: { name: '調虎離山', mp: 12, target: 'enemy', kind: 'debuff', buff: { atk: 0.6 }, st: ['stun', 0.7, 1], turns: 3, fx: 'debuff', desc: '單體大幅減攻並高機率暈眩。' },
  wy_master: { name: '智多星', mp: 22, target: 'enemies', kind: 'mag', power: 2.0, st: ['stun', 0.35, 1], fx: 'chain', desc: '奇謀連環，全體傷害並可能暈眩。' },
  // 公孫勝
  gs_sword: { name: '祭劍', mp: 4, target: 'enemy', kind: 'mag', power: 1.6, fx: 'magic', desc: '飛劍攻擊單體。' },
  gs_rain: { name: '呼風喚雨', mp: 8, target: 'allies', kind: 'heal', power: 0.9, fx: 'heal', desc: '甘霖普降，全隊回復。' },
  gs_thunder: { name: '掌心雷', mp: 10, target: 'enemies', kind: 'mag', power: 1.35, fx: 'thunder', desc: '雷擊敵全體。' },
  gs_mist: { name: '霧遁', mp: 12, target: 'allies', kind: 'buff', buff: { eva: 1.5 }, turns: 3, fx: 'buff', desc: '濃霧掩護，全隊閃避提升。' },
  gs_wuleii: { name: '五雷天罡正法', mp: 26, target: 'enemies', kind: 'mag', power: 2.5, fx: 'thunder', desc: '羅真人親傳，天雷滅敵。' },
  // 阮小七
  rx_stab: { name: '魚叉連刺', mp: 4, target: 'enemy', kind: 'phys', power: 0.8, hits: 2, fx: 'thrust', desc: '兩連刺。' },
  rx_dive: { name: '水底擒龍', mp: 8, target: 'enemy', kind: 'phys', power: 2.0, st: ['stun', 0.35, 1], fx: 'water', desc: '拖敵落水，可能暈眩。' },
  rx_storm: { name: '鬧海', mp: 16, target: 'enemies', kind: 'phys', power: 1.4, fx: 'water', desc: '翻江倒海，全體攻擊。' },
  // 劉唐
  lt_cleave: { name: '朴刀斬', mp: 4, target: 'enemy', kind: 'phys', power: 1.8, fx: 'slash', desc: '單體重斬。' },
  lt_rage: { name: '赤髮狂', mp: 6, target: 'self', kind: 'buff', buff: { atk: 1.6, def: 0.8 }, turns: 3, fx: 'buff', desc: '狂暴：攻擊大增，防禦下降。' },
  lt_demon: { name: '赤髮鬼', mp: 14, target: 'enemies', kind: 'phys', power: 1.3, crit: 0.2, fx: 'big', desc: '鬼神般的全體斬擊。' },
  // 楊志
  yz_blade: { name: '祖傳寶刀', mp: 5, target: 'enemy', kind: 'phys', power: 1.6, crit: 0.35, fx: 'slash', desc: '削鐵如泥的寶刀，高暴擊。' },
  yz_glare: { name: '青面威', mp: 6, target: 'enemies', kind: 'debuff', buff: { atk: 0.75 }, turns: 3, fx: 'debuff', desc: '敵全體攻擊下降。' },
  yz_escort: { name: '押運陣', mp: 10, target: 'allies', kind: 'buff', buff: { def: 1.4 }, turns: 3, fx: 'buff', desc: '全隊防禦提升。' },
  yz_general: { name: '將門刀法', mp: 18, target: 'enemy', kind: 'phys', power: 1.3, hits: 3, crit: 0.3, fx: 'multi', desc: '三代將門絕學，三連斬。' },
  // 宋江
  sj_rain: { name: '及時雨', mp: 7, target: 'ally', kind: 'heal', power: 1.6, cure: true, fx: 'heal', desc: '單體大回復並解除異常。' },
  sj_command: { name: '號令', mp: 6, target: 'allies', kind: 'buff', buff: { atk: 1.25 }, turns: 3, fx: 'buff', desc: '全隊攻擊提升。' },
  sj_virtue: { name: '仁義', mp: 14, target: 'dead', kind: 'revive', power: 0.5, fx: 'heal', desc: '復活一名倒下的同伴。' },
  sj_banner: { name: '替天行道', mp: 24, target: 'allies', kind: 'heal', power: 1.2, buff: { atk: 1.2, def: 1.2 }, turns: 3, cure: true, fx: 'heal', desc: '杏黃旗下全隊大回復並提升攻防。' },
  // 李逵
  lk_axes: { name: '板斧亂劈', mp: 3, target: 'enemies', kind: 'phys', power: 0.9, acc: 0.85, fx: 'sweep', desc: '全體攻擊，命中稍低。' },
  lk_whirl: { name: '黑旋風', mp: 7, target: 'enemies', kind: 'phys', power: 0.85, hits: 4, rand: true, fx: 'multi', desc: '旋風般四連隨機斬。' },
  lk_reckless: { name: '莽撞', mp: 10, target: 'enemy', kind: 'phys', power: 3.0, self: 0.08, fx: 'big', desc: '不顧一切的巨擊，自身也會受傷。' },
  // 花榮
  hr_pierce: { name: '百步穿楊', mp: 4, target: 'enemy', kind: 'phys', power: 1.6, acc: 9, crit: 0.4, fx: 'arrow', desc: '必中，高暴擊。' },
  hr_volley: { name: '連珠箭', mp: 7, target: 'enemies', kind: 'phys', power: 0.75, hits: 3, rand: true, acc: 9, fx: 'arrow', desc: '三連隨機箭，必中。' },
  hr_goose: { name: '射雁', mp: 10, target: 'enemies', kind: 'phys', power: 1.15, acc: 9, fx: 'arrow', desc: '箭雨覆蓋全體。' },
  hr_rain: { name: '神臂穿雲', mp: 20, target: 'enemy', kind: 'phys', power: 3.6, acc: 9, crit: 0.5, fx: 'arrow', desc: '一箭穿雲，極大傷害。' },
  // 孫二娘
  se_knife: { name: '剔骨刀', mp: 4, target: 'enemy', kind: 'phys', power: 1.3, st: ['poison', 0.6, 3], fx: 'slash', desc: '傷害並可能中毒。' },
  se_drug: { name: '蒙汗藥', mp: 8, target: 'enemies', kind: 'debuff', st: ['sleep', 0.55, 2], fx: 'debuff', desc: '使敵全體可能昏睡。' },
  se_poison: { name: '人肉饅頭', mp: 10, target: 'enemies', kind: 'phys', power: 0.8, st: ['poison', 0.7, 3], fx: 'big', desc: '全體傷害並高機率中毒。' },
  se_feast: { name: '十字坡黑店', mp: 18, target: 'enemies', kind: 'mag', power: 1.6, st: ['sleep', 0.5, 2], fx: 'big', desc: '全體傷害並可能昏睡。' },
  // 張順
  zs_wave: { name: '翻浪刺', mp: 4, target: 'enemy', kind: 'phys', power: 1.5, fx: 'water', desc: '單體攻擊。' },
  zs_drown: { name: '溺水', mp: 8, target: 'enemy', kind: 'phys', power: 1.2, st: ['stun', 0.6, 1], fx: 'water', desc: '高機率暈眩。' },
  zs_white: { name: '浪裏白條', mp: 12, target: 'self', kind: 'buff', buff: { eva: 1.8, atk: 1.3 }, turns: 3, fx: 'buff', desc: '閃避與攻擊大幅提升。' },
  // 時遷
  sq_steal: { name: '妙手空空', mp: 3, target: 'enemy', kind: 'steal', power: 0.6, fx: 'slash', desc: '攻擊並偷取物品或銀兩。' },
  sq_flea: { name: '鼓上蚤', mp: 6, target: 'enemy', kind: 'phys', power: 0.7, hits: 3, crit: 0.2, fx: 'multi', desc: '身輕如蚤，三連擊。' },
  sq_smoke: { name: '煙遁', mp: 10, target: 'allies', kind: 'buff', buff: { eva: 1.4, spd: 1.3 }, turns: 3, fx: 'buff', desc: '全隊閃避與速度提升。' },

  // ── 敵人招式 ──
  e_bite: { name: '撕咬', target: 'enemy', kind: 'phys', power: 1.2, fx: 'claw' },
  e_poison: { name: '毒牙', target: 'enemy', kind: 'phys', power: 1.0, st: ['poison', 0.6, 3], fx: 'claw' },
  e_charge: { name: '猛衝', target: 'enemy', kind: 'phys', power: 1.6, fx: 'big' },
  e_shoot: { name: '放箭', target: 'enemy', kind: 'phys', power: 1.1, acc: 9, fx: 'arrow' },
  e_volley: { name: '亂箭齊發', target: 'enemies', kind: 'phys', power: 0.7, fx: 'arrow' },
  e_club: { name: '悶棍', target: 'enemy', kind: 'phys', power: 1.2, st: ['stun', 0.25, 1], fx: 'big' },
  e_chain: { name: '鐵鍊鎖拿', target: 'enemy', kind: 'phys', power: 0.8, st: ['stun', 0.35, 1], fx: 'chain' },
  e_sweep: { name: '橫掃', target: 'enemies', kind: 'phys', power: 0.8, fx: 'sweep' },
  e_guard: { name: '防守', target: 'self', kind: 'buff', buff: { def: 1.5 }, turns: 2, fx: 'buff' },
  e_roar: { name: '咆哮', target: 'enemies', kind: 'debuff', buff: { atk: 0.8 }, turns: 2, fx: 'debuff' },
  e_heal: { name: '包紮', target: 'self', kind: 'heal', power: 0.6, fx: 'heal' },
  e_drug: { name: '蒙汗藥酒', target: 'enemies', kind: 'debuff', st: ['sleep', 0.4, 2], fx: 'debuff' },
  e_fire: { name: '放火', target: 'enemies', kind: 'mag', power: 1.0, st: ['burn', 0.5, 3], fx: 'fire' },
  e_dagger: { name: '暗刀', target: 'enemy', kind: 'phys', power: 1.5, crit: 0.3, fx: 'slash' },
  e_rally: { name: '鼓舞', target: 'allies', kind: 'buff', buff: { atk: 1.3 }, turns: 3, fx: 'buff' },
  e_thrust: { name: '長槍突刺', target: 'enemy', kind: 'phys', power: 1.4, fx: 'thrust' },
  e_hook: { name: '撓鉤', target: 'enemy', kind: 'phys', power: 1.1, st: ['stun', 0.3, 1], fx: 'chain' },
  // 猛虎三招：一撲、一掀、一剪
  t_pounce: { name: '一撲', target: 'enemy', kind: 'phys', power: 1.7, fx: 'claw' },
  t_lift: { name: '一掀', target: 'enemies', kind: 'phys', power: 0.95, fx: 'sweep' },
  t_tail: { name: '一剪', target: 'enemy', kind: 'phys', power: 1.4, st: ['stun', 0.4, 1], fx: 'big' },
  t_roar: { name: '虎嘯山林', target: 'enemies', kind: 'debuff', buff: { atk: 0.75, spd: 0.8 }, turns: 2, fx: 'debuff' },
  b_wrestle: { name: '相撲摔', target: 'enemy', kind: 'phys', power: 1.9, st: ['stun', 0.3, 1], fx: 'big' },
  b_fan: { name: '扇底藏刀', target: 'enemy', kind: 'phys', power: 1.6, crit: 0.3, fx: 'slash' },
  b_hammer: { name: '流星錘', target: 'enemies', kind: 'phys', power: 1.2, st: ['stun', 0.25, 1], fx: 'big' },
  b_hammer1: { name: '鐵錘重擊', target: 'enemy', kind: 'phys', power: 2.2, fx: 'big' },
  b_slander: { name: '構陷', target: 'enemies', kind: 'debuff', buff: { def: 0.7, atk: 0.85 }, turns: 3, fx: 'debuff' },
  b_spear3: { name: '三連槍', target: 'enemy', kind: 'phys', power: 0.8, hits: 3, fx: 'thrust' },
};

// 狀態名稱
export const STATUS = {
  poison: { name: '中毒', color: '#6a2' }, stun: { name: '暈眩', color: '#ca2' }, sleep: { name: '昏睡', color: '#68c' },
  burn: { name: '灼燒', color: '#d52' }, taunt: { name: '挑釁', color: '#c33' },
};
