import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {originalUiPins,originalUiPackageId} from '../src/original-ui.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(process.argv[2]||'build/original-ui/source-soundcraft');
const assets=path.resolve(process.argv[3]||'build/original-ui/assets-soundcraft');
const packages=path.resolve(process.argv[4]||'build/original-ui/packages');
const pin=originalUiPins.soundcraft;
const run=(cmd,args,options={})=>new Promise((resolve,reject)=>{
  const child=spawn(cmd,args,{cwd:root,stdio:'inherit',...options});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} failed (${code})`)));
});
const capture=(cmd,args,cwd)=>new Promise((resolve,reject)=>{
  const child=spawn(cmd,args,{cwd,stdio:['ignore','pipe','inherit']});let output='';
  child.stdout.on('data',chunk=>output+=chunk);child.on('error',reject);
  child.on('exit',code=>code===0?resolve(output.trim()):reject(new Error(`${cmd} failed (${code})`)));
});

await access(path.join(source,'.git'));
if(await capture('git',['rev-parse','HEAD'],source)!==pin)throw new Error('SoundCraft source must be at its exact pinned upstream revision');
if(await capture('git',['status','--porcelain','--untracked-files=all'],source))throw new Error('SoundCraft source must be clean before the original UI build');
await mkdir(assets,{recursive:true});
const env={...process.env,CARGO_BUILD_JOBS:'1',RAYON_NUM_THREADS:'1',CARGO_TARGET_DIR:process.env.CARGO_TARGET_DIR||path.join(root,'build/original-ui/target')};
if(env.NO_COLOR==='1')env.NO_COLOR='true';
if(process.env.CW_SKIP_ORIGINAL_BUILD!=='1')await run('trunk',['build','--release','--dist',assets],{cwd:path.join(source,'apps/soundcraft-web'),env});
await run(process.execPath,['scripts/install-original-ui.mjs','soundcraft',source,assets],{cwd:root,env:{...process.env,CW_ORIGINAL_UI_DIR:packages}});
const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
await mkdir(packages,{recursive:true});
await writeFile(path.join(packages,'INSTALL-SOUNDCRAFT.txt'),`Creative Workspace ${version}: original SoundCraft browser preview\n\nThis package contains the unchanged original SoundCraft web build from storytold/soundcraft at ${pin}. Install it under a NEW original-UI package root and start Creative Workspace with CW_ORIGINAL_UI_DIR pointing there. Open /original/soundcraft/ to try the original audio workstation interface.\n\nThis is a browser-local WASM preview: session editing, audio decode/DSP, playback and export are not server-owned. Microphone capture/playback require explicit browser permission; live monitoring latency is not promised. Server-owned session/actions/DSP/decode/mix/export, bounded media streaming, provider paths, real destination write acknowledgement/recovery, native OS support and full SoundCraft parity are separate acceptance work. The source code is MIT OR Apache-2.0. NOTICE and ATTRIBUTION are included in package provenance; ArtCraft marks retain separate terms in provenance/docs/brand/LICENSE-brand.txt. No additional sample media is bundled.\n`);
await mkdir(path.join(root,'dist'),{recursive:true});
const name=`creative-workspace-${version}-soundcraft-original-ui.tar.gz`;
await run('tar',['-czf',path.join(root,'dist',name),'-C',packages,`soundcraft/${originalUiPackageId('soundcraft')}`,'INSTALL-SOUNDCRAFT.txt']);
const hash=createHash('sha256').update(await readFile(path.join(root,'dist',name))).digest('hex');
await writeFile(path.join(root,'dist',`${name}.sha256`),`${hash}  ${name}\n`);
console.log(`Built original SoundCraft browser preview at ${pin}; processing remains browser-local.`);
