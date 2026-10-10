import path from 'node:path';
import {mkdir,realpath,link,unlink} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import {isWithin} from './storage.js';

export function importSegments(relative){
  if(typeof relative!=='string'||relative.length>1024)throw Object.assign(new Error('Invalid file path'),{status:400});
  const segments=relative.split('/');
  if(segments.some(part=>!part||part==='.'||part==='..'||part.startsWith('.cw-upload-')||/[\\\x00-\x1f<>:"|?*]/.test(part)||/[. ]$/.test(part)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(part)))throw Object.assign(new Error('Unsupported file name or path'),{status:400});
  return segments;
}
export async function receiveFile(stream,root,relative,maxBytes){
  const segments=importSegments(relative);
  const canonical=await realpath(root);
  let parent=canonical;
  for(const segment of segments.slice(0,-1)){
    const next=path.join(parent,segment);
    await mkdir(next).catch(e=>{if(e.code!=='EEXIST')throw e;});
    parent=await realpath(next);
    if(!isWithin(canonical,parent))throw Object.assign(new Error('Folder is outside the workspace'),{status:403});
  }
  const destination=path.join(parent,segments.at(-1));
  const temporary=path.join(parent,`.cw-upload-${randomUUID()}`);
  let bytes=0;
  const limiter=new Transform({transform(chunk,encoding,callback){bytes+=chunk.length;callback(bytes>maxBytes?Object.assign(new Error('File exceeds upload limit'),{status:413}):null,chunk);}});
  try{
    // Do not destroy the HTTP request on a validation failure: return a useful JSON error.
    stream.pipe(limiter);
    const onError=e=>limiter.destroy(e);
    stream.on('error',onError);
    try{await pipeline(limiter,createWriteStream(temporary,{flags:'wx',mode:0o600}));}
    finally{stream.unpipe(limiter);stream.off('error',onError);stream.resume();}
    await link(temporary,destination).catch(e=>{if(e.code==='EEXIST')throw Object.assign(new Error('A file with this name already exists; originals were not overwritten'),{status:409});throw e;});
    return {path:relative,bytes};
  }finally{await unlink(temporary).catch(()=>{});}
}
