// Actual original export preset controls, reviewed ACK patch and real IndexedDB transactions.
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
for(const [name,expected] of Object.entries({...meta.reactUi.sourceFiles,...meta.exportUi.sourceFiles,...meta.settingsUi.sourceFiles}))assert.equal(hash(await readFile(path.join(stage,name))),meta.settingsUi.sourcePatch.patchedFiles[name]??expected,name);
for(const [name,expected]of Object.entries(source.runtimeSha256)){for(const dir of ['public/engine','dist/engine'])assert.equal(hash(await readFile(path.join(stage,dir,name))),expected);assert.equal(hash(await readFile(new URL('../experiments/rapidraw-wasm-core/'+name,import.meta.url))),expected,'Reused stage differs from current runtime');}
assert.equal(hash(await readFile(path.join(stage,'dist/engine/cw_rapidraw_wasm_probe_bg.wasm'))),source.wasmSha256);
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),url=prefix+'/'+entry.name;if(entry.isDirectory())await walk(file,url);else assets.set(url,[types[path.extname(file)]||'application/octet-stream',await readFile(file)]);}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));assets.set('/public.dng',['application/octet-stream',raw]);
const server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':asset[0],'Cache-Control':'no-store'}).end(asset[1]);});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser,page;const pageErrors=[],failedRequests=[],externalRequests=[];
const expectedConsoleErrors=[],knownUnavailable=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext({viewport:{width:1700,height:1050}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){externalRequests.push(u.origin);return route.abort();}return route.continue();});
 await context.addInitScript(()=>{
  const qa=globalThis.settingsQa={holdRead:false,wrote:false,gated:false,commits:0,abortNext:false,wrapBackend(backend){this.backend=backend;return {
   read:async()=>{const value=await backend.read();qa.lastRaw=structuredClone(value);if(qa.holdRead&&qa.wrote){qa.gated=true;await new Promise(r=>qa.release=r);qa.holdRead=false;qa.wrote=false;qa.gated=false;}return value;},
   commit:async(...args)=>{await backend.commit(...args);qa.commits++;qa.wrote=true;},close:()=>backend.close(),
  };}};
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){const request=put.apply(this,args);if(this.name==='preferences'&&qa.abortNext){qa.abortNext=false;this.transaction.abort();}return request;};
 });
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));page.on('console',msg=>{if(msg.type()==='error'){if(msg.text().includes('does not support get_lensfun_makers'))knownUnavailable.push('get_lensfun_makers');else expectedConsoleErrors.push(msg.text());}});
 const open=async()=>{await page.getByLabel('Open RAW fixture').setInputFiles(fixture);await page.waitForFunction(()=>proof.store.getState().selectedImage?.isReady&&proof.store.getState().finalPreviewUrl);await page.locator('[data-tab-id="layout-tab-export"]').click();};
 await page.goto(origin);await page.waitForFunction(()=>!!globalThis.proof);await open();
 const panel=page.getByLabel('Original Export panel');
 const quality=async value=>{const c=panel.locator('input[type=range]').first().locator('xpath=../..');await c.locator('span[data-tooltip]').click();const input=c.locator('input[type=text]');await input.fill(String(value));await input.press('Enter');await page.waitForFunction(q=>Number(document.querySelector('[aria-label="Original Export panel"] input[type=range]')?.value)===q,value);};
 await panel.getByText('Save with Metadata',{exact:true}).click();await quality(60);
 await panel.getByText('Resize to Fit',{exact:true}).click();await panel.locator('input[type=number]:not([aria-label])').fill('1200');await panel.getByRole('button',{name:'Export Settings',exact:true}).click();await panel.getByLabel('Resolution',{exact:true}).fill('144');await panel.getByLabel('Resolution',{exact:true}).blur();
 const create=async name=>{await panel.locator('button[data-tooltip="Save current settings as new preset"]').click();const input=panel.getByPlaceholder('Preset Name',{exact:true});await input.fill(name);await input.press('Enter');};
 await page.evaluate(()=>{settingsQa.holdRead=true;});await create('Travel JPEG');await page.waitForFunction(()=>settingsQa.gated);
 const held=await page.evaluate(()=>({status:proof.settingsHost.status(),settings:proof.settingsStore.getState().appSettings,stored:settingsQa.lastRaw}));
 assert.equal(held.status.revision,0);assert.equal(held.status.saving,true);assert.equal(held.settings.exportPresets.length,0);assert.equal(held.stored.revision,1);assert.equal(await panel.getByRole('status').innerText(),'Saving preset…');assert.equal(await panel.getByPlaceholder('Preset Name',{exact:true}).count(),1);assert.equal(await panel.locator('[data-tooltip="Saved!"]').count(),0);
 await page.evaluate(()=>settingsQa.release());await page.waitForFunction(()=>proof.settingsHost.status().revision===1&&proof.settingsStore.getState().appSettings.exportPresets.length===1);
 const created=await page.evaluate(()=>structuredClone(proof.settingsStore.getState().appSettings.exportPresets[0]));assert.equal(created.jpegQuality,60);assert.equal(created.resizeValue,1200);assert.equal(created.dpi,144);
 await quality(95);await page.evaluate(()=>{settingsQa.holdRead=true;});await panel.locator('button[data-tooltip="Overwrite selected preset"]').click();await page.waitForFunction(()=>settingsQa.gated);
 assert.equal(await panel.locator('[data-tooltip="Saved!"]').count(),0);assert.equal(await page.evaluate(()=>proof.settingsStore.getState().appSettings.exportPresets[0].jpegQuality),60);
 await page.evaluate(()=>settingsQa.release());await page.waitForFunction(()=>proof.settingsHost.status().revision===2);await panel.locator('[data-tooltip="Saved!"]').waitFor();
 // A new host with the same database is stale after a UI mutation; transaction CAS
 // must reject it, independently of the React store and its in-memory revision.
 await page.reload();await page.waitForFunction(()=>!!globalThis.proof);
 const restored=await page.evaluate(()=>({settings:structuredClone(proof.settingsStore.getState().appSettings),document:proof.store.getState().selectedImage,status:proof.settingsHost.status()}));
 assert.equal(restored.settings.exportPresets[0].jpegQuality,95);assert.equal(restored.document,null);assert.equal(restored.status.revision,2);assert.ok(!JSON.stringify(restored.settings).includes('browser-document:'));assert.ok(!JSON.stringify(restored.settings).includes('browser-output:'));
 await open();await panel.getByText('Select a preset...',{exact:true}).click();await panel.getByText('Travel JPEG',{exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('[aria-label="Original Export panel"] input[type=range]')?.value)===95);await panel.getByRole('button',{name:'Export Settings',exact:true}).click();assert.equal(await panel.getByLabel('Resolution',{exact:true}).inputValue(),'144');
 // Actual IDB transaction abort: source UI must retain acknowledged preset/settings.
 await page.evaluate(()=>{settingsQa.abortNext=true;});await create('Must not persist');await panel.getByRole('alert').waitFor();
 const failed=await page.evaluate(async()=>({status:proof.settingsHost.status(),settings:structuredClone(proof.settingsStore.getState().appSettings),stored:await settingsQa.backend.read()}));
 assert.equal(failed.status.uncertain,true);assert.equal(failed.status.revision,2);assert.equal(failed.stored.revision,2);assert.deepEqual(failed.settings.exportPresets,restored.settings.exportPresets);assert.equal(failed.stored.settings.exportPresets.length,1);assert.equal(await panel.getByPlaceholder('Preset Name',{exact:true}).inputValue(),'Must not persist');
 await page.reload();await page.waitForFunction(()=>!!globalThis.proof);await open();await panel.getByText('Select a preset...',{exact:true}).click();await panel.getByText('Travel JPEG',{exact:true}).click();
 const conflict=await page.evaluate(async()=>{const m=await import('/engine/settings-storage.js'),other=m.createBrowserSettings(),old=await other.load();globalThis.staleSettingsHost=other;return old;});
 await page.evaluate(()=>{settingsQa.holdRead=true;});await panel.locator('button[data-tooltip="Delete preset"]').click();await page.waitForFunction(()=>settingsQa.gated);
 assert.equal(await page.evaluate(()=>proof.settingsStore.getState().appSettings.exportPresets.length),1);await page.evaluate(()=>settingsQa.release());await page.waitForFunction(()=>proof.settingsHost.status().revision===3&&proof.settingsStore.getState().appSettings.exportPresets.length===0);
 const cas=await page.evaluate(async old=>{let error;try{await staleSettingsHost.save(old);}catch(e){error=e.message;}await staleSettingsHost.close();return {error,stored:await settingsQa.backend.read()};},conflict);assert.match(cas.error,/another tab/);assert.equal(cas.stored.revision,3);assert.equal(cas.stored.settings.exportPresets.length,0);
 await page.reload();await page.waitForFunction(()=>!!globalThis.proof);assert.equal(await page.evaluate(()=>proof.settingsStore.getState().appSettings.exportPresets.length),0);
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(externalRequests,[]);assert.equal(expectedConsoleErrors.length,1);assert.match(expectedConsoleErrors[0],/Failed to save settings/);
 await open();await page.screenshot({path:output.replace(/\.json$/,'.png')});
 const corruption=await page.evaluate(async()=>{
  const bad={schema:2,revision:3,settings:{}};
  await new Promise((resolve,reject)=>{const r=indexedDB.open('cw-rapidraw-browser-settings-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('preferences','readwrite');tx.objectStore('preferences').put(bad,'settings');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(Error('QA corruption fixture failed'));};});
  let error;try{await proof.settingsHost.save(proof.settingsStore.getState().appSettings);}catch(e){error=e.message;}
  return {error,stored:await settingsQa.backend.read(),status:proof.settingsHost.status()};
 });assert.match(corruption.error,/Corrupt.*preserved/);assert.equal(corruption.stored.schema,2);assert.equal(corruption.stored.revision,3);assert.equal(corruption.status.uncertain,true);
 await writeFile(output,JSON.stringify({scope:'Original ExportPanel + reviewed ACK-only PresetsList/settings-store patch; actual public RAW load, create/overwrite/apply/delete/reload, real IndexedDB commit/readback holds, actual injected transaction abort and stale-host CAS. No path/grant persistence, full App/OS/provider acceptance or new renderer parity claim.',fixture:{id:pin.id,license:pin.license,sha256:pin.sourceSha256},source,created,restored:{revision:restored.status.revision,presets:restored.settings.exportPresets,documentRestored:false},ackGates:{createStoredRevision:held.stored.revision,createUiRevision:held.status.revision,createUiPresetCount:0,overwriteNoEarlySaved:true,deleteNoEarlyRemoval:true},failure:{actualIdbAbort:true,revision:failed.status.revision,priorPresetPreserved:true,uncertain:true},conflict:{error:cas.error,storedRevision:cas.stored.revision,noOverwrite:true},deletedAfterReload:true,corruption:{preserved:true,noWrite:true,error:corruption.error},pageErrors,failedRequests,externalRequests,expectedConsoleErrors,knownUnavailable},null,2)+'\n');
 console.log(JSON.stringify({settingsPersistence:true,readbackAckGates:3,realIdbAbortPreserved:true,staleWriterRefused:true}));await page.evaluate(()=>proof.close());await context.close();
}catch(error){console.error(JSON.stringify({error:error.message,state:await page?.evaluate(()=>({status:globalThis.proof?.settingsHost?.status(),settings:globalThis.proof?.settingsStore?.getState().appSettings})).catch(()=>null),pageErrors,expectedConsoleErrors}));await page?.screenshot({path:output.replace(/\.json$/,'.failed.png')}).catch(()=>{});throw error;}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
