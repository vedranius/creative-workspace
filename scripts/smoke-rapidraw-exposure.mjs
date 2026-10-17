import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [artifact,output]=process.argv.slice(2);
if(!artifact||!output)throw Error('Usage: node scripts/smoke-rapidraw-exposure.mjs WASM_PACKAGE_DIR OUTPUT_REPORT_JSON');
const reference=JSON.parse(await readFile(path.join(artifact,'exposure-reference.json'),'utf8'));
assert.equal(reference.length,144);
const wasm=await readFile(path.join(artifact,'cw_rapidraw_wasm_probe_bg.wasm'));
const worker=`import init,{baseline_exposure_compensation as compensate} from './cw_rapidraw_wasm_probe.js';
self.onmessage=async({data})=>{try{await init();const rows=data.map(c=>{
 const actual=compensate(c.scene,c.dng,c.highlight,c.baseline,c.compensate);
 const buffer=new ArrayBuffer(4),view=new DataView(buffer);view.setFloat32(0,actual,true);
 return {actual,bits:view.getUint32(0,true)};
});
let rejected=0;for(const bad of [NaN,Infinity,-Infinity]){
 for(const args of [[true,bad,0,null,false],[true,0,bad,null,false],[true,0,0,bad,false]]){
  try{compensate(...args);}catch{rejected++;}
 }
}
try{compensate(true,3.4028234663852886e38,3.4028234663852886e38,1,true);}catch{rejected++;}
self.postMessage({ok:true,rows,rejected});}catch(e){self.postMessage({ok:false,error:String(e)});}};`;
const assets=new Map([
 ['/',{type:'text/html',bytes:Buffer.from('<!doctype html><title>RapidRAW exposure test</title><p>Private WASM parity harness; no image files.</p>')}],
 ['/worker.js',{type:'text/javascript',bytes:Buffer.from(worker)}],
 ['/cw_rapidraw_wasm_probe.js',{type:'text/javascript',bytes:await readFile(path.join(artifact,'cw_rapidraw_wasm_probe.js'))}],
 ['/cw_rapidraw_wasm_probe_bg.wasm',{type:'application/wasm',bytes:wasm}]
]);
const server=createServer((req,res)=>{
 const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);
 if(!asset){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':asset.type,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'});res.end(asset.bytes);
});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const errors=[],failed=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(cases=>new Promise((resolve,reject)=>{
  const worker=new Worker('/worker.js',{type:'module'});
  const timer=setTimeout(()=>{worker.terminate();reject(Error('Exposure worker timed out'));},30000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();resolve(data);};worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.postMessage(cases);
 }),reference);
 assert.equal(result.ok,true,result.error);assert.equal(result.rows.length,144);assert.equal(result.rejected,10);
 result.rows.forEach((row,i)=>assert.equal(row.bits,reference[i].expectedBits,`Native/WASM exposure mismatch in case ${i}`));
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={stage:'RWASM-02 baseline exposure compensation only',nativeSource:'b39884b38d8f148caef6fd0d52afd264951be329',referenceSource:'Byte-identical pinned src-tauri/src/baseline_exposure.rs, compiled natively with only AppSettings host type stubbed',cases:144,exactF32BitMatches:144,rejectedNonfiniteOrOverflowCases:10,pageErrors:errors,failedRequests:failed,wasmBytes:wasm.length,wasmSha256:createHash('sha256').update(wasm).digest('hex'),scope:'Scalar compensation in exposure stops, executed in a dedicated Chromium WASM worker; no image pixel processing, metadata parsing, original UI or export acceptance'};
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
