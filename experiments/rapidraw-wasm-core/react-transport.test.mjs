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
  await assert.rejects(bridge.invoke('load_image',{path:'other'}),/Unknown/);assert.equal(terminated,0);
  await bridge.invoke('clear_session_caches');assert.equal(terminated,1);await bridge.close();assert.equal(terminated,1);
 }finally{globalThis.Worker=previous;}
});
test('fine rotation refuses malformed angles and unverified interactive sizing without losing the document',async()=>{
 const previous=globalThis.Worker;
 globalThis.Worker=class{terminate(){}postMessage(data){queueMicrotask(()=>this.onmessage({data:{id:data.id,ok:true,width:2048,height:1536,asShot:{}}}));}};
 try{const bridge=create(),path=bridge.selectFile(new File(['x'],'public.dng'));await bridge.invoke('load_image',{path});
 for(const rotation of [NaN,Infinity,-46,46,'5'])await assert.rejects(bridge.invoke('apply_adjustments',{jsAdjustments:{rotation}}),/fine rotation/);
 await assert.rejects(bridge.invoke('apply_adjustments',{jsAdjustments:{rotation:5},isInteractive:true}),/interactive sizing/);
 assert.deepEqual(await bridge.invoke('load_metadata',{path}),{adjustments:null});await bridge.close();
 }finally{globalThis.Worker=previous;}
});
