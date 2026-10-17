// Isolated, unregistered pinned-source candidate proof; this never replaces a live studio.
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {createWorkspaceServer} from '../src/server.js';
const assets=await realpath(process.env.CW_DESIGNCRAFT_UI_ASSETS||'build/par03-host-assets');
const binary=process.env.CW_DESIGNCRAFT_BINARY, playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;
if(!binary||!playwrightPath)throw new Error('Set CW_DESIGNCRAFT_BINARY and CW_PLAYWRIGHT_MODULE');
const {chromium}=await import(playwrightPath.startsWith('file:')?playwrightPath:pathToFileURL(path.resolve(playwrightPath)).href);
const scratch=await mkdtemp(path.join(os.tmpdir(),'cw-par03-save-copy-ack-'));
const reportPath=process.env.CW_DESIGNCRAFT_ACK_FAILURE_REPORT;
const screenshotPath=process.env.CW_DESIGNCRAFT_ACK_FAILURE_SCREENSHOT;
const recoveryScreenshotPath=process.env.CW_DESIGNCRAFT_ACK_FAILURE_RECOVERY_SCREENSHOT;
for(const output of [reportPath,screenshotPath,recoveryScreenshotPath].filter(Boolean))await mkdir(path.dirname(path.resolve(output)),{recursive:true});
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
let browser,sessionId,fixtureId,shareIds=[];
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
 const originalHash=createHash('sha256').update(fixture).digest('hex');
 await post(`/api/designcraft/sessions/${fixtureId}`,'DELETE',{});fixtureId=null;rpcReceipts.length=0;
 browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.CW_BROWSER_EXECUTABLE,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(({payload})=>{
  const files=new Map([['chosen.designcraft',Uint8Array.from(atob(payload),c=>c.charCodeAt(0))],['unrelated.bin',new Uint8Array(1024)]]);window.__cwFiles=files;
  const dir=(name='Generated laptop publications',prefix='')=>({kind:'directory',name,async *entries(){const seen=new Set();for(const key of files.keys()){const rest=key.slice(prefix?prefix.length+1:0);if(!rest)continue;const part=rest.split('/')[0];if(seen.has(part))continue;seen.add(part);yield [part,rest.includes('/')?dir(part,[prefix,part].filter(Boolean).join('/')):fileHandle(part,[prefix,part].filter(Boolean).join('/'))];}},async getDirectoryHandle(n){const next=[prefix,n].filter(Boolean).join('/');if(![...files.keys()].some(k=>k.startsWith(next+'/')))throw new DOMException('Missing folder','NotFoundError');return dir(n,next);},async getFileHandle(n,{create=false}={}){const key=[prefix,n].filter(Boolean).join('/');if(!files.has(key)&&!create)throw new DOMException('Missing file','NotFoundError');if(create&&!files.has(key))files.set(key,new Uint8Array());return fileHandle(n,key);},async removeEntry(n){files.delete([prefix,n].filter(Boolean).join('/'));}});
  const fileHandle=(name,key)=>({kind:'file',name,async getFile(){const bytes=files.get(key);if(!bytes)throw new DOMException('Missing file','NotFoundError');return new File([bytes],name,{lastModified:Date.now()});},async createWritable({keepExistingData=false}={}){let bytes=keepExistingData?(files.get(key)||new Uint8Array()).slice():new Uint8Array();return {async write(command){const at=command.position||0,data=command.data instanceof Blob?new Uint8Array(await command.data.arrayBuffer()):new Uint8Array(command.data);if(at+data.length>bytes.length){const grown=new Uint8Array(at+data.length);grown.set(bytes);bytes=grown;}bytes.set(data,at);},async close(){if(key==='laptop-copy.designcraft')throw new Error('Injected browser destination close failure');files.set(key,bytes);}};}});
  window.showDirectoryPicker=async()=>dir();
 },{payload:fixture.toString('base64')});
 const page=await context.newPage(),errors=[],requests=[],acks=rpcReceipts,copies=transferReceipts;
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{const match=request.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/(?:rpc|input)/);if(match)sessionId=match[1];if(request.url().endsWith('/rpc'))requests.push(request.postDataJSON());});page.on('response',async response=>{if(response.url().endsWith('/api/storage/shares')&&response.request().method()==='POST'&&response.status()===201)try{shareIds.push((await response.json()).id);}catch{}});
 const load=async()=>{await page.goto(base+'/candidate/?webgl',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Choose laptop folder…'}).click();await page.getByRole('button',{name:'Start this mode'}).click();await page.waitForFunction(()=>!document.querySelector('#designcraft_loading')&&document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-open'),null,{timeout:120000});};
 const choose=async()=>{const center=JSON.parse(await page.locator('#designcraft_canvas').getAttribute('data-original-open'));await page.mouse.click(...center);await page.getByRole('dialog',{name:'Open a DesignCraft publication'}).waitFor();};
 await load();
 await choose();await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-pending')==='false');
 assert.equal(requests.length,0);assert.equal(copies.length,0);
 // Changing workspace settings cannot redirect a source already bound to its selected share.
 const changedRoot=path.join(scratch,'projects/changed');await mkdir(changedRoot);
 await post('/api/apps/designcraft/workspace','PUT',{root:changedRoot});
 await choose();await page.getByRole('button',{name:'◇ chosen.designcraft'}).click();
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='1',null,{timeout:120000});
 assert.equal(requests.length,1);assert.equal(requests[0].method,'file.open');assert.equal(requests[0].expectedVersion,0);
 assert.equal(requests[0].params.path,'chosen.designcraft');
 assert.equal(acks[0].result.commandId,'file.open');assert.equal(acks[0].document.dirty,false);assert.equal(acks[0].document.name,'chosen.designcraft');
 assert.equal(copies.length,0);
 const openedSnapshot=JSON.stringify(acks[0].documentSnapshot),openedPng=Buffer.from(await (await fetch(base+acks[0].preview)).arrayBuffer()),openedPngHash=createHash('sha256').update(openedPng).digest('hex');
 const serverCopy=path.join(scratch,'projects/designcraft',requests[0].params.path);
 assert.equal(createHash('sha256').update(fixture).digest('hex'),originalHash);
 await page.keyboard.press('m');await page.mouse.move(610,385);await page.mouse.down();await page.mouse.move(755,500,{steps:4});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='2');
 assert.equal(requests[1].method,'frame.create');assert.equal(requests[1].expectedVersion,1);assert.equal(acks[1].document.dirty,true);
 await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='3');
 assert.equal(requests[2].method,'edit.undo');assert.equal(JSON.stringify(acks[2].documentSnapshot),openedSnapshot);
 assert.equal(createHash('sha256').update(Buffer.from(await (await fetch(base+acks[2].preview)).arrayBuffer())).digest('hex'),openedPngHash);
 assert.equal(await page.evaluate(()=>Array.from(window.__cwFiles.get('chosen.designcraft'))).then(bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex')),originalHash);
 await assert.rejects(readFile(serverCopy),error=>error.code==='ENOENT');
 // Use the original File menu shortcut and confirmation dialog to exercise file.saveACopy.
 await page.keyboard.press('m');await page.mouse.move(610,385);await page.mouse.down();await page.mouse.move(755,500,{steps:4});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='4');
 await page.keyboard.press('Control+Alt+s');await page.waitForTimeout(250);if(process.env.CW_PAR03_SAVE_DIALOG)await page.screenshot({path:path.resolve(process.env.CW_PAR03_SAVE_DIALOG)});await page.mouse.click(512,511);await page.waitForTimeout(80);if(process.env.CW_PAR03_SAVE_DESTINATION_DIALOG)await page.screenshot({path:path.resolve(process.env.CW_PAR03_SAVE_DESTINATION_DIALOG)});await page.mouse.click(510,537);await page.mouse.click(1000,573);
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='5',null,{timeout:30000});
 assert.deepEqual(requests.slice(3).map(item=>item.method),['frame.create','file.saveACopy']);
 const saveRequest=requests[4],saveAck=acks[4];assert.equal(saveRequest.expectedVersion,4);assert.equal(saveRequest.params.destination,'server');assert.equal(saveRequest.params.retention,'workspace');
 assert.equal(saveAck.result.commandId,'file.saveACopy');assert.equal(saveAck.result.savedDocument,false);assert.equal(saveAck.document.dirty,true);assert.equal(saveAck.document.name,'chosen.designcraft');
 const retainedPath=saveRequest.params.path,retainedLocal=path.join(scratch,'projects/designcraft',retainedPath),retained=await readFile(retainedLocal);
 const retainedResponse=await fetch(`${base}/api/designcraft/sessions/${sessionId}/output?path=${encodeURIComponent(retainedPath)}`,{headers:{Origin:base}});assert.equal(retainedResponse.status,200);
 assert.deepEqual(Buffer.from(await retainedResponse.arrayBuffer()),retained);assert.ok(retained.length>0);assert.notEqual(createHash('sha256').update(retained).digest('hex'),originalHash);
 const laptopPath='laptop-copy.designcraft';
 await page.keyboard.press('Control+Alt+s');await page.waitForTimeout(500);await page.mouse.click(512,511);await page.waitForTimeout(400);
 await page.mouse.click(515,560);await page.waitForTimeout(400);if(process.env.CW_PAR03_LAPTOP_DESTINATION_DIALOG)await page.screenshot({path:path.resolve(process.env.CW_PAR03_LAPTOP_DESTINATION_DIALOG)});
 await page.mouse.click(610,486);await page.keyboard.press('Control+a');await page.keyboard.type(laptopPath);await page.mouse.click(1000,573);
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-pending')==='false',null,{timeout:30000});
 const laptopRequest=requests[5];assert.equal(laptopRequest.method,'file.saveACopy');assert.equal(laptopRequest.expectedVersion,5);assert.equal(laptopRequest.params.destination,'laptop');assert.equal(laptopRequest.params.retention,'workspace');
 const revisionAfterFailure=await page.locator('#designcraft_canvas').getAttribute('data-server-revision');assert.equal(revisionAfterFailure,'5');
 await page.getByRole('button',{name:'Check retained DesignCraft outputs'}).click();await page.getByRole('dialog',{name:'DesignCraft save recovery'}).waitFor();
 await page.getByText(laptopPath,{exact:true}).waitFor();const recoveryState=await page.locator('.cw-recovery-state').innerText();assert.match(recoveryState,/not confirmed|failed/i);if(recoveryScreenshotPath)await page.screenshot({path:path.resolve(recoveryScreenshotPath)});
 const recoveryHref=await page.getByRole('link',{name:'Download server copy'}).getAttribute('href');const recoveryResponse=await fetch(base+recoveryHref);assert.equal(recoveryResponse.status,200);const retainedAfterFailure=Buffer.from(await recoveryResponse.arrayBuffer());assert.ok(retainedAfterFailure.length>0);const retainedOnServer=await readFile(path.join(scratch,'data/local-folders/mirror',shareIds.at(-1),'Generated laptop publications',laptopPath));assert.deepEqual(retainedAfterFailure,retainedOnServer);
 const retry=await fetch(`${base}/api/designcraft/sessions/${sessionId}/rpc`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({method:'file.saveACopy',params:{path:laptopPath,destination:'laptop',retention:'workspace'},requestId:crypto.randomUUID()})});assert.equal(retry.status,409);
 const laptopBytes=await page.evaluate(path=>Array.from(window.__cwFiles.get(path)||[]),laptopPath);assert.equal(laptopBytes.length,0);
 const saveFailure={method:laptopRequest.method,expectedVersion:laptopRequest.expectedVersion,destination:laptopRequest.params.destination,previousAcknowledgedDocument:{name:acks[4].document.name,dirty:acks[4].document.dirty},ackAfterFailure:acks[5]??null,revisionAfterFailure,recoveryState,recoveryBytes:retainedAfterFailure.length,recoverySha256:createHash('sha256').update(retainedAfterFailure).digest('hex'),retryStatus:retry.status,localDestinationBytes:laptopBytes.length};
 await page.getByRole('button',{name:'Close save recovery'}).click().catch(()=>{});
 const painted=visibleCanvas(await page.screenshot(screenshotPath?{path:path.resolve(screenshotPath)}:{}));
 const report={status:'original-save-copy-ack-failure-recovery-browser-candidate',sourceCommands:['app.openDialog -> file.open','File → Save a Copy… -> file.saveACopy'],commonProviderFolderPicker:true,mode:'laptop-ondemand',providerRootBoundToSession:true,providerReadAcknowledgedBeforeNativeOpen:true,openRevision:1,openDirty:false,openedObjects:1,editRevision:2,undoRevision:3,undoRestoresOpenedSnapshotAndRender:true,saveCopyDestinations:['server','laptop'],saveCopyRetention:'workspace',laptopWriteAcknowledgedInBrowser:false,laptopOutputReopenedThroughProvider:false,recoveryAfterDestinationCloseFailure:true,retryCollisionRefused:true,saveCopyPreservesOriginalDirtyStateAndFilename:true,saveCopyDoesNotOverwriteExistingTargets:true,cancelCreatesNoOpen:true,visibleCanvas:painted,uncaughtBrowserErrors:errors,saveFailure,limitations:'File System Access folder handle is mocked; real browser permission and uncertain-output recovery, unsupported retention modes and full parity remain pending'};
 if(reportPath){await mkdir(path.dirname(path.resolve(reportPath)),{recursive:true});await writeFile(path.resolve(reportPath),JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report));
}finally{
 for(const id of [sessionId,fixtureId].filter(Boolean))await fetch(`http://127.0.0.1:${server.address().port}/api/designcraft/sessions/${id}`,{method:'DELETE',headers:{Origin:`http://127.0.0.1:${server.address().port}`,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});
 for(const id of shareIds)await fetch(`http://127.0.0.1:${server.address().port}/api/storage/shares/${id}`,{method:'DELETE',headers:{Origin:`http://127.0.0.1:${server.address().port}`,'Content-Type':'application/json'},body:'{}'}).catch(()=>{});
 await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
}
