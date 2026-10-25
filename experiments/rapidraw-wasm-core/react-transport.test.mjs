import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReactTransport} from './react-transport.js';
const create=()=>createReactTransport({wasm:{},device:{queue:{onSubmittedWorkDone:async()=>{}}},shaderSource:'',defaults:{}});
test('browser document registry refuses paths, unselected files, saves and commands',async()=>{
 const bridge=create();assert.throws(()=>bridge.selectFile({size:1}));assert.throws(()=>bridge.selectFile(new File([],'empty.dng')));
 const first=bridge.selectFile(new File(['x'],'one.dng'));assert.ok(first.startsWith('browser-document:'));
 assert.deepEqual(await bridge.invoke('load_metadata',{path:first}),{adjustments:null});
 const second=bridge.selectFile(new File(['y'],'two.dng'));assert.notEqual(first,second);
 await assert.rejects(bridge.invoke('load_metadata',{path:first}),/Unknown browser document/);
 await assert.rejects(bridge.invoke('load_metadata',{path:'/etc/passwd'}),/Unknown browser document/);
 await assert.rejects(bridge.invoke('save_metadata_and_update_thumbnail',{}),{code:'unavailable-command'});
 await assert.rejects(bridge.invoke('export_image',{}),{code:'unavailable-command'});
 await bridge.close();await assert.rejects(bridge.invoke('load_metadata',{path:second}),/closed/);
});
test('selecting a new File terminates an in-flight original RAW worker and refuses its result',async()=>{
 const previous=globalThis.Worker;let terminated=0,posted;
 globalThis.Worker=class{terminate(){terminated++;}postMessage(data){posted=data;}};
 try{
  const bridge=create();const path=bridge.selectFile(new File(['x'],'one.dng'));
  const loading=bridge.invoke('load_image',{path});
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(posted.command,'load');
  bridge.selectFile(new File(['y'],'two.dng'));
  await assert.rejects(loading,/Superseded/);assert.equal(terminated,1);await bridge.close();
 }finally{globalThis.Worker=previous;}
});
test('Quality worker remains owned after load, rejects a concurrent stale path, and terminates on clear',async()=>{
 const previous=globalThis.Worker;let terminated=0,loaded=0;
 globalThis.Worker=class{terminate(){terminated++;}postMessage(data){loaded++;queueMicrotask(()=>this.onmessage({data:{id:data.id,ok:true,width:2048,height:1536,developmentMode:'native-quality',rgbSha256:'test',asShot:{whiteBalance:{temperature:6000,tint:0}}}}));}};
 try{
  const bridge=create();const path=bridge.selectFile(new File(['x'],'public.dng'));
  const result=await bridge.invoke('load_image',{path});assert.equal(result.width,2048);assert.equal(result.height,1536);assert.equal(loaded,1);assert.equal(terminated,0);
  assert.deepEqual(await bridge.invoke('get_image_dimensions',{path}),{width:2048,height:1536});
  await assert.rejects(bridge.invoke('get_image_dimensions',{path:'other'}),/Unknown/);
  await assert.rejects(bridge.invoke('load_image',{path:'other'}),/Unknown/);assert.equal(terminated,0);
  await bridge.invoke('clear_session_caches');assert.equal(terminated,1);await bridge.close();assert.equal(terminated,1);
 }finally{globalThis.Worker=previous;}
});
test('fine rotation refuses malformed angles without losing the document',async()=>{
 const previous=globalThis.Worker;
 globalThis.Worker=class{terminate(){}postMessage(data){queueMicrotask(()=>this.onmessage({data:{id:data.id,ok:true,width:2048,height:1536,asShot:{}}}));}};
 try{const bridge=create(),path=bridge.selectFile(new File(['x'],'public.dng'));await bridge.invoke('load_image',{path});
 for(const rotation of [NaN,Infinity,-46,46,'5'])await assert.rejects(bridge.invoke('apply_adjustments',{jsAdjustments:{rotation}}),/fine rotation/);
 assert.deepEqual(await bridge.invoke('load_metadata',{path}),{adjustments:null});await bridge.close();
 }finally{globalThis.Worker=previous;}
});

test('export cancel bypasses pending preview queue; native error strings and source filename survive',async()=>{
 const previous=globalThis.Worker;let posted,cancelled=0,closed=false,hostContext;
 globalThis.Worker=class{terminate(){}postMessage(data){posted=data;}};
 try{
  const bridge=createReactTransport({wasm:{},device:{queue:{onSubmittedWorkDone:async()=>{}}},defaults:{},exportFactory:context=>{hostContext=context;return {cancel(){cancelled++;},pick:async()=> 'opaque-token',execute:async()=>{throw Error('Metadata unavailable');},close:async()=>{closed=true;}};}});
  const path=bridge.selectFile(new File(['x'],'public.dng'));assert.ok(path.endsWith('/public.dng'));
  const loading=bridge.invoke('load_image',{path});await new Promise(r=>setTimeout(r,10));assert.ok(posted);
  await bridge.invoke('cancel_export');assert.ok(cancelled>=1);assert.equal(hostContext.getDocument().ready,false);
  await assert.rejects(bridge.invoke('export_images',{}),error=>error==='Metadata unavailable');
  assert.equal(await bridge.pickExport({defaultPath:'public_edited.jpg'}),'opaque-token');
  // Resolve the stalled preview load only after the immediate cancel has completed.
  // A selection terminates and rejects the old worker, preserving new generation identity.
  bridge.selectFile(new File(['y'],'next.dng'));await assert.rejects(loading,/Superseded/);
  let event;const unlisten=await bridge.listen('export-error',e=>{event=e;});hostContext.emit('export-error','useful text');assert.equal(event.payload,'useful text');unlisten();hostContext.emit('export-error','ignored');assert.equal(event.payload,'useful text');
  await bridge.close();assert.equal(closed,true);assert.throws(()=>bridge.selectFile(new File(['x'],'closed.dng')),/closed/);
 }finally{globalThis.Worker=previous;}
});

test('original preset preview requires a loaded RAW and refuses target/ROI/interactive overrides',async()=>{
 const bridge=create();await assert.rejects(bridge.invoke('generate_preset_preview',{jsAdjustments:{}}),/No original image loaded/);
 for(const extra of [{targetResolution:999999},{roi:{}},{isInteractive:true}])await assert.rejects(bridge.invoke('generate_preset_preview',{jsAdjustments:{},...extra}),/adjustments only/);
 await bridge.close();await assert.rejects(bridge.invoke('generate_preset_preview',{jsAdjustments:{}}),/closed/);
});

function metadataSelectionFixture(){
 const status={dirty:true,busy:false,uncertain:false,pendingIO:false},state={selectedImage:null,adjustments:{exposure:0.8}};
 let cancelCount=0;
 const metadataHost={status:()=>({...status}),load:async()=>({adjustments:null}),snapshot:()=>({adjustments:null}),close:async()=>{}};
 const device={queue:{onSubmittedWorkDone:async()=>{}}};
 const bridge=createReactTransport({metadataHost,wasm:{},device,defaults:{}});
 const path=bridge.selectFile(new File(['a'],'same.dng'));
 state.selectedImage={path,isReady:true};
 return {bridge,device,state,status,path,getState:()=>state,cancelDebounce:()=>cancelCount++,cancelled:()=>cancelCount};
}
async function withMetadataDocument(fn){
 const prior=globalThis.Worker;
 globalThis.Worker=class{terminate(){}postMessage(d){queueMicrotask(()=>this.onmessage({data:{id:d.id,ok:true,width:2,height:2,asShot:{}}}));}};
 const f=metadataSelectionFixture();try{await f.bridge.invoke('load_image',{path:f.path});await fn(f);}finally{await f.bridge.close();globalThis.Worker=prior;}
}
test('metadata selection waits for ACK, refuses overlap/synchronous bypass and retires old path only afterwards',async()=>{
 await withMetadataDocument(async f=>{let release;const ack=new Promise(r=>release=r);let selected=false;
 const job=f.bridge.selectFileAcknowledged(new File(['b'],'same.dng'),{...f,flushMetadata:()=>ack}).then(p=>{selected=true;return p;});
 await new Promise(r=>setTimeout(r,1));assert.equal(selected,false);assert.deepEqual(await f.bridge.invoke('get_image_dimensions',{path:f.path}),{width:2,height:2});
 assert.throws(()=>f.bridge.selectFile(new File(['b'],'same.dng')),/acknowledged/);await assert.rejects(f.bridge.selectFileAcknowledged(new File(['b'],'same.dng'),f),/pending/);
 f.status.dirty=false;release(true);const next=await job;assert.notEqual(next,f.path);assert.equal(f.cancelled(),1);await assert.rejects(f.bridge.invoke('load_metadata',{path:f.path}),/Unknown/);
 });
});
test('failed ACK and a newer source draft both keep the old metadata document and debounce intact',async()=>{
 for(const mode of ['failure','newer'])await withMetadataDocument(async f=>{
  await assert.rejects(f.bridge.selectFileAcknowledged(new File(['b'],'same.dng'),{...f,flushMetadata:async()=>{if(mode==='newer'){f.state.adjustments={exposure:0};f.status.dirty=false;return true;}f.status.uncertain=true;return false;}}),mode==='failure'?/not acknowledged/:/draft changed/);
  assert.deepEqual(await f.bridge.invoke('get_image_dimensions',{path:f.path}),{width:2,height:2});assert.equal(f.cancelled(),0);
 });
});
test('closing during metadata flush prevents selecting a late result',async()=>{
 await withMetadataDocument(async f=>{let release;const ack=new Promise(r=>release=r),job=f.bridge.selectFileAcknowledged(new File(['b'],'same.dng'),{...f,flushMetadata:()=>ack});await f.bridge.close();f.status.dirty=false;release(true);await assert.rejects(job,/Superseded/);assert.equal(f.cancelled(),0);});
});

test('a failed clean RAW decode permits another explicit File selection without discarding a dirty or uncertain draft',async()=>{
 const prior=globalThis.Worker;globalThis.Worker=class{terminate(){}postMessage(d){queueMicrotask(()=>this.onmessage({data:{id:d.id,ok:false,error:'Unsupported RAW'}}));}};
 const f=metadataSelectionFixture();try{await assert.rejects(f.bridge.invoke('load_image',{path:f.path}),/Unsupported/);f.state.selectedImage=null;
 await assert.rejects(f.bridge.selectFileAcknowledged(new File(['b'],'same.dng'),f),/Wait/);f.status.dirty=false;f.status.uncertain=true;await assert.rejects(f.bridge.selectFileAcknowledged(new File(['b'],'same.dng'),f),/Wait/);
 f.status.uncertain=false;assert.notEqual(await f.bridge.selectFileAcknowledged(new File(['b'],'same.dng'),f),f.path);
 }finally{await f.bridge.close();globalThis.Worker=prior;}
});


test('acknowledged editor leave retains resources while held and refuses direct cache-clear bypass',async()=>{
 await withMetadataDocument(async f=>{
  let release;const held=new Promise(r=>release=r);let left=false;
  const leave=f.bridge.acknowledgeMetadata({...f,flushMetadata:()=>held}).then(v=>{left=v;return v;});
  await new Promise(r=>setTimeout(r,1));assert.equal(left,false);
  await assert.rejects(f.bridge.invoke('clear_session_caches'),/cache retained/);
  await assert.rejects(f.bridge.closeDocumentAcknowledged(f),/pending/);
  assert.deepEqual(await f.bridge.invoke('get_image_dimensions',{path:f.path}),{width:2,height:2});
  f.status.dirty=false;release(true);assert.equal(await leave,true);assert.equal(f.cancelled(),1);
 });
});
test('explicit close refuses failed or newer draft ACK, then detaches only an acknowledged document',async()=>{
 for(const mode of ['failure','newer','success'])await withMetadataDocument(async f=>{
  const closing=f.bridge.closeDocumentAcknowledged({...f,flushMetadata:async()=>{if(mode==='failure')return false;f.status.dirty=false;if(mode==='newer')f.state.adjustments={exposure:0};return true;}});
  if(mode!=='success'){await assert.rejects(closing,mode==='failure'?/not acknowledged/:/draft changed/);assert.deepEqual(await f.bridge.invoke('get_image_dimensions',{path:f.path}),{width:2,height:2});}
  else{assert.equal(await closing,true);await assert.rejects(f.bridge.invoke('get_image_dimensions',{path:f.path}),/Unknown/);assert.notEqual(await f.bridge.selectFileAcknowledged(new File(['b'],'same.dng'),f),f.path);}
 });
});


test('GPU drain during acknowledged close keeps the transition lease and refuses a later draft',async()=>{
 await withMetadataDocument(async f=>{
  f.status.dirty=false;let release;const gate=new Promise(r=>release=r);f.device.queue.onSubmittedWorkDone=()=>gate;
  const close=f.bridge.closeDocumentAcknowledged(f);await new Promise(r=>setTimeout(r,1));
  await assert.rejects(f.bridge.selectFileAcknowledged(new File(['b'],'same.dng'),f),/pending/);
  f.state.adjustments={exposure:0};f.status.dirty=true;release();await assert.rejects(close,/Draft changed/);
  assert.deepEqual(await f.bridge.invoke('get_image_dimensions',{path:f.path}),{width:2,height:2});
 });
});

test('selected library registry is atomic, bounded, stable for a File and revoked on session close',async()=>{
 const bridge=create(),files=['a','b','c','d'].map(n=>new File([n],'same.dng'));
 assert.throws(()=>bridge.registerFiles(new Set(files)),/1..4/);
 const paths=bridge.registerFiles(files.slice(0,2));assert.notEqual(paths[0],paths[1]);assert.deepEqual(bridge.registerFiles([files[0]]),[paths[0]]);
 assert.throws(()=>bridge.registerFiles([files[2],files[3],new File(['e'],'same.dng')]),/4 Files/);
 const next=bridge.registerFiles(files.slice(2));assert.equal(next.length,2);assert.equal(bridge.registeredFile(paths[0]),files[0]);
 await assert.rejects(bridge.selectRegisteredFileAcknowledged('/etc/passwd',{}),/Unknown selected/);
 await bridge.close();assert.throws(()=>bridge.registeredFile(paths[0]),/Unknown selected/);assert.throws(()=>bridge.registerFiles([files[0]]),/closed/);
 // Synthetic File size descriptors exercise the registry budget without allocating buffers.
 const budget=create(),large=['a','b','c'].map(n=>{const f=new File([n],n+'.dng');Object.defineProperty(f,'size',{value:128*1024*1024});return f;});
 const retained=budget.registerFiles(large.slice(0,2));assert.throws(()=>budget.registerFiles([large[2]]),/256 MiB/);assert.equal(budget.registeredFile(retained[0]),large[0]);await budget.close();
});
test('different selected library File waits for ACK and preserves its stable path through cache-load order',async()=>{
 await withMetadataDocument(async f=>{
  const selected=new File(['b'],'same.dng'),[next]=f.bridge.registerFiles([selected]);let release;
  const held=new Promise(r=>release=r),job=f.bridge.selectRegisteredFileAcknowledged(next,{...f,flushMetadata:()=>held});
  await new Promise(r=>setTimeout(r,1));assert.deepEqual(await f.bridge.invoke('get_image_dimensions',{path:f.path}),{width:2,height:2});
  await assert.rejects(f.bridge.selectRegisteredFileAcknowledged(next,f),/pending/);f.status.dirty=false;release(true);assert.equal(await job,next);
  await assert.rejects(f.bridge.invoke('load_metadata',{path:f.path}),/Unknown/);assert.equal(await f.bridge.invoke('is_image_cached',{path:next}),false);
  // Original frontend-cache path invokes load_image before load_metadata.
  await f.bridge.invoke('load_image',{path:next});assert.equal(await f.bridge.invoke('is_image_cached',{path:next}),true);
  f.state.selectedImage={path:next,isReady:true};assert.equal(await f.bridge.selectRegisteredFileAcknowledged(next,f),next);
  await f.bridge.closeDocumentAcknowledged(f);assert.throws(()=>f.bridge.registeredFile(next),/Unknown selected/);
 });
});
test('registered selection rejects unknown paths and failed/newer draft ACK without changing the active image',async()=>{
 for(const mode of ['failure','newer'])await withMetadataDocument(async f=>{
  const [next]=f.bridge.registerFiles([new File(['b'],'same.dng')]);let called=false;
  await assert.rejects(f.bridge.selectRegisteredFileAcknowledged('unknown',{...f,flushMetadata:()=>{called=true;}}),/Unknown selected/);assert.equal(called,false);
  await assert.rejects(f.bridge.selectRegisteredFileAcknowledged(next,{...f,flushMetadata:async()=>{if(mode==='failure')return false;f.state.adjustments={exposure:0};f.status.dirty=false;return true;}}),mode==='failure'?/not acknowledged/:/draft changed/);
  assert.deepEqual(await f.bridge.invoke('get_image_dimensions',{path:f.path}),{width:2,height:2});assert.equal(f.cancelled(),0);
 });
});

test('superseded preview uses the original native rejection string while real worker failures remain errors',async()=>{
 const previous=globalThis.Worker;let worker,posted;
 globalThis.Worker=class{constructor(){worker=this;}terminate(){}postMessage(data){posted=data;}};
 try{
  for(const superseded of [true,false]){
   posted=null;const bridge=create(),path=bridge.selectFile(new File(['x'],'public.dng'));
   const job=bridge.invoke('load_image',{path});while(!posted)await new Promise(r=>setTimeout(r,1));
   if(superseded){bridge.selectFile(new File(['y'],'other.dng'));await assert.rejects(job,error=>error==='Superseded or worker failed');}
   else{worker.onerror({message:'Actual RAW worker failure',preventDefault(){}});await assert.rejects(job,error=>error instanceof Error&&error.message==='Actual RAW worker failure');}
   await bridge.close();
  }
 }finally{globalThis.Worker=previous;}
});

test('paste admission refuses other documents, bulk, unsupported values and uncertain metadata before work',async()=>{
 await withMetadataDocument(async f=>{
  f.status.dirty=false;
  const good={paths:[f.path],adjustments:{exposure:0.8}};
  for(const args of [{...good,paths:[]},{...good,paths:[f.path,f.path]},{...good,paths:['/etc/passwd']},{...good,adjustments:{contrast:1}},{...good,adjustments:{exposure:6}},{...good,adjustments:{exposure:NaN}},{...good,extra:true}])await assert.rejects(f.bridge.invoke('apply_adjustments_to_paths',args));
  for(const flag of ['dirty','busy','uncertain','pendingIO']){f.status[flag]=true;await assert.rejects(f.bridge.invoke('apply_adjustments_to_paths',good),/not acknowledged/);f.status[flag]=false;}
  assert.equal(f.bridge.trace.filter(t=>t.command==='generate_preset_preview').length,0);
  assert.deepEqual(await f.bridge.invoke('get_image_dimensions',{path:f.path}),{width:2,height:2});
 });
});
test('pending paste holds navigation/cache and refuses another write while rendering, then tears down safely',async()=>{
 const previous=globalThis.Worker;let preview=false,saves=0;
 globalThis.Worker=class{terminate(){}postMessage(d){if(d.command==='load')queueMicrotask(()=>this.onmessage({data:{id:d.id,ok:true,width:2,height:2,asShot:{}}}));else preview=true;}};
 const defaults={exposure:0,brightness:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,toneMapper:'basic'},metadataHost={load:async()=>({adjustments:null}),snapshot:()=>({adjustments:defaults}),status:()=>({}),validate(){},save:async()=>saves++,close:async()=>{}};
 const bridge=createReactTransport({metadataHost,wasm:{},device:{queue:{onSubmittedWorkDone:async()=>{}}},defaults});
 try{
  const path=bridge.selectFile(new File(['x'],'public.dng'));await bridge.invoke('load_image',{path});
  const args={paths:[path],adjustments:{exposure:0.8}},job=bridge.invoke('apply_adjustments_to_paths',args).catch(e=>e);
  while(!preview)await new Promise(r=>setTimeout(r,1));
  await assert.rejects(bridge.invoke('apply_adjustments_to_paths',args),/pending/);
  await assert.rejects(bridge.invoke('clear_session_caches'),/cache retained/);
  await assert.rejects(bridge.selectFileAcknowledged(new File(['y'],'other.dng'),{}),/pending/);
  await bridge.close();assert.equal(await job,'Superseded or worker failed');assert.equal(saves,0);
 }finally{await bridge.close();globalThis.Worker=previous;}
});
