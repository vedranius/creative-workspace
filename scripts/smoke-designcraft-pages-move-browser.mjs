import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {createWorkspaceServer} from '../src/server.js';

const runRoot=path.resolve(process.env.CW_PAR03_WORK_ROOT||'build/host-tmp/par03-pages-move-20261019');
await mkdir(runRoot,{recursive:true});
const packages=path.resolve(process.env.CW_ORIGINAL_UI_DIR||path.join(runRoot,'packages-final'));
const binary=path.resolve(process.env.CW_DESIGNCRAFT_BINARY||path.join(runRoot,'worker/cw-designcraft-engine'));
const playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;
if(!playwrightPath)throw new Error('Set CW_PLAYWRIGHT_MODULE');
const {chromium}=await import(playwrightPath.startsWith('file:')?playwrightPath:pathToFileURL(path.resolve(playwrightPath)).href);
const scratch=await mkdtemp(path.join(runRoot,'browser-runtime-'));
const workspaces=path.join(scratch,'workspaces');await mkdir(workspaces,{recursive:true});
const server=await createWorkspaceServer({dataDir:path.join(scratch,'data'),allowedRoots:[workspaces],originalUiRoot:packages,designcraftOptions:{binary,stateDir:path.join(scratch,'sessions')}});
const handlers=server.listeners('request');server.removeAllListeners('request');
const shareId='pages-move-browser-fixture';
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
  diagnostic=()=>({errors,failedResponses,requestFailures,requests:requests.map(({method,params})=>({method,params})),acks:acks.map(({result,stateVersion,error})=>({result,stateVersion,error}))});
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{const match=request.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(match){sessionId=match[1];requests.push(request.postDataJSON());}});
  page.on('requestfailed',request=>requestFailures.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('response',async response=>{if(response.status()>=400)failedResponses.push({status:response.status(),url:response.url(),body:(await response.text()).slice(0,400)});if(response.url().endsWith('/rpc'))acks.push(await response.json());});
  await page.goto(`${base}/original/designcraft/?webgl`,{waitUntil:'domcontentloaded'});
  const canvas=page.locator('#designcraft_canvas');
  try{await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-preset-a4'),null,{timeout:45000});}
  catch(error){
    const diagnostic={status:'browser-startup-failed',error:error.message,url:page.url(),title:await page.title(),body:(await page.locator('body').innerText()).slice(0,1200),canvas:await page.locator('#designcraft_canvas').count(),canvasAttributes:await canvas.evaluate(el=>Object.fromEntries([...el.attributes].map(a=>[a.name,a.value]))).catch(()=>null),errors,failedResponses,requestFailures};
    const screenshotPath=process.env.CW_PAR03_PAGES_MOVE_SCREENSHOT;if(screenshotPath)await page.screenshot({path:path.resolve(screenshotPath)}).catch(()=>{});
    console.log(JSON.stringify(diagnostic));throw error;
  }
  const preset=JSON.parse(await canvas.getAttribute('data-original-preset-a4'));
  const revision=async n=>page.waitForFunction(n=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')===String(n),n,{timeout:30000});
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
  const before=acks.at(-1),beforeIds=await ids(),beforeItems=before.documentSnapshot.spreads.map(sp=>sp.items.map(item=>item.id)),beforeRender=await render(before);
  assert.equal(beforeIds.length,2);assert.equal(beforeItems[0].length,1);assert.equal(beforeItems[1].length,0);
  await page.mouse.click(...JSON.parse(await canvas.getAttribute('data-original-pages-tab')));
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#designcraft_canvas')?.getAttribute('data-original-page-thumbnails')||'[]').length===2);
  const thumbnails=JSON.parse(await canvas.getAttribute('data-original-page-thumbnails'));
  let release,entered;const held=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  await page.route('**/api/designcraft/sessions/*/rpc',async route=>{
    if(route.request().postDataJSON().method!=='layout.pages.move'){await route.continue();return;}
    const response=await route.fetch();entered();await held;await route.fulfill({response});
  });
  const drag=async(from,to)=>{const rects=JSON.parse(await canvas.getAttribute('data-original-page-thumbnails')),a=rects.find(r=>r.index===from).center,b=rects.find(r=>r.index===to).center;await page.mouse.move(...a);await page.mouse.down();await page.mouse.move(a[0]+8,a[1]+8,{steps:3});await page.mouse.move(...b,{steps:12});await page.waitForTimeout(100);await page.mouse.up();};
  try{
    await drag(1,0);let timer;
    try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Original Pages drag did not issue layout.pages.move')),10000);})]);}finally{clearTimeout(timer);}
    assert.equal(await canvas.getAttribute('data-server-pending'),'true');assert.equal(await canvas.getAttribute('data-server-revision'),'5');assert.deepEqual(await ids(),beforeIds,'the original mirror cannot reorder before ACK');
  }finally{release();}
  await revision(6);await page.unroute('**/api/designcraft/sessions/*/rpc');
  const moved=acks.find(ack=>ack.result?.commandId==='layout.pages.move'),moveRequest=requests.find(request=>request.method==='layout.pages.move');
  assert.deepEqual(moveRequest.params,{from:1,to:0});assert.equal(moveRequest.expectedVersion,5);assert.equal(moved.stateVersion,6);assert.equal(moved.document.pageCount,2);assert.equal(moved.document.dirty,true);
  assert.deepEqual(await ids(),[beforeIds[1],beforeIds[0]]);
  assert.deepEqual(moved.documentSnapshot.spreads.map(sp=>sp.items.map(item=>item.id)),[beforeItems[1],beforeItems[0]],'the server moves page content with its page');
  const movedRender=await render(moved);assert.notEqual(movedRender,beforeRender,'the server PNG must change from content to blank at the unchanged preview page index');
  await drag(0,1);await revision(7);const restored=acks.at(-1);assert.deepEqual(requests.at(-1).params,{from:0,to:1});assert.deepEqual(await ids(),beforeIds);assert.equal(await render(restored),beforeRender,'forward move restores exact original page pixels');
  assert.equal(await canvas.getAttribute('data-server-render'),'true');assert.equal(await canvas.getAttribute('data-server-pending'),'false');
  assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);assert.deepEqual(requestFailures,[]);
  const report={status:'original-pages-move-server-ack-browser-proof',browser:'Chromium',sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',sourcePatch:'par-03-pages-insert-v1',workerSha256:await fileDigest(binary),uiPackage:await readdirPackage(packages),setup:{originalActions:['A4 preset','Properties > Page > Insert Page','Text Tool frame/caret/typing'],revision:5,pageCount:2,itemsPerPage:beforeItems.map(items=>items.length)},action:{originalAction:'Pages panel thumbnail drag',engineMethod:moveRequest.method,params:moveRequest.params,ackCommandId:moved.result.commandId,revision:6,pageCount:2,dirty:true,pendingMirrorUnchanged:true,serverPageIdentitiesReordered:true,contentMovesWithPage:true,serverPngChanged:true,beforeRenderSha256:beforeRender,movedRenderSha256:movedRender,reverseMove:{params:requests.at(-1).params,revision:7,identitiesRestored:true,pixelsRestored:true},thumbnailCenters:thumbnails},permission:'synthetic connected-folder chooser fixture; not real OS permission evidence',browserErrors:errors,failedResponses,requestFailures};
  if(process.env.CW_PAR03_PAGES_MOVE_REPORT)await writeFile(path.resolve(process.env.CW_PAR03_PAGES_MOVE_REPORT),JSON.stringify(report,null,2)+'\n');
  if(process.env.CW_PAR03_PAGES_MOVE_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_PAGES_MOVE_SCREENSHOT)});
  console.log(JSON.stringify(report));
}catch(error){
  console.log(JSON.stringify({status:'pages-move-browser-failed',error:error.message,...diagnostic?.()}));
  if(page&&process.env.CW_PAR03_PAGES_MOVE_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_PAGES_MOVE_SCREENSHOT)}).catch(()=>{});
  throw error;
}finally{
  if(sessionId&&server.listening){const base=`http://127.0.0.1:${server.address().port}`;await fetch(`${base}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});}
  await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
}

async function readdirPackage(root){
  const {readdir,readFile}=await import('node:fs/promises');
  for(const entry of await readdir(path.join(root,'designcraft'))){
    const manifest=JSON.parse(await readFile(path.join(root,'designcraft',entry,'creative-workspace-ui.json'),'utf8'));
    if(manifest.sourcePatch?.id==='par-03-pages-insert-v1')return entry;
  }
  throw new Error('Registered DesignCraft package is missing');
}

async function fileDigest(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
