/* 宝贝Math小跑计划 — Service Worker（离线缓存，可“添加到主屏幕”当 App） */
const CACHE = 'mathsprint-v21';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // cache:'reload' 绕过浏览器 HTTP 缓存，确保预缓存拿到最新文件
      .then(c => {
        const scope = self.registration.scope;
        return Promise.all(ASSETS.map(u => {
          const abs = new URL(u, scope).href;
          return fetch(new Request(abs, {cache:'reload'}))
            .then(res => { if (res && res.ok) return c.put(abs, res); })
            .catch(() => {});
        }));
      })
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

function isHTML(req){
  if (req.mode === 'navigate') return true;
  const acc = req.headers.get('accept') || '';
  if (acc.indexOf('text/html') >= 0) return true;
  const p = new URL(req.url).pathname;
  return p.endsWith('/') || p.endsWith('.html');
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  // 页面(HTML)：网络优先 —— 保证总是看到最新版本，离线时回退缓存
  if (isHTML(e.request)) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 其它静态资源：缓存优先
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
