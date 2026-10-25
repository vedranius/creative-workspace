// Actual original AppWrapper/App startup against real isolated IndexedDB.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';
const [stage,fixture,output]=process.argv.slice(2);if(!output)throw Error('APP_EXPORT_STAGE PUBLIC_DNG OUTPUT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex');
const meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json')));
assert.deepEqual(source.appExport,meta.appExport);assert.equal(source.nativeSource,meta.nativeApplication.commit);
const pin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url))).fixtures.find(f=>f.id==='raw.pixls.us 1327');
assert.equal(pin.license,'CC0-1.0');assert.equal(hash(await readFile(fixture)),pin.sourceSha256);
const native=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/full-export-native.json',import.meta.url))).cases.find(c=>c.name==='identity-full');
for(const contract of [meta.appRoot,meta.appFile,meta.appExport]){
 assert.equal(hash(await readFile(new URL('../'+contract.sourcePatch.path,import.meta.url))),contract.sourcePatch.sha256);
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))assert.equal(hash(await readFile(new URL('../'+name,import.meta.url))),sha);
}
assert.equal(hash(await readFile(path.join(stage,'main.tsx'))),meta.appExport.bootstrapFiles['experiments/rapidraw-react-proof/app-export-main.tsx']);
const contracts=['metadataLifecycle','metadataNavigation','metadataLibrary','metadataSelection','metadataFilmstrip','metadataCopyPaste','settingsUi','copyPasteSettings','settingsInitialization','settingsReadiness','appRoot','appFile','appExport'];
const patched=Object.assign({},meta.appExport.lastUsedPatch.patchedFiles,...contracts.map(k=>meta[k]?.sourcePatch?.patchedFiles??{}));
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
let browser;const errors=[],consoleErrors=[],external=[],failed=[],knownUnavailable=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext({viewport:{width:1800,height:1050}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){external.push(u.origin);return r.abort();}return r.continue();});
 await context.addInitScript(()=>{
  globalThis.nativeApiCalls=[];
  globalThis.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'unavailable'}},invoke(command){nativeApiCalls.push(command);return Promise.reject(Error('Native API unavailable: '+command));}};
  globalThis.appExportQa={mode:'gate',choices:[],events:[],closing:false,wrote:false,cancelClicked:false,
   async pickFile(options){
    this.choices.push(options.suggestedName);this.closing=false;this.wrote=false;
    if(this.mode==='chooser-abort')throw new DOMException('User cancelled','AbortError');
    this.root??=await(await navigator.storage.getDirectory()).getDirectoryHandle('qa-root-export-'+crypto.randomUUID(),{create:true});
    const target=await this.root.getFileHandle('output-'+this.choices.length+'.jpg',{create:true});this.target=target;
    return {kind:'file',name:target.name,queryPermission:o=>this.mode==='denied'?Promise.resolve('denied'):target.queryPermission(o),
     getFile:async()=>{const actual=await target.getFile();return this.mode==='mismatch'&&this.wrote?new File(['mismatched-ack'],target.name,{lastModified:actual.lastModified}):actual;},
     createWritable:async options=>{const writer=await target.createWritable(options);return {write:b=>writer.write(b),abort:()=>writer.abort(),close:async()=>{
      this.closing=true;if(this.mode==='gate')await new Promise(r=>this.release=r);if(this.mode==='fail')throw Error('Injected destination close failure');
      await writer.close();this.wrote=true;
     }};},
    };
   },
   onWorkerStatus(state){if(this.mode==='cancel'&&state.status==='gpu-submitted'){
    const buttons=document.querySelector('[aria-label="Original Export panel"]').querySelectorAll('button');buttons[buttons.length-1].click();this.cancelClicked=true;
   }},
  };
 });
 const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 page.on('console',m=>{if(m.type()==='error'){if(m.text().includes('does not support get_lensfun_makers')||m.text().includes('does not support list_luts'))knownUnavailable.push(m.text());else consoleErrors.push(m.text());}});
 const ready=()=>page.waitForFunction(()=>globalThis.appFileProof&&appFileProof.states.some(s=>s.status==='ready'));
 const loaded=()=>page.waitForFunction(()=>appFileProof.store.getState().selectedImage?.isReady&&appFileProof.store.getState().finalPreviewUrl);
 const panel=page.getByLabel('Original Export panel',{exact:true}),button=panel.locator('button').last();
 const exportStatus=status=>page.waitForFunction(status=>appFileProof.process.getState().exportState.status===status,status);
 const jobClick=async()=>{const before=await page.evaluate(()=>appFileProof.trace.filter(t=>t.command==='export_images').length);await button.click();await page.waitForFunction(n=>appFileProof.trace.filter(t=>t.command==='export_images').length>n,before);};
 const snapshot=()=>page.evaluate(async()=>({state:structuredClone(appFileProof.process.getState().exportState),settings:appFileProof.host.status(),settingsWrites:appFileProof.trace.filter(t=>t.command==='save_settings').length,
  choices:appExportQa.choices.slice(),events:appExportQa.events.map(e=>e.status),workerStates:appFileProof.workerStates.slice(),recovery:await appFileProof.destination.listRecovery(),targetSize:appExportQa.target?(await appExportQa.target.getFile()).size:null,nativeApiCalls}));
 const target=()=>page.evaluate(async()=>{const file=await appExportQa.target.getFile(),bytes=await file.arrayBuffer(),bitmap=await createImageBitmap(file);const r={bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),dimensions:[bitmap.width,bitmap.height]};bitmap.close();return r;});
 const matches=r=>{assert.equal(r.bytes,native.codec.bytes);assert.equal(r.sha256,native.codec.sha256);assert.deepEqual(r.dimensions,[native.width,native.height]);};
 await page.goto(origin);await ready();await page.getByLabel('Open RAW File',{exact:true}).setInputFiles({name:'public-1327.dng',mimeType:'image/x-adobe-dng',buffer:await readFile(fixture)});await loaded();console.log('root RAW loaded');await panel.waitFor();console.log('original ExportPanel mounted');
 await page.evaluate(()=>{appFileProof.process.subscribe(s=>appExportQa.events.push(structuredClone(s.exportState)));});
 // Original native metadata default is visible and refused before a worker starts.
 await button.click();await exportStatus('error');console.log('metadata refusal reached');const refused=await snapshot();assert.match(refused.state.errorMessage,/without metadata/);assert.equal(refused.workerStates.length,0);assert.equal(refused.settingsWrites,0);
 await panel.getByText('Save with Metadata',{exact:true}).click();
 await page.evaluate(()=>appExportQa.mode='chooser-abort');await button.click();const chooserAbort=await snapshot();console.log('chooser cancellation reached');assert.equal(chooserAbort.workerStates.length,0);assert.equal(chooserAbort.settingsWrites,0);
 await page.evaluate(()=>appExportQa.mode='denied');await button.click();await page.waitForFunction(()=>appFileProof.process.getState().exportState.errorMessage.includes('permission'));const denied=await snapshot();console.log('permission refusal reached');assert.equal(denied.workerStates.length,0);assert.equal(denied.settingsWrites,0);
 await page.evaluate(()=>{appExportQa.mode='gate';appExportQa.events=[];});await button.click();await page.waitForFunction(()=>appExportQa.closing);const held=await snapshot();assert.equal(held.state.status,'exporting');assert.equal(held.targetSize,0);assert.equal(held.settingsWrites,0);assert.equal(held.recovery.length,1);assert.equal(held.recovery[0].state,'uncertain');assert.equal(held.events.includes('success'),false);
 assert.equal(await page.getByRole('button',{name:'Close RAW',exact:true}).isDisabled(),true);
 await page.locator('[data-bench-id="back-to-library"]').click();assert.equal(await page.evaluate(()=>appFileProof.ui.getState().activeView),'editor');
 await page.screenshot({path:output.replace(/\.json$/,'.pending.png')});
 await page.evaluate(()=>appExportQa.release());await exportStatus('success');const saved=await target();matches(saved);
 await page.waitForFunction(()=>!appFileProof.host.status().busy&&appFileProof.settings.getState().appSettings.exportPresets.some(p=>p.id==='__last_used__'));
 await page.waitForFunction(async()=>!(await appFileProof.destination.listRecovery()).length);const success=await snapshot();assert.equal(success.settingsWrites,1);console.log('actual root/native JPEG and delayed file/preferences ACK passed');
 await page.screenshot({path:output.replace(/\.json$/,'.png')});
 // Retention is selected independently from the original destination chooser.
 await page.getByLabel('Recovery copy retention',{exact:true}).selectOption('keep');await page.evaluate(()=>appExportQa.mode='normal');await jobClick();await exportStatus('success');const kept=await snapshot();assert.equal(kept.recovery.length,1);assert.equal(kept.recovery[0].retention,'keep');assert.equal(kept.recovery[0].state,'complete');matches(await target());
 await page.getByLabel('Recovery copy retention',{exact:true}).selectOption('until-ack');await page.evaluate(()=>appExportQa.mode='fail');await jobClick();await exportStatus('error');const failure=await snapshot();assert.match(failure.state.errorMessage,/retained for recovery/);assert.equal(failure.recovery.length,2);assert.ok(failure.recovery.some(r=>r.state==='uncertain'));
 await page.evaluate(()=>appExportQa.mode='cancel');await jobClick();await exportStatus('cancelled');const cancelled=await snapshot();assert.equal(await page.evaluate(()=>appExportQa.cancelClicked),true);assert.equal(cancelled.recovery.length,2);
 await page.evaluate(()=>appExportQa.mode='mismatch');await jobClick();await exportStatus('error');const mismatch=await snapshot();assert.match(mismatch.state.errorMessage,/ACK readback mismatch/);assert.equal(mismatch.recovery.length,3);const writtenUncertain=await target();matches(writtenUncertain);
 const retained=await page.evaluate(async()=>{const records=await appFileProof.destination.listRecovery(),out=[];for(const record of records){const bytes=await appFileProof.destination.readRecovery(record.id);out.push({id:record.id,bytes:bytes.length,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')});}return out;});assert.equal(retained.length,3);for(const r of retained){assert.equal(r.sha256,native.codec.sha256);assert.equal(r.bytes,native.codec.bytes);}
 console.log('source cancel and uncertain readback preserve recovery');
 // Closing/reloading the real root never replays output or hides recovery.
 await page.evaluate(()=>appFileProof.close());await page.reload();await ready();const reloaded=await snapshot();assert.equal(reloaded.state.status,'idle');assert.equal(reloaded.recovery.length,3);assert.equal(reloaded.workerStates.length,0);assert.equal(reloaded.choices.length,0);assert.equal(reloaded.settingsWrites,0);
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);assert.deepEqual(reloaded.nativeApiCalls,[]);assert.deepEqual(await page.evaluate(()=>appFileProof.gpuErrors),[]);
 await writeFile(output,JSON.stringify({scope:meta.appExport.scope,fixture:{id:pin.id,license:pin.license,sha256:pin.sourceSha256},source,nativeReference:'full-export-native.json identity-full',refused,chooserAbort,denied,held,saved,success,kept,failure,cancelled,mismatch,writtenUncertain,retained,reloaded,errors,consoleErrors,external,failed,knownUnavailable,assertions:{actualOriginalAppAndExportPanel:true,sourceJpegAndCancelHandlers:true,nativeFullJpegExact:true,metadataRefusedBeforeWorker:true,chooserCancelNoWorkerOrWrite:true,deniedPermissionNoWorkerOrWrite:true,noSuccessBeforeFileCloseReadback:true,lastUsedPreferenceOnlyAfterFileAck:true,rootCannotLeaveOrCloseDuringExport:true,separateRetentionChoice:true,keepRetainsCompleteCopy:true,failedCloseRetainsUncertainCopy:true,sourceCancelStopsWorkerBeforeOutput:true,mismatchedReadbackNeverSucceeds:true,recoveryBytesNativeExact:true,rootReloadDoesNotReplayOutputs:true,rootReloadPreservesRecovery:true,noNativeOrExternalAuthority:true,fullAppAccepted:false,osPickerPermissionPromptAccepted:false,userRecoveryUiAccepted:false}},null,2)+'\n');
 await page.evaluate(()=>appFileProof.close());await context.close();console.log('actual root ExportPanel/ACK/retention/recovery passed');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
