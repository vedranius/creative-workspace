import path from 'node:path';
import {access,mkdir,realpath,stat,rm,open,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {randomBytes} from 'node:crypto';
import {EngineProcess} from './photocraft.js';
import {resolveWorkspace,isWithin} from './storage.js';
import {importSegments,receiveFile} from './transfers.js';

const nativeMethods=new Set(['__cw_identity','new','sample','open','state','render','command','export','save_copy','mark_saved']);
const methods=new Set(['state','heartbeat','file.new','file.open','doc.new','doc.sample','doc.open','doc.save','file.saveACopy','page.select','frame.create','select.set','select.all','select.none','transform.move','transform.resize','object.fill','object.stroke','swatch.create','story.setText','type.char','edit.clear','edit.undo','edit.redo']);
const fail=(message,status=400,code)=>Object.assign(new Error(message),{status,...(code?{code}:{})});
const relative=value=>{try{importSegments(value);return value;}catch{throw fail('Use a relative path inside this application workspace');}};
const number=(value,min,max,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw fail(`Invalid ${label}`);return value;};
const ids=value=>{if(!Array.isArray(value)||value.length>200||value.some(id=>!Number.isSafeInteger(id)||id<0))throw fail('Choose up to 200 object IDs');return value;};
const boundedPng=value=>{if(typeof value!=='string'||value.length>16*1024*1024||!/^iVBORw0KGgo/.test(value))throw fail('Server preview is missing or exceeds the 12 MB render limit',502);const bytes=Buffer.from(value,'base64');if(bytes.length<24||bytes.length>12*1024*1024||bytes.readUInt32BE(0)!==0x89504e47)throw fail('Server preview is not a bounded PNG',502);const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(!width||!height||width>1280||height>1280||width*height>1280*1280)throw fail('Server preview dimensions exceed 1280 × 1280',502);return bytes;};
const boundedCanonicalDocument=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('Canonical DesignCraft document snapshot is missing',502);if(Buffer.byteLength(JSON.stringify(value),'utf8')>16*1024*1024)throw fail('Canonical DesignCraft document snapshot exceeds 16 MB',502);return value;};

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

export function createDesignCraft({binary=process.env.CW_DESIGNCRAFT_BINARY||path.resolve('data/engines/designcraft/build/release/cw-designcraft-engine'),stateDir=path.resolve('data/engines/designcraft/sessions'),maxSessions=4,maxFileBytes=64*1024*1024,settleOutput,processFactory=(file,read,write)=>new EngineProcess(file,read,{args:[read,write],configDir:write,allowedMethods:nativeMethods,engineName:'DesignCraft'})}={}){
  const sessions=new Map();let creating=0,probe=null,cached=null;
  async function identity(root){const engine=processFactory(binary,root,root);try{const value=await engine.call('__cw_identity');if(value.runtimeId!=='creative-workspace-designcraft-v1')throw fail('This is not a workspace-owned DesignCraft engine',503);return value;}finally{engine.stop();}}
  async function status(){
    if(cached&&Date.now()-cached.at<10000)return {...cached.value,sessions:sessions.size};if(probe)return probe;
    probe=(async()=>{let value;try{await access(binary);const root=path.join(stateDir,'probe');await mkdir(root,{recursive:true});const owned=await identity(root);value={ready:true,url:'/apps/designcraft/',version:owned.version,ownedRuntime:true,processing:'server',adapter:'native-browser-prototype',maxSessions};}catch{value={ready:false,message:'Install the workspace-owned DesignCraft engine',processing:'server'};}cached={at:Date.now(),value};return {...value,sessions:sessions.size};})().finally(()=>{probe=null;});return probe;
  }
  async function create(root,{writeRoot=root,workspaceRoot=writeRoot,shareId=null,laptopOutput=false}={}){
    if(!(await status()).ready)throw fail('DesignCraft engine is not installed',503);if(sessions.size+creating>=maxSessions)throw fail('DesignCraft session limit reached; close an unused session',409);creating++;
    let engine,privateRoot;
    try{const id=randomBytes(24).toString('hex');privateRoot=path.join(stateDir,id,'outputs');await mkdir(privateRoot,{recursive:true});const read=await realpath(root),write=await realpath(writeRoot),workspace=await realpath(workspaceRoot);engine=processFactory(binary,read,privateRoot);const owned=await engine.call('__cw_identity');if(owned.runtimeId!=='creative-workspace-designcraft-v1')throw fail('Unexpected DesignCraft engine',503);
      sessions.set(id,{id,root:read,writeRoot:write,workspaceRoot:workspace,privateRoot,engine,shareId,laptopOutput,queue:Promise.resolve(),requests:new Map(),version:0,page:0,name:null,outputs:new Set(),outputRoots:new Map(),frames:new Map(),previewVersion:0,lastUsed:Date.now(),dirty:false});return {id,shareId,processing:'server',source:shareId?'laptop':'server'};
    }catch(e){engine?.stop();if(privateRoot)await rm(path.dirname(privateRoot),{recursive:true,force:true}).catch(()=>{});throw e;}finally{creating--;}
  }
  const get=id=>{const s=sessions.get(id);if(!s||s.engine.closed)throw fail('DesignCraft session is not available',404);if(s.closing)throw fail('DesignCraft session is closing',409);s.lastUsed=Date.now();return s;};
  async function snapshot(s){
    const document=await s.engine.call('state');let preview=null,documentSnapshot=null;
    s.dirty=document?.dirty||false;
    if(document){documentSnapshot=boundedCanonicalDocument(document.documentSnapshot);delete document.documentSnapshot;document.name=s.name||document.title;s.page=Math.max(0,Math.min(s.page,(document.pageCount||1)-1));const frame=await s.engine.call('render',{page:s.page});s.frames.set(++s.previewVersion,boundedPng(frame.pngBase64));while(s.frames.size>3)s.frames.delete(s.frames.keys().next().value);preview=`/api/designcraft/sessions/${s.id}/preview.png?v=${s.previewVersion}`;}
    return {document,documentSnapshot,page:s.page,stateVersion:s.version,preview};
  }
  async function importInput(id,stream,target,destinationChoice){
    const s=get(id),input=relative(target);
    if(s.shareId&&destinationChoice!=='server')throw fail('Choose the server workspace for copy-first input',403);
    if(destinationChoice!==undefined&&destinationChoice!=='server')throw fail('Choose the server workspace for copy-first input',422);
    if(!input.startsWith('imports/')||!/\.designcraft$/i.test(input))throw fail('Choose a native publication in the imports folder');
    const copied=await receiveFile(stream,s.workspaceRoot,input,maxFileBytes);
    return {...copied,sessionId:id,mode:'copy-first'};
  }
  async function execute(id,{method,params={},requestId,expectedVersion}={}){
    const s=get(id);if(!methods.has(method))throw fail('Unsupported DesignCraft method');if(typeof requestId!=='string'||requestId.length<8||requestId.length>100)throw fail('A unique requestId is required');if(params===null||typeof params!=='object'||Array.isArray(params))throw fail('Params must be an object');if(expectedVersion!==undefined&&(!Number.isSafeInteger(expectedVersion)||expectedVersion<0))throw fail('Invalid expectedVersion');
    const signature=JSON.stringify({method,params,expectedVersion}),old=s.requests.get(requestId);if(old){if(old.signature!==signature)throw fail('requestId was already used for a different operation',409);return old.task;}if([...s.requests.values()].filter(r=>r.pending).length>=32)throw fail('Too many queued operations',429);
    const task=s.queue.then(async()=>{
      if(expectedVersion!==undefined&&expectedVersion!==s.version)throw fail('Document changed. Refresh its state before applying this operation.',409,'STATE_VERSION_CONFLICT');
      if(method==='heartbeat')return {alive:true};if(method==='state')return snapshot(s);let result={};
      if(method==='file.new'||method==='file.open'||method==='doc.open'||method==='doc.new'||method==='doc.sample'){
        if(await s.engine.call('state'))throw fail('Save and close the current document before opening another',409);
        if(method==='file.new'){if(Object.keys(params).length!==1||typeof params.preset!=='string'||params.preset.length<1||params.preset.length>100)throw fail('Original file.new requires one known-size preset name');s.version++;result=await s.engine.call('new',{preset:params.preset});result={...result,commandId:'file.new'};}
        else if(method==='file.open'||method==='doc.open'){if(method==='file.open'&&(Object.keys(params).length!==1||typeof params.path!=='string'))throw fail('Original file.open requires only a provider-relative path');const input=relative(params.path);if(!/\.designcraft$/i.test(input))throw fail('Choose a native .designcraft document');const file=await resolveWorkspace(input.startsWith('imports/')?s.workspaceRoot:s.root,input),info=await stat(file);if(!info.isFile()||info.size>maxFileBytes)throw fail('Document exceeds the 64 MB prototype limit',413);s.version++;result=await s.engine.call('open',{path:file});const filename=path.basename(input);s.name=filename.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-(?=.+\.designcraft$)/i,'');if(method==='file.open')result={...result,commandId:'file.open'};}
        else if(method==='doc.sample'){s.version++;s.dirty=true;result=await s.engine.call('sample');s.name='Sample Document';}
        else{const width=number(params.width,1,10000,'width'),height=number(params.height,1,10000,'height');if(!Number.isInteger(params.pages))throw fail('Page count must be an integer');s.version++;s.dirty=true;result=await s.engine.call('new',{title:typeof params.name==='string'?params.name.slice(0,100):'Untitled',width,height,pages:number(params.pages,1,64,'page count'),facingPages:false});result={...result,commandId:'file.new'};s.name=typeof params.name==='string'?params.name.slice(0,100):'Untitled';}
      }else{
        if(!(await s.engine.call('state')))throw fail('Open a publication first');
        if(method==='page.select'){if(!Number.isSafeInteger(params.index)||params.index<0)throw fail('Invalid page');const doc=await s.engine.call('state');if(params.index>=doc.pageCount)throw fail('Unknown page');s.version++;s.page=params.index;}
        else if(method==='file.saveACopy'){
          if(Object.keys(params).sort().join(',')!=='destination,path,retention')throw fail('Save a Copy needs an explicit path, destination and retention choice');
          if(!['server','laptop'].includes(params.destination))throw fail('Choose a server or laptop destination');
          if(params.destination==='laptop'&&!s.laptopOutput)throw fail('Select a read/write laptop folder before choosing the laptop destination',403,'LAPTOP_DESTINATION_REQUIRED');
          if(params.destination==='laptop'&&typeof settleOutput!=='function')throw fail('Laptop write acknowledgement is unavailable',503,'WRITE_ACK_UNAVAILABLE');
          if(params.retention!=='workspace')throw fail('This Save a Copy flow currently supports explicit workspace retention only',422,'RETENTION_UNSUPPORTED');
          const target=relative(params.path);if(!/\.designcraft$/i.test(target))throw fail('Save a native copy with a .designcraft filename');
          const exportRoot=path.join(s.privateRoot,randomBytes(12).toString('hex'));await mkdir(exportRoot);const staged=path.join(exportRoot,'copy.designcraft');
          try{
            const exported=await s.engine.call('save_copy',{path:staged});const info=await stat(staged);if(!info.isFile()||info.size<1||info.size>maxFileBytes)throw fail('Native copy exceeds the 64 MB prototype limit',413);
            if(!exported||exported.bytes!==info.size)throw fail('Native Save a Copy byte acknowledgement did not match the staged output',502);
            let bytes=0;
            if(params.destination==='laptop'){
              const targetFile=await destination(s.writeRoot,target);let handle;
              try{
                handle=await open(targetFile,'wx');
                const limiter=new Transform({transform(chunk,encoding,callback){bytes+=chunk.length;callback(bytes>maxFileBytes?fail('Native copy exceeds the 64 MB prototype limit',413):null,chunk);}});
                await pipeline(createReadStream(staged),limiter,handle.createWriteStream());
              }catch(e){throw e.code==='EEXIST'?fail('Choose a new filename; this laptop file already exists and was not overwritten',409,'OUTPUT_EXISTS'):e;}
              finally{await handle?.close().catch(()=>{});}
              // Closing the server-side file only queues the provider write. Report success after the browser
              // destination acknowledges it; on timeout the provider journal retains the uncertain output.
              await settleOutput(s.shareId,target);
            }else{
              const written=await receiveFile(createReadStream(staged),s.workspaceRoot,target,maxFileBytes);bytes=written.bytes;s.outputRoots.set(target,s.workspaceRoot);
            }
            if(bytes!==info.size)throw fail('Destination write acknowledgement did not match the native copy',502);
            if(params.destination==='laptop')s.outputRoots.set(target,s.writeRoot);s.outputs.add(target);s.version++;result={commandId:'file.saveACopy',path:target,bytes,destination:params.destination,retention:'workspace',savedDocument:false};
          }finally{await rm(exportRoot,{recursive:true,force:true}).catch(()=>{});}
        }
        else if(method==='doc.save'){
          if(s.laptopOutput&&typeof settleOutput!=='function')throw fail('Laptop write acknowledgement is unavailable',503,'WRITE_ACK_UNAVAILABLE');
          const target=relative(params.path),format=path.extname(target).slice(1).toLowerCase();if(!['designcraft','pdf','png'].includes(format))throw fail('Choose .designcraft, .pdf or .png');s.version++;
          const exportRoot=path.join(s.privateRoot,randomBytes(12).toString('hex'));await mkdir(exportRoot);const source=path.join(exportRoot,`document.${format}`);
          const doc=await s.engine.call('state'),board=doc.spreads.flatMap(sp=>sp.pages).find(p=>p.index===s.page);
          result=await s.engine.call('export',{path:source,format,...(format==='png'?{page:s.page,scale:Math.min(1,2048/Math.max(board.bounds[2]-board.bounds[0],board.bounds[3]-board.bounds[1]))}:{})});const size=(await stat(source)).size;if(size>maxFileBytes)throw fail('Export exceeds the 64 MB prototype limit',413);
          if((await readdir(exportRoot)).length!==1)throw fail('This export needs additional asset files. Save a native .designcraft copy; packaged multi-file exports are not supported yet.',422);
          if(s.laptopOutput){const targetFile=await destination(s.writeRoot,target);let handle;try{handle=await open(targetFile,'wx');await pipeline(createReadStream(source),handle.createWriteStream());}catch(e){if(e.code==='EEXIST')throw fail('Choose a new filename; this output already exists',409,'OUTPUT_EXISTS');throw e;}finally{await handle?.close().catch(()=>{});}await settleOutput(s.shareId,target);}
          else await receiveFile(createReadStream(source),s.writeRoot,target,maxFileBytes);
          s.outputs.add(target);if(format==='designcraft'){await s.engine.call('mark_saved');s.name=path.basename(target);}result={path:target,bytes:size,format,warnings:result.warnings||[],savedDocument:format==='designcraft'};await rm(exportRoot,{recursive:true,force:true}).catch(()=>{});
        }else{const args=commandParams(method,params);if(method==='frame.create'){const doc=await s.engine.call('state'),spread=doc.spreads.find(sp=>sp.pages.some(p=>p.index===s.page)),page=spread.pages.find(p=>p.index===s.page);args.spread=spread.index;args.rect=[args.rect[0]+page.bounds[0],args.rect[1],args.rect[2]+page.bounds[0],args.rect[3]];}s.version++;if(!method.startsWith('select.'))s.dirty=true;result=await s.engine.call('command',{command:({'select.set':'selection.set','select.all':'edit.selectAll','select.none':'edit.deselectAll'})[method]||method,params:args});if(method==='frame.create')result={...result,commandId:'frame.create'};}
      }
      return {result,...await snapshot(s)};
    });s.queue=task.catch(()=>{});const entry={signature,task,pending:true};s.requests.set(requestId,entry);task.finally(()=>{entry.pending=false;s.lastUsed=Date.now();}).catch(()=>{});if(s.requests.size>100)for(const [key,value]of s.requests){if(!value.pending)s.requests.delete(key);if(s.requests.size<=100)break;}return task;
  }
  function preview(id,version){const frame=get(id).frames.get(Number(version));if(!frame)throw fail('Preview is no longer available',410);return frame;}
  async function close(id,{discard=false}={}){const s=get(id);s.closing=true;try{await s.queue;if(s.dirty&&discard!==true)throw fail('Save the native DesignCraft document before closing it',409);s.engine.stop();sessions.delete(id);await rm(path.dirname(s.privateRoot),{recursive:true,force:true});return {closed:true};}finally{s.closing=false;}}
  async function output(id,name){const s=get(id);if(!s.outputs.has(name))throw fail('This file was not exported by this session',403);return resolveWorkspace(s.outputRoots.get(name)||s.writeRoot,name);}
  const idle=setInterval(()=>{for(const [id,s]of sessions)if(!s.dirty&&![...s.requests.values()].some(r=>r.pending)&&Date.now()-s.lastUsed>3600000)close(id).catch(()=>{});},60000);idle.unref();
  return {status,create,execute,importInput,preview,close,output,describe:id=>{const s=get(id);return {readRoot:s.root,writeRoot:s.writeRoot,workspaceRoot:s.workspaceRoot,shareId:s.shareId,laptopOutput:s.laptopOutput};},usesShare:id=>[...sessions.values()].some(s=>s.shareId===id&&!s.engine.closed),shutdown:()=>{clearInterval(idle);for(const s of sessions.values())s.engine.stop();sessions.clear();}};
}
