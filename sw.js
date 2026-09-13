/* MEDPlanner — Service Worker (modo offline)
   Estrategia:
   - A PAGINA (index.html) usa "rede primeiro": com internet voce SEMPRE recebe a
     versao mais nova publicada; sem internet, entra a copia guardada.
   - Bibliotecas externas (fontes, Chart.js, Firebase) ficam guardadas e sao
     atualizadas em segundo plano.
   - Firebase/Firestore (dados e login) NUNCA passam pelo cache.
   - Se o navegador nao deixar usar cache, o app continua funcionando normal
     (so perde o offline) — nenhum erro aqui pode quebrar o planner. */
const VERSION = 'v1';
const SHELL   = 'medplanner-app-' + VERSION;
const LIBS    = 'medplanner-libs-' + VERSION;
const SHELL_URLS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'];

const LIB_HOSTS = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|www\.gstatic\.com)$/;
const NUNCA_CACHE = /firestore|identitytoolkit|securetoken|firebaseinstallations|firebaselogging|firebaseio|google-analytics|googletagmanager/;

function safeOpen(nome){ return caches.open(nome).catch(() => null); }
function safeMatch(req){ return caches.match(req).catch(() => null); }
function safePut(nome, req, res){
  return safeOpen(nome).then(c => c && c.put(req, res)).catch(() => {});
}

self.addEventListener('install', e => {
  e.waitUntil(
    safeOpen(SHELL)
      .then(c => c ? Promise.all(SHELL_URLS.map(u =>
          c.add(new Request(u, {cache:'reload'})).catch(() => {})
        )) : null)
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== LIBS).map(k => caches.delete(k).catch(()=>{}))))
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

// Rede primeiro (com limite de tempo); se falhar ou demorar, usa o cache.
function networkFirst(req, cacheName, timeoutMs) {
  return new Promise(resolve => {
    let pronto = false;
    const doCache = () => safeMatch(req)
      .then(r => r || safeMatch('./index.html'))
      .then(r => r || new Response('<h1>Sem conex&atilde;o</h1><p>Abra o MEDPlanner uma vez com internet para poder usar offline.</p>',
                                   {status:503, headers:{'Content-Type':'text/html; charset=utf-8'}}));
    const timer = setTimeout(() => { if (!pronto) { pronto = true; doCache().then(resolve); } }, timeoutMs || 6000);
    fetch(req).then(res => {
      if (res && res.ok) safePut(cacheName, req, res.clone());
      if (!pronto) { pronto = true; clearTimeout(timer); resolve(res); }
    }).catch(() => {
      if (!pronto) { pronto = true; clearTimeout(timer); doCache().then(resolve); }
    });
  });
}

// Devolve o cache na hora e atualiza em segundo plano.
function staleWhileRevalidate(req, cacheName) {
  return safeMatch(req).then(cached => {
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) safePut(cacheName, req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) return cached;
    return net.then(r => r || Response.error());
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Login e dados: sempre direto na rede (nunca cachear).
  if (NUNCA_CACHE.test(url.hostname)) return;

  // A pagina do app.
  if (req.mode === 'navigate' || (url.origin === self.location.origin && /\.html?$/.test(url.pathname))) {
    e.respondWith(networkFirst(req, SHELL, 6000));
    return;
  }
  // Outros arquivos do proprio site (icones, manifest).
  if (url.origin === self.location.origin) { e.respondWith(staleWhileRevalidate(req, SHELL)); return; }

  // Bibliotecas externas usadas pelo app.
  if (LIB_HOSTS.test(url.hostname)) e.respondWith(staleWhileRevalidate(req, LIBS));
});
