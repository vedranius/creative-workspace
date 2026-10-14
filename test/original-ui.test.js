import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import os from 'node:os';
import path from 'node:path';
import {createWorkspaceServer} from '../src/server.js';
import {originalUiPins,originalUiPatches,originalUiPackageId} from '../src/original-ui.js';

test('DesignCraft PAR-03 variant is pinned to its exact reviewed source patch',async()=>{
  const patch=originalUiPatches.designcraft,bytes=await readFile(new URL('../'+patch.path,import.meta.url));
  assert.equal(patch.id,'par-03-selection-set-v1');
  assert.equal(patch.path,'patches/designcraft/a127c6d5/par-03-selection-set-candidate.patch');
  assert.equal(patch.sha256,'6974d1b20b5a8b053dc8ecf1aeb094ac63d8a4c9ec595880dd4668e53d96cb35');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),patch.sha256);
  assert.equal(originalUiPackageId('designcraft'),`${originalUiPins.designcraft}-${patch.sha256.slice(0,12)}`);
});

// Protocol fixtures; actual upstream UI browser acceptance is recorded separately.
async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),'cw-original-ui-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const directory=path.join(root,'uis','photocraft',originalUiPins.photocraft);await mkdir(directory,{recursive:true});
  const data={'index.html':'<html><script type="module">console.log("original fixture");</script></html>','app.wasm':Buffer.from([0,97,115,109]),'LICENSE-MIT':'MIT fixture','LICENSE-APACHE':'Apache fixture'};
  const files=[];for(const [name,bytes]of Object.entries(data)){await writeFile(path.join(directory,name),bytes);files.push({path:name,size:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')});}
  const manifest={schemaVersion:1,app:'photocraft',repo:'storytold/photocraft',commit:originalUiPins.photocraft,processing:'browser',licenses:['LICENSE-MIT','LICENSE-APACHE'],files};
  const meta=path.join(directory,'creative-workspace-ui.json');await writeFile(meta,JSON.stringify(manifest));
  await mkdir(path.join(root,'workspace'));
  const server=await createWorkspaceServer({dataDir:path.join(root,'state'),allowedRoots:[path.join(root,'workspace')],originalUiRoot:path.join(root,'uis'),auth:'user:test'});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Basic ${Buffer.from('user:test').toString('base64')}`};
  return {root,directory,manifest,meta,url,headers};
}
test('original UI launcher requires auth and exposes same-origin preview identity independently of engine health',async t=>{
  const f=await fixture(t);
  assert.equal((await fetch(f.url+'/api/original-uis')).status,401);
  assert.equal((await fetch(f.url+'/original/photocraft/')).status,401);
  const list=await (await fetch(f.url+'/api/original-uis',{headers:f.headers})).json();
  assert.equal(list.photocraft.available,true);assert.equal(list.photocraft.processing,'browser');assert.equal(list.photocraft.serverIntegrated,false);
  assert.equal(list.photocraft.url,'/original/photocraft/');assert.equal(list.effectcraft.available,false);
  const page=await fetch(f.url+list.photocraft.url,{headers:f.headers});assert.equal(page.status,200);
  assert.match(page.headers.get('content-security-policy'),/sha256-/);assert.match(page.headers.get('content-security-policy'),/wasm-unsafe-eval/);
  assert.equal(page.headers.get('cross-origin-embedder-policy'),'require-corp');
  const wasm=await fetch(f.url+'/original/photocraft/app.wasm',{headers:f.headers});assert.equal(wasm.headers.get('content-type'),'application/wasm');assert.equal((await wasm.arrayBuffer()).byteLength,4);
  const head=await fetch(f.url+'/original/photocraft/app.wasm',{method:'HEAD',headers:f.headers});assert.equal(head.headers.get('content-length'),'4');assert.equal(await head.text(),'');
});
test('original UI routes reject changed assets, undeclared files and path/symlink escapes',async t=>{
  const f=await fixture(t),get=name=>fetch(f.url+'/original/photocraft/'+name,{headers:f.headers});
  await writeFile(path.join(f.directory,'secret.txt'),'not declared');assert.equal((await get('secret.txt')).status,404);
  assert.equal((await get('%2e%2e%2fsecret.txt')).status,403);
  await writeFile(path.join(f.directory,'app.wasm'),Buffer.from([1,97,115,109]));assert.equal((await get('app.wasm')).status,503);
  assert.equal((await (await fetch(f.url+'/api/original-uis',{headers:f.headers})).json()).photocraft.available,false);
  await rm(path.join(f.directory,'app.wasm'));await writeFile(path.join(f.root,'private.bin'),Buffer.from([0,97,115,109]));
  await symlink(f.root,path.join(f.directory,'escape'),process.platform==='win32'?'junction':'dir');
  f.manifest.files.find(file=>file.path==='app.wasm').path='escape/private.bin';await writeFile(f.meta,JSON.stringify(f.manifest));
  assert.equal((await get('escape/private.bin')).status,403);
});
test('original UI identity and budgets fail closed and do not redirect users to replacement editors',async t=>{
  const f=await fixture(t);
  f.manifest.commit='0'.repeat(40);await writeFile(f.meta,JSON.stringify(f.manifest));
  let roster=await (await fetch(f.url+'/api/original-uis',{headers:f.headers})).json();assert.equal(roster.photocraft.available,false);
  assert.equal((await fetch(f.url+'/original/photocraft/',{headers:f.headers})).status,503);
  f.manifest.commit=originalUiPins.photocraft;f.manifest.files[0].size=97*1024*1024;await writeFile(f.meta,JSON.stringify(f.manifest));
  roster=await (await fetch(f.url+'/api/original-uis',{headers:f.headers})).json();assert.equal(roster.photocraft.available,false);
  const old=await fetch(f.url+'/apps/photocraft/',{headers:f.headers});assert.equal(old.status,200);
  assert.equal((await fetch(f.url+'/original/nonexistent/',{headers:f.headers})).status,404);
  assert.equal((await fetch(f.url+'/original/constructor/',{headers:f.headers})).status,404);
});
test('original UI paths reject foreign origins and modifying methods',async t=>{
  const f=await fixture(t);
  assert.equal((await fetch(f.url+'/original/photocraft/',{headers:{...f.headers,Origin:'https://foreign.invalid'}})).status,403);
  assert.equal((await fetch(f.url+'/original/photocraft/',{method:'POST',headers:{...f.headers,'Content-Type':'application/json'},body:'{}'})).status,405);
});

test('reviewed FilmCraft variants require exact source patch identity and immutable provenance',async t=>{
  const f=await fixture(t),id='filmcraft',patch=originalUiPatches[id];
  const directory=path.join(f.root,'uis',id,originalUiPackageId(id));await mkdir(directory,{recursive:true});
  const data={'index.html':'<html>FilmCraft fixture</html>','app.wasm':Buffer.from([0,97,115,109]),'LICENSE-MIT':'MIT fixture','LICENSE-APACHE':'Apache fixture','provenance/creative-workspace/source.patch':await readFile(new URL('../'+patch.path,import.meta.url))};
  const files=[];for(const [name,bytes]of Object.entries(data)){await mkdir(path.dirname(path.join(directory,name)),{recursive:true});await writeFile(path.join(directory,name),bytes);files.push({path:name,size:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')});}
  const manifest={schemaVersion:1,app:id,repo:'storytold/filmcraft',commit:originalUiPins[id],processing:'browser',sourcePatch:{id:patch.id,sha256:patch.sha256},licenses:['LICENSE-MIT','LICENSE-APACHE'],files};const meta=path.join(directory,'creative-workspace-ui.json');await writeFile(meta,JSON.stringify(manifest));
  const roster=()=>fetch(f.url+'/api/original-uis',{headers:f.headers}).then(r=>r.json());
  assert.equal((await roster()).filmcraft.available,true);assert.equal((await roster()).filmcraft.sourcePatch.sha256,patch.sha256);
  manifest.sourcePatch.sha256='0'.repeat(64);await writeFile(meta,JSON.stringify(manifest));assert.equal((await roster()).filmcraft.available,false);
  manifest.sourcePatch.sha256=patch.sha256;manifest.files=manifest.files.filter(file=>!file.path.endsWith('source.patch'));await writeFile(meta,JSON.stringify(manifest));assert.equal((await roster()).filmcraft.available,false);
  // An old clean-pin package cannot silently masquerade as the reviewed variant.
  assert.notEqual(originalUiPackageId(id),originalUiPins[id]);
});
