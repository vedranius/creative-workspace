// Actual original React hooks/Editor/Basic UI against browser-local native code.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [stage,fixture,output,nativeReferencePath]=process.argv.slice(2);
if(!stage||!fixture||!output)throw Error('BUILT_REACT_STAGE PUBLIC_CC0_DNG OUTPUT_JSON');
const digest=b=>createHash('sha256').update(b).digest('hex');
const pin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url),'utf8')).fixtures.find(x=>x.id==='raw.pixls.us 1327');
assert.equal(pin.license,'CC0-1.0');assert.equal(digest(await readFile(fixture)),pin.sourceSha256);
const native=nativeReferencePath?JSON.parse(await readFile(nativeReferencePath,'utf8')):null;
const provenance=JSON.parse(await readFile(path.join(stage,'source-proof.json'),'utf8'));
const chromiumSandbox=process.env.CHROMIUM_SANDBOX!=='false';
const assets=new Map();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name),url=prefix+'/'+entry.name;if(entry.isDirectory())await walk(file,url);
 else assets.set(url,[types[path.extname(file)]||'application/octet-stream',await readFile(file)]);
}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));
const server=createServer((req,res)=>{const a=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);
 if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'}).end(a[1]);});
server.listen(0,'127.0.0.1');await once(server,'listening');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');let browser;
const pageErrors=[],failedRequests=[],consoleErrors=[],blockedExternalRequests=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:850}});
 const localOrigin=`http://127.0.0.1:${server.address().port}`;
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==localOrigin){blockedExternalRequests.push(u.origin);return route.abort('blockedbyclient');}return route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>!!globalThis.proof);
 await page.getByLabel('Open RAW fixture').setInputFiles(fixture);
 await page.waitForFunction(()=>globalThis.proof.store.getState().selectedImage?.isReady&&globalThis.proof.store.getState().finalPreviewUrl);
 const first=await page.evaluate(async()=>{const s=proof.store.getState();const b=await(await fetch(s.finalPreviewUrl)).arrayBuffer();return {width:s.selectedImage.width,height:s.selectedImage.height,wb:s.selectedImage.asShotWhiteBalance,bytes:b.byteLength,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('')};});
 assert.equal(first.width,512);assert.equal(first.height,384);assert.ok(first.bytes>0);
 const samples=[];let lastUrl=null;
 async function sample(value){
  const handle=await page.waitForFunction(({exposure,previousUrl})=>{
   const frame=proof.trace.findLast(x=>x.command==='render-result'&&x.exposure===exposure&&!x.interactive);
   const s=proof.store.getState();
   return frame&&s.adjustments.exposure===exposure&&s.finalPreviewUrl&&s.finalPreviewUrl!==previousUrl?frame:false;
  },{exposure:value,previousUrl:lastUrl});
  const frame=await handle.jsonValue();assert.ok(frame&&frame.exposure===value);await handle.dispose();
  const published=await page.evaluate(async()=>{
   const url=proof.store.getState().finalPreviewUrl,b=await(await fetch(url)).arrayBuffer();
   return {url,bytes:b.byteLength,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('')};
  });
  assert.equal(published.hash,frame.jpegSha256,'Original hook published stale/wrong JPEG');lastUrl=published.url;
  samples.push({exposure:value,bytes:frame.bytes,adjustmentSha256:frame.adjustmentSha256,rgbaSha256:frame.rgbaSha256,jpegSha256:frame.jpegSha256});
 }
 await sample(0);
 for(const value of [0.8,-0.8,1.6,0]){
  const panel=page.getByLabel('Original Basic panel');
  await panel.locator('input[type=range]').first().locator('xpath=../..').locator('span[data-tooltip]').click();
  const input=panel.locator('input[type=text]').first();await input.fill(String(value));await input.press('Enter');
  await sample(value);
  if(value===0.8)await page.waitForFunction(()=>document.querySelector('[role=alert]')?.textContent?.includes('Failed to save changes'));
 }

 await page.waitForFunction(()=>[...document.querySelectorAll('svg image')].some(n=>n.href.baseVal===proof.store.getState().finalPreviewUrl&&n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0&&Number(getComputedStyle(n).opacity)>0));
 const result=await page.evaluate(async()=>{
  const s=proof.store.getState(),b=await(await fetch(s.finalPreviewUrl)).arrayBuffer();
  const image=await createImageBitmap(new Blob([b],{type:'image/jpeg'}));const dimensions=[image.width,image.height];image.close();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const rendered=proof.trace.filter(x=>x.command==='render-result').map(x=>({exposure:x.exposure,interactive:x.interactive,width:x.width,height:x.height,bytes:x.bytes}));
  const unsupported=[];for(const command of ['export_image','save_metadata_and_update_thumbnail']){try{await rapidRawTransport.invoke(command,{});}catch(e){unsupported.push({command,code:e.code});}}
  return {gpuErrors:proof.gpuErrors,adapter:proof.adapter,dimensions,bytes:b.byteLength,hash,exposure:s.adjustments.exposure,rendered,commands:proof.trace.filter(x=>x.command!=='render-result').map(x=>x.command),unsupported,
   saveErrorVisible:document.querySelector('[role=alert]')?.textContent?.includes('Failed to save changes'),visibleOriginalSvgImages:[...document.querySelectorAll('svg image')].filter(x=>x.href.baseVal===s.finalPreviewUrl&&x.getBoundingClientRect().width>0&&x.getBoundingClientRect().height>0).length};
 });
 assert.deepEqual(result.gpuErrors,[]);assert.equal(result.adapter.architecture,'swiftshader');assert.equal(result.exposure,0);assert.deepEqual(result.dimensions,[512,384]);assert.notEqual(samples[0].jpegSha256,samples[1].jpegSha256);assert.equal(first.hash,result.hash);assert.ok(result.visibleOriginalSvgImages>0);assert.equal(result.saveErrorVisible,true);
 assert.deepEqual(result.unsupported.map(x=>x.code),['unavailable-command','unavailable-command']);
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(blockedExternalRequests,[]);
 assert.ok(consoleErrors.every(x=>x.includes('Auto-save failed:')&&x.includes('save_metadata_and_update_thumbnail')),JSON.stringify(consoleErrors));
 if(native){assert.equal(native.frames.length,5);for(const [i,frame] of native.frames.entries()){
  assert.equal(samples[i].exposure,frame.exposure);assert.equal(samples[i].bytes,frame.jpegBytes);
  for(const key of ['jpegSha256','rgbaSha256','adjustmentSha256'])assert.equal(samples[i][key],frame[key],`Native original UI frame${i} ${key} differs`);
 }}
 await page.screenshot({path:output.replace(/\.json$/,'.png')});
 await page.evaluate(()=>proof.close());
 const report={stage:'RWASM-03 actual original React Speed open/Basic exposure slice',...provenance,publicFixture:{id:pin.id,license:pin.license,sourceSha256:pin.sourceSha256},browserVersion:browser.version(),chromiumSandbox,first,result,samples,blockedExternalRequests,nativeComparison:native?{frames:5,completeAdjustmentsExact:true,renderedPixelsExact:true,encodedJpegExact:true}:null,pageErrors,failedRequests,expectedSaveErrors:consoleErrors.length,
  scope:'Original hooks/stores/Editor/ImageCanvas/Basic/Slider unchanged, QA composition and invoke alias only. Speed-developed512x384 open and Basic exposure edit; full App menus, full-resolution load_image parity, resizing, ROI, analytics/effects/save/provider acceptance remain open.'};
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
}catch(error){console.log(JSON.stringify({pageErrors,failedRequests,consoleErrors}));throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
