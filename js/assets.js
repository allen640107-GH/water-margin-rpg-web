// 圖片快取：img/<name>.webp 與 img/tok/<name>.webp
const cache = new Map();
let onLoadCb = null;
export function onAnyLoad(cb) { onLoadCb = cb; }
export function url(name, tok = false) { return `img/${tok ? 'tok/' : ''}${name}.webp`; }
export function img(name, tok = false) {
  const k = (tok ? 't:' : '') + name;
  let im = cache.get(k);
  if (!im) {
    im = new Image(); im.decoding = 'async';
    im.onload = () => { im._ok = true; onLoadCb && onLoadCb(); };
    im.onerror = () => { im._bad = true; };
    im.src = url(name, tok); cache.set(k, im);
  }
  return im;
}
export function ready(im) { return im && im._ok; }
export function preload(names, tok = false) {
  return Promise.all(names.map(n => new Promise(res => {
    const im = img(n, tok); if (im._ok || im._bad) return res();
    im.addEventListener('load', res, { once: true }); im.addEventListener('error', res, { once: true });
    setTimeout(res, 8000);
  })));
}
