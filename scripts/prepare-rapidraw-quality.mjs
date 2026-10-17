// Prepare an isolated, exact-pin rawler timing-only compatibility build.
// Never edits Cargo's shared source cache, native RapidRAW or user workspaces.
import {readFile,writeFile,mkdir,readdir,cp,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'experiments/rapidraw-wasm-core');
const metadata=JSON.parse(await readFile(path.join(source,'UPSTREAM.json'),'utf8'));
const repo='https://github.com/CyberTimon/RapidRAW-DngLab.git';
const pin='a32bc1ff1f4f3c56d4d3226082f6eb17414f9159';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function run(args,cwd){return new Promise((resolve,reject)=>{
 const child=spawn('git',args,{cwd,stdio:['ignore','pipe','pipe']});let out='',err='';
 child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
 child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()):reject(Error(`git ${args[0]} failed: ${err}`)));
});}
export async function prepareQuality(directory){
 if(metadata.decoder.commit!==pin||metadata.decoder.repo!=='CyberTimon/RapidRAW-DngLab')throw Error('Unexpected decoder identity');
 const destination=path.resolve(directory);
 if(destination===root||destination.startsWith(source+path.sep))throw Error('Staging must be outside the source crate');
 await mkdir(destination,{recursive:true});if((await readdir(destination)).length)throw Error('Staging directory must be empty');
 const patch=await readFile(path.join(root,metadata.qualityTimerPatch.path));
 if(hash(patch)!==metadata.qualityTimerPatch.sha256)throw Error('Reviewed patch integrity failed');
 const decoder=path.join(destination,'decoder'),crate=path.join(destination,'probe');
 await mkdir(decoder);await run(['init','--quiet'],decoder);
 const hooks=path.join(destination,'disabled-hooks');await mkdir(hooks);
 // Fixed, reviewed upstream only; no arbitrary repository import or code hooks.
 await run(['-c',`core.hooksPath=${hooks}`,'fetch','--quiet','--depth=1',repo,pin],decoder);
 await run(['-c',`core.hooksPath=${hooks}`,'checkout','--quiet','--detach','FETCH_HEAD'],decoder);
 if(await run(['rev-parse','HEAD'],decoder)!==pin)throw Error('Fetched source pin differs');
 const target=path.join(decoder,metadata.qualityTimerPatch.file);
 if(hash(await readFile(target))!==metadata.qualityTimerPatch.beforeSha256)throw Error('Original PPG source differs');
 await run(['apply','--check',path.join(root,metadata.qualityTimerPatch.path)],decoder);
 await run(['apply',path.join(root,metadata.qualityTimerPatch.path)],decoder);
 const changed=(await run(['diff','--name-only'],decoder)).split('\n');
 if(changed.length!==1||changed[0]!==metadata.qualityTimerPatch.file||hash(await readFile(target))!==metadata.qualityTimerPatch.afterSha256)throw Error('Patched source scope/hash differs');
 await mkdir(crate);
 for(const name of ['Cargo.toml','Cargo.lock','UPSTREAM.json','src','examples','tests','worker.js','decoder-worker.js','decoder-client.js','decoder-client.test.mjs']){
  await cp(path.join(source,name),path.join(crate,name),{recursive:(await stat(path.join(source,name))).isDirectory()});
 }
 const manifest=await readFile(path.join(crate,'Cargo.toml'),'utf8');
 const dependency=`rawler = { git = "${repo}", rev = "${pin}" }`;
 if(manifest.split(dependency).length!==2)throw Error('Decoder manifest binding differs');
 await writeFile(path.join(crate,'Cargo.toml'),manifest.replace(dependency,'rawler = { path = "../decoder/rawler" }')+'\n[workspace]\n');
 const lock=await readFile(path.join(crate,'Cargo.lock'),'utf8');
 const binding=`source = "git+${repo}?rev=${pin}#${pin}"\n`;
 const start=lock.indexOf('[[package]]\nname = "rawler"\n'),end=lock.indexOf('[[package]]',start+1);
 if(start<0||!lock.slice(start,end).includes(binding))throw Error('Locked decoder identity differs');
 const patchedLock=lock.slice(0,start)+lock.slice(start,end).replace(binding,'')+lock.slice(end);
 await writeFile(path.join(crate,'Cargo.lock'),patchedLock);
 const provenance={schemaVersion:1,decoderSource:pin,patch:metadata.qualityTimerPatch,scope:'Isolated timer-patched rawler plus source-equivalent probe; only wasm32 profiling is removed, native behavior and interpolation preserved'};
 await writeFile(path.join(crate,'quality-timer-compat.txt'),JSON.stringify(provenance)+'\n');
 await writeFile(path.join(destination,'quality-timer-compat.json'),JSON.stringify(provenance,null,2)+'\n');
 return {crate,provenance:path.join(destination,'quality-timer-compat.json'),features:'quality-timer-compat'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Usage: node scripts/prepare-rapidraw-quality.mjs EMPTY_STAGING_DIR');
 console.log(JSON.stringify(await prepareQuality(process.argv[2])));
}
