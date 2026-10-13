import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {Readable} from 'node:stream';
import {mkdtemp,mkdir,rm,readFile,writeFile,symlink,realpath,stat} from 'node:fs/promises';
import {createDesignCraft} from '../src/designcraft.js';
import {createWorkspaceServer} from '../src/server.js';

// Protocol fixture only. Actual parsing/rendering/export is verified by smoke-designcraft.mjs.
class DesignFixture{
  constructor(){this.closed=false;this.doc=null;this.edits=0;this.sampleCommandId=null;this.newParams=null;this.commands=[];}
  async call(method,p={}){
    if(method==='__cw_identity')return {runtimeId:'creative-workspace-designcraft-v1',version:'fixture'};
    if(method==='state')return this.doc?{...structuredClone(this.doc),documentSnapshot:structuredClone(this.doc.documentSnapshot||this.doc)}:null;
    if(method==='new'||method==='open'){if(method==='new')this.newParams=structuredClone(p);else this.openParams=structuredClone(p);this.doc={title:'Fixture',dirty:method==='new',pageCount:1,spreads:[{index:0,pages:[{index:0,name:'1',bounds:[0,0,800,600]}],items:[]}],stories:[],layers:[],selection:{items:[]},history:{undo:[],redo:[]}};if(method==='open'){try{this.doc=JSON.parse(await readFile(p.path,'utf8'));this.doc.dirty=false;}catch{}}return {};}
    if(method==='sample'){this.sampleCommandId='file.newSample';this.doc={title:'Original sample',dirty:true,pageCount:2,spreads:[{index:0,pages:[{index:0,name:'1',bounds:[0,0,800,600]}],items:[]}],stories:[],layers:[],selection:{items:[]},history:{undo:[],redo:[]}};return {commandId:this.sampleCommandId};}
    if(method==='render'){const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(800,16);png.writeUInt32BE(600,20);return {pngBase64:png.toString('base64')};}
    if(method==='command'){this.edits++;this.commands.push(p.command);this.doc.dirty=true;return {id:1};}
    if(method==='export'){await writeFile(p.path,'fixture design copy');return {warnings:[]};}
    if(method==='save_copy'){this.copyCommandId='file.saveACopy';const bytes=Buffer.from(JSON.stringify(this.doc));await writeFile(p.path,bytes);return {bytes:bytes.length};}
    if(method==='mark_saved'){this.doc.dirty=false;return {saved:true};}throw new Error('Unsupported fixture method');
  }
  stop(){this.closed=true;}
}
async function fixture(t,extra={}){const root=await mkdtemp(path.join(os.tmpdir(),'cw-design-fixture-')),project=path.join(root,'project'),engines=[];await mkdir(project);const design=createDesignCraft({binary:process.execPath,stateDir:path.join(root,'sessions'),processFactory:()=>{const engine=new DesignFixture();engines.push(engine);return engine;},...extra});t.after(()=>design.shutdown());t.after(()=>rm(root,{recursive:true,force:true}));const call=(id,method,params={},extra={})=>design.execute(id,{method,params,requestId:crypto.randomUUID(),...extra});return {root,project,design,engines,call};}

test('Design sample is created by the owned worker with the original command ID and a revisioned render',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  const sampled=await call(session.id,'doc.sample');
  const activeWorker=engines.find(engine=>!engine.closed);assert.equal(activeWorker?.sampleCommandId,'file.newSample');assert.equal(sampled.stateVersion,1);assert.equal(sampled.document.title,'Original sample');assert.equal(sampled.document.name,'Sample Document');assert.equal(sampled.document.pageCount,2);assert.equal(sampled.document.dirty,true);assert.match(sampled.preview,/preview\.png\?v=1$/);assert.ok(design.preview(session.id,1).length>0);
  await assert.rejects(call(session.id,'doc.sample'),/save and close/i);await design.close(session.id,{discard:true});
});

test('Original file.new preset action reaches the owned worker unchanged and returns an ACKed read model',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await assert.rejects(call(session.id,'file.new',{preset:'A4',path:'/private'}),/preset name/);
  const created=await call(session.id,'file.new',{preset:'A4'}),worker=engines.find(engine=>!engine.closed);
  assert.deepEqual(worker?.newParams,{preset:'A4'});assert.equal(created.result.commandId,'file.new');assert.equal(created.stateVersion,1);
  assert.equal(created.document.title,'Fixture');assert.equal(created.document.dirty,true);assert.equal(created.documentSnapshot.title,'Fixture');assert.match(created.preview,/preview\.png\?v=1$/);
  await design.close(session.id,{discard:true});
});

test('Original file.saveACopy writes a retained server copy after byte ACK without marking the source saved and the copy reopens',async t=>{
  const {project,design,engines,call}=await fixture(t),source=await design.create(project);
  await call(source.id,'file.new',{preset:'A4'});
  await call(source.id,'frame.create',{rect:[10,10,90,70],content:'text',text:'Keep this edit'});
  const saved=await call(source.id,'file.saveACopy',{path:'copies/issue-copy.designcraft',destination:'server',retention:'workspace'});
  assert.equal(saved.result.commandId,'file.saveACopy');assert.equal(saved.result.savedDocument,false);assert.equal(saved.result.destination,'server');assert.equal(saved.result.retention,'workspace');
  assert.equal(saved.document.dirty,true);assert.equal(saved.document.name,'Fixture');assert.equal(saved.stateVersion,3);
  const copy=await readFile(await design.output(source.id,'copies/issue-copy.designcraft'));
  assert.equal(copy.toString(),JSON.stringify(engines.find(engine=>!engine.closed).doc));
  await assert.rejects(call(source.id,'file.saveACopy',{path:'copies/issue-copy.designcraft',destination:'server',retention:'workspace'}),e=>e.status===409);
  await assert.rejects(call(source.id,'file.saveACopy',{path:'copies/laptop.designcraft',destination:'laptop',retention:'workspace'}),e=>e.code==='LAPTOP_DESTINATION_REQUIRED');
  await assert.rejects(call(source.id,'file.saveACopy',{path:'copies/temp.designcraft',destination:'server',retention:'temporary'}),e=>e.code==='RETENTION_UNSUPPORTED');
  const reopened=await design.create(project);const opened=await call(reopened.id,'doc.open',{path:'copies/issue-copy.designcraft'});
  assert.equal(engines.find(engine=>engine.openParams)?.openParams.path,await realpath(path.join(project,'copies/issue-copy.designcraft')));
  assert.equal(opened.document.dirty,false);assert.equal(opened.document.name,'issue-copy.designcraft');
  await design.close(source.id,{discard:true});await design.close(reopened.id);
});

test('Original laptop file.saveACopy waits for provider ACK, preserves dirty source and never overwrites or replays uncertain output',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cw-design-laptop-copy-')),project=path.join(root,'project'),laptop=path.join(root,'laptop'),engines=[];
  await mkdir(project);await mkdir(laptop);t.after(()=>rm(root,{recursive:true,force:true}));
  let ack=false,failAck=false,expectedPath='exports/issue.designcraft';const design=createDesignCraft({binary:process.execPath,stateDir:path.join(root,'sessions'),settleOutput:async(shareId,relative)=>{assert.equal(shareId,'chosen-laptop');assert.equal(relative,expectedPath);assert.equal((await stat(path.join(laptop,relative))).isFile(),true);ack=true;if(failAck)throw Object.assign(new Error('Laptop filesystem reply timed out'),{code:'EIO'});},processFactory:()=>{const engine=new DesignFixture();engines.push(engine);return engine;}});t.after(()=>design.shutdown());
  const session=await design.create(project,{writeRoot:laptop,shareId:'chosen-laptop',laptopOutput:true});const call=(method,params={},extra={})=>design.execute(session.id,{method,params,requestId:crypto.randomUUID(),...extra});
  await call('file.new',{preset:'A4'});await call('frame.create',{rect:[10,10,90,70],content:'text',text:'Preserve dirty original'});
  const saved=await call('file.saveACopy',{path:'exports/issue.designcraft',destination:'laptop',retention:'workspace'});
  assert.equal(ack,true);assert.equal(saved.result.destination,'laptop');assert.equal(saved.result.savedDocument,false);assert.equal(saved.document.dirty,true);assert.equal(saved.document.name,'Fixture');assert.equal(saved.stateVersion,3);
  const bytes=await readFile(path.join(laptop,'exports/issue.designcraft'));assert.equal(bytes.toString(),JSON.stringify(engines.find(e=>!e.closed).doc));
  await assert.rejects(call('file.saveACopy',{path:'exports/issue.designcraft',destination:'laptop',retention:'workspace'}),e=>e.code==='OUTPUT_EXISTS');assert.deepEqual(await readFile(path.join(laptop,'exports/issue.designcraft')),bytes);
  failAck=true;expectedPath='exports/uncertain.designcraft';await assert.rejects(call('file.saveACopy',{path:expectedPath,destination:'laptop',retention:'workspace'}),/timed out/);
  const uncertain=await readFile(path.join(laptop,'exports/uncertain.designcraft'));assert.ok(uncertain.length>0);assert.equal((await call('state')).document.dirty,true);
  await assert.rejects(call('file.saveACopy',{path:'exports/uncertain.designcraft',destination:'laptop',retention:'workspace'}),e=>e.code==='OUTPUT_EXISTS');assert.deepEqual(await readFile(path.join(laptop,'exports/uncertain.designcraft')),uncertain);
  await design.close(session.id,{discard:true});
});

test('DesignCraft never treats a missing laptop ACK hook as save success',async t=>{
  const {project,design,call}=await fixture(t),laptop=path.join(os.tmpdir(),`cw-design-no-ack-${crypto.randomUUID()}`);await mkdir(laptop);
  const session=await design.create(project,{writeRoot:laptop,shareId:'selected-laptop',laptopOutput:true});await call(session.id,'file.new',{preset:'A4'});
  await assert.rejects(call(session.id,'file.saveACopy',{path:'no-ack.designcraft',destination:'laptop',retention:'workspace'}),e=>e.code==='WRITE_ACK_UNAVAILABLE');
  await assert.rejects(readFile(path.join(laptop,'no-ack.designcraft')));assert.equal((await call(session.id,'state')).document.dirty,true);
  await design.close(session.id,{discard:true});await rm(laptop,{recursive:true,force:true});
});

test('Original file.open resolves only its provider root, ACKs server state and preserves open documents',async t=>{
 const {root,project,design,engines,call}=await fixture(t);
 await writeFile(path.join(project,'chosen.designcraft'),'fixture');await writeFile(path.join(root,'outside.designcraft'),'outside');
 const session=await design.create(project);
 for(const params of [{path:'../outside.designcraft'},{path:'chosen.designcraft',base64:'untrusted'},{path:'/private/chosen.designcraft'}])await assert.rejects(call(session.id,'file.open',params));
 let linked=true;await symlink(path.join(root,'outside.designcraft'),path.join(project,'escape.designcraft')).catch(e=>{if(['EPERM','EACCES'].includes(e.code))linked=false;else throw e;});
 if(linked)await assert.rejects(call(session.id,'file.open',{path:'escape.designcraft'}));
 assert.equal(engines.find(e=>!e.closed).openParams,undefined);
 const opened=await call(session.id,'file.open',{path:'chosen.designcraft'},{expectedVersion:0});
 assert.equal(opened.result.commandId,'file.open');assert.equal(opened.stateVersion,1);assert.equal(opened.document.dirty,false);
 assert.equal(opened.document.name,'chosen.designcraft');assert.equal(engines.find(e=>!e.closed).openParams.path,await realpath(path.join(project,'chosen.designcraft')));
 await assert.rejects(call(session.id,'file.open',{path:'chosen.designcraft'},{expectedVersion:0}),e=>e.code==='STATE_VERSION_CONFLICT');
 await assert.rejects(call(session.id,'file.open',{path:'chosen.designcraft'},{expectedVersion:1}),/save and close/i);
 await design.close(session.id);
});

test('Copy-first input is bounded and session-rooted, never writes through a laptop share or overwrites',async t=>{
 const {project,design,call}=await fixture(t,{maxFileBytes:8});const session=await design.create(project);
 const copied=await design.importInput(session.id,Readable.from(['chosen']),'imports/one/chosen.designcraft');
 assert.equal(copied.mode,'copy-first');assert.equal(copied.sessionId,session.id);assert.equal(copied.bytes,6);
 await assert.rejects(design.importInput(session.id,Readable.from(['new']),'imports/one/chosen.designcraft'));
 assert.equal(await readFile(path.join(project,'imports/one/chosen.designcraft'),'utf8'),'chosen');
 await assert.rejects(design.importInput(session.id,Readable.from(['123456789']),'imports/two/large.designcraft'),e=>e.status===413);
 await assert.rejects(readFile(path.join(project,'imports/two/large.designcraft')));
 await assert.rejects(design.importInput(session.id,Readable.from(['x']),'../outside.designcraft'));
 const share=await design.create(project,{shareId:'selected-laptop',laptopOutput:true});
 await assert.rejects(design.importInput(share.id,Readable.from(['x']),'imports/one/laptop.designcraft'),e=>e.status===403);
 const opened=await call(session.id,'file.open',{path:copied.path},{expectedVersion:0});assert.equal(opened.result.commandId,'file.open');
 await design.close(session.id);await design.close(share.id);
});

test('Original file.open keeps the selected filename when copy-first storage adds a session prefix',async t=>{
 const {project,design,call}=await fixture(t);const session=await design.create(project);
 const providerPath='imports/123e4567-e89b-42d3-a456-426614174000-chosen.designcraft';
 await design.importInput(session.id,Readable.from(['fixture']),providerPath);
 const opened=await call(session.id,'file.open',{path:providerPath},{expectedVersion:0});
 assert.equal(opened.document.name,'chosen.designcraft');
 await design.close(session.id);
});

test('Design gateway rejects absent and oversized canonical document snapshots',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);await call(session.id,'doc.new',{width:800,height:600,pages:1});
  const worker=engines.find(engine=>!engine.closed),state=worker.call.bind(worker);
  worker.call=async(method,p)=>{const value=await state(method,p);if(method==='state'&&value)value.documentSnapshot={title:'x'.repeat(16*1024*1024)};return value;};
  await assert.rejects(call(session.id,'state'),e=>e.status===502&&/16 MB/.test(e.message));
  worker.call=async(method,p)=>{const value=await state(method,p);if(method==='state'&&value)delete value.documentSnapshot;return value;};
  await assert.rejects(call(session.id,'state'),e=>e.status===502&&/missing/.test(e.message));
  await design.close(session.id,{discard:true});
});

test('Design sessions isolate state, deduplicate edits and refuse stale/colliding output',async t=>{
  const {project,design,engines,call}=await fixture(t,{maxSessions:2});await writeFile(path.join(project,'original.designcraft'),'fixture native original');
  const [a,b]=await Promise.all([design.create(project),design.create(project)]);const opened=await call(a.id,'doc.open',{path:'original.designcraft'});assert.equal(opened.document.dirty,false);assert.equal((await call(b.id,'state')).document,null);
  const edit={method:'frame.create',params:{rect:[10,10,90,60],content:'text',text:'Fixture story'},requestId:'design-edit-request',expectedVersion:opened.stateVersion};
  const [edited,duplicate]=await Promise.all([design.execute(a.id,edit),design.execute(a.id,edit)]),activeWorker=engines.find(engine=>engine.commands.length>0);assert.equal(engines.reduce((n,e)=>n+e.edits,0),1);assert.equal(edited.stateVersion,opened.stateVersion+1);assert.equal(edited.result.commandId,'frame.create');assert.equal(duplicate.stateVersion,edited.stateVersion);assert.deepEqual(activeWorker?.commands,['frame.create']);
  const next=await call(a.id,'frame.create',{rect:[100,10,180,60],content:'text',text:'Second story'},{expectedVersion:edited.stateVersion});assert.equal(next.stateVersion,edited.stateVersion+1);assert.deepEqual(activeWorker?.commands,['frame.create','frame.create']);
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
  const inputPath=`/api/designcraft/sessions/${session.id}/input?path=imports/test/selected.designcraft`;
  const put=(route,override={})=>fetch(base+route,{method:'PUT',headers:{...headers,'Content-Type':'application/octet-stream',...override},body:Buffer.from('selected')});
  assert.equal((await fetch(base+inputPath,{method:'PUT',headers:{Origin:base,'Content-Type':'application/octet-stream'},body:'x'})).status,401);
  assert.equal((await put(inputPath,{Origin:'https://foreign.test'})).status,403);
  assert.equal((await put(inputPath,{'Content-Type':'application/json'})).status,415);
  assert.equal((await put(`/api/designcraft/sessions/${'0'.repeat(48)}/input?path=imports/test/selected.designcraft`)).status,404);
  assert.equal((await put(inputPath)).status,201);
  assert.equal((await put(inputPath)).status,409);
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
