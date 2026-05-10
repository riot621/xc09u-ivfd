// Service Worker — network-first for HTML, cache-first for CDN assets
// HTML を常に最新版から取得することで、デプロイ後すぐに新しいバージョンが反映される
const CACHE = 'kakeibo-v3';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 株価APIなど外部APIはキャッシュ介在しない
  const isOwnOrigin = url.origin === location.origin;
  const isCdn = url.href.includes('cdn.jsdelivr.net');
  if (!isOwnOrigin && !isCdn) return;

  // HTML / ナビゲーションは network-first (常に最新版を取りに行き、失敗時のみキャッシュを返す)
  const accept = req.headers.get('accept') || '';
  const isHtml = req.mode === 'navigate'
    || accept.includes('text/html')
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('/');
  if (isOwnOrigin && isHtml) {
    e.respondWith(
      fetch(req).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // それ以外 (CDN / 静的アセット) は cache-first
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      if (resp && resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return resp;
    }).catch(() => cached))
  );
});

// クライアント側からの強制更新リクエストに対応
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
