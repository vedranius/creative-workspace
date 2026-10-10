import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createStorageProvider} from '../src/storage-provider.js';
import {createWorkspaceServer} from '../src/server.js';

test('common local-folder provider isolates app roots and enforces concurrent share limits',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'cw-shares-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const provider=await createStorageProvider({dataDir:path.join(directory,'data'),fuseBin:path.join(directory,'missing-helper'),resolveAppRoot:async app=>{assert.ok(['photocraft','rapidraw'].includes(app));const root=path.join(directory,app);await mkdir(root,{recursive:true});return root;}});t.after(()=>provider.shutdown());
  const a=await provider.start({app:'photocraft',name:'Same name',mode:'transfer'}),b=await provider.start({app:'rapidraw',name:'Same name',mode:'transfer'});
  assert.notEqual(a.id,b.id);assert.notEqual(a.view,b.view);assert.equal(a.fill,false);assert.equal(a.keep,true);
  assert.throws(()=>provider.source(a.id,'rapidraw'),/does not belong/);
  await assert.rejects(provider.start({app:'photocraft',name:'../escape',mode:'transfer'}));
  const attempts=await Promise.allSettled(Array.from({length:7},(_,index)=>provider.start({app:'photocraft',name:`Folder ${index}`,mode:'transfer'})));
  assert.equal(attempts.filter(result=>result.status==='fulfilled').length,6);assert.equal(provider.list().length,8);
  assert.equal(provider.capabilities().ondemand,false);
  await provider.stop(a.id);assert.throws(()=>provider.source(a.id,'photocraft'),/does not belong/);
});

test('storage API enforces share ownership, save destination, active sessions and websocket origins',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'cw-storage-api-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const server=await createWorkspaceServer({dataDir:path.join(directory,'data'),allowedRoots:[path.join(directory,'projects')],maxUploadBytes:16,photocraftOptions:{binary:process.execPath,processFactory:()=>({closed:false,call:async()=>({active:null,documents:[]}),stop(){this.closed=true;}})}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={'Content-Type':'application/json',Origin:base};
  const api=(route,method='GET',body)=>fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const response=await api('/api/storage/shares','POST',{app:'photocraft',name:'Laptop copy',mode:'transfer'});assert.equal(response.status,201);const share=await response.json();
  const upload=await fetch(`${base}/api/storage/put?id=${share.id}&path=photo.png`,{method:'PUT',headers:{Origin:base,'Content-Type':'application/octet-stream'},body:Buffer.from('generated')});assert.equal(upload.status,204);
  assert.equal((await (await api(`/api/storage/shares/${share.id}/have`)).json())['photo.png'].size,9);
  assert.equal((await api(`/api/storage/shares/${share.id}/files?app=rapidraw`)).status,404);
  assert.equal((await api('/api/photocraft/sessions','POST',{sourceShareId:share.id,saveDestination:'laptop'})).status,403);
  const session=await (await api('/api/photocraft/sessions','POST',{sourceShareId:share.id,saveDestination:'server'})).json();
  assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,409);
  const denied=new WebSocket(base.replace('http','ws')+`/storage/agent?id=${share.id}`,{headers:{Origin:'http://foreign.example'}});
  assert.equal(await new Promise(resolve=>{denied.on('unexpected-response',(_request,res)=>{resolve(res.statusCode);res.resume();denied.terminate();});denied.on('error',()=>{});}),403);
  const agent=new WebSocket(base.replace('http','ws')+`/storage/agent?id=${share.id}`,{headers:{Origin:base}});await once(agent,'open');
  const invalid=Buffer.alloc(8);invalid.writeUInt32LE(9000,4);agent.send(invalid);const [code]=await once(agent,'close');assert.equal(code,1008);
  assert.equal((await api(`/api/photocraft/sessions/${session.id}`,'DELETE',{})).status,200);
  assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,200);
  assert.deepEqual(await api('/api/storage/shares').then(response=>response.json()),[]);
  assert.deepEqual(await readdir(path.join(directory,'data/local-folders/stage')).catch(()=>[]),[]);
});
