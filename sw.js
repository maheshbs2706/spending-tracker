const CACHE = 'fst-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/db.js',
  '/manifest.json'
];
self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e)=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(cached=> cached || fetch(req).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=> c.put(req, copy));
      return res;
    }).catch(()=> cached))
  );
});