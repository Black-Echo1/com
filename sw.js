const CACHE_NAME = 'black-echo-v5';
const PRECACHE_URLS = [
    './',
    './index.html',
    './css/style.css',
    './data/site.js',
    './manifest.json',
    './offline.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;
const isDataFile = (request) => /\/data\/(?:anime_db|catalog_data|data)\.js(?:$|\?)/.test(new URL(request.url).pathname);
const isStaticAsset = (request) => /\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?|json|xml|txt)$/i.test(new URL(request.url).pathname);

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    } catch (_) {
        return caches.match(request) || caches.match('./offline.html');
    }
}

async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);
    const update = fetch(request).then(async (response) => {
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    }).catch(() => null);
    return cached || (await update) || Response.error();
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || !isSameOrigin(request)) return;

    // قاعدة الحلقات الكبيرة والبيانات المتغيرة لا تُخزّن بنسخة قديمة.
    if (isDataFile(request)) {
        event.respondWith(fetch(request));
        return;
    }

    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(networkFirst(request));
        return;
    }

    if (isStaticAsset(request)) {
        event.respondWith(staleWhileRevalidate(request));
    }
});
