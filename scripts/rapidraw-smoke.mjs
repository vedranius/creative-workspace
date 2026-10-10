import {WebSocket} from 'ws';
import {readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';

const input=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw new Error('Pass a generated test image in the workspace-owned photo directory');
const endpoint=process.env.RAPIDRAW_URL||'http://127.0.0.1:8791';
const ws=new WebSocket(`${endpoint.replace('http:','ws:')}/ipc`);
const pending=new Map();let next=0;
ws.on('message',(data,binary)=>{
  if(binary){const id=data.readUInt32LE(0);const request=pending.get(id);if(request){pending.delete(id);request.resolve(data.subarray(4));}return;}
  const reply=JSON.parse(data);const request=pending.get(reply.id);if(!request)return;pending.delete(reply.id);reply.error?request.reject(new Error(reply.error)):request.resolve(reply.result);
});
const call=(cmd,args={})=>new Promise((resolve,reject)=>{
  const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${cmd} timed out`));},60000);
  pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,cmd,args}));
});
await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
try{
  const identity=await call('__cw_runtime_identity');
  if(identity?.runtimeId!=='creative-workspace-rapidraw-v1')throw new Error('Refusing to test an unrelated existing installation');
  const loaded=await call('load_image',{path:input});
  const preview=exposure=>call('apply_adjustments',{jsAdjustments:{exposure},isInteractive:false,targetResolution:960,roi:null,requestAnalytics:false,computeWaveform:false,activeWaveformChannel:null});
  const neutral=await preview(0);const bright=await preview(1);
  if(!Buffer.isBuffer(neutral)||!neutral.length||!Buffer.isBuffer(bright)||!bright.length)throw new Error('Engine did not return rendered preview bytes');
  const hash=data=>createHash('sha256').update(data).digest('hex');
  if(hash(neutral)===hash(bright))throw new Error('Exposure change did not change rendered output');
  const output=path.join(path.dirname(input),`CW-export-proof-${Date.now()}.png`);
  await call('export_images',{paths:[input],outputFolderOrFile:output,isExplicitFilePath:true,baseOriginFolders:[path.dirname(input)],exportSettings:{jpegQuality:90,resize:null,keepMetadata:false,stripGps:false,filenameTemplate:null,watermark:null},outputFormat:'png',currentEditPath:input,currentEditAdjustments:{exposure:1}});
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){try{if((await stat(output)).size>0)break;}catch{}await pause(100);}
  const exported=await readFile(output);if(exported.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Export is not a PNG');
  const report={runtimeId:identity.runtimeId,endpoint,input,width:loaded.width,height:loaded.height,neutralPreviewBytes:neutral.length,adjustedPreviewBytes:bright.length,previewChanged:true,output,exportBytes:exported.length};
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{ws.close();}
