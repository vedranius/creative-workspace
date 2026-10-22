// Real public RAW -> full original Basic renderer -> JPEG. No editor/provider claim.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [wasmDir,rawFile,nativeReference,output]=process.argv.slice(2);
if(!output)throw Error('WASM_DIR PUBLIC_CC0_DNG NATIVE_REFERENCE_JSON OUTPUT_JSON');
const core=new URL('../experiments/rapidraw-wasm-core/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const pin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url),'utf8')).fixtures.find(f=>f.id==='raw.pixls.us 1327');
const raw=await readFile(rawFile);assert.equal(pin.license,'CC0-1.0');assert.equal(hash(raw),pin.sourceSha256);
const reference=JSON.parse(await readFile(nativeReference,'utf8'));
const upstream=JSON.parse(await readFile(new URL('UPSTREAM.json',core),'utf8'));
const nativeRoot=process.env.RAPIDRAW_NATIVE_SOURCE;if(!nativeRoot)throw Error('RAPIDRAW_NATIVE_SOURCE required for pinned defaults');
const defaults=await readFile(path.join(nativeRoot,'src/utils/defaultAdjustments.json'));
assert.equal(hash(defaults),upstream.reactUi.sourceFiles['src/utils/defaultAdjustments.json']);
const wasm=await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe_bg.wasm'));
const assets=new Map([
 ['/', ['text/html','<!doctype html><title>Isolated full export proof</title>']],
 ['/public.dng',['application/octet-stream',raw]],
 ['/defaultAdjustments.json',['application/json',defaults]],
 ['/cw_rapidraw_wasm_probe.js',['text/javascript',await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe.js'))]],
 ['/cw_rapidraw_wasm_probe_bg.wasm',['application/wasm',wasm]],
]);
for(const f of ['export-client.js','export-worker.js','webgpu-renderer.js','shader.wgsl'])assets.set('/'+f,[f.endsWith('.js')?'text/javascript':'text/plain',await readFile(new URL(f,core))]);
const server=createServer((req,res)=>{const a=req.method==='GET'&&assets.get(req.url);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'}).end(a[1]);});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const pageErrors=[],failedRequests=[],externalRequests=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext();const origin=`http://127.0.0.1:${server.address().port}`;
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){externalRequests.push(u.origin);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));await page.goto(origin);
 const result=await page.evaluate(async ref=>{
  const {exportRawInWorker}=await import('/export-client.js');
  const host=await import('/webgpu-renderer.js');
  const raw=await(await fetch('/public.dng')).arrayBuffer();
  const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('No WebGPU');
  const device=await adapter.requestDevice();let previewRefused=false;
  try{host.createNeutralRendererResources(device,{width:2048,height:1536,inputRgbaF16:new Uint16Array(0)});}catch(e){previewRefused=String(e).includes('bounded texture');}finally{device.destroy();}
  if(!previewRefused)throw Error('Preview budget was enlarged');
  const refusals=[];
  const oversized=raw.slice(0);const view=new DataView(oversized);if(view.getUint32(444,true)!==2144)throw Error('Pinned raw IFD changed');view.setUint32(444,4096,true);
  for(const [name,bytes,adjustments,settings]of [
   ['sensor-budget',oversized,{}, {jpegQuality:90}],
   ['truncated',raw.slice(0,200),{}, {jpegQuality:90}],
   ['quality',raw.slice(0),{}, {jpegQuality:0}],
   ['unknown-codec',raw.slice(0),{}, {jpegQuality:90,keepMetadata:true}],
   ['fractional-crop',raw.slice(0),{crop:{x:0.5,y:1,width:100,height:100}}, {jpegQuality:90}],
   ['nonfinite-basic',raw.slice(0),{exposure:Infinity}, {jpegQuality:90}],
   ['oversize-output',raw.slice(0),{}, {jpegQuality:90,resize:{mode:'width',value:32768,dontEnlarge:false}}]
  ]){
   const stages=[];const r=await exportRawInWorker(bytes,{adjustments,settings,onStatus:s=>stages.push(s.status)});
   if(r.ok||stages.includes('gpu-submitted'))throw Error('Refusal reached GPU or returned bytes');
   if(name==='sensor-budget'&&!r.error.includes('dedicated4M'))throw Error('Dedicated sensor guard did not run');
   refusals.push({name,reason:r.reason,error:r.error,stages});
  }
  const controller=new AbortController();const cancelStages=[];let busyPromise;
  const cancelled=await exportRawInWorker(raw.slice(0),{signal:controller.signal,onStatus:s=>{
   cancelStages.push(s.status);
   if(s.status==='sensor-preflight')busyPromise=exportRawInWorker(raw.slice(0));
   if(s.status==='gpu-submitted')controller.abort();
  }});
  const overlapping=await busyPromise;
  if(cancelled.reason!=='aborted'||cancelled.forcedTermination||!cancelled.deviceDestroyed||cancelled.bytes||overlapping.reason!=='busy')throw Error('GPU cancel/overlap lifecycle failed '+JSON.stringify({cancelled,cancelStages,overlapping}));
  const timedOut=await exportRawInWorker(raw.slice(0),{timeoutMs:1});
  if(timedOut.reason!=='timeout'||timedOut.bytes)throw Error('Timeout returned success');
  const cases=[];
  for(const c of ref.cases){
   const stages=[];
   const r=await exportRawInWorker(raw.slice(0),{adjustments:c.adjustments,settings:c.codec.settings,onStatus:s=>stages.push(s)});
   if(!r.ok)throw Error(r.error||r.reason);
   if(r.width!==c.width||r.height!==c.height||r.developedSha256!==ref.developedSha256||r.rgbSha256!==c.inputF32Sha256||r.uploadSha256!==c.inputRgbaF16Sha256||r.adjustmentSha256!==c.frame.adjustmentSha256||r.rgbaSha256!==c.frame.sha256||r.jpegSha256!==c.codec.sha256||r.bytes.length!==c.codec.bytes)throw Error('Full native parity mismatch '+c.name+' '+JSON.stringify({...r,bytes:r.bytes.length}));
   if(!r.deviceDestroyed||r.gpuErrors.length)throw Error('GPU lifecycle failed');
   const bitmap=await createImageBitmap(new Blob([r.bytes],{type:'image/jpeg'}));const jpegDimensions=[bitmap.width,bitmap.height];bitmap.close();
   const {bytes,...row}=r;cases.push({name:c.name,...row,jpegDimensions,stages});
  }
  return {previewRefused,refusals,cancelled,cancelStages,overlapping,timedOut,cases,recoveredAfterCancelAndTimeout:true};
 },reference);
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(externalRequests,[]);
 await writeFile(output,JSON.stringify({scope:'Real full public RAW Quality -> original Basic/quarter-turn full EightBit render -> JPEG. No original ExportPanel/provider/write acceptance.',fixture:{id:pin.id,license:pin.license,sourceSha256:pin.sourceSha256},wasmSha256:hash(wasm),defaultsSha256:hash(defaults),...result,pageErrors,failedRequests,externalRequests},null,2)+'\n');
 console.log(JSON.stringify({cases:result.cases.length,rgbaComponents:result.cases.reduce((n,c)=>n+c.width*c.height*4,0),jpegBytes:reference.cases.reduce((n,c)=>n+c.codec.bytes,0),cancelled:result.cancelled,timedOut:result.timedOut,refusals:result.refusals.length}));
 await context.close();
}finally{await browser?.close();server.close();}
