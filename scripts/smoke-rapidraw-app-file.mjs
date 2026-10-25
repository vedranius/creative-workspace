// Actual original AppWrapper/App startup against real isolated IndexedDB.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';
const [stage,fixture,output]=process.argv.slice(2);if(!output)throw Error('APP_FILE_STAGE PUBLIC_DNG OUTPUT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex');
const meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json')));
assert.deepEqual(source.appFile,meta.appFile);assert.equal(source.nativeSource,meta.nativeApplication.commit);
const pin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url))).fixtures.find(f=>f.id==='raw.pixls.us 1327');
assert.equal(pin.license,'CC0-1.0');assert.equal(hash(await readFile(fixture)),pin.sourceSha256);
const native512=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/quality-react-native-jpeg.json',import.meta.url)));
for(const contract of [meta.appRoot,meta.appFile]){
 assert.equal(hash(await readFile(new URL('../'+contract.sourcePatch.path,import.meta.url))),contract.sourcePatch.sha256);
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))assert.equal(hash(await readFile(new URL('../'+name,import.meta.url))),sha);
}
assert.equal(hash(await readFile(path.join(stage,'main.tsx'))),meta.appFile.bootstrapFiles['experiments/rapidraw-react-proof/app-file-main.tsx']);
const contracts=['metadataLifecycle','metadataNavigation','metadataLibrary','metadataSelection','metadataFilmstrip','metadataCopyPaste','settingsUi','copyPasteSettings','settingsInitialization','settingsReadiness','appRoot','appFile'];
const patched=Object.assign({},...contracts.map(k=>meta[k]?.sourcePatch?.patchedFiles??{}));
for(const [name,sha]of Object.entries({...meta.reactUi.sourceFiles,...meta.appFile.sourceFiles,...patched}))assert.equal(hash(await readFile(path.join(stage,name))),sha,name);
for(const [name,sha]of Object.entries(source.runtimeSha256)){
 assert.equal(hash(await readFile(path.join(stage,'dist/engine',name))),sha,name);
 assert.equal(hash(await readFile(new URL('../experiments/rapidraw-wasm-core/'+name,import.meta.url))),sha,name);
}
assert.equal(hash(await readFile(path.join(stage,'dist/engine/cw_rapidraw_wasm_probe_bg.wasm'))),source.wasmSha256);
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name),u=prefix+'/'+e.name;if(e.isDirectory())await walk(f,u);else assets.set(u,[types[path.extname(f)]??'application/octet-stream',await readFile(f)]);}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));assets.set('/peer.html',['text/html',Buffer.from('<!doctype html><title>Settings peer</title>')]);
const server=createServer((req,res)=>{const a=assets.get(new URL(req.url,'http://localhost').pathname);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'}).end(a[1]);});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const errors=[],consoleErrors=[],external=[],failed=[],knownUnavailable=[],expectedErrors=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext({viewport:{width:1600,height:950}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){external.push(u.origin);return r.abort();}return r.continue();});
 await context.addInitScript(()=>{
  const qa=globalThis.appFileQa={commits:0,hold:false,gated:false,wrote:false,mismatchNext:false,
   wrapBackend(backend){qa.backend=backend;return {read:async()=>{const actual=await backend.read();if(qa.wrote&&qa.hold){qa.gated=true;await new Promise(r=>qa.release=r);qa.gated=false;qa.hold=false;qa.wrote=false;if(qa.mismatchNext){qa.mismatchNext=false;return qa.previous;}}return actual;},commit:async(...args)=>{qa.previous=await backend.read();await backend.commit(...args);qa.commits++;qa.wrote=true;},close:()=>backend.close()};},
  };
  globalThis.nativeApiCalls=[];globalThis.authorityCalls=[];
  globalThis.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'unavailable'}},invoke(command){nativeApiCalls.push(command);return Promise.reject(Error('Native API unavailable: '+command));}};
  for(const name of ['showOpenFilePicker','showDirectoryPicker','showSaveFilePicker'])globalThis[name]=()=>{authorityCalls.push(name);return Promise.reject(Error('Unavailable picker'));};
  Object.defineProperty(navigator,'clipboard',{value:{readText(){authorityCalls.push('clipboard.read');throw Error('Unavailable clipboard');},writeText(){authorityCalls.push('clipboard.write');throw Error('Unavailable clipboard');}}});
 });
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 page.on('console',m=>{if(m.type()==='error'){if(m.text().includes('does not support get_lensfun_makers')||m.text().includes('does not support list_luts'))knownUnavailable.push(m.text());else if(m.text().includes('Auto-save failed:'))expectedErrors.push(m.text());else consoleErrors.push(m.text());}});
 const ready=()=>page.waitForFunction(()=>globalThis.appFileProof&&appFileProof.states.some(s=>s.status==='ready'));
 const clean=()=>page.waitForFunction(()=>{const s=appFileProof.metadataHost.status();return !s.dirty&&!s.busy&&!s.uncertain&&!s.pendingIO;});
 const snapshot=()=>page.evaluate(async()=>({view:appFileProof.ui.getState().activeView,path:appFileProof.store.getState().selectedImage?.path??null,exposure:appFileProof.store.getState().adjustments.exposure,status:appFileProof.metadataHost.status(),commits:appFileQa.commits,stored:await appFileQa.backend.read(),commands:appFileProof.trace.map(t=>t.command),nativeApiCalls,authorityCalls,roots:appFileProof.library.getState().rootPaths}));
 const file=await readFile(fixture);
 const open=()=>page.getByLabel('Open RAW File',{exact:true}).setInputFiles({name:'public-1327.dng',mimeType:'image/x-adobe-dng',buffer:file});
 const frame=async exposure=>{
  const native=native512.frames.find(f=>f.exposure===exposure);assert.ok(native);
  const got=await page.evaluate(async exposure=>{
   const deadline=performance.now()+30000;
   while(performance.now()<deadline){
    const s=appFileProof.store.getState(),f=appFileProof.trace.findLast(t=>t.command==='render-result'&&!t.interactive),url=s.finalPreviewUrl;
    if(s.selectedImage?.isReady&&s.adjustments.exposure===exposure&&f?.exposure===exposure&&url){
     const b=await(await fetch(url)).arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
     if(sha===f.jpegSha256&&appFileProof.store.getState().finalPreviewUrl===url)return {frame:f,sha256:sha,bytes:b.byteLength};
    }
    await new Promise(r=>requestAnimationFrame(r));
   }
   throw Error('Original App frame timeout '+JSON.stringify({state:appFileProof.store.getState().selectedImage,status:appFileProof.metadataHost.status(),trace:appFileProof.trace.slice(-4)}));
  },exposure);
  assert.equal(got.sha256,native.jpegSha256);assert.equal(got.bytes,native.jpegBytes);assert.equal(got.frame.rgbaSha256,native.rgbaSha256);return got;
 };
 const setExposure=async value=>{
  const slider=page.getByText('Exposure',{exact:true}).locator('xpath=../..');await slider.locator('span[data-tooltip]').click();
  const input=slider.locator('input[type=text]');await input.fill(String(value));await input.press('Enter');
  await page.waitForFunction(v=>appFileProof.store.getState().adjustments.exposure===v,value);
 };
 await page.goto(origin);await ready();await page.getByText('RapidRAW',{exact:true}).waitFor();
 const fresh=await snapshot();assert.deepEqual(fresh.commands,['load_settings']);assert.deepEqual(fresh.roots,[]);
 assert.equal(await page.getByRole('button',{name:'Open Folder',exact:true}).isDisabled(),true);
 // User activation opens the actual source input; cancellation does not change state.
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open RAW',exact:true}).click();await(await chooser).setFiles([]);assert.equal((await snapshot()).path,null);
 await open();const first=await frame(0);await clean();assert.equal((await snapshot()).view,'editor');
 console.log('original App RAW/native baseline matched');
 await page.screenshot({path:output.replace(/\.json$/,'.initial.png')});
 assert.equal(await page.getByRole('button',{name:'Open RAW',exact:true}).isDisabled(),true);
 // Actual source Exposure, source Back, and source Close wait for durable metadata readback.
 await page.evaluate(()=>{appFileQa.hold=true;appFileQa.wrote=false;});await setExposure(0.8);await page.waitForFunction(()=>appFileQa.gated);
 const back=page.locator('[data-bench-id="back-to-library"]');await back.click();const held=await snapshot();assert.equal(held.view,'editor');assert.equal(held.status.revision,0);assert.equal(held.stored.revision,1);
 await page.evaluate(()=>appFileQa.release());await page.waitForFunction(()=>appFileProof.ui.getState().activeView==='library');await clean();const left=await snapshot();
 await page.getByRole('button',{name:'Resume RAW',exact:true}).click();const resumed=await frame(0.8);assert.equal((await snapshot()).commits,left.commits);
 console.log('original Back/resume ACK passed');
 await page.evaluate(()=>{appFileQa.hold=true;appFileQa.wrote=false;});await setExposure(1.6);await page.waitForFunction(()=>appFileQa.gated);await page.getByRole('button',{name:'Close RAW',exact:true}).click();
 const closeHeld=await snapshot();assert.ok(closeHeld.path);assert.equal(closeHeld.status.revision,1);assert.equal(closeHeld.stored.revision,2);
 await page.screenshot({path:output.replace(/\.json$/,'.pending.png')});
 await page.evaluate(()=>{appFileQa.mismatchNext=true;appFileQa.release();});await page.getByRole('alert').filter({hasText:'Metadata not acknowledged'}).waitFor();const uncertain=await snapshot();assert.equal(uncertain.path,closeHeld.path);assert.equal(uncertain.status.uncertain,true);assert.equal(uncertain.commands.includes('document-close-ack'),false);
 console.log('uncertain close retained original editor');
 await page.evaluate(()=>appFileProof.close());await page.reload();await ready();await open();const reconciledFrame=await frame(1.6);await clean();const reconciled=await snapshot();assert.equal(reconciled.commits,0);
 // A later real slider edit during Close must veto the captured older draft.
 await page.evaluate(()=>{appFileQa.hold=true;appFileQa.wrote=false;});await setExposure(0.8);await page.waitForFunction(()=>appFileQa.gated);
 await page.getByRole('button',{name:'Close RAW',exact:true}).click();await setExposure(0);await page.evaluate(()=>appFileQa.release());
 await page.getByRole('alert').filter({hasText:/Metadata not acknowledged|draft changed/}).waitFor();await clean();
 const newer=await snapshot();assert.equal(newer.path,reconciled.path);assert.equal(newer.exposure,0);assert.equal(newer.status.exposure,0);await frame(0);
 const oldPath=reconciled.path;await page.getByRole('button',{name:'Close RAW',exact:true}).click();await page.waitForFunction(()=>appFileProof.store.getState().selectedImage===null);const closed=await snapshot();assert.equal(closed.view,'library');assert.equal(closed.commands.filter(c=>c==='document-close-ack').length,1);
 const refusal=await page.evaluate(async path=>{try{await appFileProof.transport.invoke('get_image_dimensions',{path});return 'accepted';}catch(error){return String(error);}},oldPath);assert.match(refusal,/Unknown browser document/);
 await open();const reopenedFrame=await frame(0);await clean();const reopened=await snapshot();assert.notEqual(reopened.path,oldPath);assert.equal(reopened.commits,newer.commits);
 assert.deepEqual(reopened.nativeApiCalls,[]);assert.deepEqual(reopened.authorityCalls,[]);assert.deepEqual(reopened.roots,[]);
 const unsupported=await page.evaluate(async()=>{try{await appFileProof.transport.invoke('export_images',{});return 'accepted';}catch(e){return String(e);}});assert.notEqual(unsupported,'accepted');
 await page.screenshot({path:output.replace(/\.json$/,'.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);assert.deepEqual(await page.evaluate(()=>appFileProof.gpuErrors),[]);assert.ok(expectedErrors.length>=1);
 const compact=s=>({...s,stored:s.stored?{revision:s.stored.revision,documents:s.stored.documents.map(({thumbnail,...d})=>({...d,thumbnailBytes:Buffer.from(thumbnail.split(',')[1],'base64').length,thumbnailSha256:hash(Buffer.from(thumbnail.split(',')[1],'base64'))}))}:null});
 await writeFile(output,JSON.stringify({scope:meta.appFile.scope,fixture:{id:pin.id,license:pin.license,sha256:pin.sourceSha256},source,fresh:compact(fresh),first,held:compact(held),left:compact(left),resumed,closeHeld:compact(closeHeld),uncertain:compact(uncertain),reconciled:compact(reconciled),reconciledFrame,newer:compact(newer),closed:compact(closed),reopened:compact(reopened),reopenedFrame,oldPathRefused:true,unsupportedExportRefused:true,errors,consoleErrors,external,failed,knownUnavailable,expectedErrors,assertions:{actualOriginalAppWrapperAndRoot:true,originalImageManagersAndEditorView:true,explicitSingleFileInput:true,cancelLeavesDocumentAbsent:true,originalExposureControl:true,originalBackWaitsForMetadataAck:true,cachedResumeNoWrite:true,closeWaitsForMetadataAck:true,uncertainCloseRetainsEditor:true,newerDraftVetoesClose:true,reloadReconcilesWithoutReplay:true,acknowledgedCloseInvalidatesOldPath:true,reopenRestoresContentBoundMetadata:true,nativeRgbaAndJpegExact:true,noNativeIpcOrFolderDiscovery:true,rootExportUnavailable:true,fullAppAccepted:false,osProviderAcceptance:false}},null,2)+'\n');
 await page.evaluate(()=>appFileProof.close());await context.close();console.log('actual original App File/Exposure/native/metadata-close-reopen passed');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
