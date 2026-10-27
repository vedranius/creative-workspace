// Experimental original UI build; never installs over a shipped package.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,rm,access,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createWriteStream} from 'node:fs';
import {originalUiPins,originalUiPatches} from '../src/original-ui.js';
import {assertOriginalUiSource,originalUiSourceDiff} from './original-ui-source.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const meta=JSON.parse(await readFile(path.join(root,'experiments/designcraft-endnote-target/BROWSER.json')));
const overlay=await readFile(path.join(root,meta.overlayPatch.path));assert.equal(hash(overlay),meta.overlayPatch.sha256);
assert.equal(originalUiPins.designcraft,meta.sourcePin);
assert.equal(hash(await readFile(path.join(root,meta.inputBridge.patch))),meta.inputBridge.sha256);
for(const [name,sha]of Object.entries(meta.inputBridge.baseFiles))assert.equal(hash(await readFile(path.join(root,name))),sha);
const base=await readFile(path.join(root,originalUiPatches.designcraft.path));assert.equal(hash(base),meta.basePatchSha256);
for(const item of Object.values(meta.addedFiles))assert.equal(hash(await readFile(path.join(root,item.from))),item.sha256);
if(process.env.PROVENANCE_ONLY){console.log('Original Endnote browser candidate source/overlay/modules/transport provenance valid');process.exit(0);}
const [sourceArg,outputArg]=process.argv.slice(2);if(!outputArg)throw Error('PINNED_PATCHED_SOURCE EMPTY_OUTPUT');
const source=path.resolve(sourceArg),output=path.resolve(outputArg),exec=promisify(execFile);
assert.equal((await exec('git',['-C',source,'rev-parse','HEAD'])).stdout.trim(),meta.sourcePin);
await assertOriginalUiSource(source,base,'before browser candidate');await mkdir(output);
const backups=new Map(),added=[];
for(const name of Object.keys(meta.overlayPatch.patchedFiles))backups.set(name,await readFile(path.join(source,name)));
for(const name of Object.keys(meta.addedFiles))await access(path.join(source,name)).then(()=>{throw Error('Candidate source already exists');},e=>{if(e.code!=='ENOENT')throw e;});
const run=async(cmd,args,log,cwd=source)=>{
 const stream=createWriteStream(path.join(output,log));
 try{await new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,env:{...process.env,CARGO_BUILD_JOBS:'1'},stdio:['ignore','pipe','pipe']});p.stdout.pipe(stream,{end:false});p.stderr.pipe(stream,{end:false});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`${cmd} failed (${code})`)));});}
 finally{await new Promise(resolve=>stream.end(resolve));}
};
let staged=false,sourceProof;
try{
 staged=true;await exec('git',['-C',source,'apply',path.join(root,meta.overlayPatch.path)]);
 for(const [name,item]of Object.entries(meta.addedFiles)){await writeFile(path.join(source,name),await readFile(path.join(root,item.from)),{flag:'wx'});added.push(name);}
 for(const [name,sha]of Object.entries(meta.overlayPatch.patchedFiles))assert.equal(hash(await readFile(path.join(source,name))),sha,name);
 const combined=await originalUiSourceDiff(source);
 sourceProof={...meta,combinedSourcePatchSha256:hash(Buffer.from(combined)),nativeUiTests:true,shippedUiChanged:false};
 await writeFile(path.join(output,'source.patch'),combined);
 await run('cargo',['test','--locked','-p','designcraft-ui-egui'],'ui-tests.log');
 await run(process.env.CW_TRUNK_BINARY||'trunk',['build','--release','--dist',path.join(output,'assets')],'ui-build.log',path.join(source,'apps/designcraft-web'));
 assert.equal(await originalUiSourceDiff(source),combined,'Build changed reviewed candidate source');
}finally{
 if(staged){for(const [name,bytes]of backups)await writeFile(path.join(source,name),bytes);for(const name of added)await rm(path.join(source,name));}
 await assertOriginalUiSource(source,base,'after browser candidate restoration');
}
const files=[];
async function walk(relative=''){for(const e of await readdir(path.join(output,'assets',relative),{withFileTypes:true})){const name=path.join(relative,e.name);if(e.isDirectory())await walk(name);else{const bytes=await readFile(path.join(output,'assets',name));files.push({path:name.replaceAll(path.sep,'/'),bytes:bytes.length,sha256:hash(bytes)});}}}
await walk();assert.equal(files.filter(f=>f.path.endsWith('.wasm')).length,1);
const tests=await readFile(path.join(output,'ui-tests.log'),'utf8');assert.match(tests,/test result: ok\. 189 passed; 0 failed; 1 ignored/);
await writeFile(path.join(output,'candidate-manifest.json'),JSON.stringify({...sourceProof,sourceRestored:true,uiTests:[189,0,1],files},null,2)+'\n');
console.log('Original browser candidate/native UI tests/WASM build complete; exact source restored');
