import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {WebSocketServer} from 'ws';
import {createWorkspaceFileProvider} from './vendor/storage/provider.js';
import {importSegments} from './transfers.js';

const error=(message,status=400)=>Object.assign(new Error(message),{status});
export async function createStorageProvider({dataDir,fuseBin=process.env.CW_FUSE_BINARY,resolveAppRoot,maxUploadBytes}={}){
  const work=path.join(dataDir,'local-folders');await mkdir(work,{recursive:true});
  const bindings=new Map();
  let creation=Promise.resolve();
  const provider=createWorkspaceFileProvider({work,fuseBin,maxUploadBytes,validName:name=>{if(importSegments(name).length!==1)throw error('Choose a single folder name');},insideRoots:async root=>root});
  const wss=new WebSocketServer({noServer:true,perMessageDeflate:false,maxPayload:16*1024*1024});
  function bound(id,app){const binding=bindings.get(id);if(!binding||app&&binding.app!==app)throw error('Local folder does not belong to this application',404);return binding;}
  function list(){return provider.commands.__rr_share_list().map(share=>({...share,app:bindings.get(share.id)?.app,access:bindings.get(share.id)?.access}));}
  function start(input){const task=creation.then(()=>startShare(input));creation=task.catch(()=>{});return task;}
  async function startShare({app,name,mode='ondemand',fill=false,keep=false,id,access='read'}={}){
    if(bindings.size>=8&&!(id&&bindings.has(id)))throw error('Local folder limit reached; stop an unused share first',409);
    if(!['transfer','ondemand'].includes(mode))throw error('Choose copy or on-demand mode');
    if(!['read','readwrite'].includes(access))throw error('Invalid folder access');
    const root=await resolveAppRoot(app);
    if(id&&bindings.has(id))bound(id,app);
    if(!id||!bindings.has(id))id=randomBytes(8).toString('hex');
    const keepDir=path.join(root,`local-${id}`);if(mode==='transfer'||keep===true)await mkdir(keepDir,{recursive:true});
    const share=await provider.commands.__rr_share_start({id,name,mode,fill:mode==='ondemand'&&fill===true,keep:mode==='transfer'||keep===true,keepDir});
    bindings.set(share.id,{app,root,access});return {...share,app,access};
  }
  function source(id,app){bound(id,app);const share=list().find(item=>item.id===id);if(!share)throw error('Local folder is unavailable',404);if(share.mode==='ondemand'&&!share.online)throw error('Reconnect the laptop folder before opening a document',409);return share;}
  async function stop(id){bound(id);await provider.commands.__rr_share_stop({id});bindings.delete(id);return {stopped:true};}
  async function have(id){bound(id);return provider.commands.__rr_share_have({id});}
  function upgrade(req,socket,head){const id=new URL(req.url,'http://localhost').searchParams.get('id');if(!bindings.has(id)){socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');return;}wss.handleUpgrade(req,socket,head,ws=>provider.attach(ws,id));}
  async function put(req,res,url){bound(url.searchParams.get('id'));const translated=new URL(url);translated.pathname='/rfs/put';await provider.http(req,res,translated);}
  async function shutdown(){for(const client of wss.clients)client.close();await provider.shutdown();wss.close();}
  return {capabilities:()=>provider.capabilities(),start,list,source,stop,have,upgrade,put,activity:provider.activity,settle:(id,relative)=>provider.settle(id,relative),focus:target=>provider.focus(target),sweep:()=>provider.sweep(),shutdown};
}
