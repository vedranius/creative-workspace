import {mkdir, readFile, writeFile, rename, realpath, stat, readdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export async function readState(directory) {
  try { return JSON.parse(await readFile(path.join(directory,'state.json'),'utf8')); }
  catch(error) { if(error.code !== 'ENOENT') throw error; return {apps:{},updates:{}}; }
}
export async function writeState(directory,state) {
  await mkdir(directory,{recursive:true});
  const temporary=path.join(directory,`.state-${randomUUID()}.json`);
  await writeFile(temporary,JSON.stringify(state,null,2),{mode:0o600});
  await rename(temporary,path.join(directory,'state.json'));
}
export function isWithin(root,target) {
  const relative=path.relative(root,target);
  return relative==='' || (relative!=='..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
export async function resolveWorkspace(root,relative='') {
  if(typeof relative!=='string' || relative.includes('\0') || path.isAbsolute(relative)) throw new Error('Invalid relative path');
  const resolvedRoot=await realpath(root);
  const target=await realpath(path.resolve(resolvedRoot,relative));
  if(!isWithin(resolvedRoot,target)) throw new Error('Path is outside the permitted workspace');
  return target;
}
export async function listFiles(root,relative='') {
  const target=await resolveWorkspace(root,relative);
  if(!(await stat(target)).isDirectory()) throw new Error('Select a directory');
  const entries=await readdir(target,{withFileTypes:true});
  const result=[];
  for(const entry of entries.slice(0,1000)) {
    const child=path.join(target,entry.name);
    try {
      const resolved=await realpath(child);
      if(!isWithin(await realpath(root),resolved)) continue;
      const info=await stat(resolved);
      result.push({name:entry.name,directory:info.isDirectory(),size:info.size,modified:info.mtime.toISOString()});
    } catch { /* Skip inaccessible and dangling links. */ }
  }
  return {path:relative,entries:result.sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name)),truncated:entries.length>1000};
}
