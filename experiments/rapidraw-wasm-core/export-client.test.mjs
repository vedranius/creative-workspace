import assert from 'node:assert/strict';
import {test} from 'node:test';
import {exportRawInWorker} from './export-client.js';
test('dedicated export cancels once, rejects overlapping work and ignores late success',async()=>{
 let worker;
 globalThis.Worker=class{
  constructor(){worker=this;this.terminations=0;}
  terminate(){this.terminations++;}
  postMessage(d){if(d.command==='start')this.id=d.id;else queueMicrotask(()=>this.onmessage({data:{id:d.id,ok:false,deviceDestroyed:true}}));}
 };
 const controller=new AbortController();let status;
 const p=exportRawInWorker(new ArrayBuffer(1),{signal:controller.signal,onStatus:s=>{status=s.status;controller.abort();}});
 assert.equal((await exportRawInWorker(new ArrayBuffer(1))).reason,'busy');
 worker.onmessage({data:{id:worker.id,status:'gpu-submitted'}});
 const result=await p;assert.equal(status,'gpu-submitted');assert.equal(result.reason,'aborted');assert.equal(result.deviceDestroyed,true);assert.equal(result.forcedTermination,false);assert.equal(worker.terminations,1);
 worker.onmessage({data:{id:worker.id,ok:true,bytes:new Uint8Array([1])}});assert.equal(worker.terminations,1);
});
test('export timeout cooperatively closes and next job can start; invalid input creates no worker',async()=>{
 let count=0;
 globalThis.Worker=class{
  constructor(){count++;}
  terminate(){}
  postMessage(d){if(d.command==='cancel')queueMicrotask(()=>this.onmessage({data:{id:d.id,ok:false}}));}
 };
 assert.equal((await exportRawInWorker(new ArrayBuffer(0))).reason,'input-limit');assert.equal(count,0);
 assert.equal((await exportRawInWorker(new ArrayBuffer(1),{timeoutMs:1})).reason,'timeout');
 assert.equal((await exportRawInWorker(new ArrayBuffer(1),{timeoutMs:1})).reason,'timeout');assert.equal(count,2);
});

test('unresponsive export worker is force-terminated at watchdog grace without publishing bytes',async()=>{
 let terminated=0;
 globalThis.Worker=class{postMessage(){}terminate(){terminated++;}};
 const result=await exportRawInWorker(new ArrayBuffer(1),{timeoutMs:1});
 assert.equal(result.reason,'timeout');assert.equal(result.forcedTermination,true);assert.equal(result.bytes,undefined);assert.equal(terminated,1);
});
