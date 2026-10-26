import assert from 'node:assert/strict';
import {access,cp,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {assertOriginalUiSource} from './original-ui-source.mjs';
import {originalUiPatches} from '../src/original-ui.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.length!==4)throw Error('Usage: verify-designcraft-native-contract.mjs REVIEWED_UI_SOURCE NEW_EVIDENCE_DIRECTORY');
const source=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
const patch=await readFile(path.join(root,originalUiPatches.designcraft.path));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(patch),originalUiPatches.designcraft.sha256);
await assertOriginalUiSource(source,patch,'before current native contract');
await mkdir(output,{recursive:true});
const required=['cell-fixture.designcraft','reference-fixture.designcraft','endnote-body.designcraft','endnote-options-fixture.designcraft','endnote-edit-fixture.designcraft','endnote-delete-fixture.designcraft','endnote-list-fixture.designcraft','endnote-list-native.json'];
for(const name of [...required,'native-contract-source.json']){
 try{await access(path.join(output,name));}catch(error){if(error.code==='ENOENT')continue;throw error;}
 throw Error(`Refuse stale native evidence: ${name}`);
}
const adapter=path.join(source,'apps/cw-designcraft-engine');
const temporary=await mkdtemp(path.join(path.dirname(source),'cw-native-contract-'));
const backup=path.join(temporary,'adapter');
await cp(adapter,backup,{recursive:true});
let stagedMain;
try{
 // The reviewed UI patch embeds an older adapter. Test the same current
 // adapter installed by manage-designcraft, without changing UI provenance.
 await cp(path.join(root,'engines/designcraft/native'),adapter,{recursive:true});
 stagedMain=await readFile(path.join(adapter,'src/main.rs'));
 assert.deepEqual(stagedMain,await readFile(path.join(root,'engines/designcraft/native/src/main.rs')));
 const env={...process.env};
 for(const key of ['CW_FOOTNOTE_OUTPUT','CW_ENDNOTE_OUTPUT','CW_ENDNOTE_OPTIONS_OUTPUT','CW_ENDNOTE_EDIT_OUTPUT','CW_ENDNOTE_DELETE_OUTPUT','CW_ENDNOTE_LIST_OUTPUT'])env[key]=output;
 env.CW_DESIGNCRAFT_CELL_FIXTURE=path.join(output,'cell-fixture.designcraft');
 await new Promise((resolve,reject)=>{
  const child=spawn('cargo',['test','--locked','--manifest-path',path.join(source,'Cargo.toml'),'-p','cw-designcraft-engine'],{cwd:root,env,stdio:'inherit'});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`Current native contract failed (${code})`)));
 });
 for(const name of required)assert.ok((await readFile(path.join(output,name))).length,`Missing current native fixture: ${name}`);
 const report=JSON.parse(await readFile(path.join(output,'endnote-list-native.json')));
 assert.equal(report.originalQueryExact,true);assert.equal(report.numberingUsesPageOrderNotStoryId,true);
}finally{
 await rm(adapter,{recursive:true,force:true});await cp(backup,adapter,{recursive:true});
 await assertOriginalUiSource(source,patch,'after current native contract restoration');
 await rm(temporary,{recursive:true,force:true});
}
await writeFile(path.join(output,'native-contract-source.json'),JSON.stringify({adapterMainSha256:hash(stagedMain),uiPatchSha256:hash(patch),reviewedUiSourceRestored:true,freshFixtures:required},null,2)+'\n');
console.log('Current owned native contract and fresh fixtures passed; exact reviewed UI source restored');
