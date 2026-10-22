// Experimental command-shaped host + real RAW/JPEG and OPFS. Picker/faults are injected.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [wasmDir,rawFile,output]=process.argv.slice(2);
if(!output||!process.env.RAPIDRAW_NATIVE_SOURCE)throw Error('WASM_DIR PUBLIC_CC0_DNG OUTPUT_JSON; RAPIDRAW_NATIVE_SOURCE required');
const core=new URL('../experiments/rapidraw-wasm-core/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const pin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url))).fixtures.find(f=>f.id==='raw.pixls.us 1327');
const upstream=JSON.parse(await readFile(new URL('UPSTREAM.json',core))),raw=await readFile(rawFile);
assert.equal(pin.license,'CC0-1.0');assert.equal(hash(raw),pin.sourceSha256);
const defaults=await readFile(path.join(process.env.RAPIDRAW_NATIVE_SOURCE,'src/utils/defaultAdjustments.json'));assert.equal(hash(defaults),upstream.reactUi.sourceFiles['src/utils/defaultAdjustments.json']);
const wasm=await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe_bg.wasm'));
const assets=new Map([['/',['text/html','<!doctype html><title>Private export destination proof</title>']],['/public.dng',['application/octet-stream',raw]],['/defaultAdjustments.json',['application/json',defaults]],['/cw_rapidraw_wasm_probe.js',['text/javascript',await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe.js'))]],['/cw_rapidraw_wasm_probe_bg.wasm',['application/wasm',wasm]]]);
for(const name of ['export-client.js','export-worker.js','export-destination.js','export-bridge.js','webgpu-renderer.js','shader.wgsl'])assets.set('/'+name,[name.endsWith('.js')?'text/javascript':'text/plain',await readFile(new URL(name,core))]);
const server=createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204).end();return;}const asset=req.method==='GET'&&assets.get(req.url);if(!asset){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':asset[0],'Cache-Control':'no-store'}).end(asset[1]);});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const pageErrors=[],failedRequests=[],externalRequests=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext(),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){externalRequests.push(u.origin);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));await page.goto(origin);
 const proof=await page.evaluate(async()=>{
  const {createExportDestination}=await import('/export-destination.js'),{createExportBridge}=await import('/export-bridge.js'),{exportRawInWorker}=await import('/export-client.js');
  const ensure=(condition,message)=>{if(!condition)throw Error(message);},deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
  const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
  const root=await(await navigator.storage.getDirectory()).getDirectoryHandle('qa-'+crypto.randomUUID(),{create:true});
  const source=new File([await(await fetch('/public.dng')).arrayBuffer()],'public.dng'),doc={file:source,path:'browser-document:proof/public.dng',generation:1,ready:true};
  let retention='until-ack',target,targetName,permission='granted',closeGate,closing=false,failClose=false,mode='real',encoded,rawJobs=0,lastWorker;
  const events=[],nativeHash='9cdca25668bdf162cc052c2cce115e968d16780fee43567971532474067e0462';
  let opens=0;
  const wrap=()=>({kind:'file',name:targetName,queryPermission:async options=>permission==='granted'?target.queryPermission(options):permission,getFile:()=>target.getFile(),createWritable:async options=>{
   opens++;const w=await target.createWritable(options);
   return {write:b=>w.write(b),abort:()=>w.abort(),close:async()=>{closing=true;if(closeGate)await closeGate.promise;if(failClose)throw Error('Injected close failure');return w.close();}};
  }});
  const destination=createExportDestination({pickFile:async()=>wrap(),getRetention:()=>retention,getRoot:async()=>root});
  const host=createExportBridge({getDocument:()=>doc,emit:(event,payload)=>events.push({event,payload}),destination,runExport:async(bytes,options)=>{
   if(mode==='real'||mode==='real-cancel'){
    rawJobs++;lastWorker=await exportRawInWorker(bytes,{...options,onStatus:stage=>{if(mode==='real-cancel'&&stage.status==='gpu-submitted')host.cancel();}});
    if(lastWorker.ok)encoded=new Uint8Array(lastWorker.bytes);return lastWorker;
   }
   if(mode==='newer'){const w=await target.createWritable();await w.write('newer external content');await w.close();}
   if(mode==='revoke')permission='denied';
   return {ok:true,bytes:new Uint8Array(encoded)};
  }});
  async function select(name){targetName=name;target=await root.getFileHandle(name,{create:true});permission='granted';events.length=0;opens=0;closing=false;return host.pick({defaultPath:name});}
  const args=token=>({paths:[doc.path],outputFolderOrFile:token,isExplicitFilePath:true,baseOriginFolders:[],outputFormat:'jpg',currentEditPath:doc.path,currentEditAdjustments:{exposure:0},exportSettings:{filenameTemplate:'{original_filename}_edited',jpegQuality:90,dpi:300,resize:null,tiffBitDepth:16,keepMetadata:false,preserveTimestamps:false,preserveFolders:false,exportMasks:false,destinationType:'customFolder',subfolder:'',border:null,pad:null,watermark:null,stripGps:true}});
  const wait=async fn=>{const end=Date.now()+120000;while(!fn()){if(Date.now()>end)throw Error('Phase timeout');await new Promise(r=>setTimeout(r,10));}};
  closeGate=deferred();const pending=host.execute(args(await select('ack.jpg')));await wait(()=>closing);
  ensure(events.length===0,'Success before close ACK');const before=await destination.listRecovery();ensure(before.length===1&&before[0].state==='uncertain','Missing pre-close recovery');
  ensure(await digest(await destination.readRecovery(before[0].id))===nativeHash,'Pre-close native recovery mismatch');
  closeGate.resolve();const ack=await pending;closeGate=null;
  const saved=await target.getFile();ensure(ack.writeAcknowledged&&ack.recoveryId===null&&saved.size===655924&&await digest(await saved.arrayBuffer())===nativeHash,'Native output ACK mismatch');
  ensure(events.map(e=>e.event).join(',')==='batch-export-progress,export-complete','Host success events wrong');ensure((await destination.listRecovery()).length===0,'until-ack recovery not released');
  const bitmap=await createImageBitmap(saved),dimensions=[bitmap.width,bitmap.height];bitmap.close();
  const actualRaw={bytes:saved.size,sha256:nativeHash,dimensions,deviceDestroyed:lastWorker.deviceDestroyed,noSuccessBeforeClose:true,durableNativeRecoveryBeforeClose:true,retentionReleasedAfterHostAcceptance:true};
  mode='cached';retention='keep';const kept=await host.execute(args(await select('keep.jpg')));ensure(kept.recoveryId,'Keep output missing');
  ensure((await destination.listRecovery()).find(r=>r.id===kept.recoveryId).state==='complete','Keep state wrong');ensure(await digest(await destination.readRecovery(kept.recoveryId))===nativeHash,'Keep bytes differ');
  const faults=[];
  for(const fault of ['close','newer','revoke','stale']){
   retention='until-ack';failClose=fault==='close';mode=fault==='newer'?'newer':fault==='revoke'?'revoke':'cached';closeGate=fault==='stale'?deferred():null;
   const token=await select(fault+'.jpg');let message;
   const job=host.execute(args(token)).catch(e=>{message=String(e);});
   if(fault==='stale'){await wait(()=>closing);doc.generation++;closeGate.resolve();}
   await job;closeGate=null;failClose=false;
   ensure(message?.includes('retained for recovery')&&!events.some(e=>e.event==='export-complete'),'Fault reported success '+fault);
   const recovery=(await destination.listRecovery()).find(r=>r.name===fault+'.jpg');ensure(recovery&&await digest(await destination.readRecovery(recovery.id))===nativeHash,'Lost uncertain bytes '+fault);
   const file=await target.getFile();if(fault==='newer')ensure(await file.text()==='newer external content'&&opens===0,'Newer output overwritten');if(fault==='revoke')ensure(file.size===0&&opens===0,'Revoked output opened');
   faults.push({name:fault,retainedBytes:655924,retainedSha256:nativeHash,state:recovery.state,noSuccess:true,destinationBytes:file.size,newerContentPreserved:fault==='newer'?true:undefined,events:events.map(e=>e.event)});
  }
  mode='real-cancel';const cancelled=await host.execute(args(await select('cancel.jpg')));ensure(cancelled===null&&opens===0,'Cancelled job wrote output');
  ensure(lastWorker.reason==='aborted'&&!lastWorker.forcedTermination&&lastWorker.deviceDestroyed,'Native GPU cancellation failed');
  ensure(events.map(e=>e.event).join(',')==='export-cancelling,export-cancelled','Cancel host events failed');
  await host.close();
  return {actualRaw,rawJobs,retainedKeepBytes:655924,keptRecordState:'complete',faults,cancel:{reason:lastWorker.reason,deviceDestroyed:lastWorker.deviceDestroyed,forcedTermination:lastWorker.forcedTermination,destinationOpened:false},picker:'Injected chooser returning real OPFS FileSystemFileHandle; no OS picker permission acceptance',faultInputs:'After first native-exact RAW export, retention/fault cases reuse that JPEG in memory; cancellation runs another actual RAW worker',noAutomaticReplay:true};
 });
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(externalRequests,[]);
 const hostModules=Object.fromEntries(['export-destination.js','export-bridge.js','export-client.js','export-worker.js'].map(name=>[name,hash(assets.get('/'+name)[1])]));
 const report={scope:'Experimental single-file native-argument host + real full RAW/native-exact JPEG + OPFS ACK/recovery. Original ExportPanel/transport composition and common providers remain unaccepted.',fixture:{id:pin.id,license:pin.license,sha256:pin.sourceSha256},wasmSha256:hash(wasm),hostModules,...proof,pageErrors,failedRequests,externalRequests};
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({nativeJpegBytes:proof.actualRaw.bytes,rawJobs:proof.rawJobs,faults:proof.faults.length,cancel:proof.cancel}));
 await context.close();
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
