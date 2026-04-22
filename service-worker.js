/**
 * Service Worker — Universitarios FC v2.0
 * Handles caching, offline support, and background sync preparation
 */

const CACHE_NAME = 'ufc-v2-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/offline.html',
  '/css/main.css',
  '/css/admin.css',
  '/css/landing.css',
  '/css/chat.css',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

const FONT_CACHE = 'ufc-fonts-v1';
const IMAGE_CACHE = 'ufc-images-v1';
const API_CACHE = 'ufc-api-v1';

// ==================== INSTALL ====================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => {
          return new Request(url, { cache: 'reload' });
        })).catch(err => {
          console.warn('[SW] Some assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== FONT_CACHE && name !== IMAGE_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ==================== FETCH ====================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') return;

  // Google Fonts — Cache first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache => {
        return cache.match(request).then(cached => {
          return cached || fetch(request).then(response => {
            cache.put(request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // CDN resources (Chart.js, jsPDF, Firebase) — Stale while revalidate
  if (url.hostname.includes('cdn.') || url.hostname.includes('cdnjs.') || url.hostname.includes('gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(response => {
            cache.put(request, response.clone());
            return response;
          }).catch(() => cached);

          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // API requests (Groq, BCV) — Network first
  if (url.hostname.includes('groq.com') || url.hostname.includes('dolarapi') || url.hostname.includes('pydolarve')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(API_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images — Stale while revalidate
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache => {
        return cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(response => {
            cache.put(request, response.clone());
            return response;
          }).catch(() => cached);

          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // HTML pages — Network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('/offline.html'));
        })
    );
    return;
  }

  // Default — Cache first, then network
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ==================== BACKGROUND SYNC (prepared) ====================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
    // Future: sync offline changes to Firestore
  }
});

// ==================== PUSH NOTIFICATIONS (prepared) ====================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Universitarios FC';
  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    tag: data.tag || 'ufc-notification',
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/admin.html')
  );
});
