import {cp,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec=promisify(execFile);
// Stable reviewed-patch bytes in full/shallow checkouts and across Git formatting settings.
export const originalUiDiffArgs=['-c','core.fsmonitor=false','diff','--binary','--full-index','--no-color','--no-ext-diff','--no-textconv','--no-renames','--src-prefix=a/','--dst-prefix=b/','--unified=3','--diff-algorithm=myers','--indent-heuristic','HEAD','--'];

// `git diff HEAD` omits untracked files, including new files in an applied reviewed patch.
// Temporarily mark those paths intent-to-add so their bytes participate in the exact diff,
// then restore the original index state even when Git rejects the comparison.
export async function originalUiSourceDiff(source){
  const options={maxBuffer:8*1024*1024};
  const git=async(args,extra={})=>(await exec('git',['-C',source,...args],{...options,...extra})).stdout;
  const untracked=(await git(['ls-files','--others','--exclude-standard','-z'])).split('\0').filter(Boolean);
  if(untracked.length>4096||untracked.reduce((size,name)=>size+Buffer.byteLength(name),0)>1024*1024)throw new Error('Original UI source has too many untracked paths');
  if(untracked.length)await git(['add','--intent-to-add','--',...untracked]);
  try{return await git(originalUiDiffArgs);}
  finally{if(untracked.length)await git(['reset','--quiet','--',...untracked]);}
}

// Check applied bytes before an expensive build as well as after it. Patch
// producers must use originalUiDiffArgs; comparison never normalizes away edits.
export async function assertOriginalUiSource(source,reviewedPatch,phase='verification'){
  if(await originalUiSourceDiff(source)!==reviewedPatch.toString('utf8')){
    throw new Error(`Original UI source differs from the exact reviewed patch (${phase})`);
  }
}

// Cargo/Trunk may update generated metadata in the checkout while building.
// Compile a disposable copy so those mutations cannot invalidate the reviewed source.
export async function createOriginalUiBuildCopy(source,parentDirectory=os.tmpdir()){
  const directory=await mkdtemp(path.join(parentDirectory,'cw-original-ui-build-'));
  const buildSource=path.join(directory,'source');
  try{
    await cp(source,buildSource,{recursive:true,verbatimSymlinks:true});
    return {directory,source:buildSource};
  }catch(error){
    await rm(directory,{recursive:true,force:true});
    throw error;
  }
}
