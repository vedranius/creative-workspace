import path from 'node:path';
import {access,mkdir,realpath,stat,rm,open,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {randomBytes} from 'node:crypto';
import {EngineProcess} from './photocraft.js';
import {resolveWorkspace,isWithin} from './storage.js';
import {importSegments,receiveFile} from './transfers.js';

const nativeMethods=new Set(['__cw_identity','new','open','state','render','command','export','mark_saved']);
const methods=new Set(['state','heartbeat','doc.new','doc.open','doc.save','page.select','frame.create','select.set','select.all','select.none','transform.move','transform.resize','object.fill','object.stroke','swatch.create','story.setText','type.char','edit.clear','edit.undo','edit.redo']);
const fail=(message,status=400,code)=>Object.assign(new Error(message),{status,...(code?{code}:{})});
const relative=value=>{try{importSegments(value);return value;}catch{throw fail('Use a relative path inside this application workspace');}};
const number=(value,min,max,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw fail(`Invalid ${label}`);return value;};
const ids=value=>{if(!Array.isArray(value)||value.length>200||value.some(id=>!Number.isSafeInteger(id)||id<0))throw fail('Choose up to 200 object IDs');return value;};

// Do not forward arbitrary engine parameters: some native commands accept filesystem paths.
function commandParams(method,p){
  if(method==='frame.create'){if(!Array.isArray(p.rect)||p.rect.length!==4)throw fail('A frame needs four coordinates');const rect=p.rect.map(v=>number(v,-100000,100000,'frame coordinate'));if(rect[2]<=rect[0]||rect[3]<=rect[1])throw fail('Frame width and height must be positive');if(!['text','unassigned'].includes(p.content)||!['rectangle','ellipse'].includes(p.shape||'rectangle'))throw fail('Choose a text or shape frame');if(p.text!==undefined&&(typeof p.text!=='string'||p.text.length>20000))throw fail('Text exceeds 20,000 characters');return {rect,shape:p.shape||'rectangle',content:p.content,...(p.content==='text'?{text:p.text||''}:{}),caret:false};}
  if(method==='select.set')return {ids:ids(p.ids)};
  if(method==='story.setText'){if(!Number.isSafeInteger(p.story)||p.story<0||typeof p.text!=='string'||p.text.length>20000)throw fail('Choose a story and text up to 20,000 characters');return {story:p.story,text:p.text};}
  if(method==='swatch.create'){if(typeof p.color!=='string'||!/^#[0-9a-f]{6}$/i.test(p.color))throw fail('Use a six-digit hex colour');return {name:`CW ${p.color.toUpperCase()}`,color:p.color};}
  if(method==='object.fill'||method==='object.stroke'){if(typeof p.swatch!=='string'||p.swatch.length>100)throw fail('Choose a swatch');return {swatch:p.swatch,...(method==='object.stroke'?{weight:number(p.weight,0,100,'stroke width')}:{}),...(p.ids===undefined?{}:{ids:ids(p.ids)})};}
  if(method==='transform.move')return {dx:number(p.dx,-100000,100000,'horizontal offset'),dy:number(p.dy,-100000,100000,'vertical offset')};
  if(method==='transform.resize'){const rect=key=>{if(!Array.isArray(p[key])||p[key].length!==4)throw fail('Resize needs source and destination rectangles');const v=p[key].map(x=>number(x,-100000,100000,'resize coordinate'));if(v[2]<=v[0]||v[3]<=v[1])throw fail('Resize dimensions must be positive');return v;};return {from:rect('from'),to:rect('to'),content:false};}
  if(method==='type.char'){const attrs={size:number(p.size,1,500,'type size')};if(p.fontFamily!==undefined){if(typeof p.fontFamily!=='string'||p.fontFamily.length>100)throw fail('Choose a font family');attrs.fontFamily=p.fontFamily;}return {attrs};}
  return {};
}
async function destination(root,target){const parts=importSegments(target),base=await realpath(root);let parent=base;for(const name of parts.slice(0,-1)){await mkdir(path.join(parent,name)).catch(e=>{if(e.code!=='EEXIST')throw e;});parent=await realpath(path.join(parent,name));if(!isWithin(base,parent))throw fail('Output folder is outside the workspace',403);}return path.join(parent,parts.at(-1));}

export function createDesignCraft({binary=process.env.CW_DESIGNCRAFT_BINARY||path.resolve('data/engines/designcraft/build/release/cw-designcraft-engine'),stateDir=path.resolve('data/engines/designcraft/sessions'),maxSessions=4,maxFileBytes=64*1024*1024,settleOutput=async()=>{},processFactory=(file,read,write)=>new EngineProcess(file,read,{args:[read,write],configDir:write,allowedMethods:nativeMethods,engineName:'DesignCraft'})}={}){
  const sessions=new Map();let creating=0,probe=null,cached=null;
  async function identity(root){const engine=processFactory(binary,root,root);try{const value=await engine.call('__cw_identity');if(value.runtimeId!=='creative-workspace-designcraft-v1')throw fail('This is not a workspace-owned DesignCraft engine',503);return value;}finally{engine.stop();}}
  async function status(){
    if(cached&&Date.now()-cached.at<10000)return {...cached.value,sessions:sessions.size};if(probe)return probe;
    probe=(async()=>{let value;try{await access(binary);const root=path.join(stateDir,'probe');await mkdir(root,{recursive:true});const owned=await identity(root);value={ready:true,url:'/apps/designcraft/',version:owned.version,ownedRuntime:true,processing:'server',adapter:'native-browser-prototype',maxSessions};}catch{value={ready:false,message:'Install the workspace-owned DesignCraft engine',processing:'server'};}cached={at:Date.now(),value};return {...value,sessions:sessions.size};})().finally(()=>{probe=null;});return probe;
  }
  async function create(root,{writeRoot=root,shareId=null,laptopOutput=false}={}){
    if(!(await status()).ready)throw fail('DesignCraft engine is not installed',503);if(sessions.size+creating>=maxSessions)throw fail('DesignCraft session limit reached; close an unused session',409);creating++;
    let engine,privateRoot;
    try{const id=randomBytes(24).toString('hex');privateRoot=path.join(stateDir,id,'outputs');await mkdir(privateRoot,{recursive:true});const read=await realpath(root),write=await realpath(writeRoot);engine=processFactory(binary,read,privateRoot);const owned=await engine.call('__cw_identity');if(owned.runtimeId!=='creative-workspace-designcraft-v1')throw fail('Unexpected DesignCraft engine',503);
      sessions.set(id,{id,root:read,writeRoot:write,privateRoot,engine,shareId,laptopOutput,queue:Promise.resolve(),requests:new Map(),version:0,page:0,name:null,outputs:new Set(),frames:new Map(),previewVersion:0,lastUsed:Date.now(),dirty:false});return {id,shareId,processing:'server',source:shareId?'laptop':'server'};
    }catch(e){engine?.stop();if(privateRoot)await rm(path.dirname(privateRoot),{recursive:true,force:true}).catch(()=>{});throw e;}finally{creating--;}
  }
  const get=id=>{const s=sessions.get(id);if(!s||s.engine.closed)throw fail('DesignCraft session is not available',404);if(s.closing)throw fail('DesignCraft session is closing',409);s.lastUsed=Date.now();return s;};
  async function snapshot(s){
    const document=await s.engine.call('state');let preview=null;
    s.dirty=document?.dirty||false;
    if(document){document.name=s.name||document.title;s.page=Math.max(0,Math.min(s.page,(document.pageCount||1)-1));const frame=await s.engine.call('render',{page:s.page});s.frames.set(++s.previewVersion,Buffer.from(frame.pngBase64,'base64'));while(s.frames.size>3)s.frames.delete(s.frames.keys().next().value);preview=`/api/designcraft/sessions/${s.id}/preview.png?v=${s.previewVersion}`;}
    return {document,page:s.page,stateVersion:s.version,preview};
  }
  async function execute(id,{method,params={},requestId,expectedVersion}={}){
    const s=get(id);if(!methods.has(method))throw fail('Unsupported DesignCraft method');if(typeof requestId!=='string'||requestId.length<8||requestId.length>100)throw fail('A unique requestId is required');if(params===null||typeof params!=='object'||Array.isArray(params))throw fail('Params must be an object');if(expectedVersion!==undefined&&(!Number.isSafeInteger(expectedVersion)||expectedVersion<0))throw fail('Invalid expectedVersion');
    const signature=JSON.stringify({method,params,expectedVersion}),old=s.requests.get(requestId);if(old){if(old.signature!==signature)throw fail('requestId was already used for a different operation',409);return old.task;}if([...s.requests.values()].filter(r=>r.pending).length>=32)throw fail('Too many queued operations',429);
    const task=s.queue.then(async()=>{
      if(expectedVersion!==undefined&&expectedVersion!==s.version)throw fail('Document changed. Refresh its state before applying this operation.',409,'STATE_VERSION_CONFLICT');
      if(method==='heartbeat')return {alive:true};if(method==='state')return snapshot(s);let result={};
      if(method==='doc.open'||method==='doc.new'){
        if(await s.engine.call('state'))throw fail('Save and close the current document before opening another',409);
        if(method==='doc.open'){const input=relative(params.path);if(!/\.designcraft$/i.test(input))throw fail('Choose a native .designcraft document');const file=await resolveWorkspace(s.root,input),info=await stat(file);if(!info.isFile()||info.size>maxFileBytes)throw fail('Document exceeds the 64 MB prototype limit',413);s.version++;result=await s.engine.call('open',{path:file});s.name=path.basename(input);}
        else{const width=number(params.width,1,10000,'width'),height=number(params.height,1,10000,'height');if(!Number.isInteger(params.pages))throw fail('Page count must be an integer');s.version++;s.dirty=true;result=await s.engine.call('new',{title:typeof params.name==='string'?params.name.slice(0,100):'Untitled',width,height,pages:number(params.pages,1,64,'page count'),facingPages:false});s.name=typeof params.name==='string'?params.name.slice(0,100):'Untitled';}
      }else{
        if(!(await s.engine.call('state')))throw fail('Open a publication first');
        if(method==='page.select'){if(!Number.isSafeInteger(params.index)||params.index<0)throw fail('Invalid page');const doc=await s.engine.call('state');if(params.index>=doc.pageCount)throw fail('Unknown page');s.version++;s.page=params.index;}
        else if(method==='doc.save'){
          const target=relative(params.path),format=path.extname(target).slice(1).toLowerCase();if(!['designcraft','pdf','png'].includes(format))throw fail('Choose .designcraft, .pdf or .png');s.version++;
          const exportRoot=path.join(s.privateRoot,randomBytes(12).toString('hex'));await mkdir(exportRoot);const source=path.join(exportRoot,`document.${format}`);
          const doc=await s.engine.call('state'),board=doc.spreads.flatMap(sp=>sp.pages).find(p=>p.index===s.page);
          result=await s.engine.call('export',{path:source,format,...(format==='png'?{page:s.page,scale:Math.min(1,2048/Math.max(board.bounds[2]-board.bounds[0],board.bounds[3]-board.bounds[1]))}:{})});const size=(await stat(source)).size;if(size>maxFileBytes)throw fail('Export exceeds the 64 MB prototype limit',413);
          if((await readdir(exportRoot)).length!==1)throw fail('This export needs additional asset files. Save a native .designcraft copy; packaged multi-file exports are not supported yet.',422);
          if(s.laptopOutput){const targetFile=await destination(s.writeRoot,target);let handle;try{handle=await open(targetFile,'wx');await pipeline(createReadStream(source),handle.createWriteStream());}catch(e){if(e.code==='EEXIST')throw fail('Choose a new filename; this output already exists',409,'OUTPUT_EXISTS');throw e;}finally{await handle?.close().catch(()=>{});}await settleOutput(s.shareId,target);}
          else await receiveFile(createReadStream(source),s.writeRoot,target,maxFileBytes);
          s.outputs.add(target);if(format==='designcraft'){await s.engine.call('mark_saved');s.name=path.basename(target);}result={path:target,bytes:size,format,warnings:result.warnings||[],savedDocument:format==='designcraft'};await rm(exportRoot,{recursive:true,force:true}).catch(()=>{});
        }else{const args=commandParams(method,params);if(method==='frame.create'){const doc=await s.engine.call('state'),spread=doc.spreads.find(sp=>sp.pages.some(p=>p.index===s.page)),page=spread.pages.find(p=>p.index===s.page);args.spread=spread.index;args.rect=[args.rect[0]+page.bounds[0],args.rect[1],args.rect[2]+page.bounds[0],args.rect[3]];}s.version++;if(!method.startsWith('select.'))s.dirty=true;result=await s.engine.call('command',{command:({'select.set':'selection.set','select.all':'edit.selectAll','select.none':'edit.deselectAll'})[method]||method,params:args});}
      }
      return {result,...await snapshot(s)};
    });s.queue=task.catch(()=>{});const entry={signature,task,pending:true};s.requests.set(requestId,entry);task.finally(()=>{entry.pending=false;s.lastUsed=Date.now();}).catch(()=>{});if(s.requests.size>100)for(const [key,value]of s.requests){if(!value.pending)s.requests.delete(key);if(s.requests.size<=100)break;}return task;
  }
  function preview(id,version){const frame=get(id).frames.get(Number(version));if(!frame)throw fail('Preview is no longer available',410);return frame;}
  async function close(id,{discard=false}={}){const s=get(id);s.closing=true;try{await s.queue;if(s.dirty&&discard!==true)throw fail('Save the native DesignCraft document before closing it',409);s.engine.stop();sessions.delete(id);await rm(path.dirname(s.privateRoot),{recursive:true,force:true});return {closed:true};}finally{s.closing=false;}}
  async function output(id,name){const s=get(id);if(!s.outputs.has(name))throw fail('This file was not exported by this session',403);return resolveWorkspace(s.writeRoot,name);}
  const idle=setInterval(()=>{for(const [id,s]of sessions)if(!s.dirty&&![...s.requests.values()].some(r=>r.pending)&&Date.now()-s.lastUsed>3600000)close(id).catch(()=>{});},60000);idle.unref();
  return {status,create,execute,preview,close,output,describe:id=>{const s=get(id);return {readRoot:s.root,writeRoot:s.writeRoot,shareId:s.shareId,laptopOutput:s.laptopOutput};},usesShare:id=>[...sessions.values()].some(s=>s.shareId===id&&!s.engine.closed),shutdown:()=>{clearInterval(idle);for(const s of sessions.values())s.engine.stop();sessions.clear();}};
}
