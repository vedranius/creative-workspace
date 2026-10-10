import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createStorageRecovery} from '../src/storage-recovery.js';
import {createWorkspaceServer} from '../src/server.js';

async function fixture(t){
  const directory=await mkdtemp(path.join(os.tmpdir(),'cw-recovery-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const work=path.join(directory,'data/local-folders'),appRoot=path.join(directory,'projects/photocraft');
  await mkdir(work,{recursive:true});await mkdir(appRoot,{recursive:true});
  const resolveAppRoot=async app=>{assert.equal(app,'photocraft');return appRoot;};
  const metadata={id:'1234567890abcdef',app:'photocraft',name:'Laptop',mirror:path.join(work,'mirror/1234567890abcdef/Laptop')};
  await mkdir(metadata.mirror,{recursive:true});
  return {directory,work,metadata,resolveAppRoot,journal:createStorageRecovery({work,resolveAppRoot})};
}

test('recovery survives a provider restart and an old ACK cannot remove a newer write',async t=>{
  const {work,metadata,resolveAppRoot,journal}=await fixture(t);
  const old=await journal.begin(metadata,'document.pcraft');
  await writeFile(path.join(metadata.mirror,'document.pcraft'),'layered output');
  const current=await journal.begin(metadata,'document.pcraft');
  assert.equal(await journal.acknowledge(metadata.id,'document.pcraft',old),false);
  assert.equal(await journal.update(metadata.id,'document.pcraft',old,'failed','old failure'),false);
  const restarted=createStorageRecovery({work,resolveAppRoot});
  const record=(await restarted.list('photocraft')).records[0];
  assert.equal(record.state,'writing');assert.equal(record.mayBeIncomplete,true);assert.equal(record.downloadAvailable,true);
  assert.equal((await restarted.list('rapidraw')).records.length,0);
  const file=await restarted.output(record.id,'photocraft');
  try{assert.equal(await file.handle.readFile('utf8'),'layered output');}finally{await file.handle.close();}
  await assert.rejects(restarted.output(record.id,'rapidraw'),error=>error.status===404);
  await restarted.update(metadata.id,'document.pcraft',current,'unacknowledged');
  await restarted.relocate(metadata.id,'document.pcraft','renamed.pcraft');
  await assert.rejects(restarted.output(record.id,'photocraft'),error=>error.status===404);
  assert.equal(await restarted.acknowledge(metadata.id,'renamed.pcraft',current),true);
  assert.equal(await restarted.has(metadata.id),false);assert.deepEqual((await restarted.list()).records,[]);
});

test('invalid recovery manifests and mirror traversal cannot grant file access',async t=>{
  const {directory,work,metadata,journal}=await fixture(t);
  await journal.begin(metadata,'output.png','unacknowledged');
  await writeFile(path.join(metadata.mirror,'output.png'),'permitted');
  const manifestFile=path.join(work,'recovery',`${metadata.id}.json`);
  const valid=JSON.parse(await readFile(manifestFile,'utf8'));
  const record=(await journal.list()).records[0];
  const outside=path.join(directory,'outside');await mkdir(outside);await writeFile(path.join(outside,'output.png'),'private');
  await writeFile(manifestFile,JSON.stringify({...valid,mirror:outside}));
  assert.equal((await journal.list()).records[0].downloadAvailable,false);
  await assert.rejects(journal.output(record.id),error=>error.status===403);
  valid.files[0].relativePath='../outside/output.png';await writeFile(manifestFile,JSON.stringify(valid));
  assert.equal((await journal.list()).invalidManifests,1);assert.deepEqual((await journal.list()).records,[]);
  await assert.rejects(journal.output(record.id));
});

test('recovery refuses symbolic links in its journal and output namespaces',async t=>{
  const {directory,work,metadata,journal}=await fixture(t);
  const outside=path.join(directory,'outside');await mkdir(outside);await writeFile(path.join(outside,'secret.png'),'private');
  await journal.begin(metadata,'output.png');
  try{await symlink(path.join(outside,'secret.png'),path.join(metadata.mirror,'output.png'));}
  catch(error){if(['EPERM','EACCES','ENOSYS'].includes(error.code)){t.skip('Host does not permit test symlinks');return;}throw error;}
  const record=(await journal.list()).records[0];assert.equal(record.downloadAvailable,false);
  await assert.rejects(journal.output(record.id),error=>error.status===403);
  await rm(path.join(work,'recovery'),{recursive:true});await symlink(outside,path.join(work,'recovery'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(journal.list(),error=>error.status===403);
  await assert.rejects(journal.begin(metadata,'new.png'),error=>error.status===403);
});

test('failed laptop ACK is retained through Stop and gateway restart with an authenticated download',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'cw-recovery-api-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const options={dataDir:path.join(directory,'data'),allowedRoots:[path.join(directory,'projects')],auth:'fixture:password'};
  let server;
  const start=async()=>{server=await createWorkspaceServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;};
  t.after(async()=>{if(server?.listening)await new Promise(resolve=>server.close(resolve));});
  let base=await start();
  const authorization=`Basic ${Buffer.from(options.auth).toString('base64')}`;
  const api=(route,method='GET',body)=>fetch(base+route,{method,headers:{authorization,Origin:base,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const share=await (await api('/api/storage/shares','POST',{app:'photocraft',name:'Laptop',mode:'transfer',access:'readwrite'})).json();assert.ok(share.id);
  const agent=new WebSocket(base.replace('http','ws')+`/storage/agent?id=${share.id}`,{headers:{authorization,Origin:base}});
  agent.on('error',()=>{});t.after(()=>agent.terminate());await once(agent,'open');
  agent.on('message',data=>{
    const q=data.readUInt32LE(0),length=data.readUInt32LE(4),head=JSON.parse(data.subarray(8,8+length));
    assert.equal(head.op,'write');
    if(head.path==='network.pcraft'){agent.terminate();return;}
    const reply=Buffer.from(JSON.stringify({err:'EACCES'})),frame=Buffer.alloc(8+reply.length);frame.writeUInt32LE(q);frame.writeUInt32LE(reply.length,4);reply.copy(frame,8);agent.send(frame);
  });
  const bytes=Buffer.from('generated output retained after missing laptop ACK');
  await writeFile(path.join(share.mirror,'document.pcraft'),bytes);
  let record;
  for(let attempt=0;attempt<100;attempt++){
    record=(await (await api('/api/storage/recovery?app=photocraft')).json()).records[0];
    if(record?.state==='failed')break;
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  assert.equal(record?.state,'failed');assert.equal(record.mayBeIncomplete,false);assert.equal(record.downloadAvailable,true);
  const lostAck=once(agent,'close');
  const networkBytes=Buffer.from('generated output whose final ACK is lost');
  await writeFile(path.join(share.mirror,'network.pcraft'),networkBytes);await lostAck;
  const pending=(await (await api('/api/storage/recovery?app=photocraft')).json()).records.find(item=>item.relativePath==='network.pcraft');
  assert.equal(pending.state,'unacknowledged');assert.equal(pending.downloadAvailable,true);
  assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,200);
  assert.deepEqual(await readFile(path.join(share.mirror,'document.pcraft')),bytes);
  await new Promise(resolve=>server.close(resolve));base=await start();
  assert.equal((await fetch(base+'/api/storage/recovery')).status,401);
  const recovered=(await (await api('/api/storage/recovery?app=photocraft')).json()).records;assert.equal(recovered.find(item=>item.relativePath==='document.pcraft').id,record.id);assert.equal(recovered.find(item=>item.id===pending.id).state,'failed');
  const response=await api(`/api/storage/recovery/${record.id}/output?app=photocraft`);assert.equal(response.status,200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  assert.deepEqual(Buffer.from(await (await api(`/api/storage/recovery/${pending.id}/output?app=photocraft`)).arrayBuffer()),networkBytes);
  assert.equal((await api(`/api/storage/recovery/${record.id}/output?app=rapidraw`)).status,404);
});
