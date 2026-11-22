// 地圖資料小工具
export const npc = (name, img, talk, o = {}) => ({ type: 'npc', name, img, talk, ...o });
export const foe = (spec, o = {}) => ({ type: 'foe', foe: spec, ...o });
export const boss = (spec, name, o = {}) => ({ type: 'foe', foe: spec, boss: true, name, noEscape: true, ...o });
export const exit = (to, at, label, o = {}) => ({ type: 'exit', to, at, label, ...o });
export const chest = (item, n = 1, o = {}) => ({ type: 'chest', item, n, ...o });
export const money = (gold, o = {}) => ({ type: 'chest', gold, ...o });
export const entry = id => ({ type: 'entry', id });
export const sign = (text, o = {}) => ({ type: 'sign', text, ...o });
export const trig = (script, o = {}) => ({ type: 'trig', script, ...o });
export const gate = (open, text, o = {}) => ({ type: 'gate', open, text, ...o });
export const boulder = (o = {}) => ({ type: 'boulder', ...o });
export const plate = (o = {}) => ({ type: 'plate', ...o });
export const reset = (o = {}) => ({ type: 'reset', name: '重擺石頭', ...o });
export const obj = (img, text, o = {}) => ({ type: 'obj', img, text, ...o });
export const sw = (flag, script, o = {}) => ({ type: 'switch', flag, script, ...o });
