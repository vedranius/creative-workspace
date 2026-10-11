import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,rm,readFile,writeFile,symlink} from 'node:fs/promises';
import {createDesignCraft} from '../src/designcraft.js';
import {createWorkspaceServer} from '../src/server.js';

// Protocol fixture only. Actual parsing/rendering/export is verified by smoke-designcraft.mjs.
class DesignFixture{
  constructor(){this.closed=false;this.doc=null;this.edits=0;this.sampleCommandId=null;}
  async call(method,p={}){
    if(method==='__cw_identity')return {runtimeId:'creative-workspace-designcraft-v1',version:'fixture'};
    if(method==='state')return this.doc?structuredClone(this.doc):null;
    if(method==='new'||method==='open'){this.doc={title:'Fixture',dirty:method==='new',pageCount:1,spreads:[{index:0,pages:[{index:0,name:'1',bounds:[0,0,800,600]}],items:[]}],stories:[],layers:[],selection:{items:[]},history:{undo:[],redo:[]}};return {};}
    if(method==='sample'){this.sampleCommandId='file.newSample';this.doc={title:'Original sample',dirty:true,pageCount:2,spreads:[{index:0,pages:[{index:0,name:'1',bounds:[0,0,800,600]}],items:[]}],stories:[],layers:[],selection:{items:[]},history:{undo:[],redo:[]}};return {commandId:this.sampleCommandId};}
    if(method==='render'){const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(800,16);png.writeUInt32BE(600,20);return {pngBase64:png.toString('base64')};}
    if(method==='command'){this.edits++;this.doc.dirty=true;return {id:1};}
    if(method==='export'){await writeFile(p.path,'fixture design copy');return {warnings:[]};}
    if(method==='mark_saved'){this.doc.dirty=false;return {saved:true};}throw new Error('Unsupported fixture method');
  }
  stop(){this.closed=true;}
}
async function fixture(t,extra={}){const root=await mkdtemp(path.join(os.tmpdir(),'cw-design-fixture-')),project=path.join(root,'project'),engines=[];await mkdir(project);const design=createDesignCraft({binary:process.execPath,stateDir:path.join(root,'sessions'),processFactory:()=>{const engine=new DesignFixture();engines.push(engine);return engine;},...extra});t.after(()=>design.shutdown());t.after(()=>rm(root,{recursive:true,force:true}));const call=(id,method,params={},extra={})=>design.execute(id,{method,params,requestId:crypto.randomUUID(),...extra});return {root,project,design,engines,call};}

test('Design sample is created by the owned worker with the original command ID and a revisioned render',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  const sampled=await call(session.id,'doc.sample');
  const activeWorker=engines.find(engine=>!engine.closed);assert.equal(activeWorker?.sampleCommandId,'file.newSample');assert.equal(sampled.stateVersion,1);assert.equal(sampled.document.name,'Sample Document');assert.match(sampled.preview,/preview\.png\?v=1$/);assert.ok(design.preview(session.id,1).length>0);
  await assert.rejects(call(session.id,'doc.sample'),/save and close/i);await design.close(session.id,{discard:true});
});

test('Design sessions isolate state, deduplicate edits and refuse stale/colliding output',async t=>{
  const {project,design,engines,call}=await fixture(t,{maxSessions:2});await writeFile(path.join(project,'original.designcraft'),'fixture native original');
  const [a,b]=await Promise.all([design.create(project),design.create(project)]);const opened=await call(a.id,'doc.open',{path:'original.designcraft'});assert.equal(opened.document.dirty,false);assert.equal((await call(b.id,'state')).document,null);
  const edit={method:'frame.create',params:{rect:[10,10,90,60],content:'text',text:'Fixture story'},requestId:'design-edit-request',expectedVersion:opened.stateVersion};
  await Promise.all([design.execute(a.id,edit),design.execute(a.id,edit)]);assert.equal(engines.reduce((n,e)=>n+e.edits,0),1);
  await assert.rejects(call(a.id,'edit.undo',{},{expectedVersion:opened.stateVersion}),e=>e.code==='STATE_VERSION_CONFLICT');await assert.rejects(design.execute(a.id,{...edit,params:{x:0}}),e=>e.status===409);
  await assert.rejects(call(a.id,'doc.save',{path:'original.designcraft'}),e=>e.status===409);assert.equal(await readFile(path.join(project,'original.designcraft'),'utf8'),'fixture native original');
  const exported=await call(a.id,'doc.save',{path:'view.pdf'});assert.equal(exported.document.dirty,true);assert.equal(exported.result.savedDocument,false);
  const saved=await call(a.id,'doc.save',{path:'copy.designcraft'});assert.equal(saved.document.dirty,false);assert.ok(await readFile(await design.output(a.id,'copy.designcraft')));await assert.rejects(design.output(b.id,'copy.designcraft'),e=>e.status===403);
  await assert.rejects(design.create(project),/session limit/);await design.close(a.id);await assert.rejects(call(a.id,'state'),e=>e.status===404);
});

test('Design confines inputs/outputs, filters native parameters and keeps failed ACK dirty',async t=>{
  let acknowledged=false;const {root,project,design,engines,call}=await fixture(t,{settleOutput:async()=>{if(!acknowledged)throw new Error('Laptop ACK missing');}});
  await writeFile(path.join(root,'outside.designcraft'),'fixture native private');const session=await design.create(project,{shareId:'fixture-share',laptopOutput:true});
  await assert.rejects(call(session.id,'doc.open',{path:'../outside.designcraft'}),/relative path/);await symlink(path.join(root,'outside.designcraft'),path.join(project,'escape.designcraft')).catch(e=>{if(!['EPERM','EACCES'].includes(e.code))throw e;});
  try{await readFile(path.join(project,'escape.designcraft'));await assert.rejects(call(session.id,'doc.open',{path:'escape.designcraft'}),/outside/);}catch(e){if(e.code!=='ENOENT')throw e;}
  await call(session.id,'doc.new',{width:800,height:600,pages:1});const count=engines.reduce((n,e)=>n+e.edits,0);
  await assert.rejects(call(session.id,'frame.create',{rect:[NaN,0,5,5],content:'text'}),/Invalid/);await assert.rejects(call(session.id,'swatch.create',{color:'url(file:///private)'}),/hex/);await assert.rejects(call(session.id,'story.setText',{story:1,text:'x'.repeat(20001)}),/20,000/);await assert.rejects(call(session.id,'document.open',{path:'private.designcraft'}),/Unsupported/);assert.equal(engines.reduce((n,e)=>n+e.edits,0),count);
  await assert.rejects(call(session.id,'doc.save',{path:'../escape.designcraft'}),/relative path/);await assert.rejects(call(session.id,'doc.save',{path:'uncertain.designcraft'}),/ACK missing/);assert.equal((await call(session.id,'state')).document.dirty,true);await assert.rejects(design.output(session.id,'uncertain.designcraft'),e=>e.status===403);await assert.rejects(design.close(session.id),e=>e.status===409);
  acknowledged=true;const saved=await call(session.id,'doc.save',{path:'confirmed.designcraft'});assert.equal(saved.document.dirty,false);assert.ok(await readFile(path.join(project,'uncertain.designcraft')));await design.close(session.id);
});

test('Design gateway enforces auth/origin, share ownership and approved output',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cw-design-api-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const server=await createWorkspaceServer({dataDir:path.join(root,'data'),allowedRoots:[path.join(root,'projects')],auth:'design:password',designcraftOptions:{binary:process.execPath,processFactory:()=>new DesignFixture()}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Basic ${Buffer.from('design:password').toString('base64')}`,'Content-Type':'application/json',Origin:base},api=(route,method='GET',body)=>fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await fetch(base+'/api/engines/designcraft')).status,401);assert.equal((await api('/apps/designcraft/')).status,200);assert.equal((await fetch(base+'/api/designcraft/sessions',{method:'POST',headers:{...headers,Origin:'https://foreign.test'},body:'{}'})).status,403);
  const session=await (await api('/api/designcraft/sessions','POST',{})).json(),rpc=(method,params={})=>api(`/api/designcraft/sessions/${session.id}/rpc`,'POST',{method,params,requestId:crypto.randomUUID()});
  assert.equal((await rpc('doc.new',{width:800,height:600,pages:1})).status,200);assert.equal((await rpc('doc.save',{path:'copy.designcraft'})).status,200);assert.equal((await api(`/api/designcraft/sessions/${session.id}/output?path=copy.designcraft`)).status,200);assert.equal((await api(`/api/designcraft/sessions/${session.id}/output?path=outside.designcraft`)).status,403);
  const foreign=await (await api('/api/storage/shares','POST',{app:'photocraft',name:'Other app',mode:'transfer'})).json();assert.equal((await api('/api/designcraft/sessions','POST',{sourceShareId:foreign.id,saveDestination:'server'})).status,404);
  const share=await (await api('/api/storage/shares','POST',{app:'designcraft',name:'Design copy',mode:'transfer',access:'read'})).json();assert.equal((await api('/api/designcraft/sessions','POST',{sourceShareId:share.id,saveDestination:'laptop'})).status,403);const shared=await (await api('/api/designcraft/sessions','POST',{sourceShareId:share.id,saveDestination:'server'})).json();assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,409);assert.equal((await api(`/api/designcraft/sessions/${shared.id}`,'DELETE',{})).status,200);assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,200);
});

test('Design readiness refuses an unrelated engine',async t=>{const {design,project}=await fixture(t,{processFactory:()=>({call:async()=>({runtimeId:'unrelated-design-tool'}),stop(){}})});assert.equal((await design.status()).ready,false);await assert.rejects(design.create(project),e=>e.status===503);});

test('Design refuses incomplete multi-file exports before publishing or acknowledging',async t=>{
  class LinkedFixture extends DesignFixture{async call(method,p){const result=await super.call(method,p);if(method==='export')await writeFile(path.join(path.dirname(p.path),'linked.png'),'fixture asset');return result;}}
  const {design,project,call}=await fixture(t,{processFactory:()=>new LinkedFixture()});const session=await design.create(project);await call(session.id,'doc.new',{width:800,height:600,pages:1});
  await assert.rejects(call(session.id,'doc.save',{path:'incomplete.pdf'}),e=>e.status===422);await assert.rejects(readFile(path.join(project,'incomplete.pdf')),e=>e.code==='ENOENT');assert.equal((await call(session.id,'state')).document.dirty,true);await assert.rejects(design.output(session.id,'incomplete.pdf'),e=>e.status===403);
});
