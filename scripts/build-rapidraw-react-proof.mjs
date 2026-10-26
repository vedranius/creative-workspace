// Stages exact trusted native source without modifying upstream or its modules.
import {readFile,writeFile,cp,mkdir,readdir,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const [upstream,destination,wasmDir,variant]=process.argv.slice(2);
const appPresetRecoveryVariant=variant==='app-preset-recovery',appPresetExportVariant=variant==='app-preset-export'||appPresetRecoveryVariant,appPresetConfigureVariant=variant==='app-preset-configure'||appPresetExportVariant,appPresetCreateVariant=variant==='app-preset-create'||appPresetConfigureVariant,appPresetsVariant=variant==='app-presets'||appPresetCreateVariant,appCopyPasteVariant=variant==='app-copy-paste'||appPresetsVariant,appDiscardVariant=variant==='app-recovery-discard'||appCopyPasteVariant,appRecoveryVariant=variant==='app-recovery'||appDiscardVariant,appExportVariant=variant==='app-export'||appRecoveryVariant,appFileVariant=variant==='app-file'||appExportVariant,appRootVariant=variant==='app-root'||appFileVariant,readinessVariant=variant==='settings-readiness'||appRootVariant,initializationVariant=variant==='settings-initialization'||readinessVariant,copyPasteSettingsVariant=variant==='copy-paste-settings'||initializationVariant,copyPasteVariant=variant==='metadata-copy-paste'||copyPasteSettingsVariant,filmstripVariant=variant==='metadata-filmstrip'||copyPasteVariant,selectionVariant=variant==='metadata-selection'||filmstripVariant,libraryVariant=variant==='metadata-library'||selectionVariant,navigationVariant=variant==='metadata-navigation'||libraryVariant,lifecycleVariant=variant==='metadata-lifecycle'||navigationVariant,metadataVariant=variant==='metadata'||lifecycleVariant;
const configureVariant=variant==='preset-configure',createVariant=variant==='preset-create'||configureVariant,applyVariant=variant==='preset-apply'||createVariant;
const presetVariant=variant==='presets'||variant==='preset-import'||applyVariant;
const exportVariant=metadataVariant||variant==='export'||variant==='settings'||applyVariant;
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
if(appRootVariant)await cp(path.join(root,'experiments/rapidraw-react-proof/app-root-native.js'),path.join(dest,'app-root-native.js'));
await writeFile(path.join(dest,'index.html'),'<!doctype html><html><head><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(dest,'vite.config.mjs'),`import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import tailwindcss from '@tailwindcss/vite';export default defineConfig({plugins:[tailwindcss(),react()],resolve:{alias:{'@tauri-apps/api/core':new URL('./core.js',import.meta.url).pathname,${(exportVariant||presetVariant)?"'@tauri-apps/api/event':new URL('./event.js',import.meta.url).pathname,'@tauri-apps/plugin-dialog':new URL('./dialog.js',import.meta.url).pathname,":''}${appRootVariant?"'@tauri-apps/plugin-shell':new URL('./app-root-native.js',import.meta.url).pathname,":''}'tauri-plugin-clerk':new URL('./unavailable-native.js',import.meta.url).pathname}},build:{target:'esnext',minify:false,rollupOptions:{external:id=>id.startsWith('/engine/')}},});`);
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

if(metadataVariant){
 await cp(path.join(root,'experiments/rapidraw-react-proof/export-main.tsx'),path.join(dest,'export-main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-main.tsx'),path.join(dest,'main.tsx'));
 for(const [name,sha]of Object.entries(coreMeta.metadataUi.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original metadata contract differs: '+name);
}
if(lifecycleVariant){
 const contract=coreMeta.metadataLifecycle,patch=contract.sourcePatch;
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Metadata lifecycle source differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Metadata ACK patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Applied metadata ACK source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-main.tsx'),path.join(dest,'metadata-main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-lifecycle-main.tsx'),path.join(dest,'main.tsx'));
}
if(navigationVariant){
 const contract=coreMeta.metadataNavigation,patch=contract.sourcePatch;
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Metadata navigation source differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Metadata navigation ACK patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Applied navigation source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-lifecycle-main.tsx'),path.join(dest,'metadata-lifecycle-main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-navigation-main.tsx'),path.join(dest,'main.tsx'));
}
if(libraryVariant){
 const contract=coreMeta.metadataLibrary,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.metadataNavigation.sourcePatch))throw Error('Library navigation base patch differs');
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Library source differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Library navigation patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Applied library navigation source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-navigation-main.tsx'),path.join(dest,'metadata-navigation-main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-library-main.tsx'),path.join(dest,'main.tsx'));
}
if(selectionVariant){
 const contract=coreMeta.metadataSelection,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.metadataLibrary.sourcePatch))throw Error('Selection library base patch differs');
 for(const [name,sha]of Object.entries({...contract.sourceFiles,...contract.nativeContract}))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original selection source differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Selection ACK patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Applied selection source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-selection-main.tsx'),path.join(dest,'main.tsx'));
}
if(filmstripVariant){
 const contract=coreMeta.metadataFilmstrip,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.metadataSelection.sourcePatch))throw Error('Filmstrip selection base patch differs');
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original filmstrip source differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Filmstrip ACK patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Applied filmstrip source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-filmstrip-main.tsx'),path.join(dest,'main.tsx'));
}
if(copyPasteVariant){
 const contract=coreMeta.metadataCopyPaste,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.metadataFilmstrip.sourcePatch))throw Error('Copy/paste filmstrip base patch differs');
 for(const [name,sha]of Object.entries({...contract.sourceFiles,...contract.nativeContract}))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original copy/paste source differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Copy/paste ACK patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Applied copy/paste source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-copy-paste-main.tsx'),path.join(dest,'main.tsx'));
}
if(copyPasteSettingsVariant){
 const contract=coreMeta.copyPasteSettings;
 if(JSON.stringify(contract.baseSettingsPatch)!==JSON.stringify(coreMeta.settingsUi.sourcePatch)||JSON.stringify(contract.baseMetadataPatch)!==JSON.stringify(coreMeta.metadataCopyPaste.sourcePatch))throw Error('Copy/paste settings base patches differ');
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original preference source differs: '+name);
 for(const patch of [contract.baseSettingsPatch,contract.sourcePatch]){
  if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Copy/paste settings patch differs');
  run('git',['apply',path.join(root,patch.path)]);
  for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Applied preference source differs: '+name);
 }
 await cp(path.join(root,'experiments/rapidraw-react-proof/metadata-copy-paste-main.tsx'),path.join(dest,'metadata-copy-paste-main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/copy-paste-settings-main.tsx'),path.join(dest,'main.tsx'));
}
if(initializationVariant){
 const contract=coreMeta.settingsInitialization,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.copyPasteSettings.sourcePatch))throw Error('Initialization base patch differs');
 for(const [name,sha]of Object.entries({...contract.sourceFiles,...contract.nativeContract}))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original initialization contract differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Initialization source patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Patched initialization source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/settings-initialization-main.tsx'),path.join(dest,'main.tsx'));
}
if(readinessVariant){
 const contract=coreMeta.settingsReadiness,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.settingsInitialization.sourcePatch))throw Error('Readiness initialization base patch differs');
 for(const [name,sha]of Object.entries({...contract.sourceFiles,...contract.nativeContract}))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original readiness contract differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Readiness source patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Patched readiness source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/settings-readiness-main.tsx'),path.join(dest,'main.tsx'));
}
if(appRootVariant){
 const contract=coreMeta.appRoot,patch=contract.sourcePatch;
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('App root bootstrap differs: '+name);
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.settingsReadiness.sourcePatch))throw Error('App root readiness base patch differs');
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original App root source differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('App root source patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Patched App root source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-root-main.tsx'),path.join(dest,'main.tsx'));
}
if(appFileVariant){
 const contract=coreMeta.appFile,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appRoot.sourcePatch))throw Error('App File base differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('App File bootstrap differs');
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('App File original source differs');
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('App File patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('App File patched source differs');
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-file-main.tsx'),path.join(dest,'main.tsx'));
}
if(appExportVariant){
 const contract=coreMeta.appExport;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appFile.sourcePatch)||JSON.stringify(contract.lastUsedPatch)!==JSON.stringify(coreMeta.settingsUi.lastUsedPatch))throw Error('App export base differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('App export bootstrap differs');
 for(const [name,sha]of Object.entries({...contract.sourceFiles,...contract.lastUsedPatch.nativeContract}))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('App export original source differs');
 for(const patch of [contract.lastUsedPatch,contract.sourcePatch]){
  if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('App export patch differs');
  run('git',['apply',path.join(root,patch.path)]);
  for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('App export patched source differs');
 }
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-export-main.tsx'),path.join(dest,'main.tsx'));
}
if(appRecoveryVariant){
 const contract=coreMeta.appRecovery,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appExport.sourcePatch))throw Error('App recovery base differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('App recovery bootstrap differs');
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('App recovery original differs');
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('App recovery patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('App recovery patched source differs');
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-recovery-main.tsx'),path.join(dest,'main.tsx'));
 await mkdir(path.join(dest,'src/browser'),{recursive:true});
 await cp(path.join(root,'experiments/rapidraw-react-proof/RecoveryPanel.tsx'),path.join(dest,'src/browser/RecoveryPanel.tsx'));
}
if(appDiscardVariant){
 const contract=coreMeta.appRecoveryDiscard;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appRecovery.sourcePatch))throw Error('Recovery discard base differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('Recovery discard bootstrap differs');
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-recovery-discard-main.tsx'),path.join(dest,'main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/DiscardRecoveryPanel.tsx'),path.join(dest,'src/browser/RecoveryPanel.tsx'));
}
if(appCopyPasteVariant){
 const contract=coreMeta.appCopyPaste,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appRecoveryDiscard.sourcePatch))throw Error('App Copy/Paste base differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('App Copy/Paste bootstrap differs');
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('App Copy/Paste patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('App Copy/Paste patched source differs');
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-copy-paste-main.tsx'),path.join(dest,'main.tsx'));
}
if(appPresetsVariant){
 const contract=coreMeta.appPresets;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appCopyPaste.sourcePatch))throw Error('App presets base differs');
 const patch=contract.sourcePatch;
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original preset source differs');
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('App preset patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('App preset patched source differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('App presets bootstrap differs');
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-presets-main.tsx'),path.join(dest,'main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-presets-dialog.js'),path.join(dest,'dialog.js'));
}
if(appPresetCreateVariant){
 const contract=coreMeta.appPresetCreate,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appPresets.sourcePatch)||JSON.stringify(patch)!==JSON.stringify(coreMeta.presetCreate.sourcePatch))throw Error('App preset Create base differs');
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original create source differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('App preset Create bootstrap differs');
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('App preset Create patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('App preset Create patched source differs');
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-preset-create-main.tsx'),path.join(dest,'main.tsx'));
}
if(appPresetConfigureVariant){
 const contract=coreMeta.appPresetConfigure,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appPresetCreate.sourcePatch)||JSON.stringify(patch)!==JSON.stringify(coreMeta.presetConfigure.sourcePatch))throw Error('App preset Configure base differs');
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Original configure source differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('App preset Configure bootstrap differs');
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('App preset Configure patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('App preset Configure patched source differs');
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-preset-configure-main.tsx'),path.join(dest,'main.tsx'));
}
if(appPresetExportVariant){
 const contract=coreMeta.appPresetExport;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appPresetConfigure.sourcePatch))throw Error('App preset export base differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('App preset export bootstrap differs');
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-preset-export-main.tsx'),path.join(dest,'main.tsx'));
}
if(appPresetRecoveryVariant){
 const contract=coreMeta.appPresetRecovery;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.appPresetConfigure.sourcePatch))throw Error('Preset recovery base differs');
 for(const [name,sha]of Object.entries(contract.bootstrapFiles))if(createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')!==sha)throw Error('Preset recovery bootstrap differs');
 await cp(path.join(root,'experiments/rapidraw-react-proof/app-preset-recovery-main.tsx'),path.join(dest,'main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/PresetRecoveryPanel.tsx'),path.join(dest,'src/browser/PresetRecoveryPanel.tsx'));
}
if(presetVariant){
 await cp(path.join(root,'experiments/rapidraw-react-proof/presets-main.tsx'),path.join(dest,'main.tsx'));
 for(const [name,expected]of Object.entries(coreMeta.presetFiles.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==expected)throw Error('Original preset file contract differs: '+name);
}
if(applyVariant)for(const [name,expected]of Object.entries(coreMeta.presetApply.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==expected)throw Error('Native preset preview contract differs: '+name);
if(variant==='preset-import'||applyVariant){
 await cp(path.join(root,'experiments/rapidraw-react-proof/presets-main.tsx'),path.join(dest,'presets-main.tsx'));
 await cp(path.join(root,'experiments/rapidraw-react-proof/'+(configureVariant?'preset-configure-main.tsx':createVariant?'preset-create-main.tsx':applyVariant?'preset-apply-main.tsx':'preset-import-main.tsx')),path.join(dest,'main.tsx'));
 if(applyVariant)await cp(path.join(root,'experiments/rapidraw-react-proof/export-main.tsx'),path.join(dest,'export-main.tsx'));
 await writeFile(path.join(dest,'dialog.js'),`export function save(o){return globalThis.rapidRawTransport.pickExport(o);}
export function open(o){return globalThis.rapidRawTransport.pickPresets(o);}
`);
}
if(createVariant){
 const contract=coreMeta.presetCreate,patch=contract.sourcePatch;
 for(const [name,sha]of Object.entries(contract.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==sha)throw Error('Preset create source differs: '+name);
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Preset create ACK patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Applied preset ACK source differs: '+name);
 await cp(path.join(root,'experiments/rapidraw-react-proof/preset-apply-main.tsx'),path.join(dest,'preset-apply-main.tsx'));
}
if(configureVariant){
 const contract=coreMeta.presetConfigure,patch=contract.sourcePatch;
 if(JSON.stringify(contract.basePatch)!==JSON.stringify(coreMeta.presetCreate.sourcePatch))throw Error('Preset configuration base ACK patch differs');
 if(createHash('sha256').update(await readFile(path.join(root,patch.path))).digest('hex')!==patch.sha256)throw Error('Preset configure ACK patch differs');
 run('git',['apply',path.join(root,patch.path)]);
 for(const [name,sha]of Object.entries(patch.patchedFiles))if(createHash('sha256').update(await readFile(path.join(dest,name))).digest('hex')!==sha)throw Error('Applied preset configure source differs: '+name);
}
const qualityTimer=JSON.parse(await readFile(path.join(wasmDir,'quality-timer-compat.json'),'utf8'));
if(qualityTimer.decoderSource!==coreMeta.decoder.commit||JSON.stringify(qualityTimer.patch)!==JSON.stringify(coreMeta.qualityTimerPatch))throw Error('Quality timer provenance mismatch');
const wasmSha256=createHash('sha256').update(await readFile(path.join(wasmDir,'cw_rapidraw_wasm_probe_bg.wasm'))).digest('hex');
const engine=path.join(dest,'public/engine');await mkdir(engine,{recursive:true});
for(const name of ['cw_rapidraw_wasm_probe.js','cw_rapidraw_wasm_probe_bg.wasm'])await cp(path.join(wasmDir,name),path.join(engine,name));
for(const name of ['worker.js','react-image-worker.js','decoder-client.js','webgpu-renderer.js','react-transport.js','shader.wgsl'])await cp(path.join(root,'experiments/rapidraw-wasm-core',name),path.join(engine,name));
if(variant==='preset-import'||applyVariant)await cp(path.join(root,'experiments/rapidraw-wasm-core/preset-library.js'),path.join(engine,'preset-library.js'));
if(presetVariant)for(const name of ['preset-file.js','export-destination.js'])await cp(path.join(root,'experiments/rapidraw-wasm-core',name),path.join(engine,name));
if(metadataVariant)await cp(path.join(root,'experiments/rapidraw-wasm-core/metadata-storage.js'),path.join(engine,'metadata-storage.js'));
if(variant==='settings'||copyPasteSettingsVariant)await cp(path.join(root,'experiments/rapidraw-wasm-core/settings-storage.js'),path.join(engine,'settings-storage.js'));
if(exportVariant){
 for(const name of ['export-destination.js','export-bridge.js','export-client.js','export-worker.js'])await cp(path.join(root,'experiments/rapidraw-wasm-core',name),path.join(engine,name));
 await cp(path.join(upstream,'src/utils/defaultAdjustments.json'),path.join(engine,'defaultAdjustments.json'));
 for(const [name,expected] of Object.entries(coreMeta.exportUi.sourceFiles))if(createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex')!==expected)throw Error('Pinned original export source differs: '+name);
}
if(appPresetsVariant)for(const name of ['preset-library.js','preset-file.js'])await cp(path.join(root,'experiments/rapidraw-wasm-core',name),path.join(engine,name));
const sources={};for(const name of ['src/hooks/useImageLoader.ts','src/hooks/useImageProcessing.ts','src/hooks/useEditorActions.ts','src/components/panel/Editor.tsx','src/components/panel/editor/ImageCanvas.tsx','src/components/adjustments/Basic.tsx','src/components/ui/Slider.tsx','src/store/useEditorStore.ts','src/utils/defaultAdjustments.json','package-lock.json','src/utils/themes.ts','src/hooks/useAppInitialization.ts','src/components/panel/right/CropPanel.tsx','src/context/ContextMenuContext.tsx','src/utils/cropUtils.ts','src/components/panel/PanelSwitcher.tsx','src/App.tsx'])sources[name]=createHash('sha256').update(await readFile(path.join(upstream,name))).digest('hex');
const expected=coreMeta.reactUi.sourceFiles;
if(JSON.stringify(sources)!==JSON.stringify(expected))throw Error('Pinned original React source hashes differ');
if(appRecoveryVariant)await cp(path.join(root,'experiments/rapidraw-wasm-core/export-recovery.js'),path.join(engine,'export-recovery.js'));
if(appPresetRecoveryVariant)await cp(path.join(root,'experiments/rapidraw-wasm-core/preset-recovery.js'),path.join(engine,'preset-recovery.js'));
if(appPresetExportVariant)await cp(path.join(root,'experiments/rapidraw-wasm-core/selected-preset-export.js'),path.join(engine,'selected-preset-export.js'));
const runtimeSha256={};for(const name of ['react-image-worker.js','react-transport.js',...(appPresetRecoveryVariant?['preset-recovery.js']:[]),...(appPresetExportVariant?['selected-preset-export.js']:[]),...(appRecoveryVariant?['export-recovery.js']:[]),...(appPresetsVariant?['preset-library.js','preset-file.js']:[]),...(metadataVariant?['metadata-storage.js']:[]),...((variant==='preset-import'||applyVariant)?['preset-library.js']:[]),...(presetVariant?['preset-file.js','export-destination.js']:[]),...((variant==='settings'||copyPasteSettingsVariant)?['settings-storage.js']:[]),...(exportVariant?['export-destination.js','export-bridge.js','export-client.js','export-worker.js']:[])])runtimeSha256[name]=createHash('sha256').update(await readFile(path.join(engine,name))).digest('hex');
await writeFile(path.join(dest,'source-proof.json'),JSON.stringify({nativeSource:pin,appPresetRecovery:appPresetRecoveryVariant?coreMeta.appPresetRecovery:undefined,appPresetExport:appPresetExportVariant?coreMeta.appPresetExport:undefined,appPresetConfigure:appPresetConfigureVariant?coreMeta.appPresetConfigure:undefined,appPresetCreate:appPresetCreateVariant?coreMeta.appPresetCreate:undefined,appPresets:appPresetsVariant?coreMeta.appPresets:undefined,appCopyPaste:appCopyPasteVariant?coreMeta.appCopyPaste:undefined,appRecoveryDiscard:appDiscardVariant?coreMeta.appRecoveryDiscard:undefined,appRecovery:appRecoveryVariant?coreMeta.appRecovery:undefined,appExport:appExportVariant?coreMeta.appExport:undefined,appFile:appFileVariant?coreMeta.appFile:undefined,appRoot:appRootVariant?coreMeta.appRoot:undefined,settingsReadiness:readinessVariant?coreMeta.settingsReadiness:undefined,settingsInitialization:initializationVariant?coreMeta.settingsInitialization:undefined,copyPasteSettings:copyPasteSettingsVariant?coreMeta.copyPasteSettings:undefined,metadataCopyPaste:copyPasteVariant?coreMeta.metadataCopyPaste:undefined,metadataFilmstrip:filmstripVariant?coreMeta.metadataFilmstrip:undefined,metadataSelection:selectionVariant?coreMeta.metadataSelection:undefined,metadataLibrary:libraryVariant?coreMeta.metadataLibrary:undefined,metadataNavigation:navigationVariant?coreMeta.metadataNavigation:undefined,metadataLifecycle:lifecycleVariant?coreMeta.metadataLifecycle:undefined,metadataUi:metadataVariant?coreMeta.metadataUi:undefined,presetFiles:presetVariant?coreMeta.presetFiles:undefined,presetApply:applyVariant?coreMeta.presetApply:undefined,presetCreate:createVariant?coreMeta.presetCreate:undefined,presetConfigure:configureVariant?coreMeta.presetConfigure:undefined,presetLibrary:(variant==='preset-import'||applyVariant)?coreMeta.presetLibrary:undefined,settingsUi:variant==='settings'?coreMeta.settingsUi:undefined,exportUi:exportVariant?coreMeta.exportUi:undefined,license:'AGPL-3.0-only',sourceFiles:sources,runtimeSha256,wasmSha256,qualityTimerCompatibility:qualityTimer,previewResize:coreMeta.previewResize,interactivePreview:coreMeta.interactivePreview,orientationFlip:coreMeta.orientationFlip,cropPreview:coreMeta.cropPreview,uncroppedPreview:coreMeta.uncroppedPreview,fineRotation:coreMeta.fineRotation,fineInteractive:coreMeta.fineInteractive,scope:appPresetRecoveryVariant?coreMeta.appPresetRecovery.scope:appPresetExportVariant?coreMeta.appPresetExport.scope:appPresetConfigureVariant?coreMeta.appPresetConfigure.scope:appPresetCreateVariant?coreMeta.appPresetCreate.scope:appPresetsVariant?coreMeta.appPresets.scope:appCopyPasteVariant?coreMeta.appCopyPaste.scope:appDiscardVariant?coreMeta.appRecoveryDiscard.scope:appRecoveryVariant?coreMeta.appRecovery.scope:appExportVariant?coreMeta.appExport.scope:appFileVariant?coreMeta.appFile.scope:appRootVariant?coreMeta.appRoot.scope:readinessVariant?coreMeta.settingsReadiness.scope:initializationVariant?coreMeta.settingsInitialization.scope:copyPasteSettingsVariant?coreMeta.copyPasteSettings.scope:copyPasteVariant?coreMeta.metadataCopyPaste.scope:filmstripVariant?coreMeta.metadataFilmstrip.scope:selectionVariant?coreMeta.metadataSelection.scope:libraryVariant?coreMeta.metadataLibrary.scope:navigationVariant?coreMeta.metadataNavigation.scope:lifecycleVariant?coreMeta.metadataLifecycle.scope:metadataVariant?coreMeta.metadataUi.scope:configureVariant?coreMeta.presetConfigure.scope:createVariant?coreMeta.presetCreate.scope:applyVariant?coreMeta.presetApply.scope:variant==='preset-import'?coreMeta.presetLibrary.scope:presetVariant?coreMeta.presetFiles.scope:variant==='settings'?coreMeta.settingsUi.scope:exportVariant?coreMeta.exportUi.scope:'Unchanged original hooks/stores/Editor/Basic/Slider in QA composition. Core invoke aliased; native Clerk explicitly unavailable; no full App/menu/provider acceptance.'},null,2)+'\n');
if(process.env.RAPIDRAW_REACT_DEPENDENCY_STAGE){
 const cached=path.resolve(process.env.RAPIDRAW_REACT_DEPENDENCY_STAGE);
 if(!Buffer.from(await readFile(path.join(cached,'package-lock.json'))).equals(await readFile(path.join(dest,'package-lock.json'))))throw Error('Cached dependency lock differs');
 await symlink(path.join(cached,'node_modules'),path.join(dest,'node_modules'),'dir');
}else run('npm',['ci','--ignore-scripts','--prefer-offline','--no-audit','--no-fund']);run('node',['node_modules/vite/bin/vite.js','build']);
console.log(JSON.stringify({built:true,stage:dest}));
