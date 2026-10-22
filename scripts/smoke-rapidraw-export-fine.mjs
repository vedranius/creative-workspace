// Full native-source geometry from a real RAW and unchanged original UI export actions.
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
 await context.addInitScript(()=>{globalThis.exportQa={count:0,async pickFile(options){this.root??=await(await navigator.storage.getDirectory()).getDirectoryHandle('qa-export-fine-'+crypto.randomUUID(),{create:true});this.target=await this.root.getFileHandle('fine-'+(++this.count)+'.jpg',{create:true});return this.target;}};});
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));
 await page.goto(origin);await page.waitForFunction(()=>!!globalThis.proof);
 const backend=await page.evaluate(async()=>{
  const {exportRawInWorker}=await import('/engine/export-client.js'),raw=await(await fetch('/public.dng')).arrayBuffer();
  const adjustments={orientationSteps:1,flipHorizontal:true,rotation:8.7,crop:null},settings={jpegQuality:90,dpi:300};
  const stages=[],r=await exportRawInWorker(raw,{adjustments,settings,onStatus:s=>stages.push(s)});if(!r.ok)throw Error(r.error||r.reason);
  const bitmap=await createImageBitmap(new Blob([r.bytes],{type:'image/jpeg'})),dimensions=[bitmap.width,bitmap.height];bitmap.close();
  const {bytes,...result}=r;return{name:'uncropped-alpha',adjustments,settings,result:{...result,bytes:bytes.length},dimensions,stages,sourceUi:false};
 });
 assert.ok(backend.result.deviceDestroyed);assert.deepEqual(backend.dimensions,[1536,2048]);
 await page.getByLabel('Open RAW fixture').setInputFiles(fixture);await page.waitForFunction(()=>proof.store.getState().selectedImage?.isReady&&proof.store.getState().finalPreviewUrl);
 const panel=page.getByLabel('Original Export panel'),geometry=page.getByLabel('Original geometry panel');await page.locator('[data-tab-id="layout-tab-export"]').click();await panel.getByText('Save with Metadata',{exact:true}).click();
 const cases=[backend];
 for(const [angle,ratio] of [[5.3,'1:1'],[-7.1,'16:9']]){
  await page.locator('[data-tab-id="layout-tab-crop"]').click();await page.waitForFunction(()=>proof.uiStore.getState().activePanel==='crop');
  await geometry.locator('button[data-tooltip="Reset Crop & Transform"]').click();
  const control=geometry.locator('input[type=range]').first().locator('xpath=../..');await control.locator('span[data-tooltip]').click();const input=control.locator('input[type=text]');await input.fill(String(angle));await input.press('Enter');
  await page.waitForFunction(angle=>proof.store.getState().adjustments.rotation===angle,angle);await geometry.getByText(ratio,{exact:true}).click();
  await page.locator('[data-tab-id="layout-tab-adjustments"]').click();
  await page.waitForFunction(angle=>{const s=proof.store.getState(),f=proof.trace.findLast(t=>t.command==='render-result'&&!t.interactive);return f&&f.geometry.rotation===angle&&JSON.stringify(f.geometry.crop)===JSON.stringify(s.adjustments.crop===null?null:{x:s.adjustments.crop.x,y:s.adjustments.crop.y,width:s.adjustments.crop.width,height:s.adjustments.crop.height})&&s.finalPreviewUrl;},angle);
  const before=await page.evaluate(()=>({adjustments:structuredClone(proof.store.getState().adjustments),start:proof.workerStates.length}));
  await panel.locator('button').last().click();await page.waitForFunction(()=>proof.processStore.getState().exportState.status==='success',null,{timeout:120000});
  const saved=await page.evaluate(async start=>{const f=await exportQa.target.getFile(),b=await f.arrayBuffer(),bitmap=await createImageBitmap(f),dimensions=[bitmap.width,bitmap.height];bitmap.close();return{bytes:b.byteLength,jpegSha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join(''),dimensions,stages:proof.workerStates.slice(start),state:structuredClone(proof.processStore.getState().exportState)};},before.start);
  assert.equal(saved.state.progress.current,1);assert.deepEqual(saved.dimensions,[before.adjustments.crop.width,before.adjustments.crop.height]);assert.notEqual(saved.jpegSha256,'9cdca25668bdf162cc052c2cce115e968d16780fee43567971532474067e0462');assert.ok(saved.stages.some(s=>s.status==='rendered'));
  await page.waitForFunction(async()=>!(await proof.destination.listRecovery()).length);
  await page.screenshot({path:output.replace(/\.json$/,`-${angle}.png`)});
  cases.push({name:'original-panel-'+angle,adjustments:before.adjustments,settings:{jpegQuality:90,dpi:300},...saved,sourceUi:true,sourceRotationAndAspectPreset:true,writeAcknowledged:true});
 }
 // Newly enabled geometry still refuses invalid crop/rotation and recovers without GPU submission.
 const refusals=await page.evaluate(async()=>{
  const {exportRawInWorker}=await import('/engine/export-client.js'),raw=await(await fetch('/public.dng')).arrayBuffer(),out=[];
  for(const [name,adjustments]of [['fractional-crop',{crop:{x:0.5,y:1,width:30,height:20}}],['outside-crop',{crop:{x:3000,y:0,width:20,height:20}}],['angle',{rotation:45.1}],['effect',{saturation:10}]]){
   const stages=[],r=await exportRawInWorker(raw.slice(0),{adjustments,onStatus:s=>stages.push(s.status)});if(r.ok||stages.includes('gpu-submitted'))throw Error('Invalid geometry reached GPU');out.push({name,...r,stages});
  }return out;
 });
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(await page.evaluate(()=>proof.gpuErrors),[]);
 await writeFile(output,JSON.stringify({scope:'Three real RAW full export geometry cases: independent backend uncropped alpha plus two unchanged source CropPanel numeric/aspect controls -> ExportPanel JPEG -> real OPFS close ACK. Picker is synthetic OPFS, no OS/common-provider claim.',fixture:{id:pin.id,license:pin.license,sha256:pin.sourceSha256},source,cases,refusals,pageErrors,failedRequests,externalRequests},null,2)+'\n');
 console.log(JSON.stringify({cases:cases.map(c=>({name:c.name,dimensions:c.dimensions,bytes:c.bytes??c.result.bytes})),refusals:refusals.length}));await page.evaluate(()=>proof.close());await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
