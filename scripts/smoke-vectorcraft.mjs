import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {createWorkspaceServer} from '../src/server.js';
import {EngineProcess} from '../src/photocraft.js';

const temporary=await mkdtemp(path.join(os.tmpdir(),'cw-vector-native-')),binary=process.env.CW_VECTORCRAFT_BINARY;
const server=await createWorkspaceServer({dataDir:path.join(temporary,'data'),allowedRoots:[path.join(temporary,'projects')],rapidrawUrl:'http://127.0.0.1:1',vectorcraftOptions:binary?{binary}:{}});
let base,agent,share;const sessions=[],files=new Map(),reads=new Map();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const original=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect x="50" y="60" width="200" height="160" fill="#ed745e"/></svg>');
async function api(route,method='GET',input){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:base},body:input===undefined?undefined:JSON.stringify(input)});const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error),{status:response.status});return value;}
const rpc=(id,method,params={})=>api(`/api/vectorcraft/sessions/${id}/rpc`,'POST',{method,params,requestId:randomUUID()});
const create=async input=>{const s=await api('/api/vectorcraft/sessions','POST',input);sessions.push(s.id);return s.id;};
const flatten=nodes=>nodes.flatMap(n=>[n,...flatten(n.children||[])]);
function frame(id,header,body=Buffer.alloc(0)){const json=Buffer.from(JSON.stringify(header)),buffer=Buffer.alloc(8+json.length+body.length);buffer.writeUInt32LE(id);buffer.writeUInt32LE(json.length,4);json.copy(buffer,8);body.copy(buffer,8+json.length);return buffer;}

try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await api('/api/engines/vectorcraft')).ownedRuntime,true);
  const id=await create({});await writeFile(path.join(temporary,'projects/vectorcraft/input.svg'),original);const opened=await rpc(id,'doc.open',{path:'input.svg'});assert.equal(opened.document.dirty,false);
  const before=Buffer.from(await (await fetch(base+opened.preview)).arrayBuffer());
  const ellipse=await rpc(id,'shape.ellipse',{x:320,y:120,width:230,height:210});await rpc(id,'paint.setFill',{ids:[ellipse.result.id],color:'#283e47'});
  await rpc(id,'select.set',{ids:[ellipse.result.id]});await rpc(id,'object.transform',{matrix:[1,0,0,1,30,40]});const undone=await rpc(id,'edit.undo');assert.equal(flatten(undone.document.layers).find(n=>n.id===ellipse.result.id).bounds.x,320);const redone=await rpc(id,'edit.redo');assert.equal(flatten(redone.document.layers).find(n=>n.id===ellipse.result.id).bounds.x,350);
  const deleted=await rpc(id,'edit.clear');assert.ok(!flatten(deleted.document.layers).some(n=>n.id===ellipse.result.id));await rpc(id,'edit.undo');
  const saved=await rpc(id,'doc.save',{path:'edited.vectorcraft'});assert.equal(saved.document.dirty,false);assert.notEqual(sha(Buffer.from(await (await fetch(base+saved.preview)).arrayBuffer())),sha(before));
  const exported={};for(const format of ['svg','pdf','png']){await rpc(id,'doc.save',{path:`edited.${format}`});const bytes=Buffer.from(await (await fetch(`${base}/api/vectorcraft/sessions/${id}/output?path=edited.${format}`)).arrayBuffer());assert.ok(bytes.length>100);exported[format]=bytes.length;if(format==='png')assert.equal(bytes.subarray(1,4).toString(),'PNG');if(format==='pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-');}
  assert.equal(sha(original),sha(await readFile(path.join(temporary,'projects/vectorcraft/input.svg'))));
  const reopenedId=await create({});const reopened=await rpc(reopenedId,'doc.open',{path:'edited.vectorcraft'});assert.equal(flatten(reopened.document.layers).find(n=>n.id===ellipse.result.id).bounds.x,350);assert.equal(reopened.document.dirty,false);await api(`/api/vectorcraft/sessions/${reopenedId}`,'DELETE',{});
  const svgId=await create({});const svgReopened=await rpc(svgId,'doc.open',{path:'edited.svg'});assert.ok(flatten(svgReopened.document.layers).some(n=>Math.round(n.bounds?.x)===350));await api(`/api/vectorcraft/sessions/${svgId}`,'DELETE',{});
  const newId=await create({});await rpc(newId,'doc.new',{width:640,height:480,name:'Generated illustration'});await rpc(newId,'path.create',{anchors:[{x:20,y:20},{x:200,y:180},{x:400,y:40}]});await rpc(newId,'shape.star',{cx:300,cy:250,radius1:100,radius2:45,points:5});await rpc(newId,'shape.polygon',{cx:100,cy:350,radius:40,sides:6});await rpc(newId,'doc.save',{path:'new.vectorcraft'});await api(`/api/vectorcraft/sessions/${newId}`,'DELETE',{});
  const report={verifiedAt:new Date().toISOString(),nativeSvgOpenDrawFillSelectTransformUndoRedoDeleteSaveReopen:true,newCanvasPathStarPolygon:true,exportBytes:exported,originalByteIdentical:true,previewChanged:true,realBrowserPickerTest:false};
  const readRoot=path.join(temporary,'root-read'),writeRoot=path.join(temporary,'root-write');await mkdir(readRoot);await mkdir(writeRoot);await writeFile(path.join(temporary,'private.svg'),original);const engine=new EngineProcess(binary,readRoot,{args:[readRoot,writeRoot],configDir:writeRoot,allowedMethods:new Set(['open','new','command','export'])});try{await assert.rejects(engine.call('open',{path:path.join(temporary,'private.svg')}),/outside/);await engine.call('new',{width:100,height:100});await assert.rejects(engine.call('command',{command:'file.save',params:{path:path.join(temporary,'unsafe.svg')}}),/Unsupported/);await assert.rejects(engine.call('export',{path:path.join(temporary,'unsafe.svg'),format:'svg'}),/outside/);report.nativeReadWriteRootsEnforced=true;}finally{engine.stop();}
  if((await api('/api/storage/capabilities')).ondemand){
    files.set('selected.svg',original);files.set('unrelated.svg',Buffer.alloc(8*1024*1024));
    share=await api('/api/storage/shares','POST',{app:'vectorcraft',name:'Generated laptop vectors',mode:'ondemand',fill:false,keep:false,access:'readwrite'});
    agent=new WebSocket(base.replace('http','ws')+`/storage/agent?id=${share.id}`,{headers:{Origin:base}});
    agent.on('message',message=>{
      const id=message.readUInt32LE(0),length=message.readUInt32LE(4),head=JSON.parse(message.subarray(8,8+length)),data=message.subarray(8+length);let reply={},payload=Buffer.alloc(0);
      if(head.op==='list')reply.entries=[...files].map(([name,bytes])=>({name,kind:'file',size:bytes.length,mtime:Date.now()}));
      else if(head.op==='read'){const source=files.get(head.path);if(!source)reply={err:'ENOENT'};else{payload=source.subarray(head.off,head.off+head.len);reads.set(head.path,(reads.get(head.path)||0)+payload.length);}}
      else if(head.op==='write'){const old=head.trunc?Buffer.alloc(0):files.get(head.path)||Buffer.alloc(0),next=Buffer.alloc(Math.max(old.length,head.off+data.length));old.copy(next);data.copy(next,head.off);files.set(head.path,next);}
      else if(head.op==='remove')files.delete(head.path);else if(head.op==='rename'){const source=files.get(head.from);if(source){files.set(head.to,source);files.delete(head.from);}else reply={err:'ENOENT'};}
      else if(head.op!=='mkdir')reply={err:'ENOENT'};
      agent.send(frame(id,reply,payload));
    });await new Promise((resolve,reject)=>{agent.once('open',resolve);agent.once('error',reject);});
    const laptop=await create({sourceShareId:share.id,saveDestination:'laptop'});await rpc(laptop,'doc.open',{path:'selected.svg'});await rpc(laptop,'shape.rectangle',{x:400,y:300,width:200,height:100});const localSaved=await rpc(laptop,'doc.save',{path:'laptop-edited.vectorcraft'});assert.equal(localSaved.document.dirty,false);assert.ok(files.has('laptop-edited.vectorcraft'));assert.equal(reads.get('unrelated.svg')||0,0);assert.equal(sha(files.get('selected.svg')),sha(original));
    const localBytes=Buffer.from(await (await fetch(`${base}/api/vectorcraft/sessions/${laptop}/output?path=laptop-edited.vectorcraft`)).arrayBuffer());assert.equal(sha(localBytes),sha(files.get('laptop-edited.vectorcraft')));await api(`/api/vectorcraft/sessions/${laptop}`,'DELETE',{});
    const back=await create({sourceShareId:share.id,saveDestination:'laptop'});const backDoc=await rpc(back,'doc.open',{path:'laptop-edited.vectorcraft'});assert.ok(flatten(backDoc.document.layers).some(n=>Math.round(n.bounds?.x)===400));await api(`/api/vectorcraft/sessions/${back}`,'DELETE',{});
    report.onDemand={selectedReadBytes:reads.get('selected.svg'),unrelatedReadBytes:0,laptopSaveAcknowledged:true,downloadByteIdentical:true,reopenedFromLaptop:true};
    const serverDestination=await create({sourceShareId:share.id,saveDestination:'server'});await rpc(serverDestination,'doc.open',{path:'selected.svg'});await rpc(serverDestination,'shape.rectangle',{x:20,y:20,width:10,height:10});await rpc(serverDestination,'doc.save',{path:'from-laptop-to-server.vectorcraft'});assert.ok(!files.has('from-laptop-to-server.vectorcraft'));assert.ok(await readFile(path.join(temporary,'projects/vectorcraft/from-laptop-to-server.vectorcraft')));report.serverDestinationKeepsLaptopOriginal=true;
  }
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{for(const id of sessions)await api(`/api/vectorcraft/sessions/${id}`,'DELETE',{discard:true}).catch(()=>{});if(share)await api(`/api/storage/shares/${share.id}`,'DELETE',{}).catch(()=>{});agent?.terminate();if(server.listening)await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});}
