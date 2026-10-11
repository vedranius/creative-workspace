// Real installed PhotoCraft engine; isolated gateway and generated documents.
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createWorkspaceServer} from '../src/server.js';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const binary=process.env.CW_PHOTOCRAFT_BINARY||path.join(repo,`data/engines/photocraft/build/release/photocraft-cli${process.platform==='win32'?'.exe':''}`);
const directory=await mkdtemp(path.join(os.tmpdir(),'cw-native-version-proof-'));
const server=await createWorkspaceServer({dataDir:path.join(directory,'data'),allowedRoots:[path.join(directory,'projects')],photocraftOptions:{binary},rapidrawUrl:'http://127.0.0.1:1'});
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');let base,id;
async function api(route,method='GET',body){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:base},body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error),{status:response.status,code:value.code});return value;}
const rpc=(method,params={},extra={})=>api(`/api/photocraft/sessions/${id}/rpc`,'POST',{method,params,requestId:randomUUID(),...extra});
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  id=(await api('/api/photocraft/sessions','POST',{})).id;
  const empty=await rpc('state');assert.equal(empty.stateVersion,0);
  const created=await rpc('doc.new',{name:'Version proof',width:48,height:32,mode:'rgb',depth:8,background:'white'},{expectedVersion:empty.stateVersion});
  const layered=await rpc('engine.execute',{command:'layer.new.layer',params:{name:'Midtone proof'},wait:true},{expectedVersion:created.stateVersion});
  const original=await rpc('engine.execute',{command:'paint.stroke',params:{points:[[8,8,1],[40,24,1]],size:14,color:'#808080'},wait:true},{expectedVersion:layered.stateVersion});
  let before=Buffer.from(await (await fetch(base+original.preview)).arrayBuffer());
  const commands=(await rpc('engine.commands')).result;const adjustment=commands.find(command=>command.id==='image.adjustments.brightnessContrast');assert.ok(adjustment);assert.ok(commands.some(command=>command.id==='edit.undo'));
  const makeEdit=expectedVersion=>({method:'engine.execute',params:{command:adjustment.id,params:{brightness:-40,contrast:10},wait:true},requestId:randomUUID(),expectedVersion});
  let edit=makeEdit(original.stateVersion);
  const route=`/api/photocraft/sessions/${id}/rpc`;
  const results=await Promise.allSettled([api(route,'POST',edit),rpc('engine.execute',{command:'edit.undo',params:{},wait:true},{expectedVersion:original.stateVersion})]);
  const accepted=results.filter(result=>result.status==='fulfilled');assert.equal(accepted.length,1,'exactly one mutation may win the concurrent version race');
  const stale=results.find(result=>result.status==='rejected');assert.equal(stale.reason.status,409);assert.equal(stale.reason.code,'STATE_VERSION_CONFLICT');
  let edited;
  if(results[0].status==='fulfilled')edited=results[0].value;
  else{
    // The undo can win the race too. Continue from its acknowledged version and
    // compare against that preview instead of assuming scheduler ordering.
    const concurrentUndo=results[1].value;before=Buffer.from(await (await fetch(base+concurrentUndo.preview)).arrayBuffer());
    edit=makeEdit(concurrentUndo.stateVersion);edited=await api(route,'POST',edit);
  }
  const after=Buffer.from(await (await fetch(base+edited.preview)).arrayBuffer());assert.notEqual(digest(before),digest(after));
  const retry=await api(route,'POST',edit);assert.equal(retry.stateVersion,edited.stateVersion);assert.equal(retry.document.revision,edited.document.revision);
  const second=await rpc('doc.new',{name:'Other document',width:12,height:8,mode:'rgb',depth:8,background:'black'},{expectedVersion:edited.stateVersion});
  await assert.rejects(rpc('engine.execute',{command:adjustment.id,params:{brightness:10},wait:true},{expectedVersion:edited.stateVersion}),error=>error.status===409);
  const selected=await rpc('doc.select',{index:0},{expectedVersion:second.stateVersion});
  assert.equal(selected.document.revision,edited.document.revision);assert.ok(selected.stateVersion>edited.stateVersion);
  await assert.rejects(rpc('engine.execute',{command:'edit.undo',params:{},wait:true},{expectedVersion:edited.stateVersion}),error=>error.status===409);
  const undone=await rpc('engine.execute',{command:'edit.undo',params:{},wait:true},{expectedVersion:selected.stateVersion});
  const undonePreview=Buffer.from(await (await fetch(base+undone.preview)).arrayBuffer());assert.equal(digest(undonePreview),digest(before));
  const saved=await rpc('doc.save',{path:'version-proof.pcraft',format:'pcraft'},{expectedVersion:undone.stateVersion});
  const bytes=Buffer.from(await (await fetch(`${base}/api/photocraft/sessions/${id}/output?path=version-proof.pcraft`)).arrayBuffer());assert.ok(bytes.length>100);
  const reopened=await rpc('doc.open',{path:'version-proof.pcraft'},{expectedVersion:saved.stateVersion});assert.equal(reopened.document.width,48);assert.equal(reopened.document.height,32);
  const report={verifiedAt:new Date().toISOString(),test:'real native PhotoCraft through isolated gateway version guards',commands:commands.length,adjustment,previewChanged:true,oneConcurrentMutationAccepted:true,staleConcurrentMutationRejected:409,retryDidNotMutateAgain:true,documentSwitchRejectedStaleToken:true,sameDocumentRevisionAfterSwitch:true,sessionVersionChangedAfterSwitch:true,undoRestoredPreview:true,layeredSaveBytes:bytes.length,reopened:true,transport:'gateway JSON RPC; MCP endpoint not implemented'};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{if(id)await api(`/api/photocraft/sessions/${id}`,'DELETE',{}).catch(()=>{});if(server.listening)await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
