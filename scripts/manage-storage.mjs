import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.resolve(process.env.CW_STORAGE_RUNTIME||path.join(project,'data/engines/storage'));
const target=path.join(runtime,'build');
const binary=path.join(target,'release','cw-filesystem-helper'+(process.platform==='win32'?'.exe':''));
if(process.argv[2]==='install'){
  if(!['linux','win32'].includes(process.platform))throw new Error('On-demand mounts currently need Linux/FUSE or Windows/WinFsp. Copy mode works without this helper.');
  await mkdir(runtime,{recursive:true});
  await new Promise((resolve,reject)=>{const child=spawn('cargo',['build','--locked','--release','--manifest-path',path.join(project,'engines/storage/fuse/Cargo.toml')],{cwd:project,stdio:'inherit',env:{...process.env,CARGO_TARGET_DIR:target,CARGO_BUILD_JOBS:process.env.CARGO_BUILD_JOBS||'2'}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Filesystem helper build failed (${code})`)));});
  await writeFile(path.join(runtime,'installed.json'),JSON.stringify({binary,source:'engines/storage/fuse',license:'AGPL-3.0-only'},null,2)+'\n');
  console.log(`Workspace-owned local-folder helper installed: ${binary}`);
}else console.log('Usage: npm run storage:install\nRequires Rust, plus fuse3 on Linux or WinFsp on Windows. CW_STORAGE_RUNTIME chooses the install directory; set CW_FUSE_BINARY when using a custom runtime.');
