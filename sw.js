/* Service worker du Carnet de voyage : garde l'app et ses bibliothèques
   pour fonctionner sans réseau. Les données, elles, sont gardées par
   Firestore (cache permanent) ou IndexedDB. Aucune tuile de carte n'est
   mise en cache à l'avance (politique d'usage OpenStreetMap). */
const VERSION = 'carnet-1.1.0';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon-180.png', './data/aeroports.json'];
const LIBS = [
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.mjs',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js',
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    // Bibliothèques : au mieux (une absence ne bloque pas l'installation)
    await Promise.all(LIBS.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Page : réseau d'abord (mises à jour), cache si hors ligne
  if (req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')))) {
    e.respondWith((async () => {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(req, { signal: ctl.signal }); clearTimeout(t);
        if (r.ok) { const c = await caches.open(VERSION); c.put('./index.html', r.clone()); }
        return r;
      } catch { return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error(); }
    })());
    return;
  }
  // Fichiers de l'app et bibliothèques CDN : cache d'abord, puis réseau
  if (url.origin === location.origin || CDN_HOSTS.includes(url.hostname)) {
    if (url.hostname === 'www.gstatic.com' && !url.pathname.startsWith('/firebasejs/')) return;
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok) { const c = await caches.open(VERSION); c.put(req, r.clone()); } return r; }
      catch { return Response.error(); }
    })());
  }
  // Tout le reste (Firestore, OpenStreetMap, OSRM, Nominatim, Open-Meteo…) : réseau direct
});
