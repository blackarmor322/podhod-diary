const version = '2766bc31ce0e59b2';
const cacheName = 'podhod-shell-' + version;
const root = new URL('./', self.registration.scope);
const files = ['', 'style.css?v=' + version, 'app.js?v=' + version, 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const shell = new Set(files.map(file => new URL(file, root).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    [...shell].map(url => new Request(url, { cache: 'reload' }))
  )).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('podhod-shell-') && key !== cacheName).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== root.origin) return;
  if (event.request.mode === 'navigate' && url.pathname === root.pathname) {
    event.respondWith(fetch(event.request).catch(() => caches.open(cacheName).then(cache => cache.match(root.href))));
    return;
  }
  if (shell.has(url.href)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(url.href)) || fetch(event.request)));
  }
});
