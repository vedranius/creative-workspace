import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WebSocket,WebSocketServer} from 'ws';
import {createRapidRaw} from '../src/rapidraw.js';
import {createWorkspaceServer} from '../src/server.js';

async function fakeEngine(t,identity='creative-workspace-rapidraw-v1'){
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<script src="/assets/editor.js"></script><link href="/vite.svg">');});
  const wss=new WebSocketServer({noServer:true});
  server.on('upgrade',(req,socket,head)=>wss.handleUpgrade(req,socket,head,ws=>{ws.on('message',data=>{const request=JSON.parse(data);ws.send(JSON.stringify({id:request.id,result:request.cmd==='__cw_runtime_identity'?{runtimeId:identity}:request.cmd==='load_settings'?{test:true}:request.args}));});}));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{for(const ws of wss.clients)ws.terminate();wss.close();return new Promise(resolve=>server.close(resolve));});
  return `http://127.0.0.1:${server.address().port}`;
}
test('gateway refuses to advertise an existing non-workspace engine',async t=>{
  const url=await fakeEngine(t,'unrelated-installation');
  assert.equal((await createRapidRaw({url}).status()).ready,false);
  assert.throws(()=>createRapidRaw({url:'http://example.com:8791'}),/loopback/);
});
test('owned engine gateway proxies editor assets and IPC with origin enforcement',async t=>{
  const engine=await fakeEngine(t);const dataDir=await mkdtemp(path.join(os.tmpdir(),'cw-gateway-'));
  t.after(()=>rm(dataDir,{recursive:true,force:true}));
  const gateway=await createWorkspaceServer({dataDir,allowedRoots:[dataDir],rapidrawUrl:engine});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');t.after(()=>new Promise(resolve=>gateway.close(resolve)));
  const base=`http://127.0.0.1:${gateway.address().port}`;
  assert.equal((await(await fetch(`${base}/api/engines/rapidraw`)).json()).ownedRuntime,true);
  const html=await(await fetch(`${base}/apps/rapidraw/`)).text();
  assert.match(html,/\/apps\/rapidraw\/assets\/editor.js/);assert.match(html,/\/apps\/rapidraw\/vite.svg/);
  assert.equal((await fetch(`${base}/fm/list`,{headers:{Origin:'https://foreign.example'}})).status,403);
  const ws=new WebSocket(`${base.replace('http:','ws:')}/ipc`,{headers:{Origin:base}});
  await once(ws,'open');const reply=once(ws,'message');ws.send(JSON.stringify({id:9,cmd:'test',args:{value:'engine-command'}}));assert.deepEqual(JSON.parse((await reply)[0]).result,{value:'engine-command'});ws.close();await once(ws,'close');
  const foreign=new WebSocket(`${base.replace('http:','ws:')}/ipc`,{headers:{Origin:'https://foreign.example'}});
  const failure=await once(foreign,'error');assert.match(failure[0].message,/403/);
});
