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
let browser,sessionId,actionSessionId;
try{
 server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 const base=`http://127.0.0.1:${server.address().port}`,status=await (await fetch(`${base}/api/engines/designcraft`)).json();
 if(!status.ready||!status.ownedRuntime)throw new Error('Candidate native runtime identity check failed');
 browser=await chromium.launch({headless:true,...(process.env.CW_BROWSER_EXECUTABLE?{executablePath:process.env.CW_BROWSER_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',req=>{const match=req.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(match)sessionId=match[1];});
 await page.goto(`${base}/original/designcraft/?serverEdit&webgl`,{waitUntil:'domcontentloaded'});
 const image=page.locator('#cw_server_render');try{await image.waitFor({state:'visible',timeout:120000});}catch(error){console.error(JSON.stringify({diagnostic:'server-render image missing',errors,body:await page.locator('body').innerText().catch(()=>''),url:page.url()}));await page.screenshot({path:path.resolve(process.env.CW_PAR03_SCREENSHOT||path.join(root,'designcraft-par03.png'))});throw error;}await page.waitForFunction(()=>{const i=document.querySelector('#cw_server_render');return i?.complete&&i.naturalWidth>0;},null,{timeout:120000});
 const ui=await image.evaluate(i=>({commandId:i.dataset.commandId,stateVersion:Number(i.dataset.stateVersion),documentTitle:i.dataset.documentTitle,pageCount:Number(i.dataset.pageCount),dirty:i.dataset.dirty==='true',width:i.naturalWidth,height:i.naturalHeight,canvas:!!document.querySelector('#designcraft_canvas')&&!document.querySelector('#designcraft_loading'),banner:document.querySelector('#cw_server_status')?.textContent}));
 if(ui.commandId!=='file.new'||ui.stateVersion!==1||ui.documentTitle!=='Server Edit Test'||ui.pageCount!==1||!ui.dirty||ui.width!==612||ui.height!==792||!ui.canvas||!ui.banner.includes('Server Edit Test'))throw new Error(`Unexpected browser read model/render: ${JSON.stringify(ui)}`);
 const initialPreviewUrl=await image.getAttribute('src'),initialPng=await (await fetch(new URL(initialPreviewUrl,base))).arrayBuffer(),initialRenderSha256=createHash('sha256').update(Buffer.from(initialPng)).digest('hex');
 for(const [x1,y1,x2,y2] of [[80,100,260,240],[300,320,500,470]]){const box=await image.boundingBox();const scale=Math.min(box.width/612,box.height/792),left=box.x+(box.width-612*scale)/2,top=box.y+(box.height-792*scale)/2;await page.mouse.move(left+x1*scale,top+y1*scale);await page.mouse.down();await page.mouse.move(left+x2*scale,top+y2*scale,{steps:3});await page.mouse.up();}
 await page.waitForFunction(()=>Number(document.querySelector('#cw_server_render')?.dataset.stateVersion)===3);
 const edited=await image.evaluate(i=>({commandId:i.dataset.commandId,stateVersion:Number(i.dataset.stateVersion),documentTitle:i.dataset.documentTitle,pageCount:Number(i.dataset.pageCount),dirty:i.dataset.dirty==='true',width:i.naturalWidth,height:i.naturalHeight,banner:document.querySelector('#cw_server_status')?.textContent,bannerRevision:Number(document.querySelector('#cw_server_status')?.dataset.stateVersion),bannerDirty:document.querySelector('#cw_server_status')?.dataset.dirty}));
 if(edited.commandId!=='frame.create'||edited.stateVersion!==3||edited.documentTitle!=='Server Edit Test'||edited.pageCount!==1||!edited.dirty||edited.width!==612||edited.height!==792||edited.bannerRevision!==3||edited.bannerDirty!=='true'||!edited.banner.includes('revision 3'))throw new Error(`Server edit/read-model/revision/render failed: ${JSON.stringify(edited)}`);
 await page.waitForFunction(()=>{const i=document.querySelector('#cw_server_render');return i?.complete&&i.naturalWidth===612&&new URL(i.src).searchParams.get('_')==='3';});
 const originalHostAction=await page.evaluate(async()=>{
  const post=async(url,body)=>{const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),value=await response.json();if(!response.ok)throw new Error(value.error||`HTTP ${response.status}`);return value;};
  const session=await post('/api/designcraft/sessions',{});
  try{const ack=await post(`/api/designcraft/sessions/${session.id}/rpc`,{method:'file.new',params:{preset:'A4'},requestId:crypto.randomUUID(),expectedVersion:0});return {sessionId:session.id,commandId:ack.result?.commandId,preset:'A4',stateVersion:ack.stateVersion,title:ack.document?.title,pageCount:ack.document?.pageCount,preview:ack.preview};}
  catch(error){await fetch(`/api/designcraft/sessions/${session.id}`,{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});throw error;}
 });
 actionSessionId=originalHostAction.sessionId;
 if(originalHostAction.commandId!=='file.new'||originalHostAction.preset!=='A4'||originalHostAction.stateVersion!==1||originalHostAction.pageCount!==1||!originalHostAction.preview)throw new Error(`Original file.new host action was not acknowledged: ${JSON.stringify(originalHostAction)}`);
 const actionClose=await fetch(`${base}/api/designcraft/sessions/${actionSessionId}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({discard:true})});if(!actionClose.ok)throw new Error(`Could not close file.new action session (${actionClose.status})`);actionSessionId=null;
 const previewUrl=await image.getAttribute('src');const png=await (await fetch(new URL(previewUrl,base))).arrayBuffer();
 const renderSha256=createHash('sha256').update(Buffer.from(png)).digest('hex');if(renderSha256===initialRenderSha256)throw new Error('Server PNG bytes did not change after the ordered edits');
 const screenshot=path.resolve(process.env.CW_PAR03_SCREENSHOT||path.join(root,'designcraft-par03.png'));await mkdir(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot});
 const foreign=await fetch(`${base}/api/designcraft/sessions/${'0'.repeat(48)}/rpc`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({method:'doc.sample',params:{},requestId:'foreign-session-check',expectedVersion:0})});
 const badOrigin=await fetch(`${base}/api/designcraft/sessions/${sessionId}/rpc`,{method:'POST',headers:{Origin:'http://evil.invalid','Content-Type':'application/json'},body:JSON.stringify({method:'doc.sample',params:{},requestId:'origin-check-001',expectedVersion:0})});
 const stale=await fetch(`${base}/api/designcraft/sessions/${sessionId}/rpc`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({method:'page.select',params:{index:0},requestId:'stale-revision-001',expectedVersion:0})});
 if(foreign.status!==404||badOrigin.status!==403||stale.status!==409||errors.length)throw new Error(`Guard/browser failure: foreign=${foreign.status}, origin=${badOrigin.status}, stale=${stale.status}, errors=${errors.join('; ')}`);
 const report={url:`${base}/original/designcraft/?serverEdit&webgl`,ownedRuntime:status.ownedRuntime,...ui,originalHostAction,editCommand:edited.commandId,afterEditRevision:edited.stateVersion,afterEditDimensions:[edited.width,edited.height],initialRenderSha256,renderSha256,foreignSessionStatus:foreign.status,invalidOriginStatus:badOrigin.status,staleRevisionStatus:stale.status,uncaughtBrowserErrors:errors.length,screenshot};
 if(process.env.CW_PAR03_REPORT){const reportPath=path.resolve(process.env.CW_PAR03_REPORT);await mkdir(path.dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report));
}finally{
 if(actionSessionId)await fetch(`http://127.0.0.1:${server.address().port}/api/designcraft/sessions/${actionSessionId}`,{method:'DELETE',headers:{Origin:`http://127.0.0.1:${server.address().port}`,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});
 if(sessionId)await fetch(`http://127.0.0.1:${server.address().port}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:`http://127.0.0.1:${server.address().port}`,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});
 await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});
}
