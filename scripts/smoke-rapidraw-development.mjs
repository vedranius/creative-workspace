import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [artifact,inputPath,nativePath,probePath,output]=process.argv.slice(2);
if(!artifact||!inputPath||!nativePath||!probePath||!output)throw Error('Usage: node scripts/smoke-rapidraw-development.mjs WASM_PACKAGE_DIR PUBLIC_RAW_FILE NATIVE_REFERENCE_JSON PROBE_JSON OUTPUT_JSON');
const native=JSON.parse(await readFile(nativePath,'utf8'));
const probe=JSON.parse(await readFile(probePath,'utf8'));
const input=await readFile(inputPath);
const wasm=await readFile(path.join(artifact,'cw_rapidraw_wasm_probe_bg.wasm'));
assert.equal(probe.width,native.width);assert.equal(probe.height,native.height);
assert.equal(probe.components,3);assert.equal(native.components,3);
assert.equal(probe.fastDemosaic,true);assert.equal(native.fastDemosaic,true);
assert.equal(probe.componentF32BitsSha256,native.rgbF32BitsSha256,'native probe differs from pinned source');
const worker=`import init,{develop_pixels} from './cw_rapidraw_wasm_probe.js';
self.onmessage=async({data})=>{try{await init();let qualityError;try{develop_pixels(new Uint8Array(data.bytes),false,'default');}catch(e){qualityError=String(e?.message??e);}
const image=develop_pixels(new Uint8Array(data.bytes),true,'default');
const digest=await crypto.subtle.digest('SHA-256',image.data.buffer);const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
self.postMessage({ok:true,width:image.width,height:image.height,components:image.components,pixelCount:image.width*image.height,componentF32BitsSha256:hash,fastDemosaic:true,qualityError});
}catch(e){self.postMessage({ok:false,error:String(e?.message??e),stack:e?.stack});}};`;
const assets=new Map([
 ['/',{type:'text/html',bytes:Buffer.from('<!doctype html><title>RapidRAW pixel proof</title><p>Private WASM pixel parity harness.</p>')}],
 ['/worker.js',{type:'text/javascript',bytes:Buffer.from(worker)}],
 ['/cw_rapidraw_wasm_probe.js',{type:'text/javascript',bytes:await readFile(path.join(artifact,'cw_rapidraw_wasm_probe.js'))}],
 ['/cw_rapidraw_wasm_probe_bg.wasm',{type:'application/wasm',bytes:wasm}]
]);
const server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':asset.type,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'});res.end(asset.bytes);});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const errors=[],failed=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(bytes=>new Promise((resolve,reject)=>{const worker=new Worker('/worker.js',{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('Pixel worker timed out'));},120000);worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();resolve(data);};worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};const copy=bytes.slice().buffer;worker.postMessage({bytes:copy},[copy]);}),new Uint8Array(input));
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.width,native.width);assert.equal(result.height,native.height);assert.equal(result.components,native.components);assert.equal(result.componentF32BitsSha256,native.rgbF32BitsSha256,'WASM pixels differ from pinned native source');assert.equal(result.fastDemosaic,true);assert.match(result.qualityError,/Pinned PPG quality demosaic is unavailable/);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={stage:'RWASM-02 original native RAW pixel path, native Speed mode',nativeSource:'b39884b38d8f148caef6fd0d52afd264951be329',decoderSource:'a32bc1ff1f4f3c56d4d3226082f6eb17414f9159',fixture:'CC0 raw.pixls.us Canon PowerShot A410 CHDK DNG',nativeReference:'Byte-identical pinned raw_processing.rs in a native executable, with only desktop host types and original orientation helper supplied by the harness',dimensions:{width:result.width,height:result.height,components:result.components,pixelCount:result.pixelCount},demosaic:{selected:'pinned native Speed mode',qualityMode:'explicitly refused in WASM: pinned PPG calls std::time::Instant::now(), which panics for wasm32-unknown-unknown'},exactRGBF32BitsSha256Matches:true,pixelHash:result.componentF32BitsSha256,wasmBytes:wasm.length,wasmSha256:createHash('sha256').update(wasm).digest('hex'),browser:'Dedicated Chromium module worker; pixel payload hashed in-browser and not written to report',pageErrors:errors,failedRequests:failed,scope:'Original RawDevelop Speed demosaic/crop/calibration plus native black/white rescale, clipping recovery, clamp and EXIF orientation; no UI, pixel exposure adjustment or export acceptance'};
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
