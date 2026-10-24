// Original preset/export controls across held file/settings ACKs and a real second-tab IndexedDB writer.
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
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json')));assert.ok(source.settingsUi);
const meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
assert.equal(source.nativeSource,meta.nativeApplication.commit);
for(const [name,expected] of Object.entries({...meta.reactUi.sourceFiles,...meta.exportUi.sourceFiles,...meta.settingsUi.sourceFiles}))assert.equal(hash(await readFile(path.join(stage,name))),meta.settingsUi.lastUsedPatch.patchedFiles[name]??meta.settingsUi.sourcePatch.patchedFiles[name]??expected,name);
for(const [name,expected]of Object.entries(source.runtimeSha256)){for(const dir of ['public/engine','dist/engine'])assert.equal(hash(await readFile(path.join(stage,dir,name))),expected);assert.equal(hash(await readFile(new URL('../experiments/rapidraw-wasm-core/'+name,import.meta.url))),expected,'Reused stage differs from current runtime');}
assert.equal(hash(await readFile(path.join(stage,'dist/engine/cw_rapidraw_wasm_probe_bg.wasm'))),source.wasmSha256);
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),url=prefix+'/'+entry.name;if(entry.isDirectory())await walk(file,url);else assets.set(url,[types[path.extname(file)]||'application/octet-stream',await readFile(file)]);}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));assets.set('/peer.html',['text/html',Buffer.from('<!doctype html><title>Settings peer</title>')]);assets.set('/public.dng',['application/octet-stream',raw]);
const server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':asset[0],'Cache-Control':'no-store'}).end(asset[1]);});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser,page;const pageErrors=[],failedRequests=[],externalRequests=[];
const expectedConsoleErrors=[],knownUnavailable=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext({viewport:{width:1700,height:1050}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){externalRequests.push(u.origin);return route.abort();}return route.continue();});
 await context.addInitScript(()=>{
  const qa=globalThis.settingsQa={holdRead:false,wrote:false,gated:false,commits:0,wrapBackend(backend){this.backend=backend;return {
   read:async()=>{const value=await backend.read();qa.lastRaw=structuredClone(value);if(qa.holdRead&&qa.wrote){qa.gated=true;await new Promise(r=>qa.release=r);qa.holdRead=false;qa.wrote=false;qa.gated=false;}return value;},
   commit:async(...args)=>{await backend.commit(...args);qa.commits++;qa.wrote=true;},close:()=>backend.close(),
  };}};
  globalThis.exportQa={count:0,async pickFile(){
   this.root??=await(await navigator.storage.getDirectory()).getDirectoryHandle('qa-settings-concurrency-'+crypto.randomUUID(),{create:true});
   this.target=await this.root.getFileHandle('output-'+(++this.count)+'.jpg',{create:true});this.closing=false;
   const target=this.target;return {kind:'file',name:target.name,queryPermission:o=>target.queryPermission(o),getFile:()=>target.getFile(),createWritable:async options=>{const writer=await target.createWritable(options);return {write:b=>writer.write(b),abort:()=>writer.abort(),close:async()=>{this.closing=true;await new Promise(resolve=>{this.release=resolve;});return writer.close();}};}};}};
 });
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));page.on('console',msg=>{if(msg.type()==='error'){if(msg.text().includes('does not support get_lensfun_makers'))knownUnavailable.push('get_lensfun_makers');else expectedConsoleErrors.push(msg.text());}});
 const panel=page.getByLabel('Original Export panel');
 const open=async()=>{await page.getByLabel('Open RAW fixture').setInputFiles(fixture);await page.waitForFunction(()=>proof.store.getState().selectedImage?.isReady&&proof.store.getState().finalPreviewUrl);await page.locator('[data-tab-id="layout-tab-export"]').click();};
 const quality=async value=>{const c=panel.locator('input[type=range]').first().locator('xpath=../..');await c.locator('span[data-tooltip]').click();const input=c.locator('input[type=text]');await input.fill(String(value));await input.press('Enter');await page.waitForFunction(q=>Number(document.querySelector('[aria-label="Original Export panel"] input[type=range]')?.value)===q,value);};
 const start=async()=>{await page.evaluate(()=>{exportQa.closing=false;exportQa.release=null;});await panel.locator('button').last().click();await page.waitForFunction(()=>exportQa.closing,null,{timeout:120000});};
 const outputFile=()=>page.evaluate(async()=>{const f=await exportQa.target.getFile(),bytes=await f.arrayBuffer(),bitmap=await createImageBitmap(f),dimensions=[bitmap.width,bitmap.height];bitmap.close();return {bytes:f.size,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),dimensions};});
 const snapshot=()=>page.evaluate(async()=>({status:proof.processStore.getState().exportState.status,host:proof.settingsHost.status(),presets:structuredClone(proof.settingsStore.getState().appSettings.exportPresets),stored:await settingsQa.backend.read(),commits:settingsQa.commits,quality:Number(document.querySelector('[aria-label="Original Export panel"] input[type=range]')?.value)}));
 const createPreset=async name=>{await panel.locator('[data-tooltip="Save current settings as new preset"]').click();const field=panel.getByPlaceholder('Preset Name');await field.fill(name);await field.press('Enter');};
 const releaseFile=async()=>{await page.evaluate(()=>exportQa.release());await page.waitForFunction(()=>proof.processStore.getState().exportState.status==='success');};
 const preset=s=>s.presets.find(p=>p.id==='__last_used__');
 await page.goto(origin);await page.waitForFunction(()=>!!globalThis.proof);await open();await panel.getByText('Save with Metadata',{exact:true}).click();await quality(60);
 await panel.getByText('Resize to Fit',{exact:true}).click();await panel.locator('input[type=number]:not([aria-label])').fill('512');await panel.getByRole('button',{name:'Export Settings',exact:true}).click();await panel.getByLabel('Resolution',{exact:true}).fill('144');await panel.getByLabel('Resolution',{exact:true}).blur();
 // Original preset controls are blocked during export. Exercise another component's
 // source settings callback programmatically; do not force clicks through the UI guard.
 await createPreset('Before export');await page.waitForFunction(()=>proof.settingsHost.status().revision===1);
 await start();const fileHeld=await snapshot();assert.equal(fileHeld.status,'exporting');assert.equal(fileHeld.host.revision,1);assert.equal(fileHeld.commits,1);
 const presetUiBlocked=await panel.locator('[data-tooltip="Save current settings as new preset"]').evaluate(el=>getComputedStyle(el).pointerEvents==='none');assert.equal(presetUiBlocked,true);
 await page.evaluate(async()=>{const store=proof.settingsStore.getState(),settings=structuredClone(store.appSettings);settings.exportPresets[0].name='During export';await store.handleSettingsChange(settings);});
 const presetDuringExport=await snapshot();assert.equal(presetDuringExport.host.revision,2);assert.equal(presetDuringExport.status,'exporting');assert.deepEqual(presetDuringExport.presets.map(p=>p.name),['During export']);assert.equal(await page.evaluate(async()=>(await exportQa.target.getFile()).size),0);
 await page.evaluate(()=>{settingsQa.holdRead=true;});await releaseFile();await page.waitForFunction(()=>settingsQa.gated);
 const preferenceHeld=await snapshot();assert.equal(preferenceHeld.host.revision,2);assert.equal(preferenceHeld.stored.revision,3);assert.equal(preset(preferenceHeld),undefined);assert.equal(preferenceHeld.stored.settings.exportPresets.find(p=>p.id==='__last_used__').jpegQuality,60);
 await panel.getByRole('status').filter({hasText:'Saving last-used settings'}).waitFor();assert.equal(await panel.locator('button').last().isDisabled(),true);
 // Source controls can change after file success; the pending write keeps the exported values.
 await quality(95);await page.evaluate(()=>settingsQa.release());await page.waitForFunction(()=>proof.settingsHost.status().revision===3);
 console.log('File and preference ACKs released; checking captured values');
 const captured=await snapshot();assert.equal(captured.quality,95);assert.equal(preset(captured).jpegQuality,60);assert.equal(preset(captured).dpi,144);assert.equal(preset(captured).resizeValue,512);assert.deepEqual(captured.presets.map(p=>p.name),['During export','__last_used__']);
 const firstOutput=await outputFile();assert.deepEqual(firstOutput.dimensions,[512,384]);assert.equal(firstOutput.sha256,'9c9d3e159032939751177f4fa8d267a08485c453382cef452d9d0848663e6fae');
 // Reverse the overlap once GPU work is complete, so this tests busy writes
 // independently of machine speed and the unchanged 10-second storage deadline.
 await start();await page.evaluate(()=>{settingsQa.holdRead=true;const store=proof.settingsStore.getState(),settings=structuredClone(store.appSettings);settings.exportPresets.push({...settings.exportPresets[0],id:crypto.randomUUID(),name:'Pending preset',jpegQuality:95});settingsQa.pendingEdit=store.handleSettingsChange(settings).then(()=>true,error=>{settingsQa.editError=String(error);return false;});});await page.waitForFunction(()=>settingsQa.gated);
 const presetAckHeld=await snapshot();assert.equal(presetAckHeld.host.revision,3);assert.equal(presetAckHeld.stored.revision,4);assert.ok(!presetAckHeld.presets.some(p=>p.name==='Pending preset'));
 await releaseFile();await panel.getByRole('alert').filter({hasText:'File saved. Last-used settings were not saved.'}).waitFor();
 const busyPreference=await snapshot();assert.equal(busyPreference.status,'success');assert.equal(busyPreference.host.revision,3);assert.equal(busyPreference.host.saving,true);assert.equal(busyPreference.host.uncertain,false);assert.equal(busyPreference.stored.revision,4);assert.equal(busyPreference.commits,4);
 const secondOutput=await outputFile();assert.deepEqual(secondOutput.dimensions,[512,384]);assert.equal(secondOutput.sha256,'fbb978fc988eee41398eda62daeed55cd09be432de32c856a1d7bcf2f006170f');
 assert.equal(await page.evaluate(async()=>{settingsQa.release();return settingsQa.pendingEdit;}),true);await page.waitForFunction(()=>proof.settingsHost.status().revision===4);
 console.log('Pending preset ACK released; checking busy-write rejection');
 const busySettled=await snapshot();assert.equal(preset(busySettled).jpegQuality,60);assert.ok(busySettled.presets.some(p=>p.name==='Pending preset'));assert.equal(busySettled.commits,4);assert.equal(busySettled.stored.revision,4);
 // A genuine second page/connection commits a newer revision while the first page's file is pending.
 await page.reload();await page.waitForFunction(()=>!!globalThis.proof);assert.equal(await page.evaluate(()=>proof.store.getState().selectedImage),null);await open();await page.waitForFunction(()=>Number(document.querySelector('[aria-label="Original Export panel"] input[type=range]')?.value)===60);
 await quality(95);await start();const beforePeer=await snapshot();assert.equal(beforePeer.host.revision,4);
 const peer=await context.newPage();await peer.goto(origin+'/peer.html');const peerWrite=await peer.evaluate(async()=>{const {createBrowserSettings}=await import('/engine/settings-storage.js');const host=createBrowserSettings();try{const settings=await host.load();const before=host.status();settings.exportPresets.push({...settings.exportPresets.find(p=>p.id!=='__last_used__'),id:'other-tab',name:'Other tab'});await host.save(settings);return {before,after:host.status(),presets:settings.exportPresets};}finally{await host.close();}});assert.equal(peerWrite.before.revision,4);assert.equal(peerWrite.after.revision,5);await peer.close();
 await releaseFile();await panel.getByRole('alert').filter({hasText:'File saved. Last-used settings were not saved.'}).waitFor();
 const staleWriter=await snapshot();assert.equal(staleWriter.status,'success');assert.equal(staleWriter.host.revision,4);assert.equal(staleWriter.host.uncertain,true);assert.equal(staleWriter.stored.revision,5);assert.equal(staleWriter.commits,0);assert.ok(!staleWriter.presets.some(p=>p.name==='Other tab'));assert.ok(staleWriter.stored.settings.exportPresets.some(p=>p.name==='Other tab'));assert.equal(staleWriter.stored.settings.exportPresets.find(p=>p.id==='__last_used__').jpegQuality,60);
 const thirdOutput=await outputFile();assert.equal(thirdOutput.sha256,secondOutput.sha256);await page.waitForFunction(async()=>!(await proof.destination.listRecovery()).length);
 await page.screenshot({path:output.replace(/\.json$/,'.png')});
 await page.reload();await page.waitForFunction(()=>globalThis.proof?.trace.filter(t=>t.command==='load_settings').length>=2&&proof.settingsHost.status().revision===5&&!proof.settingsHost.status().uncertain&&!proof.settingsHost.status().pendingIO);const reconciled=await snapshot();reconciled.sourceLoadCommands=await page.evaluate(()=>proof.trace.filter(t=>t.command==='load_settings').length);assert.equal(reconciled.sourceLoadCommands,2);assert.equal(reconciled.host.revision,5);assert.equal(reconciled.host.uncertain,false);assert.equal(reconciled.commits,0);assert.ok(reconciled.presets.some(p=>p.name==='Other tab'));assert.equal(await page.evaluate(()=>proof.store.getState().selectedImage),null);
 const persisted=JSON.stringify(reconciled.stored);for(const value of ['browser-document:','browser-export:','lastExportPath','FileSystemHandle','qa-settings-concurrency'])assert.ok(!persisted.includes(value));
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(await page.evaluate(()=>proof.gpuErrors),[]);assert.equal(expectedConsoleErrors.length,2);assert.ok(expectedConsoleErrors.some(e=>e.includes('Reload settings before saving again')));assert.ok(expectedConsoleErrors.some(e=>e.includes('Settings changed in another tab')));
 await writeFile(output,JSON.stringify({scope:'Experimental original React preset/export concurrency. Original UI blocks preset edits during export; a programmatic original settings-store callback represents another component, not a UI click. Real public RAW, OPFS file ACK and IndexedDB readback/CAS. Second tab has its own settings host/IDB connection. Synthetic chooser; no OS permission/full App/native parity claim.',fixture:{id:pin.id,license:pin.license,sha256:pin.sourceSha256},source,presetUiBlocked,fileHeld,presetDuringExport,preferenceHeld,captured,firstOutput,presetAckHeld,busyPreference,secondOutput,busySettled,peerWrite,staleWriter,thirdOutput,reconciled,assertions:{capturedExportValues:true,latestPresetEditSurvives:true,noEarlyPreferenceStoreUpdate:true,busyWriteDoesNotOverwrite:true,newerTabRevisionPreserved:true,allFilesAcknowledgedAndPreserved:true,noAutomaticRetry:true,noDestinationAuthorityPersisted:true},pageErrors,failedRequests,externalRequests,expectedConsoleErrors,knownUnavailable},null,2)+'\n');console.log(JSON.stringify({concurrentPresets:true,capturedValues:true,busyWritePreserved:true,secondTabCas:true}));
 await page.evaluate(()=>proof.close());await context.close();
}catch(error){console.error(JSON.stringify({error:error.message,state:await page?.evaluate(()=>({status:globalThis.proof?.processStore?.getState().exportState,host:globalThis.proof?.settingsHost?.status(),presets:globalThis.proof?.settingsStore?.getState().appSettings?.exportPresets})).catch(()=>null),pageErrors,expectedConsoleErrors}));await page?.screenshot({path:output.replace(/\.json$/,'.failed.png')}).catch(()=>{});throw error;}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
