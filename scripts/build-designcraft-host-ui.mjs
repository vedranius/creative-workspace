import path from 'node:path';
import {readFile,writeFile,mkdir,cp,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {originalUiSourceDiff,assertOriginalUiSource,createOriginalUiBuildCopy} from './original-ui-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.join(root,'engines/original-ui/designcraft/host-canvas.json')));
const source=path.resolve(process.argv[2]||'build/original-ui/source-designcraft-host');
const assets=path.resolve(process.argv[3]||'build/original-ui/assets-designcraft-host');
const run=(cmd,args,opts={})=>new Promise((resolve,reject)=>{let out='';const child=spawn(cmd,args,{cwd:root,stdio:opts.capture?['ignore','pipe','inherit']:'inherit',...opts});if(opts.capture)child.stdout.on('data',b=>out+=b);child.on('error',reject);child.on('exit',code=>code===0?resolve(out):reject(new Error(`${cmd} failed (${code})`)));});
const patch=await readFile(path.join(root,config.patch));
if(createHash('sha256').update(patch).digest('hex')!==config.sha256)throw new Error('Host canvas source patch digest differs');
if((await run('git',['rev-parse','HEAD'],{cwd:source,capture:true})).trim()!==config.commit)throw new Error('Host canvas source revision differs');
const diff=await originalUiSourceDiff(source);
if(!diff){await run('git',['apply','--check',path.join(root,config.patch)],{cwd:source});await run('git',['apply',path.join(root,config.patch)],{cwd:source});}
else if(diff!==patch.toString())throw new Error('Host canvas source contains unrelated changes');
await assertOriginalUiSource(source,patch,'before host-canvas build');
await mkdir(assets,{recursive:true});
const env={...process.env,CARGO_BUILD_JOBS:'1',CARGO_TARGET_DIR:process.env.CARGO_TARGET_DIR||path.join(root,'build/original-ui/target')};delete env.NO_COLOR;
const buildCopy=await createOriginalUiBuildCopy(source,path.dirname(source));
try{
 await assertOriginalUiSource(buildCopy.source,patch,'before isolated host-canvas build');
 await run('trunk',['build','--release','--dist',assets],{cwd:path.join(buildCopy.source,'apps/designcraft-web'),env});
}finally{await rm(buildCopy.directory,{recursive:true,force:true});}
await assertOriginalUiSource(source,patch,'after host-canvas build');
for(const name of ['LICENSE-MIT','LICENSE-APACHE'])await cp(path.join(source,name),path.join(assets,name));
async function licenses(relative=''){
 for(const entry of await readdir(path.join(source,relative),{withFileTypes:true})){
  if(['.git','target','dist','node_modules'].includes(entry.name))continue;
  const name=path.join(relative,entry.name);
  if(entry.isDirectory())await licenses(name);
  else if(entry.isFile()&&/^(LICENSE|LICENCE|COPYING|NOTICE|ATTRIBUTION)([._-]|$)/i.test(entry.name)){
   const destination=path.join(assets,'licenses',name);await mkdir(path.dirname(destination),{recursive:true});await cp(path.join(source,name),destination);
  }
 }
}
await licenses();
await cp(path.join(root,config.patch),path.join(assets,'SOURCE.patch'));
await cp(path.join(root,'LICENSE'),path.join(assets,'LICENSE-CREATIVE-WORKSPACE'));
await writeFile(path.join(assets,'UPSTREAM.txt'),`Original DesignCraft: https://github.com/storytold/designcraft\nSource revision: ${config.commit}\nIntegration: https://github.com/vedranius/creative-workspace\nOriginal components retain their own licenses; see licenses/. Creative Workspace integration license: LICENSE-CREATIVE-WORKSPACE.\n`);
await writeFile(path.join(assets,'SOURCE.json'),JSON.stringify(config,null,2)+'\n');
const pkg=JSON.parse(await readFile(path.join(root,'package.json')));
await writeFile(path.join(assets,'INSTALL.txt'),`Creative Workspace ${pkg.version}: bounded original DesignCraft server-edit/undo candidate.\nThis archive is not a complete editor or a registered studio installation. Do not replace any live original-UI package. It proves the original A4 preset caller, Rectangle Tool M drag, and Ctrl+Z / edit.undo through the owned server worker; the original canvas receives only ACKed canonical state and a bounded server PNG. Other unbridged tools/commands remain disabled. File providers, destination ACK, save/reopen, recovery and full UI/function parity remain pending. Run the isolated smoke-designcraft-frame-undo-candidate.mjs with CW_DESIGNCRAFT_UI_ASSETS pointing to this folder and an owned compatible worker; see docs/par-03a-handoff.md.\n`);
await mkdir(path.join(root,'dist'),{recursive:true});
const archive=`creative-workspace-${pkg.version}-designcraft-host-canvas-candidate.tar.gz`;
await run('tar',['-czf',path.join(root,'dist',archive),'-C',assets,'.']);
const digest=createHash('sha256').update(await readFile(path.join(root,'dist',archive))).digest('hex');
await writeFile(path.join(root,'dist',archive+'.sha256'),`${digest}  ${archive}\n`);
console.log(`Built ${config.id}: ${archive}`);
