// Mois : service worker. Augmenter VERSION à chaque mise en ligne.
const VERSION = 'mois-2';
const FICHIERS = ['./', 'index.html', 'styles.css?v=2', 'js/icones.js?v=2', 'js/catalogue.js?v=2', 'js/app.js?v=2',
  'fonts/bagel-fat-one.woff2', 'fonts/atkinson-next.woff2', 'manifest.webmanifest',
  'icons/icone-192.png', 'icons/icone-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// réseau d'abord pour la page (mises à jour rapides), cache d'abord pour le reste
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(VERSION).then((x) => x.put('index.html', c)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const c = r.clone(); caches.open(VERSION).then((x) => x.put(req, c)); return r; })));
});
