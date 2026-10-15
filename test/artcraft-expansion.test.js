import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,realpath} from 'node:fs/promises';
import {once} from 'node:events';
import path from 'node:path';
import os from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {createWorkspaceServer} from '../src/server.js';

const additions=['wordcraft','gridcraft','deckcraft','cadcraft','figcraft','soundcraft'];
test('all added ArtCraft projects support independent copy-first folders and release tracking without claiming adapters',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cw-artcraft-family-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const allowed=path.join(root,'files');await mkdir(allowed);
  const checked=[];
  const server=await createWorkspaceServer({dataDir:path.join(root,'state'),allowedRoots:[allowed],rapidrawUrl:'http://127.0.0.1:1',fetcher:async url=>{
    checked.push(url);
    return Response.json({tag_name:'v0.7.0',html_url:url.replace('api.github.com/repos/','github.com/').replace('/latest','/tag/v0.7.0')});
  }});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const jsonHeaders={'Content-Type':'application/json'};
  const apps=await(await fetch(base+'/api/apps')).json();
  assert.equal(apps.filter(app=>app.repo.startsWith('storytold/')).length,13);
  assert.equal(new Set(apps.map(app=>app.id)).size,14);
  for(const id of additions){
    const app=apps.find(app=>app.id===id);
    assert.equal(app.creator,'ArtCraft team');assert.equal(app.sourceRepo,`storytold/${id}`);
    assert.equal(app.status,'adapter-required');assert.equal(app.originalPort,'pending');
    const prepared=await fetch(base+'/api/imports/prepare',{method:'POST',headers:jsonHeaders,body:JSON.stringify({app:id})});
    assert.equal(prepared.status,200);
    assert.equal((await prepared.json()).workspace,await realpath(path.join(allowed,id)));
    const target=`${base}/api/files/upload?app=${id}&path=same-name.txt`;
    assert.equal((await fetch(target,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:id})).status,201);
    assert.equal((await fetch(target,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:'overwrite'})).status,409);
    assert.equal(await(await fetch(`${base}/api/files/download?app=${id}&path=same-name.txt`)).text(),id);
  }
  for(const [index,id] of additions.entries()){
    const other=additions[(index+1)%additions.length];
    assert.equal((await fetch(`${base}/api/files/download?app=${id}&path=../${other}/same-name.txt`)).status,400);
  }
  const foreign=await fetch(base+'/api/imports/prepare',{method:'POST',headers:{...jsonHeaders,Origin:'https://foreign.example'},body:JSON.stringify({app:'cadcraft'})});
  assert.equal(foreign.status,403);
  assert.equal((await fetch(base+'/api/updates/check',{method:'POST',headers:jsonHeaders,body:'{}'})).status,202);
  let updated=[];
  for(let i=0;i<100;i++){
    updated=await(await fetch(base+'/api/apps')).json();
    if(updated.every(app=>app.update.status==='upstream-release'))break;
    await delay(20);
  }
  assert.equal(checked.length,14);
  for(const id of additions){
    assert.ok(checked.includes(`https://api.github.com/repos/storytold/${id}/releases/latest`));
    const app=updated.find(app=>app.id===id);
    assert.equal(app.update.status,'upstream-release');assert.equal(app.update.compatibility,'unverified');
    assert.equal(app.status,'adapter-required');
  }
});
