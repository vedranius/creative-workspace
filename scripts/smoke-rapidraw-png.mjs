// Actual RAW development -> native PNG codec worker -> browser decode/download.
// This deliberately does not claim native GPU renderer or full export parity.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';

const [artifact,input,nativePng,output,mode='quality']=process.argv.slice(2);
if(!artifact||!input||!nativePng||!output||!['fast','quality'].includes(mode))throw Error('Usage: smoke-rapidraw-png.mjs WASM_DIR PUBLIC_RAW NATIVE_PNG REPORT [fast|quality]');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const upstream=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url),'utf8'));
const provenance=JSON.parse(await readFile(path.join(artifact,'quality-timer-compat.json'),'utf8'));
assert.deepEqual(provenance.patch,upstream.qualityTimerPatch);
const original=await readFile(nativePng),fixture=await readFile(input);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const licensed=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url),'utf8')).fixtures.find(item=>item.id==='raw.pixls.us 1327');
assert.equal(hash(fixture),licensed.sourceSha256,'PNG smoke accepts only the pinned public CC0 fixture');
const guardWorker=`import init,{encode_rgb32f_png} from './cw_rapidraw_wasm_probe.js';
self.onmessage=async()=>{try{await init();let rejected=0;for(const [w,h,p] of [[0,1,[]],[1,0,[]],[32769,1,[]],[32768,32768,[]],[1,1,[]],[1,1,[1,2]],[1,1,[NaN,1,2]],[1,1,[1,Infinity,2]]]){try{encode_rgb32f_png(w,h,p);}catch{rejected++;}}self.postMessage({rejected});}catch(e){self.postMessage({error:String(e)});}};`;
const assets=new Map([
 ['/',{type:'text/html',bytes:Buffer.from('<!doctype html><title>RapidRAW PNG codec proof</title><p>Isolated codec proof; original editor renderer not connected.</p>')}],
 ['/guard-worker.js',{type:'text/javascript',bytes:Buffer.from(guardWorker)}],
 ['/fixture.dng',{type:'application/octet-stream',bytes:fixture}],
 ['/worker.js',{type:'text/javascript',bytes:await readFile(new URL('../experiments/rapidraw-wasm-core/worker.js',import.meta.url))}],
 ['/cw_rapidraw_wasm_probe.js',{type:'text/javascript',bytes:await readFile(path.join(artifact,'cw_rapidraw_wasm_probe.js'))}],
 ['/cw_rapidraw_wasm_probe_bg.wasm',{type:'application/wasm',bytes:await readFile(path.join(artifact,'cw_rapidraw_wasm_probe_bg.wasm'))}]
]);
const server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':asset.type,'Cache-Control':'no-store','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});res.end(asset.bytes);});
server.listen(0,'127.0.0.1');await once(server,'listening');let browser;const errors=[],failed=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:process.env.CHROMIUM_SANDBOX!=='false',args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(async fast=>{
  const bytes=await(await fetch('/fixture.dng')).arrayBuffer();
  const png=await new Promise((resolve,reject)=>{const worker=new Worker('/worker.js',{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('PNG worker timed out'));},120000);worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.onmessage=({data})=>{if(data.status)return;clearTimeout(timer);worker.terminate();if(!data.ok)reject(Error(data.error));else resolve(data);};worker.postMessage({id:1,bytes,fastDemosaic:fast,output:'codec-png',dpi:300},[bytes]);});
  const digest=await crypto.subtle.digest('SHA-256',png.data);
  const hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  const blob=new Blob([png.data],{type:'image/png'}),bitmap=await createImageBitmap(blob);
  const dimensions={width:bitmap.width,height:bitmap.height};bitmap.close();
  const a=document.createElement('a');a.id='download';a.download='rapidraw-codec-proof.png';a.textContent='Download codec proof';a.href=URL.createObjectURL(blob);document.body.append(a);
  const guards=await new Promise((resolve,reject)=>{const worker=new Worker('/guard-worker.js',{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('PNG guard worker timed out'));},30000);worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();if(data.error)reject(Error(data.error));else resolve(data);};worker.postMessage({});});
  return {dimensions,pngBytes:png.data.length,hash,scope:png.scope,rejectedInvalidCases:guards.rejected};
 },mode==='fast');
 assert.equal(result.hash,hash(original),'WASM encoded bytes differ from native PNG branch');
 assert.equal(result.pngBytes,original.length);assert.equal(result.rejectedInvalidCases,8);
 const width=original.readUInt32BE(16),height=original.readUInt32BE(20);
 assert.deepEqual(result.dimensions,{width,height});assert.equal(original[24],16);assert.equal(original[25],2);
 const pending=page.waitForEvent('download');await page.locator('#download').click();const download=await pending;
 assert.equal(await download.failure(),null);const stream=await download.createReadStream(),digest=createHash('sha256');let downloadedBytes=0;
 for await(const chunk of stream){digest.update(chunk);downloadedBytes+=chunk.length;}
 assert.equal(digest.digest('hex'),result.hash);assert.equal(downloadedBytes,result.pngBytes);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={stage:'RWASM-02 original PNG codec boundary',nativeSource:upstream.nativeApplication.commit,fixture:'CC0 raw.pixls.us Canon PowerShot A410 CHDK DNG',mode,dimensions:result.dimensions,png:{bitDepth:16,colorType:2,bytes:result.pngBytes,sha256:result.hash,exactNativeEncodedBytes:true,srgbIccSha256:upstream.pngExportReference.icc.sha256,dpi:300},browser:{rejectedInvalidCases:result.rejectedInvalidCases,decoded:true,downloadCompleted:true,downloadedBytes,pageErrors:errors,failedRequests:failed},scope:result.scope+'; no original UI, EXIF/sidecar, provider save/write ACK or full editor-export acceptance'};
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
