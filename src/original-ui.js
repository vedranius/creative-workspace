import path from 'node:path';
import {readFile,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isWithin} from './storage.js';

export const originalUiPins={
  photocraft:'29d5f791d52cd54e411611a609fbc56949e0c653',
  vectorcraft:'96344f07617edb24ab22fa08430ad1389042811d',
  pdfcraft:'9ccf77bdf685bc3cb0f545865c9f9b3e97ab5025',
  designcraft:'a127c6d5c3576972bbd60445f26d893db071eef3',
  lightcraft:'9e6c4c6fc9c7a7f192ce846c00ceb531e0f64dda',
  filmcraft:'4e2d0bc2d3646f9cf27ef7aa8b2095c6858c7efe',
  effectcraft:'9a7d3e76991d5372448033b473dc12c2480a6a04',
  wordcraft:'fc41918814f62645b6746ed68e71e8c2c2e85d6f',
  gridcraft:'d9d09f0baa912e88c5111107903fc8c640214b57',
  deckcraft:'d78e657e4cb1e490ceb5445785c052d9cf5ad963',
  cadcraft:'fc4e98315a8d771b5ab832f0ade0b5e7b106df7f',
  figcraft:'833f0d2c27f0acbae5394848930ae531fc89c724',
  soundcraft:'3a28a657692c1b98b28c276d8f61df9471074f0f'
};
// Reviewed integration patches are explicit variants of the upstream pin, never new upstream commits.
export const originalUiPatches={designcraft:{id:'par-03-delete-page-v1',path:'patches/designcraft/a127c6d5/par-03-delete-page-v1.patch',sha256:'9f9fc7de7907f6f4e544d222112f2959e9dbfe0d73c11ffe18b695c4485e7693'},filmcraft:{id:'mkv-pending-v1',path:'engines/original-ui/filmcraft/mkv-pending.patch',sha256:'8aee3cdf5acc1380564965329472b92f9a02207e6e11a63bb4983f54ef5688bc'}};
export const originalUiPackageId=id=>originalUiPins[id]+(originalUiPatches[id]?'-'+originalUiPatches[id].sha256.slice(0,12):'');
const MAX_FILE=96*1024*1024,MAX_TOTAL=512*1024*1024;
export function safeAssetName(name){return typeof name==='string'&&name.length<=1024&&!name.startsWith('/')&&!name.includes('\\')&&!name.includes('\0')&&name.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!part.startsWith('.'));}
const fail=(message,status)=>Object.assign(new Error(message),{status});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.css':'text/css; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.otf':'font/otf','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.pdf':'application/pdf','.mp4':'video/mp4','.wav':'audio/wav','.ogg':'audio/ogg','.webm':'video/webm'};

export function createOriginalUiRegistry(root){
  const verifiedPackages=new Map();
  const pending=id=>({available:false,processing:'browser',serverIntegrated:false,sourceCommit:originalUiPins[id],message:'Original UI preview is not installed'});
  async function load(id){
    if(!Object.hasOwn(originalUiPins,id))throw fail('Unknown original application',404);
    const directory=await realpath(path.join(root,id,originalUiPackageId(id)));
    const canonicalRoot=await realpath(root);
    if(!isWithin(canonicalRoot,directory))throw fail('Original UI directory escapes its installation root',403);
    const meta=await realpath(path.join(directory,'creative-workspace-ui.json'));
    if(!isWithin(directory,meta))throw fail('Original UI manifest escapes its installation',403);
    if((await stat(meta)).size>1024*1024)throw fail('Original UI manifest is too large',503);
    const manifest=JSON.parse(await readFile(meta,'utf8'));
    if(manifest.schemaVersion!==1||manifest.app!==id||manifest.commit!==originalUiPins[id]||manifest.repo!==`storytold/${id}`||manifest.processing!=='browser'||!Array.isArray(manifest.files)||manifest.files.length>4096)throw fail('Original UI manifest identity is invalid',503);
    const patch=originalUiPatches[id];
    if(patch&&(manifest.sourcePatch?.id!==patch.id||manifest.sourcePatch?.sha256!==patch.sha256))throw fail('Original UI source patch identity is invalid',503);
    if(!patch&&manifest.sourcePatch)throw fail('Unexpected original UI source patch',503);
    const files=new Map();let total=0;
    for(const file of manifest.files){
      if(!safeAssetName(file.path)||files.has(file.path)||!Number.isSafeInteger(file.size)||file.size<0||file.size>MAX_FILE||!/^[a-f0-9]{64}$/.test(file.sha256))throw fail('Original UI asset manifest is invalid',503);
      files.set(file.path,file);total+=file.size;
    }
    if(patch&&files.get('provenance/creative-workspace/source.patch')?.sha256!==patch.sha256)throw fail('Original UI patch provenance is missing',503);
    if(total>MAX_TOTAL||!files.has('index.html')||!files.has('LICENSE-MIT')||!files.has('LICENSE-APACHE')||!manifest.licenses?.includes('LICENSE-MIT')||!manifest.licenses?.includes('LICENSE-APACHE'))throw fail('Original UI package is incomplete',503);
    return {directory,files,notes:Array.isArray(manifest.notes)?manifest.notes.filter(note=>typeof note==='string'&&note.length<512).slice(0,16):[]};
  }
  async function asset(id,name){
    if(!safeAssetName(name))throw fail('Invalid original UI asset path',403);
    const installed=await load(id).catch(e=>{if(e.code==='ENOENT')throw fail('Original UI preview is not installed',404);throw e;});
    const entry=installed.files.get(name);if(!entry)throw fail('Original UI asset not found',404);
    const file=await realpath(path.join(installed.directory,name));
    if(!isWithin(installed.directory,file))throw fail('Original UI asset escapes its installation',403);
    if((await stat(file)).size!==entry.size)throw fail('Original UI asset changed after installation',503);
    const bytes=await readFile(file);
    if(bytes.length!==entry.size||hash(bytes)!==entry.sha256)throw fail('Original UI asset checksum mismatch',503);
    return {bytes,type:types[path.extname(name).toLowerCase()]||'application/octet-stream'};
  }
  async function verifyPackage(id){
    const installed=await load(id),signature=[];
    for(const entry of installed.files.values()){
      const file=await realpath(path.join(installed.directory,entry.path));
      if(!isWithin(installed.directory,file))throw fail('Original UI asset escapes its installation',403);
      const info=await stat(file);
      if(info.size!==entry.size)throw fail('Original UI asset changed after installation',503);
      signature.push([entry.path,entry.sha256,info.size,info.mtimeMs,info.ctimeMs,info.ino,file]);
    }
    const key=JSON.stringify(signature);
    if(verifiedPackages.get(id)!==key){for(const entry of installed.files.values())await asset(id,entry.path);verifiedPackages.set(id,key);}
  }
  async function list(){
    const result={};
    for(const id of Object.keys(originalUiPins)){
      try{await verifyPackage(id);const installed=await load(id);result[id]={available:true,url:`/original/${id}/`,processing:'browser',serverIntegrated:false,sourceCommit:originalUiPins[id],sourcePatch:originalUiPatches[id]||null,repo:`storytold/${id}`,notes:installed.notes};}
      catch{result[id]=pending(id);}
    }
    return result;
  }
  async function serve(req,res,pathname){
    const match=pathname.match(/^\/original\/([a-z]+)(?:\/(.*))?$/);
    if(!match)return false;
    if(!['GET','HEAD'].includes(req.method))throw fail('Method not allowed',405);
    if(!Object.hasOwn(originalUiPins,match[1]))throw fail('Unknown original application',404);
    if(match[2]===undefined){res.writeHead(302,{Location:`${pathname}/`});res.end();return true;}
    let name;try{name=decodeURIComponent(match[2]||'index.html');}catch{throw fail('Invalid asset encoding',400);}
    const file=await asset(match[1],name);
    const scriptHashes=[];
    if(name.endsWith('.html'))for(const script of file.bytes.toString('utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/i.test(script[1]))scriptHashes.push(`'sha256-${createHash('sha256').update(script[2]).digest('base64')}'`);
    res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self' blob:; worker-src 'self' blob:; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`);
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.writeHead(200,{'Content-Type':file.type,'Content-Length':file.bytes.length,'Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:file.bytes);return true;
  }
  return {list,serve};
}
