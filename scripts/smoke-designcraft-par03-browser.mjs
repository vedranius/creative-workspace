import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createWorkspaceServer} from '../src/server.js';
const binary=process.env.CW_DESIGNCRAFT_BINARY,uiRoot=process.env.CW_ORIGINAL_UI_DIR,playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;
if(!binary||!uiRoot||!playwrightPath)throw new Error('Set CW_DESIGNCRAFT_BINARY, CW_ORIGINAL_UI_DIR, and CW_PLAYWRIGHT_MODULE');
const {chromium}=await import(playwrightPath.startsWith('file:')?playwrightPath:pathToFileURL(path.resolve(playwrightPath)).href);
const root=await mkdtemp(path.join(os.tmpdir(),'cw-par03-browser-')),workspaces=path.join(root,'workspaces');await mkdir(workspaces);
const server=await createWorkspaceServer({dataDir:path.join(root,'data'),allowedRoots:[workspaces],originalUiRoot:uiRoot,designcraftOptions:{binary,stateDir:path.join(root,'sessions')}});
let browser,sessionId;
try{
 server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 const base=`http://127.0.0.1:${server.address().port}`,status=await (await fetch(`${base}/api/engines/designcraft`)).json();
 if(!status.ready||!status.ownedRuntime)throw new Error('Candidate native runtime identity check failed');
 browser=await chromium.launch({headless:true,...(process.env.CW_BROWSER_EXECUTABLE?{executablePath:process.env.CW_BROWSER_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',req=>{const match=req.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(match)sessionId=match[1];});
 await page.goto(`${base}/original/designcraft/?serverSample&webgl`,{waitUntil:'domcontentloaded'});
 const image=page.locator('#cw_server_render');await image.waitFor({state:'visible',timeout:120000});await page.waitForFunction(()=>{const i=document.querySelector('#cw_server_render');return i?.complete&&i.naturalWidth>0;},null,{timeout:120000});
 const ui=await image.evaluate(i=>({commandId:i.dataset.commandId,stateVersion:Number(i.dataset.stateVersion),width:i.naturalWidth,height:i.naturalHeight,canvas:!!document.querySelector('#designcraft_canvas')&&!document.querySelector('#designcraft_loading'),banner:document.querySelector('#cw_server_status')?.textContent}));
 if(ui.commandId!=='file.newSample'||ui.stateVersion!==1||ui.width!==612||ui.height!==792||!ui.canvas)throw new Error(`Unexpected browser render: ${JSON.stringify(ui)}`);
 const previewUrl=await image.getAttribute('src');const png=await (await fetch(new URL(previewUrl,base))).arrayBuffer();
 const screenshot=path.resolve(process.env.CW_PAR03_SCREENSHOT||path.join(root,'designcraft-par03.png'));await mkdir(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot});
 const foreign=await fetch(`${base}/api/designcraft/sessions/${'0'.repeat(48)}/rpc`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({method:'doc.sample',params:{},requestId:'foreign-session-check',expectedVersion:0})});
 const badOrigin=await fetch(`${base}/api/designcraft/sessions/${sessionId}/rpc`,{method:'POST',headers:{Origin:'http://evil.invalid','Content-Type':'application/json'},body:JSON.stringify({method:'doc.sample',params:{},requestId:'origin-check-001',expectedVersion:0})});
 if(foreign.status!==404||badOrigin.status!==403||errors.length)throw new Error(`Guard/browser failure: foreign=${foreign.status}, origin=${badOrigin.status}, errors=${errors.join('; ')}`);
 const report={url:`${base}/original/designcraft/?serverSample&webgl`,ownedRuntime:status.ownedRuntime,...ui,renderSha256:createHash('sha256').update(Buffer.from(png)).digest('hex'),foreignSessionStatus:foreign.status,invalidOriginStatus:badOrigin.status,uncaughtBrowserErrors:errors.length,screenshot};
 if(process.env.CW_PAR03_REPORT){const reportPath=path.resolve(process.env.CW_PAR03_REPORT);await mkdir(path.dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report));
}finally{
 if(sessionId)await fetch(`http://127.0.0.1:${server.address().port}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:`http://127.0.0.1:${server.address().port}`,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});
 await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});
}
