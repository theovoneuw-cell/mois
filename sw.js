// Mois : service worker. Augmenter VERSION à chaque mise en ligne.
const VERSION = 'mois-1';
const FICHIERS = ['./', 'index.html', 'styles.css?v=1', 'js/icones.js?v=1', 'js/catalogue.js?v=1', 'js/app.js?v=1',
  'fonts/anybody.woff2', 'fonts/funnel-sans.woff2', 'fonts/funnel-display.woff2', 'manifest.webmanifest',
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
