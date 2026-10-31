/* Service Worker - Couvoir SAMCHE
 * Active l'installabilité PWA + cache offline basique.
 * N'affecte pas l'interface visuelle, uniquement le réseau/cache.
 */

const CACHE_VERSION = "samche-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Ressources à mettre en cache au moment de l'installation
// ✅ Icônes PWA générées à partir de samche_icon_1024.png (sans déformation)
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-1024.png",
  "/apple-touch-icon.png",
  "/favicon-32.png",
  "/favicon-16.png",
  "/favicon.ico",
  "/icon.svg",
];

// --- Installation : pré-cache des ressources critiques ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        // On utilise addAll en best-effort : si une ressource manque,
        // on ne fait pas échouer toute l'installation.
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) =>
              console.warn("[SW] Pré-cache ignoré:", url, err.message)
            )
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// --- Activation : nettoyage des anciens caches ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// --- Fetch : stratégie network-first pour HTML, cache-first pour assets statiques ---
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignorer les requêtes non GET (POST, PUT, etc.) et les extensions de Chrome
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Stratégie network-first pour les navigations (HTML) => toujours frais
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              caches.match("/index.html") ||
              new OfflineFallback()
          )
        )
    );
    return;
  }

  // Cache-first pour les assets statiques (JS, CSS, images, polices)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Ne cacher que les réponses valides et same-origin / CORS OK
          if (
            response &&
            response.status === 200 &&
            (response.type === "basic" || response.type === "cors")
          ) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});

// Handler minimal pour message (permet au client de forcer activation immédiate)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Fallback offline minimal (n'apparaît que hors-ligne et page non cachée)
function OfflineFallback() {
  return new Response(
    "<!doctype html><html lang='fr'><head><meta charset='utf-8'>" +
      "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title>Hors ligne</title></head><body style='font-family:sans-serif;" +
      "padding:2rem;text-align:center'>" +
      "<h1>Vous êtes hors ligne</h1>" +
      "<p>Couvoir SAMCHE sera disponible dès que la connexion reviendra.</p>" +
      "</body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
