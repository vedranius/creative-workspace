import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [artifact,referencePath,output]=process.argv.slice(2);
if(!artifact||!referencePath||!output)throw Error('Usage: node scripts/smoke-rapidraw-exposure-pixels.mjs WASM_PACKAGE_DIR NATIVE_REFERENCE_JSON OUTPUT_REPORT_JSON');
const reference=JSON.parse(await readFile(referencePath,'utf8'));
assert.equal(reference.cases.length,8);
const wasm=await readFile(path.join(artifact,'cw_rapidraw_wasm_probe_bg.wasm'));
const worker=`import init,{apply_rgb_exposure} from './cw_rapidraw_wasm_probe.js';
self.onmessage=async({data})=>{try{await init();const rows=data.cases.map(c=>{
 const pixels=apply_rgb_exposure(data.pixels,c.stops);
 const bits=Array.from(pixels, value=>{const buffer=new ArrayBuffer(4),view=new DataView(buffer);view.setFloat32(0,value,true);return view.getUint32(0,true);});
 return {stops:c.stops,bits};
});let rejected=0;for(const [pixels,stops] of [[[1,2],1],[[1,NaN,2],1],[[1,2,3],Infinity],[[3.4028234663852886e38,3.4028234663852886e38,3.4028234663852886e38],2],[[1,2,3],128]]){try{apply_rgb_exposure(pixels,stops);}catch{rejected++;}}
 self.postMessage({ok:true,rows,rejected});}catch(e){self.postMessage({ok:false,error:String(e)});}};`;
const assets=new Map([
 ['/',{type:'text/html',bytes:Buffer.from('<!doctype html><title>RapidRAW exposure pixels</title><p>Synthetic float-pixel parity harness.</p>')}],
 ['/worker.js',{type:'text/javascript',bytes:Buffer.from(worker)}],
 ['/cw_rapidraw_wasm_probe.js',{type:'text/javascript',bytes:await readFile(path.join(artifact,'cw_rapidraw_wasm_probe.js'))}],
 ['/cw_rapidraw_wasm_probe_bg.wasm',{type:'application/wasm',bytes:wasm}]
]);
const server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':asset.type,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'});res.end(asset.bytes);});
server.listen(0,'127.0.0.1');await once(server,'listening');let browser;const errors=[],failed=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:process.env.CHROMIUM_SANDBOX!=='false',args:['--disable-dev-shm-usage']});
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(input=>new Promise((resolve,reject)=>{const worker=new Worker('/worker.js',{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('Exposure-pixels worker timed out'));},30000);worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();resolve(data);};worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.postMessage(input);}),reference);
 assert.equal(result.ok,true,result.error);assert.equal(result.rows.length,reference.cases.length);assert.equal(result.rejected,5);
 result.rows.forEach((row,i)=>{assert.equal(row.stops,reference.cases[i].stops);assert.deepEqual(row.bits,reference.cases[i].bits,`Native/WASM pixel mismatch at ${row.stops} stops`);});
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={stage:'RWASM-02 native exposure-to-RGB-pixels slice',nativeSource:'b39884b38d8f148caef6fd0d52afd264951be329',nativeReference:'pinned image_processing.rs apply_exposure(map_color_channels) excerpt; synthetic RGB f32 pixels only',cases:reference.cases.length,exactF32PixelMatches:reference.cases.length*reference.pixels.length,rejectedInvalidCases:result.rejected,pageErrors:errors,failedRequests:failed,wasmBytes:wasm.length,wasmSha256:createHash('sha256').update(wasm).digest('hex'),scope:'Dedicated Chromium WASM worker applies native 2^stops RGB multiplication to synthetic developed-style pixels; no RAW development integration, original UI, GPU shader parity or export-byte acceptance'};
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
