// Isolated, unregistered pinned-source candidate proof; this never replaces a live studio.
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {createWorkspaceServer} from '../src/server.js';
const assets=await realpath(process.env.CW_DESIGNCRAFT_UI_ASSETS||'build/par03-host-assets');
const binary=process.env.CW_DESIGNCRAFT_BINARY, playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;
if(!binary||!playwrightPath)throw new Error('Set CW_DESIGNCRAFT_BINARY and CW_PLAYWRIGHT_MODULE');
const {chromium}=await import(pathToFileURL(path.resolve(playwrightPath)).href);
const scratch=await mkdtemp(path.join(os.tmpdir(),'cw-host-canvas-'));
await mkdir(path.join(scratch,'projects'));
const server=await createWorkspaceServer({dataDir:path.join(scratch,'data'),allowedRoots:[path.join(scratch,'projects')],designcraftOptions:{binary,stateDir:path.join(scratch,'sessions')}});
const gateway=server.listeners('request');server.removeAllListeners('request');
// Candidate assets use the same origin/headers as the gateway, only on a disposable loopback port.
server.on('request',async(req,res)=>{
 if(!req.url.startsWith('/candidate/')){for(const listener of gateway)listener.call(server,req,res);return;}
 try{
  assert.equal(req.method,'GET');
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice('/candidate/'.length)||'index.html';
  assert.ok(pathname.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.startsWith('.'))&&!pathname.includes('\\'));
  const file=await realpath(path.join(assets,pathname));assert.ok(file.startsWith(assets+path.sep));
  const bytes=await readFile(file),types={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'};
  // Trunk's inline bootstrap is hash-allowlisted, matching the production registry policy.
  const hashes=[];if(pathname.endsWith('.html'))for(const m of bytes.toString().matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(m[1]))hashes.push(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:`);
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  res.writeHead(200,{'Content-Type':types[path.extname(pathname)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
function visibleCanvas(png){
 assert.equal(png.readUInt32BE(0),0x89504e47);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20),channels=png[25]===2?3:png[25]===6?4:0;
 assert.equal(png[24],8);assert.ok(channels);
 const chunks=[];for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=length+12;}
 const data=inflateSync(Buffer.concat(chunks)),stride=width*channels;let previous=Buffer.alloc(stride),offset=0,brightPixels=0;const colors=new Set();
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const filter=data[offset++],row=Buffer.from(data.subarray(offset,offset+stride));offset+=stride;assert.ok(filter<=4);
  for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;row[x]=(row[x]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}
  for(let x=0;x<stride;x+=channels){if(row[x]>140&&row[x+1]>140&&row[x+2]>140)brightPixels++;if(colors.size<64)colors.add(`${row[x]},${row[x+1]},${row[x+2]}`);}
  previous=row;
 }
 assert.ok(brightPixels>100000&&colors.size>=32,`Original canvas was not visibly painted: ${brightPixels} bright pixels, ${colors.size} colors`);
 return {brightPixels,distinctColorsAtLeast:Math.min(colors.size,64)};
}
let browser,sessionId;
try{
 server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await (await fetch(base+'/api/engines/designcraft')).json()).ownedRuntime,true);
 browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:process.env.CW_BROWSER_EXECUTABLE,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],pageErrors=[],requests=[],replies=[];
 page.on('pageerror',e=>{errors.push(e.message);pageErrors.push(e.message);});
 page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(`Browser console: ${m.text()}`);}});
 page.on('requestfailed',req=>console.error(`Browser request failed: ${req.url()} ${req.failure()?.errorText||''}`));
 page.on('request',req=>{const m=req.url().match(/\/api\/designcraft\/sessions\/([a-f0-9]{48})\/rpc$/);if(m){sessionId=m[1];requests.push(req.postDataJSON());}});
 page.on('response',async response=>{if(response.url().endsWith('/rpc'))replies.push(await response.json());});
 await page.goto(base+'/candidate/?webgl',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('#designcraft_loading'),null,{timeout:120000});
 const before=process.env.CW_PAR03_BEFORE_SCREENSHOT;
 if(before)await page.screenshot({path:path.resolve(before)});
 // Read the actual original preset-card bounds, then send a real browser pointer click.
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-preset-a4'));
 const click=JSON.parse(await page.locator('#designcraft_canvas').getAttribute('data-original-preset-a4'));
 await page.mouse.click(...click);
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-render')==='true',null,{timeout:30000}).catch(async error=>{console.error(JSON.stringify({phase:'file.new-ack',requests,replies,errors,canvas:await page.locator('#designcraft_canvas').evaluate(e=>({revision:e.getAttribute('data-server-revision'),render:e.getAttribute('data-server-render')}))}));throw error;});
 assert.equal(requests.length,1);assert.equal(requests[0].method,'file.new');assert.equal(requests[0].params.preset,'A4');
 assert.equal(replies[0]?.result?.commandId,'file.new');assert.equal(replies[0]?.stateVersion,1);
 const revision=await page.locator('#designcraft_canvas').getAttribute('data-server-revision');assert.equal(revision,'1');
 const preview=await fetch(base+replies[0].preview);assert.equal(preview.headers.get('content-type'),'image/png');
 const png=Buffer.from(await preview.arrayBuffer());assert.equal(png.readUInt32BE(16),595);assert.equal(png.readUInt32BE(20),842);
 // Use the original M shortcut and original Rectangle Tool pointer workflow. Only its committed
 // frame.create is sent to the server; local document state must remain unchanged until ACK.
 const beforeSnapshot=createHash('sha256').update(JSON.stringify(replies[0].documentSnapshot)).digest('hex');
 await page.mouse.click(500,300);await page.keyboard.press('m');
 await page.mouse.move(410,300);await page.mouse.down();await page.mouse.move(560,460,{steps:5});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#designcraft_canvas')?.getAttribute('data-server-revision')==='2',null,{timeout:30000}).catch(async error=>{console.error(JSON.stringify({phase:'frame.create-ack',requests,replies,errors,canvas:await page.locator('#designcraft_canvas').evaluate(e=>({revision:e.getAttribute('data-server-revision'),render:e.getAttribute('data-server-render')}))}));throw error;});
 assert.equal(requests.length,2);assert.equal(requests[1].method,'frame.create');assert.equal(requests[1].expectedVersion,1);
 assert.ok(Array.isArray(requests[1].params.rect));assert.equal(replies[1]?.result?.commandId,'frame.create');assert.equal(replies[1]?.stateVersion,2);
 assert.equal(replies[1]?.document?.dirty,true);
 assert.notEqual(createHash('sha256').update(JSON.stringify(replies[1].documentSnapshot)).digest('hex'),beforeSnapshot);
 assert.equal(await page.locator('#designcraft_canvas').getAttribute('data-server-render'),'true');
 const nextPreview=await fetch(base+replies[1].preview);assert.equal(nextPreview.headers.get('content-type'),'image/png');
 const nextPng=Buffer.from(await nextPreview.arrayBuffer());
 assert.notEqual(createHash('sha256').update(nextPng).digest('hex'),createHash('sha256').update(png).digest('hex'));
 // Other original commands remain unavailable and cannot advance the server state.
 await page.keyboard.press('Control+z');await page.keyboard.press('Control+n');
 await page.waitForTimeout(500);assert.equal(requests.length,2);
 assert.equal(await page.locator('#designcraft_canvas').getAttribute('data-server-revision'),'2');assert.deepEqual(errors,[]);
 await page.waitForTimeout(1000);
 const screenshot=process.env.CW_PAR03_SCREENSHOT;
 const painted=visibleCanvas(await page.screenshot(screenshot?{path:path.resolve(screenshot)}:{}));
 // A failed preview fetch must leave the UI unhydrated; the server document is retained.
 await fetch(`${base}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({discard:true})});sessionId=null;
 await page.route('**/preview.png?v=*',route=>route.fulfill({status:503,contentType:'text/plain',body:'Injected preview failure'}));
 const requestCount=requests.length;
 await page.goto(base+'/candidate/?webgl',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('#designcraft_loading')&&document.querySelector('#designcraft_canvas')?.hasAttribute('data-original-preset-a4'),null,{timeout:120000});
 const failedClick=JSON.parse(await page.locator('#designcraft_canvas').getAttribute('data-original-preset-a4'));
 await page.mouse.click(...failedClick);
 await page.waitForResponse(response=>response.url().endsWith('/preview.png?v=1')&&response.status()===503);
 await page.waitForTimeout(500);
 assert.equal(requests.length,requestCount+1);
 assert.equal(await page.locator('#designcraft_canvas').getAttribute('data-server-revision'),'0');
 assert.equal(await page.locator('#designcraft_canvas').getAttribute('data-server-render'),'false');
 assert.deepEqual(pageErrors,[]);
 const report={status:'bounded-candidate-browser-proof',originalPresetClick:click,actions:[{commandId:'file.new',preset:'A4',stateVersion:1},{commandId:'frame.create',source:'original Rectangle Tool M shortcut + pointer drag',expectedVersion:1,stateVersion:2,dirty:true,serverSnapshotRefreshed:true,serverRenderChanged:true}],canonicalSnapshotBytes:Buffer.byteLength(JSON.stringify(replies[1].documentSnapshot)),serverPngDimensions:[595,842],serverPngSha256:createHash('sha256').update(nextPng).digest('hex'),originalCanvasServerTexture:true,visibleCanvas:painted,unbridgedCommandsBlocked:true,uncaughtBrowserErrors:[],previewFailureLeavesMirrorUnhydrated:true,availability:'planned; provider/save/reopen/recovery/full parity pending'};
 if(process.env.CW_PAR03_REPORT)await writeFile(path.resolve(process.env.CW_PAR03_REPORT),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{
 if(sessionId)await fetch(`http://127.0.0.1:${server.address().port}/api/designcraft/sessions/${sessionId}`,{method:'DELETE',headers:{Origin:`http://127.0.0.1:${server.address().port}`,'Content-Type':'application/json'},body:JSON.stringify({discard:true})}).catch(()=>{});
 await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
}
