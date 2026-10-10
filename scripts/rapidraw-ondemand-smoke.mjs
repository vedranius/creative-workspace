import {WebSocket} from 'ws';
import {open,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';

// A generated browser-agent fixture: exercises the actual network bridge and native FUSE mount.
const endpoint=process.env.RAPIDRAW_URL||'http://127.0.0.1:8791';
const source=Buffer.alloc(8*1024*1024);for(let i=0;i<source.length;i++)source[i]=i%251;
const ws=new WebSocket(`${endpoint.replace('http:','ws:')}/ipc`);
await once(ws,'open');let next=0;const pending=new Map();
ws.on('message',(data,binary)=>{if(binary)return;const message=JSON.parse(data);const request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(new Error(message.error)):request.resolve(message.result);}});
const call=(cmd,args={})=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${cmd} timeout`));},20000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,cmd,args}));});
let share,agent,fetched=0;const writes=new Map();
function frame(id,header,data=Buffer.alloc(0)){const json=Buffer.from(JSON.stringify(header));const out=Buffer.alloc(8+json.length+data.length);out.writeUInt32LE(id,0);out.writeUInt32LE(json.length,4);json.copy(out,8);data.copy(out,8+json.length);return out;}
try{
  const identity=await call('__cw_runtime_identity');if(identity?.runtimeId!=='creative-workspace-rapidraw-v1')throw new Error('Not the workspace-owned runtime');
  const caps=await call('__rr_share_caps');if(!caps.ondemand)throw new Error(caps.reason||'On-demand unavailable');
  share=await call('__rr_share_start',{name:'CW-on-demand-proof',mode:'ondemand',keep:false,fill:false});
  agent=new WebSocket(`${endpoint.replace('http:','ws:')}/rfs?id=${share.id}`);
  agent.on('message',packet=>{
    const id=packet.readUInt32LE(0),length=packet.readUInt32LE(4);const request=JSON.parse(packet.subarray(8,8+length));
    if(request.op==='list')agent.send(frame(id,{entries:[{name:'range-fixture.bin',kind:'file',size:source.length,mtime:1700000000000}]}));
    else if(request.op==='read'&&request.path==='range-fixture.bin'){const data=source.subarray(request.off,request.off+request.len);fetched+=data.length;agent.send(frame(id,{},data));}
    else if(request.op==='write'&&request.path==='CW-save-proof.txt'){const bytes=packet.subarray(8+length);const old=request.trunc?Buffer.alloc(0):(writes.get(request.path)||Buffer.alloc(0));const next=Buffer.alloc(Math.max(old.length,request.off+bytes.length));old.copy(next);bytes.copy(next,request.off);writes.set(request.path,next);agent.send(frame(id,{}));}
    else agent.send(frame(id,{err:'ENOENT'}));
  });
  await once(agent,'open');
  const file=await open(path.join(share.view,'range-fixture.bin'),'r');const selected=Buffer.alloc(128);const offset=3*1024*1024+31;
  try{await file.read(selected,0,selected.length,offset);}finally{await file.close();}
  if(!selected.equals(source.subarray(offset,offset+128)))throw new Error('Mounted range bytes differ from the laptop fixture');
  if(fetched>=source.length)throw new Error('Whole source copied instead of reading on demand');
  const save=Buffer.from('Workspace server saved back to the laptop agent');
  await writeFile(path.join(share.view,'CW-save-proof.txt'),save);
  const deadline=Date.now()+5000;while(!writes.has('CW-save-proof.txt')&&Date.now()<deadline)await pause(50);
  if(!writes.get('CW-save-proof.txt')?.equals(save))throw new Error('Save did not reach the laptop agent');
  const report={saveBackMatches:true,savedBytes:save.length,runtimeId:identity.runtimeId,mode:'ondemand',backgroundCopy:false,sourceBytes:source.length,requestedBytes:128,transferredBytes:fetched,rangeMatches:true,usedNativeFuseMount:true,browserAgent:'generated protocol fixture (not a real browser directory-picker test)'};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(share)await call('__rr_share_stop',{id:share.id}).catch(()=>{});agent?.close();ws.close();}
