// Real Linux engine/FUSE recovery proof; generated laptop protocol, no browser picker.
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {createWorkspaceServer} from '../src/server.js';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const suffix=process.platform==='win32'?'.exe':'';
const binary=process.env.CW_PHOTOCRAFT_BINARY||path.join(repo,`data/engines/photocraft/build/release/photocraft-cli${suffix}`);
process.env.CW_FUSE_BINARY ||= path.join(repo,`data/engines/storage/build/release/cw-filesystem-helper${suffix}`);
const temporary=await mkdtemp(path.join(os.tmpdir(),'cw-native-recovery-failure-'));
const options={dataDir:path.join(temporary,'data'),allowedRoots:[path.join(temporary,'projects')],photocraftOptions:{binary}};
let server,base,agent,share;const sessions=[];const files=new Map();let rejectedRename=false;
async function start(){server=await createWorkspaceServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;}
async function api(route,method='GET',input){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:base},body:input===undefined?undefined:JSON.stringify(input)});const value=await response.json();if(!response.ok)throw new Error(`${response.status}: ${value.error}`);return value;}
const rpc=(id,method,params={})=>api(`/api/photocraft/sessions/${id}/rpc`,'POST',{method,params,requestId:randomUUID()});
function frame(id,head){const json=Buffer.from(JSON.stringify(head)),buffer=Buffer.alloc(8+json.length);buffer.writeUInt32LE(id);buffer.writeUInt32LE(json.length,4);json.copy(buffer,8);return buffer;}
try{
  await start();assert.equal((await api('/api/engines/photocraft')).ready,true);assert.equal((await api('/api/storage/capabilities')).ondemand,true);
  share=await api('/api/storage/shares','POST',{app:'photocraft',name:'Generated recovery laptop',mode:'ondemand',fill:false,keep:false,access:'readwrite'});
  agent=new WebSocket(base.replace(/^http/,'ws')+`/storage/agent?id=${share.id}`,{headers:{Origin:base}});
  agent.on('message',message=>{
    const id=message.readUInt32LE(0),length=message.readUInt32LE(4),head=JSON.parse(message.subarray(8,8+length)),data=message.subarray(8+length);let reply={};
    if(head.op==='list')reply.entries=[...files].map(([name,file])=>({name,kind:'file',size:file.length,mtime:Date.now()}));
    else if(head.op==='write'){const old=head.trunc?Buffer.alloc(0):files.get(head.path)||Buffer.alloc(0),next=Buffer.alloc(Math.max(old.length,head.off+data.length));old.copy(next);data.copy(next,head.off);files.set(head.path,next);}
    else if(head.op==='rename'){rejectedRename=true;reply={err:'EACCES'};}
    else if(head.op==='remove')files.delete(head.path);
    else if(head.op!=='mkdir')reply={err:'ENOENT'};
    agent.send(frame(id,reply));
  });
  await new Promise((resolve,reject)=>{agent.once('open',resolve);agent.once('error',reject);});
  const editing=await api('/api/photocraft/sessions','POST',{sourceShareId:share.id,saveDestination:'laptop'});sessions.push(editing.id);
  await rpc(editing.id,'doc.new',{name:'Recovery proof',width:96,height:64,mode:'rgb',depth:8,background:'white'});
  await rpc(editing.id,'engine.execute',{command:'layer.new.layer',params:{name:'Recovered ink'},wait:true});
  await rpc(editing.id,'engine.execute',{command:'paint.stroke',params:{points:[[8,8,1],[70,50,1]],size:7,color:'#2855dd'},wait:true});
  await assert.rejects(rpc(editing.id,'doc.save',{path:'final-result.pcraft',format:'pcraft'}));
  assert.equal(rejectedRename,true);assert.equal(files.has('final-result.pcraft'),false);
  const record=(await api('/api/storage/recovery?app=photocraft')).records.find(item=>item.id.startsWith(`${share.id}-`));
  assert.equal(record.state,'failed');assert.equal(record.downloadAvailable,true);
  await api(`/api/photocraft/sessions/${editing.id}`,'DELETE',{});sessions.splice(sessions.indexOf(editing.id),1);
  await api(`/api/storage/shares/${share.id}`,'DELETE',{});share=null;
  await new Promise(resolve=>server.close(resolve));await start();
  assert.ok((await api('/api/storage/recovery?app=photocraft')).records.some(item=>item.id===record.id));
  const response=await fetch(`${base}/api/storage/recovery/${record.id}/output?app=photocraft`);assert.equal(response.status,200);
  const recovered=Buffer.from(await response.arrayBuffer());assert.ok(recovered.length>100);
  assert.ok([...files.values()].some(file=>file.equals(recovered)));
  await writeFile(path.join(temporary,'projects/photocraft/recovered.pcraft'),recovered);
  const opened=await api('/api/photocraft/sessions','POST',{});sessions.push(opened.id);
  const state=await rpc(opened.id,'doc.open',{path:'recovered.pcraft'});assert.equal(state.document.width,96);assert.equal(state.document.height,64);assert.equal(state.document.layers.length,2);
  const report={verifiedAt:new Date().toISOString(),test:'native PhotoCraft + FUSE + generated laptop-agent rejecting final rename',realBrowserPickerTest:false,finalRenameRejected:true,saveReturnedFailure:true,serverCopyRetainedAfterStop:true,recoverySurvivedGatewayRestart:true,recoveryDownloadBytes:recovered.length,downloadMatchesAcknowledgedTemporaryFile:true,recoveredDocumentReopenedByNativeEngine:true,reopenedLayers:state.document.layers.length,unacknowledgedFinalOutputNotPublished:true};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{
  for(const id of sessions)await api(`/api/photocraft/sessions/${id}`,'DELETE',{}).catch(()=>{});
  if(share)await api(`/api/storage/shares/${share.id}`,'DELETE',{}).catch(()=>{});
  agent?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));
  await rm(temporary,{recursive:true,force:true});
}
