// Independent pinned source geometry + native EightBit shader + source JPEG codec.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {createHash} from 'node:crypto';
const [browserPath,qualityRgb,renderBinary,examples,cameraPath,output]=process.argv.slice(2);
if(!output)throw Error('BROWSER_JSON PUBLIC_NATIVE_RGB NATIVE_RENDER_BINARY CORE_EXAMPLES CAMERA_JSON NEW_OUTPUT_DIR');
const report=JSON.parse(await readFile(browserPath)),meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
assert.equal(report.fixture.id,'raw.pixls.us 1327');assert.equal(report.fixture.license,'CC0-1.0');
const hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(await readFile(qualityRgb)),'f052bba0940702e068fb03d6a9f1cc78b9c57e7ff5758f1c460f28d11fb49e30');
const camera=JSON.parse(await readFile(cameraPath));assert.equal(camera.source,meta.nativeApplication.commit);assert.ok(camera.fullGlobal&&camera.frames.length===5);
await mkdir(output);const cases=[],renderCache=new Map();
async function run(command,args,file){const stdout=await open(file,'wx');try{await new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:['ignore',stdout.fd,'inherit']});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(path.basename(command)+' failed '+code)));});}finally{await stdout.close();}}
for(const c of report.cases){
 const dir=path.join(output,c.name);await mkdir(dir);
 const a=c.adjustments,geometry={orientationSteps:a.orientationSteps??0,flipHorizontal:a.flipHorizontal??false,flipVertical:a.flipVertical??false,rotation:a.rotation??0,crop:a.crop===null||a.crop===undefined?null:{x:a.crop.x,y:a.crop.y,width:a.crop.width,height:a.crop.height}};
 assert.ok(c.sourceUi&&c.originalExposureAndExportControls&&c.writeAcknowledged&&c.noSuccessBeforeClose);
 assert.ok([0.8,-0.8].includes(a.exposure));
 const sourceFrame=camera.frames.find(f=>JSON.parse(f.json).exposure===a.exposure);assert.ok(sourceFrame);
 for(const key of ['brightness','contrast','highlights','shadows','whites','blacks'])assert.equal(a[key]??0,0);
 await run(path.join(examples,'export_fine_geometry_reference'),[qualityRgb,'2048','1536',JSON.stringify(geometry),path.join(dir,'native.rgba32f')],path.join(dir,'geometry.json'));
 const g=JSON.parse(await readFile(path.join(dir,'geometry.json')));
 const caseCamera={...structuredClone(camera),frames:[structuredClone(sourceFrame)]};caseCamera.frames[0].json=JSON.stringify({...JSON.parse(sourceFrame.json),...geometry});await writeFile(path.join(dir,'camera.json'),JSON.stringify(caseCamera));
 const renderKey=JSON.stringify([g.rgbaF32Sha256,sourceFrame.global]);
 let renderDir=renderCache.get(renderKey);
 if(!renderDir){
 await run(renderBinary,['--rgba-f32',path.join(dir,'native.rgba32f'),String(g.width),String(g.height),'--camera-settings',path.join(dir,'camera.json'),'--eight-bit','--export-codec-reference','--png-dir',path.join(dir,'png')],path.join(dir,'render.json'));
 renderDir=dir;renderCache.set(renderKey,dir);
 }
 const native=JSON.parse(await readFile(path.join(renderDir,'render.json'))),frame=native.frames[0];
 assert.equal(native.inputF32Sha256,g.rgbaF32Sha256);
 await run(path.join(examples,'jpeg_export_reference'),[path.join(renderDir,'png/frame-0.png'),path.join(dir,'jpeg'),JSON.stringify(c.settings)],path.join(dir,'codec-log.json'));
 const codec=JSON.parse(await readFile(path.join(dir,'jpeg/reference.json'))).cases[0];
 const prepared=c.stages.find(s=>s.status==='prepared'),rendered=c.stages.find(s=>s.status==='rendered');assert.ok(prepared&&rendered);
 assert.equal(prepared.rgbSha256,g.rgbF32Sha256,c.name+' RGB');assert.equal(prepared.uploadSha256,native.inputRgbaF16Sha256,c.name+' full f16+alpha');assert.equal(prepared.adjustmentSha256,frame.adjustmentSha256,c.name+' packed settings');assert.equal(rendered.rgbaSha256,frame.sha256,c.name+' complete RGBA8');
 const actual=c.sourceUi?c:c.result;assert.equal(actual.jpegSha256,codec.sha256,c.name+' JPEG');assert.equal(actual.bytes,codec.bytes);assert.deepEqual(c.dimensions,c.settings.resize.value===1024?[1024,768]:[2048,1536]);assert.deepEqual(c.density,{unit:1,x:c.settings.dpi,y:c.settings.dpi});
 const {rgbaU8,...compact}=frame;cases.push({name:c.name,sourceUi:c.sourceUi,exposure:a.exposure,settings:c.settings,dimensions:c.dimensions,density:c.density,geometry,...g,inputRgbaF16Sha256:native.inputRgbaF16Sha256,frame:compact,codec,allFullFrameAndJpegHashesExact:true});
}
const result={scope:'Independent original source Exposure parser fixtures -> complete native full-image EightBit shader -> original Lanczos3 resize/JPEG/DPI. Three actual original UI exports and real gated write ACKs.',fixture:report.fixture,source:camera.source,browserWasmSha256:report.source.wasmSha256,cameraSettingsSha256:hash(await readFile(cameraPath)),cases,rgbaComponentsCompared:cases.reduce((n,c)=>n+c.width*c.height*4,0),jpegBytesCompared:cases.reduce((n,c)=>n+c.codec.bytes,0)};
await writeFile(path.join(output,'reference.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,rgbaComponents:result.rgbaComponentsCompared,jpegBytes:result.jpegBytesCompared,allExact:true}));
