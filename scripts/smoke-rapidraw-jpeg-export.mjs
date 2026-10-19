// Bounded post-render codec QA. No original ExportPanel/full export/provider claim.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [wasmDir,nativeDir,output]=process.argv.slice(2);
if(!output)throw Error('WASM_DIR NATIVE_CODEC_REFERENCE_DIR REPORT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex');
const reference=JSON.parse(await readFile(path.join(nativeDir,'reference.json'),'utf8'));
const input=await readFile(path.join(nativeDir,'input.rgba8'));
assert.equal(hash(input),reference.inputRgba8Sha256);
assert.equal(input.length,reference.width*reference.height*4);
const wasm=await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe_bg.wasm'));
const assets=new Map([
 ['/', ['text/html','<!doctype html><title>Post-render JPEG codec QA</title>']],
 ['/input', ['application/octet-stream',input]],
 ['/engine.js',['text/javascript',await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe.js'))]],
 ['/engine.wasm',['application/wasm',wasm]],
 ['/worker.js',['text/javascript',`import init,{encode_rendered_rgba8_jpeg as encode} from '/engine.js';
 await init({module_or_path:'/engine.wasm'});let pixels;
 onmessage=({data:d})=>{try{if(d.input){pixels=new Uint8Array(d.input);postMessage({ready:true});return;}
 const bytes=encode(d.w,d.h,d.truncated?pixels.subarray(1):pixels,d.json);
 postMessage({bytes},[bytes.buffer]);}catch(e){postMessage({error:String(e)});}};
 postMessage({loaded:true});`]],
]);
const server=createServer((req,res)=>{
 const a=req.method==='GET'&&assets.get(req.url);
 if(!a){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'}).end(a[1]);
});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const errors=[],external=[],failed=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext();const origin=`http://127.0.0.1:${server.address().port}`;
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){external.push(u.origin);return route.abort();}
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(new URL(r.url()).pathname));
 await page.goto(origin);
 const result=await page.evaluate(async ref=>{
  const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const worker=new Worker('/worker.js',{type:'module'});
  let waiting;
  worker.onmessage=e=>{if(waiting){const resolve=waiting;waiting=null;resolve(e.data);}};
  const receive=()=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{worker.terminate();reject(Error('JPEG worker timeout'));},60000);
   waiting=r=>{clearTimeout(timer);resolve(r);};
  });
  const request=d=>{const p=receive();worker.postMessage(d);return p;};
  try{
   await receive();const bytes=await(await fetch('/input')).arrayBuffer();
   if(await digest(bytes)!==ref.inputRgba8Sha256)throw Error('Input hash mismatch');
   await request({input:bytes});
   const root=await navigator.storage.getDirectory();
   const dirName='jpeg-codec-qa-'+crypto.randomUUID();const dir=await root.getDirectoryHandle(dirName,{create:true});
   const cases=[];
   try{
    for(const c of ref.cases){
     const response=await request({w:ref.width,h:ref.height,json:JSON.stringify(c.settings)});
     if(response.error)throw Error(response.error);const b=response.bytes;
     const sha256=await digest(b);if(sha256!==c.sha256||b.length!==c.bytes)throw Error('Native JPEG mismatch');
     let icc=null,dpi=null,dimensions=null;
     for(let i=2;i<b.length;){
      if(b[i++]!==255)throw Error('Bad marker');const marker=b[i++];if(marker===218||marker===217)break;
      const length=b[i]*256+b[i+1],s=i+2;
      if(marker===224&&String.fromCharCode(...b.subarray(s,s+5))==='JFIF\0')dpi={unit:b[s+7],x:b[s+8]*256+b[s+9],y:b[s+10]*256+b[s+11]};
      if(marker===226&&String.fromCharCode(...b.subarray(s,s+12))==='ICC_PROFILE\0')icc=b.slice(s+14,i+length);
      if(marker===192)dimensions={width:b[s+3]*256+b[s+4],height:b[s+1]*256+b[s+2]};
      i+=length;
     }
     if(!icc||icc.length!==736||!dimensions)throw Error('Missing native ICC/dimensions');
     if(c.settings.dpi&&(dpi.unit!==1||dpi.x!==c.settings.dpi||dpi.y!==c.settings.dpi))throw Error('DPI mismatch');
     const decoded=await createImageBitmap(new Blob([b],{type:'image/jpeg'}));
     if(decoded.width!==dimensions.width||decoded.height!==dimensions.height)throw Error('JPEG decode mismatch');decoded.close();
     const handle=await dir.getFileHandle(c.file,{create:true});
     const writable=await handle.createWritable();let success=false;
     await writable.write(b);const beforeClose=success;
     await writable.close();const readback=new Uint8Array(await(await handle.getFile()).arrayBuffer());
     if(await digest(readback)!==sha256)throw Error('Write readback mismatch');success=true;
     cases.push({settings:c.settings,bytes:b.length,sha256,...dimensions,iccSha256:await digest(icc),dpi,write:{kind:'OPFS QA only',beforeClose,closeAcknowledged:success,readbackExact:true}});
    }
    // Real aborted OPFS write cannot produce a success ACK; keep recoverable bytes.
    const retained=(await request({w:ref.width,h:ref.height,json:'{"jpegQuality":90}'})).bytes;
    const uncertain=await dir.getFileHandle('aborted.jpg',{create:true});const stream=await uncertain.createWritable();
    await stream.write(retained);await stream.abort();
    const abort={success:false,retainedBytes:retained.length,persistedBytes:(await uncertain.getFile()).size,replayed:false};
    const refusals=[];
    for(const d of [
     {w:0,h:ref.height,json:'{"jpegQuality":90}'},
     {w:8192,h:8192,json:'{"jpegQuality":90}'},
     {w:ref.width,h:ref.height,truncated:true,json:'{"jpegQuality":90}'},
     ...['{}','{','{"jpegQuality":0}','{"jpegQuality":90,"dpi":0}','{"jpegQuality":90,"dpi":65536}','{"jpegQuality":90,"keepMetadata":true}',
      '{"jpegQuality":90,"resize":{"mode":"width","value":32768,"dontEnlarge":false}}',
      '{"jpegQuality":90,"resize":{"mode":"height","value":4096,"dontEnlarge":false}}'].map(json=>({w:ref.width,h:ref.height,json}))
    ]){const r=await request(d);if(!r.error)throw Error('Invalid export accepted');refusals.push(r.error);}
    const recovered=await request({w:ref.width,h:ref.height,json:JSON.stringify(ref.cases[0].settings)});
    if(await digest(recovered.bytes)!==ref.cases[0].sha256)throw Error('Codec recovery failed');
    return {width:ref.width,height:ref.height,inputRgba8Sha256:ref.inputRgba8Sha256,cases,refusals,abort,recovered:true};
   }finally{await root.removeEntry(dirName,{recursive:true});}
  }finally{worker.terminate();}
 },reference);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);
 assert.equal(result.abort.persistedBytes,0);assert.ok(result.cases.every(c=>!c.write.beforeClose));
 await writeFile(output,JSON.stringify({scope:'Post-render codec on real full native public-DNG pixels. OPFS write/close/readback QA; not original ExportPanel, browser full GPU pipeline, OS destination permission or export_images acceptance.',wasmSha256:hash(wasm),...result,pageErrors:errors,externalRequests:external,failedRequests:failed},null,2)+'\n');
 console.log(JSON.stringify({cases:result.cases.length,matchedBytes:result.cases.reduce((n,c)=>n+c.bytes,0),refusals:result.refusals.length,recovered:result.recovered}));
 await context.close();
}finally{await browser?.close();server.close();}
