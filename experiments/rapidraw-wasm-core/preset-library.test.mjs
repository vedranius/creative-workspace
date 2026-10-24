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

const created=(name='Created',exposure=0.8)=>({preset:{id:crypto.randomUUID(),name,adjustments:{exposure},includeMasks:false,includeCropTransform:false,presetType:'tool'}});
test('create tool preset waits for exact write/readback ACK and refuses duplicate or nonappend writes',async()=>{
 const f=fixture();await f.host.load();f.state.readGate=gate();const value=[created()];let resolved=false;const job=f.host.saveCreated(value).then(v=>{resolved=true;return v;});await until(()=>f.state.reading);
 assert.equal(f.state.record.revision,1);assert.equal(f.host.status().revision,0);assert.equal(resolved,false);await assert.rejects(f.host.saveCreated(value),/Reload/);
 f.state.readGate.release();assert.equal(await job,null);assert.equal(f.host.status().revision,1);assert.deepEqual((await f.host.load())[0].preset,value[0].preset);
 await assert.rejects(f.host.saveCreated(value),/Only one new/);await assert.rejects(f.host.saveCreated([{...created(),preset:{...value[0].preset,name:'Changed'}},created()]),/unchanged/);assert.equal(f.state.commits,1);
});
test('create refuses unsupported shapes, styles, counts, values and stale source before IO',async()=>{
 const f=fixture();await f.host.load();for(const value of [[{preset:{...created().preset,presetType:'style'}}],[{preset:{...created().preset,adjustments:{exposure:6}}}],[{preset:{...created().preset,adjustments:{contrast:1}}}],[{folder:{id:'folder',name:'Folder',children:[]}}],Array.from({length:33},()=>created()),[{preset:{...created().preset,includeMasks:true}}]])await assert.rejects(f.host.saveCreated(value));
 assert.equal(f.state.commits,0);assert.equal(f.host.status().uncertain,false);await f.host.close();await assert.rejects(f.host.saveCreated([created()]),/Reload/);
});
test('create abort/readback mismatch/other-tab conflict preserve acknowledged revision without replay',async()=>{
 for(const fault of ['abort','readback','stale']){
  const f=fixture();await f.host.load();let expected=null;if(fault==='abort')f.state.aborted=true;if(fault==='stale'){f.state.record={schema:1,revision:1,presets:[created('Peer')]};expected=structuredClone(f.state.record);}if(fault==='readback')f.backend.read=async()=>null;
  await assert.rejects(f.host.saveCreated([created()]));assert.equal(f.host.status().revision,0);assert.equal(f.host.status().uncertain,true);
  await assert.rejects(f.host.saveCreated([created()]),/Reload/);if(fault!=='readback')assert.deepEqual(f.state.record,expected);else assert.equal(f.state.record.revision,1);
 }
});
test('create timeout keeps unacknowledged durable result and blocks writes until reconciliation',async()=>{
 const f=fixture({timeoutMs:50});await f.host.load();f.state.readGate=gate();const job=f.host.saveCreated([created()]);await until(()=>f.state.reading);await assert.rejects(job,/timed out/);assert.equal(f.host.status().revision,0);assert.equal(f.host.status().pendingIO,true);await assert.rejects(f.host.saveCreated([created()]),/Reload/);f.state.readGate.release();await until(()=>!f.host.status().pendingIO);await f.host.load();assert.equal(f.host.status().revision,1);assert.equal(f.state.commits,1);
});
test('configure rename waits for ACK, keeps ID/Exposure/other records, and is opt-in',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created()]);const before=await f.host.load(),next=structuredClone(before);next[0].preset.name='Renamed';await assert.rejects(f.host.savePresets(next),/Only one new/);
 f.state.readGate=gate();let resolved=false;const job=f.host.savePresets(next,{allowRename:true}).then(v=>{resolved=true;return v;});await until(()=>f.state.reading);assert.equal(f.state.record.revision,2);assert.equal(f.host.status().revision,1);assert.equal(resolved,false);await assert.rejects(f.host.savePresets(next,{allowRename:true}),/Reload/);f.state.readGate.release();assert.equal(await job,null);const saved=await f.host.load();assert.equal(saved[0].preset.id,before[0].preset.id);assert.deepEqual(saved[0].preset.adjustments,before[0].preset.adjustments);assert.equal(saved[0].preset.name,'Renamed');
});
test('configure refuses value/ID/type/flags/order/multiple/no-op changes before writes',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created('First')]);const one=await f.host.load();await f.host.saveCreated([...one,created('Second')]);const before=await f.host.load(),writes=f.state.commits;
 const variants=[before,[...before].reverse(),before.slice(0,1)];
 for(const fields of [{id:crypto.randomUUID(),name:'Renamed'},{adjustments:{exposure:0.9},name:'Renamed'},{presetType:'style',name:'Renamed'},{includeMasks:true,name:'Renamed'}]){const v=structuredClone(before);Object.assign(v[0].preset,fields);variants.push(v);}
 const both=structuredClone(before);both.forEach(i=>i.preset.name+=' changed');variants.push(both);
 for(const v of variants)await assert.rejects(f.host.savePresets(v,{allowRename:true}));assert.equal(f.state.commits,writes);assert.equal(f.host.status().uncertain,false);assert.deepEqual(await f.host.load(),before);
});
test('stale configure rename preserves newer peer names and requires reload',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created()]);const before=await f.host.load(),next=structuredClone(before);next[0].preset.name='Local rename';f.state.record={...f.state.record,revision:2,presets:structuredClone(before)};f.state.record.presets[0].preset.name='Peer name';const peer=structuredClone(f.state.record);await assert.rejects(f.host.savePresets(next,{allowRename:true}),/another tab/);assert.deepEqual(f.state.record,peer);assert.equal(f.host.status().revision,1);assert.equal(f.host.status().uncertain,true);await f.host.load();assert.equal(f.host.status().revision,2);
});
test('successful rename invalidates earlier import choices without replay or extra commits',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created()]);const before=await f.host.load(),tokens=await f.host.choose(),next=structuredClone(before);next[0].preset.name='Renamed';await f.host.savePresets(next,{allowRename:true});await assert.rejects(f.host.importFiles(tokens),/expired|changed/);assert.equal(f.state.commits,2);assert.equal(f.host.status().revision,2);
});
