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
  constructor(){this.closed=false;this.doc=null;this.edits=0;this.sampleCommandId=null;this.newParams=null;this.commands=[];this.commandParams=[];}
  async call(method,p={}){
    if(method==='__cw_identity')return {runtimeId:'creative-workspace-designcraft-v1',version:'fixture'};
    if(method==='state')return this.doc?{...structuredClone(this.doc),documentSnapshot:structuredClone(this.doc.documentSnapshot||this.doc)}:null;
    if(method==='new'||method==='open'){if(method==='new')this.newParams=structuredClone(p);else this.openParams=structuredClone(p);this.doc={title:'Fixture',dirty:method==='new',pageCount:1,spreads:[{index:0,pages:[{index:0,name:'1',bounds:[0,0,800,600]}],items:[]}],stories:[],layers:[],selection:{items:[]},history:{undo:[],redo:[]}};if(method==='open'){try{this.doc=JSON.parse(await readFile(p.path,'utf8'));this.doc.dirty=false;}catch{}}return {};}
    if(method==='sample'){this.sampleCommandId='file.newSample';this.doc={title:'Original sample',dirty:true,pageCount:2,spreads:[{index:0,pages:[{index:0,name:'1',bounds:[0,0,800,600]}],items:[]}],stories:[],layers:[],selection:{items:[]},history:{undo:[],redo:[]}};return {commandId:this.sampleCommandId};}
    if(method==='render'){const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(800,16);png.writeUInt32BE(600,20);return {pngBase64:png.toString('base64')};}
    if(method==='command'){this.edits++;this.commands.push(p.command);this.commandParams.push(structuredClone(p.params));if(p.command==='selection.set')this.doc.selection={items:[...p.params.ids]};else if(p.command==='edit.deselectAll')this.doc.selection={items:[]};else if(p.command==='layout.pages.move'){const pages=this.doc.spreads.flatMap(sp=>sp.pages),[page]=pages.splice(p.params.from,1);pages.splice(p.params.to,0,page);pages.forEach((page,index)=>page.index=index);this.doc.spreads=[{index:0,pages,items:[]}];this.doc.dirty=true;}else if(p.command==='layout.pages.insert'){const {after,count}=p.params;for(let i=0;i<count;i++)this.doc.spreads[0].pages.splice(after+1+i,0,{index:after+1+i,name:String(after+2+i),bounds:[0,0,800,600]});this.doc.pageCount+=count;this.doc.spreads[0].pages.forEach((page,index)=>page.index=index);this.doc.dirty=true;}else if(p.command==='layout.pages.duplicateSpread'){const source=this.doc.spreads[p.params.spread],pages=structuredClone(source.pages),base=this.doc.pageCount;pages.forEach((page,index)=>{page.index=base+index;page.name=String(base+index+1);});this.doc.spreads.splice(p.params.spread+1,0,{...structuredClone(source),index:p.params.spread+1,pages});this.doc.pageCount+=pages.length;this.doc.spreads.forEach((spread,index)=>spread.index=index);this.doc.dirty=true;}else if(p.command==='layout.pages.delete'){const deleting=new Set(p.params.pages);this.doc.spreads.forEach(spread=>{spread.pages=spread.pages.filter(page=>!deleting.has(page.index));});this.doc.spreads=this.doc.spreads.filter(spread=>spread.pages.length);let index=0;for(const [spreadIndex,spread] of this.doc.spreads.entries()){spread.index=spreadIndex;for(const page of spread.pages)page.index=index++;}this.doc.pageCount=index;this.doc.dirty=true;}else this.doc.dirty=true;if(p.command==='edit.undo')return {undone:'Clear'};if(p.command==='edit.redo')return {redone:'Clear'};return {id:1};}
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

test('Original Edit > Select All action reaches the owned worker with a revisioned selection ACK',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const selected=await call(session.id,'edit.selectAll',{}, {expectedVersion:1}),worker=engines.find(engine=>!engine.closed);
  assert.deepEqual(worker?.commands,['edit.selectAll']);assert.equal(selected.result.commandId,'edit.selectAll');assert.equal(selected.stateVersion,2);assert.equal(selected.document.dirty,true);
  await assert.rejects(call(session.id,'edit.selectAll',{path:'/private'}),/unsupported|parameters/i);
  assert.deepEqual(worker?.commands,['edit.selectAll']);await design.close(session.id,{discard:true});
});

test('Original Duplicate Spread command preserves its engine ID, waits for worker ACK and renders the updated read-model',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const worker=engines.find(engine=>!engine.closed),command=worker.call.bind(worker);
  worker.call=async(method,p)=>{if(method==='command'&&p.command==='layout.pages.duplicateSpread')throw new Error('worker rejected the command');return command(method,p);};
  await assert.rejects(call(session.id,'layout.pages.duplicateSpread',{spread:0},{expectedVersion:1}),/worker rejected/);
  assert.equal((await call(session.id,'state')).stateVersion,1,'a failed engine command cannot consume a server revision');
  let release;const gate=new Promise(resolve=>{release=resolve;});let entered;
  const started=new Promise(resolve=>{entered=resolve;});
  worker.call=async(method,p)=>{if(method==='command'&&p.command==='layout.pages.duplicateSpread'){entered();await gate;}return command(method,p);};
  const pending=call(session.id,'layout.pages.duplicateSpread',{spread:0},{expectedVersion:1});
  await started;
  assert.equal(worker.doc.pageCount,1);
  release();
  const duplicated=await pending;
  assert.deepEqual(worker.commands,['layout.pages.duplicateSpread']);assert.deepEqual(worker.commandParams,[{spread:0}]);
  assert.equal(duplicated.result.commandId,'layout.pages.duplicateSpread');assert.equal(duplicated.stateVersion,2);assert.equal(duplicated.document.pageCount,2);assert.equal(duplicated.document.spreads.length,2);assert.equal(duplicated.document.dirty,true);assert.match(duplicated.preview,/preview\.png\?v=3$/);assert.ok(design.preview(session.id,2).length>0);
  await assert.rejects(call(session.id,'layout.pages.duplicateSpread',{spread:1,path:'/private'},{expectedVersion:2}));
  await assert.rejects(call(session.id,'layout.pages.duplicateSpread',{spread:2},{expectedVersion:2}),/Unknown spread/);
  await assert.rejects(call(session.id,'layout.pages.duplicateSpread',{spread:0},{expectedVersion:1}),e=>e.code==='STATE_VERSION_CONFLICT');
  assert.deepEqual(worker.commands,['layout.pages.duplicateSpread']);await design.close(session.id,{discard:true});
});

test('Original Pages drag moves to the final index only after worker ACK and refuses malformed, stale or out-of-range moves',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});await call(session.id,'layout.pages.insert',{after:0,count:2},{expectedVersion:1});
  const worker=engines.find(engine=>!engine.closed),command=worker.call.bind(worker),names=()=>worker.doc.spreads.flatMap(sp=>sp.pages.map(p=>p.name));
  assert.deepEqual(names(),['1','2','3']);
  worker.call=async(method,p)=>{if(method==='command'&&p.command==='layout.pages.move')throw new Error('worker rejected move');return command(method,p);};
  await assert.rejects(call(session.id,'layout.pages.move',{from:2,to:0},{expectedVersion:2}),/worker rejected/);
  assert.equal((await call(session.id,'state')).stateVersion,2);assert.deepEqual(names(),['1','2','3']);
  let release,entered;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  worker.call=async(method,p)=>{if(method==='command'&&p.command==='layout.pages.move'){entered();await gate;}return command(method,p);};
  const pending=call(session.id,'layout.pages.move',{from:2,to:0},{expectedVersion:2});await started;
  assert.deepEqual(names(),['1','2','3']);release();const moved=await pending;
  assert.deepEqual(names(),['3','1','2']);assert.equal(moved.result.commandId,'layout.pages.move');assert.equal(moved.stateVersion,3);assert.equal(moved.document.pageCount,3);assert.equal(moved.document.dirty,true);
  assert.deepEqual(moved.documentSnapshot.spreads.flatMap(sp=>sp.pages.map(p=>p.name)),['3','1','2']);assert.ok(design.preview(session.id,new URL(moved.preview,'http://localhost').searchParams.get('v')).length);
  for(const params of [{from:0,to:3},{from:3,to:0},{from:-1,to:0},{from:0,to:0.5},{from:0,to:'1'},{from:0},{from:0,to:1,path:'/private'},{from:Number.MAX_SAFE_INTEGER+1,to:0}])await assert.rejects(call(session.id,'layout.pages.move',params,{expectedVersion:3}));
  await assert.rejects(call(session.id,'layout.pages.move',{from:0,to:1},{expectedVersion:2}),e=>e.code==='STATE_VERSION_CONFLICT');
  assert.equal(worker.commands.filter(id=>id==='layout.pages.move').length,1);assert.equal((await call(session.id,'state')).stateVersion,3);
  const forward=await call(session.id,'layout.pages.move',{from:0,to:2},{expectedVersion:3});assert.equal(forward.stateVersion,4);assert.deepEqual(names(),['1','2','3']);
  await design.close(session.id,{discard:true});
});

test('Pages selection commits its view revision only after a bounded render, without mutating the native document',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});await call(session.id,'layout.pages.insert',{after:0,count:1},{expectedVersion:1});
  const worker=engines.find(engine=>!engine.closed),original=worker.call.bind(worker),document=structuredClone(worker.doc);
  for(const params of [{},{index:-1},{index:2},{index:0.5},{index:'1'},{index:1,path:'/private'},{index:Number.MAX_SAFE_INTEGER+1}])await assert.rejects(call(session.id,'page.select',params,{expectedVersion:2}));
  await assert.rejects(call(session.id,'page.select',{index:1},{expectedVersion:1}),e=>e.code==='STATE_VERSION_CONFLICT');
  worker.call=async(method,p)=>{if(method==='render'&&p.page===1)throw new Error('render failed');return original(method,p);};
  await assert.rejects(call(session.id,'page.select',{index:1},{expectedVersion:2}),/render failed/);
  let state=await call(session.id,'state');assert.equal(state.page,0);assert.equal(state.stateVersion,2);
  worker.call=async(method,p)=>method==='render'&&p.page===1?{pngBase64:'invalid'}:original(method,p);
  await assert.rejects(call(session.id,'page.select',{index:1},{expectedVersion:2}),/preview/);
  state=await call(session.id,'state');assert.equal(state.page,0);assert.equal(state.stateVersion,2);
  let release,entered;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  worker.call=async(method,p)=>{if(method==='render'&&p.page===1){entered();await gate;}return original(method,p);};
  const pending=call(session.id,'page.select',{index:1},{expectedVersion:2});await started;assert.deepEqual(worker.doc,document);release();
  const selected=await pending;assert.equal(selected.page,1);assert.equal(selected.stateVersion,3);assert.equal(selected.result.commandId,'page.select');assert.equal(selected.document.dirty,true);
  assert.deepEqual(worker.doc,document);assert.deepEqual(worker.commands,['layout.pages.insert']);
  worker.doc.dirty=false;const clean=await call(session.id,'page.select',{index:0},{expectedVersion:3});assert.equal(clean.page,0);assert.equal(clean.stateVersion,4);assert.equal(clean.document.dirty,false);
  assert.deepEqual(clean.document.selection,selected.document.selection);assert.deepEqual(clean.documentSnapshot.spreads,selected.documentSnapshot.spreads);
  await design.close(session.id,{discard:true});
});

test('Server caret geometry is bounded, selection-bound and rejected before page ACK mutation',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  await call(session.id,'layout.pages.insert',{after:0,count:1},{expectedVersion:1});
  const worker=engines.find(engine=>!engine.closed),original=worker.call.bind(worker);
  worker.doc.selection.text={story:9,anchor:2,focus:2};worker.doc.spreads[0].items=[{id:6,children:[{id:7,story:9}]}];
  const valid={page:1,frame:7,story:9,points:[[50,60],[50,72]]};let overlay=valid;
  worker.call=async(method,p)=>{const result=await original(method,p);return method==='render'?{...result,caret:overlay}:result;};
  for(const bad of [{...valid,page:0},{...valid,story:10},{...valid,frame:8},{...valid,points:[[Infinity,60],[50,72]]},{...valid,points:[[801,60],[801,72]]},{...valid,points:[[50,60,1],[50,72]]},{...valid,path:'/private'}]){
    overlay=bad;await assert.rejects(call(session.id,'page.select',{index:1},{expectedVersion:2}),/caret geometry/);
  }
  overlay=valid;worker.doc.spreads[0].items[0].children[0].story=10;await assert.rejects(call(session.id,'page.select',{index:1},{expectedVersion:2}),/caret geometry/);worker.doc.spreads[0].items[0].children[0].story=9;
  overlay=null;let previous=await call(session.id,'state');assert.equal(previous.page,0);assert.equal(previous.stateVersion,2);
  overlay=valid;const ack=await call(session.id,'page.select',{index:1},{expectedVersion:2});assert.deepEqual(ack.caret,valid);assert.equal(ack.stateVersion,3);
  worker.doc.selection.text.cell={table:12,row:0,col:0};
  const cellValid={...valid,cell:{table:12,row:0,col:0}};
  for(const cell of [undefined,null,{table:13,row:0,col:0},{table:12,row:1,col:0},{table:12,row:0,col:4096},{table:12,row:0,col:0,path:'/private'}]){overlay={...valid,...(cell===undefined?{}:{cell})};await assert.rejects(call(session.id,'page.select',{index:1},{expectedVersion:3}),/caret geometry/);}
  overlay=cellValid;const cellAck=await call(session.id,'page.select',{index:1},{expectedVersion:3});assert.deepEqual(cellAck.caret,cellValid);assert.equal(cellAck.stateVersion,4);
  worker.doc.selection.text.focus=3;await assert.rejects(call(session.id,'page.select',{index:0},{expectedVersion:4}),/caret geometry/);
  overlay=null;previous=await call(session.id,'state');assert.equal(previous.page,1);assert.equal(previous.stateVersion,4);assert.equal(previous.caret,null);
  await design.close(session.id,{discard:true});
});

test('Native inverse-selection metadata binds page/range/frames and bounds before view ACK',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);await call(session.id,'file.new',{preset:'A4'});await call(session.id,'layout.pages.insert',{after:0,count:1},{expectedVersion:1});
  const worker=engines.find(engine=>!engine.closed),original=worker.call.bind(worker);worker.doc.selection.text={story:9,anchor:0,focus:6};worker.doc.spreads[0].items=[{id:6,children:[{id:7,story:9}]}];
  const valid={page:1,story:9,anchor:0,focus:6,quadCount:2,glyphCount:6,frames:[7],bounds:[40,80,140,112]};let selection=valid;
  worker.call=async(method,p)=>{const result=await original(method,p);return method==='render'?{...result,textSelection:selection}:result;};
  for(const bad of [{...valid,page:0},{...valid,anchor:1},{...valid,story:10},{...valid,frames:[8]},{...valid,frames:[7,7]},{...valid,bounds:[0,0,801,100]},{...valid,bounds:[0,0,1.1,10]},{...valid,quadCount:4097},{...valid,glyphCount:32769},{...valid,path:'/private'}]){selection=bad;await assert.rejects(call(session.id,'page.select',{index:1},{expectedVersion:2}),/text selection geometry/);}
  selection=null;const before=await call(session.id,'state');assert.equal(before.stateVersion,2);assert.equal(before.page,0);
  selection=valid;const selected=await call(session.id,'page.select',{index:1},{expectedVersion:2});assert.deepEqual(selected.textSelection,valid);assert.equal(selected.stateVersion,3);assert.equal(selected.caret,null);
  worker.doc.selection.text.cell={table:12,row:0,col:0};const cellValid={...valid,cell:{table:12,row:0,col:0}};
  for(const cell of [undefined,null,{table:13,row:0,col:0},{table:12,row:1,col:0},{table:12,row:0,col:4096},{table:12,row:0,col:0,path:'/private'}]){selection={...valid,...(cell===undefined?{}:{cell})};await assert.rejects(call(session.id,'page.select',{index:1},{expectedVersion:3}),/text selection geometry/);}
  selection=cellValid;const cellSelected=await call(session.id,'page.select',{index:1},{expectedVersion:3});assert.deepEqual(cellSelected.textSelection,cellValid);assert.equal(cellSelected.stateVersion,4);
  await design.close(session.id,{discard:true});
});

test('Original Delete Page command preserves its engine ID and rejects invalid or final-page deletions before worker mutation',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);await call(session.id,'file.new',{preset:'A4'});await call(session.id,'layout.pages.duplicateSpread',{spread:0},{expectedVersion:1});
  const worker=engines.find(engine=>!engine.closed),deleted=await call(session.id,'layout.pages.delete',{pages:[1]},{expectedVersion:2});
  assert.deepEqual(worker.commands,['layout.pages.duplicateSpread','layout.pages.delete']);assert.deepEqual(worker.commandParams[1],{pages:[1]});assert.equal(deleted.result.commandId,'layout.pages.delete');assert.equal(deleted.stateVersion,3);assert.equal(deleted.document.pageCount,1);assert.equal(deleted.document.dirty,true);
  await assert.rejects(call(session.id,'layout.pages.delete',{pages:[0]},{expectedVersion:3}),/last page/i);await assert.rejects(call(session.id,'layout.pages.delete',{pages:[4]},{expectedVersion:3}),/Unknown page/);await assert.rejects(call(session.id,'layout.pages.delete',{pages:[0,0]},{expectedVersion:3}),/unique/i);assert.equal(worker.commands.length,2);await design.close(session.id,{discard:true});
});

test('Original Edit > Deselect All reaches the owned worker without dirtying the document',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const worker=engines.find(engine=>!engine.closed);worker.doc.selection={items:[7]};worker.doc.dirty=false;
  const cleared=await call(session.id,'edit.deselectAll',{}, {expectedVersion:1});
  assert.deepEqual(worker.commands,['edit.deselectAll']);assert.equal(cleared.result.commandId,'edit.deselectAll');assert.equal(cleared.stateVersion,2);assert.deepEqual(cleared.document.selection.items,[]);assert.equal(cleared.document.dirty,false);
  await assert.rejects(call(session.id,'edit.deselectAll',{path:'/private'}),/unsupported|parameters/i);
  await design.close(session.id,{discard:true});
});

test('Original Edit > Clear reaches the owned worker with a revisioned dirty ACK',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const cleared=await call(session.id,'edit.clear',{}, {expectedVersion:1}),worker=engines.find(engine=>!engine.closed);
  assert.deepEqual(worker?.commands,['edit.clear']);assert.equal(cleared.result.commandId,'edit.clear');assert.equal(cleared.stateVersion,2);assert.equal(cleared.document.dirty,true);
  await assert.rejects(call(session.id,'edit.clear',{ids:[999]}),/unsupported|parameters/i);
  assert.deepEqual(worker?.commands,['edit.clear']);await design.close(session.id,{discard:true});
});

test('Original Undo and Redo ACKs retain their exact command IDs',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const worker=engines.find(engine=>!engine.closed);
  const undone=await call(session.id,'edit.undo',{}, {expectedVersion:1});
  assert.deepEqual(worker?.commands,['edit.undo']);assert.equal(undone.result.commandId,'edit.undo');assert.equal(undone.result.undone,'Clear');assert.equal(undone.stateVersion,2);
  const redone=await call(session.id,'edit.redo',{}, {expectedVersion:2});
  assert.deepEqual(worker?.commands,['edit.undo','edit.redo']);assert.equal(redone.result.commandId,'edit.redo');assert.equal(redone.result.redone,'Clear');assert.equal(redone.stateVersion,3);
  await assert.rejects(call(session.id,'edit.undo',{path:'/private'}),/unsupported|parameters/i);
  await assert.rejects(call(session.id,'edit.redo',{path:'/private'}),/unsupported|parameters/i);
  assert.deepEqual(worker?.commands,['edit.undo','edit.redo']);await design.close(session.id,{discard:true});
});

test('Original text.insert reaches the owned worker unchanged and returns a revisioned ACK',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const inserted=await call(session.id,'text.insert',{text:'Hello Ω',raw:true},{expectedVersion:1}),worker=engines.find(engine=>!engine.closed);
  assert.deepEqual(worker?.commands,['text.insert']);assert.equal(inserted.result.commandId,'text.insert');assert.equal(inserted.stateVersion,2);assert.equal(inserted.document.dirty,true);
  for(const params of [{text:'x'.repeat(4097)},{text:'x',raw:'yes'},{text:'x',path:'/private'}])await assert.rejects(call(session.id,'text.insert',params));
  assert.deepEqual(worker?.commands,['text.insert']);await design.close(session.id,{discard:true});
});

test('Original Text Tool text.delete preserves upstream direction flags and ACK identity',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const deleted=await call(session.id,'text.delete',{forward:true,word:true},{expectedVersion:1}),worker=engines.find(engine=>!engine.closed);
  assert.deepEqual(worker?.commands,['text.delete']);assert.deepEqual(worker?.commandParams,[{forward:true,word:true}]);assert.equal(deleted.result.commandId,'text.delete');assert.equal(deleted.stateVersion,2);assert.equal(deleted.document.dirty,true);
  for(const params of [{forward:'yes'},{word:1},{forward:true,path:'/private'}])await assert.rejects(call(session.id,'text.delete',params));
  assert.deepEqual(worker?.commands,['text.delete']);await design.close(session.id,{discard:true});
});

test('Original text.select routes bounded UTF-8 caret offsets and returns an ACK',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const selected=await call(session.id,'text.select',{story:7,anchor:4,focus:6},{expectedVersion:1}),worker=engines.find(engine=>!engine.closed);
  assert.deepEqual(worker?.commands,['text.select']);assert.equal(selected.result.commandId,'text.select');assert.equal(selected.stateVersion,2);assert.equal(selected.document.dirty,true);
  for(const params of [{story:-1,anchor:0},{story:1,anchor:0,focus:16*1024*1024+1},{story:1,anchor:0,extra:true}])await assert.rejects(call(session.id,'text.select',params));
  assert.deepEqual(worker?.commands,['text.select']);await design.close(session.id,{discard:true});
});

test('Original graphic Frame Tool preserves its server command and document bounds',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const params={rect:[40,50,180,190],shape:'rectangle',content:'graphic'},created=await call(session.id,'frame.create',params,{expectedVersion:1}),worker=engines.find(engine=>!engine.closed);
  assert.deepEqual(worker?.commands,['frame.create']);assert.deepEqual(worker?.commandParams,[{...params,caret:false,spread:0}]);assert.equal(created.result.commandId,'frame.create');assert.equal(created.stateVersion,2);
  await design.close(session.id,{discard:true});
});

test('Original selection.set keeps its upstream ID through the owned worker ACK and read-model',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const selected=await call(session.id,'selection.set',{ids:[41,42],add:true},{expectedVersion:1}),worker=engines.find(engine=>!engine.closed);
  assert.deepEqual(worker?.commands,['selection.set']);assert.equal(selected.result.commandId,'selection.set');assert.equal(selected.stateVersion,2);
  assert.deepEqual(selected.document.selection.items,[41,42]);assert.equal(selected.document.dirty,true);
  for(const params of [{ids:Array(201).fill(1)},{ids:[-1]},{ids:[1],path:'/private'}])await assert.rejects(call(session.id,'selection.set',params));
  assert.deepEqual(worker?.commands,['selection.set']);await design.close(session.id,{discard:true});
});

test('Original Type Tool text.placeCaret routes the unchanged frame and point to the worker',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);
  await call(session.id,'file.new',{preset:'A4'});
  const placed=await call(session.id,'text.placeCaret',{frame:41,point:[126.5,208]},{expectedVersion:1}),worker=engines.find(engine=>!engine.closed);
  assert.deepEqual(worker?.commands,['text.placeCaret']);assert.equal(placed.result.commandId,'text.placeCaret');assert.equal(placed.stateVersion,2);
  for(const params of [{frame:-1,point:[1,2]},{frame:1,point:[1]},{frame:1,point:[1,2,3]},{frame:1,point:[Infinity,2]},{frame:1,point:[1,2],path:'/private'}])await assert.rejects(call(session.id,'text.placeCaret',params));
  assert.deepEqual(worker?.commands,['text.placeCaret']);await design.close(session.id,{discard:true});
});

test('Design Save a Copy destinations stay independent on a writable provider session',async t=>{
  const {project,root,design,call}=await fixture(t,{settleOutput:async()=>{}}),shareRoot=path.join(root,'selected-share');await mkdir(shareRoot);
  const session=await design.create(shareRoot,{writeRoot:shareRoot,workspaceRoot:project,shareId:'selected-share',laptopOutput:true});
  await call(session.id,'file.new',{preset:'A4'});await call(session.id,'frame.create',{rect:[1,1,20,20],content:'unassigned'});
  const server=await call(session.id,'file.saveACopy',{path:'copies/server.designcraft',destination:'server',retention:'workspace'});
  assert.equal(server.result.destination,'server');assert.ok(await readFile(path.join(project,'copies/server.designcraft')));await assert.rejects(readFile(path.join(shareRoot,'copies/server.designcraft')));
  const laptop=await call(session.id,'file.saveACopy',{path:'copies/laptop.designcraft',destination:'laptop',retention:'workspace'});
  assert.equal(laptop.result.destination,'laptop');assert.ok(await readFile(path.join(shareRoot,'copies/laptop.designcraft')));await assert.rejects(readFile(path.join(project,'copies/laptop.designcraft')));
  assert.equal(await realpath(await design.output(session.id,'copies/server.designcraft')),await realpath(path.join(project,'copies/server.designcraft')));
  assert.equal(await realpath(await design.output(session.id,'copies/laptop.designcraft')),await realpath(path.join(shareRoot,'copies/laptop.designcraft')));
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
  const share=await (await api('/api/storage/shares','POST',{app:'designcraft',name:'Design copy',mode:'transfer',access:'readwrite'})).json();assert.equal((await api('/api/designcraft/sessions','POST',{sourceShareId:share.id})).status,403);assert.equal((await api(`/api/storage/shares/${share.id}`,'DELETE',{})).status,200);
});

test('Design readiness refuses an unrelated engine',async t=>{const {design,project}=await fixture(t,{processFactory:()=>({call:async()=>({runtimeId:'unrelated-design-tool'}),stop(){}})});assert.equal((await design.status()).ready,false);await assert.rejects(design.create(project),e=>e.status===503);});

test('Design refuses incomplete multi-file exports before publishing or acknowledging',async t=>{
  class LinkedFixture extends DesignFixture{async call(method,p){const result=await super.call(method,p);if(method==='export')await writeFile(path.join(path.dirname(p.path),'linked.png'),'fixture asset');return result;}}
  const {design,project,call}=await fixture(t,{processFactory:()=>new LinkedFixture()});const session=await design.create(project);await call(session.id,'doc.new',{width:800,height:600,pages:1});
  await assert.rejects(call(session.id,'doc.save',{path:'incomplete.pdf'}),e=>e.status===422);await assert.rejects(readFile(path.join(project,'incomplete.pdf')),e=>e.code==='ENOENT');assert.equal((await call(session.id,'state')).document.dirty,true);await assert.rejects(design.output(session.id,'incomplete.pdf'),e=>e.status===403);
});

test('Design inserts pages through the owned server command with page-count bounds',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);await call(session.id,'file.new',{preset:'A4'});const worker=engines.find(engine=>!engine.closed);
  const inserted=await call(session.id,'layout.pages.insert',{after:0,count:2},{expectedVersion:1});
  assert.deepEqual(worker.commands,['layout.pages.insert']);assert.deepEqual(worker.commandParams[0],{after:0,count:2});assert.equal(inserted.result.commandId,'layout.pages.insert');assert.equal(inserted.stateVersion,2);assert.equal(inserted.document.pageCount,3);assert.equal(inserted.document.dirty,true);
  await assert.rejects(call(session.id,'layout.pages.insert',{after:3,count:1},{expectedVersion:2}),/Unknown page/);await assert.rejects(call(session.id,'layout.pages.insert',{after:0,count:62},{expectedVersion:2}),/64-page/);await assert.rejects(call(session.id,'layout.pages.insert',{after:-1,count:1},{expectedVersion:2}),/after index/);assert.equal(worker.commands.length,1);await design.close(session.id,{discard:true});
});


test('Tagged footnote geometry binds exact canonical note/story/range and rejects numeric pseudo-tables',async t=>{
  const {project,design,engines,call}=await fixture(t),session=await design.create(project);await call(session.id,'file.new',{preset:'A4'});
  const worker=engines.find(e=>!e.closed),original=worker.call.bind(worker),note={kind:'footnote',id:'1'};
  worker.doc.selection.text={story:9,anchor:2,focus:2,note};worker.doc.spreads[0].items=[{id:7,story:9}];worker.doc.stories=[{id:9,notes:[{...note,length:13}]}];worker.doc.documentSnapshot={stories:{9:{notes:[{id:1,text:{text:'Footnote text'}}]}}};
  const valid={page:0,frame:7,story:9,points:[[50,60],[50,72]],note};let overlay=valid,range=null;
  worker.call=async(method,p)=>{const result=await original(method,p);return method==='render'?{...result,caret:overlay,textSelection:range}:result;};
  for(const bad of [{...valid,note:{kind:'footnote',id:'2'}},{...valid,note:{kind:'footnote',id:'01'}},{...valid,note:{kind:'footnote',id:'4294967296'}},{...valid,note:{kind:'footnote',id:1}},{...valid,cell:{table:18446744073709552000,row:1,col:0}},{...valid,note:{...note,extra:true}}]){overlay=bad;await assert.rejects(call(session.id,'page.select',{index:0},{expectedVersion:1}),/caret geometry/);}
  overlay=valid;const ack=await call(session.id,'page.select',{index:0},{expectedVersion:1});assert.deepEqual(ack.caret,valid);
  worker.doc.documentSnapshot.stories[9].notes[0].id=2;await assert.rejects(call(session.id,'page.select',{index:0},{expectedVersion:2}),/caret geometry/);worker.doc.documentSnapshot.stories[9].notes[0].id=1;
  worker.doc.stories[0].notes=[];await assert.rejects(call(session.id,'page.select',{index:0},{expectedVersion:2}),/caret geometry/);worker.doc.stories[0].notes=[{...note,length:13}];
  worker.doc.selection.text.focus=14;await assert.rejects(call(session.id,'state'),/caret geometry/);
  worker.doc.documentSnapshot.stories[9].notes[0].text.text='éX';worker.doc.stories[0].notes[0].length=3;worker.doc.selection.text.anchor=1;worker.doc.selection.text.focus=1;await assert.rejects(call(session.id,'state'),/caret geometry/);worker.doc.documentSnapshot.stories[9].notes[0].text.text='Footnote text';worker.doc.stories[0].notes[0].length=13;
  worker.doc.selection.text.anchor=0;worker.doc.selection.text.focus=13;overlay=null;range={page:0,story:9,anchor:0,focus:13,quadCount:1,glyphCount:0,frames:[7],bounds:[40,80,140,100],note};
  const selected=await call(session.id,'page.select',{index:0},{expectedVersion:2});assert.deepEqual(selected.textSelection,range);
  range={...range,note:{kind:'footnote',id:'2'}};await assert.rejects(call(session.id,'page.select',{index:0},{expectedVersion:3}),/text selection geometry/);
  await design.close(session.id,{discard:true});
});
