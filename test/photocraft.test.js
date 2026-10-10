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
    if(method==='engine.execute'){this.count++;this.document.revision++;return {count:this.count};}
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
  await assert.rejects(provider.execute(s.id,{method:'doc.save',params:{path:'existing.png'},requestId:'save-conflict'}),error=>error.status===409);
  assert.equal((await provider.execute(s.id,{method:'doc.save',params:{path:'existing.png',overwrite:true},requestId:'save-approved'})).result.path,'existing.png');
  await assert.rejects(provider.execute(s.id,{method:'state',requestId:'short'}),/requestId/);
});
