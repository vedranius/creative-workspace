import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,rm,readFile,writeFile,symlink} from 'node:fs/promises';
import {createVectorCraft} from '../src/vectorcraft.js';
import {createWorkspaceServer} from '../src/server.js';

// Protocol fixture only. Actual parsing/rendering/export is verified by smoke-vectorcraft.mjs.
class VectorFixture{
  constructor(){this.closed=false;this.doc=null;this.edits=0;}
  async call(method,p={}){
    if(method==='__cw_identity')return {runtimeId:'creative-workspace-vectorcraft-v1',version:'fixture'};
    if(method==='state')return this.doc?structuredClone(this.doc):null;
    if(method==='new'||method==='open'){this.doc={title:'Fixture',dirty:method==='new',artboards:[{x:0,y:0,width:800,height:600}],layers:[],selection:[],history:[],redo:[],objects:0};return {};}
    if(method==='render')return {pngBase64:Buffer.from('fixture preview').toString('base64')};
    if(method==='command'){this.edits++;this.doc.dirty=true;return {id:1};}
    if(method==='export'){await writeFile(p.path,'fixture vector copy');return {warnings:[]};}
    if(method==='mark_saved'){this.doc.dirty=false;return {saved:true};}throw new Error('Unsupported fixture method');
  }
  stop(){this.closed=true;}
}
async function fixture(t,extra={}){const root=await mkdtemp(path.join(os.tmpdir(),'cw-vector-fixture-')),project=path.join(root,'project'),engines=[];await mkdir(project);const vector=createVectorCraft({binary:process.execPath,stateDir:path.join(root,'sessions'),processFactory:()=>{const engine=new VectorFixture();engines.push(engine);return engine;},...extra});t.after(()=>vector.shutdown());t.after(()=>rm(root,{recursive:true,force:true}));const call=(id,method,params={},extra={})=>vector.execute(id,{method,params,requestId:crypto.randomUUID(),...extra});return {root,project,vector,engines,call};}

test('Vector sessions isolate state, deduplicate edits and refuse stale/colliding output',async t=>{
  const {project,vector,engines,call}=await fixture(t,{maxSessions:2});await writeFile(path.join(project,'original.svg'),'<svg original/>');
  const [a,b]=await Promise.all([vector.create(project),vector.create(project)]);const opened=await call(a.id,'doc.open',{path:'original.svg'});assert.equal(opened.document.dirty,false);assert.equal((await call(b.id,'state')).document,null);
  const edit={method:'shape.rectangle',params:{x:10,y:10,width:80,height:50},requestId:'vector-edit-request',expectedVersion:opened.stateVersion};
  await Promise.all([vector.execute(a.id,edit),vector.execute(a.id,edit)]);assert.equal(engines.reduce((n,e)=>n+e.edits,0),1);
  await assert.rejects(call(a.id,'edit.undo',{},{expectedVersion:opened.stateVersion}),e=>e.code==='STATE_VERSION_CONFLICT');await assert.rejects(vector.execute(a.id,{...edit,params:{x:0}}),e=>e.status===409);
  await assert.rejects(call(a.id,'doc.save',{path:'original.svg'}),e=>e.status===409);assert.equal(await readFile(path.join(project,'original.svg'),'utf8'),'<svg original/>');
  const exported=await call(a.id,'doc.save',{path:'view.svg'});assert.equal(exported.document.dirty,true);assert.equal(exported.result.savedDocument,false);
  const saved=await call(a.id,'doc.save',{path:'copy.vectorcraft'});assert.equal(saved.document.dirty,false);assert.ok(await readFile(await vector.output(a.id,'copy.vectorcraft')));await assert.rejects(vector.output(b.id,'copy.vectorcraft'),e=>e.status===403);
  await assert.rejects(vector.create(project),/session limit/);await vector.close(a.id);await assert.rejects(call(a.id,'state'),e=>e.status===404);
});

test('Vector confines inputs/outputs, filters native parameters and keeps failed ACK dirty',async t=>{
  let acknowledged=false;const {root,project,vector,engines,call}=await fixture(t,{settleOutput:async()=>{if(!acknowledged)throw new Error('Laptop ACK missing');}});
  await writeFile(path.join(root,'outside.svg'),'<svg private/>');const session=await vector.create(project,{shareId:'fixture-share',laptopOutput:true});
  await assert.rejects(call(session.id,'doc.open',{path:'../outside.svg'}),/relative path/);await symlink(path.join(root,'outside.svg'),path.join(project,'escape.svg')).catch(e=>{if(!['EPERM','EACCES'].includes(e.code))throw e;});
  try{await readFile(path.join(project,'escape.svg'));await assert.rejects(call(session.id,'doc.open',{path:'escape.svg'}),/outside/);}catch(e){if(e.code!=='ENOENT')throw e;}
  await call(session.id,'doc.new',{width:800,height:600});const count=engines.reduce((n,e)=>n+e.edits,0);
  await assert.rejects(call(session.id,'shape.rectangle',{x:NaN,y:0,width:5,height:5}),/Invalid/);await assert.rejects(call(session.id,'paint.setFill',{color:'url(file:///private)'}),/hex/);await assert.rejects(call(session.id,'path.create',{anchors:Array(600).fill({x:0,y:0})}),/512/);await assert.rejects(call(session.id,'document.open',{path:'private.svg'}),/Unsupported/);assert.equal(engines.reduce((n,e)=>n+e.edits,0),count);
  await assert.rejects(call(session.id,'doc.save',{path:'../escape.vectorcraft'}),/relative path/);await assert.rejects(call(session.id,'doc.save',{path:'uncertain.vectorcraft'}),/ACK missing/);assert.equal((await call(session.id,'state')).document.dirty,true);await assert.rejects(vector.output(session.id,'uncertain.vectorcraft'),e=>e.status===403);await assert.rejects(vector.close(session.id),e=>e.status===409);
  acknowledged=true;const saved=await call(session.id,'doc.save',{path:'confirmed.vectorcraft'});assert.equal(saved.document.dirty,false);assert.ok(await readFile(path.join(project,'uncertain.vectorcraft')));await vector.close(session.id);
});

test('Vector gateway enforces auth/origin, share ownership and approved output',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cw-vector-api-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const server=await createWorkspaceServer({dataDir:path.join(root,'data'),allowedRoots:[path.join(root,'projects')],auth:'vector:password',vectorcraftOptions:{binary:process.execPath,processFactory:()=>new VectorFixture()}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Basic ${Buffer.from('vector:password').toString('base64')}`,'Content-Type':'application/json',Origin:base},api=(route,method='GET',body)=>fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await fetch(base+'/api/engines/vectorcraft')).status,401);assert.equal((await api('/apps/vectorcraft/')).status,200);assert.equal((await fetch(base+'/api/vectorcraft/sessions',{method:'POST',headers:{...headers,Origin:'https://foreign.test'},body:'{}'})).status,403);
  const session=await (await api('/api/vectorcraft/sessions','POST',{})).json(),rpc=(method,params={})=>api(`/api/vectorcraft/sessions/${session.id}/rpc`,'POST',{method,params,requestId:crypto.randomUUID()});
  assert.equal((await rpc('doc.new',{width:800,height:600})).status,200);assert.equal((await rpc('doc.save',{path:'copy.vectorcraft'})).status,200);assert.equal((await api(`/api/vectorcraft/sessions/${session.id}/output?path=copy.vectorcraft`)).status,200);assert.equal((await api(`/api/vectorcraft/sessions/${session.id}/output?path=outside.svg`)).status,403);
  const foreign=await (await api('/api/storage/shares','POST',{app:'photocraft',name:'Other app',mode:'transfer'})).json();assert.equal((await api('/api/vectorcraft/sessions','POST',{sourceShareId:foreign.id,saveDestination:'server'})).status,404);
  const share=await (await api('/api/storage/shares','POST',{app:'vectorcraft',name:'Vector copy',mode:'transfer',access:'read'})).json();assert.equal((await api('/api/vectorcraft/sessions','POST',{sourceShareId:share.id,saveDestination:'laptop'})).status,403);const shared=await (await api('/api/vectorcraft/sessions','POST',{sourceShareId:share.id,saveDestination:'server'})).json();assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,409);assert.equal((await api(`/api/vectorcraft/sessions/${shared.id}`,'DELETE',{})).status,200);assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,200);
});

test('Vector readiness refuses an unrelated engine',async t=>{const {vector,project}=await fixture(t,{processFactory:()=>({call:async()=>({runtimeId:'unrelated-vector-tool'}),stop(){}})});assert.equal((await vector.status()).ready,false);await assert.rejects(vector.create(project),e=>e.status===503);});

test('Vector refuses incomplete multi-file exports before publishing or acknowledging',async t=>{
  class LinkedFixture extends VectorFixture{async call(method,p){const result=await super.call(method,p);if(method==='export')await writeFile(path.join(path.dirname(p.path),'linked.png'),'fixture asset');return result;}}
  const {vector,project,call}=await fixture(t,{processFactory:()=>new LinkedFixture()});const session=await vector.create(project);await call(session.id,'doc.new',{width:800,height:600});
  await assert.rejects(call(session.id,'doc.save',{path:'incomplete.svg'}),e=>e.status===422);await assert.rejects(readFile(path.join(project,'incomplete.svg')),e=>e.code==='ENOENT');assert.equal((await call(session.id,'state')).document.dirty,true);await assert.rejects(vector.output(session.id,'incomplete.svg'),e=>e.status===403);
});
