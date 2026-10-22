/* Browser-only transport: no document interception, upload, persistent cache or backend.
 * The build prepends an exact allowlist of original WASM URL -> gzip asset URL.
 * Original HTML, JS, integrity attributes and decoded WASM remain byte-identical.
 */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!Object.hasOwn(wasmRoutes,url.pathname))return;
 event.respondWith((async()=>{
  const route=wasmRoutes[url.pathname],parts=Array.isArray(route)?route:[route];
  const compressed=new ReadableStream({async start(controller){
   try{for(const part of parts){const response=await fetch(part);if(!response.ok)throw Error('Original application transport unavailable');const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;controller.enqueue(value);}}finally{reader.releaseLock();}}controller.close();}catch(error){controller.error(error);}
  }});
  return new Response(compressed.pipeThrough(new DecompressionStream('gzip')),{headers:{'Content-Type':'application/wasm','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'}});
 })());
});
