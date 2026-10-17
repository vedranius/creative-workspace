import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [artifact,inputPath,nativePath,probePath,output,mode="fast"]=process.argv.slice(2);
if(!artifact||!inputPath||!nativePath||!probePath||!output)throw Error('Usage: node scripts/smoke-rapidraw-development.mjs WASM_PACKAGE_DIR PUBLIC_RAW_FILE NATIVE_REFERENCE_JSON PROBE_JSON OUTPUT_JSON [fast|quality]');
assert.ok(["fast","quality"].includes(mode),"Expected fast or quality mode");
const fastDemosaic=mode==="fast";
let compatibility;
try{compatibility=JSON.parse(await readFile(path.join(artifact,"quality-timer-compat.json"),"utf8"));}catch(e){if(e.code!=="ENOENT")throw e;}
const upstream=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url),'utf8'));
if(compatibility){
 assert.equal(compatibility.schemaVersion,1);
 assert.equal(compatibility.decoderSource,upstream.decoder.commit);
 assert.deepEqual(compatibility.patch,upstream.qualityTimerPatch,'Prepared artifact patch identity differs');
}
if(!fastDemosaic)assert.ok(compatibility,'Quality proof requires prepared timer-patch provenance');
const expectQualityRefusal=fastDemosaic&&!compatibility;
const native=JSON.parse(await readFile(nativePath,'utf8'));
const probe=JSON.parse(await readFile(probePath,'utf8'));
const input=await readFile(inputPath);
const wasm=await readFile(path.join(artifact,'cw_rapidraw_wasm_probe_bg.wasm'));
const pixelWorker=await readFile(new URL('../experiments/rapidraw-wasm-core/worker.js',import.meta.url));
assert.equal(probe.width,native.width);assert.equal(probe.height,native.height);
assert.equal(probe.components,3);assert.equal(native.components,3);
assert.equal(probe.fastDemosaic,fastDemosaic);assert.equal(native.fastDemosaic,fastDemosaic);
assert.equal(probe.componentF32BitsSha256,native.rgbF32BitsSha256,'native probe differs from pinned source');
const assets=new Map([
 ['/',{type:'text/html',bytes:Buffer.from('<!doctype html><title>RapidRAW pixel proof</title><p>Private WASM pixel parity harness.</p>')}],
 ['/pixel-worker.js',{type:'text/javascript',bytes:pixelWorker}],
 ['/cw_rapidraw_wasm_probe.js',{type:'text/javascript',bytes:await readFile(path.join(artifact,'cw_rapidraw_wasm_probe.js'))}],
 ['/cw_rapidraw_wasm_probe_bg.wasm',{type:'application/wasm',bytes:wasm}]
]);
const server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':asset.type,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'});res.end(asset.bytes);});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const errors=[],failed=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:process.env.CHROMIUM_SANDBOX!=='false',args:['--disable-dev-shm-usage']});
 const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(({bytes,fastDemosaic,expectQualityRefusal})=>new Promise((resolve,reject)=>{
  const worker=new Worker('/pixel-worker.js',{type:'module'});
  const timer=setTimeout(()=>{worker.terminate();reject(Error('Pixel worker timed out'));},120000);
  let qualityError;
  const send=(id,fast)=>{const copy=bytes.slice().buffer;worker.postMessage({id,bytes:copy,fastDemosaic:fast,linearMode:'default'},[copy]);};
  worker.onmessage=async({data})=>{
   if(data.status==='developing')return;
   if(data.id===1){
    if(data.ok){clearTimeout(timer);worker.terminate();reject(Error('Unpatched Quality path unexpectedly succeeded'));return;}
    qualityError=data.error;send(2,fastDemosaic);return;
   }
   if(data.id!==2)return;clearTimeout(timer);worker.terminate();
   if(!data.ok){reject(Error(JSON.stringify(data)));return;}
   const digest=await crypto.subtle.digest('SHA-256',data.data.buffer);
   const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
   resolve({...data,data:undefined,pixelCount:data.width*data.height,componentF32BitsSha256:hash,qualityError});
  };
  worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};
  if(expectQualityRefusal)send(1,false);else send(2,fastDemosaic);
 }),{bytes:new Uint8Array(input),fastDemosaic,expectQualityRefusal});
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.width,native.width);assert.equal(result.height,native.height);assert.equal(result.components,native.components);assert.equal(result.componentF32BitsSha256,native.rgbF32BitsSha256,'WASM pixels differ from pinned native source');if(expectQualityRefusal)assert.match(result.qualityError,/Pinned PPG quality demosaic is unavailable/);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={stage:`RWASM-02 original native RAW pixel path, native ${mode} mode`,nativeSource:'b39884b38d8f148caef6fd0d52afd264951be329',decoderSource:'a32bc1ff1f4f3c56d4d3226082f6eb17414f9159',fixture:'CC0 raw.pixls.us Canon PowerShot A410 CHDK DNG',nativeReference:'Byte-identical pinned raw_processing.rs in a native executable, with only desktop host types and original orientation helper supplied by the harness',dimensions:{width:result.width,height:result.height,components:result.components,pixelCount:result.pixelCount},demosaic:{selected:`pinned native ${mode} mode`,qualityMode:compatibility?'timer-only wasm32 compatibility build; interpolation unchanged':'explicit refusal retained in unpatched WASM'},decoderCompatibility:compatibility||null,exactRGBF32BitsSha256Matches:true,pixelHash:result.componentF32BitsSha256,wasmBytes:wasm.length,wasmSha256:createHash('sha256').update(wasm).digest('hex'),browser:'Actual experimental worker.js in a dedicated Chromium module worker; transferred Float32Array hashed in browser and not written to report',pageErrors:errors,failedRequests:failed,scope:`Original RawDevelop ${mode} demosaic/crop/calibration plus native black/white rescale, clipping recovery, clamp and EXIF orientation; one licensed Bayer fixture only; no UI, pixel exposure adjustment, RAF development or export acceptance`};
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
