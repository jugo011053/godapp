/* Root-scope SW — self-destruct.
   The real service worker lives at ./v8/sw.js.
   This file exists only so the browser picks up the update, wipes the old
   root-scope caches (preply-v7-*), and then unregisters itself so it never
   intercepts requests meant for the V8 sub-scope SW again. */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('preply-v7')).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});

/* No fetch handler — pass everything through to the network / V8 SW. */

