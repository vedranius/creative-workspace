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

const runRoot=path.resolve(process.env.CW_PAR03_WORK_ROOT||'build/host-tmp/par03-caret-20261023');
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
    const screenshotPath=process.env.CW_PAR03_CARET_SCREENSHOT;if(screenshotPath)await page.screenshot({path:path.resolve(screenshotPath)}).catch(()=>{});
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
  const render=async ack=>{const response=await fetch(`${base}${ack.preview}`,{headers:{Origin:base}});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');return digest(Buffer.from(await response.arrayBuffer()));};
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
  const top=Math.floor(Math.min(screenPoints[0][1],screenPoints[1][1]))+2,bottom=Math.ceil(Math.max(screenPoints[0][1],screenPoints[1][1]))-2;
  const clip={x:Math.floor(screenPoints[0][0])-2,y:top,width:5,height:Math.max(1,bottom-top)};
  const samples=[];let visibleShot,maxDark=-1;
  for(let i=0;i<10;i++){
    const shot=await page.screenshot({clip}),pixels=decodePng(shot),dark=pixels.filter(p=>p[0]<180&&p[1]<180&&p[2]<180).length;
    samples.push({dark,sha256:digest(shot)});if(dark>maxDark){maxDark=dark;visibleShot=await page.screenshot();}
    if(Math.max(...samples.map(s=>s.dark))-Math.min(...samples.map(s=>s.dark))>=clip.height/2)break;
    await page.waitForTimeout(200);
  }
  assert.ok(samples.some(s=>s.dark>=clip.height/2),'Native caret must paint a visible black segment');
  assert.ok(Math.max(...samples.map(s=>s.dark))-Math.min(...samples.map(s=>s.dark))>=clip.height/2,'Original caret pixels must blink independently of static glyphs');
  assert.equal(await render(typed),typedRender,'Caret blink must not mutate server PNG');
  const blinkProof={screenPoints,clip,samples,serverPngUnchanged:true,previousGeometryHeldUntilAck:true};
  await clickPage(1);const leftAfter=await acknowledged(12),leftAfterRender=await render(leftAfter);assert.equal(leftAfterRender,leftRender,'Sibling left-page PNG must be byte-identical');assert.deepEqual(leftAfter.documentSnapshot,typed.documentSnapshot);assert.equal(leftAfter.caret,null);assert.equal(await caretScreen(),null);
  await clickPage(0);const firstAfter=await acknowledged(13);assert.equal(await render(firstAfter),firstRender,'First spread PNG must be byte-identical');assert.deepEqual(firstAfter.documentSnapshot.spreads[0],first.documentSnapshot.spreads[0]);
  await clickPage(2);const rightAfter=await acknowledged(14);assert.equal(await render(rightAfter),typedRender);assert.deepEqual(rightAfter.documentSnapshot,typed.documentSnapshot);assert.deepEqual(await ids(),firstIds);assert.deepEqual(rightAfter.caret,typed.caret);
  assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);assert.deepEqual(requestFailures,[]);
  if(process.env.CW_PAR03_CARET_SCREENSHOT)await writeFile(path.resolve(process.env.CW_PAR03_CARET_SCREENSHOT),visibleShot);
  const report={status:'original-native-caret-ack-and-visible-blink-proof',browser:'Chromium',sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',sourcePatchSha256:originalUiPatches.designcraft.sha256,workerSha256:await fileDigest(binary),uiPackage:await readdirPackage(packages),setup:{originalA4:true,originalInsertPageClicks:2,pageCount:3,pagesPerSpread:[1,2],selectedPage:2,rightPage,leftPage,firstPageText:'M'},frame:{request:frameRequest,ackRevision:9,frameId,storyId,canonicalBounds:bounds,pageXAddedExactlyOnce:true,mirrorUnchangedBeforeAck:true},caret:{geometryAckRevision:11,geometry:typed.caret,blinkProof,request:caretRequest,ackRevision:10,spreadLocalPoint:true,actualOriginalClick:true},typing:{text:'R',ackRevision:11,storyId,serverRenderSha256:typedRender,serverRenderChanged:true},siblings:{leftPageRenderSha256:leftRender,leftPagePngUnchanged:true,firstPageRenderSha256:firstRender,firstPagePngUnchanged:true,firstSpreadCanonicalUnchanged:true,selectedPageRestoredAtRevision:14},ackObserverDelayMs,waitedForObserverRevisions,permission:'synthetic connected-folder chooser fixture; not real OS permission evidence',acceptance:'bounded original right facing-page Text Tool only; bounded non-cell caret verified; ranges/cells/full tools/providers/OS remain open',browserErrors:errors,failedResponses,requestFailures};
  if(process.env.CW_PAR03_CARET_REPORT)await writeFile(path.resolve(process.env.CW_PAR03_CARET_REPORT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){
  console.log(JSON.stringify({status:'facing-page-text-browser-failed',error:error.message,...diagnostic?.()}));
  if(page&&process.env.CW_PAR03_CARET_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_CARET_SCREENSHOT)}).catch(()=>{});
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
