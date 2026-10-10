import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,access,copyFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(project,'engines/designcraft/manifest.json'),'utf8'));
const runtime=path.resolve(process.env.CW_DESIGNCRAFT_RUNTIME||path.join(project,'data/engines/designcraft'));
const source=path.resolve(process.env.CW_DESIGNCRAFT_SOURCE||path.join(runtime,'source'));
const binary=path.join(runtime,'build/release',manifest.binary+(process.platform==='win32'?'.exe':''));
const run=(command,args,options={})=>new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:source,stdio:'inherit',...options});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${command} failed (${code})`)));});
if(process.argv[2]==='install'){
  await mkdir(runtime,{recursive:true});try{await access(path.join(source,'.git'));}catch{await run('git',['clone','--no-checkout',manifest.source,source],{cwd:runtime});}
  await run('git',['checkout','--detach',manifest.commit]);
  await cp(path.join(project,'engines/designcraft/native'),path.join(source,'apps/cw-designcraft-engine'),{recursive:true});
  // Extend the upstream lock with only our workspace package. Native library
  // versions and vendored patches remain pinned by the upstream Cargo.lock.
  const lockFile=path.join(source,'Cargo.lock');let lock=await readFile(lockFile,'utf8');
  const entry='[[package]]\nname = "cw-designcraft-engine"\nversion = "0.1.0"\ndependencies = [\n "designcraft-doc",\n "designcraft-engine",\n "designcraft-format",\n "designcraft-mcp",\n "image",\n "serde_json",\n "zip",\n]\n';
  const existing=/\[\[package\]\]\nname = "cw-designcraft-engine"\n[\s\S]*?(?=\n\[\[package\]\]|$)/;
  lock=existing.test(lock)?lock.replace(existing,entry):lock.replace(/version = 4\n/,`version = 4\n\n${entry}`);await writeFile(lockFile,lock);
  await run('cargo',['build','--locked','--release','-p','cw-designcraft-engine'],{env:{...process.env,CARGO_TARGET_DIR:path.join(runtime,'build'),CARGO_BUILD_JOBS:process.env.CARGO_BUILD_JOBS||'4'}});
  const licenses=path.join(runtime,'licenses');await mkdir(licenses,{recursive:true});
  for(const name of ['LICENSE-MIT','LICENSE-APACHE','NOTICE','ATTRIBUTION.md'])try{await copyFile(path.join(source,name),path.join(licenses,name));}catch(error){if(error.code!=='ENOENT')throw error;}
  await writeFile(path.join(runtime,'installed.json'),JSON.stringify({...manifest,source,binary},null,2));console.log(`Workspace-owned DesignCraft engine installed: ${binary}`);
}else console.log('Usage: node scripts/manage-designcraft.mjs install\nRequires Rust 1.90+, a native linker. The browser runs our UI; Layout rendering/editing runs in a separate native process per session.');
