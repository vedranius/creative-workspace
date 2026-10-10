import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,rm,writeFile,readFile,symlink} from 'node:fs/promises';
import {createPdfCraft} from '../src/pdfcraft.js';
import {createWorkspaceServer} from '../src/server.js';

const result=value=>({content:[{type:'json',value}]});
class PdfFixture{
  constructor(root){this.root=root;this.closed=false;this.docs=new Map();this.next=0;this.rotations=0;}
  async call(method,params={}){
    if(method==='__cw_identity')return {runtimeId:'creative-workspace-pdfcraft-v1',version:'fixture'};
    if(method==='doc_create'||method==='doc_open'){const doc={doc:++this.next,name:params.name||path.basename(params.path),path:params.path,dirty:method==='doc_create',editable:true,undo:null,redo:null,pages:method==='doc_create'?params.pages:2,rotation:0,notes:[]};this.docs.set(doc.doc,doc);return result({...doc});}
    if(method==='doc_list')return result({documents:[...this.docs.values()]});
    const doc=this.docs.get(params.doc);if(!doc)throw new Error('Unknown fixture document');
    if(method==='doc_info')return result({document:{...doc},pages:Array.from({length:doc.pages},(_,i)=>({page:i+1,width:doc.rotation?842:595,height:doc.rotation?595:842,rotation:i===0?doc.rotation:0})),annotations:doc.notes,pdf_version:'1.7'});
    if(method==='render_preview')return {content:[{type:'png',base64:Buffer.from(`preview-${doc.rotation}`).toString('base64'),width:50,height:70}]};
    if(method==='page_rotate'){this.rotations++;doc.rotation=params.degrees;doc.undo='Rotate';doc.dirty=true;return result({...doc});}
    if(method==='comment_add'){doc.notes.push({page:params.page,contents:params.contents});doc.dirty=true;return result({...doc});}
    if(method==='export_copy'){await writeFile(path.join(this.root,params.path),`%PDF-1.7\nfixture copy ${doc.rotation}`);return result({bytes:24});}
    if(method==='doc_close'){this.docs.delete(params.doc);return result({closed:true});}
    throw new Error(`Unsupported fixture operation ${method}`);
  }
  stop(){this.closed=true;}
}
async function fixture(t,extra={}){const root=await mkdtemp(path.join(os.tmpdir(),'cw-pdf-fixture-'));t.after(()=>rm(root,{recursive:true,force:true}));const project=path.join(root,'project');await mkdir(project);const engines=[];const pdf=createPdfCraft({binary:process.execPath,stateDir:path.join(root,'sessions'),processFactory:(file,root)=>{const engine=new PdfFixture(root);engines.push(engine);return engine;},...extra});t.after(()=>pdf.shutdown());return {root,project,pdf,engines};}

test('PDF sessions isolate documents, reject stale/reused requests and preserve originals on copy export',async t=>{
  const {project,pdf,engines}=await fixture(t,{maxSessions:2});await writeFile(path.join(project,'original.pdf'),'%PDF original bytes');
  const [a,b]=await Promise.all([pdf.create(project),pdf.create(project)]);assert.notEqual(a.id,b.id);
  const call=(id,method,params={},extra={})=>pdf.execute(id,{method,params,requestId:crypto.randomUUID(),...extra});
  const opened=await call(a.id,'doc.open',{path:'original.pdf'});assert.equal(opened.documents[0].dirty,false);assert.equal(opened.documents[0].path,undefined);
  assert.equal((await call(b.id,'state')).documents.length,0);
  const edit={method:'page.rotate',params:{degrees:90},expectedVersion:opened.stateVersion,requestId:'pdf-rotate-unique'};
  const [first,retry]=await Promise.all([pdf.execute(a.id,edit),pdf.execute(a.id,edit)]);assert.equal(first.stateVersion,retry.stateVersion);assert.equal(engines.reduce((n,e)=>n+e.rotations,0),1);
  await assert.rejects(call(a.id,'page.rotate',{degrees:90},{expectedVersion:opened.stateVersion}),error=>error.code==='STATE_VERSION_CONFLICT');
  await assert.rejects(pdf.execute(a.id,{...edit,params:{degrees:180}}),error=>error.status===409);
  await assert.rejects(call(a.id,'doc.save',{path:'original.pdf'}),error=>error.status===409);
  assert.equal(await readFile(path.join(project,'original.pdf'),'utf8'),'%PDF original bytes');
  assert.equal((await call(a.id,'state')).documents[0].dirty,true);
  const saved=await call(a.id,'doc.save',{path:'edited.pdf'});assert.equal(saved.documents[0].dirty,false);assert.ok((await readFile(await pdf.output(a.id,'edited.pdf'),'utf8')).startsWith('%PDF'));
  await assert.rejects(pdf.output(b.id,'edited.pdf'),error=>error.status===403);
  await assert.rejects(pdf.create(project),/session limit/);await pdf.close(a.id);await assert.rejects(call(a.id,'state'),error=>error.status===404);
});

test('PDF paths stay confined and failed laptop ACK leaves the document unsaved',async t=>{
  let acknowledged=false;const {root,project,pdf}=await fixture(t,{settleOutput:async()=>{if(!acknowledged)throw Object.assign(new Error('Laptop ACK missing'),{status:503});}});
  await writeFile(path.join(root,'outside.pdf'),'%PDF private');
  const session=await pdf.create(project,{shareId:'fixture-share',laptopOutput:true});const call=(method,params={})=>pdf.execute(session.id,{method,params,requestId:crypto.randomUUID()});
  await assert.rejects(call('doc.open',{path:'../outside.pdf'}),/relative path/);
  await symlink(path.join(root,'outside.pdf'),path.join(project,'escape.pdf')).catch(error=>{if(!['EPERM','EACCES'].includes(error.code))throw error;});
  try{await readFile(path.join(project,'escape.pdf'));await assert.rejects(call('doc.open',{path:'escape.pdf'}),/outside/);}catch(error){if(error.code!=='ENOENT')throw error;}
  await call('doc.new',{name:'New PDF',pages:2});await assert.rejects(call('doc.save',{path:'../outside.pdf'}),/relative path/);
  await assert.rejects(call('doc.save',{path:'uncertain.pdf'}),/ACK missing/);assert.equal((await call('state')).documents[0].dirty,true);await assert.rejects(pdf.output(session.id,'uncertain.pdf'),error=>error.status===403);await assert.rejects(pdf.close(session.id),error=>error.status===409);
  acknowledged=true;const saved=await call('doc.save',{path:'confirmed.pdf'});assert.equal(saved.documents[0].dirty,false);assert.ok(await readFile(path.join(project,'uncertain.pdf')));await pdf.close(session.id);
});

test('PDF gateway requires authentication/origin and serves only session-approved output',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cw-pdf-api-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const server=await createWorkspaceServer({dataDir:path.join(root,'data'),allowedRoots:[path.join(root,'projects')],auth:'pdf:password',pdfcraftOptions:{binary:process.execPath,processFactory:(file,root)=>new PdfFixture(root)}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Basic ${Buffer.from('pdf:password').toString('base64')}`,'Content-Type':'application/json',Origin:base};
  const api=(route,method='GET',body)=>fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await fetch(base+'/api/engines/pdfcraft')).status,401);assert.equal((await api('/apps/pdfcraft/')).status,200);
  assert.equal((await fetch(base+'/api/pdfcraft/sessions',{method:'POST',headers:{...headers,Origin:'https://foreign.test'},body:'{}'})).status,403);
  const session=await (await api('/api/pdfcraft/sessions','POST',{})).json();const route=`/api/pdfcraft/sessions/${session.id}/rpc`;
  assert.equal((await api(route,'POST',{method:'doc.new',params:{pages:2,name:'Fixture'},requestId:crypto.randomUUID()})).status,200);
  assert.equal((await api(route,'POST',{method:'doc.save',params:{path:'copy.pdf'},requestId:crypto.randomUUID()})).status,200);
  const output=await api(`/api/pdfcraft/sessions/${session.id}/output?path=copy.pdf`);assert.equal(output.status,200);assert.equal(output.headers.get('Content-Type'),'application/pdf');assert.ok((await output.text()).startsWith('%PDF'));
  assert.equal((await api(`/api/pdfcraft/sessions/${session.id}/output?path=outside.pdf`)).status,403);
  const foreign=await (await api('/api/storage/shares','POST',{app:'photocraft',name:'Other app',mode:'transfer'})).json();
  assert.equal((await api('/api/pdfcraft/sessions','POST',{sourceShareId:foreign.id,saveDestination:'server'})).status,404);
  const share=await (await api('/api/storage/shares','POST',{app:'pdfcraft',name:'PDF copy',mode:'transfer',access:'read'})).json();
  assert.equal((await api('/api/pdfcraft/sessions','POST',{sourceShareId:share.id,saveDestination:'laptop'})).status,403);
  const sharedSession=await (await api('/api/pdfcraft/sessions','POST',{sourceShareId:share.id,saveDestination:'server'})).json();
  assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,409);
  assert.equal((await api(`/api/pdfcraft/sessions/${sharedSession.id}`,'DELETE',{})).status,200);
  assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,200);
});

test('PDF readiness rejects an unrelated installed engine',async t=>{
  const {pdf,project}=await fixture(t,{processFactory:()=>({closed:false,call:async()=>({runtimeId:'unrelated-pdf-tool'}),stop(){this.closed=true;}})});
  assert.equal((await pdf.status()).ready,false);await assert.rejects(pdf.create(project),error=>error.status===503);
});
