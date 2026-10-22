import test from 'node:test';
import assert from 'node:assert/strict';
import {createExportDestination} from './export-destination.js';
import {createExportBridge} from './export-bridge.js';

const encoder=new TextEncoder(),jpeg=new Uint8Array([255,216,7,8,255,217]);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,1));}throw Error('Expected phase not reached');}
class MemoryFile{
 constructor(name){this.kind='file';this.name=name;this.bytes=new Uint8Array();this.modified=1;this.permission='granted';this.hooks={};this.opens=0;}
 replace(bytes){this.bytes=new Uint8Array(typeof bytes==='string'?encoder.encode(bytes):bytes);this.modified++;}
 async queryPermission(){return this.permission;}
 async getFile(){await this.hooks.get?.();return new File([this.bytes],this.name,{lastModified:this.modified});}
 async createWritable(options){
  this.opens++;await this.hooks.open?.(options);let bytes=new Uint8Array(),aborted=false;
  return {
   write:async value=>{await this.hooks.write?.();bytes=new Uint8Array(typeof value==='string'?encoder.encode(value):value);},
   close:async()=>{await this.hooks.close?.();if(aborted)throw Error('Already aborted');this.replace(bytes);await this.hooks.afterClose?.();},
   abort:async()=>{aborted=true;await this.hooks.abort?.();},
  };
 }
}
class MemoryDirectory{
 constructor(){this.kind='directory';this.children=new Map();this.failRemove=false;}
 async getDirectoryHandle(name,{create=false}={}){if(!this.children.has(name)&&create)this.children.set(name,new MemoryDirectory());const value=this.children.get(name);if(!value||value.kind!=='directory')throw Error('Directory not found');return value;}
 async getFileHandle(name,{create=false}={}){if(!this.children.has(name)&&create)this.children.set(name,new MemoryFile(name));const value=this.children.get(name);if(!value||value.kind!=='file')throw Error('File not found');return value;}
 async *entries(){yield* this.children.entries();}
 async removeEntry(id){if(this.failRemove)throw Error('Storage cleanup failed');this.children.delete(id);}
}
function fixture(options={}){
 const root=new MemoryDirectory(),target=new MemoryFile('new.jpg'),document={path:'browser-document:test/sample.dng',generation:1,ready:true,file:new File([new Uint8Array([1,2,3])],'sample.dng')};
 let retention='until-ack';
 const destination=createExportDestination({getRoot:async()=>root,pickFile:async()=>target,getRetention:()=>retention,...options});
 const take=async()=>destination.take(await destination.choose({defaultPath:'sample_edited.jpg'},document),document);
 return {root,target,document,destination,take,setRetention:value=>retention=value};
}
function args(f,token){return {paths:[f.document.path],outputFolderOrFile:token,isExplicitFilePath:true,baseOriginFolders:[],outputFormat:'jpg',currentEditPath:f.document.path,currentEditAdjustments:{exposure:0},exportSettings:{filenameTemplate:'{original_filename}_edited',jpegQuality:90,dpi:300,resize:null,tiffBitDepth:16,keepMetadata:false,preserveTimestamps:false,preserveFolders:false,exportMasks:false,destinationType:'customFolder',subfolder:'',border:null,pad:null,watermark:null,stripGps:true}};}
function bridge(f,options={}){
 const events=[],host=createExportBridge({getDocument:()=>f.document,emit:(event,payload)=>events.push({event,payload}),destination:f.destination,runExport:async()=>({ok:true,bytes:jpeg}),...options});
 return {host,events,invoke:async override=>host.execute({...args(f,await host.pick({defaultPath:'out.jpg'})),...override})};
}

test('destination tokens are single-use, document-bound and refuse nonempty or source outputs',async()=>{
 const f=fixture();const token=await f.destination.choose({},f.document);assert.match(token,/^browser-export:/);
 assert.throws(()=>f.destination.take(token,{...f.document,generation:2}),/another document/);
 assert.throws(()=>f.destination.take(token,f.document),/expired/);
 const lease=await f.take();await assert.rejects(f.destination.write({},jpeg,()=>{}),/capability/);
 const ack=await f.destination.write(lease,jpeg,()=>{});await f.destination.complete(ack);
 await assert.rejects(f.destination.write(lease,jpeg,()=>{}),/capability/);
 await assert.rejects(f.take(),/already exists/);
 f.target.replace([]);f.target.name='sample.dng';await assert.rejects(f.take(),/new JPEG/);
});
test('close and readback precede ACK; recovery remains until explicit host acceptance',async()=>{
 const f=fixture(),gate=deferred();let closing=false,settled=false;
 f.target.hooks.close=async()=>{closing=true;await gate.promise;};
 const result=f.destination.write(await f.take(),jpeg,()=>{}).then(v=>{settled=true;return v;});
 await until(()=>closing);assert.equal(settled,false);
 const retained=await f.destination.listRecovery();assert.equal(retained.length,1);assert.equal(retained[0].state,'uncertain');
 assert.deepEqual(await f.destination.readRecovery(retained[0].id),jpeg);
 gate.resolve();const ack=await result;assert.equal(ack.writeAcknowledged,true);assert.equal((await f.destination.listRecovery())[0].state,'acknowledged');
 assert.deepEqual(f.target.bytes,jpeg);assert.equal((await f.destination.complete(ack)).recoveryId,null);assert.deepEqual(await f.destination.listRecovery(),[]);
});
test('retention is fixed at selection; keep stores complete output and rejects forged receipts',async()=>{
 const f=fixture();f.setRetention('keep');const lease=await f.take();f.setRetention('until-ack');
 const ack=await f.destination.complete(await f.destination.write(lease,jpeg,()=>{}));
 assert.equal(ack.retention,'keep');assert.equal((await f.destination.listRecovery())[0].state,'complete');
 assert.deepEqual(await f.destination.readRecovery(ack.recoveryId),jpeg);
 await assert.rejects(f.destination.complete({...ack}),/receipt/);
 await assert.rejects(f.destination.readRecovery('../output.jpg'),/Invalid/);
});
test('newer content and revoked permission are retained errors without destination I/O or replay',async()=>{
 for(const fault of ['newer','permission']){
  const f=fixture(),lease=await f.take();
  if(fault==='newer')f.target.replace('newer content');else f.target.permission='denied';
  const before=new Uint8Array(f.target.bytes);
  await assert.rejects(f.destination.write(lease,jpeg,()=>{}),e=>e.outputRetained===true&&!!e.recoveryId);
  assert.equal(f.target.opens,0);assert.deepEqual(f.target.bytes,before);
  const records=await f.destination.listRecovery();assert.equal(records[0].state,'uncertain');assert.deepEqual(await f.destination.readRecovery(records[0].id),jpeg);
  await assert.rejects(f.destination.write(lease,jpeg,()=>{}),/capability/);
 }
});
test('close failure and mismatched readback preserve exact recovery; tampered recovery refuses',async()=>{
 for(const fault of ['close','readback']){
  const f=fixture();if(fault==='close')f.target.hooks.close=async()=>{throw Error('Close failed');};else f.target.hooks.afterClose=async()=>f.target.replace('wrong bytes');
  await assert.rejects(f.destination.write(await f.take(),jpeg,()=>{}),e=>e.outputRetained===true);
  const [record]=await f.destination.listRecovery();assert.deepEqual(await f.destination.readRecovery(record.id),jpeg);
  const journal=await f.root.getDirectoryHandle('cw-rapidraw-export-recovery'),dir=await journal.getDirectoryHandle(record.id);(await dir.getFileHandle('output.jpg')).replace('tampered');
  await assert.rejects(f.destination.readRecovery(record.id),/did not match/);
 }
});
test('content changed while the stream is open refuses before close and keeps newer bytes',async()=>{
 const f=fixture();let closes=0;f.target.hooks.write=async()=>f.target.replace('newer while open');f.target.hooks.close=async()=>{closes++;};
 await assert.rejects(f.destination.write(await f.take(),jpeg,()=>{}),/refusing overwrite/);
 assert.equal(closes,0);assert.equal(new TextDecoder().decode(f.target.bytes),'newer while open');
 assert.deepEqual(await f.destination.readRecovery((await f.destination.listRecovery())[0].id),jpeg);
});
test('missing recovery storage never writes destination or claims durable recovery',async()=>{
 const f=fixture({getRoot:async()=>{throw Error('Storage unavailable');}});
 await assert.rejects(f.destination.write(await f.take(),jpeg,()=>{}),e=>e.outputRetained===false&&e.message.includes('destination untouched'));
 assert.equal(f.target.opens,0);
});
test('I/O deadline preserves uncertain bytes and blocks new writes until late operation settles',async()=>{
 const f=fixture({ioTimeoutMs:100}),gate=deferred();let closing=false;
 f.target.hooks.close=async()=>{closing=true;await gate.promise;};
 const lease=await f.take(),job=f.destination.write(lease,jpeg,()=>{});await until(()=>closing);
 await assert.rejects(job,e=>e.outputRetained===true&&/timed out/.test(e.message));
 const next=await f.take();await assert.rejects(f.destination.write(next,jpeg,()=>{}),/still active/);
 gate.resolve();await new Promise(r=>setTimeout(r,5));assert.equal(f.target.bytes.length,0);
 assert.deepEqual(await f.destination.readRecovery((await f.destination.listRecovery())[0].id),jpeg);
 f.target.hooks.close=null;const ack=await f.destination.write(await f.take(),jpeg,()=>{});assert.equal(ack.writeAcknowledged,true);
});
test('host emits no success or fake progress before actual close ACK',async()=>{
 const f=fixture(),gate=deferred();let closing=false;f.target.hooks.close=async()=>{closing=true;await gate.promise;};
 const b=bridge(f),job=b.invoke();await until(()=>closing);assert.deepEqual(b.events,[]);
 gate.resolve();const ack=await job;assert.equal(ack.writeAcknowledged,true);
 assert.deepEqual(b.events.map(e=>e.event),['batch-export-progress','export-complete']);assert.deepEqual(b.events[0].payload,{current:1,total:1});
 assert.deepEqual(await f.destination.listRecovery(),[]);
});
test('a stream created after its deadline is aborted without writing late output',async()=>{
 const f=fixture({ioTimeoutMs:100}),gate=deferred();let opening=false,aborted=false;
 f.target.hooks.open=async()=>{opening=true;await gate.promise;};f.target.hooks.abort=async()=>{aborted=true;};
 const job=f.destination.write(await f.take(),jpeg,()=>{});await until(()=>opening);
 await assert.rejects(job,e=>e.outputRetained===true&&/Open output timed out/.test(e.message));
 gate.resolve();await until(()=>aborted);assert.equal(f.target.bytes.length,0);
 assert.deepEqual(await f.destination.readRecovery((await f.destination.listRecovery())[0].id),jpeg);
});
test('document generation mutation prevents stale success and leaves acknowledged recovery',async()=>{
 const f=fixture(),gate=deferred();let closing=false;f.target.hooks.close=async()=>{closing=true;await gate.promise;};
 const b=bridge(f),job=b.invoke();await until(()=>closing);f.document.generation++;gate.resolve();
 await assert.rejects(job,e=>typeof e==='string'&&/retained for recovery/.test(e));
 assert.deepEqual(b.events.map(e=>e.event),['export-error']);assert.deepEqual(await f.destination.readRecovery((await f.destination.listRecovery())[0].id),jpeg);
});
test('cancel and close abort computation immediately, suppress success, and await host completion',async()=>{
 const f=fixture();let signal;const worker=deferred();
 const b=bridge(f,{runExport:async(_,{signal:s})=>{signal=s;s.addEventListener('abort',()=>worker.resolve({ok:false,reason:'aborted'}),{once:true});return worker.promise;}});
 const job=b.invoke();await until(()=>signal);await assert.rejects(b.host.execute(args(f,'other')),/already active/);
 b.host.cancel();b.host.cancel();assert.equal(signal.aborted,true);await b.host.close();assert.equal(await job,null);
 assert.deepEqual(b.events.map(e=>e.event),['export-cancelling','export-cancelled']);
 await assert.rejects(b.host.execute(args(f,'other')),/closed/);assert.equal(f.target.opens,0);
});
test('unsupported settings, extra native arguments and oversized RAW refuse before worker or File read',async()=>{
 const f=fixture();let renders=0;const b=bridge(f,{runExport:async()=>{renders++;throw Error('Must not run');}});
 const token=await b.host.pick({});const input=args(f,token);
 for(const changed of [{...input,paths:['/other']},{...input,extra:true},{...input,exportSettings:{...input.exportSettings,keepMetadata:true}},{...input,exportSettings:{...input.exportSettings,jpegQuality:0}}])await assert.rejects(b.host.execute(changed));
 f.document.file={size:129*1024*1024,arrayBuffer:()=>assert.fail('Oversized RAW read')};await assert.rejects(b.host.execute(input),/bounded/);
 assert.equal(renders,0);assert.equal(f.target.opens,0);
});
test('cancel during File read closes logical host without starting a worker; late bytes are ignored',async()=>{
 const f=fixture(),gate=deferred();let reading=false,renders=0;
 f.document.file={name:'sample.dng',size:3,arrayBuffer:()=>{reading=true;return gate.promise;}};
 const b=bridge(f,{runExport:async()=>{renders++;return {ok:true,bytes:jpeg};}}),job=b.invoke();
 await until(()=>reading);b.host.cancel();await b.host.close();assert.equal(await job,null);
 gate.resolve(new ArrayBuffer(3));await new Promise(r=>setTimeout(r,1));assert.equal(renders,0);assert.equal(f.target.opens,0);
 assert.deepEqual(b.events.map(e=>e.event),['export-cancelling','export-cancelled']);
});
test('retention cleanup failure does not turn an actual write ACK into a false export failure',async()=>{
 const f=fixture(),b=bridge(f);
 const journal=await f.root.getDirectoryHandle('cw-rapidraw-export-recovery',{create:true});journal.failRemove=true;
 const ack=await b.invoke();assert.equal(ack.writeAcknowledged,true);assert.equal(ack.retentionCleanupPending,true);
 assert.deepEqual(b.events.map(e=>e.event),['batch-export-progress','export-complete']);
 assert.equal((await f.destination.listRecovery())[0].state,'complete');assert.deepEqual(await f.destination.readRecovery(ack.recoveryId),jpeg);
});
test('a synchronous progress subscriber changing the document cannot accept stale success',async()=>{
 const f=fixture(),events=[];const b=bridge(f,{emit:(event,payload)=>{events.push(event);if(event==='batch-export-progress')f.document.generation++;}});
 await assert.rejects(b.invoke(),/document changed/);assert.deepEqual(events,['batch-export-progress','export-error']);
 const [record]=await f.destination.listRecovery();assert.equal(record.state,'acknowledged');assert.deepEqual(await f.destination.readRecovery(record.id),jpeg);
});
