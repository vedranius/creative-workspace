// Verify actual native UI exposure mapping through WASM and the browser host.
// No GPU is required for this input/payload check; it is not a rendered frame.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';
const [artifact,referencePath,output]=process.argv.slice(2);
if(!artifact||!referencePath||!output)throw Error('Usage: smoke-rapidraw-ui-exposure.mjs WASM_DIR NATIVE_REFERENCE_JSON OUTPUT_JSON');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const reference=JSON.parse(await readFile(referencePath,'utf8'));assert.equal(reference.cases.length,216);
const wasm=await readFile(path.join(artifact,'cw_rapidraw_wasm_probe_bg.wasm'));
const worker=`import init,* as wasm from './cw_rapidraw_wasm_probe.js';
import {packUiExposureFixture} from './webgpu-renderer.js';
self.onmessage=async({data})=>{try{await init();const neutral=wasm.pack_neutral_renderer_adjustments(0);const rows=[];
 const call=c=>packUiExposureFixture(wasm,c.json,{sceneReferred:c.sceneReferred,dngBaseline:c.dngBaseline,highlightPreservation:c.highlightPreservation},{baselineExposure:c.baselineExposure,compensateHighlightPreservation:c.compensateHighlightPreservation}).bytes;
 for(const c of data.cases){const bytes=call(c);if(bytes.length!==45232||bytes.subarray(4).some((v,i)=>v!==neutral[i+4]))throw Error('Unexpected non-exposure payload change');rows.push(new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0,true));}
 const base={json:'{}',sceneReferred:true,dngBaseline:0,highlightPreservation:0,baselineExposure:null,compensateHighlightPreservation:false};
 const invalid=['','[]','true','1','"wrong"','{exposure:1}','{"exposure":1e300}',' '.repeat(65537)].map(json=>({...base,json}));
 invalid.push({...base,dngBaseline:NaN},{...base,baselineExposure:Infinity},{...base,json:'{"baselineExposure":true}',dngBaseline:3.4028234663852886e38,highlightPreservation:3.4028234663852886e38,baselineExposure:3.4028234663852886e38,compensateHighlightPreservation:true});
 let rejected=0;for(const c of invalid){try{call(c);}catch{rejected++;}}self.postMessage({ok:true,rows,rejected,bytes:neutral.length});
}catch(e){self.postMessage({ok:false,error:String(e)});}};`;
const assets=new Map([
 ['/',{type:'text/html',bytes:Buffer.from('<!doctype html><title>RapidRAW UI exposure input proof</title>')}],
 ['/worker.js',{type:'text/javascript',bytes:Buffer.from(worker)}],
 ['/webgpu-renderer.js',{type:'text/javascript',bytes:await readFile(new URL('../experiments/rapidraw-wasm-core/webgpu-renderer.js',import.meta.url))}],
 ['/cw_rapidraw_wasm_probe.js',{type:'text/javascript',bytes:await readFile(path.join(artifact,'cw_rapidraw_wasm_probe.js'))}],
 ['/cw_rapidraw_wasm_probe_bg.wasm',{type:'application/wasm',bytes:wasm}]
]);
const server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':asset.type,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'});res.end(asset.bytes);});
server.listen(0,'127.0.0.1');await once(server,'listening');let browser;const errors=[],failed=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:process.env.CHROMIUM_SANDBOX!=='false',args:['--disable-dev-shm-usage']});
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(data=>new Promise((resolve,reject)=>{const worker=new Worker('/worker.js',{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('UI mapping worker timed out'));},30000);worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();resolve(data);};worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.postMessage(data);}),reference);
 assert.equal(result.ok,true,result.error);assert.deepEqual(result.rows,reference.cases.map(c=>c.expectedExposureBits));assert.equal(result.rejected,11);assert.equal(result.bytes,45232);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={stage:'RWASM-03 original UI exposure input mapping',nativeSource:'b39884b38d8f148caef6fd0d52afd264951be329',nativeReference:'Pinned visibility/get_val/SCALES/effective-baseline excerpts with byte-identical baseline_exposure.rs; only exposure projected from original GlobalAdjustments',nativeCases:result.rows.length,exactExposureF32Matches:result.rows.length,payloadBytes:result.bytes,otherFixtureBytesUnchanged:true,rejectedInvalidCases:result.rejected,wasmBytes:wasm.length,wasmSha256:createHash('sha256').update(wasm).digest('hex'),pageErrors:errors,failedRequests:failed,scope:'Real dedicated Chromium WASM worker and actual JS host helper; original exposure UI/activeTools/legacy visibility/baseline semantics only; no camera metadata extraction, other adjustment mapping, GPU execution, rendered-frame/UI/editor acceptance'};
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
