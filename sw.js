/* The Ember — offline service worker (cache-first for reliable offline on iOS).
   Bump CACHE (e.g. ember-v34) whenever index.html changes so phones pull the new version. */
const CACHE = 'ember-v46';
const CORE = ['./', './index.html', './manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // App launches / page loads: serve the cached shell FIRST (works with zero network),
  // and quietly refresh it in the background when online.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(function (cached) {
        if (cached) {
          e.waitUntil(
            fetch(req).then(function (fresh) {
              return caches.open(CACHE).then(function (c) { return c.put('./index.html', fresh.clone()); });
            }).catch(function () {})
          );
          return cached;
        }
        return fetch(req).catch(function () { return caches.match('./'); });
      })
    );
    return;
  }

  // Everything else: cache first, then network (and cache what we fetch).
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          var cp = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, cp); });
        }
        return resp;
      }).catch(function () { return cached; });
    })
  );
});
