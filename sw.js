const CACHE_NAME = 'black-echo-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// تثبيت التطبيق وتخزين الملفات الأساسية في الكاش لتسريع الفتح
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// تفعيل وتحديث الكاش عند وجود نسخة جديدة من التصميم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// إدارة الطلبات (Fetch Events)
self.addEventListener('fetch', event => {
  // هام جداً: استثناء ملف البيانات data.js من الكاش تماماً لضمان جلب التحديثات فوراً
  if (event.request.url.includes('data.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // نرجع النسخة المخزنة ونحدث الكاش في الخلفية للمرة القادمة
        fetch(event.request).then(networkResponse => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});