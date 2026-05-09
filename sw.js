// 最小Service Worker — オフライン時に index.html をキャッシュから返す
const CACHE = 'kakeibo-v2';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // 株価APIなど外部APIはキャッシュしない
  if (url.origin !== location.origin && !url.href.includes('cdn.jsdelivr.net')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      // CDNやアプリ本体のみキャッシュ
      if (resp.ok && (url.origin === location.origin || url.href.includes('cdn.jsdelivr.net'))) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return resp;
    }).catch(() => cached))
  );
});
