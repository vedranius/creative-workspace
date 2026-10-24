// Existing independent native source resize/shader/q80 codec, matched software Vulkan backend.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
const [rgb,renderer,examples,cameraPath,icd,output]=process.argv.slice(2);if(!output)throw Error('PUBLIC_QUALITY_RGB NATIVE_RENDER CORE_EXAMPLES CAMERA_JSON SOFTWARE_ICD NEW_OUTPUT_DIR');
const hash=b=>createHash('sha256').update(b).digest('hex'),meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
assert.equal(hash(await readFile(rgb)),'f052bba0940702e068fb03d6a9f1cc78b9c57e7ff5758f1c460f28d11fb49e30');
const camera=JSON.parse(await readFile(cameraPath));assert.equal(camera.source,meta.nativeApplication.commit);
const frame=camera.frames.find(f=>JSON.parse(f.json).exposure===0.8);assert.ok(frame);camera.frames=[frame];
await mkdir(output);await writeFile(path.join(output,'camera.json'),JSON.stringify(camera));
const env={...process.env,VK_ICD_FILENAMES:icd};delete env.VK_DRIVER_FILES;
async function run(binary,args,name){const f=await open(path.join(output,name),'wx');try{await new Promise((resolve,reject)=>{const p=spawn(binary,args,{env,stdio:['ignore',f.fd,'inherit']});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(path.basename(binary)+' failed '+code)));});}finally{await f.close();}}
await run(path.join(examples,'preview_resize_reference'),[rgb,'2048','1536','400',path.join(output,'rgb.f32')],'resize.json');
const resize=JSON.parse(await readFile(path.join(output,'resize.json')));assert.deepEqual([resize.width,resize.height],[400,300]);
await run(renderer,['--rgb-f32',path.join(output,'rgb.f32'),'400','300','--camera-settings',path.join(output,'camera.json'),'--eight-bit','--export-codec-reference','--png-dir',path.join(output,'png')],'render.json');
const rendered=JSON.parse(await readFile(path.join(output,'render.json')));assert.equal(rendered.adapter.driver,'SwiftShader driver');assert.equal(rendered.source,meta.nativeApplication.commit);
await writeFile(path.join(output,'input.json'),JSON.stringify(resize));await run(path.join(examples,'uncropped_reference'),['encode',output,path.join(output,'render.json'),path.join(output,'png')],'codec-log.json');
const codec=JSON.parse(await readFile(path.join(output,'reference.json')));assert.equal(codec.rgbaSha256,rendered.frames[0].sha256);assert.equal(codec.adjustmentSha256,rendered.frames[0].adjustmentSha256);
await writeFile(path.join(output,'source-reference.json'),JSON.stringify({...codec,scope:'Pinned original preset preview400/q80 with show_clipping0. Independent native source resize, full shader and original RGB8 JPEG codec; software Vulkan matches browser QA. No universal cross-GPU bit identity.',adapter:rendered.adapter,inputRgbaF16Sha256:rendered.inputRgbaF16Sha256,shaderSha256:rendered.shaderSha256,rendererSha256:hash(await readFile(renderer)),cameraSha256:hash(await readFile(cameraPath)),originalPresetSource:meta.presetApply.sourceFiles['src-tauri/src/lib.rs']},null,2)+'\n');
console.log(JSON.stringify({nativePresetPreview:true,dimensions:[400,300],bytes:codec.bytes,jpegSha256:codec.jpegSha256,backend:rendered.adapter.driver}));
