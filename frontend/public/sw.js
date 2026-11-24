// Retired service worker.
// Older versions of the app cached the HTML shell forever, which left users on
// a stale page after every deploy. This version removes every cache, unregisters
// itself and reloads open tabs once, then the app runs without a service worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
