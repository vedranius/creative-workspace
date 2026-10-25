import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSettings,boundedSettings,DEFAULT_BROWSER_SETTINGS} from './settings-storage.js';
import {createReactTransport} from './react-transport.js';
const preset={id:'preset-one',name:'JPEG preset',fileFormat:'jpeg',jpegQuality:60,enableResize:true,resizeMode:'longEdge',resizeValue:1200,dontEnlarge:true,filenameTemplate:'{original_filename}_edited',keepMetadata:false,stripGps:true,enableWatermark:false,watermarkPath:'private-path',lastExportPath:'browser-output:one-use',destinationType:'originalFolder',subfolder:'private-folder'};
const settings=()=>({...structuredClone(DEFAULT_BROWSER_SETTINGS),exportPresets:[structuredClone(preset)]});
function memory(){let saved=null;return {read:async()=>structuredClone(saved),commit:async(expected,next)=>{if((saved?.revision??0)!==expected)throw Error('another tab');saved=structuredClone(next);}};}
test('settings ABI round trips bounded presets without destination authority or paths',async()=>{
 const backend=memory(),host=createBrowserSettings({backend});assert.deepEqual(await host.load(),DEFAULT_BROWSER_SETTINGS);await host.save(settings());
 const restored=await createBrowserSettings({backend}).load(),p=restored.exportPresets[0];assert.equal(p.jpegQuality,60);assert.equal(p.lastExportPath,undefined);assert.equal(p.watermarkPath,null);assert.equal(p.destinationType,'customFolder');assert.equal(p.subfolder,'');assert.ok(!JSON.stringify(await backend.read()).includes('private-'));await host.close();
});
test('save resolves only after commit and readback, refuses overlap and another-tab overwrite',async()=>{
 const backend=memory(),a=createBrowserSettings({backend}),b=createBrowserSettings({backend});await a.load();await b.load();let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r),commit=backend.commit;backend.commit=async(...args)=>{entered();await gate;return commit(...args);};
 let ack=false;const saving=a.save(settings()).then(()=>ack=true);await started;assert.equal(ack,false);assert.equal(a.status().revision,0);await assert.rejects(a.save(settings()),/Reload/);release();await saving;assert.equal(ack,true);
 await assert.rejects(b.save(settings()),/another tab/);assert.equal(b.status().uncertain,true);await b.load();await b.save({...settings(),exportPresets:[]});assert.equal((await backend.read()).revision,2);
});
test('readback mismatch preserves uncertain state; failures never auto-replay',async()=>{
 const backend=memory(),host=createBrowserSettings({backend});await host.load();const commit=backend.commit;backend.commit=async(...args)=>{await commit(...args);backend.read=async()=>null;};await assert.rejects(host.save(settings()),/readback/);assert.equal(host.status().uncertain,true);await assert.rejects(host.save(settings()),/Reload/);
});
test('timeout blocks late IO, close and corruption do not silently reset preferences',async()=>{
 const backend=memory(),host=createBrowserSettings({backend,timeoutMs:10});await host.load();let release;backend.commit=()=>new Promise(r=>release=r);await assert.rejects(host.save(settings()),/timed out/);assert.equal(host.status().pendingIO,true);await assert.rejects(host.load(),/pending/);release();await new Promise(r=>setTimeout(r,0));await host.close();await assert.rejects(host.save(settings()),/Reload/);
 await assert.rejects(createBrowserSettings({backend:{read:async()=>({schema:2,revision:1,settings:{}})}}).load(),/Corrupt/);
});
test('malformed, oversized and path-bearing unknown settings refuse before storage',()=>{
 for(const value of [null,[],{...settings(),rootFolders:['private']},{...settings(),exportPresets:Array(33).fill(preset)},{...settings(),exportPresets:[preset,preset]},{...settings(),exportPresets:[{...preset,name:'x'.repeat(81)}]},{...settings(),exportPresets:[{...preset,filenameTemplate:'../private'}]},{...settings(),exportPresets:[{...preset,jpegQuality:NaN}]},{...settings(),theme:'x'.repeat(70000)}])assert.throws(()=>boundedSettings(value));
});
test('original load_settings/save_settings bypass preview queue and preserve native errors',async()=>{
 const host=createBrowserSettings({backend:memory()}),transport=createReactTransport({wasm:{},device:{queue:{onSubmittedWorkDone:async()=>{}}},defaults:{},settingsHost:host});assert.deepEqual(await transport.invoke('load_settings'),DEFAULT_BROWSER_SETTINGS);await transport.invoke('save_settings',{settings:settings()});assert.equal((await transport.invoke('load_settings')).exportPresets.length,1);await assert.rejects(transport.invoke('save_settings',{settings:settings(),path:'private'}),e=>typeof e==='string');await transport.close();
});
test('a failed reload cannot overwrite corrupt data using the prior acknowledged revision',async()=>{
 const backend=memory(),host=createBrowserSettings({backend});await host.load();await host.save(settings());backend.read=async()=>({schema:2,revision:1,settings:{}});await assert.rejects(host.load(),/Corrupt/);assert.equal(host.status().uncertain,true);await assert.rejects(host.save(settings()),/Reload/);
});
test('legacy preview-only load_settings remains compatible without a persistence host',async()=>{
 const preview={editorPreviewResolution:512},transport=createReactTransport({wasm:{},device:{queue:{onSubmittedWorkDone:async()=>{}}},defaults:{},getPreviewSettings:()=>preview});assert.deepEqual(await transport.invoke('load_settings'),preview);await transport.close();
});
test('the reviewed source ACK patch is pinned independently of original/native source',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');const meta=JSON.parse(await readFile(new URL('./UPSTREAM.json',import.meta.url)));const bytes=await readFile(new URL('../../'+meta.settingsUi.sourcePatch.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.settingsUi.sourcePatch.sha256);assert.equal(Object.keys(meta.settingsUi.sourcePatch.patchedFiles).length,2);
});

test('original copy/paste preferences round-trip both modes and none/Exposure without replacing unrelated preferences',async()=>{
 const backend=memory(),host=createBrowserSettings({backend});await host.load();
 for(const mode of ['merge','replace'])for(const includedAdjustments of [[],['exposure']]){
  await host.save({...settings(),copyPasteSettings:{mode,includedAdjustments,knownAdjustments:['exposure'],autoSync:false}});
  const restored=await createBrowserSettings({backend}).load();assert.equal(restored.copyPasteSettings.mode,mode);assert.deepEqual(restored.copyPasteSettings.includedAdjustments,includedAdjustments);assert.equal(restored.exportPresets[0].name,preset.name);
 }
});
test('malformed/automatic/bulk-effect preference shapes refuse before commit and leave legacy settings readable',async()=>{
 const backend=memory(),host=createBrowserSettings({backend});await host.load();const valid={mode:'merge',includedAdjustments:['exposure'],knownAdjustments:['exposure'],autoSync:false};
 for(const copyPasteSettings of [null,[],{...valid,autoSync:true},{...valid,mode:'anything'},{...valid,includedAdjustments:['contrast']},{...valid,includedAdjustments:['exposure','exposure']},{...valid,knownAdjustments:['private/path']},{...valid,extra:'unknown'},{...valid,includedAdjustments:null}])await assert.rejects(host.save({...settings(),copyPasteSettings}));
 assert.equal(await backend.read(),null);assert.equal(host.status().uncertain,false);await host.save(settings());assert.deepEqual((await createBrowserSettings({backend}).load()).copyPasteSettings,{autoSync:false});
});
