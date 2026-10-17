/* Browser-only transport: no document interception, upload, persistent cache or backend.
 * The build prepends an exact allowlist of original WASM URL -> gzip asset URL.
 * Original HTML, JS, integrity attributes and decoded WASM remain byte-identical.
 */
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!Object.hasOwn(wasmRoutes,url.pathname))return;
 event.respondWith((async()=>{
  const response=await fetch(wasmRoutes[url.pathname]);
  if(!response.ok)return new Response('Original application transport unavailable',{status:502});
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip')),{headers:{'Content-Type':'application/wasm','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'}});
 })());
});
