// Service Worker Entre Quarts — cache-first sur l'app shell, network-first sur JSONBin
const CACHE_NAME = 'entre-quarts-v1';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    'https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://unpkg.com/lucide@0.344.0/dist/umd/lucide.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // On essaie d'ajouter mais on ne fail pas si un asset externe n'est pas atteignable
            return Promise.allSettled(APP_SHELL.map(url => cache.add(url).catch(() => null)));
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    // JSONBin → network-first (données toujours fraîches)
    if (url.hostname === 'api.jsonbin.io') {
        event.respondWith(
            fetch(event.request).catch(() => new Response(JSON.stringify({ record: null }), {
                headers: { 'Content-Type': 'application/json' }
            }))
        );
        return;
    }
    // Reste : cache-first puis network
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(resp => {
                // Met en cache à la volée
                if (resp.ok && event.request.method === 'GET') {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(()=>{});
                }
                return resp;
            }).catch(() => cached || new Response('Hors ligne', { status: 503 }));
        })
    );
});
