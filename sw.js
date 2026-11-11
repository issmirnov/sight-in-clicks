// Offline cache for Sight-In Clicks.
// Every launch gets the saved copy at once and fetches a fresh one for the next launch.
// Bump VERSION when you add or remove a file in SHELL. Edits to existing files need no bump.
const VERSION = "v1";
const PREFIX = "sight-in-";
const CACHE = PREFIX + VERSION;
const SHELL = [
  "./",
  "manifest.webmanifest",
  "install-qr.svg",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];
// Must match the stylesheet link in index.html.
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap";
// The page only uses the latin subset of each font.
const LATIN_FONT = /\/\*\s*latin\s*\*\/\s*@font-face\s*\{[^}]*?url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+)\)/g;
const SCOPE = new URL("./", self.location).href;
const SCOPE_PATH = new URL(SCOPE).pathname;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(path => new Request(path, { cache: "reload" })));
    await precacheFonts(cache);
    await self.skipWaiting();
  })());
});

// Best effort. Without the fonts the page still works, in system fonts.
async function precacheFonts(cache) {
  try {
    const response = await fetch(FONT_CSS, { cache: "no-cache" });
    if (!response.ok) return;
    const css = await response.clone().text();
    await cache.put(FONT_CSS, response);
    // The CSS lists one variable font file several times, and addAll rejects duplicates.
    const urls = new Set(Array.from(css.matchAll(LATIN_FONT), match => match[1]));
    await Promise.all(Array.from(urls, url => cache.add(url).catch(() => {})));
  } catch (_) {
    // Offline or blocked: the fetch handler caches the fonts on a later launch.
  }
}

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    // Other project sites share this origin and its caches, so delete only ours.
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    // The page itself, with or without ?install, comes from the copy saved under "./".
    const isPage = url.origin === self.location.origin &&
      (url.pathname === SCOPE_PATH || url.pathname === SCOPE_PATH + "index.html");
    if (isPage) staleWhileRevalidate(event, SCOPE);
    return;
  }
  if (url.href.startsWith(SCOPE) || url.origin === "https://fonts.googleapis.com") {
    staleWhileRevalidate(event, url.href);
  } else if (url.origin === "https://fonts.gstatic.com") {
    cacheFirst(event, url.href);
  }
});

// Answer from the cache at once and refresh the cache in the background.
// On a weak signal the launch never waits for the network.
function staleWhileRevalidate(event, key) {
  const cache = caches.open(CACHE);
  const network = fetch(key, { cache: "no-cache" }).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(cache.then(c => c.put(key, copy)));
    }
    return response;
  });
  event.waitUntil(network.then(() => {}, () => {}));
  event.respondWith(cache.then(c => c.match(key, { ignoreVary: true })).then(hit => hit || network));
}

// Font files never change at a given URL, so the network is only for a first fetch.
function cacheFirst(event, key) {
  const cache = caches.open(CACHE);
  event.respondWith(cache.then(c => c.match(key, { ignoreVary: true })).then(hit => hit || fetch(key).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(cache.then(c => c.put(key, copy)));
    }
    return response;
  })));
}
