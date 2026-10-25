/* Public offline shell only. Never cache account pages, API calls or messages. */
const SHELL="haven-public-shell-v1";
self.addEventListener("install",event=>{event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(["/offline.html","/icons/icon-192.png","/icons/icon-512.png"])));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("haven-public-shell-")&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/"))return;
  if(event.request.mode==="navigate")event.respondWith(fetch(event.request).catch(()=>caches.match("/offline.html")));
});
