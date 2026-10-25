// Actual original AppWrapper/App startup against real isolated IndexedDB.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';
const [stage,fixture,output]=process.argv.slice(2);if(!output)throw Error('APP_RECOVERY_STAGE PUBLIC_DNG OUTPUT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex');
const meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json')));
assert.deepEqual(source.appRecovery,meta.appRecovery);assert.deepEqual(source.appExport,meta.appExport);assert.equal(source.nativeSource,meta.nativeApplication.commit);
const pin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url))).fixtures.find(f=>f.id==='raw.pixls.us 1327');
assert.equal(pin.license,'CC0-1.0');assert.equal(hash(await readFile(fixture)),pin.sourceSha256);
const native=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/full-export-native.json',import.meta.url))).cases.find(c=>c.name==='identity-full');
for(const contract of [meta.appRoot,meta.appFile,meta.appExport,meta.appRecovery]){
 assert.equal(hash(await readFile(new URL('../'+contract.sourcePatch.path,import.meta.url))),contract.sourcePatch.sha256);
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))assert.equal(hash(await readFile(new URL('../'+name,import.meta.url))),sha);
}
assert.equal(hash(await readFile(path.join(stage,'main.tsx'))),meta.appRecovery.bootstrapFiles['experiments/rapidraw-react-proof/app-recovery-main.tsx']);
const contracts=['metadataLifecycle','metadataNavigation','metadataLibrary','metadataSelection','metadataFilmstrip','metadataCopyPaste','settingsUi','copyPasteSettings','settingsInitialization','settingsReadiness','appRoot','appFile','appExport','appRecovery'];
const patched=Object.assign({},meta.appExport.lastUsedPatch.patchedFiles,...contracts.map(k=>meta[k]?.sourcePatch?.patchedFiles??{}));
for(const [name,sha]of Object.entries({...meta.reactUi.sourceFiles,...meta.appFile.sourceFiles,...meta.appRecovery.sourceFiles,...patched}))assert.equal(hash(await readFile(path.join(stage,name))),sha,name);
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
  globalThis.appExportQa={mode:'fail',choices:[],events:[],closing:false,wrote:false,cancelClicked:false,
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
  globalThis.appRecoveryQa={mode:'normal',choices:[],closing:false,
   async pickFile(options){
    this.choices.push(options.suggestedName);this.closing=false;let reads=0;
    if(this.mode==='cancel')throw new DOMException('User cancelled','AbortError');
    this.root??=await(await navigator.storage.getDirectory()).getDirectoryHandle('qa-recovery-targets',{create:true});
    const target=await this.root.getFileHandle('recovered-'+this.choices.length+'.jpg',{create:true});this.target=target;
    return {kind:'file',name:target.name,queryPermission:o=>this.mode==='denied'?Promise.resolve('denied'):target.queryPermission(o),
     getFile:async()=>{if(this.mode==='newer'&&++reads===2){const w=await target.createWritable();await w.write('newer local file');await w.close();}return target.getFile();},
     createWritable:async options=>{const writer=await target.createWritable(options);return{write:b=>writer.write(b),abort:()=>writer.abort(),close:async()=>{this.closing=true;if(this.mode==='gate')await new Promise(r=>this.release=r);await writer.close();}};},
    };
   },
  };

 });

 const page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 page.on('console',m=>{if(m.type()==='error'){if(m.text().includes('does not support get_lensfun_makers')||m.text().includes('does not support list_luts'))knownUnavailable.push(m.text());else consoleErrors.push(m.text());}});
 const ready=()=>page.waitForFunction(()=>globalThis.appFileProof&&appFileProof.states.some(s=>s.status==='ready'));
 await page.goto(origin);await ready();await page.getByLabel('Open RAW File',{exact:true}).setInputFiles({name:'public-1327.dng',mimeType:'image/x-adobe-dng',buffer:await readFile(fixture)});
 await page.waitForFunction(()=>appFileProof.store.getState().selectedImage?.isReady&&appFileProof.store.getState().finalPreviewUrl);
 const panel=page.getByLabel('Original Export panel',{exact:true});await panel.getByText('Save with Metadata',{exact:true}).click();await panel.locator('button').last().click();
 await page.waitForFunction(()=>appFileProof.process.getState().exportState.status==='error');
 const original=await page.evaluate(async()=>(await appFileProof.destination.listRecovery())[0]);assert.equal(original.state,'uncertain');assert.equal(original.sha256,native.codec.sha256);assert.equal(original.bytes,native.codec.bytes);console.log('actual original App export created retained native JPEG');
 await page.evaluate(()=>appFileProof.close());await page.reload();await ready();
 const noReplay=await page.evaluate(async()=>({workers:appFileProof.workerStates.length,choices:appExportQa.choices.length,recoveryChoices:appRecoveryQa.choices.length,selected:appFileProof.store.getState().selectedImage,records:await appFileProof.destination.listRecovery()}));
 assert.equal(noReplay.workers,0);assert.equal(noReplay.choices,0);assert.equal(noReplay.recoveryChoices,0);assert.equal(noReplay.selected,null);assert.deepEqual(noReplay.records,[original]);
 await page.getByRole('button',{name:'Recovery copies',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Recovery copies',exact:true});await dialog.waitFor();
 const row=dialog.getByLabel('Recovery entry',{exact:true}).filter({hasText:original.name});await row.getByRole('button',{name:'Verify copy',exact:true}).waitFor();
 const bounds=await dialog.boundingBox();assert.ok(bounds.x>500&&bounds.x<700);assert.ok(bounds.y>100&&bounds.y<500);
 const choose=dialog.getByRole('button',{name:'Choose destination…',exact:true}),verify=row.getByRole('button',{name:'Verify copy',exact:true});
 assert.equal(await choose.isDisabled(),true);const prepare=async()=>{await verify.click();await choose.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('dialog button:last-child').disabled);};
 await prepare();assert.equal(await page.evaluate(()=>appRecoveryQa.choices.length),0);await page.evaluate(()=>appRecoveryQa.mode='cancel');await choose.click();await dialog.getByRole('status').filter({hasText:'Destination cancelled'}).waitFor();assert.equal(await choose.isDisabled(),true);
 await prepare();await page.evaluate(()=>appRecoveryQa.mode='denied');await choose.click();await dialog.getByRole('alert').filter({hasText:'permission'}).waitFor();assert.equal(await page.evaluate(async()=>(await appRecoveryQa.target.getFile()).size),0);
 await prepare();await page.evaluate(()=>appRecoveryQa.mode='newer');await choose.click();await dialog.getByRole('alert').filter({hasText:'changed'}).waitFor();assert.equal(await page.evaluate(async()=>(await appRecoveryQa.target.getFile()).text()),'newer local file');
 await prepare();await page.evaluate(()=>appRecoveryQa.mode='gate');await choose.click();await page.waitForFunction(()=>appRecoveryQa.closing);
 const held=await page.evaluate(async()=>({size:(await appRecoveryQa.target.getFile()).size,message:document.querySelector('dialog [role=status]').textContent,records:await appFileProof.destination.listRecovery()}));assert.equal(held.size,0);assert.ok(!held.message.includes('Copy saved'));
 assert.equal(await dialog.getByRole('button',{name:'Close recovery',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);await page.screenshot({path:output.replace(/\.json$/,'.pending.png')});
 await page.evaluate(()=>appRecoveryQa.release());await dialog.getByRole('status').filter({hasText:'Copy saved and verified'}).waitFor();
 const target=()=>page.evaluate(async()=>{const file=await appRecoveryQa.target.getFile(),bytes=await file.arrayBuffer(),bitmap=await createImageBitmap(file);const r={bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),dimensions:[bitmap.width,bitmap.height]};bitmap.close();return r;});
 const matches=r=>{assert.equal(r.bytes,native.codec.bytes);assert.equal(r.sha256,native.codec.sha256);assert.deepEqual(r.dimensions,[native.width,native.height]);};
 const saved=await target();matches(saved);const afterAck=await page.evaluate(()=>appFileProof.destination.listRecovery());assert.deepEqual(afterAck.find(r=>r.id===original.id),original);assert.equal(afterAck.length,2);await page.screenshot({path:output.replace(/\.json$/,'.png')});
 await dialog.getByLabel('New recovery copy retention',{exact:true}).selectOption('keep');await prepare();await page.evaluate(()=>appRecoveryQa.mode='normal');await choose.click();await dialog.getByRole('status').filter({hasText:'Copy saved and verified'}).waitFor();const kept=await target();matches(kept);
 const afterKeep=await page.evaluate(()=>appFileProof.destination.listRecovery());assert.equal(afterKeep.length,3);assert.equal(afterKeep.filter(r=>r.state==='complete'&&r.retention==='keep').length,1);assert.deepEqual(afterKeep.find(r=>r.id===original.id),original);
 await dialog.getByRole('button',{name:'Close recovery',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Recovery copies',exact:true}).evaluate(e=>e===document.activeElement),true);
 await page.evaluate(()=>appFileProof.close());await page.reload();await ready();
 const reloaded=await page.evaluate(async()=>({workers:appFileProof.workerStates.length,choices:appRecoveryQa.choices.length,exportChoices:appExportQa.choices.length,records:await appFileProof.destination.listRecovery(),writes:appFileProof.trace.filter(t=>t.command==='save_settings').length,nativeApiCalls,gpuErrors:appFileProof.gpuErrors}));
 assert.equal(reloaded.workers,0);assert.equal(reloaded.choices,0);assert.equal(reloaded.exportChoices,0);assert.equal(reloaded.writes,0);assert.deepEqual(reloaded.records,afterKeep);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);assert.deepEqual(reloaded.nativeApiCalls,[]);assert.deepEqual(reloaded.gpuErrors,[]);
 await writeFile(output,JSON.stringify({scope:meta.appRecovery.scope,source,fixture:{id:pin.id,license:pin.license,sha256:pin.sourceSha256},nativeReference:'full-export-native.json identity-full',original,noReplay,held,saved,afterAck,kept,afterKeep,reloaded,errors,consoleErrors,failed,external,knownUnavailable,assertions:{actualOriginalRootEntry:true,actualSourceExportRetainsNativeJpeg:true,reloadWithoutRawOpensRecovery:true,noAutomaticChooserOrWorker:true,explicitVerificationBeforePicker:true,cancelDoesNotWrite:true,deniedDoesNotWrite:true,newerTargetNotOverwritten:true,noSuccessBeforeCloseAndReadback:true,busyModalCannotClose:true,newCopyMatchesNativeJpeg:true,originalUncertainEntryPreserved:true,separateKeepRetention:true,modalRestoresFocus:true,reloadNoReplayOrSettingsWrite:true,noNativeOrExternalAuthority:true,osPickerPermissionPromptAccepted:false,fullAppAccepted:false}},null,2)+'\n');
 await page.evaluate(()=>appFileProof.close());await context.close();console.log('actual root recovery verification/new destination/ACK passed');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
