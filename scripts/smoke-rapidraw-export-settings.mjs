// Original Exposure and ExportPanel size/DPI controls on a real public RAW.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [stage,fixture,output]=process.argv.slice(2);if(!output)throw Error('BUILT_EXPORT_STAGE PUBLIC_CC0_DNG OUTPUT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex');
const pin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url))).fixtures.find(x=>x.id==='raw.pixls.us 1327');
const raw=await readFile(fixture);assert.equal(pin.license,'CC0-1.0');assert.equal(hash(raw),pin.sourceSha256);
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json')));assert.ok(source.exportUi);
const meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
assert.equal(source.nativeSource,meta.nativeApplication.commit);
for(const [name,expected] of Object.entries({...meta.reactUi.sourceFiles,...meta.exportUi.sourceFiles}))assert.equal(hash(await readFile(path.join(stage,name))),expected,name);
for(const [name,expected]of Object.entries(source.runtimeSha256)){for(const dir of ['public/engine','dist/engine'])assert.equal(hash(await readFile(path.join(stage,dir,name))),expected);assert.equal(hash(await readFile(new URL('../experiments/rapidraw-wasm-core/'+name,import.meta.url))),expected,'Reused stage differs from current runtime');}
assert.equal(hash(await readFile(path.join(stage,'dist/engine/cw_rapidraw_wasm_probe_bg.wasm'))),source.wasmSha256);
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),url=prefix+'/'+entry.name;if(entry.isDirectory())await walk(file,url);else assets.set(url,[types[path.extname(file)]||'application/octet-stream',await readFile(file)]);}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));assets.set('/public.dng',['application/octet-stream',raw]);
const server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':asset[0],'Cache-Control':'no-store'}).end(asset[1]);});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const pageErrors=[],failedRequests=[],externalRequests=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext({viewport:{width:1700,height:1050}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){externalRequests.push(u.origin);return route.abort();}return route.continue();});
 await context.addInitScript(()=>{globalThis.exportQa={count:0,async pickFile(options){this.root??=await(await navigator.storage.getDirectory()).getDirectoryHandle('qa-export-settings-'+crypto.randomUUID(),{create:true});this.target=await this.root.getFileHandle('fine-'+(++this.count)+'.jpg',{create:true});this.closing=false;const target=this.target;return {kind:'file',name:target.name,queryPermission:o=>target.queryPermission(o),getFile:()=>target.getFile(),createWritable:async options=>{const writer=await target.createWritable(options);return {write:b=>writer.write(b),abort:()=>writer.abort(),close:async()=>{this.closing=true;await new Promise(resolve=>{this.release=resolve;});return writer.close();}};}};}};});
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));
 await page.goto(origin);await page.waitForFunction(()=>!!globalThis.proof);
 await page.getByLabel('Open RAW fixture').setInputFiles(fixture);await page.waitForFunction(()=>proof.store.getState().selectedImage?.isReady&&proof.store.getState().finalPreviewUrl);
 const panel=page.getByLabel('Original Export panel'),basic=page.getByLabel('Original Basic panel');await page.locator('[data-tab-id="layout-tab-export"]').click();await panel.getByText('Save with Metadata',{exact:true}).click();
 await panel.getByText('Resize to Fit',{exact:true}).click();await panel.getByRole('button',{name:'Export Settings',exact:true}).click();
 const cases=[];
 for(const [exposure,value,dpi] of [[0.8,1024,72],[-0.8,1024,144],[-0.8,4096,144]]){
  const control=basic.locator('input[type=range]').first().locator('xpath=../..');await control.locator('span[data-tooltip]').click();const input=control.locator('input[type=text]');await input.fill(String(exposure));await input.press('Enter');
  await page.waitForFunction(exposure=>{const s=proof.store.getState(),f=proof.trace.findLast(t=>t.command==='render-result'&&!t.interactive);return s.adjustments.exposure===exposure&&f?.exposure===exposure&&s.finalPreviewUrl;},exposure);
  const resize=panel.locator('input[type=number]:not([aria-label])');await resize.fill(String(value));await resize.blur();
  const resolution=panel.getByLabel('Resolution',{exact:true});await resolution.fill(String(dpi));await resolution.blur();
  const before=await page.evaluate(()=>({adjustments:structuredClone(proof.store.getState().adjustments),start:proof.workerStates.length,traceStart:proof.trace.length}));
  await page.evaluate(()=>{exportQa.closing=false;exportQa.release=null;});
  await panel.locator('button').last().click();await page.waitForFunction(()=>exportQa.closing,null,{timeout:120000});
  const gated=await page.evaluate(async()=>({status:proof.processStore.getState().exportState.status,size:(await exportQa.target.getFile()).size,recovery:await proof.destination.listRecovery()}));
  assert.equal(gated.status,'exporting');assert.equal(gated.size,0);assert.equal(gated.recovery.length,1);assert.equal(gated.recovery[0].state,'uncertain');
  await page.evaluate(()=>exportQa.release());await page.waitForFunction(()=>proof.processStore.getState().exportState.status==='success');
  const saved=await page.evaluate(async start=>{const f=await exportQa.target.getFile(),b=new Uint8Array(await f.arrayBuffer()),bitmap=await createImageBitmap(f),dimensions=[bitmap.width,bitmap.height];bitmap.close();
   // APP0 JFIF units and both densities are checked independently of decoded dimensions.
   let density=null;for(let i=2;i+4<b.length;){if(b[i]!==255)throw Error('Invalid JPEG marker');const marker=b[i+1];if(marker===218||marker===217)break;const len=(b[i+2]<<8)|b[i+3];if(marker===224&&String.fromCharCode(...b.slice(i+4,i+9))==='JFIF\0')density={unit:b[i+11],x:(b[i+12]<<8)|b[i+13],y:(b[i+14]<<8)|b[i+15]};i+=2+len;}
   return{bytes:b.byteLength,jpegSha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join(''),dimensions,density,stages:proof.workerStates.slice(start),state:structuredClone(proof.processStore.getState().exportState)};},before.start);
  assert.equal(saved.state.progress.current,1);assert.deepEqual(saved.dimensions,value===1024?[1024,768]:[2048,1536]);assert.deepEqual(saved.density,{unit:1,x:dpi,y:dpi});
  assert.deepEqual(saved.stages.filter(s=>s.status==='rendered').map(s=>[s.width,s.height]),[[2048,1536]],'Resize must follow complete full render');
  await page.waitForFunction(async()=>!(await proof.destination.listRecovery()).length);
  cases.push({name:'exposure-'+exposure+'-edge-'+value,adjustments:before.adjustments,settings:{jpegQuality:90,dpi,resize:{mode:'longEdge',value,dontEnlarge:true}},...saved,sourceUi:true,originalExposureAndExportControls:true,writeAcknowledged:true,noSuccessBeforeClose:true});
 }
 assert.notEqual(cases[0].stages.find(s=>s.status==='prepared').adjustmentSha256,cases[1].stages.find(s=>s.status==='prepared').adjustmentSha256);assert.notEqual(cases[0].jpegSha256,cases[1].jpegSha256);
 assert.equal(cases[1].stages.find(s=>s.status==='rendered').rgbaSha256,cases[2].stages.find(s=>s.status==='rendered').rgbaSha256,'Changing output size leaves full rendered image unchanged');
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(await page.evaluate(()=>proof.gpuErrors),[]);
 await page.screenshot({path:output.replace(/\.json$/,'.png')});
 await writeFile(output,JSON.stringify({scope:'Three actual original Exposure/ExportPanel long-edge/DPI UI exports. Full render precedes resize; JPEG JFIF DPI and real OPFS gated close/readback ACK. Synthetic chooser, no OS/common-provider claim.',fixture:{id:pin.id,license:pin.license,sha256:pin.sourceSha256},source,cases,pageErrors,failedRequests,externalRequests},null,2)+'\n');
 console.log(JSON.stringify({cases:cases.map(c=>({name:c.name,dimensions:c.dimensions,density:c.density,bytes:c.bytes}))}));await page.evaluate(()=>proof.close());await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
