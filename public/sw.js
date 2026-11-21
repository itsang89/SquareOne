/* global self, caches, fetch, URL */
// Offline app shell. Registered with ?v=<entry chunk path>, so every deploy installs a fresh copy.
// Pages: network first, cached copy when offline. Hashed assets and fonts: cache first.
// Supabase and other cross-origin calls are never touched.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `squareone-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Precache every built file (incl. lazy screens) so any screen opens offline.
    const manifest = await (await fetch('/asset-manifest.json', { cache: 'no-store' })).json();
    const files = new Set(['/']);
    for (const chunk of Object.values(manifest)) {
      [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])].forEach((f) => files.add(`/${f}`));
    }
    await cache.addAll([...files]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !font) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (res) => {
          // Only a good page replaces the cached shell; on a 5xx serve the shell we have.
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res; }
          return (await caches.match('/', { ignoreVary: true })) ?? res;
        })
        .catch(() => caches.match('/', { ignoreVary: true })),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => hit ?? fetch(request).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
      return res;
    })),
  );
});
