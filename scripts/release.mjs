import {readFile,writeFile,mkdir,cp,copyFile,chmod,access,readdir,rm,mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.join(root,'release/config.json'),'utf8'));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const target=`${process.platform}-${process.arch}`;
const run=(cmd,args,options={})=>new Promise((resolve,reject)=>{const child=spawn(cmd,args,{cwd:root,stdio:'inherit',...options});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} failed (${code})`)));});
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const save=async(file,value)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value,null,2)+'\n');};
const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
async function collectLicenses(source,destination,relative=''){
  for(const entry of await readdir(path.join(source,relative),{withFileTypes:true})){
    if(['.git','target','node_modules'].includes(entry.name))continue;
    const name=path.join(relative,entry.name);
    if(entry.isDirectory())await collectLicenses(source,destination,name);
    else if(entry.isFile()&&/^(LICENSE|LICENCE|COPYING|NOTICE|ATTRIBUTION)([._-]|$)/i.test(entry.name)){
      const output=path.join(destination,name);await mkdir(path.dirname(output),{recursive:true});await copyFile(path.join(source,name),output);
    }
  }
}
export async function validateRelease(tag=process.env.RELEASE_TAG){
  if(process.env.GITHUB_ACTIONS==='true'&&process.versions.node.split('.')[0]!=='24')throw new Error('Actions release must use Node 24');
  if(!/^\d+\.\d+\.\d+-alpha\.\d+$/.test(pkg.version))throw new Error('First prototype releases must use an alpha SemVer');
  if(tag&&tag!==`v${pkg.version}`)throw new Error('Release tag differs from package version');
  const lock=await json(path.join(root,'package-lock.json'));
  if(lock.version!==pkg.version||lock.packages[''].version!==pkg.version)throw new Error('Lockfile version differs');
  const changelog=await readFile(path.join(root,'CHANGELOG.md'),'utf8');
  if(!changelog.includes(`## [${pkg.version}]`))throw new Error('Version has no changelog entry');
  if(!(await readFile(path.join(root,'README.md'),'utf8')).includes(`**Version: ${pkg.version}**`))throw new Error('README version differs');
  return pkg.version;
}
const command=process.argv[2];
if(command==='validate')console.log(await validateRelease(process.argv[3]||process.env.RELEASE_TAG));
else if(command==='engine'){
  const id=process.argv[3];if(!config.engines.includes(id))throw new Error('Engine is not in the verified release contract');
  await validateRelease();if(!config.targets.includes(target))throw new Error('Unsupported release target');
  const manifest=await json(path.join(root,`engines/${id}/manifest.json`));
  const runtime=path.resolve('build/runtime',id),env={...process.env,[`CW_${id.toUpperCase()}_RUNTIME`]:runtime,CARGO_BUILD_JOBS:'2',CARGO_PROFILE_RELEASE_DEBUG:'0'};
  await run(process.execPath,[`scripts/manage-${id}.mjs`,'install'],{env});
  const name=manifest.binary+(process.platform==='win32'?'.exe':'');
  const staged=path.resolve('build/staged',id);await mkdir(staged,{recursive:true});
  await copyFile(path.join(runtime,'build/release',name),path.join(staged,name));
  await cp(path.join(runtime,'licenses'),path.join(staged,'licenses'),{recursive:true});
  await collectLicenses(path.join(runtime,'source'),path.join(staged,'licenses/upstream'));
  for(const license of ['LICENSE-MIT','LICENSE-APACHE'])await access(path.join(staged,'licenses',license));
  await save(path.join(staged,'engine.json'),{...manifest,target,binary:name,sha256:await digest(path.join(staged,name)),productVersion:pkg.version});
}
else if(command==='bundle'){
  await validateRelease();if(!config.targets.includes(target))throw new Error('Unsupported release target');
  const bundle=path.resolve('build/bundle');await rm(bundle,{recursive:true,force:true});await mkdir(bundle,{recursive:true});
  for(const name of ['src','public','docs','engines'])await cp(path.join(root,name),path.join(bundle,name),{recursive:true});
  for(const name of ['package.json','package-lock.json','README.md','CHANGELOG.md','LICENSE'])await copyFile(path.join(root,name),path.join(bundle,name));
  await cp(path.join(root,'node_modules/ws'),path.join(bundle,'node_modules/ws'),{recursive:true});
  await copyFile(path.join(root,'release/launcher.mjs'),path.join(bundle,'launcher.mjs'));
  const runtimeName=process.platform==='win32'?'node.exe':'node';await mkdir(path.join(bundle,'runtime'));
  await copyFile(process.execPath,path.join(bundle,'runtime',runtimeName));await chmod(path.join(bundle,'runtime',runtimeName),0o755);
  const nodeLicense=await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`);if(!nodeLicense.ok)throw new Error('Cannot include Node license');
  await writeFile(path.join(bundle,'runtime/LICENSE'),await nodeLicense.text());
  const engines=[];
  for(const id of config.engines){
    const staged=path.resolve('build/staged',id),built=await json(path.join(staged,'engine.json')),expected=await json(path.join(root,`engines/${id}/manifest.json`));
    if(built.target!==target||built.productVersion!==pkg.version||built.commit!==expected.commit||built.sha256!==await digest(path.join(staged,built.binary)))throw new Error(`Wrong native artifact: ${id}`);
    const location=`native/${id}/${built.binary}`;await cp(staged,path.join(bundle,'native',id),{recursive:true});await chmod(path.join(bundle,location),0o755);
    engines.push({id,version:built.version,commit:built.commit,source:built.source,license:built.license,binary:location,sha256:built.sha256,verification:'pending-target-smoke'});
  }
  await save(path.join(bundle,'bundle.json'),{schemaVersion:1,version:pkg.version,target,node:process.version,nodeSha256:await digest(path.join(bundle,'runtime',runtimeName)),commit:process.env.GITHUB_SHA||'local-unpublished',channel:config.channel,engines,limitations:config.limitations});
  const unix='#!/bin/sh\nset -eu\ncd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\nexec ./runtime/node ./launcher.mjs\n';
  await writeFile(path.join(bundle,'start.sh'),unix);await chmod(path.join(bundle,'start.sh'),0o755);
  await writeFile(path.join(bundle,'start.command'),unix);await chmod(path.join(bundle,'start.command'),0o755);
  await writeFile(path.join(bundle,'start.cmd'),'@echo off\r\ncd /d "%~dp0"\r\n"runtime\\node.exe" "launcher.mjs"\r\npause\r\n');
  await writeFile(path.join(bundle,'INSTALL.txt'),`Creative Workspace ${pkg.version} (${target}) — alpha\n\nExtract into a writable directory. Run start.cmd on Windows, start.command on macOS, or ./start.sh on Linux. Open http://127.0.0.1:8788. No Node/npm/Rust install is needed. Close the terminal only after saving your documents. Keep data/ and workspaces/ when migrating; use a fresh bundle directory and copy them while the old service is stopped. Do not overwrite a running installation.\n\nIncluded engines: ${config.engines.join(', ')}.\n${config.limitations.join('\n')}\n\nFor remote access: configure HOST, WORKSPACE_AUTH and WORKSPACE_ROOTS, then use HTTPS/reverse proxy. Read docs/releases.md first.\n`);
}
else if(command==='smoke'){
  const bundle=path.resolve('build/bundle'),manifest=await json(path.join(bundle,'bundle.json'));
  const runtime=path.join(bundle,'runtime',process.platform==='win32'?'node.exe':'node');
  const env={...process.env,RAPIDRAW_URL:'http://127.0.0.1:1',CW_FUSE_BINARY:path.join(bundle,'not-bundled-helper')};
  for(const engine of manifest.engines)env[`CW_${engine.id.toUpperCase()}_BINARY`]=path.join(bundle,engine.binary);
  await mkdir(path.join(bundle,'evidence'));
  for(const id of config.engines){const script=id==='photocraft'?'smoke-photocraft-versions':`smoke-${id}`;await run(runtime,[path.join(root,`scripts/${script}.mjs`),path.join(bundle,`evidence/${id}.json`)],{env});}
  // Exercise the extracted launch path, not just the development server module.
  const child=spawn(runtime,[path.join(bundle,'launcher.mjs')],{cwd:bundle,env:{...env,PORT:'0',DATA_DIR:path.join(bundle,'smoke-data'),WORKSPACE_ROOTS:path.join(bundle,'smoke-workspaces')},stdio:['ignore','pipe','pipe']});
  try{const base=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Bundle startup timed out')),20000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Bundle exited ${code}`));});child.stderr.on('data',data=>process.stderr.write(data));child.stdout.on('data',data=>{output+=data;const match=output.match(/Creative Workspace: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
    const home=await fetch(base);if(!home.ok||!(await home.text()).includes('Creative Workspace'))throw new Error('Bundle homepage failed');
    for(const engine of manifest.engines){const status=await (await fetch(`${base}/api/engines/${engine.id}`)).json();if(!status.ready)throw new Error(`Bundle engine not ready: ${engine.id}`);}
    await save(path.join(bundle,'evidence/startup.json'),{target,version:pkg.version,bundledNode:true,homepage:true,enginesReady:config.engines,realBrowserPickerTest:false});
  }finally{child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});await rm(path.join(bundle,'smoke-data'),{recursive:true,force:true});await rm(path.join(bundle,'smoke-workspaces'),{recursive:true,force:true});}
  for(const engine of manifest.engines)engine.verification='target-native-open-edit-save-reopen-smoke';await save(path.join(bundle,'bundle.json'),manifest);
}
else if(command==='archive'){
  const bundle=path.resolve('build/bundle'),manifest=await json(path.join(bundle,'bundle.json'));
  if(manifest.engines.some(engine=>engine.verification!=='target-native-open-edit-save-reopen-smoke'))throw new Error('Native acceptance is incomplete');
  await access(path.join(bundle,'evidence/startup.json'));await mkdir(path.resolve('dist'),{recursive:true});
  const name=`creative-workspace-${pkg.version}-${target}`,archive=path.resolve('dist',name+(process.platform==='win32'?'.zip':'.tar.gz'));
  // bsdtar (available on all target runners) preserves Unix execute bits.
  await run('tar',[...(process.platform==='win32'?['-a','-cf']:['-czf']),archive,'-C',path.dirname(bundle),path.basename(bundle)]);
  const unpacked=await mkdtemp(path.join(os.tmpdir(),'cw extracted release '));
  try{
    await run('tar',['-xf',archive,'-C',unpacked]);
    const extracted=path.join(unpacked,'bundle');
    for(const engine of manifest.engines)if(await digest(path.join(extracted,engine.binary))!==engine.sha256)throw new Error('Archive changed native bytes');
    const node=path.join(extracted,'runtime',process.platform==='win32'?'node.exe':'node');
    if(await digest(node)!==manifest.nodeSha256)throw new Error('Archive changed Node bytes');
    await run(node,['--input-type=module','-e',"import {createWorkspaceServer} from './src/server.js'; const server=await createWorkspaceServer({dataDir:'./extract-test-data',allowedRoots:['./extract-test-projects'],rapidrawUrl:'http://127.0.0.1:1'});await new Promise(r=>server.listen(0,'127.0.0.1',r)); const response=await fetch('http://127.0.0.1:'+server.address().port);if(!response.ok)throw new Error('Extracted archive failed');await new Promise(r=>server.close(r));"],{cwd:extracted});
  }finally{await rm(unpacked,{recursive:true,force:true});}
  await writeFile(archive+'.sha256',`${await digest(archive)}  ${path.basename(archive)}\n`);
}
else if(command==='notes'){
  await validateRelease();const changelog=await readFile(path.join(root,'CHANGELOG.md'),'utf8');const entry=changelog.split(`## [${pkg.version}]`)[1]?.split('\n## ')[0];
  await writeFile(process.argv[3]||'build/release-notes.md',`# Creative Workspace ${pkg.version}\n\nSelf-hosted creative studio: native browser interfaces, server-side processing and selected laptop/server files. Goal: a lightweight laptop can access a powerful creative server anywhere.\n\nALPHA / single-user prototype. Bundles include ${config.engines.join(', ')} and Node 24, built and smoke-tested on the target GitHub Actions runner. This is a bounded four-editor release, not the entire planned catalog.\n\n${config.limitations.map(value=>'- '+value).join('\n')}\n\nExtract, read INSTALL.txt and run the launcher. Verify the adjacent SHA256 checksum. Keep application data separately when upgrading. macOS/Windows packages are not code-signed.\n\nChangelog${entry}\n\nSee README.md and docs/releases.md for usage, provenance and support limits.\n`);
}
else if(command!==undefined)throw new Error('Usage: release.mjs validate | engine ID | bundle | smoke | archive | notes FILE');
