import path from 'node:path';
import {readdir,readFile,writeFile,mkdir,realpath,stat,copyFile,rename,rm,access} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {originalUiPins,originalUiPatches,originalUiPackageId,safeAssetName} from '../src/original-ui.js';
import {isWithin} from '../src/storage.js';

// Register an administrator-built original UI. Does not clone, build or execute repository code.
const [id,sourceArg,assetsArg]=process.argv.slice(2);
if(!Object.hasOwn(originalUiPins,id)||!sourceArg||!assetsArg)throw new Error('Usage: node scripts/install-original-ui.mjs <app> <clean pinned source checkout> <built static directory>');
const source=await realpath(sourceArg),assets=await realpath(assetsArg);
const title=(await readFile(path.join(assets,'index.html'),'utf8')).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.toLowerCase();
if(!title?.includes(id))throw new Error('Built UI belongs to a different application; shared build output may have been replaced');
const git=promisify(execFile);
const {stdout}=await git('git',['-C',source,'rev-parse','HEAD']);
if(stdout.trim()!==originalUiPins[id])throw new Error('Original UI source revision differs from its pinned contract');
const patch=originalUiPatches[id];let patchBytes;
if(patch){
  patchBytes=await readFile(new URL('../'+patch.path,import.meta.url));
  if(createHash('sha256').update(patchBytes).digest('hex')!==patch.sha256)throw new Error('Reviewed source patch checksum mismatch');
  const diff=(await git('git',['-C',source,'-c','core.fsmonitor=false','diff','--binary','--no-color','--no-ext-diff','HEAD','--'],{maxBuffer:2*1024*1024})).stdout;
  if(diff!==patchBytes.toString('utf8'))throw new Error('Source differs from the exact reviewed integration patch');
}else await git('git',['-C',source,'-c','core.fsmonitor=false','diff','--no-ext-diff','--quiet','HEAD','--']);
const root=path.resolve(process.env.CW_ORIGINAL_UI_DIR||path.join(process.env.DATA_DIR||'data','original-ui'));
const parent=path.join(root,id),destination=path.join(parent,originalUiPackageId(id));
await mkdir(parent,{recursive:true});
try{await access(destination);throw new Error('This original UI pin is already installed; use a separate staging root rather than overwrite it');}catch(e){if(e.code!=='ENOENT')throw e;}
const staging=path.join(parent,`.staging-${randomUUID()}`),files=[],hostAdjustments=[];let total=0;
await mkdir(staging);
try{
  async function collect(relative=''){
    for(const entry of await readdir(path.join(assets,relative),{withFileTypes:true})){
      const name=[relative,entry.name].filter(Boolean).join('/');
      if(!safeAssetName(name)||name==='creative-workspace-ui.json')throw new Error('Unexpected file in original UI build');
      const input=await realpath(path.join(assets,name));
      if(!isWithin(assets,input)||entry.isSymbolicLink())throw new Error('Original UI build has an external link');
      if(entry.isDirectory()){await mkdir(path.join(staging,name));await collect(name);continue;}
      if(!entry.isFile())throw new Error('Unexpected asset type');
      const size=(await stat(input)).size;total+=size;
      if(size>96*1024*1024||total>512*1024*1024||files.length>=4096)throw new Error('Original UI build exceeds its size/file budget');
      await copyFile(input,path.join(staging,name));
      if(name==='index.html'){const html=await readFile(path.join(staging,name),'utf8');const normalized=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>{if(!tag.toLowerCase().includes('{{__trunk_address__}}')||!tag.toLowerCase().includes('{{__trunk_ws_base__}}'))return tag;if(/\bimport\b/.test(tag))throw new Error('Cannot safely separate Trunk dev reloader from app bootstrap');hostAdjustments.push('removed unresolved Trunk development reloader');return '';});if(normalized!==html)await writeFile(path.join(staging,name),normalized);}
      const bytes=await readFile(path.join(staging,name));
      files.push({path:name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
  }
  await collect();
  const tracked=(await git('git',['-C',source,'ls-files','-z'])).stdout.split('\0').filter(Boolean);
  for(const name of tracked){if(!safeAssetName(name)||!(/(^|\/)(LICENSE|LICENCE|COPYING|NOTICE|ATTRIBUTION)([._-]|$)/i.test(name)||name.endsWith('.attribution')))continue;const file=await realpath(path.join(source,name));if(!isWithin(source,file))throw new Error('Source provenance has an external link');const bytes=await readFile(file);if(bytes.length>1024*1024)throw new Error('Source provenance file exceeds its budget');const target='provenance/'+name;await mkdir(path.dirname(path.join(staging,target)),{recursive:true});await writeFile(path.join(staging,target),bytes);files.push({path:target,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  if(!files.some(file=>file.path==='index.html')||!files.some(file=>file.path.endsWith('.wasm')))throw new Error('Original UI build lacks index.html or WASM');
  if(id==='photocraft'&&!files.some(file=>file.path==='fonts/manifest.txt')){await mkdir(path.join(staging,'fonts'),{recursive:true});await writeFile(path.join(staging,'fonts/manifest.txt'),'');files.push({path:'fonts/manifest.txt',size:0,sha256:createHash('sha256').update('').digest('hex')});hostAdjustments.push('empty optional served-font catalogue; built-in fonts unchanged');}
  if(patch){const name='provenance/creative-workspace/source.patch';await mkdir(path.dirname(path.join(staging,name)),{recursive:true});await writeFile(path.join(staging,name),patchBytes);files.push({path:name,size:patchBytes.length,sha256:patch.sha256});}
  const licenses=['LICENSE-MIT','LICENSE-APACHE'];
  for(const name of licenses){await copyFile(path.join(source,name),path.join(staging,name));const bytes=await readFile(path.join(staging,name));const prior=files.findIndex(file=>file.path===name);if(prior>=0)files.splice(prior,1);files.push({path:name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  const manifest=JSON.stringify({schemaVersion:1,app:id,repo:`storytold/${id}`,commit:originalUiPins[id],processing:'browser',sourcePatch:patch?{id:patch.id,sha256:patch.sha256}:undefined,licenses,hostAdjustments,notes:id==='lightcraft'&&!files.some(file=>file.path==='lightcraft_zh_hans.otf')?['Optional Chinese font is absent in this preview']:[],files},null,2)+'\n';
  if(files.length>4096||Buffer.byteLength(manifest)>1024*1024||files.reduce((n,file)=>n+file.size,0)>512*1024*1024)throw new Error('Original UI manifest exceeds its budget');
  await writeFile(path.join(staging,'creative-workspace-ui.json'),manifest);
  await rename(staging,destination);
  console.log(`Installed original ${id} UI (${originalUiPins[id]}) — browser processing preview; server integration pending.`);
}catch(e){await rm(staging,{recursive:true,force:true});throw e;}
