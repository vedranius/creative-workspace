import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createWorkspaceServer} from '../src/server.js';
import {originalUiPatches,originalUiPackageId} from '../src/original-ui.js';
const root=path.resolve(process.env.CW_PAR03_WORK_ROOT||'build/host-tmp/designcraft-footnote-insert');await mkdir(root,{recursive:true});
const fixturePath=process.env.CW_DESIGNCRAFT_FOOTNOTE_FIXTURE;if(!fixturePath)throw Error('Set generated native footnote fixture');
const uiDirectory=path.join(process.env.CW_ORIGINAL_UI_DIR,'designcraft',originalUiPackageId('designcraft'));
const uiManifest=JSON.parse(await readFile(path.join(uiDirectory,'creative-workspace-ui.json')));
const fixture=await readFile(fixturePath),geometry=JSON.parse(await readFile(fixturePath+'.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex'),originalHash=hash(fixture);
const scratch=await mkdtemp(path.join(root,'qa-'));await mkdir(path.join(scratch,'projects'));
const server=await createWorkspaceServer({dataDir:path.join(scratch,'data'),allowedRoots:[path.join(scratch,'projects')],originalUiRoot:process.env.CW_ORIGINAL_UI_DIR,designcraftOptions:{binary:process.env.CW_DESIGNCRAFT_BINARY,stateDir:path.join(scratch,'sessions')}});
const handlers=server.listeners('request');server.removeAllListeners('request');const acks=[];
server.on('request',(req,res)=>{if(/\/api\/designcraft\/sessions\/[a-f0-9]{48}\/rpc$/.test(req.url)){const end=res.end.bind(res);res.end=(data,...args)=>{if(data&&res.statusCode===200)acks.push(JSON.parse(data.toString()));return end(data,...args);};}for(const h of handlers)h.call(server,req,res);});
let browser,sessionId,reopenId,page,cleanup=async()=>{};const shares=[],errors=[],requests=[],failedResponses=[],requestFailures=[];
try{
 server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(route,method='POST',body={})=>{const r=await fetch(base+route,{method,headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)}),v=await r.json();if(!r.ok)throw Error(v.error);return v;};
 cleanup=async()=>{for(const id of [sessionId,reopenId].filter(Boolean))await post(`/api/designcraft/sessions/${id}`,'DELETE',{discard:true}).catch(()=>{});for(const id of shares)await post(`/api/storage/shares/${id}`,'DELETE',{}).catch(()=>{});};
 const modulePath=process.env.CW_PLAYWRIGHT_MODULE;const {chromium}=await import(modulePath.startsWith('file:')?modulePath:pathToFileURL(path.resolve(modulePath)).href);
 browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.CW_BROWSER_EXECUTABLE,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(({payload})=>{
  const files=new Map([['chosen.designcraft',Uint8Array.from(atob(payload),c=>c.charCodeAt(0))],['unrelated.bin',new Uint8Array(1024)]]);window.__cwFiles=files;
  const dir=(name='Generated laptop publications',prefix='')=>({kind:'directory',name,async *entries(){const seen=new Set();for(const key of files.keys()){const rest=key.slice(prefix?prefix.length+1:0);if(!rest)continue;const part=rest.split('/')[0];if(seen.has(part))continue;seen.add(part);yield [part,rest.includes('/')?dir(part,[prefix,part].filter(Boolean).join('/')):fileHandle(part,[prefix,part].filter(Boolean).join('/'))];}},async getDirectoryHandle(n){const next=[prefix,n].filter(Boolean).join('/');if(![...files.keys()].some(k=>k.startsWith(next+'/')))throw new DOMException('Missing folder','NotFoundError');return dir(n,next);},async getFileHandle(n,{create=false}={}){const key=[prefix,n].filter(Boolean).join('/');if(!files.has(key)&&!create)throw new DOMException('Missing file','NotFoundError');if(create&&!files.has(key))files.set(key,new Uint8Array());return fileHandle(n,key);},async removeEntry(n){files.delete([prefix,n].filter(Boolean).join('/'));}});
  const fileHandle=(name,key)=>({kind:'file',name,async getFile(){const bytes=files.get(key);if(!bytes)throw new DOMException('Missing file','NotFoundError');return new File([bytes],name,{lastModified:Date.now()});},async createWritable({keepExistingData=false}={}){let bytes=keepExistingData?(files.get(key)||new Uint8Array()).slice():new Uint8Array();return {async write(command){const at=command.position||0,data=command.data instanceof Blob?new Uint8Array(await command.data.arrayBuffer()):new Uint8Array(command.data);if(at+data.length>bytes.length){const grown=new Uint8Array(at+data.length);grown.set(bytes);bytes=grown;}bytes.set(data,at);},async close(){files.set(key,bytes);}};}});
  window.showDirectoryPicker=async()=>dir();
 },{payload:fixture.toString('base64')});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>requestFailures.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',async r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status(),body:await r.text().catch(()=>'<unreadable>')});});page.on('request',r=>{const m=r.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(m){sessionId=m[1];requests.push(r.postDataJSON());}});page.on('response',async r=>{if(r.url().endsWith('/api/storage/shares')&&r.status()===201)shares.push((await r.json()).id);});
 await page.goto(base+'/original/designcraft/?webgl');await page.getByRole('button',{name:'Choose laptop folder…'}).click();await page.getByRole('button',{name:'Start this mode'}).click();
 const canvas=page.locator('#designcraft_canvas');await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-open'),null,{timeout:120000});
 await page.mouse.click(...JSON.parse(await canvas.getAttribute('data-original-open')));await page.getByRole('button',{name:'◇ chosen.designcraft'}).click();
 const ack=async(n,allowQueued=false)=>{await page.waitForFunction(({n,allowQueued})=>Number(document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision'))>=n&&(allowQueued||document.querySelector('#designcraft_canvas')?.getAttribute('data-server-pending')==='false'),{n,allowQueued},{timeout:30000});const a=acks.find(a=>a.stateVersion===n);assert.ok(a);return a;};
 const opened=await ack(1);assert.equal(opened.document.pageCount,3);
 await page.mouse.click(...JSON.parse(await canvas.getAttribute('data-original-pages-tab')));await page.waitForFunction(()=>JSON.parse(document.querySelector('#designcraft_canvas')?.getAttribute('data-original-page-thumbnails')||'[]').length===3);
 const clickPage=async index=>{const t=JSON.parse(await canvas.getAttribute('data-original-page-thumbnails'));await page.mouse.click(...t.find(p=>p.index===index).center);};
 await clickPage(1);await ack(2);
 await clickPage(2);const selectedPage=await ack(3);const bounds=selectedPage.document.spreads[1].pages.find(p=>p.index===2).bounds;
 const scale=858/(bounds[3]-bounds[1]),displayX=602.5-(bounds[2]-bounds[0])*scale/2;
 const click=[displayX+(geometry.point[0]-bounds[0])*scale,110+(geometry.point[1]-bounds[1])*scale];

 const png=async a=>Buffer.from(await(await fetch(base+a.preview,{headers:{Origin:base}})).arrayBuffer());
 const caretScreen=async()=>JSON.parse(await canvas.getAttribute('data-server-caret-screen'));

 const beforeBody=selectedPage.documentSnapshot.stories[String(geometry.story)].text;
 await page.keyboard.press('t');await page.mouse.click(...click);const body=await ack(4);assert.equal(body.document.selection.text.note,undefined);assert.equal(body.document.selection.text.cell,undefined);assert.deepEqual(body.documentSnapshot,selectedPage.documentSnapshot);
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#designcraft_canvas')?.getAttribute('data-server-caret-screen')||'null')!==null);const bodyCaret=await caretScreen();assert.ok(bodyCaret);
 const typeMenu=JSON.parse(await canvas.getAttribute('data-original-type-menu'));assert.ok(typeMenu);await page.mouse.click(...typeMenu);
 for(let attempt=0;attempt<10&&!await canvas.getAttribute('data-original-insert-footnote');attempt++){await page.mouse.move(typeMenu[0]+100,500);await page.mouse.wheel(0,180);await page.waitForTimeout(150);}
 await page.waitForTimeout(600); // Let the original menu's wheel scrolling settle before taking its hit rectangle.
 const insertItem=JSON.parse(await canvas.getAttribute('data-original-insert-footnote'));assert.ok(insertItem,'original Type menu exposes enabled Insert Footnote');
 if(process.env.CW_PAR03_FOOTNOTE_SCREENSHOT)await page.screenshot({path:process.env.CW_PAR03_FOOTNOTE_SCREENSHOT.replace(/\.png$/,'.menu.png')});
 let releaseInsert,enteredInsert;const held=new Promise(r=>releaseInsert=r),started=new Promise(r=>enteredInsert=r);
 await page.route('**/api/designcraft/sessions/*/rpc',async route=>{if(route.request().postDataJSON().method!=='footnote.insert'){await route.continue();return;}const response=await route.fetch();enteredInsert();await held;await route.fulfill({response});});
 try{await page.mouse.click(...insertItem);let timer;try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No original Insert Footnote request')),10000);})]);}finally{clearTimeout(timer);}
  assert.equal(await canvas.getAttribute('data-server-revision'),'4');assert.equal(await canvas.getAttribute('data-server-pending'),'true');assert.deepEqual(await caretScreen(),bodyCaret);
  assert.deepEqual(requests.find(r=>r.method==='footnote.insert').params,{});await page.keyboard.type('N');await page.waitForTimeout(200);assert.equal(requests.filter(r=>r.method==='text.insert').length,0,'typing is held in original FIFO until Insert ACK');
 }finally{releaseInsert();}
 const inserted=await ack(5,true),typed=await ack(6);await page.unroute('**/api/designcraft/sessions/*/rpc');
 const note={kind:'footnote',id:String(inserted.result.id)},story=String(geometry.story),noteText=a=>a.documentSnapshot.stories[story].notes.find(n=>String(n.id)===note.id).text.text;
 assert.equal(inserted.result.commandId,'footnote.insert');assert.equal(inserted.result.story,geometry.story);assert.deepEqual(inserted.document.selection.text.note,note);assert.equal(inserted.document.selection.text.anchor,0);assert.equal(inserted.document.selection.text.focus,0);assert.equal(noteText(inserted),'');
 assert.equal(inserted.documentSnapshot.stories[story].text,beforeBody.slice(0,body.document.selection.text.focus)+'\ue00a'+beforeBody.slice(body.document.selection.text.focus));assert.equal(inserted.documentSnapshot.stories[story].notes.length,1);
 assert.equal(noteText(typed),'N');assert.deepEqual(typed.caret.note,note);assert.equal(typed.documentSnapshot.stories[story].text,inserted.documentSnapshot.stories[story].text);assert.deepEqual(typed.documentSnapshot.spreads[0],body.documentSnapshot.spreads[0]);
 assert.deepEqual(requests.slice(4,6).map(r=>r.method),['footnote.insert','text.insert']);assert.equal(requests[5].expectedVersion,5);
 const typedHash=hash(await png(typed));await page.keyboard.press('Control+z');const undoText=await ack(7);assert.equal(noteText(undoText),'');await page.keyboard.press('Control+z');const undoInsert=await ack(8);assert.deepEqual(undoInsert.documentSnapshot,body.documentSnapshot);assert.equal(undoInsert.document.selection.text.note,undefined);
 await page.keyboard.press('Control+Shift+z');const redoInsert=await ack(9);assert.equal(noteText(redoInsert),'');await page.keyboard.press('Control+Shift+z');const redoText=await ack(10);assert.deepEqual(redoText.documentSnapshot,typed.documentSnapshot);assert.equal(hash(await png(redoText)),typedHash);
 const sourceBytes=Buffer.from(await page.evaluate(()=>Array.from(window.__cwFiles.get('chosen.designcraft'))));assert.equal(hash(sourceBytes),originalHash);
 const saved=await post(`/api/designcraft/sessions/${sessionId}/rpc`,'POST',{method:'file.saveACopy',params:{path:'inserted-footnote-copy.designcraft',destination:'server',retention:'workspace'},requestId:crypto.randomUUID(),expectedVersion:10});assert.deepEqual(saved.documentSnapshot,typed.documentSnapshot);
 const openedAgain=await post('/api/designcraft/sessions');reopenId=openedAgain.id;const reopened=await post(`/api/designcraft/sessions/${reopenId}/rpc`,'POST',{method:'doc.open',params:{path:'inserted-footnote-copy.designcraft'},requestId:crypto.randomUUID(),expectedVersion:0});assert.deepEqual(reopened.documentSnapshot,typed.documentSnapshot);assert.equal(noteText(reopened),'N');
 assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);assert.deepEqual(requestFailures,[]);
 if(process.env.CW_PAR03_FOOTNOTE_SCREENSHOT)await page.screenshot({path:process.env.CW_PAR03_FOOTNOTE_SCREENSHOT});
 const wasmArtifact=uiManifest.files.find(f=>f.path.endsWith('.wasm'));assert.ok(wasmArtifact);assert.equal(hash(await readFile(path.join(uiDirectory,wasmArtifact.path))),wasmArtifact.sha256);
 const report={status:'original-Type-Insert-Footnote-ack-fifo-undo-save-reopen-passed',workerSha256:hash(await readFile(process.env.CW_DESIGNCRAFT_BINARY)),uiWasm:wasmArtifact,sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',sourcePatchSha256:originalUiPatches.designcraft.sha256,fixture:{generatedNative:true,sha256:originalHash},originalMenu:{typeMenu,insertItem,commandId:inserted.result.commandId,params:{}},heldInsertAck:{priorRevision:4,acceptedRevision:5,bodyCaretHeld:true,typingQueuedUntilAck:true},typedNote:{note,text:noteText(typed),revision:6,caret:typed.caret},bodyReferenceOnly:true,canonicalAndPngUndoRedoExact:true,nativeSaveFreshReopenCanonicalExact:true,originalInputUnchanged:true,errors,failedResponses,requestFailures,permission:'Synthetic browser folder plus owned on-demand helper; actual original Open/Type menu/Insert Footnote and typing/Undo/Redo. Real OS permission and full provider/tools parity remain unaccepted.'};
 if(process.env.CW_PAR03_FOOTNOTE_REPORT)await writeFile(process.env.CW_PAR03_FOOTNOTE_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 await post(`/api/designcraft/sessions/${sessionId}`,'DELETE',{discard:true});sessionId=null;await post(`/api/designcraft/sessions/${reopenId}`,'DELETE',{discard:true});reopenId=null;for(const id of shares)await post(`/api/storage/shares/${id}`,'DELETE',{});await context.close();
}catch(e){if(page&&process.env.CW_PAR03_FOOTNOTE_SCREENSHOT)await page.screenshot({path:process.env.CW_PAR03_FOOTNOTE_SCREENSHOT}).catch(()=>{});console.error(e);console.error(JSON.stringify({requests,acks:acks.map(a=>({revision:a.stateVersion,error:a.error,result:a.result,selection:a.document?.selection})),errors,failedResponses}));throw e;}finally{await cleanup();await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(scratch,{recursive:true,force:true});}
