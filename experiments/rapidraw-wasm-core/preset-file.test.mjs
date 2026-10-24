import test from 'node:test';
import assert from 'node:assert/strict';
import {serializePresetFile,createPresetFileHost} from './preset-file.js';
import {createExportDestination} from './export-destination.js';
import {MemoryFile,MemoryDirectory} from './test-filesystem.mjs';
const items=[{preset:{id:'exposure',name:'Exposure +0.8',adjustments:{exposure:0.8},includeMasks:false,includeCropTransform:false,presetType:'user'}}];
const wait=async fn=>{for(let n=0;n<200;n++){if(fn())return;await new Promise(r=>setTimeout(r,1));}throw Error('Missing phase');};
function fixture(){const target=new MemoryFile('exposure.rrpreset'),root=new MemoryDirectory(),events=[];let retention='until-ack';const destination=createExportDestination({format:'rrpreset',pickFile:async()=>target,getRoot:async()=>root,getRetention:()=>retention});const host=createPresetFileHost({items,destination,onTrace:e=>events.push(e)});return {target,root,events,destination,host,keep:()=>{retention='keep';},invoke:async token=>host.invoke('handle_export_presets_to_file',{presetsToExport:items,filePath:token??await host.choose({defaultPath:'exposure.rrpreset'})})};}
test('native development schema stays separate from export settings and bounded before IO',()=>{
 assert.deepEqual(JSON.parse(new TextDecoder().decode(serializePresetFile(items))),{creator:'Anonymous',presets:items});
 assert.doesNotThrow(()=>serializePresetFile([{folder:{id:'folder',name:'Folder',children:[items[0].preset]}}]));
 for(const value of [[],Array(33).fill(items[0]),[...items,...items],[{preset:{...items[0].preset,adjustments:{exposure:6}}}],[{preset:{...items[0].preset,adjustments:{exposure:NaN}}}],[{preset:{...items[0].preset,lastExportPath:'/private'}}],[{preset:{...items[0].preset,name:'x'.repeat(70000)}}],[{preset:{...items[0].preset,adjustments:{exposure:1,watermarkPath:'/private'}}}]])assert.throws(()=>serializePresetFile(value));
});
test('original invoke resolves only after close/readback and single-use ACK',async()=>{
 const f=fixture();let release,closing=false;f.target.hooks.close=async()=>{closing=true;await new Promise(r=>release=r);};
 const token=await f.host.choose({}),job=f.invoke(token);await wait(()=>closing);assert.equal(f.host.status().busy,true);assert.ok(!f.events.some(e=>e.phase==='ack'));assert.equal(f.target.bytes.length,0);
 await assert.rejects(f.invoke(),/already active/);release();assert.equal(await job,null);assert.ok(f.events.some(e=>e.phase==='ack'));assert.deepEqual(f.target.bytes,serializePresetFile(items));assert.deepEqual(await f.destination.listRecovery(),[]);
 await assert.rejects(f.invoke(token),/expired/);
});
test('newer-file and close failures retain exact preset bytes with no replay',async()=>{
 for(const fault of ['newer','close']){const f=fixture(),token=await f.host.choose({});if(fault==='newer')f.target.replace('newer');else f.target.hooks.close=async()=>{throw Error('Close refused');};
 await assert.rejects(f.invoke(token),e=>e.outputRetained===true);assert.ok(!f.events.some(e=>e.phase==='ack'));const [r]=await f.destination.listRecovery();assert.equal(r.state,'uncertain');assert.deepEqual(await f.destination.readRecovery(r.id),serializePresetFile(items));if(fault==='newer')assert.equal(new TextDecoder().decode(f.target.bytes),'newer');await assert.rejects(f.invoke(token),/expired/);}
});
test('keep retention and closed-session refusal preserve recovery',async()=>{
 const f=fixture();f.keep();await f.invoke();const [r]=await f.destination.listRecovery();assert.equal(r.state,'complete');assert.deepEqual(await f.destination.readRecovery(r.id),serializePresetFile(items));f.host.close();await assert.rejects(f.host.choose({}),/closed/);
});

test('original tool/style preset types are accepted alongside prior experimental fixture labels',()=>{
 for(const presetType of ['tool','style'])assert.doesNotThrow(()=>serializePresetFile([{preset:{...items[0].preset,presetType}}]));
});
