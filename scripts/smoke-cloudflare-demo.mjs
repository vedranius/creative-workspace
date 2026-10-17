import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2],output=process.argv[3];
if(!base||!output)throw Error('Usage: PLAYWRIGHT_MODULE=... node scripts/smoke-cloudflare-demo.mjs HTTPS_BASE OUTPUT_DIR');
await mkdir(output,{recursive:true});
const manifest=await fetch(base+'/demo-manifest.json').then(r=>r.json());assert.equal(manifest.apps.length,12);assert.equal(manifest.documentBackend,false);
const report={base,version:manifest.version,scope:'Public original-interface launch/render, consent, mode label, original decoded-WASM SHA-256; not editing, file-permission or server-processing acceptance',apps:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const home=await context.newPage();await home.goto(base,{waitUntil:'networkidle'});assert.equal(await home.locator('.card').count(),12);await home.screenshot({path:path.join(output,'studio.png'),fullPage:true});await home.close();
 for(const app of manifest.apps.filter(a=>!process.env.APP_FILTER||a.id===process.env.APP_FILTER)){
  const page=await context.newPage();const item={id:app.id,pageErrors:[],failedRequests:[]};report.apps.push(item);
  page.on('pageerror',e=>item.pageErrors.push(e.message));page.on('requestfailed',r=>item.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  try{
   await page.goto(base+'/apps/'+app.id+'/',{waitUntil:'networkidle'});assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.getByRole('button').isDisabled(),true);item.consentBeforeLoad=true;
   await page.getByRole('checkbox').check();const wasmPromise=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('.wasm'),{timeout:90000});
   await page.getByRole('button',{name:'Open original application'}).click();
   const response=await wasmPromise;const metadata=await fetch(base+app.url+'creative-workspace-ui.json').then(r=>r.json());
   const entry=metadata.files.find(f=>new URL(response.url()).pathname.endsWith('/'+f.path));assert.ok(entry);
   await page.frameLocator('iframe').locator('canvas').first().waitFor({timeout:45000});
   const frame=page.frames().find(f=>f.url().includes('/original/'));await frame.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>c.width>500&&c.height>300),null,{timeout:45000});
   item.wasmSha256=await frame.evaluate(async url=>{const r=await fetch(url);if(!r.ok)throw Error('WASM verification fetch failed');const hash=await crypto.subtle.digest('SHA-256',await r.arrayBuffer());return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');},response.url());
   assert.equal(item.wasmSha256,entry.sha256);item.originalWasmVerified=true;
   await page.waitForTimeout(3500);item.title=await frame.title();item.crossOriginIsolated=await frame.evaluate(()=>crossOriginIsolated);assert.equal(item.crossOriginIsolated,true);
   assert.match(await page.locator('.mode-label').innerText(),/Processing uses your computer/);await page.screenshot({path:path.join(output,app.id+'.png')});item.rendered=true;
  }catch(e){item.error=e.message;await page.screenshot({path:path.join(output,app.id+'-error.png')}).catch(()=>{});}
  await page.close();await writeFile(path.join(output,'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(app.id,item.error||'original WASM/render verified');
 }
 await context.close();
}finally{await browser.close();await writeFile(path.join(output,'browser.json'),JSON.stringify(report,null,2)+'\n');}
assert.ok(report.apps.every(a=>a.rendered&&a.originalWasmVerified&&!a.pageErrors.length&&!a.failedRequests.length),'Some public app checks failed; inspect browser.json');
