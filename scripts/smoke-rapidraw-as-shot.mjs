// Actual public RAW as-shot WB/exposure and original WB UI/adaptation mapping.
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
const [artifact,input,nativeBinary,output]=process.argv.slice(2);
if(!output)throw Error('Usage: smoke-rapidraw-as-shot.mjs WASM_DIR PUBLIC_DNG NATIVE_DEVELOP_REFERENCE OUTPUT_JSON');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const provenance=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url)));
const fixture=provenance.fixtures.find(f=>f.id==='raw.pixls.us 1327');assert.equal(fixture.license,'CC0-1.0');
const raw=await readFile(input);assert.equal(hash(raw),fixture.sourceSha256);
const child=spawnSync(nativeBinary,[input,'--as-shot'],{encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stderr);
const native=JSON.parse(child.stdout);assert.ok(native.asShot.whiteBalance.temperature>0);
// Declared before browser execution: small absolute cross-target math tolerances.
// Record exact matches separately. These are metadata/matrix tolerances, not a
// broad rendered color/image tolerance or permission to alter original math.
const tolerance={temperatureKelvin:1e-8,tint:1e-9,adaptationLogGains:5e-7,rgbToLms:1e-6};
const core=new URL('../experiments/rapidraw-wasm-core/',import.meta.url);
const assets=new Map([
 ['/', ['text/html',Buffer.from('<!doctype html><title>Original RapidRAW as-shot WB proof</title>')]],
 ['/worker.js',['text/javascript',await readFile(new URL('worker.js',core))]],
 ['/public.dng',['application/octet-stream',raw]],
 ['/cw_rapidraw_wasm_probe.js',['text/javascript',await readFile(path.join(artifact,'cw_rapidraw_wasm_probe.js'))]],
 ['/cw_rapidraw_wasm_probe_bg.wasm',['application/wasm',await readFile(path.join(artifact,'cw_rapidraw_wasm_probe_bg.wasm'))]],
]);
const server=createServer((req,res)=>{const a=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'});res.end(a[1]);});
server.listen(0,'127.0.0.1');await once(server,'listening');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');let browser;const errors=[],failed=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:process.env.CHROMIUM_SANDBOX!=='false',args:['--disable-dev-shm-usage']});
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(new URL(r.url()).pathname));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const actual=await page.evaluate(async cases=>{
   const bytes=await(await fetch('/public.dng')).arrayBuffer();
   const message=await new Promise((resolve,reject)=>{const w=new Worker('/worker.js',{type:'module'}),timer=setTimeout(()=>{w.terminate();reject(Error('As-shot worker timeout'));},30000);
     w.onmessage=({data})=>{clearTimeout(timer);w.terminate();resolve(data);};w.onerror=e=>{clearTimeout(timer);w.terminate();reject(Error(e.message));};w.postMessage({id:1,bytes,output:'as-shot'},[bytes]);});
   if(!message.ok)throw Error(message.error);
   const wasm=await import('/cw_rapidraw_wasm_probe.js');await wasm.default();
   const shot=message.asShot;
   const mapped=cases.map(c=>JSON.parse(wasm.map_white_balance(c.json,shot.whiteBalance.temperature,shot.whiteBalance.tint)));
   const invalid=[['[]',6500,0],['',6500,0],['true',6500,0],['{}',NaN,0],['{}',0,0],['{}',6500,Infinity],[' '.repeat(65537),6500,0],['{"whiteBalance":{"temperature":0,"tint":0}}',6500,0]];
   let rejectedInvalidMappings=0;for(const args of invalid){try{wasm.map_white_balance(...args);}catch{rejectedInvalidMappings++;}}
   let rejectedEmptyRaw=false;try{wasm.read_as_shot(new Uint8Array());}catch{rejectedEmptyRaw=true;}
   return {asShot:shot,mapped,rejectedInvalidMappings,rejectedEmptyRaw};
 },native.cases);
 assert.deepEqual(actual.asShot.exposure,native.asShot.exposure);
 let exactScalars=0,comparedScalars=0;const maxAbsoluteDifference={temperatureKelvin:0,tint:0,adaptationLogGains:0,rgbToLms:0};
 function compare(a,b,key){assert.ok(Number.isFinite(a)&&Number.isFinite(b));const diff=Math.abs(a-b);assert.ok(diff<=tolerance[key],`${key}: ${diff}`);maxAbsoluteDifference[key]=Math.max(maxAbsoluteDifference[key],diff);comparedScalars++;if(Object.is(a,b))exactScalars++;}
 function compareWb(a,b){compare(a.temperature,b.temperature,'temperatureKelvin');compare(a.tint,b.tint,'tint');}
 compareWb(actual.asShot.whiteBalance,native.asShot.whiteBalance);
 for(const [i,result]of actual.mapped.entries()){
   compareWb(result.whiteBalance,native.cases[i].whiteBalance);
   for(const key of ['adaptationLogGains','rgbToLms']){assert.equal(result[key].length,native.cases[i][key].length);result[key].forEach((value,j)=>compare(value,native.cases[i][key][j],key));}
 }
 assert.equal(actual.rejectedInvalidMappings,8);assert.equal(actual.rejectedEmptyRaw,true);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={stage:'RWASM-03 original as-shot WB metadata and original WB adjustment/adaptation mapping',nativeSource:provenance.nativeSource,decoderSource:provenance.decoderSource,
   publicFixture:{id:fixture.id,sourceSha256:fixture.sourceSha256,license:fixture.license},nativeReference:'Full original white_balance.rs/raw_processing.rs/baseline_exposure.rs plus pinned color helpers; native WB stub removed',
   nativeAsShot:native.asShot,browserAsShot:actual.asShot,nativeCases:native.cases,browserCases:actual.mapped,comparedScalars,exactScalars,tolerance,maxAbsoluteDifference,
   rejectedInvalidMappings:actual.rejectedInvalidMappings,rejectedEmptyRaw:actual.rejectedEmptyRaw,wasmSha256:hash(assets.get('/cw_rapidraw_wasm_probe_bg.wasm')[1]),browserVersion:browser.version(),chromiumSandbox:process.env.CHROMIUM_SANDBOX!=='false',pageErrors:errors,failedRequests:failed,
   scope:'Actual original camera-neutral/as-shot WB temperature/tint, exposure and original WB UI/Bradford adaptation mapping. Actual WASM worker on one public CC0 DNG, not broad camera support. No source-image edits/private data. WB GPU adjustment fields/full rendered-frame comparison, other controls/preprocessing, React UI, file providers and full editor acceptance remain open.'};
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
