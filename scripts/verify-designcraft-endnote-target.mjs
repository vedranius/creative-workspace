// Candidate-only native original-UI service proof. No shipped source patch/WASM update.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir,rm,access} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createDesignCraft} from '../src/designcraft.js';
import {originalUiPins,originalUiPatches} from '../src/original-ui.js';
import {assertOriginalUiSource} from './original-ui-source.mjs';
const [source,binary,fixture,output]=process.argv.slice(2);
const hash=b=>createHash('sha256').update(b).digest('hex'),exec=promisify(execFile);
const contract=JSON.parse(await readFile(new URL('../experiments/designcraft-endnote-target/UPSTREAM.json',import.meta.url)));
const moduleBytes=await readFile(new URL('../experiments/designcraft-endnote-target/service.rs',import.meta.url));assert.equal(hash(moduleBytes),contract.moduleSha256);
const patch=await readFile(originalUiPatches.designcraft.path);assert.equal(hash(patch),contract.basePatchSha256);
assert.equal(originalUiPins.designcraft,contract.sourcePin);
if(process.env.PROVENANCE_ONLY){for(const key of ['fixtureSha256','workerSha256'])assert.match(contract[key],/^[a-f0-9]{64}$/);console.log('Candidate source/base patch/module/fixture/worker provenance contract valid');process.exit(0);}
if(!output)throw Error('PINNED_PATCHED_SOURCE OWNED_WORKER GENERATED_FIXTURE EMPTY_OUTPUT');
assert.equal((await exec('git',['-C',source,'rev-parse','HEAD'])).stdout.trim(),contract.sourcePin);
await assertOriginalUiSource(source,patch,'before candidate');await mkdir(output); // Refuse reuse of stale evidence.
const project=path.join(output,'project');await mkdir(project);const input=await readFile(fixture);assert.equal(hash(input),contract.fixtureSha256);assert.equal(hash(await readFile(binary)),contract.workerSha256);await writeFile(path.join(project,'fixture.designcraft'),input);
const design=createDesignCraft({binary,stateDir:path.join(output,'sessions')});let id;
const lib=path.join(source,'crates/ui-egui/src/lib.rs'),modulePath=path.join(source,'crates/ui-egui/src/cw_endnote_target_candidate.rs');
const original=await readFile(lib);let installed=false;let reply,restored=false;
try{
 const session=await design.create(project);id=session.id;
 const call=(method,params={},extra={})=>design.execute(id,{method,params,requestId:randomUUID(),...extra});
 const opened=await call('file.open',{path:'fixture.designcraft'});const before=await call('state');
 reply=await call('endnote.list',{}, {expectedVersion:opened.stateVersion});assert.equal(reply.readOnly,true);assert.equal(reply.stateVersion,before.stateVersion);assert.equal(reply.result.notes.length,2);
 assert.deepEqual(reply.result.notes.map(n=>[n.story,n.id,n.text]),[[19,1,'First page Ω'],[10,1,'Second page č']]);assert.deepEqual(reply.documentSnapshot,before.documentSnapshot);assert.deepEqual(reply.document,before.document);
 await writeFile(path.join(output,'gateway-reply.private.json'),JSON.stringify(reply));
 await design.close(id,{discard:true});id=null;design.shutdown();
 await access(modulePath).then(()=>{throw Error('Candidate module already exists');},e=>{if(e.code!=='ENOENT')throw e;});
 await writeFile(modulePath,moduleBytes,{flag:'wx'});installed=true;
 await writeFile(lib,Buffer.concat([original,Buffer.from('\n#[cfg(test)]\nmod cw_endnote_target_candidate;\n')]));
 const env={...process.env,CW_ENDNOTE_TARGET_REPLY:path.resolve(output,'gateway-reply.private.json'),CARGO_BUILD_JOBS:'1'};
 if(process.env.CW_RUST_TOOLCHAIN_BIN)env.PATH=path.resolve(process.env.CW_RUST_TOOLCHAIN_BIN)+path.delimiter+env.PATH;
 const log=await import('node:fs').then(m=>m.createWriteStream(path.join(output,'ui-tests.log')));
 try{await new Promise((resolve,reject)=>{const p=spawn('cargo',['test','--locked','-p','designcraft-ui-egui'],{cwd:source,env,stdio:['ignore','pipe','pipe']});p.stdout.pipe(log,{end:false});p.stderr.pipe(log,{end:false});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error('Original UI candidate tests failed ('+code+')')));});}
 finally{await new Promise(resolve=>log.end(resolve));}
}finally{
 if(id)await design.close(id,{discard:true}).catch(()=>{});design.shutdown();
 if(installed){await writeFile(lib,original);await rm(modulePath);}
 await assertOriginalUiSource(source,patch,'after candidate restoration');assert.equal(hash(await readFile(lib)),hash(original));restored=true;
}
assert.equal(hash(await readFile(fixture)),hash(input));
const tests=await readFile(path.join(output,'ui-tests.log'),'utf8');assert.match(tests,/test result: ok\./);assert.match(tests,/cw_endnote_target_candidate::tests::actual_gateway_query_opens_exact_original_form_and_confirm_waits_for_mutation_ack \.\.\. ok/);
const report={scope:contract.scope,sourcePin:contract.sourcePin,basePatchSha256:hash(patch),candidateModuleSha256:hash(moduleBytes),workerSha256:hash(await readFile(binary)),generatedFixtureSha256:hash(input),gatewayCanonicalSha256:hash(Buffer.from(JSON.stringify(reply.documentSnapshot))),notes:reply.result.notes,queryReadOnly:true,wireDocumentNormalizedByOriginalModel:true,strictDocumentSchemaShape:true,sourceNumberingOrderExact:true,originalGenericEditForm:true,originalConfirmCommandExact:true,noMirrorMutationBeforeAck:true,opaqueContextConsumed:true,explicitTargetOnly:true,staleContextAndSessionAndDocumentUidRejected:true,draftPaletteBusyQueueProtected:true,malformedResultBudgetsAndSourceQueryValidated:true,sourceRestored:restored,uiTests:tests.match(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored/).slice(1).map(Number),browserIntegrated:false,shippedUiChanged:false,fullAppAccepted:false};
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Candidate original Endnotes target service/native gateway/UI tests passed; source restored');
