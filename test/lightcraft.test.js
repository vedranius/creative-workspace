import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createLightCraft} from '../src/lightcraft.js';
import {createWorkspaceServer} from '../src/server.js';

class FixtureEngine{
  constructor(){this.doc=null;this.closed=false;}
  async call(method,params={}){
    if(method==='__cw_identity')return {runtimeId:'creative-workspace-lightcraft-v1',version:'0.6.0'};
    if(method==='controls')return [{id:'light.exposure',label:'Exposure',min:-5,max:5,step:0.01,default:0}];
    if(method==='state')return this.doc?structuredClone(this.doc):null;
    if(method==='open'){this.doc={name:path.basename(params.path),format:'jpeg',width:4,height:3,sourceHash:createHash('sha256').update(await readFile(params.path)).digest('hex'),values:{'light.exposure':0},dirty:false};return this.doc;}
    if(method==='set'){Object.assign(this.doc.values,params.values);this.doc.dirty=true;return this.doc;}
    if(method==='undo'||method==='redo')return this.doc;
    if(method==='mark_saved'){this.doc.dirty=false;return this.doc;}
    if(method==='render'||method==='export'){await writeFile(params.path,Buffer.from('preview'));return {width:4,height:3,bytes:7};}
    throw new Error(`Unexpected method ${method}`);
  }
  stop(){this.closed=true;}
}

test('LightCraft recipes bind the selected source and clear dirty only after recipe ACK',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'cw-lightcraft-gateway-'));t.after(()=>rm(temp,{recursive:true,force:true}));
  const source=path.join(temp,'selected'),workspace=path.join(temp,'workspace'),state=path.join(temp,'state');await Promise.all([mkdir(source),mkdir(workspace),mkdir(state)]);await writeFile(path.join(source,'frame.jpg'),'original');
  const light=createLightCraft({binary:process.execPath,stateDir:state,processFactory:()=>new FixtureEngine()});t.after(()=>light.shutdown());
  const session=await light.create(source,{writeRoot:workspace});
  const call=(method,params={},expectedVersion)=>light.execute(session.id,{method,params,expectedVersion,requestId:`request-${Math.random()}`});
  assert.deepEqual((await call('controls')).result[0],{id:'light.exposure',label:'Exposure',min:-5,max:5,step:0.01,default:0});
  const opened=await call('photo.open',{path:'frame.jpg'});assert.equal(opened.document.dirty,false);assert.match(opened.document.sourceHash,/^[a-f0-9]{64}$/);
  const edited=await call('controls.set',{values:{'light.exposure':1.25}},opened.stateVersion);assert.equal(edited.document.dirty,true);
  const exported=await call('photo.export',{path:'exports/frame.jpg',format:'jpeg'},edited.stateVersion);assert.equal(exported.document.dirty,true);assert.equal(exported.result.savedDocument,false);
  const saved=await call('recipe.save',{path:'recipes/frame.lightcraft.json'},exported.stateVersion);assert.equal(saved.result.savedDocument,true);assert.equal(saved.document.dirty,false);
  const recipe=JSON.parse(await readFile(path.join(workspace,'recipes/frame.lightcraft.json'),'utf8'));assert.equal(recipe.sourcePath,'frame.jpg');assert.equal(recipe.controls['light.exposure'],1.25);
  await assert.rejects(call('recipe.save',{path:'recipes/frame.lightcraft.json'},saved.stateVersion),error=>error.code==='OUTPUT_EXISTS');
  const reopened=await light.create(source,{writeRoot:workspace});const loaded=await light.execute(reopened.id,{method:'recipe.open',params:{path:'recipes/frame.lightcraft.json'},requestId:'load-recipe-1'});assert.equal(loaded.document.dirty,false);assert.equal(loaded.document.values['light.exposure'],1.25);assert.equal(loaded.document.sourceHash,recipe.originalSha256);
  await writeFile(path.join(source,'frame.jpg'),'tampered');const changed=await light.create(source,{writeRoot:workspace});await assert.rejects(light.execute(changed.id,{method:'recipe.open',params:{path:'recipes/frame.lightcraft.json'},requestId:'load-recipe-2'}),error=>error.code==='SOURCE_HASH_CONFLICT');
});

test('LightCraft laptop recipe save stays dirty when provider acknowledgement fails',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'cw-lightcraft-ack-'));t.after(()=>rm(temp,{recursive:true,force:true}));await writeFile(path.join(temp,'frame.jpg'),'original');
  const light=createLightCraft({binary:process.execPath,stateDir:path.join(temp,'state'),processFactory:()=>new FixtureEngine(),settleOutput:async()=>{throw new Error('provider acknowledgement unavailable');}});t.after(()=>light.shutdown());
  const session=await light.create(temp,{writeRoot:temp,shareId:'share01',laptopOutput:true}),call=(method,params={})=>light.execute(session.id,{method,params,requestId:`request-${Math.random()}`});await call('photo.open',{path:'frame.jpg'});await call('controls.set',{values:{'light.exposure':1}});
  await assert.rejects(call('recipe.save',{path:'frame.lightcraft.json'}),/provider acknowledgement unavailable/);assert.equal((await call('state')).document.dirty,true);assert.ok((await readFile(path.join(temp,'frame.lightcraft.json'))).length>0);await assert.rejects(light.close(session.id),e=>e.status===409);
});

test('LightCraft HTTP gateway enforces auth/origin and exposes selected-root recipe sessions',async t=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'cw-lightcraft-api-')),projects=path.join(temp,'projects'),source=path.join(projects,'selected');await mkdir(source,{recursive:true});await writeFile(path.join(source,'frame.jpg'),'original');t.after(()=>rm(temp,{recursive:true,force:true}));
  const server=await createWorkspaceServer({dataDir:path.join(temp,'data'),allowedRoots:[projects],auth:'light:password',lightcraftOptions:{binary:process.execPath,processFactory:()=>new FixtureEngine()}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Basic ${Buffer.from('light:password').toString('base64')}`,'Content-Type':'application/json',Origin:base},api=(route,method='GET',body)=>fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await api('/apps/lightcraft/')).status,200);assert.equal((await api('/apps/lightcraft/app.js')).status,200);assert.equal((await api('/apps/lightcraft/style.css')).status,200);
  assert.equal((await fetch(base+'/api/engines/lightcraft')).status,401);assert.equal((await fetch(base+'/api/lightcraft/sessions',{method:'POST',headers:{...headers,Origin:'https://foreign.test'},body:'{}'})).status,403);
  const session=await (await api('/api/lightcraft/sessions','POST',{sourceFolder:source,saveDestination:'server'})).json(),rpc=(method,params={})=>api(`/api/lightcraft/sessions/${session.id}/rpc`,'POST',{method,params,requestId:crypto.randomUUID()});
  assert.equal((await (await rpc('controls')).json()).result[0].id,'light.exposure');
  const opened=await (await rpc('photo.open',{path:'frame.jpg'})).json();assert.equal(opened.document.dirty,false);assert.equal((await rpc('controls.set',{values:{'light.exposure':0.5} })).status,200);
  const saved=await (await rpc('recipe.save',{path:'recipes/frame.lightcraft.json'})).json();assert.equal(saved.document.dirty,false);const recipe=JSON.parse(await readFile(path.join(projects,'lightcraft','recipes','frame.lightcraft.json'),'utf8'));assert.equal(recipe.sourcePath,'frame.jpg');
  const reopened=await (await api('/api/lightcraft/sessions','POST',{sourceFolder:source,saveDestination:'server'})).json();const loaded=await fetch(`${base}/api/lightcraft/sessions/${reopened.id}/rpc`,{method:'POST',headers,body:JSON.stringify({method:'recipe.open',params:{path:'recipes/frame.lightcraft.json'},requestId:crypto.randomUUID()})});assert.equal(loaded.status,200);assert.equal((await loaded.json()).document.values['light.exposure'],0.5);
});
