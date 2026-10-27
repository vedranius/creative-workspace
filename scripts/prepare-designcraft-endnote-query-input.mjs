// Experimental input bridge copied outside the shipped gateway/native source.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,cp,rm,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createWriteStream,createReadStream} from 'node:fs';
const fileHash=async name=>{const h=createHash('sha256');for await(const chunk of createReadStream(name))h.update(chunk);return h.digest('hex');};
import {originalUiPatches} from '../src/original-ui.js';
import {assertOriginalUiSource} from './original-ui-source.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex'),exec=promisify(execFile);
const meta=JSON.parse(await readFile(path.join(root,'experiments/designcraft-endnote-target/BROWSER.json'))),input=meta.inputBridge;
const patch=await readFile(path.join(root,input.patch));assert.equal(hash(patch),input.sha256);
for(const [name,sha]of Object.entries(input.baseFiles))assert.equal(hash(await readFile(path.join(root,name))),sha);
if(process.env.PROVENANCE_ONLY){console.log('Experimental original text.move input bridge provenance valid');process.exit(0);}
const [sourceArg,outputArg]=process.argv.slice(2);if(!outputArg)throw Error('REVIEWED_UI_SOURCE EMPTY_OUTPUT');
if(!process.env.CARGO_TARGET_DIR)throw Error('Set the existing CARGO_TARGET_DIR');
const source=path.resolve(sourceArg),output=path.resolve(outputArg),base=await readFile(path.join(root,originalUiPatches.designcraft.path));
assert.equal((await exec('git',['-C',source,'rev-parse','HEAD'])).stdout.trim(),meta.sourcePin);
await assertOriginalUiSource(source,base,'before input bridge');await mkdir(output);
await cp(path.join(root,'src'),path.join(output,'src'),{recursive:true});
await cp(path.join(root,'engines/designcraft/native'),path.join(output,'engines/designcraft/native'),{recursive:true});
await cp(path.join(root,'package.json'),path.join(output,'package.json'));
for(const name of ['public','node_modules'])await symlink(path.join(root,name),path.join(output,name),process.platform==='win32'?'junction':'dir');
await exec('git',['apply',path.join(root,input.patch)],{cwd:output});
for(const [name,sha]of Object.entries(input.patchedFiles))assert.equal(hash(await readFile(path.join(output,name))),sha);
const adapter=path.join(source,'apps/cw-designcraft-engine'),backup=path.join(output,'original-adapter');await cp(adapter,backup,{recursive:true});
const fixtures=path.join(output,'native-fixtures');await mkdir(fixtures);
const env={...process.env,CARGO_BUILD_JOBS:'1',CW_DESIGNCRAFT_CELL_FIXTURE:path.join(fixtures,'cell-fixture.designcraft')};
for(const k of ['CW_FOOTNOTE_OUTPUT','CW_ENDNOTE_OUTPUT','CW_ENDNOTE_OPTIONS_OUTPUT','CW_ENDNOTE_EDIT_OUTPUT','CW_ENDNOTE_DELETE_OUTPUT','CW_ENDNOTE_LIST_OUTPUT'])env[k]=fixtures;
const run=async(args,name)=>{const log=createWriteStream(path.join(output,name));try{await new Promise((resolve,reject)=>{const p=spawn('cargo',args,{cwd:source,env,stdio:['ignore','pipe','pipe']});p.stdout.pipe(log,{end:false});p.stderr.pipe(log,{end:false});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`Native input candidate failed (${code})`)));});}finally{await new Promise(r=>log.end(r));}};
try{
 await cp(path.join(output,'engines/designcraft/native'),adapter,{recursive:true});
 await run(['test','--locked','-p','cw-designcraft-engine'],'native-tests.log');
 await run(['build','--locked','-p','cw-designcraft-engine'],'native-build.log');
 await cp(path.join(process.env.CARGO_TARGET_DIR,'debug','cw-designcraft-engine'+(process.platform==='win32'?'.exe':'')),path.join(output,'worker'+(process.platform==='win32'?'.exe':'')));
}finally{await rm(adapter,{recursive:true,force:true});await cp(backup,adapter,{recursive:true});await assertOriginalUiSource(source,base,'after input bridge');await rm(backup,{recursive:true,force:true});}
assert.match(await readFile(path.join(output,'native-tests.log'),'utf8'),/test result: ok\. 25 passed; 0 failed/);
await writeFile(path.join(output,'input-manifest.json'),JSON.stringify({sourcePin:meta.sourcePin,inputBridge:input,workerSha256:await fileHash(path.join(output,'worker'+(process.platform==='win32'?'.exe':''))),nativeTests:25,sourceRestored:true,shippedSourceChanged:false},null,2)+'\n');
console.log('Experimental original native input bridge built/tested; exact source restored');
