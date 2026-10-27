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
const original=await readFile(lib);let installed=false;let reply,referenceCases=[],restored=false;
try{
 const session=await design.create(project);id=session.id;
 const call=(method,params={},extra={})=>design.execute(id,{method,params,requestId:randomUUID(),...extra});
 const opened=await call('file.open',{path:'fixture.designcraft'});const before=await call('state');
 reply=await call('endnote.list',{}, {expectedVersion:opened.stateVersion});assert.equal(reply.readOnly,true);assert.equal(reply.stateVersion,before.stateVersion);assert.equal(reply.result.notes.length,2);
 assert.deepEqual(reply.result.notes.map(n=>[n.story,n.id,n.text]),[[19,1,'First page Ω'],[10,1,'Second page č']]);assert.deepEqual(reply.documentSnapshot,before.documentSnapshot);assert.deepEqual(reply.document,before.document);
 await writeFile(path.join(output,'gateway-reply.private.json'),JSON.stringify(reply));
 // Actual native selections in a generated document, with two references in one
 // story. Insert id2 before id1; IDs, within-story ordinal and document number differ.
 await call('page.select',{index:0});
 await call('text.select',{story:19,anchor:0,focus:0});
 const prefix='Ž😀 ';await call('text.insert',{text:prefix});
 await call('text.select',{story:19,anchor:Buffer.byteLength(prefix),focus:Buffer.byteLength(prefix)});
 await call('endnote.insert',{text:'Inserted before original Ž😀'});
 const mapped=await call('endnote.list');
 assert.deepEqual(mapped.result.notes.map(n=>[n.story,n.id,n.number]),[[19,2,1],[19,1,2],[10,1,3]]);
 for(const [story,index] of [[19,0],[10,1]]){
  await call('page.select',{index});const current=await call('state');
  const body=current.documentSnapshot.stories[String(story)];let ordinal=0;
  for(const match of body.text.matchAll(/\uE00F/gu)){
   const start=Buffer.byteLength(body.text.slice(0,match.index)),end=start+Buffer.byteLength(match[0]),id=body.endnotes[ordinal++].id;
   for(const [anchor,focus] of [[start,end],[end,start]]){
    const selected=await call('text.select',{story,anchor,focus});
    const query=await call('endnote.list',{}, {expectedVersion:selected.stateVersion});
    assert.equal(query.stateVersion,selected.stateVersion);assert.deepEqual(query.document.selection.text,{story,anchor,focus});
    assert.deepEqual(query.documentSnapshot,selected.documentSnapshot);assert.deepEqual(query.document.selection,selected.document.selection);
    referenceCases.push({story,id,anchor,focus,reply:query});
   }
  }
 }
 assert.equal(referenceCases.length,6);
 await writeFile(path.join(output,'reference-replies.private.json'),JSON.stringify(referenceCases));
 await design.close(id,{discard:true});id=null;design.shutdown();
 await access(modulePath).then(()=>{throw Error('Candidate module already exists');},e=>{if(e.code!=='ENOENT')throw e;});
 await writeFile(modulePath,moduleBytes,{flag:'wx'});installed=true;
 await writeFile(lib,Buffer.concat([original,Buffer.from('\n#[cfg(test)]\nmod cw_endnote_target_candidate;\n')]));
 const env={...process.env,CW_ENDNOTE_TARGET_REPLY:path.resolve(output,'gateway-reply.private.json'),CW_ENDNOTE_REFERENCE_REPLIES:path.resolve(output,'reference-replies.private.json'),CARGO_BUILD_JOBS:'1'};
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
for(const name of ['actual_native_body_ranges_open_source_ids_forward_and_backward_without_manual_targets','caret_partial_utf8_ordinary_text_ambiguous_range_and_nonbody_contexts_never_choose_a_note','original_reference_ordinal_is_not_note_id_or_document_number_and_invalid_mapping_refuses','selected_reference_query_cannot_overwrite_new_selection_draft_or_session_and_drop_is_inert'])assert.ok(tests.includes(name+' ... ok'),name);
const report={scope:contract.scope,sourcePin:contract.sourcePin,basePatchSha256:hash(patch),candidateModuleSha256:hash(moduleBytes),workerSha256:hash(await readFile(binary)),generatedFixtureSha256:hash(input),gatewayCanonicalSha256:hash(Buffer.from(JSON.stringify(reply.documentSnapshot))),notes:reply.result.notes,queryReadOnly:true,wireDocumentNormalizedByOriginalModel:true,strictDocumentSchemaShape:true,sourceNumberingOrderExact:true,originalGenericEditForm:true,originalConfirmCommandExact:true,noMirrorMutationBeforeAck:true,opaqueContextConsumed:true,explicitTargetOnly:true,staleContextAndSessionAndDocumentUidRejected:true,draftPaletteBusyQueueProtected:true,malformedResultBudgetsAndSourceQueryValidated:true,selectedOriginalBodyReference:true,exactUtf8ForwardReverseRanges:true,originalReferenceOrdinalNotIdOrNumber:true,referenceCases:referenceCases.map(({story,id,anchor,focus,reply})=>({story,id,anchor,focus,revision:reply.stateVersion,canonicalSha256:hash(Buffer.from(JSON.stringify(reply.documentSnapshot)))})),sourceRestored:restored,uiTests:tests.match(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored/).slice(1).map(Number),browserIntegrated:false,shippedUiChanged:false,fullAppAccepted:false};
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Candidate original Endnotes target service/native gateway/UI tests passed; source restored');
