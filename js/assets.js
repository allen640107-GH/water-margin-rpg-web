// 圖片快取：img/<name>.webp（子資料夾如 spr/、map/ 直接寫在名稱中）
const cache = new Map();
let onLoadCb = null;
export function onAnyLoad(cb) { onLoadCb = cb; }
export function url(name) { return `img/${name}.webp`; }
export function img(name) {
  let im = cache.get(name);
  if (!im) {
    im = new Image(); im.decoding = 'async';
    im.onload = () => { im._ok = true; onLoadCb && onLoadCb(); };
    im.onerror = () => { im._bad = true; };
    im.src = url(name); cache.set(name, im);
  }
  return im;
}
export function ready(im) { return im && im._ok; }
export function preload(names) {
  return Promise.all(names.map(n => new Promise(res => {
    const im = img(n); if (im._ok || im._bad) return res();
    im.addEventListener('load', res, { once: true }); im.addEventListener('error', res, { once: true });
    setTimeout(res, 8000);
  })));
}
