// Actual unpatched original import toolbar/hook, real IndexedDB ACK/CAS and OPFS export.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [stage,nativeDir,output]=process.argv.slice(2);if(!output)throw Error('IMPORT_STAGE NATIVE_REFERENCE_DIR OUTPUT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex'),meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json'))),native=JSON.parse(await readFile(path.join(nativeDir,'reference.json'))),nativeItems=JSON.parse(await readFile(path.join(nativeDir,'native.rrpreset'))).presets,items=JSON.parse(await readFile(path.join(nativeDir,'items.json')));
assert.deepEqual(source.presetLibrary,meta.presetLibrary);assert.ok(native.mergeProof.shapeAndNamesEqual&&native.mergeProof.freshIds);
for(const [name,sha]of Object.entries(meta.presetLibrary.sourceFiles))if(name.startsWith('src/'))assert.equal(hash(await readFile(path.join(stage,name))),sha,name);
for(const [name,sha]of Object.entries(source.runtimeSha256)){assert.equal(hash(await readFile(path.join(stage,'dist/engine',name))),sha);assert.equal(hash(await readFile(new URL('../experiments/rapidraw-wasm-core/'+name,import.meta.url))),sha);}
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml'};
async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name),url=prefix+'/'+e.name;if(e.isDirectory())await walk(file,url);else assets.set(url,[types[path.extname(file)]??'application/octet-stream',await readFile(file)]);}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));assets.set('/peer.html',['text/html',Buffer.from('<!doctype html><title>Library peer</title>')]);
const server=createServer((req,res)=>{const a=assets.get(new URL(req.url,'http://localhost').pathname);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'}).end(a[1]);});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const errors=[],consoleErrors=[],failed=[],external=[];
const strip=list=>list.map(i=>i.preset?{preset:{...i.preset,id:''}}:{folder:{...i.folder,id:'',children:i.folder.children.map(p=>({...p,id:''}))}}),ids=list=>list.flatMap(i=>i.preset?[i.preset.id]:[i.folder.id,...i.folder.children.map(p=>p.id)]);
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1050,height:760}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){external.push(u.origin);return r.abort();}return r.continue();});
 await context.addInitScript(({items})=>{
  const qa=globalThis.presetQa={mode:'normal',holdRead:false,wrote:false,gated:false,abortNext:false,commits:0,pickCount:0,
   wrapLibrary(backend){this.backend=backend;return {read:async()=>{const value=await backend.read();qa.raw=structuredClone(value);if(qa.holdRead&&qa.wrote){qa.gated=true;await new Promise(r=>qa.release=r);qa.gated=false;qa.holdRead=false;qa.wrote=false;}return value;},commit:async(...args)=>{await backend.commit(...args);qa.commits++;qa.wrote=true;},close:()=>backend.close()};},
   async pickInputs(){this.pickCount++;if(this.mode==='cancel')throw new DOMException('Cancelled','AbortError');const wrap=file=>({kind:'file',name:file.name,queryPermission:async()=> 'granted',getFile:async()=>file});const selected=[wrap(new File([JSON.stringify({creator:'Anonymous',presets:items})],'exposure.rrpreset',{lastModified:1}))];if(this.mode==='partial')selected.push(wrap(new File(['{bad'],'malformed.rrpreset',{lastModified:1})));return selected;},
   async pickFile(){this.root??=await(await navigator.storage.getDirectory()).getDirectoryHandle('qa-preset-import',{create:true});this.target=await this.root.getFileHandle('output-'+crypto.randomUUID()+'.rrpreset',{create:true});return this.target;},
  };
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const request=put.apply(this,args);if(this.transaction.db.name==='cw-rapidraw-preset-library-v1'&&qa.abortNext){qa.abortNext=false;this.transaction.abort();}return request;};
 },{items});
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 const ready=async revision=>{await page.waitForFunction(n=>globalThis.proof?.library.status().revision===n&&!proof.library.status().uncertain&&!proof.library.status().pendingIO&&proof.trace.some(t=>t.command==='load_presets'&&t.phase==='resolved'),revision);};
 const imp=page.locator('button[data-tooltip="Import presets from .rrpreset file"]'),exp=page.locator('button[data-tooltip="Export all presets to .rrpreset file"]');
 const snapshot=()=>page.evaluate(async()=>({library:proof.library.status(),stored:await presetQa.backend.read(),trace:proof.trace,commits:presetQa.commits}));
 await page.goto(origin);await ready(0);assert.equal(await exp.isDisabled(),true);
 const held=[];
 for(const revision of [1,2]){
  await page.evaluate(()=>{presetQa.holdRead=true;presetQa.wrote=false;});await imp.click();await page.waitForFunction(()=>presetQa.gated);
  const before=await snapshot();assert.equal(before.stored.revision,revision);assert.equal(before.library.revision,revision-1);assert.equal(before.library.busy,true);assert.equal(await exp.isDisabled(),true);assert.equal(before.trace.filter(t=>t.command==='handle_import_presets_from_files'&&t.phase==='resolved').length,revision-1);held.push(before);
  await page.evaluate(()=>presetQa.release());await page.waitForFunction(n=>proof.library.status().revision===n&&!proof.library.status().busy,revision);await exp.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('button[data-tooltip="Export all presets to .rrpreset file"]').disabled);
 }
 const imported=await snapshot();assert.deepEqual(strip(imported.stored.presets),strip(nativeItems));assert.equal(new Set(ids(imported.stored.presets)).size,6);assert.ok(ids(imported.stored.presets).every(id=>!ids(items).includes(id)));
 await exp.click();await page.waitForFunction(()=>proof.trace.some(t=>t.command==='handle_export_presets_to_file'&&t.phase==='resolved'));
 const exported=await page.evaluate(async()=>{const f=await presetQa.target.getFile();return {bytes:f.size,document:JSON.parse(await f.text())};});assert.deepEqual(exported.document.presets,imported.stored.presets);assert.equal(exported.document.creator,'Anonymous');
 const count=await page.evaluate(()=>proof.trace.filter(t=>t.command==='handle_import_presets_from_files'&&t.phase==='start').length);await page.evaluate(()=>presetQa.mode='cancel');await imp.click();await page.waitForFunction(()=>presetQa.pickCount===3);assert.equal(await page.evaluate(()=>proof.trace.filter(t=>t.command==='handle_import_presets_from_files'&&t.phase==='start').length),count);
 await page.evaluate(()=>presetQa.mode='partial');await imp.click();await page.waitForFunction(()=>proof.library.status().revision===3&&!proof.library.status().busy);const partial=await snapshot();assert.equal(partial.stored.presets.length,6);assert.ok(consoleErrors.some(e=>e.includes('malformed.rrpreset')));
 await page.evaluate(()=>{presetQa.mode='normal';presetQa.abortNext=true;});await imp.click();await page.waitForFunction(()=>proof.library.status().uncertain&&!proof.library.status().busy);const aborted=await snapshot();assert.deepEqual(aborted.stored,partial.stored);assert.equal(aborted.library.revision,3);assert.equal(aborted.trace.filter(t=>t.command==='handle_import_presets_from_files'&&t.phase==='resolved').length,3);
 await page.reload();await ready(3);const afterAbort=await snapshot();assert.deepEqual(afterAbort.stored,partial.stored);
 const peer=await context.newPage();await peer.goto(origin+'/peer.html');const peerWrite=await peer.evaluate(async items=>{const {createPresetLibrary}=await import('/engine/preset-library.js');const file=new File([JSON.stringify({presets:items})],'peer.rrpreset',{lastModified:1}),handle={kind:'file',name:file.name,queryPermission:async()=> 'granted',getFile:async()=>file};const h=createPresetLibrary({pickFiles:async()=>[handle]});try{await h.load();const before=h.status();const result=await h.importFiles(await h.choose());return {before,after:h.status(),result};}finally{await h.close();}},items);await peer.close();assert.equal(peerWrite.before.revision,3);assert.equal(peerWrite.after.revision,4);
 await imp.click();await page.waitForFunction(()=>proof.library.status().uncertain&&!proof.library.status().busy);const stale=await snapshot();assert.equal(stale.library.revision,3);assert.equal(stale.stored.revision,4);assert.deepEqual(stale.stored.presets,peerWrite.result.presets);assert.equal(stale.commits,0);
 await page.reload();await ready(4);const reconciled=await snapshot();assert.equal(reconciled.commits,0);assert.equal(reconciled.library.uncertain,false);assert.deepEqual(reconciled.stored.presets,peerWrite.result.presets);
 const serialized=JSON.stringify(reconciled.stored);for(const bad of ['browser-preset-input:','FileSystemHandle','filePath','exposure.rrpreset','creator','lastExportPath'])assert.ok(!serialized.includes(bad));
 await page.screenshot({path:output.replace(/\.json$/,'.png')});assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);assert.equal(consoleErrors.length,5);
 await writeFile(output,JSON.stringify({scope:meta.presetLibrary.scope,source,native,held,imported,exported,cancelWithoutInvoke:true,partial,aborted,afterAbort,peerWrite,stale,reconciled,errors,failed,external,expectedConsoleErrors:consoleErrors,assertions:{originalImportPanelHook:true,writeAndReadbackBeforeListUpdate:true,nativeMergeShapeNames:true,freshIds:true,partialFailures:true,realTransactionAbort:true,staleTabCasPreservesNewer:true,reloadWithoutRetry:true,noInputAuthorityPersisted:true,syntheticPicker:true}},null,2)+'\n');
 await page.evaluate(()=>proof.close());await context.close();console.log(JSON.stringify({originalPresetImport:true,readbackAck:true,nativeMergeParity:true,abortAndStaleCas:true}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
