import {spawn} from 'node:child_process';
import {access,lstat,realpath,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {importSegments} from './transfers.js';
import {resolveWorkspace} from './storage.js';

const methods=new Set(['doc.open','doc.new','doc.save','doc.inspect','doc.render','engine.execute','engine.commands','session.list','doc.select','doc.close','jobs.list','jobs.cancel']);
const failure=(message,status=400)=>Object.assign(new Error(message),{status});

export class EngineProcess {
  constructor(binary,root,{spawnProcess=spawn,timeout=120000,configDir=path.resolve('data/engines/photocraft/config'),writeRoot=root}={}){
    this.next=0;this.pending=new Map();this.buffer='';this.closed=false;this.timeout=timeout;this.logs='';
    this.child=spawnProcess(binary,['serve','--automation-read-root',root,'--automation-write-root',writeRoot],{stdio:['pipe','pipe','pipe'],env:{...process.env,XDG_CONFIG_HOME:configDir,XDG_DATA_HOME:configDir,XDG_CACHE_HOME:configDir}});
    this.child.stdout.setEncoding('utf8');this.child.stdout.on('data',data=>this.receive(data));
    this.child.stderr.on('data',data=>{this.logs=(this.logs+data).slice(-4096);});
    this.child.on('error',()=>this.stop('PhotoCraft process could not start'));
    this.child.on('exit',()=>this.stop('PhotoCraft engine stopped'));
    this.child.stdin.on('error',()=>this.stop('PhotoCraft command pipe disconnected'));
  }
  receive(data){
    this.buffer+=data;if(this.buffer.length>48*1024*1024){this.stop('Engine reply exceeded the limit');return;}
    let newline;
    while((newline=this.buffer.indexOf('\n'))!==-1){const line=this.buffer.slice(0,newline);this.buffer=this.buffer.slice(newline+1);let reply;try{reply=JSON.parse(line);}catch{this.stop('Invalid PhotoCraft engine reply');return;}const job=this.pending.get(reply.id);if(!job)continue;this.pending.delete(reply.id);clearTimeout(job.timer);reply.ok?job.resolve(reply.result):job.reject(failure(String(reply.error||'Engine command failed')));}
  }
  call(method,params={}){
    if(this.closed)return Promise.reject(failure('Engine is unavailable',503));
    if(!methods.has(method))return Promise.reject(failure('Unsupported PhotoCraft method'));
    const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(failure('Operation timed out; session was stopped to avoid ambiguous retries',504));this.stop('Engine timed out');},this.timeout);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(`${JSON.stringify({id,method,params})}\n`);});
  }
  stop(reason='Session closed'){if(this.closed)return;this.closed=true;for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(failure(reason,503));}this.pending.clear();this.child.stdin.end();this.child.kill('SIGTERM');}
}

export function createPhotoCraft({binary=process.env.CW_PHOTOCRAFT_BINARY||path.resolve('data/engines/photocraft/build/release/photocraft-cli'),stateDir=path.resolve('data/engines/photocraft/sessions'),maxSessions=4,processFactory=(...args)=>new EngineProcess(...args)}={}){
  const sessions=new Map();
  let creating=0;
  async function status(){for(const [id,s]of sessions)if(s.engine.closed)sessions.delete(id);try{await access(binary);return {ready:true,url:'/apps/photocraft/',sessions:sessions.size,maxSessions,adapter:'native-browser-prototype',processing:'server'};}catch{return {ready:false,message:'Install the workspace-owned PhotoCraft engine',processing:'server'};}}
  async function create(root,{writeRoot=root,shareId=null}={}){
    if(!(await status()).ready)throw failure('PhotoCraft engine is not installed',503);
    if(sessions.size+creating>=maxSessions)throw failure('PhotoCraft session limit reached; close an unused session',409);
    creating++;
    let reserved=true;
    try{
    const canonical=await realpath(root),writeCanonical=await realpath(writeRoot);const id=randomBytes(24).toString('hex');const configDir=path.join(stateDir,id);await mkdir(configDir,{recursive:true});const engine=processFactory(binary,canonical,{configDir,writeRoot:writeCanonical});
    const session={id,root:canonical,writeRoot:writeCanonical,shareId,outputs:new Set(),engine,queue:Promise.resolve(),preview:null,previewVersion:0,frames:new Map(),lastUsed:Date.now(),requests:new Map()};sessions.set(id,session);creating--;reserved=false;
    try{await engine.call('session.list');}catch(error){sessions.delete(id);engine.stop();throw error;}
    return {id,workspace:canonical,writeWorkspace:writeCanonical,shareId,processing:'server'};
    }finally{if(reserved)creating--;}
  }
  const get=id=>{const session=sessions.get(id);if(!session||session.engine.closed)throw failure('PhotoCraft session is not available',404);session.lastUsed=Date.now();return session;};
  async function snapshot(session){
    const list=await session.engine.call('session.list');let document=null;
    if(list.active!==null&&list.active!==undefined){document=await session.engine.call('doc.inspect');const rendered=await session.engine.call('doc.render',{maxSide:1280});session.preview=Buffer.from(rendered.base64,'base64');session.frames.set(++session.previewVersion,session.preview);while(session.frames.size>3)session.frames.delete(session.frames.keys().next().value);}
    else session.preview=null;
    return {session:list,document,preview:session.preview?`/api/photocraft/sessions/${session.id}/preview.png?revision=${document?.revision||0}&v=${session.previewVersion}`:null};
  }
  async function execute(id,{method,params={},requestId}={}){
    const session=get(id);if(!methods.has(method)&&!['state','heartbeat'].includes(method))throw failure('Unsupported PhotoCraft method');
    if(typeof requestId!=='string'||requestId.length<8||requestId.length>100)throw failure('A unique requestId is required');
    const signature=JSON.stringify({method,params});
    if(session.requests.has(requestId)){const previous=session.requests.get(requestId);if(previous.signature!==signature)throw failure('requestId was already used for a different operation',409);return previous.task;}
    if([...session.requests.values()].filter(item=>item.pending).length>=32)throw failure('Too many queued operations',429);
    if(params===null||typeof params!=='object'||Array.isArray(params))throw failure('Params must be an object');
    if(['doc.open','doc.save'].includes(method)&&params.path!==undefined){try{importSegments(params.path);}catch{throw failure('Use a relative path inside this application workspace');}}
    if(method==='doc.render'&&params.path!==undefined)throw failure('Preview output paths are managed by the workspace');
    const task=session.queue.then(async()=>{
      if(method==='state')return snapshot(session);
      if(method==='heartbeat')return {alive:true};
      if(method==='engine.commands')return {result:await session.engine.call(method,params)};
      const nativeParams={...params};
      if(method==='doc.save'&&params.path){
        let exists=false;try{await lstat(path.join(session.writeRoot,params.path));exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
        if(exists&&!params.overwrite){const list=await session.engine.call('session.list');const document=list.documents?.find(item=>item.index===(params.index??list.active));const sameLayered=session.root===session.writeRoot&&/\.(pcraft|psd|psb)$/i.test(params.path)&&document?.path===params.path;if(!sameLayered)throw failure('This file already exists. Confirm replacement or choose another name.',409);}
        delete nativeParams.overwrite;
      }
      const result=await session.engine.call(method,nativeParams);if(method==='doc.save'&&params.path)session.outputs.add(params.path);return {result,...await snapshot(session)};
    });session.queue=task.catch(()=>{});const entry={task,signature,pending:true};session.requests.set(requestId,entry);task.then(()=>{entry.pending=false;},()=>{entry.pending=false;});if(session.requests.size>100)for(const [key,value]of session.requests){if(!value.pending)session.requests.delete(key);if(session.requests.size<=100)break;}return task;
  }
  function preview(id,version){const session=get(id);const image=version===undefined?session.preview:session.frames.get(Number(version));if(!image)throw failure('Preview is no longer available',410);return image;}
  function close(id){const session=sessions.get(id);if(session){session.engine.stop();sessions.delete(id);}return {closed:true};}
  async function output(id,relative){const s=get(id);if(!s.outputs.has(relative))throw failure('This file was not exported by the session',403);return resolveWorkspace(s.writeRoot,relative);}
  function usesShare(id){return [...sessions.values()].some(s=>s.shareId===id&&!s.engine.closed);}
  function describe(id){const s=get(id);return {readRoot:s.root,writeRoot:s.writeRoot,shareId:s.shareId};}
  const idle=setInterval(()=>{for(const [id,s]of sessions)if(Date.now()-s.lastUsed>60*60*1000)close(id);},60000);idle.unref();
  function shutdown(){clearInterval(idle);for(const id of sessions.keys())close(id);}
  return {status,create,execute,preview,close,output,usesShare,describe,shutdown};
}
