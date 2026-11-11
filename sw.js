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
// The font stylesheet holds back the page script until it loads. When it is not saved yet,
// a launch waits this long for it and then starts in system fonts.
const FONT_CSS_WAIT_MS = 2000;
// Installation spends at most this long saving the optional fonts, then goes on without them.
const FONT_PRECACHE_MS = 8000;
const SCOPE = new URL("./", self.location).href;
const SCOPE_PATH = new URL(SCOPE).pathname;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // redirect: "error" keeps a redirected copy out of the cache. Browsers refuse one for a page load.
    await cache.addAll(SHELL.map(path => new Request(path, { cache: "reload", redirect: "error" })));
    await precacheFonts(cache);
    await self.skipWaiting();
  })());
});

// Best effort and time-boxed. Without the fonts the page still works, in system fonts.
async function precacheFonts(cache) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FONT_PRECACHE_MS);
  try {
    const response = await fetch(FONT_CSS, { cache: "no-cache", signal: controller.signal });
    if (!response.ok) return;
    const css = await response.clone().text();
    await cache.put(FONT_CSS, response);
    // The CSS lists one variable font file several times, so deduplicate.
    const urls = new Set(Array.from(css.matchAll(LATIN_FONT), match => match[1]));
    await Promise.all(Array.from(urls, url =>
      fetch(url, { signal: controller.signal })
        .then(font => (font.ok ? cache.put(url, font) : undefined))
        .catch(() => {})));
  } catch (_) {
    // Offline, blocked or too slow: a later launch saves the fonts through the fetch handler.
  } finally {
    clearTimeout(timer);
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
    // With no saved copy, the browser loads the page itself and handles any redirect.
    const isPage = url.origin === self.location.origin &&
      (url.pathname === SCOPE_PATH || url.pathname === SCOPE_PATH + "index.html");
    if (isPage) staleWhileRevalidate(event, SCOPE, () => fetch(request));
    return;
  }
  if (url.href.startsWith(SCOPE)) {
    staleWhileRevalidate(event, url.href, refresh => refresh);
  } else if (url.origin === "https://fonts.googleapis.com") {
    staleWhileRevalidate(event, url.href, refresh => withDeadline(refresh, FONT_CSS_WAIT_MS, emptyStylesheet));
  } else if (url.origin === "https://fonts.gstatic.com") {
    cacheFirst(event, url.href);
  }
});

// Answer from the cache at once and refresh the cache in the background.
// On a weak signal a saved launch never waits for the network.
// onMiss(refresh) picks the answer when nothing is saved yet.
function staleWhileRevalidate(event, key, onMiss) {
  const cache = caches.open(CACHE);
  const refresh = fetch(key, { cache: "no-cache" }).then(response => {
    if (isSavable(response)) {
      const copy = response.clone();
      event.waitUntil(cache.then(c => c.put(key, copy)));
    }
    return response;
  });
  event.waitUntil(refresh.then(() => {}, () => {}));
  event.respondWith(cache.then(c => c.match(key, { ignoreVary: true })).then(hit => hit || onMiss(refresh)));
}

// Font files never change at a given URL, so the network is only for a first fetch.
function cacheFirst(event, key) {
  const cache = caches.open(CACHE);
  event.respondWith(cache.then(c => c.match(key, { ignoreVary: true })).then(hit => hit || fetch(key).then(response => {
    if (isSavable(response)) {
      const copy = response.clone();
      event.waitUntil(cache.then(c => c.put(key, copy)));
    }
    return response;
  })));
}

// A redirected copy is never saved: browsers refuse one for a page load.
function isSavable(response) {
  return response.ok && !response.redirected;
}

function withDeadline(promise, ms, fallback) {
  const late = new Promise(resolve => setTimeout(resolve, ms, null));
  return Promise.race([promise.catch(() => null), late]).then(response => response || fallback());
}

// Not saved, so the next launch tries Google again.
function emptyStylesheet() {
  return new Response("", { headers: { "Content-Type": "text/css" } });
}
