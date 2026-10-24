// Stages exact trusted native source without modifying upstream or its modules.
import {readFile,writeFile,cp,mkdir,readdir,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const [upstream,destination,wasmDir,variant]=process.argv.slice(2);
const presetVariant=variant==='presets'||variant==='preset-import';
const exportVariant=variant==='export'||variant==='settings';
if(variant&&!exportVariant&&!presetVariant)throw Error('Unknown proof variant');
if(!upstream||!destination||!wasmDir)throw Error('NATIVE_SOURCE NEW_STAGE WASM_DIR');
const root=path.resolve(import.meta.dirname,'..'),dest=path.resolve(destination);
const run=(cmd,args,cwd=dest)=>{const r=spawnSync(cmd,args,{cwd,stdio:'inherit',env:process.env});if(r.status!==0)throw Error(`${cmd} failed`);};
const pin=spawnSync('git',['rev-parse','HEAD'],{cwd:upstream,encoding:'utf8'}).stdout.trim();
if(spawnSync('git',['diff','--quiet','HEAD','--','src','package.json','package-lock.json','public'],{cwd:upstream}).status!==0)throw Error('Native source has uncommitted changes');
if(pin!=='b39884b38d8f148caef6fd0d52afd264951be329')throw Error('Original native source pin mismatch');
await mkdir(dest,{recursive:true});if((await readdir(dest)).length)throw Error('Stage must be empty');
for(const name of ['src','public','package.json','package-lock.json','tsconfig.json','LICENSE'])await cp(path.join(upstream,name),path.join(dest,name),{recursive:true});
for(const name of ['core.js','main.tsx','unavailable-native.js'])await cp(path.join(root,'experiments/rapidraw-react-proof',name),path.join(dest,name));
if(exportVariant||presetVariant){for(const name of ['event.js','dialog.js'])await cp(path.join(root,'experiments/rapidraw-react-proof',name),path.join(dest,name));await cp(path.join(root,'experiments/rapidraw-react-proof/export-main.tsx'),path.join(dest,'main.tsx'));}
await writeFile(path.join(dest,'index.html'),'<!doctype html><html><head><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(dest,'vite.config.mjs'),`import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import tailwindcss from '@tailwindcss/vite';export default defineConfig({plugins:[tailwindcss(),react()],resolve:{alias:{'@tauri-apps/api/core':new URL('./core.js',import.meta.url).pathname,${(exportVariant||presetVariant)?"'@tauri-apps/api/event':new URL('./event.js',import.meta.url).pathname,'@tauri-apps/plugin-dialog':new URL('./dialog.js',import.meta.url).pathname,":''}'tauri-plugin-clerk':new URL('./unavailable-native.js',import.meta.url).pathname}},build:{target:'esnext',minify:false,rollupOptions:{external:id=>id.startsWith('/engine/')}},});`);
const coreMeta=JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8'));
if(variant==='settings'){
 for(const patch of [coreMeta.settingsUi.sourcePatch,coreMeta.settingsUi.lastUsedPatch]){
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Settings ACK patch differs');
 for(const [name,expected]of Object.entries({...coreMeta.settingsUi.sourceFiles,...coreMeta.settingsUi.nativeContract,...coreMeta.settingsUi.lastUsedPatch.nativeContract}))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==expected)throw Error('Native settings contract differs: '+name);
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,expected]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==expected)throw Error('Applied settings ACK patch differs');
 }
 await cp(path.join(root,'experiments/rapidraw-react-proof/export-main.tsx'),path.join(dest,'export-main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/settings-main.tsx'),path.join(dest,'main.tsx'));
}

if(presetVariant){
 await cp(path.join(root,'experiments/rapidraw-react-proof/presets-main.tsx'),path.join(dest,'main.tsx'));
 for(const [name,expected]of Object.entries(coreMeta.presetFiles.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==expected)throw Error('Original preset file contract differs: '+name);
}
if(variant==='preset-import'){
 await cp(path.join(root,'experiments/rapidraw-react-proof/presets-main.tsx'),path.join(dest,'presets-main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/preset-import-main.tsx'),path.join(dest,'main.tsx'));
 await writeFile(path.join(dest,'dialog.js'),`export function save(o){return globalThis.rapidRawTransport.pickExport(o);}
export function open(){return globalThis.rapidRawTransport.pickPresets();}
`);
}
const qualityTimer=JSON.parse(await readFile(path.join(wasmDir,'quality-timer-compat.json'),'utf8'));
if(qualityTimer.decoderSource!==coreMeta.decoder.commit||JSON.stringify(qualityTimer.patch)!==JSON.stringify(coreMeta.qualityTimerPatch))throw Error('Quality timer provenance mismatch');
const wasmSha256=createHash('sha256').update(await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe_bg.wasm'))).digest('hex');
const engine=path.join(dest,'public/engine');await mkdir(engine,{recursive:true});
for(const name of ['cw_rapidraw_wasm_probe.js','cw_rapidraw_wasm_probe_bg.wasm'])await cp(path.join(wasmDir,name),path.join(engine,name));
for(const name of ['worker.js','react-image-worker.js','decoder-client.js','webgpu-renderer.js','react-transport.js','shader.wgsl'])await cp(path.join(root,'experiments/rapidraw-wasm-core',name),path.join(engine,name));
if(variant==='preset-import')await cp(path.join(root,'experiments/rapidraw-wasm-core/preset-library.js'),path.join(engine,'preset-library.js'));
if(presetVariant)for(const name of ['preset-file.js','export-destination.js'])await cp(path.join(root,'experiments/rapidraw-wasm-core',name),path.join(engine,name));
if(variant==='settings')await cp(path.join(root,'experiments/rapidraw-wasm-core/settings-storage.js'),path.join(engine,'settings-storage.js'));
if(exportVariant){
 for(const name of ['export-destination.js','export-bridge.js','export-client.js','export-worker.js'])await cp(path.join(root,'experiments/rapidraw-wasm-core',name),path.join(engine,name));
 await cp(path.join(upstream,'src/utils/defaultAdjustments.json'),path.join(engine,'defaultAdjustments.json'));
 for(const [name,expected] of Object.entries(coreMeta.exportUi.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==expected)throw Error('Pinned original export source differs: '+name);
}
const sources={};for(const name of ['src/hooks/useImageLoader.ts','src/hooks/useImageProcessing.ts','src/hooks/useEditorActions.ts','src/components/panel/Editor.tsx','src/components/panel/editor/ImageCanvas.tsx','src/components/adjustments/Basic.tsx','src/components/ui/Slider.tsx','src/store/useEditorStore.ts','src/utils/defaultAdjustments.json','package-lock.json','src/utils/themes.ts','src/hooks/useAppInitialization.ts','src/components/panel/right/CropPanel.tsx','src/context/ContextMenuContext.tsx','src/utils/cropUtils.ts','src/components/panel/PanelSwitcher.tsx','src/App.tsx'])sources[name]=createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex');
const expected=coreMeta.reactUi.sourceFiles;
if(JSON.stringify(sources)!==JSON.stringify(expected))throw Error('Pinned original React source hashes differ');
const runtimeSha256={};for(const name of ['react-image-worker.js','react-transport.js',...(variant==='preset-import'?['preset-library.js']:[]),...(presetVariant?['preset-file.js','export-destination.js']:[]),...(variant==='settings'?['settings-storage.js']:[]),...(exportVariant?['export-destination.js','export-bridge.js','export-client.js','export-worker.js']:[])])runtimeSha256[name]=createHash('sha256').update(await readFile(path.join(engine,name))).digest('hex');
await writeFile(path.join(dest,'source-proof.json'),JSON.stringify({nativeSource:pin,presetFiles:presetVariant?coreMeta.presetFiles:undefined,presetLibrary:variant==='preset-import'?coreMeta.presetLibrary:undefined,settingsUi:variant==='settings'?coreMeta.settingsUi:undefined,exportUi:exportVariant?coreMeta.exportUi:undefined,license:'AGPL-3.0-only',sourceFiles:sources,runtimeSha256,wasmSha256,qualityTimerCompatibility:qualityTimer,previewResize:coreMeta.previewResize,interactivePreview:coreMeta.interactivePreview,orientationFlip:coreMeta.orientationFlip,cropPreview:coreMeta.cropPreview,uncroppedPreview:coreMeta.uncroppedPreview,fineRotation:coreMeta.fineRotation,fineInteractive:coreMeta.fineInteractive,scope:variant==='preset-import'?coreMeta.presetLibrary.scope:presetVariant?coreMeta.presetFiles.scope:variant==='settings'?coreMeta.settingsUi.scope:exportVariant?coreMeta.exportUi.scope:'Unchanged original hooks/stores/Editor/Basic/Slider in QA composition. Core invoke aliased; native Clerk explicitly unavailable; no full App/menu/provider acceptance.'},null,2)+'\n');
if(process.env.RAPIDRAW_REACT_DEPENDENCY_STAGE){
 const cached=path.resolve(process.env.RAPIDRAW_REACT_DEPENDENCY_STAGE);
 if(!Buffer.from(await readFile(path.join(cached,'package-lock.json'))).equals(await readFile(path.join(dest,'package-lock.json'))))throw Error('Cached dependency lock differs');
 await symlink(path.join(cached,'node_modules'),path.join(dest,'node_modules'),'dir');
}else run('npm',['ci','--ignore-scripts','--prefer-offline','--no-audit','--no-fund']);run('node',['node_modules/vite/bin/vite.js','build']);
console.log(JSON.stringify({built:true,stage:dest}));
