import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {createWorkspaceServer} from '../src/server.js';

const root=path.resolve('build/host-tmp/par03-edit-select-all-20261015');
const assets=path.resolve(process.env.CW_DESIGNCRAFT_UI_ASSETS||path.join(root,'assets'));
const binary=path.resolve(process.env.CW_DESIGNCRAFT_BINARY||'build/par03-redo/target/debug/cw-designcraft-engine');
const observerDelay=Number(process.env.CW_PAR03_ACK_OBSERVER_DELAY_MS||0);
if(!Number.isSafeInteger(observerDelay)||observerDelay<0||observerDelay>2000)throw Error('Invalid observer delay');
const playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;
if(!playwrightPath)throw new Error('Set CW_PLAYWRIGHT_MODULE');
const {chromium}=await import(playwrightPath.startsWith('file:')?playwrightPath:pathToFileURL(path.resolve(playwrightPath)).href);
const scratch=path.join(root,'browser-runtime');
await rm(scratch,{recursive:true,force:true});
const workspaces=path.join(scratch,'workspaces');await mkdir(workspaces,{recursive:true});
const server=await createWorkspaceServer({dataDir:path.join(scratch,'data'),allowedRoots:[workspaces],designcraftOptions:{binary,stateDir:path.join(scratch,'sessions')}});
const handlers=server.listeners('request');server.removeAllListeners('request');
let shareId='select-all-browser-fixture';
server.on('request',async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&!url.pathname.startsWith('/api/')){
    try{
      const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
      if(name.split('/').some(part=>!part||part==='.'||part==='..'||part.startsWith('.')))throw new Error('Unsafe candidate asset');
      if(name==='favicon.ico'){res.writeHead(204);res.end();return;}
      if(name==='storage/folders.js'){
        res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
        res.end(`export function chooseLocalFolder(options){options.onReady({id:${JSON.stringify(shareId)}});return Promise.resolve();}`);return;
      }
      const bytes=await readFile(path.join(assets,name));
      const type=name.endsWith('.html')?'text/html':name.endsWith('.js')?'text/javascript':name.endsWith('.wasm')?'application/wasm':'application/octet-stream';
      const hashes=[];if(name.endsWith('.html'))for(const match of bytes.toString().matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(match[1]))hashes.push(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:`,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});res.end(bytes);return;
    }catch(error){res.writeHead(404);res.end(String(error));return;}
  }
  if(req.method==='POST'&&url.pathname==='/api/designcraft/sessions'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const payload=JSON.parse(Buffer.concat(chunks).toString());delete payload.sourceShareId;
    const fixture=Readable.from([JSON.stringify(payload)]);fixture.method=req.method;fixture.url=req.url;fixture.headers=req.headers;
    for(const listener of handlers)listener.call(server,fixture,res);return;
  }
  for(const listener of handlers)listener.call(server,req,res);
});
let browser,sessionId;
try{
  server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.CW_BROWSER_EXECUTABLE?{executablePath:process.env.CW_BROWSER_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failedResponses=[],requests=[],acks=[],observations=[],observerTrace=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{const match=request.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(match){
    sessionId=match[1];const index=requests.length;requests.push(request.postDataJSON());
    let resolve;const parsed=new Promise(r=>{resolve=r;});observations.push({request,index,parsed,resolve,done:false});
  }});
  page.on('response',response=>{
    if(response.status()>=400)response.text().then(body=>failedResponses.push({status:response.status(),url:response.url(),body:body.slice(0,500)})).catch(error=>failedResponses.push({status:response.status(),error:error.message}));
    const slot=observations.find(item=>item.request===response.request());if(!slot)return;
    (async()=>{
      // QA injection delays only this Node observer, never server processing or UI ACK.
      if(observerDelay&&requests[slot.index].method==='edit.clear')await new Promise(r=>setTimeout(r,observerDelay));
      const ack=await response.json();acks[slot.index]=ack;slot.done=true;slot.resolve({ack});
    })().catch(error=>{slot.done=true;slot.resolve({error});});
  });
  const waitForRevision=async revision=>{
    try{await page.waitForFunction(n=>{const c=document.querySelector('#designcraft_canvas');return c?.getAttribute('data-server-revision')===String(n)&&c.getAttribute('data-server-pending')==='false';},revision,{timeout:30000});}
    catch(error){console.error(JSON.stringify({diagnostic:'applied-revision-not-ready',expected:revision,canvas:await page.locator('#designcraft_canvas').evaluate(c=>({revision:c.getAttribute('data-server-revision'),pending:c.getAttribute('data-server-pending')})),requests:requests.map(r=>r.method),observed:acks.map(a=>({id:a.id,revision:a.stateVersion,command:a.result?.commandId,error:a.error?.message}))}));throw error;}
    const slots=observations.slice(0,revision),slot=slots[revision-1];assert.ok(slot,'applied revision must have its matching observed request');
    const pending=!slot.done;let timer,result;
    try{result=await Promise.race([Promise.all(slots.map(item=>item.parsed)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('RPC observer did not parse revision '+revision)),5000);})]);}finally{clearTimeout(timer);}
    for(const [index,item]of result.entries()){
      if(item.error)throw item.error;
      assert.equal(item.ack.id,requests[index].id,'observer must match this request ID');
      assert.equal(item.ack.stateVersion,index+1,'observer must match the applied revision');
    }
    observerTrace.push({revision,method:requests[slot.index].method,observerPendingAfterUiAck:pending});
  };
  await page.goto(`${base}/?webgl`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-preset-a4'),null,{timeout:120000});
  const canvas=page.locator('#designcraft_canvas'),preset=JSON.parse(await canvas.getAttribute('data-original-preset-a4'));
  await page.mouse.click(...preset);await waitForRevision(1);
  await page.keyboard.press('f');await page.mouse.move(390,300);await page.mouse.down();await page.mouse.move(560,450,{steps:5});await page.mouse.up();
  await waitForRevision(2);
  assert.equal(requests[1]?.method,'frame.create');assert.equal(acks[1]?.result?.commandId,'frame.create');
  await page.keyboard.press('t');await page.mouse.move(700,500);await page.mouse.down();await page.mouse.move(830,560,{steps:3});await page.mouse.up();
  await waitForRevision(3);
  assert.equal(requests[2]?.method,'frame.create');assert.equal(acks[2]?.result?.commandId,'frame.create');
  await page.mouse.click(750,530);
  await waitForRevision(4);
  assert.equal(requests[3]?.method,'text.placeCaret');assert.equal(acks[3]?.result?.commandId,'text.placeCaret');
  for(const [index,char]of Array.from('INK').entries()){await page.keyboard.type(char);await waitForRevision(5+index);}
  assert.deepEqual(requests.slice(4,7).map(item=>item.method),['text.insert','text.insert','text.insert']);
  const textStory=acks[2]?.result?.story;
  assert.ok(acks[6]?.document?.stories?.find(story=>story.id===textStory)?.text?.includes('INK'),'server worker must render the typed original UI text');
  const plainBeforePng=Buffer.from(await(await fetch(base+acks[6].preview,{headers:{Origin:base}})).arrayBuffer());
  const plainBeforeRenderSha256=createHash('sha256').update(plainBeforePng).digest('hex');
  await page.keyboard.press('Control+a');
  await waitForRevision(8);
  assert.equal(requests[7]?.method,'edit.selectAll');assert.equal(acks[7]?.result?.commandId,'edit.selectAll');
  assert.ok(acks[7]?.document?.selection?.text,'original Select All should select the visible story text');
  await page.mouse.click(96,17);await page.waitForTimeout(300);
  if(process.env.CW_PAR03_EDIT_CLEAR_MENU_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_EDIT_CLEAR_MENU_SCREENSHOT)});
  await page.mouse.click(112,252); // Original Edit > Clear menu item
  try{await waitForRevision(9);}
  catch(error){console.error(JSON.stringify({diagnostic:'edit-clear-menu-action-not-acknowledged',revision:await canvas.getAttribute('data-server-revision'),requests:requests.map(item=>item.method),acks:acks.map(item=>item.result?.commandId||item.error?.message),failedResponses}));throw error;}
  assert.equal(requests[8]?.method,'edit.clear');assert.equal(requests[8]?.params&&Object.keys(requests[8].params).length,0);
  assert.equal(acks[8]?.result?.commandId,'edit.clear');assert.equal(acks[8]?.stateVersion,9);
  assert.equal(acks[8]?.document?.stories?.find(story=>story.id===textStory)?.text,'','Clear must delete the selected server-owned story text');
  assert.equal(acks[8]?.document?.dirty,true,'deletion must mark the document dirty after ACK');
  const beforePng=Buffer.from(await (await fetch(base+acks[7].preview,{headers:{Origin:base}})).arrayBuffer());
  const afterPng=Buffer.from(await (await fetch(base+acks[8].preview,{headers:{Origin:base}})).arrayBuffer());
  const beforeRenderSha256=createHash('sha256').update(beforePng).digest('hex'),afterRenderSha256=createHash('sha256').update(afterPng).digest('hex');
  assert.notEqual(afterRenderSha256,beforeRenderSha256,'the server render must reflect the text deletion');
  await page.keyboard.press('Control+z');
  await waitForRevision(10);
  assert.equal(requests[9]?.method,'edit.undo');assert.equal(requests[9]?.params&&Object.keys(requests[9].params).length,0);
  assert.equal(acks[9]?.result?.commandId,'edit.undo');assert.equal(acks[9]?.stateVersion,10);
  assert.equal(acks[9]?.document?.stories?.find(story=>story.id===textStory)?.text,'INK','original Undo must restore the server-owned text after Clear');
  assert.equal(acks[9]?.document?.dirty,true,'Undo must preserve the document dirty state after ACK');
  const undoPng=Buffer.from(await (await fetch(base+acks[9].preview,{headers:{Origin:base}})).arrayBuffer());
  const undoRenderSha256=createHash('sha256').update(undoPng).digest('hex');
  assert.deepEqual(acks[9].documentSnapshot,acks[6].documentSnapshot,'Undo must restore the exact canonical document');
  assert.ok(acks[7].textSelection,'Select All now has a transient inverse highlight');assert.equal(acks[9].textSelection,null);
  assert.equal(undoRenderSha256,plainBeforeRenderSha256,'Undo without a range must restore the exact pre-selection content PNG');
  await page.keyboard.press('Control+Shift+z');
  await waitForRevision(11);
  assert.equal(requests[10]?.method,'edit.redo');assert.equal(requests[10]?.params&&Object.keys(requests[10].params).length,0);
  assert.equal(acks[10]?.result?.commandId,'edit.redo');assert.equal(acks[10]?.stateVersion,11);
  assert.equal(acks[10]?.document?.stories?.find(story=>story.id===textStory)?.text,'','original Redo must clear the server-owned text after Undo');
  assert.equal(acks[10]?.document?.dirty,true,'Redo must preserve the document dirty state after ACK');
  const redoPng=Buffer.from(await (await fetch(base+acks[10].preview,{headers:{Origin:base}})).arrayBuffer());
  const redoRenderSha256=createHash('sha256').update(redoPng).digest('hex');
  assert.equal(redoRenderSha256,afterRenderSha256,'the server render after Redo must match the post-Clear render');
  assert.equal(await canvas.getAttribute('data-server-render'),'true');assert.equal(await canvas.getAttribute('data-server-pending'),'false');
  assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);
  const report={observer:{delayMs:observerDelay,correlatedByRequest:true,boundedParseWaitMs:5000,revisions:observerTrace},status:'original-edit-clear-undo-redo-server-ack-browser-proof',browser:'Chromium',workerSha256:createHash('sha256').update(await readFile(binary)).digest('hex'),sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',fileNew:{commandId:acks[0]?.result?.commandId,revision:acks[0]?.stateVersion},graphicFrame:{commandId:acks[1]?.result?.commandId,revision:acks[1]?.stateVersion},textFrame:{commandId:acks[2]?.result?.commandId,revision:acks[2]?.stateVersion,story:textStory},textCaret:{commandId:acks[3]?.result?.commandId,revision:acks[3]?.stateVersion},serverText:{text:'INK',insertRevisions:acks.slice(4,7).map(reply=>reply.stateVersion)},selectAll:{method:requests[7]?.method,ackCommandId:acks[7]?.result?.commandId,revision:acks[7]?.stateVersion,selectedText:acks[7]?.document?.selection?.text},editClear:{method:requests[8]?.method,params:requests[8]?.params,ackCommandId:acks[8]?.result?.commandId,revision:acks[8]?.stateVersion,serverTextCleared:acks[8]?.document?.stories?.find(story=>story.id===textStory)?.text==='',documentDirty:acks[8]?.document?.dirty,beforeServerRenderSha256:beforeRenderSha256,afterServerRenderSha256:afterRenderSha256,serverRenderChanged:beforeRenderSha256!==afterRenderSha256},editUndo:{method:requests[9]?.method,ackCommandId:acks[9]?.result?.commandId,revision:acks[9]?.stateVersion,serverTextRestored:acks[9]?.document?.stories?.find(story=>story.id===textStory)?.text==='INK',documentDirty:acks[9]?.document?.dirty,serverRenderSha256:undoRenderSha256,plainBeforeRenderSha256,canonicalRestored:true,rangeOverlayRestored:false,renderRestored:undoRenderSha256===plainBeforeRenderSha256},editRedo:{method:requests[10]?.method,params:requests[10]?.params,ackCommandId:acks[10]?.result?.commandId,revision:acks[10]?.stateVersion,serverTextCleared:acks[10]?.document?.stories?.find(story=>story.id===textStory)?.text==='',documentDirty:acks[10]?.document?.dirty,serverRenderSha256:redoRenderSha256,renderRestored:redoRenderSha256===afterRenderSha256},serverRenderPresented:await canvas.getAttribute('data-server-render')==='true',permission:'synthetic provider chooser fixture; not permission evidence',browserErrors:errors,failedResponses};
  if(process.env.CW_PAR03_EDIT_CLEAR_REPORT)await writeFile(path.resolve(process.env.CW_PAR03_EDIT_CLEAR_REPORT),JSON.stringify(report,null,2)+'\n');
  if(process.env.CW_PAR03_EDIT_CLEAR_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_EDIT_CLEAR_SCREENSHOT)});
  console.log(JSON.stringify(report));
  const response=sessionId?await fetch(`${base}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>null):null;if(response?.ok)sessionId=null;
}finally{
  if(sessionId&&server.listening){const base=`http://127.0.0.1:${server.address().port}`;await fetch(`${base}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});}
  await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
}
