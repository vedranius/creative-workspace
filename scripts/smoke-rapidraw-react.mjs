import {spawn} from 'node:child_process';
// Actual original React hooks/Editor/Basic UI against browser-local native code.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [stage,fixture,output,nativeReferencePath,nativeResizePath,nativeInteractivePath,nativeGeometryPath,nativeCropPath,canvasConfigPath]=process.argv.slice(2);
if(!stage||!fixture||!output)throw Error('BUILT_REACT_STAGE PUBLIC_CC0_DNG OUTPUT_JSON');
const digest=b=>createHash('sha256').update(b).digest('hex');
const pin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url),'utf8')).fixtures.find(x=>x.id==='raw.pixls.us 1327');
assert.equal(pin.license,'CC0-1.0');assert.equal(digest(await readFile(fixture)),pin.sourceSha256);
const native=nativeReferencePath?JSON.parse(await readFile(nativeReferencePath,'utf8')):null;
const nativeResize=nativeResizePath?JSON.parse(await readFile(nativeResizePath,'utf8')):null;
const nativeInteractive=nativeInteractivePath?JSON.parse(await readFile(nativeInteractivePath,'utf8')):null;
const nativeGeometry=nativeGeometryPath?JSON.parse(await readFile(nativeGeometryPath,'utf8')):null;
const nativeCrop=nativeCropPath?JSON.parse(await readFile(nativeCropPath,'utf8')):null;
const canvasConfig=canvasConfigPath?JSON.parse(await readFile(canvasConfigPath,'utf8')):null;
const allowedConsoleError=x=>(x.includes('Auto-save failed:')&&x.includes('save_metadata_and_update_thumbnail'))||x.includes('Browser experiment does not support get_lensfun_makers');
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
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');let browser,page;
const pageErrors=[],failedRequests=[],consoleErrors=[],blockedExternalRequests=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:850}});
 const localOrigin=`http://127.0.0.1:${server.address().port}`;
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==localOrigin){blockedExternalRequests.push(u.origin);return route.abort('blockedbyclient');}return route.continue();});
 page=await context.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',e=>pageErrors.push(e.message));page.on('requestfailed',r=>failedRequests.push(new URL(r.url()).pathname));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>!!globalThis.proof);
 await page.getByLabel('Open RAW fixture').setInputFiles(fixture);
 await page.waitForFunction(()=>globalThis.proof.store.getState().selectedImage?.isReady&&globalThis.proof.store.getState().finalPreviewUrl);
 const first=await page.evaluate(async()=>{const s=proof.store.getState();const b=await(await fetch(s.finalPreviewUrl)).arrayBuffer();return {width:s.selectedImage.width,height:s.selectedImage.height,wb:s.selectedImage.asShotWhiteBalance,bytes:b.byteLength,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('')};});
 assert.equal(first.width,2048);assert.equal(first.height,1536);assert.ok(first.bytes>0);
 const samples=[];let lastUrl=null,lastTraceIndex=-1;
 async function sample(value){
  const published=await page.evaluate(async({exposure,previousUrl,previousIndex})=>{
   const deadline=performance.now()+30000;
   while(performance.now()<deadline){
    const index=proof.trace.findLastIndex((x,i)=>i>previousIndex&&x.command==='render-result'&&x.exposure===exposure&&!x.interactive);
    const frame=proof.trace[index],s=proof.store.getState(),url=s.finalPreviewUrl;
    if(frame&&s.adjustments.exposure===exposure&&url&&url!==previousUrl){
     try{
      const b=await(await fetch(url)).arrayBuffer();
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(hash===frame.jpegSha256&&proof.store.getState().finalPreviewUrl===url)return {frame,index,url,hash};
     }catch{/* The unchanged hook can revoke an intermediate superseded URL. */}
    }
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
   throw Error('Original hook did not publish the new matching Exposure frame');
  },{exposure:value,previousUrl:lastUrl,previousIndex:lastTraceIndex});
  const frame=published.frame;assert.equal(published.hash,frame.jpegSha256);
  lastUrl=published.url;lastTraceIndex=published.index;
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
  const loaded=proof.trace.find(x=>x.command==='load-result'),previews=proof.trace.filter(x=>x.command==='preview-result');
  const originalSize=s.originalSize;
  const rendered=proof.trace.filter(x=>x.command==='render-result').map(x=>({exposure:x.exposure,interactive:x.interactive,width:x.width,height:x.height,bytes:x.bytes}));
  const unsupported=[];for(const command of ['export_image','save_metadata_and_update_thumbnail']){try{await rapidRawTransport.invoke(command,{});}catch(e){unsupported.push({command,code:e.code});}}
  return {gpuErrors:proof.gpuErrors,adapter:proof.adapter,originalSize,loaded,previews,dimensions,bytes:b.byteLength,hash,exposure:s.adjustments.exposure,rendered,commands:proof.trace.filter(x=>x.command!=='render-result').map(x=>x.command),unsupported,
   saveErrorVisible:document.querySelector('[role=alert]')?.textContent?.includes('Failed to save changes'),visibleOriginalSvgImages:[...document.querySelectorAll('svg image')].filter(x=>x.href.baseVal===s.finalPreviewUrl&&x.getBoundingClientRect().width>0&&x.getBoundingClientRect().height>0).length};
 });
 assert.deepEqual(result.gpuErrors,[]);assert.equal(result.adapter.architecture,'swiftshader');assert.equal(result.exposure,0);assert.deepEqual(result.dimensions,[512,384]);assert.notEqual(samples[0].jpegSha256,samples[1].jpegSha256);assert.equal(first.hash,result.hash);assert.ok(result.visibleOriginalSvgImages>0);assert.equal(result.saveErrorVisible,true);
 assert.deepEqual(result.originalSize,{width:2048,height:1536});assert.equal(result.loaded.developmentMode,'native-quality');
 assert.ok(result.previews.every(p=>p.width*p.height*76+132<=64*1024*1024));
 if(nativeResize){assert.equal(result.loaded.rgbSha256,nativeResize.originalRgbSha256);assert.equal(result.previews[0].rgbSha256,nativeResize.rgbSha256);assert.equal(result.previews[0].scaleForGpu,nativeResize.scaleForGpu);}
 const rejectedResizeInputs=await page.evaluate(async()=>{
  const m=await import('/engine/cw_rapidraw_wasm_probe.js');let rejected=0;
  for(const [w,h,p,t] of [[0,1,[],1],[32769,1,[],1],[32768,32768,[],512],[1,1,[0,0],1],[1,1,[0,0,0],0],[1,1,[0,0,0],32769],[1,1,[NaN,0,0],1],[1,1,[65505,0,0],1]]){try{m.resize_preview_rgb32f(w,h,new Float32Array(p),t);}catch{rejected++;}}
  const small=m.resize_preview_rgb32f(3,2,new Float32Array(18).fill(0.5),2);
  if(small.scaleForGpu!==Math.fround(small.width/3))throw Error('Original f32 GPU scale differs');
  return rejected;
 });assert.equal(rejectedResizeInputs,8);
 // Oversized preview refusal preserves the loaded worker and current image.
 const refusedPreview=await page.evaluate(async()=>{const a=proof.store.getState().adjustments;try{await rapidRawTransport.invoke('apply_adjustments',{jsAdjustments:a,targetResolution:2048});return null;}catch(e){return e.message;}});
 assert.match(refusedPreview,/bounded64MiB/);
 const resizeRecovery=await page.evaluate(async()=>{
  const s=proof.store.getState(),args={jsAdjustments:s.adjustments};
  const small=await rapidRawTransport.invoke('apply_adjustments',{...args,targetResolution:256});
  const bitmap=await createImageBitmap(new Blob([small],{type:'image/jpeg'}));const smallDimensions=[bitmap.width,bitmap.height];bitmap.close();
  const restored=await rapidRawTransport.invoke('apply_adjustments',{...args,targetResolution:512});
  const restoredHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',restored))].map(v=>v.toString(16).padStart(2,'0')).join('');
  return {smallDimensions,restoredBytes:restored.byteLength,restoredHash,targets:proof.trace.filter(x=>x.command==='preview-result').map(x=>x.target)};
 });assert.deepEqual(resizeRecovery.smallDimensions,[256,192]);assert.equal(resizeRecovery.restoredBytes,result.bytes);assert.equal(resizeRecovery.restoredHash,result.hash);assert.deepEqual(resizeRecovery.targets,[512,256,512]);
 assert.deepEqual(result.unsupported.map(x=>x.code),['unavailable-command','unavailable-command']);
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(blockedExternalRequests,[]);
 assert.ok(consoleErrors.every(allowedConsoleError),JSON.stringify(consoleErrors));
 if(native){assert.equal(native.frames.length,5);for(const [i,frame] of native.frames.entries()){
  assert.equal(samples[i].exposure,frame.exposure);assert.equal(samples[i].bytes,frame.jpegBytes);
  for(const key of ['jpegSha256','rgbaSha256','adjustmentSha256'])assert.equal(samples[i][key],frame[key],`Native original UI frame${i} ${key} differs`);
 }}
 const interactiveSamples=[];
 if(nativeInteractive){
  for(const expected of nativeInteractive){
   await page.evaluate(mode=>proof.setLiveQuality(mode),expected.preset);
   const previousIndex=await page.evaluate(()=>proof.trace.length-1);
   const slider=page.getByLabel('Original Basic panel').locator('input[type=range]').first();
   const box=await slider.boundingBox();assert.ok(box);
   const x=box.x+box.width/2,y=box.y+box.height/2;
   await page.keyboard.down('Shift');await page.mouse.move(x,y);await page.mouse.down();
   await page.waitForFunction(()=>proof.store.getState().isSliderDragging);
   await page.mouse.move(x+box.width*0.4,y);
   await page.waitForFunction(()=>proof.store.getState().adjustments.exposure===0.8);
   const captured=await page.evaluate(async({quality,minimum})=>{
    const deadline=performance.now()+30000;
    while(performance.now()<deadline){
     const index=proof.trace.findLastIndex((f,i)=>i>minimum&&f.command==='render-result'&&f.interactive&&f.exposure===0.8&&f.quality===quality);
     const frame=proof.trace[index],state=proof.store.getState(),patch=state.interactivePatch;
     if(frame&&state.isSliderDragging&&patch?.url){
      try{const bytes=await(await fetch(patch.url)).arrayBuffer();const jpegSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
       if(jpegSha256===frame.jpegSha256){const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));const dimensions=[bitmap.width,bitmap.height];bitmap.close();return {frame,dimensions,jpegSha256,rect:[patch.normX,patch.normY,patch.normW,patch.normH],dragging:state.isSliderDragging,preview:proof.trace.findLast(p=>p.command==='preview-result'&&p.interactive&&p.quality===quality)};}
      }catch{/* Wait for the unchanged hook's current patch URL. */}
     }
     await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    throw Error('No matching original Slider interactive patch');
   },{quality:expected.quality,minimum:previousIndex});
   assert.equal(captured.dragging,true);assert.deepEqual(captured.dimensions,[expected.width,expected.height]);assert.deepEqual(captured.rect,[0,0,1,1]);
   assert.deepEqual(captured.frame.rect,expected.rect);
   for(const key of ['responseSha256','jpegSha256','rgbaSha256','adjustmentSha256'])assert.equal(captured.frame[key],expected[key],`Native interactive ${expected.preset} ${key}`);
   assert.equal(captured.preview.rgbSha256,expected.rgbSha256);assert.equal(captured.frame.bytes,expected.bytes);
   if(expected.preset==='performance')await page.screenshot({path:output.replace(/\.json$/,'-drag-performance.png')});
   await page.mouse.up();await page.keyboard.up('Shift');
   await page.waitForFunction(()=>!proof.store.getState().isSliderDragging&&proof.store.getState().interactivePatch===null);
   await sample(0.8);const released=samples.pop();assert.equal(released.jpegSha256,native.frames[1].jpegSha256);assert.equal(released.bytes,native.frames[1].jpegBytes);
   interactiveSamples.push({preset:expected.preset,...captured,finalAfterRelease:released});
   await slider.locator('xpath=../..').locator('span[data-tooltip]').click();const number=page.getByLabel('Original Basic panel').locator('input[type=text]').first();await number.fill('0');await number.press('Enter');await sample(0);const restored=samples.pop();assert.equal(restored.jpegSha256,result.hash);
  }
 }
 const geometrySamples=[];
 if(nativeGeometry||nativeCrop){
  for(const expected of [...(nativeGeometry??[]),...(nativeCrop??[])]){
   const minimum=await page.evaluate(()=>proof.trace.length-1);
   if(expected.action==='Reset geometry')await page.getByLabel('Original geometry panel').locator('button[data-tooltip="Reset Crop & Transform"]').click();
   else await page.getByLabel('Original geometry panel').getByText(expected.action,{exact:true}).click();
   const captured=await page.evaluate(async({desired,minimum})=>{
    const deadline=performance.now()+30000;
    while(performance.now()<deadline){
     const frame=proof.trace.findLast((f,i)=>i>minimum&&f.command==='render-result'&&!f.interactive&&f.exposure===0&&Object.entries(desired).every(([k,v])=>(v&&typeof v==='object'?Object.keys(v).every(c=>f.geometry?.[k]?.[c]===v[c]):f.geometry?.[k]===v)));
     const state=proof.store.getState(),url=state.finalPreviewUrl;
     if(frame&&url){try{const b=await(await fetch(url)).arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(hash===frame.jpegSha256){const bitmap=await createImageBitmap(new Blob([b],{type:'image/jpeg'}));const dimensions=[bitmap.width,bitmap.height];bitmap.close();return{frame,dimensions,originalSize:state.originalSize,crop:state.adjustments.crop,preview:proof.trace.findLast(p=>p.command==='preview-result'&&Object.entries(desired).every(([k,v])=>(v&&typeof v==='object'?Object.keys(v).every(c=>p.geometry?.[k]?.[c]===v[c]):p.geometry?.[k]===v)))};}
     }catch{/* The unchanged hook may revoke an intermediate URL. */}}
     await new Promise(resolve=>requestAnimationFrame(resolve));
    }throw Error('Original geometry control did not publish matching frame');
   },{desired:expected.geometry,minimum});
   assert.deepEqual(captured.dimensions,[expected.width,expected.height]);assert.deepEqual(captured.originalSize,{width:2048,height:1536});assert.deepEqual(captured.crop?{x:captured.crop.x,y:captured.crop.y,width:captured.crop.width,height:captured.crop.height}:null,expected.geometry.crop??null);
   if(expected.cropOffset){assert.deepEqual(captured.preview.cropOffset,expected.cropOffset);assert.equal(captured.preview.scaleForGpu,expected.scaleForGpu);}
   for(const key of ['jpegSha256','rgbaSha256','adjustmentSha256'])assert.equal(captured.frame[key],expected[key],`Native geometry ${expected.action} ${key}`);
   assert.equal(captured.preview.rgbSha256,expected.rgbSha256);assert.equal(captured.frame.bytes,expected.bytes);
   await page.waitForFunction(({width,height})=>[...document.querySelectorAll('svg image')].some(node=>{
    const box=node.getBoundingClientRect();return node.href.baseVal===proof.store.getState().finalPreviewUrl&&node.parentElement.querySelectorAll('image').length===1&&box.width>0&&box.height>0&&Math.abs(box.width/box.height-width/height)<0.005;
   }),{width:expected.width,height:expected.height});
   geometrySamples.push({action:expected.action,displaySettled:true,...captured});
   if(expected.action==='1:1')await page.screenshot({path:output.replace(/\.json$/,'-square.png')});
   if(geometrySamples.length===1)await page.screenshot({path:output.replace(/\.json$/,'-rotate-right.png')});
  }
  assert.equal(geometrySamples.at(-1).frame.jpegSha256,result.hash);
 }
 const cropRefusals=await page.evaluate(async()=>{
  const m=await import('/engine/cw_rapidraw_wasm_probe.js');let wasmRejected=0,transportRejected=0;
  const cases=[[5,4,new Float32Array(60),3,0,'{"x":-1,"y":0,"width":3,"height":3}'],[5,4,new Float32Array(60),3,0,'{"x":0.5,"y":0,"width":3,"height":3}'],[5,4,new Float32Array(60),3,0,'{"x":5,"y":0,"width":3,"height":3}'],[5,4,new Float32Array(60),3,0,'{"x":0,"y":0,"width":0,"height":3}'],[5,4,new Float32Array(60),3,0,'{"x":0,"y":0,"width":32769,"height":3}'],[5,4,new Float32Array(59),3,0,'null'],[5,4,new Float32Array(60).fill(NaN),3,0,'null'],[5,4,new Float32Array(60),3,4,'null'],[5,4,new Float32Array(60),3,0,'{"x":'],[2048,1536,new Float32Array(0),2048,0,'null'],[5,4,new Float32Array(60),1,0,'{"x":0,"y":0,"width":5,"height":1}']];
  for(const [w,h,p,t,steps,c]of cases){try{m.crop_preview_rgb32f(w,h,p,t,steps,false,false,c);}catch{wasmRejected++;}}
  const a=proof.store.getState().adjustments;
  for(const crop of [{x:-1,y:0,width:5,height:5},{x:0.5,y:0,width:5,height:5},{x:0,y:0,width:0,height:5},{x:2048,y:0,width:5,height:5}]){try{await rapidRawTransport.invoke('apply_adjustments',{jsAdjustments:{...a,crop}});}catch{transportRejected++;}}
  const restored=await rapidRawTransport.invoke('apply_adjustments',{jsAdjustments:a});
  const restoredHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',restored))].map(v=>v.toString(16).padStart(2,'0')).join('');
  return {wasmRejected,transportRejected,restoredHash};
 });assert.equal(cropRefusals.wasmRejected,11);assert.equal(cropRefusals.transportRejected,4);assert.equal(cropRefusals.restoredHash,result.hash);
 let cropCanvas=null,fineRotation=null;
 if(canvasConfig){
  const runNative=(command,args)=>new Promise((resolve,reject)=>{const child=spawn(command,args,{timeout:120000,env:{...process.env,...canvasConfig.nativeEnv},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('exit',code=>code===0?resolve(stdout):reject(Error('Native reference failed: '+stderr.slice(-1500))));});
  async function reference(kind,crop){
   const directory=path.join(canvasConfig.output,kind);await mkdir(directory,{recursive:true});
   try{const cached=JSON.parse(await readFile(path.join(directory,'reference.json'),'utf8'));assert.equal(cached.baseRgbSha256,nativeResize.originalRgbSha256);if(kind==='uncropped')return cached;assert.deepEqual(cached.geometry.crop,crop);return cached;}catch{}
   const binary=kind==='uncropped'?canvasConfig.uncroppedBinary:canvasConfig.cropBinary;
   const args=['prepare',canvasConfig.fullRgb,'2048','1536','0','false','false',...(kind==='uncropped'?[]:[JSON.stringify(crop)]),directory];
   const prepared=JSON.parse(await runNative(binary,args));
   const renderPath=path.join(directory,'native-render.json'),png=path.join(directory,'native-png');
   await writeFile(renderPath,await runNative(canvasConfig.renderBinary,['--rgb-f32',path.join(directory,'rgb.f32'),String(prepared.width),String(prepared.height),'--eight-bit','--png-dir',png,'--camera-settings',canvasConfig.cameraSettings]));
   const expected=JSON.parse(await runNative(binary,['encode',directory,renderPath,png]));return expected;
  }
  await page.locator('[data-tab-id="layout-tab-crop"]').click();
  await page.waitForFunction(()=>proof.uiStore.getState().activePanel==='crop');
  const cropImage=page.getByAltText('Crop preview');await cropImage.waitFor({state:'visible'});
  await page.waitForFunction(()=>{const i=document.querySelector('img[alt="Crop preview"]');return i?.complete&&i.naturalWidth>0&&i.src===proof.store.getState().uncroppedAdjustedPreviewUrl&&proof.trace.some(t=>t.command==='uncropped-result');});
  const uncropped=await page.evaluate(async()=>{const s=proof.store.getState(),bytes=await(await fetch(s.uncroppedAdjustedPreviewUrl)).arrayBuffer();return{frame:proof.trace.findLast(t=>t.command==='uncropped-result'),sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''),dataUrl:s.uncroppedAdjustedPreviewUrl.startsWith('data:image/jpeg;base64,'),crop:s.adjustments.crop};});
  const nativeUncropped=await reference('uncropped',null);
  assert.equal(uncropped.dataUrl,true);assert.equal(uncropped.sha256,nativeUncropped.jpegSha256);
  for(const key of ['jpegSha256','rgbaSha256','adjustmentSha256','rgbSha256','scaleForGpu','bytes'])assert.equal(uncropped.frame[key],nativeUncropped[key],`Native uncropped ${key}`);
  assert.deepEqual(uncropped.frame.cropOffset,[0,0]);
  const handle=page.locator('.ReactCrop__drag-handle[data-ord="se"]');await handle.waitFor({state:'visible'});
  const box=await handle.boundingBox();assert.ok(box);
  const point=await handle.evaluate(node=>{const r=node.getBoundingClientRect();for(const dx of [2,4,6,8,10])for(const dy of [2,4,6,8,10]){const x=r.x+dx,y=r.y+dy;if(document.elementFromPoint(x,y)?.closest('[data-ord="se"]')===node)return{x,y};}return null;});
  assert.ok(point,'Original visible crop handle must receive the pointer');
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x-72,point.y-54,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>{const c=proof.store.getState().adjustments.crop;return c?.width>0&&c?.height>0&&c.width<2048&&c.height<1536;},{},{timeout:5000});
  const crop=await page.evaluate(()=>proof.store.getState().adjustments.crop);
  assert.ok(['x','y','width','height'].every(k=>Number.isInteger(crop[k])));
  await page.screenshot({path:output.replace(/\.json$/,'-crop-canvas.png')});
  const nativeDrag=await reference('drag',crop);
  await page.locator('[data-tab-id="layout-tab-adjustments"]').click();
  const drag=await page.evaluate(async(expected)=>{const end=performance.now()+30000;while(performance.now()<end){const s=proof.store.getState(),frame=proof.trace.findLast(t=>t.command==='render-result'&&t.jpegSha256===expected.jpegSha256);if(frame&&s.finalPreviewUrl){const b=await(await fetch(s.finalPreviewUrl)).arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash===expected.jpegSha256)return{frame,crop:s.adjustments.crop,preview:proof.trace.findLast(t=>t.command==='preview-result'&&t.geometry.crop?.width===s.adjustments.crop.width)};}await new Promise(r=>requestAnimationFrame(r));}throw Error('Original crop drag did not publish native frame');},nativeDrag);
  for(const key of ['jpegSha256','rgbaSha256','adjustmentSha256','bytes'])assert.equal(drag.frame[key],nativeDrag[key],`Native drag ${key}`);
  assert.equal(drag.preview.rgbSha256,nativeDrag.rgbSha256);assert.equal(drag.preview.scaleForGpu,nativeDrag.scaleForGpu);assert.deepEqual(drag.preview.cropOffset,nativeDrag.cropOffset);
  await page.waitForFunction(({width,height})=>[...document.querySelectorAll('svg image')].some(node=>{const box=node.getBoundingClientRect();return node.href.baseVal===proof.store.getState().finalPreviewUrl&&node.parentElement.querySelectorAll('image').length===1&&box.width>0&&Math.abs(box.width/box.height-width/height)<0.005;}),nativeDrag);
  lastTraceIndex=await page.evaluate(()=>proof.trace.length-1);lastUrl=await page.evaluate(()=>proof.store.getState().finalPreviewUrl);
  await page.getByLabel('Original geometry panel').locator('button[data-tooltip="Reset Crop & Transform"]').click();await sample(0);const restored=samples.pop();assert.equal(restored.jpegSha256,result.hash);
  delete drag.frame.adjustments;
  cropCanvas={actualOriginalTab:true,actualCorner:'se',pointerDelta:[-72,-54],uncropped,nativeUncropped,drag,nativeDrag,displaySettled:true,restored};
  if(canvasConfig.fineBinary){
   const cases=[];
   async function fineReference(geometry,name){
    const directory=path.join(canvasConfig.fineOutput,name);await mkdir(directory,{recursive:true});
    let expected;
    try{expected=JSON.parse(await readFile(path.join(directory,'reference.json'),'utf8'));assert.deepEqual(expected.geometry,{...geometry,rotation:Math.fround(geometry.rotation)});assert.equal(expected.baseRgbSha256,nativeResize.originalRgbSha256);}
    catch{
     const prepared=JSON.parse(await runNative(canvasConfig.fineBinary,['prepare',canvasConfig.fullRgb,'2048','1536',String(geometry.orientationSteps),String(geometry.flipHorizontal),String(geometry.flipVertical),JSON.stringify(geometry.crop),String(geometry.rotation),directory]));
     const renderPath=path.join(directory,'native-render.json'),png=path.join(directory,'native-png');
     await writeFile(renderPath,await runNative(canvasConfig.renderBinary,['--rgba-f32',path.join(directory,'rgba.f32'),String(prepared.width),String(prepared.height),'--eight-bit','--png-dir',png,'--camera-settings',canvasConfig.cameraSettings]));
     expected=JSON.parse(await runNative(canvasConfig.fineBinary,['encode',directory,renderPath,png]));
    }
    return expected;
   }
   for(const angle of [5.3,-7.1]){
    await page.locator('[data-tab-id="layout-tab-crop"]').click();
    await page.waitForFunction(()=>proof.uiStore.getState().activePanel==='crop');
    const slider=page.getByLabel('Original geometry panel').locator('input[type=range]').first(),control=slider.locator('xpath=../..');
    await control.locator('span[data-tooltip]').click();const input=control.locator('input[type=text]');await input.fill(String(angle));await input.press('Enter');
    await page.waitForFunction(angle=>proof.store.getState().adjustments.rotation===angle,angle);
    const geometry=await page.evaluate(()=>{const a=proof.store.getState().adjustments;return{orientationSteps:a.orientationSteps,flipHorizontal:a.flipHorizontal,flipVertical:a.flipVertical,crop:a.crop??null,rotation:a.rotation};});
    await page.screenshot({path:output.replace(/\.json$/,`-fine-${angle}.png`)});
    const expected=await fineReference(geometry,'angle-'+angle);
    await page.locator('[data-tab-id="layout-tab-adjustments"]').click();
    const captured=await page.evaluate(async angle=>{const deadline=performance.now()+30000;while(performance.now()<deadline){const state=proof.store.getState(),frame=proof.trace.findLast(t=>t.command==='render-result'&&!t.interactive&&t.geometry.rotation===angle),preview=proof.trace.findLast(t=>t.command==='preview-result'&&t.geometry.rotation===angle);if(frame&&preview&&state.finalPreviewUrl){const b=await(await fetch(state.finalPreviewUrl)).arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash===frame.jpegSha256)return{frame,preview,hash};}await new Promise(r=>requestAnimationFrame(r));}throw Error('Fine rotation did not publish original final preview');},angle);
    for(const key of ['jpegSha256','rgbaSha256','adjustmentSha256','bytes'])assert.equal(captured.frame[key],expected[key],`Native fine rotation ${angle} ${key}`);
    assert.equal(captured.preview.rgbSha256,expected.rgbSha256);assert.equal(captured.preview.uploadSha256,expected.inputRgbaF16Sha256);assert.equal(captured.preview.scaleForGpu,expected.scaleForGpu);assert.deepEqual(captured.preview.cropOffset,expected.cropOffset);
    await page.waitForFunction(()=>[...document.querySelectorAll('svg image')].some(n=>n.href.baseVal===proof.store.getState().finalPreviewUrl&&n.parentElement.querySelectorAll('image').length===1&&n.getBoundingClientRect().width>0));
    delete captured.frame.adjustments;cases.push({angle,geometry,expected,...captured});
    await page.locator('[data-tab-id="layout-tab-crop"]').click();await page.getByLabel('Original geometry panel').locator('button[data-tooltip="Reset Fine Rotation"]').click();await page.waitForFunction(()=>proof.store.getState().adjustments.rotation===0);
    lastTraceIndex=await page.evaluate(()=>proof.trace.length-1);lastUrl=await page.evaluate(()=>proof.store.getState().finalPreviewUrl);
    await page.locator('[data-tab-id="layout-tab-adjustments"]').click();
    const reset=await page.evaluate(async previousIndex=>{const deadline=performance.now()+30000;while(performance.now()<deadline){const s=proof.store.getState(),frame=proof.trace.findLast((t,i)=>i>previousIndex&&t.command==='render-result'&&!t.interactive&&t.geometry.rotation===0),preview=proof.trace.findLast((t,i)=>i>previousIndex&&t.command==='preview-result'&&t.geometry.rotation===0);if(frame&&preview&&s.adjustments.rotation===0&&s.finalPreviewUrl){try{const b=await(await fetch(s.finalPreviewUrl)).arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash===frame.jpegSha256&&JSON.stringify(preview.geometry)===JSON.stringify(frame.geometry))return{geometry:frame.geometry,frame,preview,jpegSha256:hash};}catch{/* Original hook may revoke a superseded URL. */}}await new Promise(r=>requestAnimationFrame(r));}throw Error('Fine reset did not publish a new zero-angle frame');},lastTraceIndex);
    assert.equal(reset.geometry.rotation,0);
    const nativeReset=await fineReference(reset.geometry,'reset-settled-'+angle);
    for(const key of ['jpegSha256','rgbaSha256','adjustmentSha256','bytes'])assert.equal(reset.frame[key],nativeReset[key],`Native fine reset ${angle} ${key}`);
    assert.equal(reset.preview.rgbSha256,nativeReset.rgbSha256);assert.equal(reset.preview.uploadSha256,nativeReset.inputRgbaF16Sha256);
    delete reset.frame.adjustments;cases.at(-1).fineReset={expected:nativeReset,...reset};
    lastTraceIndex=await page.evaluate(()=>proof.trace.length-1);lastUrl=await page.evaluate(()=>proof.store.getState().finalPreviewUrl);
    await page.getByLabel('Original geometry panel').locator('button[data-tooltip="Reset Crop & Transform"]').click();await sample(0);const fullReset=samples.pop();assert.equal(fullReset.jpegSha256,result.hash);cases.at(-1).fullReset=fullReset;
   }
   const pointerCases=[];
   if(canvasConfig.finePointer){
    for(const delta of [18,-23]){
     await page.locator('[data-tab-id="layout-tab-crop"]').click();await page.waitForFunction(()=>proof.uiStore.getState().activePanel==='crop');
     const slider=page.getByLabel('Original geometry panel').locator('input[type=range]').first();await slider.scrollIntoViewIfNeeded();
     const box=await slider.boundingBox();assert.ok(box);const start={x:box.x+box.width/2,y:box.y+box.height/2};
     const before=await page.evaluate(()=>({path:proof.store.getState().selectedImage.path,rotation:proof.store.getState().adjustments.rotation,crop:proof.store.getState().adjustments.crop,url:proof.store.getState().uncroppedAdjustedPreviewUrl,traceIndex:proof.trace.length-1}));assert.equal(before.rotation,0);assert.equal(before.crop,null);
     await page.mouse.move(start.x,start.y);await page.mouse.down();await page.waitForFunction(()=>proof.store.getState().isRotationActive);
     const live=[];
     for(const fraction of [0.5,1]){
      await page.mouse.move(start.x+delta*fraction,start.y,{steps:4});
      await page.waitForFunction(()=>{const s=proof.store.getState();return s.isRotationActive&&typeof s.liveRotation==='number'&&Math.abs(s.liveRotation)>0;});
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const snapshot=await page.evaluate(async()=>{const s=proof.store.getState(),bytes=await(await fetch(s.finalPreviewUrl)).arrayBuffer(),publishedSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''),image=document.querySelector('img[alt="Crop preview"]'),selection=document.querySelector('.ReactCrop__crop-selection'),matrix=new DOMMatrix(getComputedStyle(image).transform);return{publishedSha256,rotation:s.adjustments.rotation,liveRotation:s.liveRotation,isRotationActive:s.isRotationActive,crop:s.adjustments.crop,imageTransform:image.style.transform,cssDegrees:Math.atan2(matrix.b,matrix.a)*180/Math.PI,selection:{x:parseFloat(selection.style.left),y:parseFloat(selection.style.top),width:parseFloat(selection.style.width),height:parseFloat(selection.style.height)},cropPreviewSha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(image.src)).arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join(''),sameUncroppedUrl:s.uncroppedAdjustedPreviewUrl===image.src,renderedRotation:proof.trace.findLast(t=>t.command==='render-result')?.geometry.rotation};});
      assert.equal(snapshot.rotation,0);assert.equal(snapshot.crop,null);assert.equal(snapshot.isRotationActive,true);assert.equal(snapshot.imageTransform,`rotate(${snapshot.liveRotation}deg)`);assert.ok(Math.abs(snapshot.cssDegrees-snapshot.liveRotation)<0.0001);assert.equal(snapshot.sameUncroppedUrl,true);assert.equal(snapshot.cropPreviewSha256,nativeUncropped.jpegSha256);assert.ok(snapshot.selection.width>0&&snapshot.selection.height>0&&snapshot.selection.width<100&&snapshot.selection.height<100);
      live.push(snapshot);
     }
     assert.ok(Math.abs(live[1].liveRotation)>Math.abs(live[0].liveRotation));
     await page.screenshot({path:output.replace(/\.json$/,`-pointer-${delta}-live.png`)});
     const angle=live.at(-1).liveRotation;await page.mouse.up();
     await page.waitForFunction(angle=>{const s=proof.store.getState(),c=s.adjustments.crop;return !s.isRotationActive&&s.liveRotation===null&&s.adjustments.rotation===angle&&c&&['x','y','width','height'].every(k=>Number.isInteger(c[k]));},angle);
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     const geometry=await page.evaluate(()=>{const a=proof.store.getState().adjustments;return{orientationSteps:a.orientationSteps,flipHorizontal:a.flipHorizontal,flipVertical:a.flipVertical,crop:a.crop??null,rotation:a.rotation};});assert.equal(geometry.rotation,angle);
     const expected=await fineReference(geometry,'pointer-'+delta+'-'+digest(JSON.stringify(geometry)).slice(0,12));
     await page.locator('[data-tab-id="layout-tab-adjustments"]').click();
     const captured=await page.evaluate(async({expected,previousIndex})=>{const end=performance.now()+30000;while(performance.now()<end){const s=proof.store.getState(),frame=proof.trace.findLast((t,i)=>i>previousIndex&&t.command==='render-result'&&!t.interactive&&t.jpegSha256===expected.jpegSha256),preview=proof.trace.findLast((t,i)=>i>previousIndex&&t.command==='preview-result'&&t.rgbSha256===expected.rgbSha256&&t.uploadSha256===expected.inputRgbaF16Sha256);if(frame&&preview&&s.finalPreviewUrl){try{const b=await(await fetch(s.finalPreviewUrl)).arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash===expected.jpegSha256)return{frame,preview,hash,sameDocument:s.selectedImage.path};}catch{}}await new Promise(r=>requestAnimationFrame(r));}throw Error('Original pointer release did not publish native fine frame');},{expected,previousIndex:before.traceIndex});
     assert.equal(captured.sameDocument,before.path);delete captured.sameDocument;
     for(const key of ['jpegSha256','rgbaSha256','adjustmentSha256','bytes'])assert.equal(captured.frame[key],expected[key],`Native pointer ${delta} ${key}`);
     assert.equal(captured.preview.scaleForGpu,expected.scaleForGpu);assert.deepEqual(captured.preview.cropOffset,expected.cropOffset);delete captured.frame.adjustments;
     await page.waitForFunction(()=>[...document.querySelectorAll('svg image')].some(n=>n.href.baseVal===proof.store.getState().finalPreviewUrl&&n.parentElement.querySelectorAll('image').length===1&&n.getBoundingClientRect().width>0));
     await page.screenshot({path:output.replace(/\.json$/,`-pointer-${delta}-released.png`)});
     const previousIndex=await page.evaluate(()=>proof.trace.length-1);await page.getByLabel('Original geometry panel').locator('button[data-tooltip="Reset Crop & Transform"]').click();
     await page.waitForFunction(async({hash,previousIndex})=>{const s=proof.store.getState();if(s.adjustments.rotation!==0||s.adjustments.crop!==null||!s.finalPreviewUrl||!proof.trace.some((t,i)=>i>previousIndex&&t.command==='render-result'&&t.geometry.rotation===0&&t.jpegSha256===hash))return false;try{const b=await(await fetch(s.finalPreviewUrl)).arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('')===hash;}catch{return false;}},{hash:result.hash,previousIndex});
     pointerCases.push({pointerDelta:delta,live,angle,geometry,expected,...captured,displaySettled:true,liveRotationClearedOnRelease:true,fullResetBaselineExact:true,sameDocument:true});
    }
   }
   // A separate backend contract case keeps the transparent border that the source UI's safe crop removes.
   const alphaGeometry={orientationSteps:0,flipHorizontal:false,flipVertical:false,crop:null,rotation:12.5};
   const nativeAlpha=await fineReference(alphaGeometry,'transparent-border');
   const alphaInput=await readFile(path.join(canvasConfig.fineOutput,'transparent-border','rgba.f32'));
   let nonOpaqueInputPixels=0;for(let i=12;i<alphaInput.length;i+=16)if(alphaInput.readFloatLE(i)<1)nonOpaqueInputPixels++;assert.ok(nonOpaqueInputPixels>0);
   const alphaResult=await page.evaluate(async geometry=>{const b=await rapidRawTransport.invoke('apply_adjustments',{jsAdjustments:{...proof.store.getState().adjustments,...geometry},isInteractive:false}),frame=proof.trace.findLast(t=>t.command==='render-result'),preview=proof.trace.findLast(t=>t.command==='preview-result');return{frame,preview,jpegSha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('')};},alphaGeometry);
   for(const key of ['jpegSha256','rgbaSha256','adjustmentSha256','bytes'])assert.equal(alphaResult.frame[key],nativeAlpha[key],`Native transparent border ${key}`);
   assert.equal(alphaResult.preview.uploadSha256,nativeAlpha.inputRgbaF16Sha256);assert.equal(alphaResult.preview.rgbSha256,nativeAlpha.rgbSha256);delete alphaResult.frame.adjustments;
   const refusals=await page.evaluate(async()=>{const m=await import('/engine/cw_rapidraw_wasm_probe.js');let wasm=0,bridge=0;for(const angle of [NaN,Infinity,-46,46])try{m.fine_preview_rgb32f(8,6,new Float32Array(144),8,0,false,false,'null',angle);}catch{wasm++;}try{m.fine_preview_rgb32f(2098,2098,new Float32Array(0),512,0,false,false,JSON.stringify({x:0,y:0,width:1,height:1}),5);}catch{wasm++;}for(const rotation of [NaN,Infinity,46,'5'])try{await rapidRawTransport.invoke('apply_adjustments',{jsAdjustments:{...proof.store.getState().adjustments,rotation},isInteractive:false});}catch{bridge++;}return{wasm,bridge};});
   assert.deepEqual(refusals,{wasm:5,bridge:4});
   const recovered=await page.evaluate(async()=>{const b=await rapidRawTransport.invoke('apply_adjustments',{jsAdjustments:proof.store.getState().adjustments,isInteractive:false});return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');});assert.equal(recovered,result.hash);
   fineRotation={sameDocumentRecoveredAfterRefusal:true,actualOriginalSlider:true,actualOriginalReset:true,rgbaAlphaPreserved:true,fullNativeUploadExact:true,cases,pointerCases,transparentBorder:{directBackendCase:true,nonOpaqueInputPixels,nativeAlpha,...alphaResult},refusals,baselineRestored:true,interactiveSizing:'explicitly unavailable until independently proved'};
  }

 }
 const afterInteractive=await page.evaluate(()=>({gpuErrors:proof.gpuErrors,exposure:proof.store.getState().adjustments.exposure,originalSize:proof.store.getState().originalSize,patchCleared:proof.store.getState().interactivePatch===null,dragging:proof.store.getState().isSliderDragging}));
 assert.deepEqual(afterInteractive.gpuErrors,[]);assert.equal(afterInteractive.exposure,0);assert.equal(afterInteractive.patchCleared,true);assert.equal(afterInteractive.dragging,false);assert.deepEqual(afterInteractive.originalSize,{width:2048,height:1536});
 assert.deepEqual(pageErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(blockedExternalRequests,[]);
 assert.ok(consoleErrors.every(allowedConsoleError),JSON.stringify(consoleErrors));
 await page.screenshot({path:output.replace(/\.json$/,'.png')});
 await page.evaluate(()=>proof.close());
 for(const entry of [...geometrySamples,...interactiveSamples])delete entry.frame.adjustments;
 const report={stage:canvasConfig?.fineBinary?'RWASM-03 original fine rotation Slider and reset, RGBA alpha/native shader/JPEG parity':canvasConfig?'RWASM-03 original crop tool, uncropped q80 data URL and actual corner drag':nativeCrop?'RWASM-03 original CropPanel integer crop presets, rotate/flip and reset':'RWASM-03 original CropPanel quarter-turn and flip controls',...provenance,publicFixture:{id:pin.id,license:pin.license,sourceSha256:pin.sourceSha256},browserVersion:browser.version(),chromiumSandbox,first,result,samples,blockedExternalRequests,nativeComparison:native?{frames:5,completeAdjustmentsExact:true,renderedPixelsExact:true,encodedJpegExact:true}:null,nativeGeometry,nativeCrop,geometrySamples,cropRefusals,cropCanvas,fineRotation,nativeInteractive,interactiveSamples,afterInteractive,nativeResize,resizeRecovery,rejectedResizeInputs,refusedOversizePreview:true,workerUsableAfterRefusal:true,pageErrors,failedRequests,expectedSaveErrors:consoleErrors.filter(x=>x.includes('Auto-save failed:')).length,expectedUnavailableLensReads:consoleErrors.filter(x=>x.includes('get_lensfun_makers')).length,
  scope:canvasConfig?.fineBinary?"Original CropPanel Slider value edit and reset drive source fixed-canvas bilinear fine rotation at +5.3/-7.1 degrees. Original RGBA alpha, complete f16 upload, RGB, original WGSL RGBA8 and q94 JPEG compare against independent native source. Integer crops/orientation/flip remain supported; interactive fine sizing explicitly refuses. Actual original pointer fine drag/release is separately reported when configured, including source live CSS/safe crop and delayed adjustment commit. One public fixture; interactive fine sizing, fractional crops/warp/effects/ROI/full App/export/providers remain open.":canvasConfig?"Unchanged original PanelSwitcher/useImageProcessing/Editor/ImageCanvas/ReactCrop handles activate Crop, display source q80 uncropped data URL, commit integer crop through a real corner pointer drag, return to Adjustments and reset. Original App distance5 pointer sensor config is retained in the QA wrapper. One public fixture/corner/native comparison; other crop interactions/fine rotation/warp/effects/ROI/metadata/full App/menus/analytics/provider/save/export acceptance remain open.":'Original hooks/stores/Editor/ImageCanvas/Basic/Slider unchanged, QA composition and invoke alias only. Quality-developed2048x1536 load and original neutral-geometry512x384 area preview before bounded GPU upload. Original Slider drag/release verifies no-ROI full/high/performance preview sizing/quality. Original CropPanel quarter-turn and flip actions verified; full App menus, metadata/sidecars, crop canvas/tool activation, fine rotation/warp/effects/ROI/analytics/save/provider acceptance remain open. Integer crop presets/rotation/flip/reset are bounded source processing.'};
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
}catch(error){console.log(JSON.stringify({pageErrors,failedRequests,consoleErrors}));try{await page.screenshot({path:output.replace(/\.json$/,'-failure.png')});}catch{}throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
