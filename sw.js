// ══════════════════════════════════════════
// SUNNAH DAILY — Service Worker v1.1
// ══════════════════════════════════════════
const CACHE_NAME = 'sunnah-daily-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── INSTALL — Cache all assets
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — Clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — Network-first for index.html (always get latest), cache-first for the rest
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const isHTML = event.request.mode === 'navigate' ||
    event.request.url.endsWith('/') ||
    event.request.url.endsWith('index.html');

  if (isHTML) {
    // Network-first: always try to fetch the latest app shell first
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, etc.)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// ── NOTIFICATION CLICK — Open app when user taps notif
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const prayer = event.notification.data?.prayer || '';
  const url = './?waktu=' + prayer;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // If app is already open, focus it
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'PRAYER_NOTIF_CLICK', prayer });
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});

// ── MESSAGE — Receive commands from main thread
self.addEventListener('message', event => {
  const { type, data } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'SCHEDULE_NOTIFS') {
    // Store schedule in SW scope for reference
    self._prayerSchedule = data;
    console.log('[SW] Prayer schedule received:', data);
  }

  if (type === 'SHOW_TEST_NOTIF') {
    self.registration.showNotification('🕌 Sunnah Daily — Test', {
      body: 'Notifikasi PWA berjaya! Alhamdulillah ✅',
      icon: './icon-192.png',
      badge: './icon-72.png',
      tag: 'test-notif',
      vibrate: [200, 100, 200],
    });
  }
});
