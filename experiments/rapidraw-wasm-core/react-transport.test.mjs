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
