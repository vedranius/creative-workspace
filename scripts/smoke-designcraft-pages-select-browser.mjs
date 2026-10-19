import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createWorkspaceServer} from '../src/server.js';
import {originalUiPatches} from '../src/original-ui.js';

const runRoot=path.resolve(process.env.CW_PAR03_WORK_ROOT||'build/host-tmp/par03-pages-select-20261019');
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
      if(ack.stateVersion===7&&ackObserverDelayMs)await new Promise(resolve=>setTimeout(resolve,ackObserverDelayMs));
      acks.push(ack);ackEvents.emit('ack',ack);
    }
  });
  await page.goto(`${base}/original/designcraft/?webgl`,{waitUntil:'domcontentloaded'});
  const canvas=page.locator('#designcraft_canvas');
  try{await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-preset-a4'),null,{timeout:45000});}
  catch(error){
    const diagnostic={status:'browser-startup-failed',error:error.message,url:page.url(),title:await page.title(),body:(await page.locator('body').innerText()).slice(0,1200),canvas:await page.locator('#designcraft_canvas').count(),canvasAttributes:await canvas.evaluate(el=>Object.fromEntries([...el.attributes].map(a=>[a.name,a.value]))).catch(()=>null),errors,failedResponses,requestFailures};
    const screenshotPath=process.env.CW_PAR03_PAGES_SELECT_SCREENSHOT;if(screenshotPath)await page.screenshot({path:path.resolve(screenshotPath)}).catch(()=>{});
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
  await page.mouse.click(1365,615);await revision(2);
  assert.equal(requests[1]?.method,'layout.pages.insert');
  // Original Text Tool content makes the server PNG distinguish the two pages.
  await page.keyboard.press('t');await page.mouse.move(700,500);await page.mouse.down();await page.mouse.move(830,560,{steps:5});await page.mouse.up();await revision(3);
  assert.equal(requests[2]?.method,'frame.create');
  await page.mouse.click(750,530);await revision(4);assert.equal(requests.at(-1)?.method,'text.placeCaret');
  await page.keyboard.type('M');await revision(5);assert.equal(requests.at(-1)?.method,'text.insert');
  const before=await acknowledged(5),beforeIds=await ids(),beforeItems=before.documentSnapshot.spreads.map(sp=>sp.items.map(item=>item.id)),beforeRender=await render(before);
  assert.equal(beforeIds.length,2);assert.equal(beforeItems[0].length,1);assert.equal(beforeItems[1].length,0);
  await page.mouse.click(...JSON.parse(await canvas.getAttribute('data-original-pages-tab')));
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#designcraft_canvas')?.getAttribute('data-original-page-thumbnails')||'[]').length===2);
  const thumbnails=JSON.parse(await canvas.getAttribute('data-original-page-thumbnails'));
  const selectedPage=async()=>Number(await canvas.getAttribute('data-server-page'));
  assert.equal(await selectedPage(),0);
  let release,entered;const held=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  await page.route('**/api/designcraft/sessions/*/rpc',async route=>{
    if(route.request().postDataJSON().method!=='page.select'){await route.continue();return;}
    const response=await route.fetch();entered();await held;await route.fulfill({response});
  });
  const click=async index=>{const rects=JSON.parse(await canvas.getAttribute('data-original-page-thumbnails'));await page.mouse.click(...rects.find(r=>r.index===index).center);};
  try{
    await click(1);let timer;
    try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Original thumbnail did not issue page.select')),10000);})]);}finally{clearTimeout(timer);}
    assert.equal(await canvas.getAttribute('data-server-pending'),'true');assert.equal(await canvas.getAttribute('data-server-revision'),'5');assert.equal(await selectedPage(),0);assert.deepEqual(await ids(),beforeIds);
  }finally{release();}
  await revision(6);await page.unroute('**/api/designcraft/sessions/*/rpc');
  const selected=await acknowledged(6),selectRequest=requests.at(-1);
  assert.equal(selectRequest.method,'page.select');assert.deepEqual(selectRequest.params,{index:1});assert.equal(selectRequest.expectedVersion,5);
  assert.equal(selected.result.commandId,'page.select');assert.equal(selected.page,1);assert.equal(await selectedPage(),1);
  assert.deepEqual(selected.documentSnapshot,before.documentSnapshot);assert.deepEqual(selected.document.selection,before.document.selection);assert.equal(selected.document.dirty,true);assert.deepEqual(await ids(),beforeIds);
  const selectedRender=await render(selected);assert.notEqual(selectedRender,beforeRender,'selecting the blank second page must change server pixels');
  if(process.env.CW_PAR03_PAGES_SELECT_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_PAGES_SELECT_SCREENSHOT)});
  await click(0);const restored=await acknowledged(7);
  assert.deepEqual(requests.at(-1).params,{index:0});assert.equal(await selectedPage(),0);assert.equal(restored.page,0);assert.equal(await render(restored),beforeRender);
  assert.deepEqual(restored.documentSnapshot,before.documentSnapshot);assert.equal(restored.document.dirty,true);
  assert.equal(await canvas.getAttribute('data-server-render'),'true');assert.equal(await canvas.getAttribute('data-server-pending'),'false');
  assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);assert.deepEqual(requestFailures,[]);
  const report={status:'original-pages-select-server-ack-browser-proof',browser:'Chromium',sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',sourcePatch:'par-03-pages-insert-v1',ackObserverDelayMs,waitedForObserverRevisions,observedAckRevisions:[before.stateVersion,selected.stateVersion,restored.stateVersion],workerSha256:await fileDigest(binary),uiPackage:await readdirPackage(packages),setup:{originalActions:['A4 preset','Properties > Page > Insert Page','Text Tool frame/caret/typing'],revision:5,pageCount:2,itemsPerPage:beforeItems.map(items=>items.length)},action:{originalAction:'Pages panel thumbnail click',gatewayMethod:selectRequest.method,params:selectRequest.params,ackCommandId:selected.result.commandId,revision:6,page:1,pageCount:2,dirty:true,pendingMirrorUnchanged:true,documentAndPageIdentitiesUnchanged:true,canonicalDocumentUnchanged:true,selectionUnchanged:true,serverPngChanged:true,beforeRenderSha256:beforeRender,selectedRenderSha256:selectedRender,returnSelection:{params:requests.at(-1).params,revision:7,page:0,pixelsRestored:true},thumbnailCenters:thumbnails},permission:'synthetic connected-folder chooser fixture; not real OS permission evidence',browserErrors:errors,failedResponses,requestFailures};
  if(process.env.CW_PAR03_PAGES_SELECT_REPORT)await writeFile(path.resolve(process.env.CW_PAR03_PAGES_SELECT_REPORT),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}catch(error){
  console.log(JSON.stringify({status:'pages-select-browser-failed',error:error.message,...diagnostic?.()}));
  if(page&&process.env.CW_PAR03_PAGES_SELECT_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_PAGES_SELECT_SCREENSHOT)}).catch(()=>{});
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
