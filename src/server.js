import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,realpath,stat,mkdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {timingSafeEqual} from 'node:crypto';
import {catalog} from './catalog.js';
import {readState,writeState,isWithin,listFiles,resolveWorkspace} from './storage.js';
import {receiveFile,importSegments} from './transfers.js';
import {checkRelease} from './updates.js';
import {createRapidRaw} from './rapidraw.js';
import {createPhotoCraft} from './photocraft.js';
import {createStorageProvider} from './storage-provider.js';

const base=path.dirname(fileURLToPath(import.meta.url));
const publicRoot=path.join(base,'../public');
function error(message,status=400){return Object.assign(new Error(message),{status});}
async function body(req,limit=16384){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>limit)throw error('Request too large',413);}try{return JSON.parse(data||'{}');}catch{throw error('Invalid JSON');}}
function secretEquals(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}

export async function createWorkspaceServer({dataDir=process.env.DATA_DIR||path.join(base,'../data'),allowedRoots=(process.env.WORKSPACE_ROOTS||path.join(base,'../workspaces')).split(path.delimiter),auth=process.env.WORKSPACE_AUTH,fetcher=fetch,rapidrawUrl,photocraftOptions={},maxUploadBytes=Number(process.env.MAX_UPLOAD_BYTES||2147483648)}={}){
  if(!Number.isSafeInteger(maxUploadBytes)||maxUploadBytes<=0)throw new Error('Invalid MAX_UPLOAD_BYTES');
  let state=await readState(dataDir);
  const rapidraw=createRapidRaw({url:rapidrawUrl});
  const photocraft=createPhotoCraft({binary:process.env.CW_PHOTOCRAFT_BINARY||path.join(dataDir,'engines/photocraft/build/release/photocraft-cli'+(process.platform==='win32'?'.exe':'')),stateDir:path.join(dataDir,'engines/photocraft/sessions'),...photocraftOptions});
  let queue=Promise.resolve();
  let updateInProgress=null;
  const mutate=(operation)=>{const next=queue.then(operation);queue=next.catch(()=>{});return next;};
  async function permittedRoot(value){
    if(typeof value!=='string'||!path.isAbsolute(value))throw error('Use an absolute server directory');
    const root=await realpath(value).catch(()=>{throw error('Directory does not exist');});
    if(!(await stat(root)).isDirectory())throw error('Workspace must be a directory');
    for(const candidate of allowedRoots){try{if(isWithin(await realpath(candidate),root))return root;}catch{}}
    throw error('Directory is outside WORKSPACE_ROOTS',403);
  }
  async function appWorkspace(app){
    if(!catalog.some(item=>item.id===app))throw error('Unknown application',404);
    await mutate(async()=>{if(state.apps[app]?.workspace)return;await mkdir(allowedRoots[0],{recursive:true});const root=path.join(await realpath(allowedRoots[0]),app);await mkdir(root,{recursive:true});state.apps[app]={workspace:await permittedRoot(root)};await writeState(dataDir,state);});
    return permittedRoot(state.apps[app].workspace);
  }
  const storage=await createStorageProvider({dataDir,maxUploadBytes,fuseBin:process.env.CW_FUSE_BINARY||path.join(dataDir,'engines/storage/build/release/cw-filesystem-helper'+(process.platform==='win32'?'.exe':'')),resolveAppRoot:appWorkspace});
  async function checkAll(){
    if(updateInProgress)return updateInProgress;
    updateInProgress=(async()=>{
      for(const app of catalog){
        let update;
        try{update=await checkRelease(app.repo,{fetcher});}
        catch(e){update={status:'error',message:e.message,checkedAt:new Date().toISOString()};}
        await mutate(async()=>{state.updates[app.id]=update;await writeState(dataDir,state);});
      }
      return state.updates;
    })().finally(()=>{updateInProgress=null;});
    return updateInProgress;
  }
  const server=http.createServer(async(req,res)=>{
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try{
      if(auth&&!secretEquals(req.headers.authorization||'',`Basic ${Buffer.from(auth).toString('base64')}`)){res.setHeader('WWW-Authenticate','Basic realm="Creative Workspace"');return json({error:'Authentication required'},401);}
      const url=new URL(req.url,'http://localhost');
      if(rapidraw.handles(url.pathname)){
        if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host))throw error('Origin mismatch',403);
        if(!(await rapidraw.status()).ready)throw error('Workspace-owned RapidRAW engine is not running',503);
        rapidraw.proxy(req,res);return;
      }
      if(!['GET','HEAD'].includes(req.method)){
        if(req.headers['sec-fetch-site']==='cross-site')throw error('Cross-site request rejected',403);
        if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw error('Origin mismatch',403);
        const binary=['/api/files/upload','/api/storage/put'].includes(url.pathname)&&req.method==='PUT';
        if(binary?req.headers['content-type']!=='application/octet-stream':!req.headers['content-type']?.startsWith('application/json'))throw error('Unsupported content type',415);
      }
      if(url.pathname==='/api/health'&&req.method==='GET')return json({status:'ok',version:'0.1.0'});
      if(url.pathname==='/api/engines/rapidraw'&&req.method==='GET')return json(await rapidraw.status());
      if(url.pathname==='/api/engines/photocraft'&&req.method==='GET')return json(await photocraft.status());
      if(url.pathname==='/api/storage/capabilities'&&req.method==='GET')return json(storage.capabilities());
      if(url.pathname==='/api/storage/shares'&&req.method==='GET')return json(storage.list());
      if(url.pathname==='/api/storage/shares'&&req.method==='POST')return json(await storage.start(await body(req)),201);
      if(url.pathname==='/api/storage/recovery'&&req.method==='GET')return json(await storage.recovery.list(url.searchParams.get('app')));
      const recoveryOutput=url.pathname.match(/^\/api\/storage\/recovery\/([a-f0-9]{16}-[a-f0-9]{64})\/output$/);
      if(recoveryOutput&&req.method==='GET'){
        const file=await storage.recovery.output(recoveryOutput[1],url.searchParams.get('app'));
        try{res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':file.size,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'no-store'});await pipeline(file.handle.createReadStream(),res);}
        finally{await file.handle.close();}return;
      }
      if(url.pathname==='/api/storage/put'&&req.method==='PUT'){if(Number(req.headers['content-length']||0)>maxUploadBytes)throw error('File exceeds upload limit',413);await storage.put(req,res,url);return;}
      const shareMatch=url.pathname.match(/^\/api\/storage\/shares\/([a-z0-9]{6,16})(?:\/(have|files))?$/);
      if(shareMatch){
        if(req.method==='GET'&&shareMatch[2]==='have')return json(await storage.have(shareMatch[1]));
        if(req.method==='GET'&&shareMatch[2]==='files'){const share=storage.source(shareMatch[1],url.searchParams.get('app'));return json(await listFiles(share.view,url.searchParams.get('path')||''));}
        if(req.method==='DELETE'&&!shareMatch[2]){await body(req);if(photocraft.usesShare(shareMatch[1]))throw error('Close the editing sessions using this folder before stopping it',409);return json(await storage.stop(shareMatch[1]));}
        throw error('Method not allowed',405);
      }
      if(url.pathname==='/api/photocraft/sessions'&&req.method==='POST'){
        const input=await body(req);const serverRoot=await appWorkspace('photocraft');
        if(input.sourceShareId){const share=storage.source(input.sourceShareId,'photocraft');const laptop=input.saveDestination==='laptop';if(laptop&&(share.access!=='readwrite'||share.mode!=='ondemand'))throw error('Laptop saving requires an on-demand folder with write permission',403);return json(await photocraft.create(share.view,{writeRoot:laptop?share.view:serverRoot,shareId:share.id}),201);}
        return json(await photocraft.create(serverRoot),201);
      }
      const photoSession=url.pathname.match(/^\/api\/photocraft\/sessions\/([a-f0-9]{48})(?:\/(rpc|preview.png|output))?$/);
      if(photoSession){
        if(req.method==='POST'&&photoSession[2]==='rpc'){
          const input=await body(req,65536);const foreground=!['state','heartbeat','engine.commands','doc.inspect','session.list'].includes(input.method);
          if(foreground){storage.activity.touch();storage.activity.loading(input.requestId);}
          const detail=photocraft.describe(photoSession[1]);
          if(detail.shareId&&(input.method==='doc.open'||input.method==='doc.save'&&detail.readRoot===detail.writeRoot)){try{storage.source(detail.shareId,'photocraft');}catch{if(foreground)storage.activity.loaded(input.requestId);throw error('The laptop folder is offline. Reconnect it before opening or saving files.',503);}}
          if(input.method==='doc.open'&&detail.shareId&&typeof input.params?.path==='string')storage.focus(path.join(detail.readRoot,input.params.path));
          try{const result=await photocraft.execute(photoSession[1],input);if(input.method==='doc.save'&&detail.shareId&&detail.readRoot===detail.writeRoot&&input.params?.path)await storage.settle(detail.shareId,input.params.path);return json(result);}
          finally{if(foreground)storage.activity.loaded(input.requestId);}
        }
        if(req.method==='DELETE'&&!photoSession[2]){await body(req);return json(photocraft.close(photoSession[1]));}
        if(req.method==='GET'&&photoSession[2]==='preview.png'){const png=photocraft.preview(photoSession[1],url.searchParams.has('v')?url.searchParams.get('v'):undefined);res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.end(png);return;}
        if(req.method==='GET'&&photoSession[2]==='output'){const file=await photocraft.output(photoSession[1],url.searchParams.get('path'));const info=await stat(file);if(!info.isFile())throw error('Output is not a file');res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':info.size,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`,'Cache-Control':'no-store'});await pipeline(createReadStream(file),res);return;}
        throw error('Method not allowed',405);
      }
      if(url.pathname==='/api/apps'&&req.method==='GET')return json(catalog.map(app=>({...app,configuration:state.apps[app.id]||{},update:state.updates[app.id]||{status:'unchecked'}})));
      if(url.pathname==='/api/settings'&&req.method==='GET')return json({allowedRoots,authentication:!!auth,mode:'single-user',updateIntervalHours:24,maxUploadBytes});
      if(url.pathname==='/api/imports/prepare'&&req.method==='POST'){
        const input=await body(req);
        if(!catalog.some(app=>app.id===input.app))throw error('Unknown application',404);
        await mutate(async()=>{
          if(state.apps[input.app]?.workspace)return;
          await mkdir(allowedRoots[0],{recursive:true});
          const baseRoot=await realpath(allowedRoots[0]);
          const folder=path.join(baseRoot,input.app);
          await mkdir(folder,{recursive:true});
          const workspace=await permittedRoot(folder);
          state.apps[input.app]={workspace};await writeState(dataDir,state);
        });
        return json({workspace:state.apps[input.app].workspace});
      }
      if(url.pathname==='/api/files/upload'&&req.method==='PUT'){
        const configuration=state.apps[url.searchParams.get('app')];
        if(!configuration?.workspace)throw error('Set an application workspace first');
        const relative=url.searchParams.get('path');importSegments(relative);
        if(Number(req.headers['content-length']||0)>maxUploadBytes)throw error('File exceeds upload limit',413);
        const root=await permittedRoot(configuration.workspace);
        return json(await receiveFile(req,root,relative,maxUploadBytes),201);
      }
      if(url.pathname==='/api/files/download'&&req.method==='GET'){
        const configuration=state.apps[url.searchParams.get('app')];
        if(!configuration?.workspace)throw error('Set an application workspace first');
        const root=await permittedRoot(configuration.workspace);
        const file=await resolveWorkspace(root,url.searchParams.get('path')||'');
        const info=await stat(file);if(!info.isFile())throw error('Select a file');
        res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':info.size,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`,'Cache-Control':'no-store'});
        await pipeline(createReadStream(file),res);return;
      }
      if(url.pathname==='/api/updates/check'&&req.method==='POST'){await body(req);checkAll().catch(()=>{});return json({status:'checking'},202);}
      const match=url.pathname.match(/^\/api\/apps\/([a-z]+)\/workspace$/);
      if(match&&req.method==='PUT'){
        if(!catalog.some(app=>app.id===match[1]))throw error('Unknown application',404);
        const input=await body(req);const root=await permittedRoot(input.root);
        await mutate(async()=>{state.apps[match[1]]={...state.apps[match[1]],workspace:root};await writeState(dataDir,state);});
        return json(state.apps[match[1]]);
      }
      if(url.pathname==='/api/files'&&req.method==='GET'){
        const configuration=state.apps[url.searchParams.get('app')];
        if(!configuration?.workspace)throw error('Set an application workspace first');
        const root=await permittedRoot(configuration.workspace);
        return json(await listFiles(root,url.searchParams.get('path')||''));
      }
      if(url.pathname.startsWith('/api/'))throw error('Endpoint not found',404);
      if(req.method!=='GET'&&req.method!=='HEAD')throw error('Method not allowed',405);
      const assets={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/apps/photocraft/':'photocraft/index.html','/apps/photocraft/app.js':'photocraft/app.js','/apps/photocraft/style.css':'photocraft/style.css','/storage/agent.js':'storage/agent.js','/storage/folders.js':'storage/folders.js'};
      if(!assets[url.pathname])throw error('Not found',404);
      const buffer=await readFile(path.join(publicRoot,assets[url.pathname]));
      const type=url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html';
      res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:buffer);
    }catch(e){if(res.headersSent){res.destroy();return;}req.resume();json({error:e.status?e.message:'Operation failed; check the directory and server configuration'},e.status||400);}
  });
  server.on('listening',()=>storage.sweep());
  server.on('upgrade',async(req,socket,head)=>{
    try{
      if(auth&&!secretEquals(req.headers.authorization||'',`Basic ${Buffer.from(auth).toString('base64')}`))throw new Error('Unauthorized');
      if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)throw new Error('Origin mismatch');
      if(new URL(req.url,'http://localhost').pathname==='/storage/agent'){storage.upgrade(req,socket,head);return;}
      if(!(await rapidraw.status()).ready)throw new Error('Owned engine not running');
      rapidraw.upgrade(req,socket,head);
    }catch{socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');}
  });
  server.requestTimeout=60*60*1000;
  // Scheduled checks run inside the self-hosted service, not in a hosted automation.
  const timer=setInterval(()=>checkAll().catch(()=>{}),24*60*60*1000);timer.unref();
  server.on('close',()=>{clearInterval(timer);photocraft.shutdown();storage.shutdown().catch(()=>{});});
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const host=process.env.HOST||'127.0.0.1';
  if(!['127.0.0.1','localhost','::1'].includes(host)&&!process.env.WORKSPACE_AUTH){console.error('Set WORKSPACE_AUTH before binding beyond loopback.');process.exit(1);}
  const server=await createWorkspaceServer();
  server.listen(Number(process.env.PORT||8788),host,()=>console.log(`Creative Workspace: http://${host}:${server.address().port}`));
  let stopping=false;
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(stopping)return;stopping=true;server.close();server.closeAllConnections();setTimeout(()=>process.exit(0),10000).unref();});
}
