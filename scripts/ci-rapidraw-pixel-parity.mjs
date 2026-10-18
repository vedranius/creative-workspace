// Reproduce the public CC0 Canon fixture's native/Quality/Speed pixel proof.
// All downloaded and compiled inputs stay in a temporary directory; only JSON
// evidence and the license/provenance record are written to the requested output.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=JSON.parse(await readFile(path.join(root,'docs/evidence/rapidraw-wasm/runtime-smoke.json'),'utf8'));
const fixture=evidence.fixtures.find(item=>item.id==='raw.pixls.us 1327');
assert.ok(fixture&&fixture.license==='CC0-1.0','Pinned public CC0 fixture metadata missing');
const output=path.resolve(process.argv[2]||'artifacts/rapidraw-pixel-parity');
const temp=await import('node:fs/promises').then(fs=>fs.mkdtemp(path.join(os.tmpdir(),'cw-rapidraw-parity-')));
await mkdir(output,{recursive:true});
const targetDir=path.resolve(process.env.CARGO_TARGET_DIR||path.join(temp,'target'));
function run(command,args,options={}){return new Promise((resolve,reject)=>{
 const child=spawn(command,args,{cwd:options.cwd||root,env:{...process.env,CARGO_TARGET_DIR:targetDir,...options.env},stdio:['ignore','pipe','inherit']});let stdout='';
 child.stdout.on('data',chunk=>stdout+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve(stdout.trim()):reject(Error(`${command} ${args.join(' ')} exited ${code}`)));
});}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 const input=path.join(temp,'fixture.dng');
 const response=await fetch(fixture.sourceUrl,{redirect:'error'});assert.equal(response.status,200,`Fixture download HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(digest(bytes),fixture.sourceSha256,'Public fixture SHA256 mismatch');await writeFile(input,bytes);
 await run('cargo',['test','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml']);
 const uiExposureReference=JSON.parse(await run('cargo',['run','--locked','--release','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','ui_exposure_reference']));
 const exposureReference=JSON.parse(await run('cargo',['run','--locked','--release','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','exposure_pixels_reference']));
 const stage=path.join(temp,'quality-stage');
 await run('node',['scripts/prepare-rapidraw-quality.mjs',stage]);
 await copyFile(path.join(root,'patches/rapidraw-rawler/a32bc1ff/ppg-wasm-profiling.patch'),path.join(output,'ppg-wasm-profiling.patch'));
 await copyFile(path.join(root,'experiments/rapidraw-wasm-core/tests/reference/RapidRAW-LICENSE'),path.join(output,'RapidRAW-LICENSE'));
 const crate=path.join(stage,'probe'),wasmOut=path.join(temp,'wasm');await mkdir(wasmOut);
 const native={},probe={},pngs={};
 const nativeRgb=path.join(temp,"speed-native-rgb.f32"),nativeQualityRgb=path.join(temp,"quality-native-rgb.f32");
 for(const [mode,flag] of [['quality','quality'],['speed','fast']]){
  pngs[mode]=path.join(temp,`${mode}-native.png`);
  native[mode]=JSON.parse(await run('cargo',['run','--locked','--release','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','develop_reference','--',input,flag,pngs[mode],mode==='speed'?nativeRgb:nativeQualityRgb]));
  probe[mode]=JSON.parse(await run('cargo',['run','--locked','--release','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','develop_probe','--',input,flag==='fast'?'fast':'']));
  assert.equal(probe[mode].componentF32BitsSha256,native[mode].rgbF32BitsSha256,`Native probe differs in ${mode}`);
 }
 await run('cargo',['build','--locked','--release','--target','wasm32-unknown-unknown','--manifest-path',path.join(crate,'Cargo.toml'),'--features','quality-timer-compat']);
 await run('wasm-bindgen',['--target','web','--out-dir',wasmOut,path.join(targetDir,'wasm32-unknown-unknown/release/cw_rapidraw_wasm_probe.wasm')]);
 await copyFile(path.join(stage,'quality-timer-compat.json'),path.join(wasmOut,'quality-timer-compat.json'));
 const reports={};
 for(const mode of ['quality','speed']){
  const report=path.join(output,`${mode}-wasm.json`);
  await run('node',['scripts/smoke-rapidraw-development.mjs',wasmOut,input,
   await writeJson(temp,`${mode}-native.json`,native[mode]),await writeJson(temp,`${mode}-probe.json`,probe[mode]),report,mode==='speed'?'fast':'quality'],
   {env:{PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE||'playwright',CHROMIUM_PATH:process.env.CHROMIUM_PATH||''}});
  reports[mode]=JSON.parse(await readFile(report,'utf8'));
  const pngReport=path.join(output,`${mode}-png-browser.json`);
  await run('node',['scripts/smoke-rapidraw-png.mjs',wasmOut,input,pngs[mode],pngReport,mode==='speed'?'fast':'quality']);
  reports[`${mode}Png`]=JSON.parse(await readFile(pngReport,'utf8'));
 }
 const cameraReport=path.join(output,'camera-exposure-browser.json');
 await run('node',['scripts/smoke-rapidraw-camera-exposure.mjs',wasmOut,input,path.join(targetDir,'release/examples/develop_reference'),cameraReport]);
 reports.cameraExposure=JSON.parse(await readFile(cameraReport,'utf8'));
 const asShotReport=path.join(output,'as-shot-browser.json');
 await run('node',['scripts/smoke-rapidraw-as-shot.mjs',wasmOut,input,path.join(targetDir,'release/examples/develop_reference'),asShotReport]);
 reports.asShot=JSON.parse(await readFile(asShotReport,'utf8'));
 const exposureReport=path.join(output,'exposure-pixels-browser.json');
 await run('node',['scripts/smoke-rapidraw-exposure-pixels.mjs',wasmOut,
  await writeJson(temp,'exposure-pixels-native.json',exposureReference),exposureReport],
  {env:{PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE||'playwright',CHROMIUM_PATH:process.env.CHROMIUM_PATH||''}});
 reports.exposurePixels=JSON.parse(await readFile(exposureReport,'utf8'));
 const uiReference=await writeJson(output,'ui-exposure-native-reference.json',uiExposureReference);
 const uiReport=path.join(output,'ui-exposure-browser.json');
 await run('node',['scripts/smoke-rapidraw-ui-exposure.mjs',wasmOut,uiReference,uiReport]);
 reports.uiExposure=JSON.parse(await readFile(uiReport,'utf8'));
 const webGpuReport=path.join(output,'webgpu-execution.json');
 // Native wgpu uses the same pinned Chromium distribution's software Vulkan
 // driver, only for this child process. Never alter the host driver config.
 assert.ok(process.env.CHROMIUM_PATH,'Explicit test Chromium path is required');
 const icd=path.join(path.dirname(process.env.CHROMIUM_PATH),'vk_swiftshader_icd.json');
 await readFile(icd);
 const nativeRenderManifest='experiments/rapidraw-native-render-reference/Cargo.toml';
 const nativeRendererEnv={VK_DRIVER_FILES:icd,VK_ICD_FILENAMES:icd,LD_LIBRARY_PATH:[path.dirname(process.env.CHROMIUM_PATH),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')};
 await run('cargo',['test','--release','--locked','--manifest-path',nativeRenderManifest]);
 const nativeRender=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path',nativeRenderManifest],
  {env:nativeRendererEnv}));
 assert.equal(nativeRender.adapter.deviceType,'Cpu');
 assert.match(nativeRender.adapter.name,/SwiftShader/);
 const nativeRenderPath=await writeJson(output,'native-shader-reference.json',nativeRender);
 await run('node',['scripts/smoke-rapidraw-webgpu.mjs',wasmOut,webGpuReport,nativeRenderPath]);
 reports.webGpuExecution=JSON.parse(await readFile(webGpuReport,'utf8'));
 const nativeRawRender=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path',nativeRenderManifest,'--','--rgb-f32',nativeRgb,String(native.speed.width),String(native.speed.height)],
  {env:nativeRendererEnv}));
 assert.equal(nativeRawRender.inputF32Sha256,native.speed.rgbF32BitsSha256);
 const nativeRawRenderPath=await writeJson(output,'native-raw-shader-reference.json',nativeRawRender);
 const rawRenderReport=path.join(output,'raw-speed-render.json');
 await run('node',['scripts/smoke-rapidraw-webgpu.mjs',wasmOut,rawRenderReport,nativeRawRenderPath,input]);
 reports.rawSpeedRender=JSON.parse(await readFile(rawRenderReport,'utf8'));
 const nativePngDir=path.join(output,'native-rendered-png');
 const nativePngRender=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path',nativeRenderManifest,'--','--rgb-f32',nativeRgb,String(native.speed.width),String(native.speed.height),'--eight-bit','--png-dir',nativePngDir],{env:nativeRendererEnv}));
 const nativePngRenderPath=await writeJson(output,'native-rendered-png-reference.json',nativePngRender);
 const renderedPngReport=path.join(output,'raw-render-png.json');
 await run('node',['scripts/smoke-rapidraw-webgpu.mjs',wasmOut,renderedPngReport,nativePngRenderPath,input,nativePngDir]);
 reports.renderedPng=JSON.parse(await readFile(renderedPngReport,'utf8'));

 const cameraSettings=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','develop_reference','--',input,'--camera-render']));
 const cameraSettingsPath=await writeJson(output,'native-camera-settings.json',cameraSettings);
 const nativeCameraPngDir=path.join(output,'native-camera-png');
 const nativeCameraRender=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path',nativeRenderManifest,'--','--rgb-f32',nativeRgb,String(native.speed.width),String(native.speed.height),'--eight-bit','--png-dir',nativeCameraPngDir,'--camera-settings',cameraSettingsPath],{env:nativeRendererEnv}));
 const nativeCameraRenderPath=await writeJson(output,'native-camera-render-reference.json',nativeCameraRender);
 const cameraRenderReport=path.join(output,'camera-render-png.json');
 await run('node',['scripts/smoke-rapidraw-webgpu.mjs',wasmOut,cameraRenderReport,nativeCameraRenderPath,input,nativeCameraPngDir]);
 reports.cameraRender=JSON.parse(await readFile(cameraRenderReport,'utf8'));

 const globalSettings=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','develop_reference','--',input,'--global-render']));
 const globalSettingsPath=await writeJson(output,'native-global-settings.json',globalSettings);
 const nativeGlobalPngDir=path.join(output,'native-global-png');
 const nativeGlobalRender=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path',nativeRenderManifest,'--','--rgb-f32',nativeRgb,String(native.speed.width),String(native.speed.height),'--eight-bit','--png-dir',nativeGlobalPngDir,'--camera-settings',globalSettingsPath],{env:nativeRendererEnv}));
 const nativeGlobalRenderPath=await writeJson(output,'native-global-render-reference.json',nativeGlobalRender);
 const globalRenderReport=path.join(output,'global-render-png.json');
 await run('node',['scripts/smoke-rapidraw-webgpu.mjs',wasmOut,globalRenderReport,nativeGlobalRenderPath,input,nativeGlobalPngDir]);
 reports.globalRender=JSON.parse(await readFile(globalRenderReport,'utf8'));
 const nativePreviewDir=path.join(output,'native-preview');
 await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','preview_reference','--',path.join(nativeGlobalPngDir,'frame-0.png'),nativePreviewDir]);
 const previewReport=path.join(output,'preview-browser.json');
 await run('node',['scripts/smoke-rapidraw-preview.mjs',wasmOut,nativePreviewDir,previewReport]);
 reports.preview=JSON.parse(await readFile(previewReport,'utf8'));
 const frontend=path.join(temp,'native-react-source');await mkdir(frontend);
 const noHooks=path.join(temp,'no-native-hooks');await mkdir(noHooks);
 await run('git',['init','--quiet'],{cwd:frontend});
 await run('git',['-c',`core.hooksPath=${noHooks}`,'fetch','--quiet','--depth=1','https://github.com/CyberTimon/RapidRAW.git','b39884b38d8f148caef6fd0d52afd264951be329'],{cwd:frontend});
 await run('git',['-c',`core.hooksPath=${noHooks}`,'checkout','--quiet','--detach','FETCH_HEAD'],{cwd:frontend});
 const reactSettings=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','develop_reference','--',input,'--react-render',path.join(frontend,'src/utils/defaultAdjustments.json')]));
 const reactSettingsPath=await writeJson(output,'native-react-settings.json',reactSettings),nativeReactPng=path.join(output,'native-react-png');
 const nativeReactRgb=path.join(temp,'quality-react-preview.f32');
 const nativeResize=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','preview_resize_reference','--',nativeQualityRgb,'2048','1536','512',nativeReactRgb]));
 const nativeResizePath=await writeJson(output,'native-react-resize.json',nativeResize);
 const nativeReactRender=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path',nativeRenderManifest,'--','--rgb-f32',nativeReactRgb,'512','384','--eight-bit','--png-dir',nativeReactPng,'--camera-settings',reactSettingsPath],{env:nativeRendererEnv}));
 const nativeReactRenderPath=await writeJson(output,'native-react-render.json',nativeReactRender),nativeReactPreview=path.join(output,'native-react-preview');
 await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','react_preview_reference','--',nativeReactRenderPath,nativeReactPng,nativeReactPreview]);
 const reactStage=path.join(temp,'react-stage');
 await run('node',['scripts/build-rapidraw-react-proof.mjs',frontend,reactStage,wasmOut]);
 await copyFile(path.join(reactStage,'source-proof.json'),path.join(output,'react-source-proof.json'));
 const interactiveReferences=[];
 for(const preset of ['full','high','performance']){
  const directory=path.join(output,'interactive-'+preset);
  const prepared=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','interactive_preview_reference','--','prepare',nativeReactRgb,'512','384','512',preset,directory]));
  const pngDirectory=path.join(directory,'native-png');
  const rendered=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path',nativeRenderManifest,'--','--rgb-f32',path.join(directory,'rgb.f32'),String(prepared.width),String(prepared.height),'--eight-bit','--png-dir',pngDirectory,'--camera-settings',reactSettingsPath],{env:nativeRendererEnv}));
  const renderPath=await writeJson(directory,'native-render.json',rendered);
  const reference=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','interactive_preview_reference','--','encode',directory,renderPath,pngDirectory]));
  interactiveReferences.push(reference);
 }
 const interactiveReferencePath=await writeJson(output,'interactive-native.json',interactiveReferences);
 const geometryReferences=[];
 const geometryCases=[['Rotate Right',1,false,false],['Flip Horiz',1,true,false],['Flip Vert',1,true,true],['Rotate Left',0,true,true],['Flip Horiz',0,false,true],['Flip Vert',0,false,false]];
 for(const [index,[action,steps,horizontal,vertical]]of geometryCases.entries()){
  const directory=path.join(output,'geometry-'+index);
  const prepared=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','geometry_reference','--','prepare',nativeReactRgb,'512','384',String(steps),String(horizontal),String(vertical),directory]));
  const pngDirectory=path.join(directory,'native-png');
  const rendered=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path',nativeRenderManifest,'--','--rgb-f32',path.join(directory,'rgb.f32'),String(prepared.width),String(prepared.height),'--eight-bit','--png-dir',pngDirectory,'--camera-settings',reactSettingsPath],{env:nativeRendererEnv}));
  const renderPath=await writeJson(directory,'native-render.json',rendered);
  const reference=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','geometry_reference','--','encode',directory,renderPath,pngDirectory]));
  geometryReferences.push({action,...reference});
 }
 const geometryReferencePath=await writeJson(output,'geometry-native.json',geometryReferences);
 const cropReferences=[];
 const cropCases=[['1:1',0,false,false,{x:256,y:0,width:1536,height:1536}],['Rotate Right',1,false,false,{x:0,y:256,width:1536,height:1536}],['Flip Horiz',1,true,false,{x:0,y:256,width:1536,height:1536}],['Reset geometry',0,false,false,null],['16:9',0,false,false,{x:0,y:192,width:2048,height:1152}],['Reset geometry',0,false,false,null]];
 for(const [index,[action,steps,horizontal,vertical,crop]]of cropCases.entries()){
  const directory=path.join(output,'crop-'+index);
  const prepared=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','crop_reference','--','prepare',nativeQualityRgb,'2048','1536',String(steps),String(horizontal),String(vertical),JSON.stringify(crop),directory]));
  const pngDirectory=path.join(directory,'native-png');
  const rendered=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path',nativeRenderManifest,'--','--rgb-f32',path.join(directory,'rgb.f32'),String(prepared.width),String(prepared.height),'--eight-bit','--png-dir',pngDirectory,'--camera-settings',reactSettingsPath],{env:nativeRendererEnv}));
  const renderPath=await writeJson(directory,'native-render.json',rendered);
  const reference=JSON.parse(await run('cargo',['run','--release','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','crop_reference','--','encode',directory,renderPath,pngDirectory]));
  cropReferences.push({action,...reference});
 }
 const cropReferencePath=await writeJson(output,'crop-native.json',cropReferences);
 const reactReport=path.join(output,'react-browser.json');
 await run('node',['scripts/smoke-rapidraw-react.mjs',reactStage,input,reactReport,path.join(nativeReactPreview,'reference.json'),nativeResizePath,interactiveReferencePath,geometryReferencePath,cropReferencePath]);
 reports.react=JSON.parse(await readFile(reactReport,'utf8'));

 for(const name of ['preview.rs','preview-encode.txt','preview-envelope.txt','preview-reader.js','mozjpeg-rs-LICENSE'])await copyFile(path.join(root,'experiments/rapidraw-wasm-core/tests/reference',name),path.join(output,name));



 for(const [source,name] of [['UPSTREAM.json','native-render-UPSTREAM.json'],['src/original_adjustments.rs','native-original-adjustments.rs'],['src/original_bindings.rs','native-original-bindings.rs'],['src/original_high_precision_pipeline.rs','native-original-high-precision-pipeline.rs'],['src/original_upload.rs','native-original-upload.rs'],['src/original_eight_bit_pipeline.rs','native-original-eight-bit-pipeline.rs']])await copyFile(path.join(root,'experiments/rapidraw-native-render-reference',source),path.join(output,name));
 for(const name of ['white_balance.rs','wb_color.rs','wb-target.txt','wb-gpu-matrix.rs','global_controls.rs','global_helpers.rs','global_layout.rs','global_module.rs'])await copyFile(path.join(root,'experiments/rapidraw-wasm-core/tests/reference',name),path.join(output,'original-'+name));
 await copyFile(path.join(root,'experiments/rapidraw-wasm-core/tests/reference/baseline_exposure.rs'),path.join(output,'original-camera-baseline-exposure.rs'));
 for(const name of ['ui-exposure-visibility.txt','ui-exposure-baseline.txt','ui-exposure-get-value.txt','ui-exposure-scales.txt'])await copyFile(path.join(root,'experiments/rapidraw-wasm-core/tests/reference',name),path.join(output,name));
 await copyFile(path.join(root,'experiments/rapidraw-wasm-core/assets/sRGB-v2-magic.icc'),path.join(output,'sRGB-v2-magic.icc'));
 await copyFile(path.join(root,'experiments/rapidraw-wasm-core/assets/README.md'),path.join(output,'icc-attribution.md'));
 for(const name of ['png-branch.txt','png-phys.rs','png-chunk.rs','png_render_precision.rs'])await copyFile(path.join(root,'experiments/rapidraw-wasm-core/tests/reference',name),path.join(output,name));
 const pngProvenance=JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).pngExportReference;
 const provenance={schemaVersion:1,orientationFlip:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).orientationFlip,interactivePreview:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).interactivePreview,previewResize:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).previewResize,preview:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).preview,fullGlobalParser:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).fullGlobalParser,cameraRendererProjection:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).cameraRendererProjection,asShotWhiteBalance:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).asShotWhiteBalance,cameraExposureReader:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).cameraExposureReader,pngRenderPrecision:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).pngRenderPrecision,rendererUpload:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).rendererUpload,uiExposureMapping:JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).uiExposureMapping,pngCodec:pngProvenance,fixture:{id:fixture.id,sourceUrl:fixture.sourceUrl,sourceSha256:fixture.sourceSha256,license:fixture.license,licenseSourceUrl:fixture.licenseSourceUrl,licenseUrl:fixture.licenseUrl},nativeSource:{repo:'CyberTimon/RapidRAW',commit:evidence.nativeSource,license:'AGPL-3.0',licenseText:'RapidRAW-LICENSE'},decoder:{repo:'CyberTimon/RapidRAW-DngLab',commit:evidence.decoderSource,license:'LGPL-2.1',licenseUrl:'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html'},qualityPatch:{...JSON.parse(await readFile(path.join(stage,'quality-timer-compat.json'),'utf8')).patch,artifact:'ppg-wasm-profiling.patch'},toolchain:{rustc:(await run('rustc',['--version'])),wasmBindgen:(await run('wasm-bindgen',['--version']))},fixtureBytes:bytes.length,results:Object.fromEntries(Object.entries(reports).map(([mode,report])=>[mode,{comparedScalars:report.comparedScalars,exactScalars:report.exactScalars,tolerance:report.tolerance,maxAbsoluteDifference:report.maxAbsoluteDifference,exactMappedExposureF32Matches:report.exactMappedExposureF32Matches,exactMetadataMatches:report.exactMetadataMatches,variants:report.variants,nativeCases:report.nativeCases,exactExposureF32Matches:report.exactExposureF32Matches,payloadBytes:report.payloadBytes,inputFormat:report.inputFormat,inputF32Sha256:report.inputF32Sha256,inputRgbaF16Sha256:report.inputRgbaF16Sha256,publicFixture:report.publicFixture,browserVersion:report.browserVersion,nativeRenderedPngSha256:report.nativeRenderedPngSha256,inputRgbaSha256:report.inputRgbaSha256,rejectedInvalidInputs:report.rejectedInvalidInputs,rejectedInvalidGlobalInputs:report.rejectedInvalidGlobalInputs,rejectedInvalidPngInputs:report.rejectedInvalidPngInputs,shaderSha256:report.shaderSha256,adapterInfo:report.adapterInfo,nativeComparison:report.nativeComparison,frames:report.frames,gpuErrors:report.gpuErrors,rejectedInvalidCases:report.rejectedInvalidCases,dimensions:report.dimensions,png:report.png,browser:report.browser,pixelHash:report.pixelHash,exactRGBF32BitsSha256Matches:report.exactRGBF32BitsSha256Matches,pageErrors:report.pageErrors,failedRequests:report.failedRequests}]))};
 await writeFile(path.join(output,'provenance-and-license.json'),JSON.stringify(provenance,null,2)+'\n');
 console.log(JSON.stringify({quality:provenance.results.quality,speed:provenance.results.speed,output}));
}finally{await import('node:fs/promises').then(fs=>fs.rm(temp,{recursive:true,force:true}));}
async function writeJson(directory,name,value){const file=path.join(directory,name);await writeFile(file,JSON.stringify(value));return file;}
