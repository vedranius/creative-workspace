import test from 'node:test';
import assert from 'node:assert/strict';
import {createPresetLibrary,mergePresetItems} from './preset-library.js';
const items=[{preset:{id:'original',name:'Exposure',adjustments:{exposure:0.8}}},{folder:{id:'folder',name:'Folder',children:[{id:'child',name:'Child',adjustments:{exposure:-0.5}}]}}];
const ids=list=>list.flatMap(i=>i.preset?[i.preset.id]:[i.folder.id,...i.folder.children.map(p=>p.id)]);
const gate=()=>{let resolve;return {promise:new Promise(r=>resolve=r),release:()=>resolve()};};
const until=async fn=>{for(let n=0;n<200;n++){if(fn())return;await new Promise(r=>setTimeout(r,1));}throw Error('Missing phase');};
function fixture(options={}){
 const state={record:null,commits:0,aborted:false,readGate:null,reading:false};
 let input=new File([JSON.stringify({creator:'Anonymous',presets:items})],'sample.rrpreset',{lastModified:1});
 const handle={kind:'file',name:input.name,queryPermission:async()=> 'granted',getFile:async()=>input};
 const backend={read:async()=>{const v=structuredClone(state.record);if(state.readGate&&state.commits){state.reading=true;await state.readGate.promise;}return v;},commit:async(expected,next)=>{if(state.aborted)throw Error('Injected abort');if((state.record?.revision??0)!==expected)throw Error('Preset library changed in another tab');state.record=structuredClone(next);state.commits++;}};
 const host=createPresetLibrary({backend,pickFiles:async()=>[handle],...options});
 return {host,state,handle,backend,replace:file=>{input=file;},import:async()=>host.importFiles(await host.choose())};
}
test('original merge creates fresh IDs and disambiguates top-level names only',()=>{
 const first=mergePresetItems([],items),second=mergePresetItems(first,items);
 assert.deepEqual(second.map(i=>(i.preset??i.folder).name),['Exposure','Folder','Exposure (1)','Folder (1)']);
 assert.equal(second[3].folder.children[0].name,'Child');assert.equal(new Set(ids(second)).size,6);assert.ok(ids(second).every(id=>!ids(items).includes(id)));
});
test('library does not acknowledge import until write/readback; tokens cannot replay',async()=>{
 const f=fixture();assert.deepEqual(await f.host.load(),[]);f.state.readGate=gate();const tokens=await f.host.choose();let resolved=false;const job=f.host.importFiles(tokens).then(v=>{resolved=true;return v;});await until(()=>f.state.reading);
 assert.equal(f.state.record.revision,1);assert.equal(f.host.status().revision,0);assert.equal(resolved,false);await assert.rejects(f.host.importFiles(tokens),/Reload/);
 f.state.readGate.release();const result=await job;assert.equal(result.presets.length,2);assert.deepEqual(result.failures,[]);assert.equal(f.host.status().revision,1);await assert.rejects(f.host.importFiles(tokens),/expired/);
});
test('transaction failure and stale-tab CAS preserve the prior record and require reload',async()=>{
 for(const fault of ['abort','stale']){const f=fixture();await f.host.load();const tokens=await f.host.choose();if(fault==='abort')f.state.aborted=true;else f.state.record={schema:1,revision:1,presets:mergePresetItems([],items)};const prior=structuredClone(f.state.record);
 await assert.rejects(f.host.importFiles(tokens),fault==='abort'?/abort/:/another tab/);assert.deepEqual(f.state.record,prior);assert.equal(f.host.status().uncertain,true);await assert.rejects(f.host.choose(),/Reload/);f.state.aborted=false;await f.host.load();assert.equal(f.host.status().uncertain,false);}
});
test('changed inputs and malformed/unsupported files report failures without library writes',async()=>{
 for(const text of ['{bad',JSON.stringify({presets:[{preset:{...items[0].preset,adjustments:{exposure:99}}}]}),JSON.stringify({presets:items,privatePath:'/private'})]){const f=fixture();f.replace(new File([text],'sample.rrpreset',{lastModified:1}));await f.host.load();const r=await f.import();assert.equal(r.failures.length,1);assert.equal(r.presets.length,0);assert.equal(f.state.commits,0);}
 const f=fixture();await f.host.load();const token=await f.host.choose();f.replace(new File(['newer'],'sample.rrpreset',{lastModified:2}));const r=await f.host.importFiles(token);assert.match(r.failures[0].error,/changed/);assert.equal(f.state.commits,0);
});
test('input bytes, library size, permission and closed session are bounded',async()=>{
 const f=fixture();await f.host.load();f.replace(new File(['x'.repeat(65537)],'sample.rrpreset'));await assert.rejects(f.host.choose(),/64 KiB/);f.replace(new File(['{}'],'sample.rrpreset'));f.handle.queryPermission=async()=> 'denied';await assert.rejects(f.host.choose(),/permission/);await f.host.close();await assert.rejects(f.host.load(),/closed/);
 assert.throws(()=>mergePresetItems(Array.from({length:32},(_,n)=>({preset:{...items[0].preset,id:'p'+n,name:'Preset '+n}})),items),/32/);
});
test('timeout blocks another import while IO is pending; reload reconciles durable result',async()=>{
 const f=fixture({timeoutMs:100});await f.host.load();f.state.readGate=gate();const job=f.import();await until(()=>f.state.reading);await assert.rejects(job,/timed out/);assert.equal(f.host.status().uncertain,true);assert.equal(f.host.status().pendingIO,true);await assert.rejects(f.host.choose(),/Reload/);f.state.readGate.release();await until(()=>!f.host.status().pendingIO);await f.host.load();assert.equal(f.host.status().revision,1);assert.equal(f.host.status().uncertain,false);
});
