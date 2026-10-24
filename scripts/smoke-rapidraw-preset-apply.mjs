// Persisted original preset card/amount/toggle -> original editor hooks and native-exact previews.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [stage,fixture,native512Path,native400Dir,output]=process.argv.slice(2);if(!output)throw Error('PRESET_APPLY_STAGE PUBLIC_DNG NATIVE_QUALITY512_JSON NATIVE400_DIR OUTPUT_JSON');
const hash=b=>createHash('sha256').update(b).digest('hex'),meta=JSON.parse(await readFile(new URL('../experiments/rapidraw-wasm-core/UPSTREAM.json',import.meta.url)));
const fixturePin=JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json',import.meta.url))).fixtures.find(f=>f.id==='raw.pixls.us 1327');assert.equal(fixturePin.license,'CC0-1.0');assert.equal(hash(await readFile(fixture)),fixturePin.sourceSha256);
const source=JSON.parse(await readFile(path.join(stage,'source-proof.json'))),native512=JSON.parse(await readFile(native512Path)),native400=JSON.parse(await readFile(path.join(native400Dir,'reference.json')));
assert.deepEqual(native512,JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/quality-react-native-jpeg.json',import.meta.url))),'Use the pinned Quality512 native reference');
const native400Render=JSON.parse(await readFile(path.join(native400Dir,'render.json')));assert.equal(native400Render.adapter.driver,'SwiftShader driver','Use the same software backend as the pinned browser/Quality reference');
assert.deepEqual(source.presetApply,meta.presetApply);assert.equal(source.nativeSource,meta.nativeApplication.commit);assert.equal(native512.source,meta.nativeApplication.commit);assert.equal(native400.source,meta.nativeApplication.commit);
for(const [name,sha]of Object.entries(meta.presetApply.sourceFiles))if(name.startsWith('src/'))assert.equal(hash(await readFile(path.join(stage,name))),sha,name);
for(const [name,sha]of Object.entries(source.runtimeSha256)){assert.equal(hash(await readFile(path.join(stage,'dist/engine',name))),sha);assert.equal(hash(await readFile(new URL('../experiments/rapidraw-wasm-core/'+name,import.meta.url))),sha);}
const assets=new Map(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml'};
async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name),url=prefix+'/'+e.name;if(e.isDirectory())await walk(file,url);else assets.set(url,[types[path.extname(file)]??'application/octet-stream',await readFile(file)]);}}
await walk(path.join(stage,'dist'));assets.set('/',assets.get('/index.html'));assets.set('/peer.html',['text/html',Buffer.from('<!doctype html><title>Library peer</title>')]);
const server=createServer((req,res)=>{const a=assets.get(new URL(req.url,'http://localhost').pathname);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':a[0],'Cache-Control':'no-store'}).end(a[1]);});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const errors=[],failed=[],external=[],knownUnavailable=[],consoleErrors=[];
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader']});
 const context=await browser.newContext({viewport:{width:2100,height:1050}}),origin='http://127.0.0.1:'+server.address().port;
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin){external.push(u.origin);return r.abort();}return r.continue();});
 await context.addInitScript(()=>{
  globalThis.presetQa={calls:0,async pickInputs(){this.calls++;const file=new File([JSON.stringify({creator:'Anonymous',presets:[{preset:{id:'source-style',name:'Exposure +0.8',adjustments:{exposure:0.8},includeMasks:false,includeCropTransform:false,presetType:'style'}}]})],'exposure.rrpreset',{lastModified:1});return [{kind:'file',name:file.name,queryPermission:async()=> 'granted',getFile:async()=>file}];}};

 });
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));page.on('console',m=>{if(m.type()==='error'){if(m.text().includes('does not support get_lensfun_makers')||m.text().includes('Auto-save failed:')&&m.text().includes('save_metadata_and_update_thumbnail'))knownUnavailable.push(m.text());else consoleErrors.push(m.text());}});
 const ready=async revision=>page.waitForFunction(n=>globalThis.proof?.presetLibrary.status().revision===n&&!proof.presetLibrary.status().uncertain&&!proof.presetLibrary.status().pendingIO,revision);
 const panel=page.getByLabel('Original Presets panel');
 await page.goto(origin);await ready(0);await panel.locator('button[data-tooltip="Import presets from .rrpreset file"]').click();await ready(1);await page.waitForFunction(()=>proof.trace.some(t=>t.command==='handle_import_presets_from_files'&&t.phase==='resolved'));
 const stored=await page.evaluate(async()=>({status:proof.presetLibrary.status(),presets:await proof.presetLibrary.load()}));assert.equal(stored.presets.length,1);assert.equal(stored.presets[0].preset.presetType,'style');assert.notEqual(stored.presets[0].preset.id,'source-style');
 await page.reload();await ready(1);assert.equal(await page.evaluate(()=>proof.store.getState().selectedImage),null);assert.equal(await page.evaluate(()=>presetQa.calls),0);
 const open=async()=>{await page.getByLabel('Open RAW fixture').setInputFiles(fixture);await page.waitForFunction(()=>proof.store.getState().selectedImage?.isReady&&proof.store.getState().finalPreviewUrl);};
 let lastUrl=null,lastIndex=-1;
 const sample=async exposure=>{
  const result=await page.evaluate(async({exposure,previousUrl,previousIndex})=>{
   const deadline=performance.now()+30000;
   while(performance.now()<deadline){
    const index=proof.trace.findLastIndex((x,i)=>i>previousIndex&&x.command==='render-result'&&!x.interactive&&x.exposure===exposure),frame=proof.trace[index],state=proof.store.getState(),url=state.finalPreviewUrl;
    if(frame&&state.adjustments.exposure===exposure&&url&&url!==previousUrl){try{const bytes=await(await fetch(url)).arrayBuffer(),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(sha256===frame.jpegSha256&&proof.store.getState().finalPreviewUrl===url)return {index,url,frame,bytes:bytes.byteLength,sha256};}catch{}}
    await new Promise(r=>requestAnimationFrame(r));
   }
   throw Error('Original preset action did not publish a matching editor frame');
  },{exposure,previousUrl:lastUrl,previousIndex:lastIndex});
  const n=native512.frames.find(f=>f.exposure===exposure);assert.ok(n);if(result.sha256!==n.jpegSha256)await writeFile(output.replace(/\.json$/,'.mismatch.json'),JSON.stringify({result,expected:n},null,2)+'\n');assert.equal(result.sha256,n.jpegSha256);assert.equal(result.bytes,n.jpegBytes);assert.equal(result.frame.rgbaSha256,n.rgbaSha256);assert.equal(result.frame.adjustmentSha256,n.adjustmentSha256);assert.deepEqual([result.frame.width,result.frame.height],[512,384]);lastUrl=result.url;lastIndex=result.index;return result;
 };
 await open();const baseline=await sample(0);
 const thumbnail=panel.getByAltText('Exposure +0.8 preview');await thumbnail.waitFor();await page.waitForFunction(()=>document.querySelector('[aria-label="Original Presets panel"] img')?.naturalWidth===400);
 const thumb=await page.evaluate(async()=>{const img=document.querySelector('[aria-label="Original Presets panel"] img'),bytes=await(await fetch(img.src)).arrayBuffer();return {dimensions:[img.naturalWidth,img.naturalHeight],bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),frame:proof.trace.findLast(t=>t.command==='preset-preview-result')};});
 await writeFile(output.replace(/\.json$/,'.thumbnail.json'),JSON.stringify({thumb,native400},null,2)+'\n');assert.deepEqual(thumb.dimensions,[400,300]);assert.equal(thumb.bytes,native400.bytes);assert.equal(thumb.sha256,native400.jpegSha256);assert.equal(thumb.frame.uploadSha256,native400Render.inputRgbaF16Sha256);for(const key of ['rgbSha256','rgbaSha256','adjustmentSha256','jpegSha256'])assert.equal(thumb.frame[key],native400[key],key);
 await panel.getByText('Exposure +0.8',{exact:true}).click();const applied=await sample(0.8);
 // Explicit transport contract probe: native thumbnail generation forces clipping off.
 const clipping=await page.evaluate(async()=>{const before=proof.store.getState().finalPreviewUrl,bytes=await rapidRawTransport.invoke('generate_preset_preview',{jsAdjustments:{...proof.store.getState().adjustments,showClipping:true}});return {mainPreviewUnchanged:proof.store.getState().finalPreviewUrl===before,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),frame:proof.trace.findLast(t=>t.command==='preset-preview-result')};});assert.equal(clipping.mainPreviewUnchanged,true);assert.equal(clipping.sha256,native400.jpegSha256);
 const amount=panel.locator('input[type=range]').locator('xpath=../..');await amount.locator('span[data-tooltip]').click();const input=amount.locator('input[type=text]');await input.fill('200');await input.press('Enter');const intensity=await sample(1.6);
 await panel.getByText('Exposure +0.8',{exact:true}).click();const restored=await sample(0);assert.equal(restored.sha256,baseline.sha256);
 await page.reload();await ready(1);assert.equal(await page.evaluate(()=>presetQa.calls),0);lastUrl=null;lastIndex=-1;await open();await panel.getByAltText('Exposure +0.8 preview').waitFor();await panel.getByText('Exposure +0.8',{exact:true}).click();const reapplied=await sample(0.8);assert.equal(reapplied.sha256,applied.sha256);
 const after=await page.evaluate(async()=>({presets:await proof.presetLibrary.load(),status:proof.presetLibrary.status(),gpuErrors:proof.gpuErrors}));assert.deepEqual(after.presets,stored.presets);assert.equal(after.status.revision,1);assert.deepEqual(after.gpuErrors,[]);
 await page.screenshot({path:output.replace(/\.json$/,'.png')});assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);assert.deepEqual(consoleErrors,[]);
 const samples=[baseline,applied,intensity,restored,reapplied];
 await writeFile(output,JSON.stringify({scope:meta.presetApply.scope,fixture:{id:fixturePin.id,license:fixturePin.license,sha256:fixturePin.sourceSha256},source,stored,thumbnail:thumb,native400,reusedNative512:native512,clippingOffContractProbe:clipping,samples:samples.map(({url,index,...s})=>s),after,errors,failed,external,consoleErrors,knownUnavailable,componentsCompared:400*300*4+samples.length*512*384*4,jpegBytesCompared:thumb.bytes+samples.reduce((n,s)=>n+s.bytes,0),assertions:{originalCardApply:true,originalAmount200:true,originalCardToggleRestores:true,reloadKeepsLibraryWithoutRawOrChooser:true,persistedPresetReapplies:true,thumbnail400q80NativeExact:true,editor512q94NativeExact:true,clippingOff:true,libraryNotModifiedByApply:true,syntheticPicker:true}},null,2)+'\n');
 await page.evaluate(()=>proof.close());await context.close();console.log(JSON.stringify({originalPresetApply:true,intensity200:true,toggleRestore:true,reloadReapply:true,thumbnailNativeExact:true}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
