/* ── Lunartide Service Worker ──
   Cache app shell for offline access.
   Do NOT cache user data (API responses, localStorage is client-side). */

const CACHE_NAME = 'lunartide-v3'
const OLD_APP_SHELL_CACHES = new Set(['lunartide-v1', 'lunartide-v2', 'lunartide-app-shell-v1'])
const APP_BASE = new URL('./', self.registration.scope)
const INDEX_URL = new URL('index.html', APP_BASE).href
const APP_SHELL = [
  new URL('./', APP_BASE).href,
  INDEX_URL,
  new URL('manifest.json', APP_BASE).href,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => OLD_APP_SHELL_CACHES.has(key))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }

  // Network-first navigation keeps deployed routes fresh, with app shell fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok && new URL(response.url).origin === self.location.origin && response.headers.get('content-type')?.includes('text/html')) {
          try {
            const cache = await caches.open(CACHE_NAME)
            await cache.put(INDEX_URL, response.clone())
          } catch { /* Online navigation must not depend on cache availability. */ }
        }
        return response
      }).catch(async () => {
        try { return (await (await caches.open(CACHE_NAME)).match(INDEX_URL)) || Response.error() }
        catch { return Response.error() }
      })
    )
    return
  }

  // Static assets are cache-first and never reject the FetchEvent promise.
  if (
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/icons/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith((async () => {
      let cache
      try { cache = await caches.open(CACHE_NAME) } catch { /* Network remains usable. */ }
      const cached = await cache?.match(request).catch(() => null)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) cache?.put(request, response.clone()).catch(() => {})
        return response
      } catch { return Response.error() }
    })())
  }
})
