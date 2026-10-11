import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EngineProcess} from '../src/photocraft.js';
const temporary=await mkdtemp(path.join(os.tmpdir(),'cw-light-native-')),input=path.join(temporary,'input'),output=path.join(temporary,'output');await mkdir(input);await mkdir(output);
const binary=process.env.CW_LIGHTCRAFT_BINARY;if(!binary)throw new Error('Set CW_LIGHTCRAFT_BINARY to the owned native worker');
const methods=new Set(['__cw_identity','controls','open','state','set','undo','redo','render','export','mark_saved']);
const workers=[];const worker=()=>{const engine=new EngineProcess(binary,input,{args:[input,output],configDir:output,allowedMethods:methods,engineName:'LightCraft'});workers.push(engine);return engine;};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Contributor-original procedural Bayer DNG. TIFF/DNG fields, no camera profiles,
// external images or embedded JPEG preview. The RAW samples must actually decode.
function dng(width=128,height=96){
  const short=(...values)=>{const b=Buffer.alloc(values.length*2);values.forEach((v,i)=>b.writeUInt16LE(v,i*2));return b;};
  const long=(...values)=>{const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v,i*4));return b;};
  const rational=values=>{const b=Buffer.alloc(values.length*8);values.forEach(([n,d],i)=>{b.writeInt32LE(n,i*8);b.writeInt32LE(d,i*8+4);});return b;};
  const fields=[[256,4,long(width)],[257,4,long(height)],[258,3,short(16)],[259,3,short(1)],[262,3,short(32803)],[273,4,long(0)],[277,3,short(1)],[278,4,long(height)],[279,4,long(width*height*2)],[284,3,short(1)],[33421,3,short(2,2)],[33422,1,Buffer.from([0,1,1,2])],[50706,1,Buffer.from([1,4,0,0])],[50707,1,Buffer.from([1,1,0,0])],[50708,2,Buffer.from('Workspace synthetic camera\0')],[50714,3,short(64)],[50717,4,long(4095)],[50721,10,rational([[1,1],[0,1],[0,1],[0,1],[1,1],[0,1],[0,1],[0,1],[1,1]])],[50728,5,rational([[1,1],[1,1],[1,1]])],[50778,3,short(21)]].sort((a,b)=>a[0]-b[0]);
  const sizes={1:1,2:1,3:2,4:4,5:8,10:8};let cursor=8+2+fields.length*12+4;const extras=[];
  const header=Buffer.alloc(cursor);header.write('II');header.writeUInt16LE(42,2);header.writeUInt32LE(8,4);header.writeUInt16LE(fields.length,8);
  for(const [i,[tag,type,bytes]]of fields.entries()){const at=10+i*12;header.writeUInt16LE(tag,at);header.writeUInt16LE(type,at+2);header.writeUInt32LE(bytes.length/sizes[type],at+4);if(tag===273)continue;if(bytes.length<=4)bytes.copy(header,at+8);else{header.writeUInt32LE(cursor,at+8);extras.push(bytes);cursor+=bytes.length;}}
  const offset=fields.findIndex(f=>f[0]===273);header.writeUInt32LE(cursor,10+offset*12+8);
  const pixels=Buffer.alloc(width*height*2);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const band=(y%2)*2+x%2,base=band===0?500+x/width*2400:band===3?800+(x+y)/(width+height)*1200:500+y/height*2200;pixels.writeUInt16LE(Math.round(base),2*(y*width+x));}
  return Buffer.concat([header,...extras,pixels]);
}
try{
  const original=dng();await writeFile(path.join(input,'synthetic.dng'),original);await writeFile(path.join(temporary,'private.dng'),original);await writeFile(path.join(input,'synthetic.xmp'),'Untrusted sidecar must remain untouched');
  const engine=worker();assert.equal((await engine.call('__cw_identity')).runtimeId,'creative-workspace-lightcraft-v1');const controls=await engine.call('controls');assert.equal(controls.length,12);
  await assert.rejects(engine.call('open',{path:path.join(temporary,'private.dng')}),/outside/);const opened=await engine.call('open',{path:path.join(input,'synthetic.dng')});assert.equal(opened.width,128);assert.equal(opened.height,96);assert.equal(opened.dirty,false);assert.equal(opened.sourceHash,sha(original));
  await assert.rejects(engine.call('render',{path:path.join(output,'invalid-edge.png'),longEdge:-1}),/integer/);await assert.rejects(engine.call('export',{path:path.join(output,'invalid-format.png'),format:42}),/format/);
  await engine.call('render',{path:path.join(output,'before.png'),longEdge:128});const before=await readFile(path.join(output,'before.png'));await assert.rejects(engine.call('set',{values:{'light.exposure':100}}),/range/);await assert.rejects(engine.call('set',{values:{'profile.path':1}}),/Unsupported/);
  const edited=await engine.call('set',{values:{'light.exposure':1,'light.contrast':20,'color.vibrance':25}});assert.equal(edited.dirty,true);await engine.call('render',{path:path.join(output,'after.png'),longEdge:128});const after=await readFile(path.join(output,'after.png'));assert.notEqual(sha(before),sha(after));
  await engine.call('undo');assert.equal((await engine.call('state')).values['light.exposure'],0);await engine.call('redo');assert.equal((await engine.call('state')).values['light.exposure'],1);
  await assert.rejects(engine.call('export',{path:path.join(temporary,'escape.png')}),/outside/);await engine.call('export',{path:path.join(output,'edited.jpg'),format:'jpeg',longEdge:128});const jpeg=await readFile(path.join(output,'edited.jpg'));assert.equal(jpeg.readUInt16BE(0),0xffd8);
  await assert.rejects(engine.call('export',{path:path.join(output,'edited.jpg'),format:'jpeg'}),/already exists/);assert.equal((await engine.call('state')).dirty,true);await engine.call('mark_saved');assert.equal((await engine.call('state')).dirty,false);
  assert.equal(sha(await readFile(path.join(input,'synthetic.dng'))),sha(original));assert.equal(await readFile(path.join(input,'synthetic.xmp'),'utf8'),'Untrusted sidecar must remain untouched');
  // Fresh worker reopens the actual exported JPEG, adjusts it and exports PNG.
  await writeFile(path.join(input,'exported.jpg'),jpeg);const reopened=worker();await reopened.call('open',{path:path.join(input,'exported.jpg')});await reopened.call('set',{values:{'light.exposure':-.5}});await reopened.call('export',{path:path.join(output,'reopened.png'),longEdge:128});assert.equal((await readFile(path.join(output,'reopened.png'))).subarray(1,4).toString(),'PNG');
  // A new decoder load must reject changed source bytes, including same-size changes.
  const changed=worker();await changed.call('open',{path:path.join(input,'synthetic.dng')});const mutation=Buffer.from(original);mutation[mutation.length-1]^=1;await writeFile(path.join(input,'synthetic.dng'),mutation);await assert.rejects(changed.call('render',{path:path.join(output,'changed.png')}),/changed/);
  const report={verifiedAt:new Date().toISOString(),nativeSyntheticBayerDngDecodeEditUndoRedoPreviewJpegExportReopenPng:true,previewPixelsChanged:true,originalPreservedBeforeIntentionalGuardTest:true,externalReadWriteRejected:true,adjacentXmpUntouched:true,changedSourceRejected:true,controls:12,rawWidth:128,rawHeight:96,jpegBytes:jpeg.length,browserAdapterAvailable:false,realCameraRawCoverageVerified:false};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{for(const engine of workers)engine.stop();await rm(temporary,{recursive:true,force:true});}
