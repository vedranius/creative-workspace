import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createPhotoCraft} from '../src/photocraft.js';

class FixtureEngine{
  constructor(){this.closed=false;this.count=0;this.document=null;this.saved=null;}
  async call(method,params={}){
    if(method==='session.list')return {active:this.document?0:null,documents:this.document?[{index:0,path:this.saved,dirty:!this.saved}]:[]};
    if(method==='doc.inspect')return this.document;
    if(method==='doc.render')return {base64:Buffer.from('preview').toString('base64')};
    if(method==='doc.new'){this.document={width:128,height:128,layers:[],revision:0};return {};}
    if(method==='doc.save'){this.saved=params.path;return {path:params.path};}
    if(method==='engine.execute'){this.count++;this.document.revision++;if(params.command==='partial-failure')throw new Error('fixture partial failure');return {count:this.count};}
    throw new Error(`Unsupported fixture method ${method}`);
  }
  stop(){this.closed=true;}
}
test('PhotoCraft sessions isolate state and deduplicate mutating request IDs',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cw-photo-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const provider=createPhotoCraft({binary:process.execPath,stateDir:path.join(root,'state'),processFactory:()=>new FixtureEngine(),maxSessions:2});t.after(()=>provider.shutdown());
  const [a,b]=await Promise.all([provider.create(root),provider.create(root)]);assert.notEqual(a.id,b.id);
  await provider.execute(a.id,{method:'doc.new',requestId:'new-request-a'});await provider.execute(b.id,{method:'doc.new',requestId:'new-request-b'});
  const mutation={method:'engine.execute',params:{command:'test'},requestId:'mutating-request'};
  const [first,retry]=await Promise.all([provider.execute(a.id,mutation),provider.execute(a.id,mutation)]);assert.equal(first.result.count,1);assert.equal(retry.result.count,1);
  await assert.rejects(provider.execute(a.id,{...mutation,params:{command:'different'}}),/different operation/);
  assert.equal((await provider.execute(b.id,{method:'state',requestId:'state-request-b'})).document.revision,0);
  await assert.rejects(provider.create(root),/session limit/);
  provider.close(a.id);await assert.rejects(provider.execute(a.id,{method:'state',requestId:'state-after-close'}),/not available/);
});
test('PhotoCraft refuses escaping paths, managed preview writes and accidental overwrites',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cw-photo-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const provider=createPhotoCraft({binary:process.execPath,stateDir:path.join(root,'state'),processFactory:()=>new FixtureEngine()});t.after(()=>provider.shutdown());
  const s=await provider.create(root);await provider.execute(s.id,{method:'doc.new',requestId:'new-document'});
  await assert.rejects(provider.execute(s.id,{method:'doc.open',params:{path:'../outside.png'},requestId:'escape-request'}),/relative path/);
  await assert.rejects(provider.execute(s.id,{method:'doc.save',params:{path:'C:outside.png'},requestId:'drive-request'}),/relative path/);
  await assert.rejects(provider.execute(s.id,{method:'doc.render',params:{path:'preview.png'},requestId:'preview-write'}),/managed/);
  await writeFile(path.join(root,'existing.png'),'original');
  await assert.rejects(provider.execute(s.id,{method:'doc.save',params:{path:'existing.png'},requestId:'save-conflict'}),error=>error.status===409&&error.code==='OUTPUT_EXISTS');
  assert.equal((await provider.execute(s.id,{method:'doc.save',params:{path:'existing.png',overwrite:true},requestId:'save-approved'})).result.path,'existing.png');
  await assert.rejects(provider.execute(s.id,{method:'state',requestId:'short'}),/requestId/);
});

test('PhotoCraft version guards serialize clients, deduplicate retries and invalidate changed or failed state',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cw-photo-versions-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const engine=new FixtureEngine();const provider=createPhotoCraft({binary:process.execPath,stateDir:path.join(root,'state'),processFactory:()=>engine});t.after(()=>provider.shutdown());
  const session=await provider.create(root);
  const call=(method,params={},extra={})=>provider.execute(session.id,{method,params,requestId:crypto.randomUUID(),...extra});
  const empty=await call('state');assert.equal(empty.stateVersion,0);
  const created=await call('doc.new',{}, {expectedVersion:empty.stateVersion});
  assert.equal(created.stateVersion,1);assert.equal((await call('state')).stateVersion,created.stateVersion);
  const edit={method:'engine.execute',params:{command:'test'},requestId:'guarded-edit-request',expectedVersion:created.stateVersion};
  const outcomes=await Promise.allSettled([provider.execute(session.id,edit),call('engine.execute',{command:'test'},{expectedVersion:created.stateVersion})]);
  assert.equal(outcomes[0].status,'fulfilled');assert.equal(outcomes[1].status,'rejected');assert.equal(outcomes[1].reason.status,409);assert.equal(outcomes[1].reason.code,'STATE_VERSION_CONFLICT');assert.equal(engine.count,1);
  const changed=outcomes[0].value;assert.equal(changed.stateVersion,2);
  const retry=await provider.execute(session.id,edit);assert.equal(retry.stateVersion,changed.stateVersion);assert.equal(engine.count,1);
  await assert.rejects(provider.execute(session.id,{...edit,expectedVersion:changed.stateVersion}),error=>error.status===409);
  const legacy=await call('engine.execute',{command:'test'});assert.equal(legacy.stateVersion,3);
  await assert.rejects(call('engine.execute',{command:'test'},{expectedVersion:changed.stateVersion}),error=>error.status===409);assert.equal(engine.count,2);
  const other=await call('doc.new',{}, {expectedVersion:legacy.stateVersion});assert.equal(other.document.revision,0);assert.equal(other.stateVersion,4);
  await assert.rejects(call('engine.execute',{command:'test'},{expectedVersion:legacy.stateVersion}),error=>error.status===409);
  await assert.rejects(call('engine.execute',{command:'partial-failure'},{expectedVersion:other.stateVersion}),/partial failure/);
  const failed=await call('state');assert.equal(failed.stateVersion,5);assert.equal(failed.document.revision,1);
  await assert.rejects(call('engine.execute',{command:'test'},{expectedVersion:other.stateVersion}),error=>error.status===409);
  engine.document.revision++; // Simulate native work finishing outside a gateway mutation.
  await assert.rejects(call('engine.execute',{command:'test'},{expectedVersion:failed.stateVersion}),error=>error.status===409);
  assert.equal((await call('state')).stateVersion,6);assert.equal(engine.count,3);
  for(const expectedVersion of [-1,0.5,'6',null,Number.MAX_SAFE_INTEGER+1])await assert.rejects(call('doc.new',{}, {expectedVersion}),/safe integer/);
});
