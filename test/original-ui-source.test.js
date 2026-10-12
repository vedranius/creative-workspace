import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {originalUiDiffArgs,originalUiSourceDiff,assertOriginalUiSource} from '../scripts/original-ui-source.mjs';
const exec=promisify(execFile);
test('reviewed patch identity survives abbreviated Git IDs and formatting config',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cw-source-diff-'));
 const git=async args=>(await exec('git',['-C',root,...args])).stdout;
 try{await git(['init','--quiet']);await writeFile(path.join(root,'source.rs'),'fn old() {}\n');await git(['add','source.rs']);await git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','base']);await writeFile(path.join(root,'source.rs'),'fn new() {}\n');
 const short=await git(['-c','core.abbrev=7','diff','HEAD','--']),long=await git(['-c','core.abbrev=12','diff','HEAD','--']);assert.notEqual(short,long);
 const canonical=await git(['-c','core.abbrev=7',...originalUiDiffArgs]);assert.match(canonical,/index [a-f0-9]{40}\.\.[a-f0-9]{40}/);assert.equal(await git(['-c','core.abbrev=12','-c','diff.noprefix=true','-c','diff.context=8','-c','diff.algorithm=histogram','-c','diff.indentHeuristic=false',...originalUiDiffArgs]),canonical);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('reviewed patch identity includes new untracked source files without staging them',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cw-source-diff-new-'));
 const git=async args=>(await exec('git',['-C',root,...args])).stdout;
 try{
  await git(['init','--quiet']);await writeFile(path.join(root,'base.txt'),'base\n');await git(['add','base.txt']);await git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','base']);
  await writeFile(path.join(root,'new source.js'),'reviewed content\n');
  const expected=await git(['add','--intent-to-add','--','new source.js']).then(()=>git([...originalUiDiffArgs]));
  await git(['reset','--quiet','--','new source.js']);
  assert.equal(await originalUiSourceDiff(root),expected);
  assert.equal(await git(['ls-files','--others','--exclude-standard']),'new source.js\n');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('pre-build source check rejects short patch headers and unreviewed edits',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cw-source-prebuild-'));
 const git=async args=>(await exec('git',['-C',root,...args])).stdout;
 try{
  await git(['init','--quiet']);await writeFile(path.join(root,'source.rs'),'fn old() {}\n');await git(['add','source.rs']);
  await git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','base']);
  await writeFile(path.join(root,'source.rs'),'fn reviewed() {}\n');
  const short=await git(['-c','core.abbrev=7','diff','HEAD','--']);
  await assert.rejects(assertOriginalUiSource(root,short,'before build'),/exact reviewed patch \(before build\)/);
  const canonical=await originalUiSourceDiff(root);
  await assertOriginalUiSource(root,Buffer.from(canonical),'before build');
  await writeFile(path.join(root,'source.rs'),'fn unreviewed() {}\n');
  await assert.rejects(assertOriginalUiSource(root,canonical,'after build'),/exact reviewed patch/);
  await writeFile(path.join(root,'source.rs'),'fn reviewed() {}\n');
  await writeFile(path.join(root,'unexpected.rs'),'fn extra() {}\n');
  await assert.rejects(assertOriginalUiSource(root,canonical,'before build'),/exact reviewed patch/);
  assert.equal(await git(['ls-files','--others','--exclude-standard']),'unexpected.rs\n');
 }finally{await rm(root,{recursive:true,force:true});}
});
