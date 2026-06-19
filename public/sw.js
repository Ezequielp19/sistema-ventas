const CACHE_NAME = "gestionpro-pwa-v1"
const PRECACHE_URLS = ["/", "/manifest.webmanifest", "/logonuevo.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedResponse = await caches.match("/")
        return cachedResponse || Response.error()
      }),
    )
    return
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request)
      return cachedResponse || Response.error()
    }),
  )
})
