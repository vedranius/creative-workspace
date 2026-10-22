// Unchanged source ExportPanel -> native command/event -> actual RAW worker -> OPFS.
// The chooser and close gate are QA-injected; this does not test an OS permission prompt.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [stage,fixture,output]=process.argv.slice(2);
if(!output)throw Error('BUILT_EXPORT_REACT_STAGE PUBLIC_CC0_DNG OUTPUT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex');
const pin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url))).fixtures.find(x=>x.id==='raw.pixls.us 1327');
assert.equal(pin.license,'CC0-1.0');assert.equal(hash(await readFile(fixture)),pin.sourceSha256);
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json')));assert.ok(source.exportUi);
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),url=prefix+'/'+entry.name;if(entry.isDirectory())await walk(file,url);else assets.set(url,[types[path.extname(file)]||'application/octet-stream',await readFile(file)]);}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));
const server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':asset[0],'Cache-Control':'no-store'}).end(asset[1]);});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const pageErrors=[],failedRequests=[],externalRequests=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext({viewport:{width:1700,height:1050}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){externalRequests.push(u.origin);return route.abort();}return route.continue();});
 await context.addInitScript(()=>{
  globalThis.exportQa={choices:[],events:[],mode:'gate',closing:false,cancelClicked:false,
   async pickFile(options){
    this.choices.push(options.suggestedName);this.closing=false;
    const root=await navigator.storage.getDirectory();this.root??=await root.getDirectoryHandle('qa-export-panel-'+crypto.randomUUID(),{create:true});
    const target=await this.root.getFileHandle('output-'+this.choices.length+'.jpg',{create:true});this.target=target;
    return {kind:'file',name:target.name,queryPermission:o=>target.queryPermission(o),getFile:()=>target.getFile(),createWritable:async options=>{
     const writer=await target.createWritable(options);
     return {write:b=>writer.write(b),abort:()=>writer.abort(),close:async()=>{this.closing=true;if(this.mode==='gate')await new Promise(resolve=>{this.release=resolve;});if(this.mode==='fail')throw Error('QA destination close failure');return writer.close();}};
    }};
   },
   onWorkerStatus(state){if(this.mode==='cancel'&&state.status==='gpu-submitted'){
    const panel=document.querySelector('[aria-label="Original Export panel"]'),buttons=panel.querySelectorAll('button');buttons[buttons.length-1].click();this.cancelClicked=true;
   }}
  };
 });
 const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));
 await page.goto(origin);await page.waitForFunction(()=>!!globalThis.proof);
 await page.getByLabel('Open RAW fixture').setInputFiles(fixture);
 await page.waitForFunction(()=>proof.store.getState().selectedImage?.isReady&&proof.store.getState().finalPreviewUrl);
 const panel=page.getByLabel('Original Export panel'),button=panel.locator('button').last();
 await page.evaluate(()=>{proof.processStore.subscribe(state=>exportQa.events.push(structuredClone(state.exportState)));});
 // Source metadata default is intentionally retained, and explicitly refused by the host.
 await button.click();await page.waitForFunction(()=>proof.processStore.getState().exportState.status==='error');
 const refused=await page.evaluate(()=>({state:proof.processStore.getState().exportState,workerCount:proof.workerStates.length,choices:exportQa.choices.slice()}));
 assert.match(refused.state.errorMessage,/without metadata/);assert.equal(refused.workerCount,0);assert.ok(refused.choices[0].endsWith('_edited.jpg'));
 await panel.getByText('Save with Metadata',{exact:true}).click();
 await button.click();await page.waitForFunction(()=>exportQa.closing);
 const gated=await page.evaluate(async()=>({state:proof.processStore.getState().exportState,recovery:await proof.destination.listRecovery(),size:(await exportQa.target.getFile()).size,events:exportQa.events.map(e=>e.status)}));
 assert.equal(gated.state.status,'exporting');assert.equal(gated.size,0);assert.equal(gated.recovery.length,1);assert.equal(gated.recovery[0].state,'uncertain');assert.ok(!gated.events.includes('success'));
 await page.screenshot({path:output.replace(/\.json$/, '-pending.png')});
 await page.evaluate(()=>exportQa.release());await page.waitForFunction(()=>proof.processStore.getState().exportState.status==='success');
 const success=await page.evaluate(async()=>{
  const file=await exportQa.target.getFile(),bytes=await file.arrayBuffer(),bitmap=await createImageBitmap(file);
  const report={state:structuredClone(proof.processStore.getState().exportState),bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),dimensions:[bitmap.width,bitmap.height]};bitmap.close();return report;
 });
 assert.equal(success.bytes,655924);assert.equal(success.sha256,'9cdca25668bdf162cc052c2cce115e968d16780fee43567971532474067e0462');assert.deepEqual(success.dimensions,[2048,1536]);
 await page.waitForFunction(async()=>!(await proof.destination.listRecovery()).length);
 await page.screenshot({path:output.replace(/\.json$/, '-success.png')});
 // Click the original button again, but fail the real OPFS stream's close.
 await page.evaluate(()=>{exportQa.mode='fail';});await button.click();await page.waitForFunction(()=>proof.processStore.getState().exportState.status==='error');
 const failure=await page.evaluate(async()=>({state:structuredClone(proof.processStore.getState().exportState),recovery:await proof.destination.listRecovery()}));
 assert.match(failure.state.errorMessage,/retained for recovery/);assert.equal(failure.recovery.length,1);assert.equal(failure.recovery[0].state,'uncertain');
 // A third actual RAW job clicks the original Cancel handler at GPU submission.
 await page.evaluate(()=>{exportQa.mode='cancel';});await button.click();await page.waitForFunction(()=>proof.processStore.getState().exportState.status==='cancelled');
 const cancellation=await page.evaluate(()=>({state:structuredClone(proof.processStore.getState().exportState),sourceButtonClicked:exportQa.cancelClicked,commands:proof.trace.filter(x=>['export_images','cancel_export'].includes(x.command)).map(x=>x.command),events:proof.trace.filter(x=>x.command==='event').map(x=>x.event),workerStates:proof.workerStates}));
 assert.ok(cancellation.sourceButtonClicked);assert.ok(cancellation.commands.includes('cancel_export'));assert.ok(cancellation.events.includes('export-cancelled'));
 const retained=await page.evaluate(async()=>{const records=await proof.destination.listRecovery(),bytes=await proof.destination.readRecovery(records[0].id);return {bytes:bytes.length,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')};});assert.equal(retained.sha256,success.sha256);
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(externalRequests,[]);
 await writeFile(output,JSON.stringify({scope:'Unchanged source ExportPanel/settings/listeners/process store, source JPEG button and Cancel handler. Synthetic OPFS chooser/close faults; no OS picker/common-provider acceptance.',fixture:{id:pin.id,license:pin.license,sha256:pin.sourceSha256},source,refused,gated:{state:gated.state,destinationBytes:0,recoveryState:'uncertain',noSuccessBeforeClose:true},success,failure:{state:failure.state,retained},cancellation,pageErrors,failedRequests,externalRequests},null,2)+'\n');
 console.log(JSON.stringify({sourceUi:true,bytes:success.bytes,sha256:success.sha256,metadataRefused:true,noEarlySuccess:true,retainedAfterFailure:true,cancelled:true}));
 await page.evaluate(()=>proof.close());await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
