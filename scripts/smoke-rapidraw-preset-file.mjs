// Original unpatched PresetsPanel -> usePresets -> native command ID -> real OPFS ACK.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [stage,nativeDir,output]=process.argv.slice(2);if(!output)throw Error('PRESET_STAGE NATIVE_REFERENCE_DIR OUTPUT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex'),meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json'))),native=JSON.parse(await readFile(path.join(nativeDir,'reference.json'))),items=JSON.parse(await readFile(path.join(nativeDir,'items.json')));
assert.deepEqual(source.presetFiles,meta.presetFiles);assert.equal(source.nativeSource,meta.nativeApplication.commit);
for(const [name,sha]of Object.entries(meta.presetFiles.sourceFiles))if(name.startsWith('src/'))assert.equal(hash(await readFile(path.join(stage,name))),sha,name);
for(const [name,sha]of Object.entries(source.runtimeSha256)){assert.equal(hash(await readFile(path.join(stage,'dist/engine',name))),sha);assert.equal(hash(await readFile(new URL('../experiments/rapidraw-wasm-core/'+name,import.meta.url))),sha);}
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml'};
async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name),url=prefix+'/'+e.name;if(e.isDirectory())await walk(file,url);else assets.set(url,[types[path.extname(file)]??'application/octet-stream',await readFile(file)]);}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));
const server=createServer((req,res)=>{const a=assets.get(new URL(req.url,'http://localhost').pathname);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'}).end(a[1]);});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const errors=[],consoleErrors=[],external=[],failed=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1050,height:760}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){external.push(u.origin);return r.abort();}return r.continue();});
 await context.addInitScript(({items})=>{
  const qa=globalThis.presetQa={initialPresets:items,mode:'gate',calls:0,closing:false,async pickFile(options){
   this.calls++;this.options=options;this.closing=false;if(this.mode==='cancel')throw new DOMException('Cancelled','AbortError');
   this.root??=await(await navigator.storage.getDirectory()).getDirectoryHandle('qa-preset-files',{create:true});
   this.target=await this.root.getFileHandle('preset-'+this.calls+'.rrpreset',{create:true});const target=this.target;let reads=0;
   const replace=async text=>{const w=await target.createWritable();await w.write(text);await w.close();};
   return {
    kind:'file',name:target.name,queryPermission:o=>target.queryPermission(o),
    getFile:async()=>{reads++;if(this.mode==='newer'&&reads===2)await replace('newer content');return target.getFile();},
    createWritable:async options=>{
     const w=await target.createWritable(options);
     return {write:b=>w.write(b),abort:()=>w.abort(),close:async()=>{
      this.closing=true;if(this.mode==='gate')await new Promise(r=>this.release=r);
      if(this.mode==='fail')throw Error('Injected preset close failure');
      await w.close();if(this.mode==='mismatch')await replace('newer after close');
     }};
    },
   };
  }};
 },{items});
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.goto(origin);await page.waitForFunction(()=>globalThis.proof?.trace.some(t=>t.command==='load_presets'&&t.phase==='resolved'));
 const button=page.locator('button[data-tooltip="Export all presets to .rrpreset file"]');await button.waitFor();await button.click();await page.waitForFunction(()=>presetQa.closing);
 const held=await page.evaluate(async()=>({busy:proof.host.status().busy,bytes:(await presetQa.target.getFile()).size,trace:proof.trace,options:presetQa.options}));
 assert.equal(held.bytes,0);assert.equal(held.busy,true);assert.ok(!held.trace.some(t=>t.command==='handle_export_presets_to_file'&&t.phase==='resolved'));assert.deepEqual(held.options.types[0].accept,{'application/json':['.rrpreset']});
 await page.evaluate(()=>presetQa.release());await page.waitForFunction(()=>proof.trace.some(t=>t.command==='handle_export_presets_to_file'&&t.phase==='resolved'));
 const file=()=>page.evaluate(async()=>{const f=await presetQa.target.getFile(),b=await f.arrayBuffer();return {bytes:f.size,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join(''),text:await f.text()};});
 const acknowledged=await file();assert.equal(acknowledged.sha256,native.sha256);assert.equal(acknowledged.bytes,native.bytes);assert.deepEqual(JSON.parse(acknowledged.text),{creator:'Anonymous',presets:items});
 await page.waitForFunction(async()=>!(await proof.destination.listRecovery()).length);
 const count=()=>page.evaluate(()=>proof.trace.filter(t=>t.command==='handle_export_presets_to_file'&&t.phase==='start').length);
 const beforeCancel=await count();await page.evaluate(()=>presetQa.mode='cancel');await button.click();await page.waitForFunction(()=>presetQa.calls===2);assert.equal(await count(),beforeCancel);
 const faults=[];
 for(const mode of ['newer','fail','mismatch']){
  await page.evaluate(mode=>presetQa.mode=mode,mode);const prior=await page.evaluate(()=>proof.trace.filter(t=>t.phase==='error').length);await button.click();await page.waitForFunction(n=>proof.trace.filter(t=>t.phase==='error').length===n+1,prior);
  const result=await page.evaluate(async()=>{const records=await proof.destination.listRecovery(),r=records.findLast(r=>r.state==='uncertain');const bytes=await proof.destination.readRecovery(r.id);return {record:r,recoverySha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),busy:proof.host.status().busy,trace:proof.trace};});
  assert.equal(result.recoverySha256,native.sha256);assert.equal(result.busy,false);assert.equal(result.record.state,'uncertain');if(mode==='newer')assert.equal((await file()).text,'newer content');faults.push({mode,...result});
 }
 await page.getByLabel('Recovery retention').selectOption('keep');await page.evaluate(()=>presetQa.mode='normal');await button.click();await page.waitForFunction(()=>proof.trace.filter(t=>t.command==='handle_export_presets_to_file'&&t.phase==='resolved').length===2);
 const kept=await page.evaluate(async()=>({records:await proof.destination.listRecovery(),trace:proof.trace,calls:presetQa.calls}));assert.equal(kept.records.filter(r=>r.state==='complete').length,1);assert.equal(kept.records.filter(r=>r.state==='uncertain').length,3);assert.equal(kept.calls,6);assert.equal((await file()).sha256,native.sha256);
 await page.screenshot({path:output.replace(/\.json$/,'.png')});assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);assert.equal(consoleErrors.length,6);assert.ok(consoleErrors.every(e=>e.includes('retained for recovery')));
 await writeFile(output,JSON.stringify({scope:meta.presetFiles.scope,native,source,held,acknowledged:{bytes:acknowledged.bytes,sha256:acknowledged.sha256},cancelledWithoutInvoke:true,faults,kept,errors,external,failed,expectedConsoleErrors:consoleErrors,assertions:{originalPanelAndHook:true,noEarlyInvokeResolution:true,exactNativeSerializerBytes:true,freshChoices:true,newerContentPreserved:true,uncertainOutputsRetained:true,noReplay:true,separateRetention:true,syntheticChooser:true}},null,2)+'\n');
 await page.evaluate(()=>proof.close());await context.close();console.log(JSON.stringify({originalPresetFileExport:true,exactNativeBytes:true,uncertainRetained:3,noEarlySuccess:true}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
