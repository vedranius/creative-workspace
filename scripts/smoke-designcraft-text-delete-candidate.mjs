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
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failedResponses=[],requests=[],acks=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{const match=request.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(match){sessionId=match[1];requests.push(request.postDataJSON());}});
  page.on('response',async response=>{if(response.status()>=400)failedResponses.push({status:response.status(),url:response.url(),body:(await response.text()).slice(0,500)});if(response.url().endsWith('/rpc'))acks.push(await response.json());});
  await page.goto(`${base}/?webgl`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{window.__keyTrace=[];for(const type of ['keydown','keyup','beforeinput','input'])window.addEventListener(type,event=>{if(type==='keydown'||type==='keyup'||type==='beforeinput')window.__keyTrace.push({type,key:event.key,code:event.code,defaultPrevented:event.defaultPrevented,target:event.target?.tagName,targetId:event.target?.id,targetClass:String(event.target?.className||'').slice(0,100),activeTag:document.activeElement?.tagName,activeId:document.activeElement?.id,activeClass:String(document.activeElement?.className||'').slice(0,100)});},true);});
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-preset-a4'),null,{timeout:120000});
  const canvas=page.locator('#designcraft_canvas'),preset=JSON.parse(await canvas.getAttribute('data-original-preset-a4'));
  await page.mouse.click(...preset);await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='1');
  await page.keyboard.press('f');await page.mouse.move(390,300);await page.mouse.down();await page.mouse.move(560,450,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='2',null,{timeout:30000});
  assert.equal(requests[1]?.method,'frame.create');assert.equal(acks[1]?.result?.commandId,'frame.create');
  await page.keyboard.press('t');await page.mouse.move(700,500);await page.mouse.down();await page.mouse.move(830,560,{steps:3});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='3',null,{timeout:30000});
  assert.equal(requests[2]?.method,'frame.create');assert.equal(acks[2]?.result?.commandId,'frame.create');
  await page.mouse.click(750,530);
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='4',null,{timeout:30000});
  assert.equal(requests[3]?.method,'text.placeCaret');assert.equal(acks[3]?.result?.commandId,'text.placeCaret');
  await page.keyboard.type('INK',{delay:1});
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='7',null,{timeout:30000});
  assert.deepEqual(requests.slice(4,7).map(item=>item.method),['text.insert','text.insert','text.insert']);
  const textStory=acks[2]?.result?.story;
  assert.ok(acks[6]?.document?.stories?.find(story=>story.id===textStory)?.text?.includes('INK'),'server worker must render the typed original UI text');
  await page.mouse.click(750,530);
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='8',null,{timeout:30000});
  assert.equal(requests[7]?.method,'text.placeCaret');assert.equal(acks[7]?.result?.commandId,'text.placeCaret');
  await page.keyboard.press('Backspace');
  try{await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='9',null,{timeout:10000});}
  catch(error){console.error(JSON.stringify({diagnostic:'Backspace ACK missing',trace:await page.evaluate(()=>window.__keyTrace),canvas:await canvas.evaluate(el=>({tag:el.tagName,focused:el.matches(':focus'),tabIndex:el.tabIndex,attributes:[...el.attributes].map(a=>[a.name,a.value]).filter(([n])=>n.startsWith('data-'))})),active:await page.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,className:String(document.activeElement?.className||'').slice(0,200)})),requests:requests.map(r=>r.method),acks:acks.map(a=>({commandId:a.result?.commandId,result:a.result,selection:a.document?.selection,revision:a.stateVersion}))}));throw error;}
  assert.equal(requests[8]?.method,'text.delete');assert.deepEqual(requests[8]?.params,{forward:false,word:false});
  assert.equal(acks[8]?.result?.commandId,'text.delete');assert.equal(acks[8]?.stateVersion,9);
  assert.equal(acks[8]?.document?.stories?.find(story=>story.id===textStory)?.text,'IN','Backspace must update text in the owned server document');
  assert.equal(acks[8]?.document?.dirty,true,'text deletion marks dirty only in the acknowledged server state');
  const before=Buffer.from(await (await fetch(base+acks[7].preview,{headers:{Origin:base}})).arrayBuffer());
  const after=Buffer.from(await (await fetch(base+acks[8].preview,{headers:{Origin:base}})).arrayBuffer());
  const beforeSha256=createHash('sha256').update(before).digest('hex'),afterSha256=createHash('sha256').update(after).digest('hex');
  assert.notEqual(beforeSha256,afterSha256,'server render must reflect original Backspace');
  assert.equal(await canvas.getAttribute('data-server-render'),'true');assert.equal(await canvas.getAttribute('data-server-pending'),'false');
  assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);
  const report={status:'original-text-tool-backspace-server-ack-browser-proof',browser:'Chromium',sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',workerSha256:createHash('sha256').update(await readFile(binary)).digest('hex'),fileNew:{commandId:acks[0]?.result?.commandId,revision:acks[0]?.stateVersion},textFrame:{commandId:acks[2]?.result?.commandId,revision:acks[2]?.stateVersion,story:textStory},textCaret:{commandId:acks[3]?.result?.commandId,revision:acks[3]?.stateVersion},inserted:{text:'INK',revisions:acks.slice(4,7).map(reply=>reply.stateVersion)},caretPlacedAgain:{commandId:acks[7]?.result?.commandId,revision:acks[7]?.stateVersion},backspace:{originalTool:'Text Tool',method:requests[8]?.method,params:requests[8]?.params,ackCommandId:acks[8]?.result?.commandId,revision:acks[8]?.stateVersion,serverText:acks[8]?.document?.stories?.find(story=>story.id===textStory)?.text,dirty:acks[8]?.document?.dirty,beforeRenderSha256:beforeSha256,afterRenderSha256:afterSha256,renderChanged:beforeSha256!==afterSha256},serverRenderPresented:true,permission:'synthetic provider chooser fixture; not permission evidence',browserErrors:errors,failedResponses};
  if(process.env.CW_PAR03_TEXT_DELETE_REPORT)await writeFile(path.resolve(process.env.CW_PAR03_TEXT_DELETE_REPORT),JSON.stringify(report,null,2)+'\n');
  if(process.env.CW_PAR03_TEXT_DELETE_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_PAR03_TEXT_DELETE_SCREENSHOT)});
  console.log(JSON.stringify(report));
  const response=sessionId?await fetch(`${base}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>null):null;if(response?.ok)sessionId=null;
}finally{
  if(sessionId&&server.listening){const base=`http://127.0.0.1:${server.address().port}`;await fetch(`${base}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});}
  await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
}
