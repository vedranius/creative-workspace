import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {originalUiPins,originalUiPackageId} from '../src/original-ui.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(process.argv[2]||'build/original-ui/source-deckcraft');
const assets=path.resolve(process.argv[3]||'build/original-ui/assets-deckcraft');
const packages=path.resolve(process.argv[4]||'build/original-ui/packages');
const pin=originalUiPins.deckcraft;
const run=(cmd,args,options={})=>new Promise((resolve,reject)=>{
  const child=spawn(cmd,args,{cwd:root,stdio:'inherit',...options});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} failed (${code})`)));
});

await access(path.join(source,'.git'));
if((await runCapture('git',['rev-parse','HEAD'],source))!==pin)throw new Error('DeckCraft source must be at its exact pinned upstream revision');
if(await runCapture('git',['status','--porcelain','--untracked-files=all'],source))throw new Error('DeckCraft source must be clean before the original UI build');
await mkdir(assets,{recursive:true});
await run('trunk',['build','--release','--dist',assets],{cwd:path.join(source,'apps/deckcraft-web'),env:{...process.env,CARGO_BUILD_JOBS:'1',RAYON_NUM_THREADS:'1',CARGO_TARGET_DIR:process.env.CARGO_TARGET_DIR||path.join(root,'build/original-ui/target')}});
await run(process.execPath,['scripts/install-original-ui.mjs','deckcraft',source,assets],{cwd:root,env:{...process.env,CW_ORIGINAL_UI_DIR:packages}});
const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
await mkdir(packages,{recursive:true});
await writeFile(path.join(packages,'INSTALL-DECKCRAFT.txt'),`Creative Workspace ${version}: original DeckCraft browser preview\n\nThis package contains the unchanged original DeckCraft web build from storytold/deckcraft at ${pin}. Install it under a NEW original-UI package root and start Creative Workspace with CW_ORIGINAL_UI_DIR pointing there. Open /original/deckcraft/ to try the original sample presentation and slide editor. Use ?blank for an empty presentation and ?webgl to force WebGL2.\n\nPresentation editing, media decode, rendering and file conversion run in browser WebAssembly. This is not a server engine or a provider integration. Server processing, provider paths, real browser permission/write acknowledgement, recovery, OS application support and full DeckCraft parity are separate acceptance work. DeckCraft code is MIT OR Apache-2.0; ArtCraft marks retain their separate upstream brand terms in provenance/docs/brand/LICENSE-brand.txt. Optional craft-fonts are not bundled; this preview uses system fonts.\n`);
await mkdir(path.join(root,'dist'),{recursive:true});
const name=`creative-workspace-${version}-deckcraft-original-ui.tar.gz`;
await run('tar',['-czf',path.join(root,'dist',name),'-C',packages,`deckcraft/${originalUiPackageId('deckcraft')}`,'INSTALL-DECKCRAFT.txt']);
const hash=createHash('sha256').update(await readFile(path.join(root,'dist',name))).digest('hex');
await writeFile(path.join(root,'dist',`${name}.sha256`),`${hash}  ${name}\n`);
console.log(`Built original DeckCraft browser preview at ${pin}; browser processing only.`);

async function runCapture(cmd,args,cwd){
  return await new Promise((resolve,reject)=>{
    const child=spawn(cmd,args,{cwd,stdio:['ignore','pipe','inherit']});let output='';
    child.stdout.on('data',chunk=>output+=chunk);child.on('error',reject);
    child.on('exit',code=>code===0?resolve(output.trim()):reject(new Error(`${cmd} failed (${code})`)));
  });
}
