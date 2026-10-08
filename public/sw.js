// Service worker simples: guarda a "casca" do app para abrir mesmo sem internet.
// Nunca guarda chamadas ao Supabase/IA (sempre vão para a rede).
const CACHE = 'ai-novel-v1'
const SHELL = ['/', '/icon-192.png', '/icon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  // Páginas: rede primeiro, cache como reserva
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return r }).catch(() => caches.match('/')))
    return
  }
  // Arquivos estáticos do Next: cache primeiro
  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|jpg|webp|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r })))
  }
})
