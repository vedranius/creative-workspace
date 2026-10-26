import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryFile,MemoryDirectory} from './test-filesystem.mjs';
import {createTestLocks} from './test-journal-locks.mjs';
import {createExportDestination} from './export-destination.js';
import {createPresetRecoverySession,verifyRetainedPresetBytes} from './preset-recovery.js';
import {serializePresetFile} from './preset-file.js';
const jpeg=serializePresetFile([{preset:{id:'tool-1',name:'Exposure',presetType:'tool',adjustments:{exposure:0.8}}}]);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,1));}throw Error('Phase not reached');}
async function fixture(options={}){
 const root=new MemoryDirectory(),target=new MemoryFile('original.rrpreset'),locks=createTestLocks();target.hooks.close=()=>{throw Error('lost ACK');};
 const journal=createExportDestination({format:'rrpreset',verifyPresetBytes:verifyRetainedPresetBytes,getRoot:async()=>root,pickFile:async()=>target,coordinateRecovery:true,getLocks:()=>locks,...options});
 const doc={path:'raw',generation:1,ready:true,file:new File(['raw'],'source.dng')};
 const take=async()=>journal.take(await journal.choose({},doc),doc);
 await assert.rejects(journal.write(await take(),jpeg,()=>{}),/lost ACK/);
 await until(()=>!locks.held());const [record]=await journal.listRecovery();
 const session=createPresetRecoverySession({allowPresetDiscard:true,journal,destination:journal});
 const prepare=async()=>{await session.list();return session.prepare(record.id);};
 const dir=()=>root.children.get('cw-rapidraw-preset-recovery').children.get(record.id);
 return{root,target,locks,journal,doc,take,record,session,prepare,dir};
}
test('only an explicit confirmed verified record is removed, with absence ACK and no destination replay',async()=>{
 const f=await fixture();assert.equal((await f.prepare()).canDiscard,true);
 await assert.rejects(f.session.discardPrepared('wrong-id'),/confirmation/);assert.equal((await f.journal.listRecovery()).length,1);
 assert.equal((await f.session.discardPrepared(f.record.id)).discardAcknowledged,true);assert.deepEqual(await f.journal.listRecovery(),[]);
 assert.equal(f.target.opens,1);assert.equal(f.target.bytes.length,0);await assert.rejects(f.session.discardPrepared(f.record.id),/Verify/);f.session.close();
});
test('uncoordinated legacy copies remain copyable, never deletable',async()=>{
 const f=await fixture({coordinateRecovery:false});assert.equal((await f.prepare()).canDiscard,false);
 await assert.rejects(f.session.discardPrepared(f.record.id),/coordinated record/);assert.deepEqual(await f.journal.readRecovery(f.record.id),jpeg);f.session.close();
});
test('changed record or preset after confirmation preparation vetoes all deletion',async()=>{
 for(const fault of ['record','bytes']){
  const f=await fixture();await f.prepare();
  if(fault==='record')f.dir().children.get('record.json').replace(JSON.stringify({...f.record,createdAt:f.record.createdAt+1}));else f.dir().children.get('output.rrpreset').replace(new Uint8Array(jpeg.length));
  await assert.rejects(f.session.discardPrepared(f.record.id),/changed/);assert.equal((await f.journal.listRecovery()).length,1);f.session.close();
 }
});
test('another live writer blocks removal and complete cleanup uses the same Web Lock',async()=>{
 const f=await fixture();await f.prepare();const gate=deferred();
 const otherTarget=new MemoryFile('other.rrpreset');otherTarget.hooks.close=()=>gate.promise;
 const other=createExportDestination({format:'rrpreset',verifyPresetBytes:verifyRetainedPresetBytes,getRoot:async()=>f.root,pickFile:async()=>otherTarget,coordinateRecovery:true,getLocks:()=>f.locks});
 const lease=other.take(await other.choose({},f.doc),f.doc),pending=other.write(lease,jpeg,()=>{});await until(()=>otherTarget.opens===1);
 await assert.rejects(f.session.discardPrepared(f.record.id),/busy/);assert.equal(f.dir().kind,'directory');gate.resolve();const ack=await pending;await other.complete(ack);
 assert.equal((await f.journal.listRecovery()).length,1);await f.prepare();await f.session.discardPrepared(f.record.id);f.session.close();
});
test('timed-out output retains its journal lock until late I/O drains, while caller receives deadline',async()=>{
 const f=await fixture();await f.prepare();const gate=deferred(),target=new MemoryFile('late.rrpreset');target.hooks.close=()=>gate.promise;
 const other=createExportDestination({format:'rrpreset',verifyPresetBytes:verifyRetainedPresetBytes,getRoot:async()=>f.root,pickFile:async()=>target,coordinateRecovery:true,getLocks:()=>f.locks,ioTimeoutMs:20});
 const lease=other.take(await other.choose({},f.doc),f.doc);await assert.rejects(other.write(lease,jpeg,()=>{}),/timed out/);
 assert.equal(f.locks.held(),1);await assert.rejects(f.session.discardPrepared(f.record.id),/busy/);gate.resolve();await until(()=>!f.locks.held());
 await f.prepare();assert.equal((await f.session.discardPrepared(f.record.id)).discardAcknowledged,true);f.session.close();
});
test('failed or held deletion never produces a false acknowledgement',async()=>{
 const f=await fixture();await f.prepare();const root=f.root.children.get('cw-rapidraw-preset-recovery');root.failRemove=true;
 await assert.rejects(f.session.discardPrepared(f.record.id),/cleanup failed/);assert.equal((await f.journal.listRecovery()).length,1);root.failRemove=false;
 await f.prepare();const gate=deferred(),remove=root.removeEntry.bind(root);root.removeEntry=async(...args)=>{await gate.promise;return remove(...args);};let acknowledged=false;
 const pending=f.session.discardPrepared(f.record.id).then(r=>{acknowledged=true;return r;});await until(()=>f.session.status().busy);await new Promise(r=>setTimeout(r,5));assert.equal(acknowledged,false);assert.equal(f.dir().kind,'directory');
 gate.resolve();assert.equal((await pending).discardAcknowledged,true);f.session.close();
});
test('closed preparation cannot delete and absent Web Locks fail closed before writing',async()=>{
 const f=await fixture();await f.prepare();f.session.close();await assert.rejects(f.session.discardPrepared(f.record.id),/Verify/);assert.equal((await f.journal.listRecovery()).length,1);
 const target=new MemoryFile('no-lock.rrpreset'),journal=createExportDestination({format:'rrpreset',verifyPresetBytes:verifyRetainedPresetBytes,coordinateRecovery:true,getLocks:()=>null,pickFile:async()=>target,getRoot:async()=>f.root});
 const lease=journal.take(await journal.choose({},f.doc),f.doc);await assert.rejects(journal.write(lease,jpeg,()=>{}),/Web Locks/);assert.equal(target.opens,0);
});
test('another tab changing metadata between verification and remove is rechecked under lock',async()=>{
 const f=await fixture();await f.prepare();const recordFile=f.dir().children.get('record.json');let reads=0;
 recordFile.hooks.get=()=>{if(++reads===3)recordFile.replace(JSON.stringify({...f.record,state:'complete'}));};
 await assert.rejects(f.session.discardPrepared(f.record.id),/changed/);assert.equal((await f.journal.listRecovery()).length,1);f.session.close();
});
test('late deletion after timeout is uncertain and blocks new mutations until explicit reload reconciles',async()=>{
 const f=await fixture({ioTimeoutMs:20});await f.prepare();const root=f.root.children.get('cw-rapidraw-preset-recovery'),gate=deferred(),remove=root.removeEntry.bind(root);root.removeEntry=async(...args)=>{await gate.promise;return remove(...args);};
 await assert.rejects(f.session.discardPrepared(f.record.id),/timed out/);assert.equal(f.locks.held(),1);assert.equal(f.dir().kind,'directory');
 gate.resolve();await until(()=>!f.locks.held());assert.deepEqual(await f.session.list(),[]);assert.equal(f.target.opens,1);f.session.close();
});

test('canonical validation also runs under the lock even for forged matching hashes',async()=>{
 const f=await fixture(),raw=new TextEncoder().encode('{}');
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),n=>n.toString(16).padStart(2,'0')).join('');
 const forged={...f.record,bytes:raw.length,sha256};f.dir().children.get('record.json').replace(JSON.stringify(forged));f.dir().children.get('output.rrpreset').replace(raw);
 await assert.rejects(f.journal.discardRecovery(forged,()=>{}),/one retained/);assert.equal((await f.journal.listRecovery()).length,1);f.session.close();
});
test('cancelled confirmation preserves the selected record, sibling, and saved output',async()=>{
 const f=await fixture();await f.prepare();f.session.cancelPrepared();
 await assert.rejects(f.session.discardPrepared(f.record.id),/Verify/);assert.deepEqual(await f.journal.readRecovery(f.record.id),jpeg);
 const target=new MemoryFile('saved.rrpreset'),other=createExportDestination({format:'rrpreset',coordinateRecovery:true,verifyPresetBytes:verifyRetainedPresetBytes,getRoot:async()=>f.root,getLocks:()=>f.locks,pickFile:async()=>target,getRetention:()=> 'keep'});
 const ack=await other.write(other.take(await other.choose({},f.doc),f.doc),jpeg,()=>{});await other.complete(ack);const sibling=(await f.journal.listRecovery()).find(r=>r.id!==f.record.id);
 await f.prepare();await f.session.discardPrepared(f.record.id);assert.deepEqual(await f.journal.listRecovery(),[sibling]);assert.deepEqual(target.bytes,jpeg);f.session.close();
});

test('a completed remove operation without actual absence is never acknowledged',async()=>{
 const f=await fixture();await f.prepare();const journal=f.root.children.get('cw-rapidraw-preset-recovery');journal.removeEntry=async()=>{};
 await assert.rejects(f.session.discardPrepared(f.record.id),/not acknowledged/);assert.deepEqual(await f.journal.listRecovery(),[f.record]);f.session.close();
});
