import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createWorkspaceServer} from '../src/server.js';

const binary=process.env.CW_DESIGNCRAFT_BINARY,playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;
if(!binary||!playwrightPath)throw new Error('Set CW_DESIGNCRAFT_BINARY and CW_PLAYWRIGHT_MODULE');
const {chromium}=await import(playwrightPath.startsWith('file:')?playwrightPath:pathToFileURL(path.resolve(playwrightPath)).href);
const root=await mkdtemp(path.join(os.tmpdir(),'cw-designcraft-file-new-browser-'));
const projects=path.join(root,'projects'),originalUiRoot=path.join(root,'original-ui');
await mkdir(projects);await mkdir(originalUiRoot);
const server=await createWorkspaceServer({dataDir:path.join(root,'data'),allowedRoots:[projects],originalUiRoot,designcraftOptions:{binary,stateDir:path.join(root,'sessions')}});
let browser,sessionId;
try{
  server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.CW_BROWSER_EXECUTABLE?{executablePath:process.env.CW_BROWSER_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const action=await page.evaluate(async()=>{
    const post=async(url,body)=>{const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),value=await response.json();if(!response.ok)throw new Error(value.error||`HTTP ${response.status}`);return value;};
    const session=await post('/api/designcraft/sessions',{});
    try{
      const ack=await post(`/api/designcraft/sessions/${session.id}/rpc`,{method:'file.new',params:{preset:'A4'},requestId:crypto.randomUUID(),expectedVersion:0});
      const response=await fetch(ack.preview,{credentials:'same-origin'}),png=new DataView(await response.arrayBuffer());
      if(!response.ok||response.headers.get('content-type')!=='image/png')throw new Error('The acknowledged preview was not a server PNG');
      return {sessionId:session.id,commandId:ack.result?.commandId,preset:'A4',stateVersion:ack.stateVersion,title:ack.document?.title,pageCount:ack.document?.pageCount,dirty:ack.document?.dirty,previewWidth:png.getUint32(16),previewHeight:png.getUint32(20)};
    }catch(error){await fetch(`/api/designcraft/sessions/${session.id}`,{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});throw error;}
  });
  sessionId=action.sessionId;
  assert.equal(action.commandId,'file.new');assert.equal(action.preset,'A4');assert.equal(action.stateVersion,1);assert.equal(action.pageCount,1);assert.equal(action.dirty,true);assert.ok(action.previewWidth>0&&action.previewHeight>0);assert.deepEqual(errors,[]);
  const response=await fetch(`${base}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({discard:true})});assert.equal(response.status,200);sessionId=null;
  const report={ownedRuntime:true,browser:'Chromium',...action,sessionId:undefined,uncaughtBrowserErrors:errors.length};
  if(process.env.CW_PAR03_FILE_NEW_REPORT){const reportPath=path.resolve(process.env.CW_PAR03_FILE_NEW_REPORT);await mkdir(path.dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');}
  if(process.env.CW_PAR03_FILE_NEW_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_FILE_NEW_SCREENSHOT)});
  console.log(JSON.stringify(report));
}finally{
  if(sessionId)await fetch(`http://127.0.0.1:${server.address().port}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:`http://127.0.0.1:${server.address().port}`,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});
  await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});
}
