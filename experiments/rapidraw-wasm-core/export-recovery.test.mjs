import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryFile,MemoryDirectory} from './test-filesystem.mjs';
import {createExportDestination} from './export-destination.js';
import {createRecoverySession} from './export-recovery.js';
const jpeg=new Uint8Array([255,216,7,8,255,217]);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,1));}throw Error('Phase not reached');}
async function fixture(){
 const root=new MemoryDirectory(),old=new MemoryFile('original.jpg');old.hooks.close=()=>{throw Error('lost ACK');};
 const journal=createExportDestination({getRoot:async()=>root,pickFile:async()=>old});
 const doc={path:'source',generation:1,ready:true,file:new File(['raw'],'source.dng')};
 await assert.rejects(journal.write(journal.take(await journal.choose({},doc),doc),jpeg,()=>{}),/lost ACK/);
 const [record]=await journal.listRecovery(),target=new MemoryFile('recovered.jpg');let picks=0,mode='normal',retention='until-ack';
 const destination=createExportDestination({getRoot:async()=>root,getRetention:()=>retention,pickFile:async()=>{picks++;if(mode==='cancel')throw new DOMException('cancelled','AbortError');return target;}});
 const session=createRecoverySession({journal,destination});
 return{root,journal,record,target,destination,session,picks:()=>picks,mode:v=>mode=v,retention:v=>retention=v};
}
test('inventory/verified JPEG never auto-pick, real ACK copies bytes and preserves original uncertain entry',async()=>{
 const f=await fixture(),rows=await f.session.list();assert.equal(rows[0].recoverable,true);assert.equal(f.picks(),0);
 assert.equal((await f.session.prepare(f.record.id)).sha256,f.record.sha256);assert.equal(f.picks(),0);
 const ack=await f.session.savePrepared();assert.equal(ack.writeAcknowledged,true);assert.deepEqual(f.target.bytes,jpeg);
 assert.deepEqual(await f.journal.listRecovery(),[f.record]);assert.deepEqual(await f.journal.readRecovery(f.record.id),jpeg);
 await assert.rejects(f.session.savePrepared(),/Verify/);f.session.close();
 const reload=createRecoverySession({journal:f.journal,destination:f.destination});await reload.list();assert.equal(f.picks(),1);assert.equal(reload.status().prepared,false);reload.close();
});
test('chooser begins synchronously in the save gesture; cancel/permission/nonempty files never write',async()=>{
 for(const fault of ['cancel','denied','nonempty']){
  const f=await fixture();await f.session.list();await f.session.prepare(f.record.id);
  if(fault==='cancel')f.mode('cancel');if(fault==='denied')f.target.permission='denied';if(fault==='nonempty')f.target.replace('newer');
  const pending=f.session.savePrepared();assert.equal(f.picks(),1);
  if(fault==='cancel')assert.equal((await pending).cancelled,true);else await assert.rejects(pending,/permission|already exists/);
  assert.equal(f.target.opens,0);assert.deepEqual(await f.journal.listRecovery(),[f.record]);f.session.close();
 }
});
test('held file close is busy with no success; keep retention adds a separate complete copy',async()=>{
 const f=await fixture(),gate=deferred();f.retention('keep');f.target.hooks.close=()=>gate.promise;
 await f.session.list();await f.session.prepare(f.record.id);let done=false;
 const pending=f.session.savePrepared().then(r=>{done=true;return r;});await until(()=>f.target.opens===1);
 assert.equal(f.session.status().busy,true);assert.equal(done,false);assert.equal(f.target.bytes.length,0);
 await assert.rejects(f.session.prepare(f.record.id),/busy/);assert.throws(()=>f.session.cancelPrepared(),/Wait/);
 gate.resolve();const ack=await pending;assert.equal(ack.writeAcknowledged,true);
 const records=await f.journal.listRecovery();assert.equal(records.length,2);assert.deepEqual(records.find(r=>r.id===f.record.id),f.record);assert.equal(records.find(r=>r.id!==f.record.id).state,'complete');f.session.close();
});
test('record change after preparation vetoes destination write; corrupt bytes/duplicate IDs are unavailable',async()=>{
 const f=await fixture();await f.session.list();await f.session.prepare(f.record.id);
 const realList=f.journal.listRecovery;f.journal.listRecovery=async()=>[{...f.record,createdAt:f.record.createdAt+1}];
 await assert.rejects(f.session.savePrepared(),/changed/);assert.equal(f.target.opens,0);
 f.journal.listRecovery=realList;await f.session.list();f.journal.readRecovery=async()=>new Uint8Array([255,216,9,8,255,217]);await assert.rejects(f.session.prepare(f.record.id),/match/);
 f.journal.listRecovery=async()=>[f.record,f.record];assert.equal((await f.session.list()).some(r=>r.recoverable),false);f.session.close();
});
test('closed preparation and closed pending chooser cannot publish/write; newer target after chooser stays unchanged',async()=>{
 for(const fault of ['closed','newer']){
  const f=await fixture(),gate=deferred();await f.session.list();await f.session.prepare(f.record.id);
  const choose=f.destination.choose;f.destination.choose=async(...args)=>{const token=await choose(...args);await gate.promise;return token;};
  const pending=f.session.savePrepared();await until(()=>f.picks()===1);await new Promise(r=>setTimeout(r,5));
  if(fault==='closed')f.session.close();else f.target.replace('newer');gate.resolve();
  await assert.rejects(pending,/closed|changed/);assert.equal(f.target.opens,0);assert.equal(fault==='newer'?new TextDecoder().decode(f.target.bytes):'',fault==='newer'?'newer':'');
  assert.equal((await f.journal.listRecovery()).find(r=>r.id===f.record.id).state,'uncertain');f.session.close();
 }
 const f=await fixture(),gate=deferred(),read=f.journal.readRecovery;f.journal.readRecovery=async id=>{await gate.promise;return read(id);};await f.session.list();const pending=f.session.prepare(f.record.id);f.session.close();gate.resolve();await assert.rejects(pending,/closed/);assert.equal(f.session.status().prepared,false);
});
test('oversize/malformed/preparing records cannot be read or selected',async()=>{
 const f=await fixture();let reads=0;f.journal.readRecovery=async()=>{reads++;return jpeg;};
 for(const record of [{...f.record,bytes:64*1024*1024+1},{...f.record,state:'preparing'},{...f.record,name:'../a.jpg'},{...f.record,sha256:'x'.repeat(64)}]){
  f.journal.listRecovery=async()=>[record];assert.equal((await f.session.list())[0].recoverable,false);await assert.rejects(f.session.prepare(f.record.id),/available/);
 }
 assert.equal(reads,0);f.session.close();
});
