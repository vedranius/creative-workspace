import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {createWorkspaceServer} from '../src/server.js';
const temporary=await mkdtemp(path.join(os.tmpdir(),'cw-pdf-native-'));
const binary=process.env.CW_PDFCRAFT_BINARY;
const server=await createWorkspaceServer({dataDir:path.join(temporary,'data'),allowedRoots:[path.join(temporary,'projects')],rapidrawUrl:'http://127.0.0.1:1',pdfcraftOptions:binary?{binary}:{}});
let base,agent,share;const sessions=[];const files=new Map(),reads=new Map();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function api(route,method='GET',input){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:base},body:input===undefined?undefined:JSON.stringify(input)});const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error),{status:response.status});return value;}
const rpc=(id,method,params={})=>api(`/api/pdfcraft/sessions/${id}/rpc`,'POST',{method,params,requestId:randomUUID()});
const create=async input=>{const session=await api('/api/pdfcraft/sessions','POST',input);sessions.push(session.id);return session.id;};
function frame(id,header,body=Buffer.alloc(0)){const json=Buffer.from(JSON.stringify(header)),buffer=Buffer.alloc(8+json.length+body.length);buffer.writeUInt32LE(id);buffer.writeUInt32LE(json.length,4);json.copy(buffer,8);body.copy(buffer,8+json.length);return buffer;}
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await api('/api/engines/pdfcraft')).ownedRuntime,true);
  const id=await create({});await rpc(id,'doc.new',{name:'Generated native PDF',pages:2});
  const pristine=await rpc(id,'doc.save',{path:'input.pdf'});const original=await readFile(path.join(temporary,'projects/pdfcraft/input.pdf'));
  const before=Buffer.from(await (await fetch(base+pristine.preview)).arrayBuffer());
  const rotated=await rpc(id,'page.rotate',{degrees:90});assert.equal(rotated.document.pages[0].rotation,90);assert.notEqual(sha(Buffer.from(await (await fetch(base+rotated.preview)).arrayBuffer())),sha(before));
  const noted=await rpc(id,'comment.add',{contents:'Native server review'});assert.ok(noted.document.annotations.some(note=>note.contents==='Native server review'));
  const undone=await rpc(id,'edit.undo');assert.ok(!undone.document.annotations.some(note=>note.contents==='Native server review'));await rpc(id,'edit.redo');
  await rpc(id,'page.move',{to:2});await rpc(id,'edit.undo');await rpc(id,'text.extract');
  await rpc(id,'page.select',{page:2});const deleted=await rpc(id,'page.delete');assert.equal(deleted.document.pages.length,1);await rpc(id,'edit.undo');await rpc(id,'page.select',{page:1});
  const saved=await rpc(id,'doc.save',{path:'edited.pdf'});assert.equal(saved.documents[0].dirty,false);const output=Buffer.from(await (await fetch(`${base}/api/pdfcraft/sessions/${id}/output?path=edited.pdf`)).arrayBuffer());assert.ok(output.subarray(0,5).equals(Buffer.from('%PDF-')));assert.equal(sha(original),sha(await readFile(path.join(temporary,'projects/pdfcraft/input.pdf'))));
  const reopened=await rpc(id,'doc.open',{path:'edited.pdf'});assert.equal(reopened.document.pages[0].rotation,90);assert.equal(reopened.document.pages.length,2);assert.ok(reopened.document.annotations.some(note=>note.contents==='Native server review'));
  const report={verifiedAt:new Date().toISOString(),nativePdfOpenRotateNoteUndoRedoMoveDeleteTextSaveReopen:true,originalByteIdentical:true,editedPdfBytes:output.length,previewChanged:true,realBrowserPickerTest:false};
  if((await api('/api/storage/capabilities')).ondemand){
    files.set('selected.pdf',original);files.set('unrelated.pdf',Buffer.alloc(8*1024*1024));
    share=await api('/api/storage/shares','POST',{app:'pdfcraft',name:'Generated laptop PDFs',mode:'ondemand',fill:false,keep:false,access:'readwrite'});
    agent=new WebSocket(base.replace('http','ws')+`/storage/agent?id=${share.id}`,{headers:{Origin:base}});
    agent.on('message',message=>{const id=message.readUInt32LE(0),length=message.readUInt32LE(4),head=JSON.parse(message.subarray(8,8+length)),data=message.subarray(8+length);let reply={},payload=Buffer.alloc(0);
      if(head.op==='list')reply.entries=[...files].map(([name,bytes])=>({name,kind:'file',size:bytes.length,mtime:Date.now()}));
      else if(head.op==='read'){const source=files.get(head.path);if(!source)reply={err:'ENOENT'};else{payload=source.subarray(head.off,head.off+head.len);reads.set(head.path,(reads.get(head.path)||0)+payload.length);}}
      else if(head.op==='write'){const old=head.trunc?Buffer.alloc(0):files.get(head.path)||Buffer.alloc(0),next=Buffer.alloc(Math.max(old.length,head.off+data.length));old.copy(next);data.copy(next,head.off);files.set(head.path,next);}
      else if(head.op==='remove')files.delete(head.path);else if(head.op==='rename'){const source=files.get(head.from);if(source){files.set(head.to,source);files.delete(head.from);}else reply={err:'ENOENT'};}
      else if(head.op!=='mkdir')reply={err:'ENOENT'};
      agent.send(frame(id,reply,payload));
    });await new Promise((resolve,reject)=>{agent.once('open',resolve);agent.once('error',reject);});
    const laptop=await create({sourceShareId:share.id,saveDestination:'laptop'});await rpc(laptop,'doc.open',{path:'selected.pdf'});await rpc(laptop,'page.rotate',{degrees:90});const localSaved=await rpc(laptop,'doc.save',{path:'laptop-edited.pdf'});assert.equal(localSaved.documents[0].dirty,false);assert.ok(files.has('laptop-edited.pdf'));assert.equal(reads.get('unrelated.pdf')||0,0);assert.equal(sha(files.get('selected.pdf')),sha(original));
    const localBytes=Buffer.from(await (await fetch(`${base}/api/pdfcraft/sessions/${laptop}/output?path=laptop-edited.pdf`)).arrayBuffer());assert.equal(sha(localBytes),sha(files.get('laptop-edited.pdf')));
    await rpc(laptop,'doc.open',{path:'laptop-edited.pdf'});report.onDemand={selectedReadBytes:reads.get('selected.pdf'),unrelatedReadBytes:0,laptopSaveAcknowledged:true,downloadByteIdentical:true,reopenedFromLaptop:true};
    const serverDestination=await create({sourceShareId:share.id,saveDestination:'server'});await rpc(serverDestination,'doc.open',{path:'selected.pdf'});await rpc(serverDestination,'page.rotate',{degrees:90});await rpc(serverDestination,'doc.save',{path:'from-laptop-to-server.pdf'});assert.ok(!files.has('from-laptop-to-server.pdf'));assert.ok(await readFile(path.join(temporary,'projects/pdfcraft/from-laptop-to-server.pdf')));report.serverDestinationKeepsLaptopOriginal=true;
  }
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{for(const id of sessions)await api(`/api/pdfcraft/sessions/${id}`,'DELETE',{discard:true}).catch(()=>{});if(share)await api(`/api/storage/shares/${share.id}`,'DELETE',{}).catch(()=>{});agent?.terminate();if(server.listening)await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});}
