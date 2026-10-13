// Isolated, unregistered pinned-source candidate proof; this never replaces a live studio.
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath,truncate} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {createWorkspaceServer} from '../src/server.js';
const assets=await realpath(process.env.CW_DESIGNCRAFT_UI_ASSETS||'build/par03-host-assets');
const binary=process.env.CW_DESIGNCRAFT_BINARY, playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;
if(!binary||!playwrightPath)throw new Error('Set CW_DESIGNCRAFT_BINARY and CW_PLAYWRIGHT_MODULE');
const {chromium}=await import(pathToFileURL(path.resolve(playwrightPath)).href);
const scratch=await mkdtemp(path.join(os.tmpdir(),'cw-host-canvas-'));
await mkdir(path.join(scratch,'projects'));
const server=await createWorkspaceServer({dataDir:path.join(scratch,'data'),allowedRoots:[path.join(scratch,'projects')],designcraftOptions:{binary,stateDir:path.join(scratch,'sessions')}});
const gateway=server.listeners('request');server.removeAllListeners('request');
const transferReceipts=[],rpcReceipts=[];
// Candidate assets use the same origin/headers as the gateway, only on a disposable loopback port.
server.on('request',async(req,res)=>{
 if(!req.url.startsWith('/candidate/')){
  // Observe actual gateway JSON on the wire; Chrome's large-WASM inspector cache can evict it.
  if(/\/api\/designcraft\/sessions\/[a-f0-9]{48}\/(rpc|input)/.test(req.url)){
   const end=res.end.bind(res);res.end=(data,...args)=>{
    if(data&&res.statusCode>=200&&res.statusCode<300){const value=JSON.parse(data.toString());(/\/input\?/.test(req.url)?transferReceipts:rpcReceipts).push(value);}
    return end(data,...args);
   };
  }
  for(const listener of gateway)listener.call(server,req,res);return;
 }
 try{
  assert.equal(req.method,'GET');
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice('/candidate/'.length)||'index.html';
  assert.ok(pathname.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.startsWith('.'))&&!pathname.includes('\\'));
  const file=await realpath(path.join(assets,pathname));assert.ok(file.startsWith(assets+path.sep));
  const bytes=await readFile(file),types={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'};
  // Trunk's inline bootstrap is hash-allowlisted, matching the production registry policy.
  const hashes=[];if(pathname.endsWith('.html'))for(const m of bytes.toString().matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(m[1]))hashes.push(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:`);
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  res.writeHead(200,{'Content-Type':types[path.extname(pathname)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
function visibleCanvas(png){
 assert.equal(png.readUInt32BE(0),0x89504e47);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20),channels=png[25]===2?3:png[25]===6?4:0;
 assert.equal(png[24],8);assert.ok(channels);
 const chunks=[];for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=length+12;}
 const data=inflateSync(Buffer.concat(chunks)),stride=width*channels;let previous=Buffer.alloc(stride),offset=0,brightPixels=0;const colors=new Set();
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const filter=data[offset++],row=Buffer.from(data.subarray(offset,offset+stride));offset+=stride;assert.ok(filter<=4);
  for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;row[x]=(row[x]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}
  for(let x=0;x<stride;x+=channels){if(row[x]>140&&row[x+1]>140&&row[x+2]>140)brightPixels++;if(colors.size<64)colors.add(`${row[x]},${row[x+1]},${row[x+2]}`);}
  previous=row;
 }
 assert.ok(brightPixels>100000&&colors.size>=32,`Original canvas was not visibly painted: ${brightPixels} bright pixels, ${colors.size} colors`);
 return {brightPixels,distinctColorsAtLeast:Math.min(colors.size,64)};
}
let browser,sessionId,fixtureId;
try{
 server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(route,method='POST',body={})=>{
  const response=await fetch(base+route,{method,headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)}),value=await response.json();
  if(!response.ok)throw Error(value.error||`HTTP ${response.status}`);return value;
 };
 const rpc=(id,method,params={})=>post(`/api/designcraft/sessions/${id}/rpc`,'POST',{method,params,requestId:crypto.randomUUID()});
 fixtureId=(await post('/api/designcraft/sessions')).id;
 await rpc(fixtureId,'file.new',{preset:'A4'});
 await rpc(fixtureId,'frame.create',{rect:[60,60,220,200],content:'unassigned',shape:'rectangle'});
 await rpc(fixtureId,'doc.save',{path:'native-fixture.designcraft'});
 const fixture=await readFile(path.join(scratch,'projects/designcraft/native-fixture.designcraft'));
 const laptop=path.join(scratch,'laptop');await mkdir(laptop);
 const chosen=path.join(laptop,'chosen.designcraft');await writeFile(chosen,fixture);
 const originalHash=createHash('sha256').update(fixture).digest('hex');
 await post(`/api/designcraft/sessions/${fixtureId}`,'DELETE',{});fixtureId=null;rpcReceipts.length=0;
 browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.CW_BROWSER_EXECUTABLE,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 // This smoke drives Playwright's native filechooser event. The product prefers
 // showOpenFilePicker where Chromium exposes it, so force its documented input
 // fallback here; real File System Access permission checks remain separate QA.
 await context.addInitScript(()=>{Object.defineProperty(window,'showOpenFilePicker',{configurable:true,value:undefined});});
 const page=await context.newPage(),errors=[],requests=[],acks=rpcReceipts,copies=transferReceipts;
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{const match=request.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/(?:rpc|input)/);if(match)sessionId=match[1];if(request.url().endsWith('/rpc'))requests.push(request.postDataJSON());});
 const load=async()=>{await page.goto(base+'/candidate/?webgl',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.querySelector('#designcraft_loading')&&document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-open'),null,{timeout:120000});};
 const choose=async()=>{const chooser=page.waitForEvent('filechooser');const center=JSON.parse(await page.locator('#designcraft_canvas').getAttribute('data-original-open'));await page.mouse.click(...center);return chooser;};
 await load();
 const cancelled=await choose();await cancelled.setFiles([]);
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-pending')==='false');
 assert.equal(requests.length,0);assert.equal(copies.length,0);
 // Updating the panel's global workspace must not redirect a live session's chosen-file copy.
 const changedRoot=path.join(scratch,'projects/changed');await mkdir(changedRoot);
 await post('/api/apps/designcraft/workspace','PUT',{root:changedRoot});
 const picker=await choose();await picker.setFiles(chosen);
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='1',null,{timeout:120000});
 assert.equal(requests.length,1);assert.equal(requests[0].method,'file.open');assert.equal(requests[0].expectedVersion,0);
 assert.match(requests[0].params.path,/^imports\/[a-f0-9-]+-chosen\.designcraft$/);
 assert.equal(acks[0].result.commandId,'file.open');assert.equal(acks[0].document.dirty,false);assert.equal(acks[0].document.name,'chosen.designcraft');
 assert.equal(copies.length,1);assert.equal(copies[0].mode,'copy-first');assert.equal(copies[0].sessionId,sessionId);assert.equal(copies[0].bytes,fixture.length);
 const serverCopy=path.join(scratch,'projects/designcraft',requests[0].params.path);
 assert.equal(createHash('sha256').update(await readFile(serverCopy)).digest('hex'),originalHash);
 assert.deepEqual(acks[0].documentSnapshot.spreads[0].items.length,1);
 const openedSnapshot=JSON.stringify(acks[0].documentSnapshot),openedPng=Buffer.from(await (await fetch(base+acks[0].preview)).arrayBuffer());
 const openedPngHash=createHash('sha256').update(openedPng).digest('hex');
 await page.keyboard.press('Control+o');await page.waitForTimeout(100);assert.equal(requests.length,1);assert.equal(copies.length,1);
 await page.keyboard.press('m');await page.mouse.move(610,385);await page.mouse.down();await page.mouse.move(755,500,{steps:4});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='2');
 assert.equal(requests[1].method,'frame.create');assert.equal(requests[1].expectedVersion,1);assert.equal(acks[1].document.dirty,true);
 await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='3');
 assert.equal(requests[2].method,'edit.undo');assert.equal(JSON.stringify(acks[2].documentSnapshot),openedSnapshot);
 assert.equal(createHash('sha256').update(Buffer.from(await (await fetch(base+acks[2].preview)).arrayBuffer())).digest('hex'),openedPngHash);
 assert.equal(createHash('sha256').update(await readFile(chosen)).digest('hex'),originalHash);
 assert.equal(createHash('sha256').update(await readFile(serverCopy)).digest('hex'),originalHash);
 // Use the original File menu shortcut and confirmation dialog to exercise file.saveACopy.
 await page.keyboard.press('m');await page.mouse.move(610,385);await page.mouse.down();await page.mouse.move(755,500,{steps:4});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='4');
 await page.keyboard.press('Control+Alt+s');await page.waitForTimeout(200);await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='5',null,{timeout:30000});
 assert.deepEqual(requests.slice(3).map(item=>item.method),['frame.create','file.saveACopy']);
 const saveRequest=requests[4],saveAck=acks[4];assert.equal(saveRequest.expectedVersion,4);assert.equal(saveRequest.params.destination,'server');assert.equal(saveRequest.params.retention,'workspace');
 assert.equal(saveAck.result.commandId,'file.saveACopy');assert.equal(saveAck.result.savedDocument,false);assert.equal(saveAck.document.dirty,true);assert.equal(saveAck.document.name,'chosen.designcraft');
 const retainedPath=saveRequest.params.path,retainedLocal=path.join(scratch,'projects/designcraft',retainedPath),retained=await readFile(retainedLocal);
 const retainedResponse=await fetch(`${base}/api/designcraft/sessions/${sessionId}/output?path=${encodeURIComponent(retainedPath)}`,{headers:{Origin:base}});assert.equal(retainedResponse.status,200);
 assert.deepEqual(Buffer.from(await retainedResponse.arrayBuffer()),retained);assert.ok(retained.length>0);assert.notEqual(createHash('sha256').update(retained).digest('hex'),originalHash);
 const collision=await fetch(`${base}/api/designcraft/sessions/${sessionId}/rpc`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({method:'file.saveACopy',params:{path:retainedPath,destination:'server',retention:'workspace'},requestId:crypto.randomUUID()})});assert.equal(collision.status,409);
 // Reopen the retained server copy through the same original browser chooser and server input ACK.
 const retainedForReopen=path.join(laptop,'retained-copy.designcraft');await writeFile(retainedForReopen,retained);
 await post(`/api/designcraft/sessions/${sessionId}`,'DELETE',{discard:true});sessionId=null;
 await load();const retainedChooser=await choose();await retainedChooser.setFiles(retainedForReopen);
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='1',null,{timeout:120000});
 assert.equal(requests[5].method,'file.open');assert.equal(acks[5].document.name,'retained-copy.designcraft');assert.equal(acks[5].document.dirty,false);
 assert.equal(acks[5].documentSnapshot.spreads[0].items.length,2);
 await post(`/api/designcraft/sessions/${sessionId}`,'DELETE',{discard:true});sessionId=null;
 await page.waitForTimeout(500);
 const screenshot=process.env.CW_PAR03_SCREENSHOT;const painted=visibleCanvas(await page.screenshot(screenshot?{path:path.resolve(screenshot)}:{}));
 // A failed transfer cannot produce file.open or a hydrated UI.
 await page.route('**/input?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Injected transfer failure'})}));
 await load();const previousRequests=requests.length;
 const failedPicker=await choose();await failedPicker.setFiles(chosen);
 await page.waitForResponse(response=>/\/input\?/.test(response.url())&&response.status()===503);
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-pending')==='false');
 assert.equal(requests.length,previousRequests);assert.equal(await page.locator('#designcraft_canvas').getAttribute('data-server-revision'),'0');
 const oversized=path.join(laptop,'oversized.designcraft');await writeFile(oversized,'');await truncate(oversized,64*1024*1024+1);
 let uploads=0;page.on('request',request=>{if(/\/input\?/.test(request.url()))uploads++;});
 const largePicker=await choose();await largePicker.setFiles(oversized);await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-pending')==='false');
 assert.equal(uploads,0);assert.equal(requests.length,previousRequests);assert.deepEqual(errors,[]);
 const report={status:'bounded-original-open-and-server-save-copy-proof',sourceCommands:['app.openDialog -> file.open','File → Save a Copy… -> file.saveACopy'],originalBrowserFileChooser:true,mode:'copy-first',copiedBytes:fixture.length,providerInputRootBoundToSession:true,copyAcknowledgedBeforeNativeOpen:true,openRevision:1,openDirty:false,openedObjects:1,editRevision:2,undoRevision:3,undoRestoresOpenedSnapshotAndRender:true,saveCopyDestination:'server',saveCopyRetention:'workspace',saveCopyAtomicWriteAcknowledgedBeforeSuccess:true,saveCopyPreservesOriginalDirtyStateAndFilename:true,saveCopyDoesNotOverwriteExistingTargets:true,retainedCopyReopenedThroughOriginalChooser:true,laptopOriginalAndServerImportUnchanged:true,cancelCreatesNoOpen:true,transferFailureLeavesMirrorUnhydrated:true,oversizedFileRejectedBeforeUpload:true,visibleCanvas:painted,uncaughtBrowserErrors:errors,limitations:'Native one-spread documents only; laptop output, other retention modes, recovery, folder permissions/on-demand/hybrid and full parity pending'};
 if(process.env.CW_PAR03_REPORT)await writeFile(path.resolve(process.env.CW_PAR03_REPORT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{
 for(const id of [sessionId,fixtureId].filter(Boolean))await fetch(`http://127.0.0.1:${server.address().port}/api/designcraft/sessions/${id}`,{method:'DELETE',headers:{Origin:`http://127.0.0.1:${server.address().port}`,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});
 await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
}
