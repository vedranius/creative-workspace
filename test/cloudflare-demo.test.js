import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import {buildDemo,safePath} from '../scripts/build-cloudflare-demo.mjs';
import {catalog} from '../src/catalog.js';
import {originalUiPins,originalUiPatches,originalUiPackageId} from '../src/original-ui.js';

test('demo rejects traversal and ambiguous package paths',()=>{
 for(const p of ['../secret','/secret','a/../secret','a\\secret','a//secret','.'])assert.throws(()=>safePath('/tmp/demo',p),/Unsafe/);
});
test('browser transport decodes only allowlisted original WASM and never intercepts documents',async()=>{
 const handlers={},wasm=Buffer.from([0,97,115,109,1,0,0,0]);const fetched=[];
 const source=await readFile(new URL('../cloudflare/demo/wasm-transport.js',import.meta.url),'utf8');
 const context={wasmRoutes:{'/original/app/pin/app.wasm':'/original/app/pin/app.wasm.gz'},self:{location:{origin:'https://demo.example'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn},URL,Response,ReadableStream,DecompressionStream,fetch:async url=>{fetched.push(url);return new Response(gzipSync(wasm));}};
 vm.runInNewContext(source,context);
 let intercepted;handlers.fetch({request:{url:'https://demo.example/original/app/pin/app.wasm',method:'GET'},respondWith:p=>intercepted=p});
 assert.deepEqual(Buffer.from(await (await intercepted).arrayBuffer()),wasm);assert.deepEqual(fetched,['/original/app/pin/app.wasm.gz']);
 for(const [url,method] of [['https://demo.example/document.psd','POST'],['https://other.example/original/app/pin/app.wasm','GET'],['https://demo.example/private','GET']])handlers.fetch({request:{url,method},respondWith:()=>assert.fail('Document or unrelated resource intercepted')});
});
test('browser transport joins split gzip across arbitrary part boundaries and rejects a missing part',async()=>{
 const handlers={},wasm=Buffer.from([0,97,115,109,1,0,0,0]),packed=gzipSync(wasm),fetched=[];
 const source=await readFile(new URL('../cloudflare/demo/wasm-transport.js',import.meta.url),'utf8');
 let missing=false,skipped=false;
 const context={wasmRoutes:{'/app.wasm':['/a.part-0','/a.part-1']},self:{location:{origin:'https://demo.example'},skipWaiting:async()=>{skipped=true;},addEventListener:(name,fn)=>handlers[name]=fn},URL,Response,ReadableStream,DecompressionStream,fetch:async url=>{fetched.push(url);return new Response(url.endsWith('0')?packed.subarray(0,7):packed.subarray(7),{status:missing&&url.endsWith('1')?404:200});}};
 vm.runInNewContext(source,context);let install;handlers.install({waitUntil:p=>install=p});await install;assert.equal(skipped,true);
 const request=()=>{let result;handlers.fetch({request:{url:'https://demo.example/app.wasm?cache=1',method:'GET'},respondWith:p=>result=p});return result;};
 assert.deepEqual(Buffer.from(await(await request()).arrayBuffer()),wasm);assert.deepEqual(fetched,['/a.part-0','/a.part-1']);
 missing=true;await assert.rejects(async()=>await(await request()).arrayBuffer());
});
test('static demo copies only verified public assets and preserves decoded WASM bytes',async t=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'cw-demo-'));t.after(()=>rm(base,{recursive:true,force:true}));
 const input=path.join(base,'ui'),out=path.join(base,'out');
 for(const app of catalog.filter(a=>!['rapidraw','designcraft'].includes(a.id))){
  const dir=path.join(input,app.id,originalUiPackageId(app.id));await mkdir(dir,{recursive:true});
  const files=[];for(const [name,bytes] of [['index.html',Buffer.from('<canvas></canvas>')],['app.wasm',Buffer.from([0,97,115,109,1,0,0,0])]]){
   await writeFile(path.join(dir,name),bytes);files.push({path:name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  await writeFile(path.join(dir,'private-user-document.txt'),'must never deploy');
  await writeFile(path.join(dir,'creative-workspace-ui.json'),JSON.stringify({app:app.id,repo:app.repo,commit:originalUiPins[app.id],sourcePatch:originalUiPatches[app.id],processing:'browser',files}));
 }
 const result=await buildDemo(input,out);assert.equal(result.apps,12);
 const manifest=JSON.parse(await readFile(path.join(out,'demo-manifest.json')));assert.equal(manifest.documentBackend,false);assert.ok(manifest.apps.every(a=>a.processing==='browser'&&!a.serverIntegrated));
 const prefix=path.join(out,'original/wordcraft',originalUiPins.wordcraft);
 assert.deepEqual(gunzipSync(await readFile(path.join(prefix,'app.wasm.gz'))),Buffer.from([0,97,115,109,1,0,0,0]));
 await assert.rejects(access(path.join(prefix,'private-user-document.txt')));
 assert.match(await readFile(path.join(out,'wasm-transport.js'),'utf8'),/app\.wasm\.gz/);
 assert.doesNotMatch(await readFile(path.join(out,'_headers'),'utf8'),/Content-Encoding:/);
 await assert.rejects(buildDemo(input,out),/must be empty/);
 const tampered=path.join(input,'wordcraft',originalUiPins.wordcraft,'app.wasm');await writeFile(tampered,'wrong');
 await assert.rejects(buildDemo(input,path.join(base,'bad')),/integrity failed/);
});
