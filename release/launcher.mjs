import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await readFile(path.join(root,'bundle.json'),'utf8'));
if(manifest.target!==`${process.platform}-${process.arch}`)throw new Error(`This bundle requires ${manifest.target}`);
const data=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
const workspace=path.join(root,'workspaces');
await mkdir(data,{recursive:true});await mkdir(workspace,{recursive:true});
const env={...process.env,DATA_DIR:data,WORKSPACE_ROOTS:process.env.WORKSPACE_ROOTS||workspace};
for(const engine of manifest.engines)env[`CW_${engine.id.toUpperCase()}_BINARY`]=path.join(root,engine.binary);
// An unbundled RapidRAW must never fall through to an unrelated local service.
env.RAPIDRAW_URL=process.env.CW_OWNED_RAPIDRAW_URL||'http://127.0.0.1:1';
const child=spawn(process.execPath,[path.join(root,'src/server.js')],{cwd:root,env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
