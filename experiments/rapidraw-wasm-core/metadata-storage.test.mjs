import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetadataStorage} from './metadata-storage.js';
const defaults={exposure:0,contrast:0,masks:[]},thumb='data:image/jpeg;base64,/9j/2Q==';
const gate=()=>{let release;return {promise:new Promise(r=>release=r),release:()=>release()};};
const until=async f=>{for(let i=0;i<200;i++){if(f())return;await new Promise(r=>setTimeout(r,1));}throw Error('Phase missing');};
function setup(options={}){
 const state={record:null,commits:0,hold:null,mismatch:false,abort:false};
 const backend={read:async()=>{if(state.hold&&state.commits)await state.hold.promise;return state.mismatch?null:structuredClone(state.record);},commit:async(expected,next)=>{if(state.abort)throw Error('Write aborted');if((state.record?.revision??0)!==expected)throw Error('Metadata changed in another tab');state.record=structuredClone(next);state.commits++;}};
 const host=createMetadataStorage({defaults,backend,...options}),file=new File(['one'],'one.dng');return {host,state,backend,file};
}
test('metadata remains dirty until exact commit/readback and newer drafts cannot be cleaned by older ACK',async()=>{
 const {host:h,state:s,file:f}=setup();assert.deepEqual(await h.load(f),{adjustments:null});h.observe(f,{...defaults,exposure:0.8});assert.equal(h.status().dirty,true);s.hold=gate();let resolved=false;const job=h.save(f,{...defaults,exposure:0.8},thumb).then(()=>resolved=true);await until(()=>s.commits===1);assert.equal(h.status().revision,0);assert.equal(h.status().busy,true);assert.equal(resolved,false);
 h.observe(f,{...defaults,exposure:1.6});s.hold.release();await job;assert.equal(h.status().revision,1);assert.equal(h.status().dirty,true);s.hold=null;await h.save(f,{...defaults,exposure:1.6},thumb);assert.equal(h.status().dirty,false);assert.equal(h.thumbnail(),thumb);await h.close();
});
test('complete content identity survives renamed/reselected files and separates equal name/size/time with different bytes',async()=>{
 const {host:h,state:s,file:f}=setup();await h.load(f);await h.save(f,{...defaults,exposure:0.8},thumb);assert.equal((await h.load(new File(['one'],'renamed.dng',{lastModified:999}))).adjustments.exposure,0.8);assert.deepEqual(await h.load(new File(['two'],'one.dng')),{adjustments:null});assert.equal(s.record.documents.length,1);assert.ok(!JSON.stringify(s.record).includes('dng'));await h.close();
});
test('abort/readback mismatch/stale CAS retain acknowledged state and require explicit reconciliation without replay',async()=>{
 for(const fault of ['abort','mismatch','stale']){const {host:h,state:s,file:f}=setup();await h.load(f);h.observe(f,{...defaults,exposure:0.8});if(fault==='abort')s.abort=true;if(fault==='mismatch')s.mismatch=true;if(fault==='stale')s.record={schema:1,revision:1,documents:[]};await assert.rejects(h.save(f,{...defaults,exposure:0.8},thumb));assert.equal(h.status().uncertain,true);assert.equal(h.status().dirty,true);assert.equal(h.status().revision,0);await assert.rejects(h.save(f,defaults,thumb),/Reload/);s.abort=s.mismatch=false;const before=s.commits;await h.load(f);assert.equal(s.commits,before);assert.equal(h.status().uncertain,false);await h.close();}
});
test('unsupported fields/effects, nonfinite values, oversized thumbnails and record capacity fail before writes',async()=>{
 const {host:h,state:s,file:f}=setup();await h.load(f);for(const value of [{...defaults,exposure:6},{...defaults,exposure:NaN},{...defaults,contrast:1},{...defaults,privatePath:'/private'},{...defaults,masks:[{}]}])await assert.rejects(h.save(f,value,thumb));await assert.rejects(h.save(f,defaults,'data:image/jpeg;base64,'+'A'.repeat(131072)));assert.equal(s.commits,0);
 s.record={schema:1,revision:1,documents:Array.from({length:32},(_,n)=>({id:n.toString(16).padStart(64,'0')+':3',exposure:0,thumbnail:thumb}))};await h.load(f);await assert.rejects(h.save(f,defaults,thumb),/Corrupt/);assert.equal(s.commits,0);await h.close();
});
test('deadline refuses overlapping IO then reconciles durable output once IO settles',async()=>{
 const {host:h,state:s,file:f}=setup({timeoutMs:30});await h.load(f);s.hold=gate();const job=h.save(f,{...defaults,exposure:0.8},thumb);await assert.rejects(job,/timed out/);assert.equal(h.status().pendingIO,true);assert.equal(h.status().uncertain,true);await assert.rejects(h.load(f),/pending/);s.hold.release();await until(()=>!h.status().pendingIO);s.hold=null;await h.load(f);assert.equal(h.status().revision,1);assert.equal(s.commits,1);await h.close();await assert.rejects(h.load(f),/closed/);
});
test('corrupt private records are preserved; no selected File or write is accepted after close',async()=>{
 const {host:h,state:s,file:f}=setup();s.record={schema:1,revision:1,documents:[{id:'file:///private',exposure:0,thumbnail:thumb}]};const original=structuredClone(s.record);await assert.rejects(h.load(f),/Corrupt/);assert.deepEqual(s.record,original);assert.equal(h.status().uncertain,true);await h.close();await assert.rejects(h.save(f,defaults,thumb),/closed/);
});

test('image decode snapshot cannot silently refresh a newer revision behind the displayed adjustments',async()=>{
 const {host:h,state:s,file:f}=setup();await h.load(f);assert.deepEqual(h.snapshot(f),{adjustments:null});s.record={schema:1,revision:1,documents:[]};assert.deepEqual(h.snapshot(f),{adjustments:null});assert.equal(h.status().revision,0);await assert.rejects(h.save(f,{...defaults,exposure:0.8},thumb),/another tab/);assert.equal(s.record.revision,1);assert.throws(()=>h.snapshot(f),/Load metadata/);await h.close();
});
