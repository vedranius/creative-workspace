import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {originalUiDiffArgs} from '../scripts/original-ui-source.mjs';
const exec=promisify(execFile);
test('reviewed patch identity survives abbreviated Git IDs and formatting config',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cw-source-diff-'));
 const git=async args=>(await exec('git',['-C',root,...args])).stdout;
 try{await git(['init','--quiet']);await writeFile(path.join(root,'source.rs'),'fn old() {}\n');await git(['add','source.rs']);await git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','base']);await writeFile(path.join(root,'source.rs'),'fn new() {}\n');
 const short=await git(['-c','core.abbrev=7','diff','HEAD','--']),long=await git(['-c','core.abbrev=12','diff','HEAD','--']);assert.notEqual(short,long);
 const canonical=await git(['-c','core.abbrev=7',...originalUiDiffArgs]);assert.match(canonical,/index [a-f0-9]{40}\.\.[a-f0-9]{40}/);assert.equal(await git(['-c','core.abbrev=12','-c','diff.noprefix=true','-c','diff.context=8','-c','diff.algorithm=histogram','-c','diff.indentHeuristic=false',...originalUiDiffArgs]),canonical);
 }finally{await rm(root,{recursive:true,force:true});}
});
