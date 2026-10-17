// Reproduce the public CC0 Canon fixture's native/Quality/Speed pixel proof.
// All downloaded and compiled inputs stay in a temporary directory; only JSON
// evidence and the license/provenance record are written to the requested output.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=JSON.parse(await readFile(path.join(root,'docs/evidence/rapidraw-wasm/runtime-smoke.json'),'utf8'));
const fixture=evidence.fixtures.find(item=>item.id==='raw.pixls.us 1327');
assert.ok(fixture&&fixture.license==='CC0-1.0','Pinned public CC0 fixture metadata missing');
const output=path.resolve(process.argv[2]||'artifacts/rapidraw-pixel-parity');
const temp=await import('node:fs/promises').then(fs=>fs.mkdtemp(path.join(os.tmpdir(),'cw-rapidraw-parity-')));
await mkdir(output,{recursive:true});
const targetDir=path.resolve(process.env.CARGO_TARGET_DIR||path.join(temp,'target'));
function run(command,args,options={}){return new Promise((resolve,reject)=>{
 const child=spawn(command,args,{cwd:options.cwd||root,env:{...process.env,CARGO_TARGET_DIR:targetDir,...options.env},stdio:['ignore','pipe','inherit']});let stdout='';
 child.stdout.on('data',chunk=>stdout+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve(stdout.trim()):reject(Error(`${command} ${args.join(' ')} exited ${code}`)));
});}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 const input=path.join(temp,'fixture.dng');
 const response=await fetch(fixture.sourceUrl,{redirect:'error'});assert.equal(response.status,200,`Fixture download HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(digest(bytes),fixture.sourceSha256,'Public fixture SHA256 mismatch');await writeFile(input,bytes);
 await run('cargo',['test','--locked','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml']);
 const exposureReference=JSON.parse(await run('cargo',['run','--locked','--release','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','exposure_pixels_reference']));
 const stage=path.join(temp,'quality-stage');
 await run('node',['scripts/prepare-rapidraw-quality.mjs',stage]);
 await copyFile(path.join(root,'patches/rapidraw-rawler/a32bc1ff/ppg-wasm-profiling.patch'),path.join(output,'ppg-wasm-profiling.patch'));
 await copyFile(path.join(root,'experiments/rapidraw-wasm-core/tests/reference/RapidRAW-LICENSE'),path.join(output,'RapidRAW-LICENSE'));
 const crate=path.join(stage,'probe'),wasmOut=path.join(temp,'wasm');await mkdir(wasmOut);
 const native={},probe={},pngs={};
 for(const [mode,flag] of [['quality','quality'],['speed','fast']]){
  pngs[mode]=path.join(temp,`${mode}-native.png`);
  native[mode]=JSON.parse(await run('cargo',['run','--locked','--release','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','develop_reference','--',input,flag,pngs[mode]]));
  probe[mode]=JSON.parse(await run('cargo',['run','--locked','--release','--manifest-path','experiments/rapidraw-wasm-core/Cargo.toml','--example','develop_probe','--',input,flag==='fast'?'fast':'']));
  assert.equal(probe[mode].componentF32BitsSha256,native[mode].rgbF32BitsSha256,`Native probe differs in ${mode}`);
 }
 await run('cargo',['build','--locked','--release','--target','wasm32-unknown-unknown','--manifest-path',path.join(crate,'Cargo.toml'),'--features','quality-timer-compat']);
 await run('wasm-bindgen',['--target','web','--out-dir',wasmOut,path.join(targetDir,'wasm32-unknown-unknown/release/cw_rapidraw_wasm_probe.wasm')]);
 await copyFile(path.join(stage,'quality-timer-compat.json'),path.join(wasmOut,'quality-timer-compat.json'));
 const reports={};
 for(const mode of ['quality','speed']){
  const report=path.join(output,`${mode}-wasm.json`);
  await run('node',['scripts/smoke-rapidraw-development.mjs',wasmOut,input,
   await writeJson(temp,`${mode}-native.json`,native[mode]),await writeJson(temp,`${mode}-probe.json`,probe[mode]),report,mode==='speed'?'fast':'quality'],
   {env:{PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE||'playwright',CHROMIUM_PATH:process.env.CHROMIUM_PATH||''}});
  reports[mode]=JSON.parse(await readFile(report,'utf8'));
  const pngReport=path.join(output,`${mode}-png-browser.json`);
  await run('node',['scripts/smoke-rapidraw-png.mjs',wasmOut,input,pngs[mode],pngReport,mode==='speed'?'fast':'quality']);
  reports[`${mode}Png`]=JSON.parse(await readFile(pngReport,'utf8'));
 }
 const exposureReport=path.join(output,'exposure-pixels-browser.json');
 await run('node',['scripts/smoke-rapidraw-exposure-pixels.mjs',wasmOut,
  await writeJson(temp,'exposure-pixels-native.json',exposureReference),exposureReport],
  {env:{PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE||'playwright',CHROMIUM_PATH:process.env.CHROMIUM_PATH||''}});
 reports.exposurePixels=JSON.parse(await readFile(exposureReport,'utf8'));
 await copyFile(path.join(root,'experiments/rapidraw-wasm-core/assets/sRGB-v2-magic.icc'),path.join(output,'sRGB-v2-magic.icc'));
 await copyFile(path.join(root,'experiments/rapidraw-wasm-core/assets/README.md'),path.join(output,'icc-attribution.md'));
 for(const name of ['png-branch.txt','png-phys.rs','png-chunk.rs'])await copyFile(path.join(root,'experiments/rapidraw-wasm-core/tests/reference',name),path.join(output,name));
 const pngProvenance=JSON.parse(await readFile(path.join(root,'experiments/rapidraw-wasm-core/UPSTREAM.json'),'utf8')).pngExportReference;
 const provenance={schemaVersion:1,pngCodec:pngProvenance,fixture:{id:fixture.id,sourceUrl:fixture.sourceUrl,sourceSha256:fixture.sourceSha256,license:fixture.license,licenseSourceUrl:fixture.licenseSourceUrl,licenseUrl:fixture.licenseUrl},nativeSource:{repo:'CyberTimon/RapidRAW',commit:evidence.nativeSource,license:'AGPL-3.0',licenseText:'RapidRAW-LICENSE'},decoder:{repo:'CyberTimon/RapidRAW-DngLab',commit:evidence.decoderSource,license:'LGPL-2.1',licenseUrl:'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html'},qualityPatch:{...JSON.parse(await readFile(path.join(stage,'quality-timer-compat.json'),'utf8')).patch,artifact:'ppg-wasm-profiling.patch'},toolchain:{rustc:(await run('rustc',['--version'])),wasmBindgen:(await run('wasm-bindgen',['--version']))},fixtureBytes:bytes.length,results:Object.fromEntries(Object.entries(reports).map(([mode,report])=>[mode,{dimensions:report.dimensions,png:report.png,browser:report.browser,pixelHash:report.pixelHash,exactRGBF32BitsSha256Matches:report.exactRGBF32BitsSha256Matches,pageErrors:report.pageErrors,failedRequests:report.failedRequests}]))};
 await writeFile(path.join(output,'provenance-and-license.json'),JSON.stringify(provenance,null,2)+'\n');
 console.log(JSON.stringify({quality:provenance.results.quality,speed:provenance.results.speed,output}));
}finally{await import('node:fs/promises').then(fs=>fs.rm(temp,{recursive:true,force:true}));}
async function writeJson(directory,name,value){const file=path.join(directory,name);await writeFile(file,JSON.stringify(value));return file;}
