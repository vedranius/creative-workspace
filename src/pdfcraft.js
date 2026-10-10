import path from 'node:path';
import {access,mkdir,realpath,stat,copyFile,rm,open} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {randomBytes} from 'node:crypto';
import {EngineProcess} from './photocraft.js';
import {resolveWorkspace,isWithin} from './storage.js';
import {importSegments,receiveFile} from './transfers.js';

const nativeMethods=new Set(['__cw_identity','export_copy','doc_open','doc_create','doc_list','doc_info','doc_close','render_preview','page_rotate','page_delete','page_move','comment_add','comment_list','edit_undo','edit_redo','doc_set_info','text_extract']);
const methods=new Set(['state','heartbeat','doc.open','doc.new','doc.save','doc.select','doc.close','page.select','page.rotate','page.delete','page.move','comment.add','edit.undo','edit.redo','text.extract']);
const mutations=new Map([['page.rotate','page_rotate'],['page.delete','page_delete'],['page.move','page_move'],['comment.add','comment_add'],['edit.undo','edit_undo'],['edit.redo','edit_redo']]);
const fail=(message,status=400,code)=>Object.assign(new Error(message),{status,...(code?{code}:{})});
const json=result=>result.content?.find(item=>item.type==='json')?.value;
const relative=value=>{try{importSegments(value);return value;}catch{throw fail('Use a relative path inside this application workspace');}};
async function newDestination(root,target){const segments=importSegments(target),base=await realpath(root);let parent=base;for(const name of segments.slice(0,-1)){const folder=path.join(parent,name);await mkdir(folder).catch(error=>{if(error.code!=='EEXIST')throw error;});parent=await realpath(folder);if(!isWithin(base,parent))throw fail('Output folder is outside the workspace',403);}return path.join(parent,segments.at(-1));}

export function createPdfCraft({binary=process.env.CW_PDFCRAFT_BINARY||path.resolve('data/engines/pdfcraft/build/release/cw-pdfcraft-engine'),stateDir=path.resolve('data/engines/pdfcraft/sessions'),maxSessions=4,maxFileBytes=128*1024*1024,settleOutput=async()=>{},processFactory=(file,root)=>new EngineProcess(file,root,{args:[root],configDir:root,allowedMethods:nativeMethods,engineName:'PdfCraft'})}={}){
  const sessions=new Map();let creating=0,probe=null,cached=null;
  async function identity(root){const engine=processFactory(binary,root);try{const value=await engine.call('__cw_identity');if(value.runtimeId!=='creative-workspace-pdfcraft-v1')throw fail('This is not a workspace-owned PdfCraft engine',503);return value;}finally{engine.stop();}}
  async function status(){
    if(cached&&Date.now()-cached.at<10000)return {...cached.value,sessions:sessions.size};
    if(probe)return probe;
    probe=(async()=>{let value;try{await access(binary);const root=path.join(stateDir,'probe');await mkdir(root,{recursive:true});const owned=await identity(root);value={ready:true,url:'/apps/pdfcraft/',version:owned.version,ownedRuntime:true,processing:'server',adapter:'native-browser-prototype',maxSessions};}catch{value={ready:false,message:'Install the workspace-owned PdfCraft engine',processing:'server'};}cached={at:Date.now(),value};return {...value,sessions:sessions.size};})().finally(()=>{probe=null;});return probe;
  }
  async function create(root,{writeRoot=root,shareId=null,laptopOutput=false}={}){
    if(!(await status()).ready)throw fail('PdfCraft engine is not installed',503);
    if(sessions.size+creating>=maxSessions)throw fail('PdfCraft session limit reached; close an unused session',409);
    creating++;
    try{
      const id=randomBytes(24).toString('hex'),privateRoot=path.join(stateDir,id,'workspace');await mkdir(path.join(privateRoot,'inputs'),{recursive:true});await mkdir(path.join(privateRoot,'outputs'),{recursive:true});
      const session={id,root:await realpath(root),writeRoot:await realpath(writeRoot),privateRoot,shareId,laptopOutput,engine:processFactory(binary,privateRoot),queue:Promise.resolve(),requests:new Map(),active:null,page:1,version:0,docVersions:new Map(),savedVersions:new Map(),names:new Map(),outputs:new Set(),frames:new Map(),previewVersion:0,lastUsed:Date.now(),dirty:false};
      try{const value=await session.engine.call('__cw_identity');if(value.runtimeId!=='creative-workspace-pdfcraft-v1')throw fail('Unexpected PdfCraft engine',503);}catch(error){session.engine.stop();throw error;}
      sessions.set(id,session);return {id,shareId,processing:'server',source:shareId?'laptop':'server'};
    }finally{creating--;}
  }
  const get=id=>{const s=sessions.get(id);if(!s||s.engine.closed)throw fail('PdfCraft session is not available',404);if(s.closing)throw fail('PdfCraft session is closing',409);s.lastUsed=Date.now();return s;};
  const normal=(s,doc)=>{const {path:ignored,...safe}=doc;return {...safe,name:s.names.get(doc.doc)||doc.name,dirty:(s.docVersions.get(doc.doc)||0)!==s.savedVersions.get(doc.doc)};};
  async function snapshot(s){
    const list=json(await s.engine.call('doc_list'));const documents=(list?.documents||[]).map(doc=>normal(s,doc));let document=null,preview=null;
    if(s.active!==null){const info=json(await s.engine.call('doc_info',{doc:s.active}));document={...info,document:normal(s,info.document)};s.page=Math.max(1,Math.min(s.page,info.pages.length));const frame=(await s.engine.call('render_preview',{doc:s.active,page:s.page,max_side:1280})).content.find(item=>item.type==='png');if(frame){s.frames.set(++s.previewVersion,Buffer.from(frame.base64,'base64'));while(s.frames.size>3)s.frames.delete(s.frames.keys().next().value);preview=`/api/pdfcraft/sessions/${s.id}/preview.png?v=${s.previewVersion}`;}}
    s.dirty=documents.some(doc=>doc.dirty);return {documents,document,page:s.page,active:s.active,stateVersion:s.version,preview};
  }
  async function execute(id,{method,params={},requestId,expectedVersion}={}){
    const s=get(id);if(!methods.has(method))throw fail('Unsupported PdfCraft method');if(typeof requestId!=='string'||requestId.length<8||requestId.length>100)throw fail('A unique requestId is required');
    if(params===null||typeof params!=='object'||Array.isArray(params))throw fail('Params must be an object');if(expectedVersion!==undefined&&(!Number.isSafeInteger(expectedVersion)||expectedVersion<0))throw fail('Invalid expectedVersion');
    const signature=JSON.stringify({method,params,expectedVersion});const old=s.requests.get(requestId);if(old){if(old.signature!==signature)throw fail('requestId was already used for a different operation',409);return old.task;}
    if([...s.requests.values()].filter(item=>item.pending).length>=32)throw fail('Too many queued operations',429);
    const task=s.queue.then(async()=>{
      if(expectedVersion!==undefined&&expectedVersion!==s.version)throw fail('Document or session changed. Refresh its state before applying this operation.',409,'STATE_VERSION_CONFLICT');
      if(method==='heartbeat')return {alive:true};if(method==='state')return snapshot(s);
      let result={};
      if(method==='doc.open'||method==='doc.new'){
        if((json(await s.engine.call('doc_list'))?.documents||[]).length>=8)throw fail('Open document limit reached',409);
        s.version++;
        if(method==='doc.open'){
          const input=relative(params.path);if(!/\.pdf$/i.test(input))throw fail('Choose a PDF file');const source=await resolveWorkspace(s.root,input);const info=await stat(source);if(!info.isFile()||info.size>maxFileBytes)throw fail('PDF exceeds the 128 MB prototype limit',413);
          const staging=`inputs/${randomBytes(8).toString('hex')}.pdf`;
          try{await copyFile(source,path.join(s.privateRoot,staging));result=json(await s.engine.call('doc_open',{path:staging,...(typeof params.password==='string'?{password:params.password}:{})}));}catch(error){await rm(path.join(s.privateRoot,staging),{force:true}).catch(()=>{});throw error;}
          s.names.set(result.doc,path.basename(input));s.savedVersions.set(result.doc,0);result={...result,name:path.basename(input),path:input};
        }else{if(!Number.isSafeInteger(params.pages)||params.pages<1||params.pages>100)throw fail('Choose 1–100 pages');result=json(await s.engine.call('doc_create',{from:'blank',pages:params.pages,width:595,height:842,name:typeof params.name==='string'?params.name.slice(0,100):'Untitled PDF'}));s.names.set(result.doc,result.name);s.dirty=true;}
        s.docVersions.set(result.doc,0);s.active=result.doc;s.page=1;
      }else if(method==='doc.select'){
        const list=json(await s.engine.call('doc_list'));if(!list.documents.some(doc=>doc.doc===params.doc))throw fail('Document is not in this session');s.version++;s.active=params.doc;s.page=1;
      }else{
        if(s.active===null)throw fail('Open a PDF first');
        if(method==='page.select'){if(!Number.isSafeInteger(params.page)||params.page<1)throw fail('Invalid page');s.version++;s.page=params.page;}
        else if(method==='doc.close'){const dirty=(s.docVersions.get(s.active)||0)!==s.savedVersions.get(s.active);if(dirty&&params.discard!==true)throw fail('Save this document before closing it',409);s.version++;result=json(await s.engine.call('doc_close',{doc:s.active,discard_changes:true}));const list=json(await s.engine.call('doc_list'));s.active=list.documents[0]?.doc??null;s.page=1;}
        else if(method==='doc.save'){
          const target=relative(params.path);if(!/\.pdf$/i.test(target))throw fail('Use a .pdf filename');const staged=`outputs/${randomBytes(12).toString('hex')}.pdf`;s.version++;
          await s.engine.call('export_copy',{doc:s.active,path:staged});const source=path.join(s.privateRoot,staged);
          if(s.laptopOutput){const destination=await newDestination(s.writeRoot,target);let handle;try{handle=await open(destination,'wx');await pipeline(createReadStream(source),handle.createWriteStream());}catch(error){if(error.code==='EEXIST')throw fail('Choose a new filename; this output already exists',409,'OUTPUT_EXISTS');throw error;}finally{await handle?.close().catch(()=>{});}await settleOutput(s.shareId,target);}
          else await receiveFile(createReadStream(source),s.writeRoot,target,maxFileBytes);
          s.outputs.add(target);s.savedVersions.set(s.active,s.docVersions.get(s.active)||0);s.names.set(s.active,path.basename(target));result={path:target,bytes:(await stat(source)).size};await rm(source,{force:true}).catch(()=>{});
        }else if(method==='text.extract'){result=json(await s.engine.call('text_extract',{doc:s.active,pages:[s.page]}));}
        else{const native=mutations.get(method);if(!native)throw fail('Unsupported operation');let args={doc:s.active};
          if(method==='page.rotate'){if(![90,-90,180].includes(params.degrees))throw fail('Choose a 90° or 180° rotation');args={...args,pages:[s.page],degrees:params.degrees};}
          if(method==='page.delete')args={...args,pages:[s.page]};
          if(method==='page.move'){if(!Number.isSafeInteger(params.to)||params.to<1)throw fail('Invalid destination page');args={...args,pages:[s.page],to:params.to};}
          if(method==='comment.add'){if(typeof params.contents!=='string'||!params.contents.trim()||params.contents.length>2000)throw fail('Enter a note up to 2,000 characters');args={...args,page:s.page,type:'note',at:[40,40],contents:params.contents};}
          s.version++;s.dirty=true;s.docVersions.set(s.active,(s.docVersions.get(s.active)||0)+1);result=json(await s.engine.call(native,args));
        }
      }
      return {result,...await snapshot(s)};
    });s.queue=task.catch(()=>{});const entry={signature,task,pending:true};s.requests.set(requestId,entry);task.finally(()=>{entry.pending=false;}).catch(()=>{});if(s.requests.size>100)for(const [key,value]of s.requests){if(!value.pending)s.requests.delete(key);if(s.requests.size<=100)break;}return task;
  }
  function preview(id,version){const s=get(id),frame=s.frames.get(Number(version));if(!frame)throw fail('Preview is no longer available',410);return frame;}
  async function close(id,{discard=false}={}){const s=get(id);s.closing=true;try{await s.queue;if(s.dirty&&discard!==true)throw fail('Save open PDF documents before ending the session',409);s.engine.stop();sessions.delete(id);await rm(path.dirname(s.privateRoot),{recursive:true,force:true});return {closed:true};}finally{s.closing=false;}}
  async function output(id,relativePath){const s=get(id);if(!s.outputs.has(relativePath))throw fail('This file was not exported by this session',403);return resolveWorkspace(s.writeRoot,relativePath);}
  const idle=setInterval(()=>{for(const [id,s]of sessions)if(!s.dirty&&Date.now()-s.lastUsed>3600000)close(id).catch(()=>{});},60000);idle.unref();
  return {status,create,execute,preview,close,output,describe:id=>{const s=get(id);return {readRoot:s.root,writeRoot:s.writeRoot,shareId:s.shareId,laptopOutput:s.laptopOutput};},usesShare:id=>[...sessions.values()].some(s=>s.shareId===id&&!s.engine.closed),shutdown:()=>{clearInterval(idle);for(const s of sessions.values())s.engine.stop();sessions.clear();}};
}
