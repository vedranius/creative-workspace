import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {createWorkspaceServer} from '../src/server.js';

const runRoot=path.resolve(process.env.CW_PAR03_WORK_ROOT||'build/host-tmp/par03-pages-insert-20261017');
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
const shareId='pages-insert-browser-fixture';
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

let browser,sessionId,page;
try{
  server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.CW_BROWSER_EXECUTABLE?{executablePath:process.env.CW_BROWSER_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[],failedResponses=[],requests=[],acks=[],requestFailures=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{const match=request.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(match){sessionId=match[1];requests.push(request.postDataJSON());}});
  page.on('requestfailed',request=>requestFailures.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('response',async response=>{if(response.status()>=400)failedResponses.push({status:response.status(),url:response.url(),body:(await response.text()).slice(0,400)});if(response.url().endsWith('/rpc'))acks.push(await response.json());});
  await page.goto(`${base}/original/designcraft/?webgl`,{waitUntil:'domcontentloaded'});
  const canvas=page.locator('#designcraft_canvas');
  try{await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-preset-a4'),null,{timeout:45000});}
  catch(error){
    const diagnostic={status:'browser-startup-failed',error:error.message,url:page.url(),title:await page.title(),body:(await page.locator('body').innerText()).slice(0,1200),canvas:await page.locator('#designcraft_canvas').count(),canvasAttributes:await canvas.evaluate(el=>Object.fromEntries([...el.attributes].map(a=>[a.name,a.value]))).catch(()=>null),errors,failedResponses,requestFailures};
    const screenshotPath=process.env.CW_PAR03_PAGES_INSERT_MENU_SCREENSHOT;if(screenshotPath)await page.screenshot({path:path.resolve(screenshotPath)}).catch(()=>{});
    console.log(JSON.stringify(diagnostic));throw error;
  }
  const preset=JSON.parse(await canvas.getAttribute('data-original-preset-a4'));
  await page.mouse.click(...preset);
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='1',{},{timeout:30000});
  assert.equal(acks[0]?.result?.commandId,'file.new');assert.equal(acks[0]?.stateVersion,1);
  const before=acks[0];
  // Invoke the original Properties > Page > Insert Page action.
  const menuShot=process.env.CW_PAR03_PAGES_INSERT_MENU_SCREENSHOT?path.resolve(process.env.CW_PAR03_PAGES_INSERT_MENU_SCREENSHOT):path.join(scratch,'properties-insert-page.png');await page.screenshot({path:menuShot});
  await page.mouse.click(1365,615);
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='2',{},{timeout:30000});
  const inserted=acks[1];
  assert.equal(requests[1]?.method,'layout.pages.insert');
  assert.deepEqual(requests[1]?.params,{after:0,count:1});
  assert.equal(inserted?.result?.commandId,'layout.pages.insert');
  assert.equal(inserted?.stateVersion,2);
  assert.equal(inserted?.document?.pageCount,2);
  assert.equal(inserted?.documentSnapshot?.spreads?.length,2);
  assert.equal(inserted?.document?.dirty,true);
  assert.notEqual(inserted?.preview,before?.preview,'ACK must include a new revisioned server render');
  const render=await fetch(`${base}${inserted.preview}`,{headers:{Origin:base}});assert.equal(render.status,200);assert.equal(render.headers.get('content-type'),'image/png');
  assert.equal(await canvas.getAttribute('data-server-render'),'true');assert.equal(await canvas.getAttribute('data-server-pending'),'false');
  assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);assert.deepEqual(requestFailures,[]);
  const report={status:'original-pages-insert-server-ack-browser-proof',browser:'Chromium',sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',sourcePatch:'par-03-pages-insert-v1',workerSha256:createHash('sha256').update(await readFile(binary)).digest('hex'),uiPackage:await readdirPackage(packages),action:{originalAction:'Properties > Page > Insert Page',engineMethod:requests[1]?.method,params:requests[1]?.params,ackCommandId:inserted?.result?.commandId,revision:inserted?.stateVersion,pageCount:inserted?.document?.pageCount,dirty:inserted?.document?.dirty,render:inserted?.preview,renderStatus:render.status},permission:'synthetic connected-folder chooser fixture; not real OS permission evidence',browserErrors:errors,failedResponses,requestFailures};
  const reportPath=process.env.CW_PAR03_PAGES_INSERT_REPORT;if(reportPath)await writeFile(path.resolve(reportPath),JSON.stringify(report,null,2)+'\n');
  const screenshotPath=process.env.CW_PAR03_PAGES_INSERT_SCREENSHOT;if(screenshotPath)await page.screenshot({path:path.resolve(screenshotPath)});
  console.log(JSON.stringify(report));
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
  throw new Error('Registered Insert Page DesignCraft package is missing');
}
