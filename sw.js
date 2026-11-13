// Kaizen : met en cache l'interface pour une ouverture rapide, même hors ligne.
var CACHE = 'kaizen-v2.2.1';
var SHELL = ['./', 'index.html', 'styles.css', 'moves.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })); self.clients.claim(); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // les appels au Sheet passent toujours par le réseau
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (x) { x.put(e.request, c); }); return r; }).catch(function () { return caches.match(e.request); }));
});
