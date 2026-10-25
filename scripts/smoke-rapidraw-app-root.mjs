// Actual original AppWrapper/App startup against real isolated IndexedDB.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';
const [stage,output]=process.argv.slice(2);if(!output)throw Error('APP_ROOT_STAGE OUTPUT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex');
const meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json')));
assert.deepEqual(source.appRoot,meta.appRoot);assert.deepEqual(source.settingsReadiness,meta.settingsReadiness);
assert.equal(source.nativeSource,meta.nativeApplication.commit);
for(const [name,sha]of Object.entries(meta.appRoot.bootstrapFiles)){const staged=name.endsWith('app-root-main.tsx')?'main.tsx':'app-root-native.js';assert.equal(hash(await readFile(path.join(stage,staged))),sha,name);assert.equal(hash(await readFile(new URL('../'+name,import.meta.url))),sha,name);}
for(const [name,sha]of Object.entries(meta.appRoot.sourcePatch.patchedFiles))assert.equal(hash(await readFile(path.join(stage,name))),sha,name);
for(const [name,sha]of Object.entries(meta.settingsReadiness.sourcePatch.patchedFiles))assert.equal(hash(await readFile(path.join(stage,name))),sha,name);
for(const [name,sha]of Object.entries(source.runtimeSha256))assert.equal(hash(await readFile(path.join(stage,'dist/engine',name))),sha,name);
assert.equal(hash(await readFile(path.join(stage,'dist/engine/cw_rapidraw_wasm_probe_bg.wasm'))),source.wasmSha256);
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name),u=prefix+'/'+e.name;if(e.isDirectory())await walk(f,u);else assets.set(u,[types[path.extname(f)]??'application/octet-stream',await readFile(f)]);}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));assets.set('/peer.html',['text/html',Buffer.from('<!doctype html><title>Settings peer</title>')]);
const server=createServer((req,res)=>{const a=assets.get(new URL(req.url,'http://localhost').pathname);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'}).end(a[1]);});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const errors=[],consoleErrors=[],external=[],failed=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1600,height:950}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){external.push(u.origin);return r.abort();}return r.continue();});
 await context.addInitScript(()=>{
  const qa=globalThis.appRootQa={commits:0,reads:0,hold:sessionStorage.getItem('hold')==='yes',fail:sessionStorage.getItem('fail')==='yes',wrapBackend(backend){qa.backend=backend;return {read:async()=>{qa.reads++;if(qa.fail)throw Error('Injected root settings failure');const actual=await backend.read();if(qa.hold){qa.gated=true;await new Promise(r=>qa.release=r);qa.gated=false;}return actual;},commit:async(...args)=>{await backend.commit(...args);qa.commits++;},close:()=>backend.close()};}};
  globalThis.nativeApiCalls=[];globalThis.authorityCalls=[];
  globalThis.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'unavailable'}},invoke(command){nativeApiCalls.push(command);return Promise.reject(Error('Native API unavailable: '+command));}};
  globalThis.Worker=class {constructor(){authorityCalls.push('worker');throw Error('No root worker authority');}};
  for(const name of ['showOpenFilePicker','showDirectoryPicker','showSaveFilePicker'])globalThis[name]=()=>{authorityCalls.push(name);return Promise.reject(Error('No root file authority'));};
  Object.defineProperty(navigator,'clipboard',{value:{readText(){authorityCalls.push('clipboard.read');throw Error('No clipboard authority');},writeText(){authorityCalls.push('clipboard.write');throw Error('No clipboard authority');}}});
 });
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 const ready=()=>page.waitForFunction(()=>globalThis.appRootProof&&appRootProof.states.some(s=>s.status==='ready'));
 const snapshot=()=>page.evaluate(async()=>({states:structuredClone(appRootProof.states),trace:structuredClone(appRootProof.trace),settings:structuredClone(appRootProof.settings.getState().appSettings),readiness:appRootProof.settings.getState().browserSettingsReady,platform:appRootProof.settings.getState().osPlatform,types:appRootProof.settings.getState().supportedTypes,host:appRootProof.host.status(),stored:await appRootQa.backend.read(),commits:appRootQa.commits,reads:appRootQa.reads,cloud:appRootProof.cloud.getState().authStatus,roots:appRootProof.library.getState().rootPaths,initialFile:appRootProof.process.getState().initialFileToOpen,nativeApiCalls:structuredClone(nativeApiCalls),authorityCalls:structuredClone(authorityCalls),nativeRefusals:structuredClone(globalThis.appRootNativeRefusals??[])}));
 await page.goto(origin);await ready();await page.getByText('RapidRAW',{exact:true}).waitFor();
 const folder=page.getByRole('button',{name:'Open Folder',exact:true});await folder.waitFor();assert.equal(await folder.isDisabled(),true);
 assert.equal(await page.getByRole('button').filter({has:page.locator('svg.lucide-settings')}).isDisabled(),true);
 const fresh=await snapshot();assert.equal(fresh.readiness,true);assert.equal(fresh.platform,'browser');assert.equal(fresh.cloud,'idle');assert.deepEqual(fresh.types,{raw:['dng','raf'],nonRaw:[]});assert.deepEqual(fresh.roots,[]);assert.equal(fresh.commits,0);assert.equal(fresh.stored,null);assert.deepEqual(fresh.trace,[{command:'load_settings'}]);
 await page.screenshot({path:output.replace(/\.json$/,'.png')});
 await page.setViewportSize({width:700,height:900});await page.getByText('RapidRAW',{exact:true}).waitFor();await page.screenshot({path:output.replace(/\.json$/,'.compact.png')});await page.setViewportSize({width:1600,height:950});
 // Real root hooks must not grant native open-with/external-edit/keyboard authority.
 await page.evaluate(()=>{appRootProof.process.getState().setProcess({initialFileToOpen:'unavailable-native:open-with',externalEditSession:{source:'unavailable-native:source',output:'unavailable-native:output'}});});
 for(const key of ['Control+o','Control+v','Delete','Escape'])await page.keyboard.press(key);
 await page.waitForTimeout(1100);const inactive=await snapshot();assert.equal(inactive.initialFile,'unavailable-native:open-with');assert.equal(inactive.commits,0);assert.deepEqual(inactive.trace,fresh.trace);assert.equal(await page.getByText('RapidRAW',{exact:true}).count(),1);
 // Persist a real admitted preference record through a separate IDB connection.
 const peer=await context.newPage();await peer.goto(origin+'/peer.html');const persisted=await peer.evaluate(async()=>{const {createBrowserSettings,createSettingsDatabase}=await import('/engine/settings-storage.js');const host=createBrowserSettings({backend:createSettingsDatabase()});const current=await host.load();await host.save({...current,copyPasteSettings:{mode:'replace',includedAdjustments:[],knownAdjustments:['exposure'],autoSync:false}});await host.close();return true;});assert.equal(persisted,true);await peer.close();
 await page.reload();await ready();const restored=await snapshot();assert.equal(restored.host.revision,1);assert.equal(restored.commits,0);assert.deepEqual(restored.settings.copyPasteSettings.includedAdjustments,[]);
 // Held and failed source root startup never mounts the original home controls.
 await page.evaluate(()=>sessionStorage.setItem('hold','yes'));await page.reload();await page.waitForFunction(()=>globalThis.appRootQa?.gated);await page.getByRole('status').filter({hasText:'Loading saved preferences'}).waitFor();const held=await snapshot();assert.equal(held.readiness,false);assert.equal(held.settings,null);assert.equal(await page.getByRole('button').count(),0);
 const refused=await page.evaluate(async()=>{try{await appRootProof.settings.getState().handleSettingsChange({});return null;}catch(error){return String(error);}});assert.match(refused,/not ready/);assert.equal((await snapshot()).trace.length,1);
 await page.evaluate(()=>{sessionStorage.removeItem('hold');appRootQa.release();});await ready();assert.equal((await snapshot()).readiness,true);
 await page.evaluate(()=>sessionStorage.setItem('fail','yes'));await page.reload();await page.getByRole('alert').filter({hasText:'Settings could not be loaded'}).waitFor();const failedLoad=await snapshot();assert.equal(failedLoad.readiness,false);assert.equal(failedLoad.settings,null);assert.equal(failedLoad.commits,0);assert.deepEqual(failedLoad.stored,restored.stored);assert.equal(await page.getByRole('button').count(),0);await page.screenshot({path:output.replace(/\.json$/,'.failed.png')});
 await page.evaluate(()=>{sessionStorage.removeItem('fail');sessionStorage.setItem('hold','yes');});await page.reload();await page.waitForFunction(()=>globalThis.appRootQa?.gated);await page.evaluate(()=>appRootProof.unmount());const closedHeld=await snapshot();assert.equal(closedHeld.readiness,false);assert.equal(closedHeld.states.at(-1).status,'closed');await page.evaluate(()=>{sessionStorage.removeItem('hold');appRootQa.release();});await page.waitForFunction(()=>!appRootProof.host.status().pendingIO);const afterLateRead=await snapshot();assert.equal(afterLateRead.settings,null);assert.equal(afterLateRead.states.some(s=>s.status==='ready'),false);assert.equal(afterLateRead.commits,0);await page.evaluate(()=>appRootProof.close());
 await page.reload();await ready();const reconciled=await snapshot();assert.equal(reconciled.host.revision,1);assert.equal(reconciled.commits,0);assert.deepEqual(reconciled.stored,restored.stored);
 // Cross the original 10-second AI polling interval; there must be no timer IO.
 await page.waitForTimeout(10500);const afterPollInterval=await snapshot();assert.deepEqual(afterPollInterval.trace,[{command:'load_settings'}]);assert.deepEqual(afterPollInterval.nativeApiCalls,[]);assert.deepEqual(afterPollInterval.authorityCalls,[]);assert.deepEqual(afterPollInterval.nativeRefusals,[]);
 await page.evaluate(()=>appRootProof.close());const final=await page.evaluate(()=>({states:appRootProof.states,readiness:appRootProof.settings.getState().browserSettingsReady,host:appRootProof.host.status(),trace:appRootProof.trace,nativeApiCalls,authorityCalls}));assert.equal(final.host.closed,true);assert.equal(final.readiness,false);assert.equal(final.states.at(-1).status,'closed');assert.deepEqual(final.nativeApiCalls,[]);assert.deepEqual(final.authorityCalls,[]);
 for(const snapshot of [fresh,inactive,restored,held,failedLoad,closedHeld,afterLateRead,reconciled]){assert.deepEqual(snapshot.nativeApiCalls,[]);assert.deepEqual(snapshot.authorityCalls,[]);assert.deepEqual(snapshot.nativeRefusals,[]);}
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);
 await writeFile(output,JSON.stringify({scope:meta.appRoot.scope,source,fresh,inactive,restored,held,refused,failedLoad,closedHeld,afterLateRead,reconciled,afterPollInterval,final,errors,consoleErrors,external,failed,assertions:{actualOriginalAppWrapperAndRoot:true,originalMainLibraryLayout:true,desktopAuthNotInitialized:true,explicitSourceCapabilities:true,unavailableFolderSettingsDisabled:true,noStartupNativeIpcOrListeners:true,externalEditAndOpenWithInactive:true,keyboardHasNoFileClipboardAuthority:true,realIndexedDbRead:true,noAutomaticPreferenceWrites:true,heldLoadBlocksHome:true,failedLoadBlocksHomeWithoutFallback:true,closedRootVetoesLateRead:true,explicitReloadReconcilesWithoutReplay:true,noAiPollingPastOriginalInterval:true,rootAndBackendClosed:true,responsiveOriginalLayout:true,priorFileEditorExportAcceptanceExtended:false,fullAppAccepted:false,rootFileIntegrationAccepted:false}},null,2)+'\n');await context.close();console.log('Actual original App root startup/layout/cleanup verified; full App/File integration remains open');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
