import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {createWorkspaceServer} from '../src/server.js';
import {createStorageRecovery} from '../src/storage-recovery.js';
import {originalUiPackageId,originalUiPatches} from '../src/original-ui.js';

const root=path.resolve('build/host-tmp/par03-save-recovery-20261017');
const assets=path.resolve(process.env.CW_DESIGNCRAFT_UI_ASSETS||path.join(root,'assets'));
const data=path.join(root,'browser-runtime','data'),workspaces=path.join(root,'browser-runtime','workspaces');
const binary=path.resolve(process.env.CW_DESIGNCRAFT_BINARY||'build/par03-redo/target/debug/cw-designcraft-engine');
const playwrightPath=process.env.CW_PLAYWRIGHT_MODULE;if(!playwrightPath)throw new Error('Set CW_PLAYWRIGHT_MODULE');
const {chromium}=await import(playwrightPath.startsWith('file:')?playwrightPath:pathToFileURL(path.resolve(playwrightPath)).href);
await rm(path.dirname(data),{recursive:true,force:true});await mkdir(workspaces,{recursive:true});await mkdir(path.join(workspaces,'designcraft'),{recursive:true});
const work=path.join(data,'local-folders'),id='0011223344556677',name='chosen-folder',mirror=path.join(work,'mirror',id,name),relativePath='exports/uncertain.designcraft';
const server=await createWorkspaceServer({dataDir:data,allowedRoots:[workspaces],designcraftOptions:{binary,stateDir:path.join(root,'browser-runtime','sessions')}});
const handlers=server.listeners('request');server.removeAllListeners('request');let sessionId;
server.on('request',async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&!url.pathname.startsWith('/api/')){
    try{
      if(url.pathname==='/storage/folders.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end('export function chooseLocalFolder(options){options.onReady({id:"0011223344556677"});return Promise.resolve();}');return;}
      if(url.pathname==='/storage/recovery.js'||url.pathname==='/storage/recovery.css'){
        const file=path.join('public',url.pathname.slice(1)),bytes=await readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'text/css'});res.end(bytes);return;
      }
      const asset=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));if(asset.split('/').some(part=>!part||part==='.'||part==='..'||part.startsWith('.')))throw new Error('Unsafe candidate asset');
      if(asset==='favicon.ico'){res.writeHead(204);res.end();return;}
      const bytes=await readFile(path.join(assets,asset)),type=asset.endsWith('.html')?'text/html':asset.endsWith('.js')?'text/javascript':asset.endsWith('.wasm')?'application/wasm':'application/octet-stream';
      const hashes=[];if(asset.endsWith('.html'))for(const match of bytes.toString().matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(match[1]))hashes.push(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:`,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});res.end(bytes);return;
    }catch(error){res.writeHead(404);res.end(String(error));return;}
  }
  if(req.method==='POST'&&url.pathname==='/api/designcraft/sessions'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const payload=JSON.parse(Buffer.concat(chunks).toString());delete payload.sourceShareId;
    const fixture=Readable.from([JSON.stringify(payload)]);fixture.method=req.method;fixture.url=req.url;fixture.headers=req.headers;for(const listener of handlers)listener.call(server,fixture,res);return;
  }
  for(const listener of handlers)listener.call(server,req,res);
});
let browser;
try{
  server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});const base=`http://127.0.0.1:${server.address().port}`;
  const api=async(url,method,body)=>{const response=await fetch(base+url,{method,headers:{Origin:base,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.json();if(!response.ok)throw new Error(`${method} ${url}: ${value.error||response.status}`);return value;};
  const opened=await api('/api/designcraft/sessions','POST',{}),nativeSessionId=opened.id;
  await api(`/api/designcraft/sessions/${nativeSessionId}/rpc`,'POST',{method:'file.new',params:{preset:'A4'},requestId:randomUUID()});
  const copied=await api(`/api/designcraft/sessions/${nativeSessionId}/rpc`,'POST',{method:'file.saveACopy',params:{path:relativePath,destination:'server',retention:'workspace'},requestId:randomUUID()});
  assert.equal(copied.result.commandId,'file.saveACopy');assert.equal(copied.result.savedDocument,false);
  const nativeFile=path.join(workspaces,'designcraft',relativePath),retained=await readFile(nativeFile);
  assert.ok(retained.length>0,'owned DesignCraft worker must create the retained native output');
  await mkdir(path.dirname(path.join(mirror,relativePath)),{recursive:true});await writeFile(path.join(mirror,relativePath),retained);
  const journal=createStorageRecovery({work,resolveAppRoot:async()=>path.join(workspaces,'designcraft')});await journal.begin({id,app:'designcraft',name,mirror},relativePath,'unacknowledged');
  browser=await chromium.launch({headless:true,...(process.env.CW_BROWSER_EXECUTABLE?{executablePath:process.env.CW_BROWSER_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',async r=>{if(r.status()>=400)failed.push({status:r.status(),url:r.url()});});
  await page.goto(`${base}/?webgl`,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Check retained DesignCraft outputs'}).waitFor({timeout:120000});
  await page.getByRole('button',{name:'Check retained DesignCraft outputs'}).click();await page.getByRole('dialog',{name:'DesignCraft save recovery'}).waitFor();
  await page.getByText(relativePath,{exact:true}).waitFor();assert.match(await page.locator('.cw-recovery-state').innerText(),/Laptop save not confirmed/);
  const href=await page.getByRole('link',{name:'Download server copy'}).getAttribute('href');assert.equal(href,`/api/storage/recovery/${id}-${createHash('sha256').update(relativePath).digest('hex')}/output?app=designcraft`);
  const response=await fetch(base+href);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),retained);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const wasm=(await readdir(assets)).find(file=>file.endsWith('.wasm'));assert.ok(wasm,'built original UI WASM is present');
  const report={status:'original-designcraft-shared-save-recovery-browser-proof',sourcePin:'a127c6d5c3576972bbd60445f26d893db071eef3',sourcePatch:originalUiPatches.designcraft,uiPackageId:originalUiPackageId('designcraft'),wasmSha256:createHash('sha256').update(await readFile(path.join(assets,wasm))).digest('hex'),workerSha256:createHash('sha256').update(await readFile(binary)).digest('hex'),recoveryRoute:'existing /api/storage/recovery inventory and retained-output download',recordState:'unacknowledged',nativeOutputGeneratedBy:'owned DesignCraft worker file.saveACopy; recovery journal state is a fixture',relativePath,downloadHash:createHash('sha256').update(retained).digest('hex'),permission:'synthetic provider chooser and journal state; does not prove native folder picker permission or laptop write acknowledgement',browserErrors:errors,failedResponses:failed};
  if(process.env.CW_DESIGNCRAFT_RECOVERY_REPORT)await writeFile(path.resolve(process.env.CW_DESIGNCRAFT_RECOVERY_REPORT),JSON.stringify(report,null,2)+'\n');
  if(process.env.CW_DESIGNCRAFT_RECOVERY_SCREENSHOT)await page.screenshot({path:path.resolve(process.env.CW_DESIGNCRAFT_RECOVERY_SCREENSHOT)});
  console.log(JSON.stringify(report));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(path.dirname(data),{recursive:true,force:true});}
