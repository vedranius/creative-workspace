import assert from 'node:assert/strict';
import path from 'node:path';
import {inflateSync} from 'node:zlib';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createWorkspaceServer} from '../src/server.js';
import {originalUiPatches,originalUiPackageId} from '../src/original-ui.js';
const root=path.resolve(process.env.CW_PAR03_WORK_ROOT||'build/host-tmp/designcraft-footnote-fix');await mkdir(root,{recursive:true});
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
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>requestFailures.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status()});});page.on('request',r=>{const m=r.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(m){sessionId=m[1];requests.push(r.postDataJSON());}});page.on('response',async r=>{if(r.url().endsWith('/api/storage/shares')&&r.status()===201)shares.push((await r.json()).id);});
 await page.goto(base+'/original/designcraft/?webgl');await page.getByRole('button',{name:'Choose laptop folder…'}).click();await page.getByRole('button',{name:'Start this mode'}).click();
 const canvas=page.locator('#designcraft_canvas');await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-open'),null,{timeout:120000});
 await page.mouse.click(...JSON.parse(await canvas.getAttribute('data-original-open')));await page.getByRole('button',{name:'◇ chosen.designcraft'}).click();
 const ack=async n=>{await page.waitForFunction(n=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')===String(n)&&document.querySelector('#designcraft_canvas')?.getAttribute('data-server-pending')==='false',n,{timeout:30000});const a=acks.find(a=>a.stateVersion===n);assert.ok(a);return a;};
 const opened=await ack(1);assert.equal(opened.document.pageCount,3);
 await page.mouse.click(...JSON.parse(await canvas.getAttribute('data-original-pages-tab')));await page.waitForFunction(()=>JSON.parse(document.querySelector('#designcraft_canvas')?.getAttribute('data-original-page-thumbnails')||'[]').length===3);
 const clickPage=async index=>{const t=JSON.parse(await canvas.getAttribute('data-original-page-thumbnails'));await page.mouse.click(...t.find(p=>p.index===index).center);};
 await clickPage(1);const leftBefore=await ack(2),leftHash=hash(Buffer.from(await(await fetch(base+leftBefore.preview,{headers:{Origin:base}})).arrayBuffer()));
 await clickPage(2);const selectedPage=await ack(3);const bounds=selectedPage.document.spreads[1].pages.find(p=>p.index===2).bounds;
 const scale=858/(bounds[3]-bounds[1]),displayX=602.5-(bounds[2]-bounds[0])*scale/2;
 const click=[displayX+(geometry.point[0]-bounds[0])*scale,110+(geometry.point[1]-bounds[1])*scale];

 const png=async a=>Buffer.from(await(await fetch(base+a.preview,{headers:{Origin:base}})).arrayBuffer());
 const caretScreen=async()=>JSON.parse(await canvas.getAttribute('data-server-caret-screen'));
 const note={kind:'footnote',id:String(geometry.noteId)};
 const noteText=a=>a.documentSnapshot.stories[String(geometry.story)].notes.find(n=>String(n.id)===note.id).text.text;
 await page.keyboard.press('t');await page.mouse.click(...click);const caret=await ack(4);
 assert.deepEqual(caret.document.selection.text.note,note);assert.equal(caret.document.selection.text.cell,undefined);assert.deepEqual(caret.caret.note,note);assert.equal(caret.textSelection,null);
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#designcraft_canvas')?.getAttribute('data-server-caret-screen')||'null')!==null);
 const initialScreen=await caretScreen();assert.deepEqual(caret.documentSnapshot,selectedPage.documentSnapshot);
 await page.keyboard.press('Control+a');const range=await ack(5);assert.deepEqual(range.textSelection.note,note);assert.equal(range.textSelection.focus,13);assert.equal(range.caret,null);assert.equal(await caretScreen(),null);assert.deepEqual(range.documentSnapshot,caret.documentSnapshot);assert.notEqual(hash(await png(range)),hash(await png(caret)));
 let releaseType,enteredType;const held=new Promise(r=>{releaseType=r;}),started=new Promise(r=>{enteredType=r;});
 await page.route('**/api/designcraft/sessions/*/rpc',async route=>{if(route.request().postDataJSON().method!=='text.insert'){await route.continue();return;}const response=await route.fetch();enteredType();await held;await route.fulfill({response});});
 try{await page.keyboard.type('Z');let timer;try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No original typing request')),10000);})]);}finally{clearTimeout(timer);}assert.equal(await canvas.getAttribute('data-server-revision'),'5');assert.equal(await canvas.getAttribute('data-server-pending'),'true');assert.equal(await caretScreen(),null);}finally{releaseType();}
 const typed=await ack(6);await page.unroute('**/api/designcraft/sessions/*/rpc');assert.equal(noteText(typed),'Z');assert.deepEqual(typed.caret.note,note);assert.equal(typed.textSelection,null);assert.deepEqual(typed.documentSnapshot.spreads[0],caret.documentSnapshot.spreads[0]);
 assert.equal(typed.documentSnapshot.stories[String(geometry.story)].text,caret.documentSnapshot.stories[String(geometry.story)].text);
 const typedHash=hash(await png(typed));await page.waitForFunction(()=>JSON.parse(document.querySelector('#designcraft_canvas')?.getAttribute('data-server-caret-screen')||'null')!==null);
 const screenPoints=await caretScreen(),top=Math.floor(Math.min(screenPoints[0][1],screenPoints[1][1]))+2,bottom=Math.ceil(Math.max(screenPoints[0][1],screenPoints[1][1]))-2;
 const clip={x:Math.floor(screenPoints[0][0])-2,y:top,width:5,height:Math.max(1,bottom-top)},samples=[];let visibleShot,maxDark=-1;
 for(let i=0;i<10;i++){const shot=await page.screenshot({clip}),pixels=decodePng(shot),dark=pixels.filter(p=>p[0]<180&&p[1]<180&&p[2]<180).length;samples.push({dark,sha256:hash(shot)});if(dark>maxDark){maxDark=dark;visibleShot=await page.screenshot();}if(Math.max(...samples.map(s=>s.dark))-Math.min(...samples.map(s=>s.dark))>=clip.height/2)break;await page.waitForTimeout(200);}
 assert.ok(samples.some(s=>s.dark>=clip.height/2));assert.ok(Math.max(...samples.map(s=>s.dark))-Math.min(...samples.map(s=>s.dark))>=clip.height/2);assert.equal(hash(await png(typed)),typedHash);
 await clickPage(1);const sibling=await ack(7);assert.equal(hash(await png(sibling)),leftHash);assert.equal(sibling.caret,null);assert.equal(sibling.textSelection,null);assert.equal(await caretScreen(),null);assert.deepEqual(sibling.documentSnapshot,typed.documentSnapshot);
 await clickPage(2);const restored=await ack(8);assert.deepEqual(restored.caret,typed.caret);assert.equal(hash(await png(restored)),typedHash);
 const sourceBytes=Buffer.from(await page.evaluate(()=>Array.from(window.__cwFiles.get('chosen.designcraft'))));assert.equal(hash(sourceBytes),originalHash);
 const saved=await post(`/api/designcraft/sessions/${sessionId}/rpc`,'POST',{method:'file.saveACopy',params:{path:'footnote-fixed-copy.designcraft',destination:'server',retention:'workspace'},requestId:crypto.randomUUID(),expectedVersion:8});assert.deepEqual(saved.documentSnapshot,typed.documentSnapshot);
 const openedAgain=await post('/api/designcraft/sessions');reopenId=openedAgain.id;
 const reopened=await post(`/api/designcraft/sessions/${reopenId}/rpc`,'POST',{method:'doc.open',params:{path:'footnote-fixed-copy.designcraft'},requestId:crypto.randomUUID(),expectedVersion:0});assert.deepEqual(reopened.documentSnapshot,typed.documentSnapshot);assert.equal(noteText(reopened),'Z');
 assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);assert.deepEqual(requestFailures,[]);
 if(process.env.CW_PAR03_FOOTNOTE_SCREENSHOT)await writeFile(process.env.CW_PAR03_FOOTNOTE_SCREENSHOT,visibleShot);
 const wasmArtifact=uiManifest.files.find(f=>f.path.endsWith('.wasm'));assert.ok(wasmArtifact);assert.equal(hash(await readFile(path.join(uiDirectory,wasmArtifact.path))),wasmArtifact.sha256);
 const report={workerSha256:hash(await readFile(process.env.CW_DESIGNCRAFT_BINARY)),uiWasm:wasmArtifact,status:'original-footnote-wire-caret-range-ack-save-reopen-passed',sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',sourcePatchSha256:originalUiPatches.designcraft.sha256,fixture:{generatedNative:true,sha256:originalHash},page:2,originalCaretClick:click,note,wireContainsNoPseudoTable:!JSON.stringify(typed).includes('1844674407370955'),caret:typed.caret,range:range.textSelection,initialScreen,blink:{screenPoints,clip,samples,serverPngUnchanged:true},heldTypingAck:{priorRevision:5,acceptedRevision:6,priorRangeHeld:true},bodyUnchanged:true,canonicalUnchangedBySelection:true,siblingGeometryNull:true,siblingPngUnchanged:true,restoredGeometryAndPngExact:true,nativeSaveFreshReopenCanonicalExact:true,originalInputUnchanged:true,errors,failedResponses,requestFailures,permission:'Synthetic browser folder plus owned on-demand helper; actual original Open/thumbnail/Text Tool/select/typing. Real OS permission and full provider/tool parity remain unaccepted.'};
 assert.equal(report.wireContainsNoPseudoTable,true);
 if(process.env.CW_PAR03_FOOTNOTE_REPORT)await writeFile(process.env.CW_PAR03_FOOTNOTE_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 await post(`/api/designcraft/sessions/${sessionId}`,'DELETE',{discard:true});sessionId=null;await post(`/api/designcraft/sessions/${reopenId}`,'DELETE',{discard:true});reopenId=null;for(const id of shares)await post(`/api/storage/shares/${id}`,'DELETE',{});await context.close();
}catch(e){console.error(e);console.error(JSON.stringify({requests,acks:acks.map(a=>({revision:a.stateVersion,error:a.error,result:a.result,selection:a.document?.selection})),errors}));throw e;}finally{await cleanup();await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(scratch,{recursive:true,force:true});}

// Decode only bounded, 8-bit RGB/RGBA Chromium screenshot crops, no dependencies.
function decodePng(png){
 assert.equal(png.readUInt32BE(0),0x89504e47);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20),channels=png[25]===2?3:png[25]===6?4:0;
 assert.equal(png[24],8);assert.ok(channels&&width*height<4096);
 const chunks=[];for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=length+12;}
 const data=inflateSync(Buffer.concat(chunks),{maxOutputLength:32768}),stride=width*channels,pixels=[];let previous=Buffer.alloc(stride),offset=0;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const filter=data[offset++],row=Buffer.from(data.subarray(offset,offset+stride));offset+=stride;assert.ok(filter<=4);
  for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;row[x]=(row[x]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}
  for(let x=0;x<stride;x+=channels)pixels.push([...row.subarray(x,x+3)]);previous=row;
 }
 return pixels;
}
