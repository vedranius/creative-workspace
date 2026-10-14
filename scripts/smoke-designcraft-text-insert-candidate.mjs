import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {createWorkspaceServer} from '../src/server.js';

const assets=path.resolve(process.env.CW_DESIGNCRAFT_UI_ASSETS||'build/host-tmp/cw-par03-textqueue/dist');
const binary=process.env.CW_DESIGNCRAFT_BINARY||'build/par03-snapshot-target/debug/cw-designcraft-engine';
const playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;
const bootTimeout=Number(process.env.CW_BOOT_TIMEOUT||120000);
if(!playwrightPath)throw new Error('Set CW_PLAYWRIGHT_MODULE');
const playwrightUrl=playwrightPath.startsWith('file:')?playwrightPath:pathToFileURL(path.resolve(playwrightPath)).href;
const {chromium}=await import(playwrightUrl);
const scratchRoot=path.resolve('build/host-tmp');
await mkdir(scratchRoot,{recursive:true});
const scratch=await mkdtemp(path.join(scratchRoot,'cw-par03-text-browser-'));
const workspaces=path.join(scratch,'workspaces');await mkdir(workspaces);
const server=await createWorkspaceServer({dataDir:path.join(scratch,'data'),allowedRoots:[workspaces],designcraftOptions:{binary,stateDir:path.join(scratch,'sessions')}});
const handlers=server.listeners('request');server.removeAllListeners('request');
let shareId,sessionId,browser;
server.on('request',async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&(url.pathname==='/'||url.pathname.startsWith('/'))&&!url.pathname.startsWith('/api/')){
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
      const scriptHashes=[];if(name.endsWith('.html'))for(const m of bytes.toString().matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(m[1]))scriptHashes.push(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:`,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});res.end(bytes);return;
    }catch(error){res.writeHead(404);res.end(String(error));return;}
  }
  if(req.method==='POST'&&url.pathname==='/api/designcraft/sessions'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const payload=JSON.parse(Buffer.concat(chunks).toString());delete payload.sourceShareId;
    const fixture=Readable.from([JSON.stringify(payload)]);fixture.method=req.method;fixture.url=req.url;fixture.headers=req.headers;
    for(const listener of handlers)listener.call(server,fixture,res);return;
  }
  for(const listener of handlers)listener.call(server,req,res);
});
try{
  server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  shareId='fixture-share';
  assert.equal((await (await fetch(`${base}/api/engines/designcraft`)).json()).ownedRuntime,true);
  browser=await chromium.launch({headless:true,executablePath:process.env.CW_BROWSER_EXECUTABLE||'/opt/google/chrome/chrome',args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failedResponses=[],requests=[],acks=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',req=>{const match=req.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(match){sessionId=match[1];requests.push(req.postDataJSON());}});
  page.on('response',async response=>{if(response.status()>=400)failedResponses.push({status:response.status(),url:response.url(),body:(await response.text()).slice(0,1024)});});
  page.on('response',async response=>{if(response.url().endsWith('/rpc'))acks.push(await response.json());});
  await page.goto(`${base}/?webgl`,{waitUntil:'domcontentloaded'});
  try { await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-preset-a4'),null,{timeout:bootTimeout}); }
  catch(error) { console.error(JSON.stringify({url:page.url(),title:await page.title(),canvas:await page.locator('#designcraft_canvas').count(),body:(await page.locator('body').innerText()).slice(0,1200),errors,failedResponses})); throw error; }
  const canvas=page.locator('#designcraft_canvas');
  const preset=JSON.parse(await canvas.getAttribute('data-original-preset-a4'));await page.mouse.click(...preset);
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='1');
  await page.mouse.click(500,300);await page.keyboard.press('m');await page.mouse.move(410,300);await page.mouse.down();await page.mouse.move(560,460,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='2',null,{timeout:30000});
  await page.keyboard.press('t');await page.mouse.move(700,500);await page.mouse.down();await page.mouse.move(830,560,{steps:3});await page.mouse.up();
  try { await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='3',null,{timeout:30000}); }
  catch(error) { console.error(JSON.stringify({revision:await canvas.getAttribute('data-server-revision'),requests,acks,errors,failedResponses})); throw error; }
  await page.mouse.click(750,530);
  try { await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='4',null,{timeout:30000}); }
  catch(error) { console.error(JSON.stringify({revision:await canvas.getAttribute('data-server-revision'),requests,ackRevisions:acks.map(reply=>reply.stateVersion),selections:acks.map(reply=>reply.document?.selection),errors,failedResponses})); throw error; }
  const typed='Queue Ω';await page.keyboard.type(typed,{delay:1});
  try { await page.waitForFunction((count)=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')===String(4+count),typed.length,{timeout:30000}); }
  catch(error) { console.error(JSON.stringify({revision:await canvas.getAttribute('data-server-revision'),requests,ackRevisions:acks.map(reply=>reply.stateVersion),selections:acks.map(reply=>reply.document?.selection),errors,failedResponses})); throw error; }
  const textRequests=requests.filter(request=>request.method==='text.insert'),textAcks=acks.filter(reply=>reply.result?.commandId==='text.insert');
  assert.ok(acks[3]?.document?.selection?.text,'Type Tool caret should survive the text.placeCaret server acknowledgement');
  assert.equal(requests[3]?.method,'text.placeCaret');assert.equal(acks[3]?.result?.commandId,'text.placeCaret');
  assert.equal(textRequests.length,typed.length);assert.equal(textAcks.length,typed.length);
  assert.ok(textRequests.every(request=>request.method==='text.insert'));
  assert.deepEqual(textRequests.map(request=>request.expectedVersion),Array.from({length:typed.length},(_,i)=>4+i));
  assert.deepEqual(textAcks.map(reply=>reply.result?.commandId),Array(typed.length).fill('text.insert'));
  assert.deepEqual(textAcks.map(reply=>reply.stateVersion),Array.from({length:typed.length},(_,i)=>5+i));
  const stateReply=await fetch(`${base}/api/designcraft/sessions/${sessionId}/rpc`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({method:'state',params:{},requestId:'text-insert-state-proof',expectedVersion:4+typed.length})});
  assert.equal(stateReply.status,200);const state=await stateReply.json();assert.ok(JSON.stringify(state.documentSnapshot).includes(typed));
  assert.equal(await canvas.getAttribute('data-server-revision'),String(4+typed.length));assert.equal(await canvas.getAttribute('data-server-render'),'true');assert.deepEqual(errors,[]);
  const report={status:'bounded-original-ui-text-caret-and-text-insert-proof',presetAck:acks[0]?.stateVersion,shapeFrameAck:acks[1]?.stateVersion,textFrameAck:acks[2]?.stateVersion,textCaretActionId:acks[3]?.result?.commandId,textCaretAck:acks[3]?.stateVersion,textCaretRestored:!!acks[3]?.document?.selection?.text,text:typed,textCalls:textRequests.map(request=>request.params.text),expectedRevisions:textRequests.map(request=>request.expectedVersion),ackRevisions:textAcks.map(reply=>reply.stateVersion),serverSnapshotContainsText:true,serverRenderUpdated:await canvas.getAttribute('data-server-render')==='true',browserErrors:errors};
  if(process.env.CW_PAR03_TEXT_REPORT)await (await import('node:fs/promises')).writeFile(path.resolve(process.env.CW_PAR03_TEXT_REPORT),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}finally{
  if(sessionId)await fetch(`http://127.0.0.1:${server.address().port}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:`http://127.0.0.1:${server.address().port}`,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});
  await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
}
