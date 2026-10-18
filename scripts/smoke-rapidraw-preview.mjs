// Exact native JPEG/envelope proof on the already-verified public RAW render.
// Exercises the pinned original hook's reader excerpts, not a mounted React UI.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';
const [wasmDir,nativeDir,output]=process.argv.slice(2);
if(!wasmDir||!nativeDir||!output)throw Error('WASM_DIR NATIVE_PREVIEW_DIR OUTPUT_JSON');
const core=new URL('../experiments/rapidraw-wasm-core/',import.meta.url);
const digest=b=>createHash('sha256').update(b).digest('hex');
const reference=JSON.parse(await readFile(path.join(nativeDir,'reference.json'),'utf8'));
const prior=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/global-render-png.json',import.meta.url),'utf8'));
assert.equal(reference.source,prior.nativeSource);
assert.equal(reference.nativeRenderedPngSha256,prior.frames[0].png.sha256,'Only the verified public RAW rendered PNG is admitted');
assert.equal(reference.cases[0].rgbaSha256,prior.frames[0].sha256);
assert.equal(reference.cases.length,4);
const upstream=JSON.parse(await readFile(new URL('UPSTREAM.json',core),'utf8'));
const reader=await readFile(new URL('tests/reference/preview-reader.js',core));
assert.equal(digest(reader),upstream.preview.reactReader.referenceSha256);
const wasm=await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe_bg.wasm'));
const assets=new Map([
 ['/', ['text/html',Buffer.from('<!doctype html><title>Original RapidRAW preview format proof</title>')]],
 ['/reader.js',['text/javascript',reader]],
 ['/webgpu-renderer.js',['text/javascript',await readFile(new URL('webgpu-renderer.js',core))]],
 ['/cw_rapidraw_wasm_probe.js',['text/javascript',await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe.js'))]],
 ['/cw_rapidraw_wasm_probe_bg.wasm',['application/wasm',wasm]],
]);
for(const [i,c] of reference.cases.entries()){
 assert.equal(c.input,`frame-${i}.rgba`);assert.equal(c.output,`frame-${i}.response`);
 const pixels=await readFile(path.join(nativeDir,c.input));const response=await readFile(path.join(nativeDir,c.output));
 assert.equal(digest(pixels),c.rgbaSha256);assert.equal(digest(response),c.sha256);assert.equal(response.length,c.bytes);
 assets.set(`/frame-${i}.rgba`,['application/octet-stream',pixels]);
 assets.set(`/frame-${i}.response`,['application/octet-stream',response]);
}
const server=createServer((req,res)=>{
 const a=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);
 if(!a){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'}).end(a[1]);
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;const pageErrors=[],failedRequests=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext();const page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await Promise.race([page.evaluate(async cases=>{
  const wasm=await import('/cw_rapidraw_wasm_probe.js');await wasm.default();
  const {encodePreviewResponse}=await import('/webgpu-renderer.js');
  const reader=await import('/reader.js');
  const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const frames=[];
  for(const [i,c] of cases.entries()){
   const pixels=new Uint8Array(await(await fetch(`/frame-${i}.rgba`)).arrayBuffer());
   const frame={width:c.width,height:c.height,pixels,format:'rgba8unorm'};
   const response=encodePreviewResponse(wasm,frame,c);
   if(!(response instanceof ArrayBuffer))throw Error('Original hook requires ArrayBuffer');
   const native=new Uint8Array(await(await fetch(`/frame-${i}.response`)).arrayBuffer());
   const bytes=new Uint8Array(response);let exact=0;
   if(bytes.length!==native.length)throw Error('Native preview length differs');
   bytes.forEach((v,j)=>{if(v!==native[j])throw Error(`Native JPEG/envelope byte mismatch at${j}`);exact++;});
   const decoded=c.interactive?reader.readInteractive(response):reader.readFinal(response);
   try{
    const bitmap=await createImageBitmap(decoded.blob);
    if(bitmap.width!==c.width||bitmap.height!==c.height)throw Error('JPEG decoded dimensions differ');bitmap.close();
    const img=new Image();img.src=decoded.url;await img.decode();
    if(img.naturalWidth!==c.width||img.naturalHeight!==c.height)throw Error('Original hook object URL failed');
    img.removeAttribute('src');
    frames.push({width:c.width,height:c.height,quality:c.quality,interactive:c.interactive,
      rect:decoded.rect??null,bytes:bytes.length,sha256:await hash(bytes),exactNativeBytes:exact,
      mime:decoded.blob.type,bitmapDecoded:true,objectUrlDecoded:true});
   }finally{URL.revokeObjectURL(decoded.url);}
  }
  let rejected=0;
  for(const [w,h,p,q,i,x,y,fw,fh] of [
   [0,1,[],94,false,0,0,0,1],[1,1,[0,0,0],94,false,0,0,1,1],
   [1,1,[0,0,0,0],94,false,1,0,2,1],[1,1,[0,0,0,0],75,false,0,0,1,1],
   [1,1,[0,0,0,0],94,true,0,0,1,1],[1,1,[0,0,0,0],75,true,4294967295,0,1,1],
   [1,1,[0,0,0,0],75,true,1,0,1,1],[1,1,[0,0,0,0],75,true,0,1,1,1],
   [1,1,[0,0,0,0],75,true,0,0,32768,32768],[32769,1,[],94,false,0,0,32769,1]
  ]){try{wasm.encode_preview_response(w,h,new Uint8Array(p),q,i,x,y,fw,fh);}catch{rejected++;}}
  return {frames,rejectedInvalidInputs:rejected};
 },reference.cases),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('JPEG browser proof timed out')),60000);timer.unref();})]);
 assert.equal(result.rejectedInvalidInputs,10);assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);
 for(const [i,f] of result.frames.entries()){
  const c=reference.cases[i];assert.equal(f.sha256,c.sha256);assert.equal(f.exactNativeBytes,c.bytes);
  assert.deepEqual(f.rect,c.interactive?[c.x,c.y,c.width,c.height,c.fullWidth,c.fullHeight]:null);
 }
 const report={stage:'RWASM-03 original JPEG preview codec and interactive envelope',nativeSource:reference.source,
  publicFixture:prior.publicFixture,nativeRenderedPngSha256:reference.nativeRenderedPngSha256,
  inputRgbaSha256:reference.cases[0].rgbaSha256,wasmSha256:digest(wasm),browserVersion:browser.version(),
  chromiumSandbox:true,codec:upstream.preview.codecDependencies,reactReader:upstream.preview.reactReader,
  ...result,pageErrors,failedRequests,
  scope:'Real public RAW rendered EightBit pixels encoded with original BaselineFastest fast_color quality and original hook reader excerpts. Not a mounted React editor or resize/ROI render/cache/cancel/provider acceptance.'};
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 await context.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
