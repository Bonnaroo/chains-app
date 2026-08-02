/* ============================================================
   CHAINS — service worker (intentionally minimal).

   index.html calls navigator.serviceWorker.register('sw.js'). That
   file did not exist, so every load fired a 404 (Issue #10).

   This SW deliberately does NOT cache app assets. Chains ships as a
   single ~9.6MB index.html behind the GitHub Pages CDN, and we already
   fight version staleness there; a caching SW would pin users to an old
   build far harder and is exactly what we don't want. So: install,
   activate, take control, purge any caches a previous SW left behind,
   and otherwise stay out of the way. Every request goes to the network.
   ============================================================ */
self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (names) { return Promise.all(names.map(function (n) { return caches.delete(n); })); })
      .then(function () { return self.clients.claim(); })
      .catch(function () {})
  );
});

// No fetch handler on purpose — the browser goes straight to the network.
