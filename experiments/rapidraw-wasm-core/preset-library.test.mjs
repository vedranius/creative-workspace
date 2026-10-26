import test from 'node:test';
import assert from 'node:assert/strict';
import {createPresetLibrary,mergePresetItems,boundedLibrary} from './preset-library.js';
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

test('delete is opt-in and waits for exact library readback before publishing revision',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created('First')]);const first=await f.host.load();await f.host.saveCreated([...first,created('Second')]);const before=await f.host.load(),next=before.slice(1);await assert.rejects(f.host.savePresets(next,{allowRename:true}),/Only one new/);
 f.state.readGate=gate();let resolved=false;const job=f.host.savePresets(next,{allowDelete:true}).then(v=>{resolved=true;return v;});await until(()=>f.state.reading);assert.equal(resolved,false);assert.equal(f.host.status().revision,2);assert.equal(f.state.record.revision,3);assert.deepEqual(f.state.record.presets,next);await assert.rejects(f.host.savePresets(next,{allowDelete:true}),/Reload/);f.state.readGate.release();assert.equal(await job,null);assert.equal(f.host.status().revision,3);assert.deepEqual(await f.host.load(),next);
});
test('delete refuses multiple/folder/nested targets and edited/reordered siblings before IO',async()=>{
 const f=fixture();f.state.record={schema:1,revision:1,presets:boundedLibrary([created('First'),created('Second'),created('Third'),{folder:{id:'folder',name:'Folder',children:[{id:'nested',name:'Nested',presetType:'tool',adjustments:{exposure:0.8}}]}}])};const before=await f.host.load();
 const changed=structuredClone(before.slice(1));changed[0].preset.name='Changed';const nested=structuredClone(before);nested[3].folder.children=[];
 for(const value of [before,[],before.slice(0,3),[before[2],before[1],before[3]],changed,nested])await assert.rejects(f.host.savePresets(value,{allowDelete:true}));assert.equal(f.state.commits,0);assert.equal(f.host.status().uncertain,false);assert.deepEqual(await f.host.load(),before);
});
test('delete abort and stale CAS preserve durable content and prohibit automatic replay',async()=>{
 for(const fault of ['abort','stale']){const f=fixture();await f.host.load();await f.host.saveCreated([created()]);const before=await f.host.load();if(fault==='abort')f.state.aborted=true;else f.state.record={...f.state.record,revision:2,presets:[...before,created('Peer')]};const durable=structuredClone(f.state.record);
 await assert.rejects(f.host.savePresets([],{allowDelete:true}),fault==='abort'?/abort/:/another tab/);assert.deepEqual(f.state.record,durable);assert.equal(f.host.status().revision,1);assert.equal(f.host.status().uncertain,true);await assert.rejects(f.host.savePresets([],{allowDelete:true}),/Reload/);assert.equal(f.state.commits,1);f.state.aborted=false;await f.host.load();assert.deepEqual(f.state.record,durable);}
});
test('uncertain deletion reconciles absence only through explicit reload, with no second commit',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created()]);const before=structuredClone(f.state.record),read=f.backend.read;f.backend.read=async()=>before;
 await assert.rejects(f.host.savePresets([],{allowDelete:true}),/readback/);assert.equal(f.state.record.revision,2);assert.deepEqual(f.state.record.presets,[]);assert.equal(f.host.status().revision,1);assert.equal(f.host.status().uncertain,true);await assert.rejects(f.host.savePresets([],{allowDelete:true}),/Reload/);f.backend.read=read;assert.deepEqual(await f.host.load(),[]);assert.equal(f.host.status().revision,2);assert.equal(f.state.commits,2);
});
test('timed-out deletion retains pending IO and blocks mutations until explicit reconciliation',async()=>{
 const f=fixture({timeoutMs:50});await f.host.load();await f.host.saveCreated([created()]);f.state.readGate=gate();const job=f.host.savePresets([],{allowDelete:true});await until(()=>f.state.reading);await assert.rejects(job,/timed out/);assert.equal(f.host.status().pendingIO,true);assert.equal(f.host.status().revision,1);await assert.rejects(f.host.savePresets([],{allowDelete:true}),/Reload/);f.state.readGate.release();await until(()=>!f.host.status().pendingIO);assert.deepEqual(await f.host.load(),[]);assert.equal(f.host.status().revision,2);assert.equal(f.state.commits,2);
});

const duplicateAfter=(before,index=0)=>{const next=structuredClone(before),source=before[index].preset;next.splice(index+1,0,{preset:{...structuredClone(source),id:crypto.randomUUID(),name:source.name+' Copy'}});return next;};
test('duplicate waits for durable readback with fresh ID, original position/name/values and unchanged siblings',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created('First')]);await f.host.saveCreated([...(await f.host.load()),created('Second')]);const before=await f.host.load(),next=duplicateAfter(before);await assert.rejects(f.host.savePresets(next),/unchanged/);
 f.state.readGate=gate();let resolved=false;const job=f.host.savePresets(next,{allowDuplicate:true}).then(v=>{resolved=true;return v;});await until(()=>f.state.reading);assert.equal(resolved,false);assert.equal(f.host.status().revision,2);assert.equal(f.state.record.revision,3);await assert.rejects(f.host.savePresets(next,{allowDuplicate:true}),/Reload/);f.state.readGate.release();assert.equal(await job,null);assert.deepEqual(await f.host.load(),next);assert.notEqual(next[0].preset.id,next[1].preset.id);
});
test('strict duplicate operation refuses collisions, changed source/clone/siblings, style, nested and multiple additions before IO',async()=>{
 const f=fixture();f.state.record={schema:1,revision:1,presets:boundedLibrary([created('First'),created('Second'),{preset:{...created('Style').preset,presetType:'style'}},{folder:{id:'folder',name:'Folder',children:[created('Child').preset]}}])};const before=await f.host.load(),bad=[before,duplicateAfter(before,2)];
 for(const fields of [{id:before[0].preset.id},{id:'not-uuid'},{name:'Wrong Copy'},{adjustments:{exposure:1.2}},{includeMasks:true}]){const v=duplicateAfter(before);Object.assign(v[1].preset,fields);bad.push(v);}
 const sibling=duplicateAfter(before);sibling[2].preset.name='Changed sibling';bad.push(sibling);const order=duplicateAfter(before);[order[0],order[1]]=[order[1],order[0]];bad.push(order);const multiple=duplicateAfter(duplicateAfter(before));bad.push(multiple);const nested=structuredClone(before);nested[3].folder.children.push({...created('Child Copy').preset});bad.push(nested);
 for(const v of bad)await assert.rejects(f.host.saveDuplicated(v));assert.equal(f.state.commits,0);assert.equal(f.host.status().uncertain,false);assert.deepEqual(await f.host.load(),before);
});
test('duplicate abort/stale/readback mismatch cannot replay and requires explicit library reload',async()=>{
 for(const fault of ['abort','stale','readback']){const f=fixture();await f.host.load();await f.host.saveCreated([created()]);const before=await f.host.load(),next=duplicateAfter(before);if(fault==='abort')f.state.aborted=true;if(fault==='stale')f.state.record={schema:1,revision:2,presets:[...before,created('Peer')]};const durable=structuredClone(f.state.record),read=f.backend.read;if(fault==='readback')f.backend.read=async()=>durable;
 await assert.rejects(f.host.saveDuplicated(next));assert.equal(f.host.status().uncertain,true);assert.equal(f.host.status().revision,1);await assert.rejects(f.host.saveDuplicated(next),/Reload/);if(fault!=='readback')assert.deepEqual(f.state.record,durable);f.backend.read=read;f.state.aborted=false;await f.host.load();assert.equal(f.host.status().uncertain,false);assert.equal(f.state.commits,fault==='readback'?2:1);}
});
test('last-position duplicate and existing append-Create share the original SavePresets command without changing siblings',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created('Last')]);const before=await f.host.load(),next=duplicateAfter(before);await f.host.savePresets(next,{allowDuplicate:true});assert.deepEqual(await f.host.load(),next);await f.host.savePresets([...next,created('Independent Create')],{allowDuplicate:true});assert.deepEqual((await f.host.load()).slice(0,2),next);assert.equal(f.state.commits,3);
});
test('duplicate timeout keeps pending IO and reconciles one durable clone without replay',async()=>{
 const f=fixture({timeoutMs:50});await f.host.load();await f.host.saveCreated([created()]);const next=duplicateAfter(await f.host.load());f.state.readGate=gate();const job=f.host.saveDuplicated(next);await until(()=>f.state.reading);await assert.rejects(job,/timed out/);assert.equal(f.host.status().pendingIO,true);await assert.rejects(f.host.saveDuplicated(next),/Reload/);f.state.readGate.release();await until(()=>!f.host.status().pendingIO);assert.deepEqual(await f.host.load(),next);assert.equal(f.state.commits,2);
});

const overwritten=(before,index=0,value=-0.8)=>{const next=structuredClone(before);next[index].preset.adjustments={exposure:value};return next;};
test('overwrite opt-in retains acknowledged value until durable readback without changing identity or siblings',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created('First')]);await f.host.saveCreated([...(await f.host.load()),created('Second')]);const before=await f.host.load(),next=overwritten(before);await assert.rejects(f.host.savePresets(next));assert.equal(f.state.commits,2);
 f.state.readGate=gate();let resolved=false;const pending=f.host.savePresets(next,{allowOverwrite:true}).then(v=>{resolved=true;return v;});await until(()=>f.state.reading);assert.equal(resolved,false);assert.equal(f.host.status().revision,2);assert.equal(f.state.record.revision,3);await assert.rejects(f.host.saveOverwritten(next),/Reload/);f.state.readGate.release();assert.equal(await pending,null);assert.deepEqual(await f.host.load(),next);assert.deepEqual({...next[0].preset,adjustments:before[0].preset.adjustments},before[0].preset);assert.deepEqual(next[1],before[1]);
});
test('overwrite refuses identity, metadata, order, multiple, nested, style and unbounded changes before IO',async()=>{
 const f=fixture();f.state.record={schema:1,revision:1,presets:boundedLibrary([created('First'),created('Second'),{preset:{...created('Style').preset,presetType:'style'}},{folder:{id:'folder',name:'Folder',children:[created('Child').preset]}}])};const before=await f.host.load(),bad=[before,overwritten(before,2)];
 for(const fields of [{id:crypto.randomUUID()},{name:'Renamed'},{includeMasks:true},{includeCropTransform:undefined},{presetType:'style'},{adjustments:{exposure:99}},{adjustments:{}},{adjustments:{exposure:-0.8,contrast:1}}]){const v=overwritten(before);Object.assign(v[0].preset,fields);bad.push(v);}
 const sibling=overwritten(before);sibling[1].preset.name='Other changed';bad.push(sibling);const order=overwritten(before);[order[0],order[1]]=[order[1],order[0]];bad.push(order);const multiple=overwritten(overwritten(before),1);bad.push(multiple);const nested=structuredClone(before);nested[3].folder.children[0].adjustments.exposure=-0.8;bad.push(nested);
 for(const v of bad)await assert.rejects(f.host.saveOverwritten(v));assert.equal(f.state.commits,0);assert.equal(f.host.status().uncertain,false);assert.deepEqual(await f.host.load(),before);
});
test('overwrite abort stale peer and mismatched readback refuse replay until explicit reconciliation',async()=>{
 for(const fault of ['abort','stale','readback']){const f=fixture();await f.host.load();await f.host.saveCreated([created()]);const before=await f.host.load(),next=overwritten(before);if(fault==='abort')f.state.aborted=true;if(fault==='stale')f.state.record={schema:1,revision:2,presets:[...before,created('Peer')]};const durable=structuredClone(f.state.record),read=f.backend.read;if(fault==='readback')f.backend.read=async()=>durable;
 await assert.rejects(f.host.saveOverwritten(next));assert.equal(f.host.status().uncertain,true);assert.equal(f.host.status().revision,1);await assert.rejects(f.host.saveOverwritten(next),/Reload/);if(fault!=='readback')assert.deepEqual(f.state.record,durable);f.backend.read=read;f.state.aborted=false;await f.host.load();assert.equal(f.host.status().uncertain,false);assert.equal(f.state.commits,fault==='readback'?2:1);assert.deepEqual((await f.host.load())[0].preset.adjustments,fault==='readback'?next[0].preset.adjustments:before[0].preset.adjustments);}
});
test('overwrite deadline preserves pending IO and reconciles late durable value without replay',async()=>{
 const f=fixture({timeoutMs:50});await f.host.load();await f.host.saveCreated([created()]);const next=overwritten(await f.host.load());f.state.readGate=gate();const pending=f.host.saveOverwritten(next);await until(()=>f.state.reading);await assert.rejects(pending,/timed out/);assert.equal(f.host.status().pendingIO,true);await assert.rejects(f.host.saveOverwritten(next),/Reload/);f.state.readGate.release();await until(()=>!f.host.status().pendingIO);assert.deepEqual(await f.host.load(),next);assert.equal(f.state.commits,2);
});
test('overwrite capability preserves separate rename duplicate delete and append create semantics',async()=>{
 const f=fixture();await f.host.load();await f.host.saveCreated([created('First')]);await f.host.savePresets(overwritten(await f.host.load()),{allowOverwrite:true});const renamed=await f.host.load();renamed[0].preset.name='Renamed';await f.host.savePresets(renamed,{allowOverwrite:true,allowRename:true});await f.host.savePresets([...renamed,created('New')],{allowOverwrite:true});const next=duplicateAfter(await f.host.load());await f.host.savePresets(next,{allowOverwrite:true,allowDuplicate:true});await f.host.savePresets(next.slice(0,-1),{allowOverwrite:true,allowDelete:true});assert.equal(f.state.commits,6);assert.equal((await f.host.load())[0].preset.adjustments.exposure,-0.8);
});

const folderCreated=(before,name='New Folder')=>{const next=structuredClone(before),first=next.findIndex(item=>item.preset);next.splice(first===-1?next.length:first,0,{folder:{id:crypto.randomUUID(),name,children:[]}});return next;};
const folderRenamed=(before,name='Renamed Folder',index=0)=>{const next=structuredClone(before);next[index].folder.name=name;return next;};
test('folder rename requires separate opt-in and waits for exact durable readback preserving identity and siblings',async()=>{
 const f=fixture();f.state.record={schema:1,revision:1,presets:boundedLibrary(folderCreated([created('Tool')]))};const before=await f.host.load(),next=folderRenamed(before);
 await assert.rejects(f.host.savePresets(next));await assert.rejects(f.host.savePresets(next,{allowRename:true}));assert.equal(f.state.commits,0);f.state.readGate=gate();let resolved=false;const pending=f.host.savePresets(next,{allowRenameFolder:true}).then(()=>resolved=true);await until(()=>f.state.reading);assert.equal(resolved,false);assert.equal(f.host.status().revision,1);assert.equal(f.state.record.revision,2);assert.equal(next[0].folder.id,before[0].folder.id);assert.deepEqual(next.slice(1),before.slice(1));await assert.rejects(f.host.saveFolderRenamed(next),/Reload/);f.state.readGate.release();await pending;assert.deepEqual(await f.host.load(),next);
});
test('folder rename refuses nested/nonempty/fresh/changed IDs, order, values, siblings, multiple and malformed names before IO',async()=>{
 const f=fixture();const initial=folderCreated(folderCreated([created('Tool')],'Other'),'First');initial.push({folder:{id:'populated',name:'Populated',children:[created('Child').preset]}});f.state.record={schema:1,revision:1,presets:boundedLibrary(initial)};const before=await f.host.load(),bad=[before,folderRenamed(before,'No',3)];
 for(const fields of [{id:crypto.randomUUID()},{name:''},{name:'bad/name'},{children:[created('New child').preset]},{extra:true}]){const next=folderRenamed(before);Object.assign(next[0].folder,fields);bad.push(next);}
 const order=folderRenamed(before);[order[0],order[1]]=[order[1],order[0]];bad.push(order);const sibling=folderRenamed(before);sibling[2].preset.adjustments.exposure=-0.8;bad.push(sibling);bad.push(folderRenamed(folderRenamed(before),'Second',1));const nested=structuredClone(before);nested[3].folder.children[0].name='Nested name';bad.push(nested);bad.push(folderCreated(before));
 for(const v of bad)await assert.rejects(f.host.saveFolderRenamed(v));assert.equal(f.state.commits,0);assert.equal(f.host.status().uncertain,false);assert.deepEqual(await f.host.load(),before);
});
test('folder rename abort, stale peer and uncertain readback retain acknowledged state until explicit reload without replay',async()=>{
 for(const fault of ['abort','stale','readback']){const f=fixture();f.state.record={schema:1,revision:1,presets:boundedLibrary(folderCreated([created()]))};const before=await f.host.load(),next=folderRenamed(before);if(fault==='abort')f.state.aborted=true;if(fault==='stale')f.state.record={schema:1,revision:2,presets:folderRenamed(before,'Peer name')};const durable=structuredClone(f.state.record),read=f.backend.read;if(fault==='readback')f.backend.read=async()=>durable;
 await assert.rejects(f.host.saveFolderRenamed(next));assert.equal(f.host.status().revision,1);assert.equal(f.host.status().uncertain,true);await assert.rejects(f.host.saveFolderRenamed(next),/Reload/);if(fault!=='readback')assert.deepEqual(f.state.record,durable);f.backend.read=read;f.state.aborted=false;assert.deepEqual(await f.host.load(),fault==='readback'?next:durable.presets);assert.equal(f.state.commits,fault==='readback'?1:0);assert.equal(f.host.status().uncertain,false);}
});
test('folder rename timeout keeps late IO exclusive and allows duplicate names with distinct unchanged IDs',async()=>{
 const f=fixture({timeoutMs:50});f.state.record={schema:1,revision:1,presets:boundedLibrary(folderCreated(folderCreated([],'Same'),'Other'))};const before=await f.host.load(),next=folderRenamed(before,'Same',1);f.state.readGate=gate();const pending=f.host.saveFolderRenamed(next);await until(()=>f.state.reading);await assert.rejects(pending,/timed out/);assert.equal(f.host.status().pendingIO,true);await assert.rejects(f.host.saveFolderRenamed(next),/Reload/);f.state.readGate.release();await until(()=>!f.host.status().pendingIO);assert.deepEqual(await f.host.load(),next);assert.equal(next[0].folder.name,next[1].folder.name);assert.notEqual(next[0].folder.id,next[1].folder.id);assert.equal(f.state.commits,1);
});
test('new folder opt-in waits for durable readback at original position with unchanged presets and folders',async()=>{
 const f=fixture();await f.host.load();const empty=folderCreated([]);await assert.rejects(f.host.savePresets(empty));await f.host.savePresets(empty,{allowCreateFolder:true});await f.host.saveCreated([...empty,created('First')]);const before=await f.host.load(),next=folderCreated(before,'Second');f.state.readGate=gate();let resolved=false;const pending=f.host.saveFolderCreated(next).then(()=>resolved=true);await until(()=>f.state.reading);assert.equal(resolved,false);assert.equal(f.host.status().revision,2);assert.equal(f.state.record.revision,3);assert.deepEqual(next.filter((_,i)=>i!==1),before);await assert.rejects(f.host.saveFolderCreated(next),/Reload/);f.state.readGate.release();await pending;assert.deepEqual(await f.host.load(),next);assert.deepEqual(next[1].folder.children,[]);
});
test('new folder refuses contents, existing IDs, wrong position, sibling edits, multiple and malformed names before IO',async()=>{
 const f=fixture();f.state.record={schema:1,revision:1,presets:boundedLibrary([created('First'),created('Second')])};const before=await f.host.load(),bad=[before];
 for(const fields of [{id:before[0].preset.id},{id:'invalid'},{name:''},{name:'bad/name'},{children:[created('Child').preset]},{extra:true}]){const v=folderCreated(before);Object.assign(v[0].folder,fields);bad.push(v);}
 const order=folderCreated(before);[order[0],order[1]]=[order[1],order[0]];bad.push(order);const changed=folderCreated(before);changed[1].preset.adjustments.exposure=-0.8;bad.push(changed);bad.push(folderCreated(folderCreated(before)));
 for(const v of bad)await assert.rejects(f.host.saveFolderCreated(v));assert.equal(f.state.commits,0);assert.equal(f.host.status().uncertain,false);assert.deepEqual(await f.host.load(),before);
});
test('new folder abort stale peer and readback mismatch preserve acknowledged library and refuse replay',async()=>{
 for(const fault of ['abort','stale','readback']){const f=fixture();await f.host.load();await f.host.saveCreated([created()]);const before=await f.host.load(),next=folderCreated(before);if(fault==='abort')f.state.aborted=true;if(fault==='stale')f.state.record={schema:1,revision:2,presets:[...before,created('Peer')]};const durable=structuredClone(f.state.record),read=f.backend.read;if(fault==='readback')f.backend.read=async()=>durable;
 await assert.rejects(f.host.saveFolderCreated(next));assert.equal(f.host.status().uncertain,true);assert.equal(f.host.status().revision,1);await assert.rejects(f.host.saveFolderCreated(next),/Reload/);if(fault!=='readback')assert.deepEqual(f.state.record,durable);f.backend.read=read;f.state.aborted=false;const loaded=await f.host.load();assert.equal(f.host.status().uncertain,false);assert.equal(f.state.commits,fault==='readback'?2:1);assert.deepEqual(loaded,fault==='readback'?next:durable.presets);}
});
test('new folder timeout keeps late IO exclusive until explicit reconciliation without replay',async()=>{
 const f=fixture({timeoutMs:50});await f.host.load();await f.host.saveCreated([created()]);const next=folderCreated(await f.host.load());f.state.readGate=gate();const pending=f.host.saveFolderCreated(next);await until(()=>f.state.reading);await assert.rejects(pending,/timed out/);assert.equal(f.host.status().pendingIO,true);await assert.rejects(f.host.saveFolderCreated(next),/Reload/);f.state.readGate.release();await until(()=>!f.host.status().pendingIO);assert.deepEqual(await f.host.load(),next);assert.equal(f.state.commits,2);
});
test('new folder retains original only-folder append position duplicate-name behavior and independent Tool create',async()=>{
 const f=fixture();await f.host.load();const first=folderCreated([],'Same');await f.host.saveFolderCreated(first);const second=folderCreated(await f.host.load(),'Same');await f.host.saveFolderCreated(second);assert.deepEqual(second[0],first[0]);assert.notEqual(second[0].folder.id,second[1].folder.id);assert.equal(second[1].folder.name,'Same');await f.host.savePresets([...second,created('Tool')],{allowCreateFolder:true});assert.deepEqual((await f.host.load()).slice(0,2),second);assert.equal(f.state.commits,3);
});
