import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {originalUiPins,originalUiPackageId} from '../src/original-ui.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(process.argv[2]||'build/original-ui/source-figcraft');
const assets=path.resolve(process.argv[3]||'build/original-ui/assets-figcraft');
const packages=path.resolve(process.argv[4]||'build/original-ui/packages');
const pin=originalUiPins.figcraft;
const run=(cmd,args,options={})=>new Promise((resolve,reject)=>{
  const child=spawn(cmd,args,{cwd:root,stdio:'inherit',...options});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} failed (${code})`)));
});
const runCapture=(cmd,args,cwd)=>new Promise((resolve,reject)=>{
  const child=spawn(cmd,args,{cwd,stdio:['ignore','pipe','inherit']});let output='';
  child.stdout.on('data',chunk=>output+=chunk);child.on('error',reject);
  child.on('exit',code=>code===0?resolve(output.trim()):reject(new Error(`${cmd} failed (${code})`)));
});

await access(path.join(source,'.git'));
if(await runCapture('git',['rev-parse','HEAD'],source)!==pin)throw new Error('FigCraft source must be at its exact pinned upstream revision');
if(await runCapture('git',['status','--porcelain','--untracked-files=all'],source))throw new Error('FigCraft source must be clean before the original UI build');
await mkdir(assets,{recursive:true});
const buildEnv={...process.env,CARGO_BUILD_JOBS:'1',RAYON_NUM_THREADS:'1',CARGO_TARGET_DIR:process.env.CARGO_TARGET_DIR||path.join(root,'build/original-ui/target')};
if(buildEnv.NO_COLOR==='1')buildEnv.NO_COLOR='true';
await run('trunk',['build','--release','--dist',assets],{cwd:path.join(source,'apps/figcraft-web'),env:buildEnv});
await run(process.execPath,['scripts/install-original-ui.mjs','figcraft',source,assets],{cwd:root,env:{...process.env,CW_ORIGINAL_UI_DIR:packages}});
const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
await mkdir(packages,{recursive:true});
await writeFile(path.join(packages,'INSTALL-FIGCRAFT.txt'),`Creative Workspace ${version}: original FigCraft browser preview\n\nThis package contains the unchanged original FigCraft web build from storytold/figcraft at ${pin}. Install it under a NEW original-UI package root and start Creative Workspace with CW_ORIGINAL_UI_DIR pointing there. Open /original/figcraft/ to try the original interface-design editor. The upstream web build starts with a new document; use ?webgl to force WebGL2 when WebGPU is unavailable.\n\nDesign state, rendering and export run in browser WebAssembly. This is not a server engine or provider integration. Server-owned design state/actions/layout/render/export, linked assets/fonts, provider paths, real browser permission/write acknowledgement, recovery, native OS application support and full FigCraft parity are separate acceptance work. FigCraft code is MIT OR Apache-2.0; ArtCraft marks retain their separate upstream terms in provenance/docs/brand/LICENSE-brand.txt and may only be used in the original FigCraft context. Optional craft-fonts are not bundled; this preview uses system fonts.\n`);
await mkdir(path.join(root,'dist'),{recursive:true});
const name=`creative-workspace-${version}-figcraft-original-ui.tar.gz`;
await run('tar',['-czf',path.join(root,'dist',name),'-C',packages,`figcraft/${originalUiPackageId('figcraft')}`,'INSTALL-FIGCRAFT.txt']);
const hash=createHash('sha256').update(await readFile(path.join(root,'dist',name))).digest('hex');
await writeFile(path.join(root,'dist',`${name}.sha256`),`${hash}  ${name}\n`);
console.log(`Built original FigCraft browser preview at ${pin}; browser processing only.`);
