// Real engine/FUSE smoke using generated protocol data, without browser permission prompts.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';

const base=process.env.CW_SMOKE_URL||'http://127.0.0.1:8788';
const headers={'Content-Type':'application/json',Origin:base};
if(process.env.WORKSPACE_AUTH)headers.Authorization=`Basic ${Buffer.from(process.env.WORKSPACE_AUTH).toString('base64')}`;
async function api(route,method='GET',input){const response=await fetch(base+route,{method,headers,body:input===undefined?undefined:JSON.stringify(input)});const value=await response.json();if(!response.ok)throw new Error(`${response.status}: ${value.error}`);return value;}
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const payload=Buffer.concat([Buffer.from(type),data]),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(payload));return Buffer.concat([length,payload,crc]);}
function png(){const header=Buffer.alloc(13);header.writeUInt32BE(96);header.writeUInt32BE(64,4);header[8]=8;header[9]=2;const pixels=Buffer.alloc(64*(1+96*3));for(let y=0;y<64;y++)for(let x=0;x<96;x++){const off=y*(1+96*3)+1+x*3;pixels[off]=x*2;pixels[off+1]=y*3;pixels[off+2]=80;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);}
function frame(id,head,data=Buffer.alloc(0)){const json=Buffer.from(JSON.stringify(head)),prefix=Buffer.alloc(8);prefix.writeUInt32LE(id);prefix.writeUInt32LE(json.length,4);return Buffer.concat([prefix,json,data]);}
const files=new Map([['selected.png',png()],['unrelated-library.bin',Buffer.alloc(8*1024*1024,17)]]);
const reads={},writes={},mtime=Date.now();let share,agent;const sessions=[];
try{
  assert.equal((await api('/api/storage/capabilities')).ondemand,true,'Install the workspace filesystem helper on a supported server first');
  share=await api('/api/storage/shares','POST',{app:'photocraft',name:'Generated laptop smoke',mode:'ondemand',fill:false,keep:false,access:'readwrite'});
  assert.equal(share.fill,false);
  agent=new WebSocket(base.replace(/^http/,'ws')+`/storage/agent?id=${share.id}`,{headers:{Origin:base,...(headers.Authorization?{Authorization:headers.Authorization}:{})}});
  agent.on('message',message=>{
    const id=message.readUInt32LE(0),size=message.readUInt32LE(4),h=JSON.parse(message.subarray(8,8+size)),data=message.subarray(8+size);let reply={},out=Buffer.alloc(0);
    try{
      if(h.op==='list'){const prefix=h.path?`${h.path}/`:'';reply.entries=[...files].filter(([name])=>name.startsWith(prefix)&&!name.slice(prefix.length).includes('/')).map(([name,file])=>({name:name.slice(prefix.length),kind:'file',size:file.length,mtime}));}
      else if(h.op==='read'){if(!files.has(h.path))throw Error('ENOENT');out=files.get(h.path).subarray(h.off,h.off+h.len);reads[h.path]=(reads[h.path]||0)+out.length;}
      else if(h.op==='write'){const old=h.trunc?Buffer.alloc(0):files.get(h.path)||Buffer.alloc(0),next=Buffer.alloc(Math.max(old.length,h.off+data.length));old.copy(next);data.copy(next,h.off);files.set(h.path,next);writes[h.path]=(writes[h.path]||0)+data.length;}
      else if(h.op==='rename'){if(!files.has(h.from))throw Error('ENOENT');files.set(h.to,files.get(h.from));files.delete(h.from);}
      else if(h.op==='remove'){files.delete(h.path);}
      else if(h.op!=='mkdir')throw Error('EINVAL');
    }catch(error){reply={err:error.message};}
    agent.send(frame(id,reply,out));
  });
  await new Promise((resolve,reject)=>{agent.once('open',resolve);agent.once('error',reject);});
  const created=await api('/api/photocraft/sessions','POST',{sourceShareId:share.id,saveDestination:'laptop'});sessions.push(created.id);
  const rpc=(method,params={})=>api(`/api/photocraft/sessions/${created.id}/rpc`,'POST',{method,params,requestId:randomUUID()});
  let state=await rpc('doc.open',{path:'selected.png'});
  assert.equal(state.document.width,96);assert.equal(state.document.height,64);
  const before=Buffer.from(await (await fetch(base+state.preview,{headers})).arrayBuffer());
  state=await rpc('engine.execute',{command:'image.adjustments.brightnessContrast',params:{brightness:35,contrast:12},wait:true});
  const after=Buffer.from(await (await fetch(base+state.preview,{headers})).arrayBuffer());assert.notEqual(hash(before),hash(after));
  await rpc('engine.execute',{command:'layer.new.layer',params:{name:'Browser ink'},wait:true});
  await rpc('engine.execute',{command:'paint.stroke',params:{points:[[10,10,1],[50,40,1]],size:8,color:'#2855dd'},wait:true});
  await rpc('doc.save',{path:'laptop-result.pcraft',format:'pcraft'});
  const recovery=await api('/api/storage/recovery?app=photocraft');
  assert.equal(recovery.records.filter(record=>record.id.startsWith(`${share.id}-`)).length,0,'Acknowledged laptop saves must clear their recovery journal');
  assert.ok(files.get('laptop-result.pcraft')?.length>100,'Save must reach the generated laptop before the API confirms success');
  const download=Buffer.from(await (await fetch(`${base}/api/photocraft/sessions/${created.id}/output?path=laptop-result.pcraft`,{headers})).arrayBuffer());assert.equal(hash(download),hash(files.get('laptop-result.pcraft')));
  state=await rpc('doc.open',{path:'laptop-result.pcraft'});assert.equal(state.document.layers.length,2);
  assert.equal(reads['unrelated-library.bin']||0,0);
  await assert.rejects(api(`/api/storage/shares/${share.id}`,'DELETE',{}),/409/);
  const serverSession=await api('/api/photocraft/sessions','POST',{sourceShareId:share.id,saveDestination:'server'});sessions.push(serverSession.id);
  const serverRpc=(method,params={})=>api(`/api/photocraft/sessions/${serverSession.id}/rpc`,'POST',{method,params,requestId:randomUUID()});
  await serverRpc('doc.open',{path:'selected.png'});
  const serverOutput=`generated-server-smoke-${randomUUID()}.png`;
  await serverRpc('doc.save',{path:serverOutput,format:'png'});assert.equal(files.has(serverOutput),false);
  const exported=Buffer.from(await (await fetch(`${base}/api/photocraft/sessions/${serverSession.id}/output?path=${serverOutput}`,{headers})).arrayBuffer());assert.equal(exported.subarray(1,4).toString(),'PNG');
  const report={verifiedAt:new Date().toISOString(),test:'native PhotoCraft + independent filesystem helper + generated laptop-agent protocol fixture',realBrowserPickerTest:false,sourceBytes:files.get('selected.png').length,unrelatedBytes:files.get('unrelated-library.bin').length,unrelatedBytesRead:reads['unrelated-library.bin']||0,readBytesByPath:reads,writeBytesByPath:writes,previewChanged:hash(before)!==hash(after),laptopLayeredSaveBytes:files.get('laptop-result.pcraft').length,layeredSaveReopened:true,downloadMatchesLaptop:true,acknowledgedSaveClearsRecovery:true,serverOutputBytes:exported.length,serverDestinationKeepsLaptopUnchanged:true,fill:false};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{
  for(const id of sessions)await api(`/api/photocraft/sessions/${id}`,'DELETE',{}).catch(()=>{});
  if(share)await api(`/api/storage/shares/${share.id}`,'DELETE',{}).catch(()=>{});
  agent?.close();
}
