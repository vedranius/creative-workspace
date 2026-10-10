import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,access,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(project,'engines/photocraft/manifest.json'),'utf8'));
const runtime=path.resolve(process.env.CW_PHOTOCRAFT_RUNTIME||path.join(project,'data/engines/photocraft'));
const source=path.resolve(process.env.CW_PHOTOCRAFT_SOURCE||path.join(runtime,'source'));
const binary=path.join(runtime,'build/release',manifest.binary+(process.platform==='win32'?'.exe':''));
const run=(command,args,options={})=>new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:source,stdio:'inherit',...options});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${command} failed (${code})`)));});
if(process.argv[2]==='install'){
  await mkdir(runtime,{recursive:true});
  try{await access(path.join(source,'.git'));}catch{await run('git',['clone','--no-checkout',manifest.source,source],{cwd:runtime});}
  await run('git',['checkout','--detach',manifest.commit]);
  await run('cargo',['build','--locked','--release','-p','photocraft-cli'],{env:{...process.env,CARGO_TARGET_DIR:path.join(runtime,'build'),CARGO_BUILD_JOBS:process.env.CARGO_BUILD_JOBS||'4'}});
  const licenses=path.join(runtime,'licenses');await mkdir(licenses,{recursive:true});
  for(const name of ['LICENSE-MIT','LICENSE-APACHE','NOTICE']){try{await copyFile(path.join(source,name),path.join(licenses,name));}catch(error){if(error.code!=='ENOENT')throw error;}}
  await writeFile(path.join(runtime,'installed.json'),JSON.stringify({...manifest,source,binary},null,2));console.log(`Workspace-owned PhotoCraft engine installed: ${binary}`);
}else{console.log('Usage: node scripts/manage-photocraft.mjs install\nThe workspace spawns a separate headless engine per browser session. Set CW_PHOTOCRAFT_BINARY if using a custom runtime directory.');}
