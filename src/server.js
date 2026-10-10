import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,realpath,stat} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {catalog} from './catalog.js';
import {readState,writeState,isWithin,listFiles} from './storage.js';
import {checkRelease} from './updates.js';

const base=path.dirname(fileURLToPath(import.meta.url));
const publicRoot=path.join(base,'../public');
function error(message,status=400){return Object.assign(new Error(message),{status});}
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>16384)throw error('Request too large',413);}try{return JSON.parse(data||'{}');}catch{throw error('Invalid JSON');}}
function secretEquals(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}

export async function createWorkspaceServer({dataDir=process.env.DATA_DIR||path.join(base,'../data'),allowedRoots=(process.env.WORKSPACE_ROOTS||path.join(base,'../workspaces')).split(path.delimiter),auth=process.env.WORKSPACE_AUTH,fetcher=fetch}={}){
  let state=await readState(dataDir);
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
      if(!['GET','HEAD'].includes(req.method)){
        if(req.headers['sec-fetch-site']==='cross-site')throw error('Cross-site request rejected',403);
        if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw error('Origin mismatch',403);
        if(!req.headers['content-type']?.startsWith('application/json'))throw error('JSON content type required',415);
      }
      if(url.pathname==='/api/health'&&req.method==='GET')return json({status:'ok',version:'0.1.0'});
      if(url.pathname==='/api/apps'&&req.method==='GET')return json(catalog.map(app=>({...app,configuration:state.apps[app.id]||{},update:state.updates[app.id]||{status:'unchecked'}})));
      if(url.pathname==='/api/settings'&&req.method==='GET')return json({allowedRoots,authentication:!!auth,mode:'single-user',updateIntervalHours:24});
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
      const assets={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
      if(!assets[url.pathname])throw error('Not found',404);
      const buffer=await readFile(path.join(publicRoot,assets[url.pathname]));
      const type=url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html';
      res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:buffer);
    }catch(e){json({error:e.status?e.message:'Operation failed; check the directory and server configuration'},e.status||400);}
  });
  // Scheduled checks run inside the self-hosted service, not in a hosted automation.
  const timer=setInterval(()=>checkAll().catch(()=>{}),24*60*60*1000);timer.unref();
  server.on('close',()=>clearInterval(timer));
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const host=process.env.HOST||'127.0.0.1';
  if(!['127.0.0.1','localhost','::1'].includes(host)&&!process.env.WORKSPACE_AUTH){console.error('Set WORKSPACE_AUTH before binding beyond loopback.');process.exit(1);}
  const server=await createWorkspaceServer();
  server.listen(Number(process.env.PORT||8788),host,()=>console.log(`Creative Workspace: http://${host}:${server.address().port}`));
}
