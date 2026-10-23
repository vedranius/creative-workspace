import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import path from 'node:path';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createWorkspaceServer} from '../src/server.js';
import {originalUiPatches} from '../src/original-ui.js';

const runRoot=path.resolve(process.env.CW_PAR03_WORK_ROOT||'build/host-tmp/par03-text-selection-20261023');
await mkdir(runRoot,{recursive:true});
const packages=path.resolve(process.env.CW_ORIGINAL_UI_DIR||path.join(runRoot,'packages-final'));
const binary=path.resolve(process.env.CW_DESIGNCRAFT_BINARY||path.join(runRoot,'worker/cw-designcraft-engine'));
// Delay only the Node test observer, never the application's network response.
const ackObserverDelayMs=Number(process.env.CW_PAR03_ACK_OBSERVER_DELAY_MS||0);
assert.ok(Number.isInteger(ackObserverDelayMs)&&ackObserverDelayMs>=0&&ackObserverDelayMs<=1000);
const playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;
if(!playwrightPath)throw new Error('Set CW_PLAYWRIGHT_MODULE');
const {chromium}=await import(playwrightPath.startsWith('file:')?playwrightPath:pathToFileURL(path.resolve(playwrightPath)).href);
const scratch=await mkdtemp(path.join(runRoot,'browser-runtime-'));
const workspaces=path.join(scratch,'workspaces');await mkdir(workspaces,{recursive:true});
const server=await createWorkspaceServer({dataDir:path.join(scratch,'data'),allowedRoots:[workspaces],originalUiRoot:packages,designcraftOptions:{binary,stateDir:path.join(scratch,'sessions')}});
const handlers=server.listeners('request');server.removeAllListeners('request');
const shareId='pages-select-browser-fixture';
server.on('request',async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/storage/folders.js'){
    res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
    res.end(`export function chooseLocalFolder(options){options.onReady({id:${JSON.stringify(shareId)}});return Promise.resolve();}`);return;
  }
  if(req.method==='POST'&&url.pathname==='/api/designcraft/sessions'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const payload=JSON.parse(Buffer.concat(chunks).toString());delete payload.sourceShareId;
    const fixture=Readable.from([JSON.stringify(payload)]);fixture.method=req.method;fixture.url=req.url;fixture.headers=req.headers;
    for(const listener of handlers)listener.call(server,fixture,res);return;
  }
  for(const listener of handlers)listener.call(server,req,res);
});

let browser,sessionId,page,diagnostic;
try{
  server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.CW_BROWSER_EXECUTABLE?{executablePath:process.env.CW_BROWSER_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[],failedResponses=[],requests=[],acks=[],requestFailures=[];
  const ackEvents=new EventEmitter();
  const waitedForObserverRevisions=[];
  diagnostic=()=>({errors,failedResponses,requestFailures,requests:requests.map(({method,params})=>({method,params})),acks:acks.map(({result,stateVersion,error})=>({result,stateVersion,error}))});
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{const match=request.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(match){sessionId=match[1];requests.push(request.postDataJSON());}});
  page.on('requestfailed',request=>requestFailures.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('response',async response=>{
    if(response.status()>=400)failedResponses.push({status:response.status(),url:response.url(),body:(await response.text()).slice(0,400)});
    if(response.url().endsWith('/rpc')){
      const ack=await response.json();
      if(ack.stateVersion===9&&ackObserverDelayMs)await new Promise(resolve=>setTimeout(resolve,ackObserverDelayMs));
      acks.push(ack);ackEvents.emit('ack',ack);
    }
  });
  await page.goto(`${base}/original/designcraft/?webgl`,{waitUntil:'domcontentloaded'});
  const canvas=page.locator('#designcraft_canvas');
  try{await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-preset-a4'),null,{timeout:45000});}
  catch(error){
    const diagnostic={status:'browser-startup-failed',error:error.message,url:page.url(),title:await page.title(),body:(await page.locator('body').innerText()).slice(0,1200),canvas:await page.locator('#designcraft_canvas').count(),canvasAttributes:await canvas.evaluate(el=>Object.fromEntries([...el.attributes].map(a=>[a.name,a.value]))).catch(()=>null),errors,failedResponses,requestFailures};
    const screenshotPath=process.env.CW_PAR03_SELECTION_SCREENSHOT;if(screenshotPath)await page.screenshot({path:path.resolve(screenshotPath)}).catch(()=>{});
    console.log(JSON.stringify(diagnostic));throw error;
  }
  const preset=JSON.parse(await canvas.getAttribute('data-original-preset-a4'));
  const revision=async n=>page.waitForFunction(n=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')===String(n),n,{timeout:30000});
  const acknowledged=async n=>{
    await revision(n);
    const existing=acks.find(ack=>ack.stateVersion===n);if(existing)return existing;
    waitedForObserverRevisions.push(n);
    return new Promise((resolve,reject)=>{
      const received=ack=>{if(ack.stateVersion!==n)return;clearTimeout(timer);ackEvents.off('ack',received);resolve(ack);};
      const timer=setTimeout(()=>{ackEvents.off('ack',received);reject(new Error(`Test observer did not receive ACK revision ${n}`));},30000);
      ackEvents.on('ack',received);
    });
  };
  const ids=async()=>JSON.parse(await canvas.getAttribute('data-server-page-ids'));
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  const render=async(ack,raw=false)=>{const response=await fetch(`${base}${ack.preview}`,{headers:{Origin:base}});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');const bytes=Buffer.from(await response.arrayBuffer());return raw?bytes:digest(bytes);};
  await page.mouse.click(...preset);await revision(1);
  // Two actual original Properties > Quick Actions > Insert Page clicks.
  await page.mouse.click(1365,615);await revision(2);assert.equal(requests.at(-1)?.method,'layout.pages.insert');
  await page.mouse.click(1365,615);const inserted=await acknowledged(3);assert.equal(requests.at(-1)?.method,'layout.pages.insert');assert.equal(inserted.document.pageCount,3);
  assert.deepEqual(inserted.document.spreads.map(sp=>sp.pages.length),[1,2]);
  await page.keyboard.press('t');await page.mouse.move(700,500);await page.mouse.down();await page.mouse.move(830,560,{steps:5});await page.mouse.up();await revision(4);
  await page.mouse.click(750,530);await revision(5);await page.keyboard.type('M');const first=await acknowledged(6);
  const firstIds=await ids(),firstRender=await render(first);assert.equal(firstIds.length,3);
  await page.mouse.click(...JSON.parse(await canvas.getAttribute('data-original-pages-tab')));
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#designcraft_canvas')?.getAttribute('data-original-page-thumbnails')||'[]').length===3);
  const clickPage=async index=>{const rects=JSON.parse(await canvas.getAttribute('data-original-page-thumbnails'));await page.mouse.click(...rects.find(r=>r.index===index).center);};
  await clickPage(1);const leftBefore=await acknowledged(7),leftRender=await render(leftBefore);assert.equal(leftBefore.page,1);
  await clickPage(2);const rightBefore=await acknowledged(8),rightRender=await render(rightBefore);assert.equal(rightBefore.page,2);
  assert.deepEqual(rightBefore.documentSnapshot,first.documentSnapshot);assert.deepEqual(await ids(),firstIds);
  const rightPage=rightBefore.document.spreads[1].pages.find(p=>p.index===2),leftPage=rightBefore.document.spreads[1].pages.find(p=>p.index===1);
  assert.ok(rightPage.bounds[0]>0);assert.equal(leftPage.bounds[0],0);assert.equal(rightPage.bounds[0],leftPage.bounds[2]);
  let releaseFrame,enteredFrame;const held=new Promise(resolve=>{releaseFrame=resolve;}),started=new Promise(resolve=>{enteredFrame=resolve;});
  await page.route('**/api/designcraft/sessions/*/rpc',async route=>{if(route.request().postDataJSON().method!=='frame.create'){await route.continue();return;}const response=await route.fetch();enteredFrame();await held;await route.fulfill({response});});
  try{
    await page.mouse.move(500,350);await page.mouse.down();await page.mouse.move(630,410,{steps:5});await page.mouse.up();
    let timer;try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Right facing-page drag did not issue frame.create')),10000);})]);}finally{clearTimeout(timer);}
    assert.equal(await canvas.getAttribute('data-server-revision'),'8');assert.equal(await canvas.getAttribute('data-server-page'),'2');assert.equal(await canvas.getAttribute('data-server-pending'),'true');assert.deepEqual(await ids(),firstIds);
  }finally{releaseFrame();}
  const frame=await acknowledged(9),frameRequest=requests.at(-1);await page.unroute('**/api/designcraft/sessions/*/rpc');
  assert.equal(frameRequest.method,'frame.create');assert.deepEqual(frameRequest.params.spread,{index:1,kind:'doc'});assert.equal(frame.page,2);
  assert.deepEqual(frame.documentSnapshot.spreads[0],first.documentSnapshot.spreads[0]);assert.equal(frame.documentSnapshot.spreads[1].items.length,1);
  const frameId=frame.result.id,storyId=frame.result.story,bounds=frame.document.spreads[1].items.find(i=>i.id===frameId).bounds;
  assert.ok(frameRequest.params.rect[0]>0&&frameRequest.params.rect[0]<rightPage.bounds[2]-rightPage.bounds[0]);
  for(const i of [0,2])assert.ok(Math.abs(bounds[i]-(frameRequest.params.rect[i]+rightPage.bounds[0]))<1e-8,'Canonical frame x must add selected page x once');
  for(const i of [1,3])assert.ok(Math.abs(bounds[i]-frameRequest.params.rect[i])<1e-8);
  await page.mouse.click(550,380);const caret=await acknowledged(10),caretRequest=requests.at(-1);
  assert.equal(caretRequest.method,'text.placeCaret');assert.equal(caret.document.selection.text.frame,frameId);assert.ok(caretRequest.params.point[0]>rightPage.bounds[0]);assert.ok(caretRequest.params.point[0]>=bounds[0]&&caretRequest.params.point[0]<=bounds[2]);
  assert.equal(caret.caret?.page,2);assert.equal(caret.caret?.frame,frameId);assert.equal(caret.caret?.story,storyId);
  const caretScreen = async()=>JSON.parse(await canvas.getAttribute('data-server-caret-screen'));
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#designcraft_canvas')?.getAttribute('data-server-caret-screen')||'null')!==null);
  const beforeScreen=await caretScreen();
  let releaseType,enteredType;const typeHeld=new Promise(resolve=>{releaseType=resolve;}),typeStarted=new Promise(resolve=>{enteredType=resolve;});
  await page.route('**/api/designcraft/sessions/*/rpc',async route=>{if(route.request().postDataJSON().method!=='text.insert'){await route.continue();return;}const response=await route.fetch();enteredType();await typeHeld;await route.fulfill({response});});
  try {
    await page.keyboard.type('R');
    let timer;try{await Promise.race([typeStarted,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Typing did not issue text.insert')),10000);})]);}finally{clearTimeout(timer);}
    assert.equal(await canvas.getAttribute('data-server-revision'),'10');assert.equal(await canvas.getAttribute('data-server-pending'),'true');assert.deepEqual(await caretScreen(),beforeScreen);
  }finally{releaseType();}
  const typed=await acknowledged(11);await page.unroute('**/api/designcraft/sessions/*/rpc');assert.equal(typed.result.commandId,'text.insert');assert.equal(typed.document.stories.find(s=>s.id===storyId).text,'R');assert.deepEqual(typed.documentSnapshot.spreads[0],first.documentSnapshot.spreads[0]);
  const typedRender=await render(typed);assert.notEqual(typedRender,rightRender);
  assert.equal(typed.caret?.page,2);assert.equal(typed.caret?.story,storyId);
  await page.waitForFunction(before=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-caret-screen')!==before,JSON.stringify(beforeScreen));
  const screenPoints=await caretScreen();assert.ok(screenPoints[0][0]>beforeScreen[0][0]);
  const clip={x:Math.floor(beforeScreen[0][0]),y:Math.floor(beforeScreen[0][1])+2,width:Math.max(1,Math.floor(screenPoints[0][0]-beforeScreen[0][0])),height:Math.max(1,Math.floor(screenPoints[1][1]-screenPoints[0][1])-4)};
  const cropStats=async()=>{const shot=await page.screenshot({clip}),pixels=decodePng(shot);return {dark:pixels.filter(p=>p.every(c=>c<80)).length,light:pixels.filter(p=>p.every(c=>c>128)).length,pixels:pixels.length,sha256:digest(shot)};};
  const beforePixels=await cropStats();
  let releaseSelection,enteredSelection;
  const selectionHeld=new Promise(resolve=>releaseSelection=resolve),selectionStarted=new Promise(resolve=>enteredSelection=resolve);
  await page.route('**/api/designcraft/sessions/*/rpc',async route=>{if(route.request().postDataJSON().method!=='edit.selectAll'){await route.continue();return;}const response=await route.fetch();enteredSelection();await selectionHeld;await route.fulfill({response});});
  try{
    await page.keyboard.press('Control+a');
    let timer;try{await Promise.race([selectionStarted,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Original Ctrl+A did not issue edit.selectAll')),10000);})]);}finally{clearTimeout(timer);}
    assert.equal(await canvas.getAttribute('data-server-revision'),'11');assert.equal(await canvas.getAttribute('data-server-pending'),'true');assert.deepEqual(await caretScreen(),screenPoints);assert.equal(await render(typed),typedRender);
  }finally{releaseSelection();}
  const selected=await acknowledged(12);await page.unroute('**/api/designcraft/sessions/*/rpc');
  assert.equal(requests.at(-1).method,'edit.selectAll');assert.equal(selected.caret,null);
  assert.deepEqual(selected.documentSnapshot,typed.documentSnapshot,'Selection is transient, never document content');
  const geometry=selected.textSelection;assert.equal(geometry.page,2);assert.equal(geometry.story,storyId);assert.deepEqual(geometry.frames,[frameId]);assert.equal(geometry.anchor,0);assert.equal(geometry.focus,1);assert.equal(geometry.quadCount,1);assert.equal(geometry.glyphCount,1);assert.ok(geometry.bounds[0]<300,'Native crop must subtract facing page offset exactly once');
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-caret-screen')==='null');
  const selectedRender=await render(selected);assert.notEqual(selectedRender,typedRender);
  // The received native PNG is painted by the unchanged original UI. A real screenshot
  // crop distinguishes its black rectangle and inverted white glyph from plain text.
  await page.waitForTimeout(250);const selectedPixels=await cropStats();
  assert.ok(selectedPixels.dark>beforePixels.dark+20,'Server selection rectangle must be visibly black');assert.ok(selectedPixels.light>5,'Antialiased inverted glyph must contrast with black background');
  const nativeCrop={x:geometry.bounds[0],y:geometry.bounds[1],width:geometry.bounds[2]-geometry.bounds[0],height:geometry.bounds[3]-geometry.bounds[1]};
  const plainNative=decodePng(await render(typed,true),nativeCrop),selectedNative=decodePng(await render(selected,true),nativeCrop);
  const invertedNativePixels=plainNative.filter((p,i)=>p.every(c=>c<128)&&selectedNative[i].every(c=>c>128)).length;assert.ok(invertedNativePixels>4,'Original black native glyph pixels must turn light in selected PNG');
  const visibleShot=await page.screenshot();
  await clickPage(1);const sibling=await acknowledged(13);assert.equal(sibling.textSelection,null);assert.equal(await render(sibling),leftRender);assert.deepEqual(sibling.documentSnapshot,typed.documentSnapshot);
  await clickPage(2);const restored=await acknowledged(14);assert.deepEqual(restored.textSelection,geometry);assert.equal(await render(restored),selectedRender);
  await page.mouse.click(550,380);const collapsed=await acknowledged(15);assert.equal(collapsed.textSelection,null);assert.ok(collapsed.caret);assert.equal(await render(collapsed),typedRender,'Collapsing selection restores exact original printing PNG');assert.deepEqual(collapsed.documentSnapshot,typed.documentSnapshot);
  assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);assert.deepEqual(requestFailures,[]);
  if(process.env.CW_PAR03_SELECTION_SCREENSHOT)await writeFile(path.resolve(process.env.CW_PAR03_SELECTION_SCREENSHOT),visibleShot);
  const report={status:'original-native-text-range-inverse-highlight-ack-proof',browser:'Chromium',sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',sourcePatchSha256:originalUiPatches.designcraft.sha256,workerSha256:await fileDigest(binary),uiPackage:await readdirPackage(packages),setup:{originalA4:true,originalInsertPageClicks:2,pageCount:3,pagesPerSpread:[1,2],selectedPage:2,rightPage,leftPage,firstPageText:'M'},frame:{frameId,storyId,canonicalBounds:bounds},selection:{actualOriginalCtrlA:true,commandId:'edit.selectAll',heldAckPreservesPreviousRevisionAndCaret:true,ackRevision:12,geometry,clip,beforePixels,selectedPixels,nativeCrop,invertedNativePixels,serverPngSha256:selectedRender,plainPngSha256:typedRender,canonicalDocumentUnchanged:true,printingPngRestoredExactlyOnCollapse:true,collapseRevision:15},siblings:{leftPageRenderSha256:leftRender,leftPagePngUnchanged:true,selectedPageRestoredAtRevision:14},permission:'synthetic connected-folder chooser fixture; not real OS permission evidence',acceptance:'bounded original non-cell text range; table cells/full tools/providers/OS remain open',browserErrors:errors,failedResponses,requestFailures};
  if(process.env.CW_PAR03_SELECTION_REPORT)await writeFile(path.resolve(process.env.CW_PAR03_SELECTION_REPORT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){
  console.log(JSON.stringify({status:'facing-page-text-browser-failed',error:error.message,...diagnostic?.()}));
  if(page&&process.env.CW_PAR03_SELECTION_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_SELECTION_SCREENSHOT)}).catch(()=>{});
  throw error;
}finally{
  if(sessionId&&server.listening){const base=`http://127.0.0.1:${server.address().port}`;await fetch(`${base}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});}
  await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
}

async function readdirPackage(root){
  const {readdir,readFile}=await import('node:fs/promises');
  for(const entry of await readdir(path.join(root,'designcraft'))){
    const manifest=JSON.parse(await readFile(path.join(root,'designcraft',entry,'creative-workspace-ui.json'),'utf8'));
    if(manifest.sourcePatch?.sha256===originalUiPatches.designcraft.sha256)return entry;
  }
  throw new Error('Registered DesignCraft package is missing');
}

async function fileDigest(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}

// Decode bounded 8-bit RGB/RGBA screenshot crops or selected native PNG regions.
function decodePng(png,crop){
 assert.equal(png.readUInt32BE(0),0x89504e47);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20),channels=png[25]===2?3:png[25]===6?4:0;
 assert.equal(png[24],8);assert.ok(channels&&width<=1280&&height<=1280&&(crop||width*height<4096));
 const chunks=[];for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=length+12;}
 const data=inflateSync(Buffer.concat(chunks),{maxOutputLength:1280*1280*4+1280}),stride=width*channels,pixels=[];let previous=Buffer.alloc(stride),offset=0;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const filter=data[offset++],row=Buffer.from(data.subarray(offset,offset+stride));offset+=stride;assert.ok(filter<=4);
  for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;row[x]=(row[x]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}
  for(let x=0;x<stride;x+=channels){const px=x/channels;if(!crop||(y>=crop.y&&y<crop.y+crop.height&&px>=crop.x&&px<crop.x+crop.width))pixels.push([...row.subarray(x,x+3)]);}previous=row;
 }
 return pixels;
}
