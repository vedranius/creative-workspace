import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import {createWorkspaceServer} from '../src/server.js';
import {listFiles,resolveWorkspace,readState} from '../src/storage.js';
import {checkRelease} from '../src/updates.js';

async function fixture(t){const root=await mkdtemp(path.join(os.tmpdir(),'creative-workspace-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'allowed'));await mkdir(path.join(root,'outside'));await writeFile(path.join(root,'outside','secret.txt'),'private');return root;}
test('file access blocks traversal and symlinks outside the workspace',async t=>{
  const root=await fixture(t);const allowed=path.join(root,'allowed');await writeFile(path.join(allowed,'photo.raw'),'example');
  await assert.rejects(resolveWorkspace(allowed,'../outside'));
  await assert.rejects(resolveWorkspace(allowed,path.join(root,'outside')));
  await symlink(path.join(root,'outside'),path.join(allowed,'escape'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(resolveWorkspace(allowed,'escape'));
  assert.deepEqual((await listFiles(allowed)).entries.map(entry=>entry.name),['photo.raw']);
});
test('release checks distinguish release absence, network failure and unverified compatibility',async()=>{
  assert.equal((await checkRelease('storytold/photocraft',{fetcher:async()=>new Response('',{status:404})})).status,'no-release');
  await assert.rejects(checkRelease('storytold/photocraft',{fetcher:async()=>new Response('',{status:429})}),/rate limit/);
  await assert.rejects(checkRelease('evil/../../repo'),/Invalid/);
  const result=await checkRelease('storytold/photocraft',{fetcher:async()=>Response.json({tag_name:'v0.2.0',body:'Notes',html_url:'https://github.com/storytold/photocraft/releases/tag/v0.2.0'})});
  assert.equal(result.version,'v0.2.0');assert.equal(result.compatibility,'unverified');
});
test('API persists workspaces, rejects foreign origins and requires authentication',async t=>{
  const root=await fixture(t);const dataDir=path.join(root,'state');const allowed=path.join(root,'allowed');
  const server=await createWorkspaceServer({dataDir,allowedRoots:[allowed],auth:'user:password'});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  const headers={Authorization:`Basic ${Buffer.from('user:password').toString('base64')}`,'Content-Type':'application/json'};
  assert.equal((await fetch(`${url}/api/apps`)).status,401);
  const foreign=await fetch(`${url}/api/apps/rapidraw/workspace`,{method:'PUT',headers:{...headers,Origin:'https://foreign.example'},body:JSON.stringify({root:allowed})});assert.equal(foreign.status,403);
  const outside=await fetch(`${url}/api/apps/rapidraw/workspace`,{method:'PUT',headers,body:JSON.stringify({root:path.join(root,'outside')})});assert.equal(outside.status,403);
  const saved=await fetch(`${url}/api/apps/rapidraw/workspace`,{method:'PUT',headers,body:JSON.stringify({root:allowed})});assert.equal(saved.status,200);
  assert.equal((await readState(dataDir)).apps.rapidraw.workspace,allowed);
  assert.equal((await fetch(`${url}/api/files?app=rapidraw&path=../outside`,{headers})).status,400);
  const apps=await(await fetch(`${url}/api/apps`,{headers})).json();assert.equal(apps.length,8);assert.equal(apps.find(app=>app.id==='photocraft').status,'adapter-required');
});
