import path from 'node:path';
import {mkdir,open,rename,rm,readdir,realpath,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {isWithin} from './storage.js';
import {importSegments} from './transfers.js';

const error=(message,status=400)=>Object.assign(new Error(message),{status});
const sharePattern=/^[a-f0-9]{16}$/;
const digest=relative=>createHash('sha256').update(relative).digest('hex');
const MAX_MANIFEST_BYTES=4*1024*1024;
const MAX_ENTRIES=4096;

// This journal records uncertainty, not permission to replay a laptop write.
// File contents stay in the share's own mirror, outside any FUSE mount.
export function createStorageRecovery({work,resolveAppRoot}){
  const root=path.join(work,'recovery');
  let queue=Promise.resolve();
  const serialize=operation=>{const next=queue.then(operation);queue=next.catch(()=>{});return next;};
  const manifestPath=id=>{if(!sharePattern.test(id))throw error('Invalid recovery share');return path.join(root,`${id}.json`);};

  async function checkDirectory(){
    const info=await lstat(root);if(!info.isDirectory()||info.isSymbolicLink())throw error('Recovery journal is not a regular directory',403);
    const base=await realpath(work);if(!isWithin(base,await realpath(root)))throw error('Recovery journal is outside its data directory',403);
  }

  async function syncDirectory(){
    if(process.platform==='win32')return;
    const handle=await open(root,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
    try{await handle.sync();}finally{await handle.close();}
  }

  function validate(manifest,id){
    if(manifest?.schema!==1||manifest.shareId!==id||!sharePattern.test(id)||typeof manifest.app!=='string'||typeof manifest.mirror!=='string'||!path.isAbsolute(manifest.mirror)||typeof manifest.folderName!=='string'||importSegments(manifest.folderName).length!==1||!Array.isArray(manifest.files)||manifest.files.length>MAX_ENTRIES)throw error('Invalid recovery manifest');
    const seen=new Set();
    for(const entry of manifest.files){
      importSegments(entry.relativePath);
      if(seen.has(entry.relativePath)||!/^[a-f0-9]{32}$/.test(entry.generation)||!['writing','unacknowledged','failed'].includes(entry.state)||typeof entry.updatedAt!=='string'||!Number.isFinite(Date.parse(entry.updatedAt))||entry.lastError!==undefined&&(typeof entry.lastError!=='string'||entry.lastError.length>512))throw error('Invalid recovery entry');
      seen.add(entry.relativePath);
    }
    return manifest;
  }

  async function load(id){
    let handle;
    try{
      await checkDirectory();
      handle=await open(manifestPath(id),constants.O_RDONLY|(constants.O_NOFOLLOW||0));
      const info=await handle.stat();if(!info.isFile()||info.size>MAX_MANIFEST_BYTES)throw error('Invalid recovery manifest');
      return validate(JSON.parse(await handle.readFile('utf8')),id);
    }catch(e){if(e.code==='ENOENT')return null;throw e;}
    finally{await handle?.close();}
  }

  async function publish(manifest){
    validate(manifest,manifest.shareId);
    await mkdir(root,{recursive:true,mode:0o700});
    await checkDirectory();
    const target=manifestPath(manifest.shareId);
    if(!manifest.files.length){await rm(target,{force:true});await syncDirectory();return;}
    const contents=JSON.stringify(manifest);if(Buffer.byteLength(contents)>MAX_MANIFEST_BYTES)throw error('Recovery journal is full; recover pending files first',409);
    const temporary=path.join(root,`.pending-${randomBytes(12).toString('hex')}`);
    let handle;
    try{
      handle=await open(temporary,'wx',0o600);await handle.writeFile(contents);await handle.sync();await handle.close();handle=null;
      await rename(temporary,target);
      await syncDirectory();
    }finally{await handle?.close();await rm(temporary,{force:true});}
  }

  async function expectedMirror(manifest){
    const appRoot=await resolveAppRoot(manifest.app);
    const candidates=[path.join(work,'mirror',manifest.shareId,manifest.folderName),path.join(appRoot,`local-${manifest.shareId}`,manifest.folderName)];
    if(!candidates.some(candidate=>path.resolve(candidate)===path.resolve(manifest.mirror)))throw error('Recovery copy is outside its application workspace',403);
    // Configured roots can use an OS alias (macOS /var -> /private/var).
    // Walk the namespace relative to that root, then reject per-share symlinks.
    const candidate=candidates.find(item=>path.resolve(item)===path.resolve(manifest.mirror));
    const declaredBase=path.resolve(candidate===candidates[0]?work:appRoot);
    const base=await realpath(declaredBase);
    let current=base;
    for(const segment of path.relative(declaredBase,candidate).split(path.sep)){
      current=path.join(current,segment);
      const info=await lstat(current);if(!info.isDirectory()||info.isSymbolicLink())throw error('Recovery copy is not a regular directory',403);
    }
    return realpath(current);
  }

  async function copy(manifest,entry){
    const mirror=await expectedMirror(manifest);
    let current=mirror;
    for(const segment of importSegments(entry.relativePath)){
      current=path.join(current,segment);
      if((await lstat(current)).isSymbolicLink())throw error('Recovery copy contains a symbolic link',403);
    }
    const canonical=await realpath(current);if(!isWithin(mirror,canonical))throw error('Recovery copy is outside its folder',403);
    const handle=await open(canonical,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
    try{const info=await handle.stat();if(!info.isFile())throw error('Recovery copy is not a file');return {handle,size:info.size};}
    catch(e){await handle.close();throw e;}
  }

  return {
    begin(metadata,relativePath,state='writing'){
      importSegments(relativePath);
      const generation=randomBytes(16).toString('hex');
      return serialize(async()=>{
        const previous=await load(metadata.id);
        const manifest=previous||{schema:1,shareId:metadata.id,app:metadata.app,folderName:metadata.name,mirror:metadata.mirror,files:[]};
        if(manifest.app!==metadata.app||manifest.folderName!==metadata.name||manifest.mirror!==metadata.mirror)throw error('Recovery share identity changed',409);
        const entry={relativePath,generation,state,updatedAt:new Date().toISOString()};
        manifest.files=manifest.files.filter(item=>item.relativePath!==relativePath);manifest.files.push(entry);
        await publish(manifest);return generation;
      });
    },
    update(id,relativePath,generation,state,lastError){return serialize(async()=>{
      const manifest=await load(id);const entry=manifest?.files.find(item=>item.relativePath===relativePath&&item.generation===generation);if(!entry)return false;
      entry.state=state;entry.updatedAt=new Date().toISOString();delete entry.lastError;
      if(lastError)entry.lastError=String(lastError).slice(0,512);
      await publish(manifest);return true;
    });},
    acknowledge(id,relativePath,generation){return serialize(async()=>{
      const manifest=await load(id);if(!manifest)return false;
      const remaining=manifest.files.filter(item=>item.relativePath!==relativePath||item.generation!==generation);
      if(remaining.length===manifest.files.length)return false;
      manifest.files=remaining;await publish(manifest);return true;
    });},
    relocate(id,from,to){return serialize(async()=>{
      importSegments(to);const manifest=await load(id);if(!manifest)return;
      const moving=manifest.files.filter(entry=>entry.relativePath===from||entry.relativePath.startsWith(`${from}/`));if(!moving.length)return;
      const targets=new Set(moving.map(entry=>to+entry.relativePath.slice(from.length)));
      manifest.files=manifest.files.filter(entry=>moving.includes(entry)||!targets.has(entry.relativePath));
      for(const entry of moving){entry.relativePath=to+entry.relativePath.slice(from.length);entry.updatedAt=new Date().toISOString();}
      await publish(manifest);
    });},
    flush:()=>queue,
    async has(id){await queue;const manifest=await load(id);return !!manifest?.files.length;},
    async list(app){
      await queue;
      try{await checkDirectory();}catch(e){if(e.code==='ENOENT')return {records:[],invalidManifests:0,truncated:false};throw e;}
      const files=await readdir(root).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
      const manifests=files.filter(file=>/^[a-f0-9]{16}\.json$/.test(file));
      const records=[];let invalidManifests=0;let truncated=manifests.length>256;
      for(const file of manifests.slice(0,256)){
        let manifest;
        try{manifest=await load(file.slice(0,-5));if(!manifest)continue;await resolveAppRoot(manifest.app);}catch{invalidManifests++;continue;}
        if(app&&manifest.app!==app)continue;
        for(const entry of manifest.files){
          if(records.length>=1000){truncated=true;break;}
          let info=null;
          try{info=await copy(manifest,entry);await info.handle.close();}catch{ /* Keep uncertainty visible even when its copy is missing. */ }
          records.push({id:`${manifest.shareId}-${digest(entry.relativePath)}`,app:manifest.app,folderName:manifest.folderName,relativePath:entry.relativePath,state:entry.state,updatedAt:entry.updatedAt,lastError:entry.lastError,mayBeIncomplete:entry.state==='writing',downloadAvailable:!!info,size:info?.size??null});
        }
        if(records.length>=1000)break;
      }
      return {records:records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),invalidManifests,truncated};
    },
    async output(id,app){
      if(!/^[a-f0-9]{16}-[a-f0-9]{64}$/.test(id))throw error('Recovery output not found',404);
      await queue;const manifest=await load(id.slice(0,16));
      if(!manifest||app&&manifest.app!==app)throw error('Recovery output not found',404);
      const entry=manifest.files.find(item=>digest(item.relativePath)===id.slice(17));if(!entry)throw error('Recovery output not found',404);
      return {...await copy(manifest,entry),name:path.basename(entry.relativePath),state:entry.state};
    }
  };
}
