const CACHE_NAME = 'keep-fit-v3-local-assets';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
  )));
  self.clients.claim();
});

const canCache = (request, response) => {
  if (!response || !response.ok || response.type !== 'basic') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin
    && ['script', 'style', 'image', 'font', 'video'].includes(request.destination);
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Notion proxy 和 AI 响应一律 Network Only，禁止读取或写入 Cache Storage。
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // 页面使用 Network First，离线时才回退到已缓存的 app shell。
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', response.clone()));
      return response;
    }).catch(() => caches.match('/index.html')));
    return;
  }

  // 同源静态资源使用 Cache First，并在首次网络成功后写入当前版本缓存。
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (canCache(request, response)) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});

// ── Web Push ────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Keep Fit';
  const body = data.body || '该训练了！';
  event.waitUntil(self.registration.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/'));
});
