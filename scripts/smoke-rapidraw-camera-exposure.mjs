// Actual original camera exposure reader and downstream original UI mapping.
// Only hash-pinned public CC0 input; derived DNGs change explicit test tags only.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';
const [artifact, input, nativeBinary, output] = process.argv.slice(2);
if (!output) throw Error('Usage: smoke-rapidraw-camera-exposure.mjs WASM_DIR PUBLIC_DNG NATIVE_DEVELOP_REFERENCE OUTPUT_JSON');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const provenance = JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json', import.meta.url)));
const fixture = provenance.fixtures.find(f => f.id === 'raw.pixls.us 1327');
assert.equal(fixture.license, 'CC0-1.0');
const original = await readFile(input); assert.equal(hash(original), fixture.sourceSha256);
// Repoint the TIFF header to a new sorted root table; every original value/data
// offset is retained. Append signed-rational test tags without modifying source.
function withTags(bytes, baseline, offset, oversize = false) {
  assert.equal(bytes.subarray(0, 4).toString('hex'), '49492a00');
  bytes = Buffer.from(bytes);
  if (oversize) {
    const seen=new Set();
    const patchRawIfd=at=>{
      if(seen.has(at)) return; seen.add(at);
      const count=bytes.readUInt16LE(at);
      for(let i=0;i<count;i++) {
        const e=at+2+i*12,tag=bytes.readUInt16LE(e);
        if(tag===256){bytes.writeUInt16LE(4,e+2);bytes.writeUInt32LE(1,e+4);bytes.writeUInt32LE(65536,e+8);}
        if(tag===330){const n=bytes.readUInt32LE(e+4),offset=bytes.readUInt32LE(e+8);for(let j=0;j<n;j++)patchRawIfd(n===1?offset:bytes.readUInt32LE(offset+j*4));}
      }
    };patchRawIfd(bytes.readUInt32LE(4));
  }
  const root = bytes.readUInt32LE(4), count = bytes.readUInt16LE(root), entries = [];
  for (let i = 0; i < count; i++) {
    const e = Buffer.from(bytes.subarray(root + 2 + i * 12, root + 14 + i * 12));
    if ([50730, 51109].includes(e.readUInt16LE(0))) continue;
    entries.push(e);
  }
  const newRoot = (bytes.length + 1) & ~1, dataStart = newRoot + 2 + (entries.length + 2) * 12 + 4;
  for (const [tag, dataOffset] of [[50730, dataStart], [51109, dataStart + 8]]) {
    const e = Buffer.alloc(12); e.writeUInt16LE(tag, 0); e.writeUInt16LE(10, 2); e.writeUInt32LE(1, 4); e.writeUInt32LE(dataOffset, 8); entries.push(e);
  }
  entries.sort((a,b) => a.readUInt16LE(0) - b.readUInt16LE(0));
  const result = Buffer.alloc(dataStart + 16); bytes.copy(result); result.writeUInt32LE(newRoot, 4); result.writeUInt16LE(entries.length, newRoot);
  entries.forEach((e,i) => e.copy(result, newRoot + 2 + i * 12));
  bytes.copy(result, newRoot + 2 + entries.length * 12, root + 2 + count * 12, root + 6 + count * 12);
  for (const [pair, at] of [[baseline,dataStart], [offset,dataStart+8]]) { result.writeInt32LE(pair[0],at); result.writeInt32LE(pair[1],at+4); }
  return result;
}
const variants = [
  { id:'original-public-dng', bytes:original, expected:-0.5, mutation:null },
  { id:'derived-positive-baseline', bytes:withTags(original,[3,4],[-1,4]), expected:0.5, mutation:{baseline:[3,4],offset:[-1,4]} },
  { id:'derived-negative-baseline', bytes:withTags(original,[-3,2],[1,4]), expected:-1.25, mutation:{baseline:[-3,2],offset:[1,4]} },
];
const invalid = [
  { id:'empty', bytes:Buffer.alloc(0) }, { id:'truncated', bytes:original.subarray(0,64) },
  { id:'oversized-raw-ifd', bytes:withTags(original,[0,1],[0,1],true) },
  { id:'nonfinite-baseline', bytes:withTags(original,[1,0],[0,1]) },
];
const temp = await mkdtemp(path.join(os.tmpdir(),'cw-camera-'));
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const core = new URL('../experiments/rapidraw-wasm-core/', import.meta.url);
let server, browser;
const errors=[], failed=[];
try {
  for (const [i,variant] of variants.entries()) {
    const file=path.join(temp,`fixture-${i}.dng`); await writeFile(file,variant.bytes,{flag:'wx'});
    const child=spawnSync(nativeBinary,[file,'--camera-exposure'],{encoding:'utf8',timeout:30000});
    assert.equal(child.status,0,child.stderr); variant.native=JSON.parse(child.stdout);
    assert.equal(variant.native.exposure.dngBaseline,variant.expected,'Derived baseline must be read by original native source');
    variant.sha256=hash(variant.bytes);
  }
  const assets=new Map([
    ['/', ['text/html',Buffer.from('<!doctype html><title>Isolated original camera exposure proof</title>')]],
    ['/worker.js',['text/javascript',await readFile(new URL('worker.js',core))]],
    ['/webgpu-renderer.js',['text/javascript',await readFile(new URL('webgpu-renderer.js',core))]],
    ['/cw_rapidraw_wasm_probe.js',['text/javascript',await readFile(path.join(artifact,'cw_rapidraw_wasm_probe.js'))]],
    ['/cw_rapidraw_wasm_probe_bg.wasm',['application/wasm',await readFile(path.join(artifact,'cw_rapidraw_wasm_probe_bg.wasm'))]],
  ]);
  for (const row of [...variants,...invalid]) assets.set(`/${row.id}.dng`,['application/octet-stream',row.bytes]);
  server=createServer((req,res)=>{const asset=req.method==='GET'&&assets.get(new URL(req.url,'http://localhost').pathname);if(!asset){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':asset[0],'Cache-Control':'no-store'});res.end(asset[1]);});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,chromiumSandbox:process.env.CHROMIUM_SANDBOX!=='false',args:['--disable-dev-shm-usage']});
  const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(new URL(r.url()).pathname));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result=await page.evaluate(async ({valid,invalid})=>{
    const wasm=await import('/cw_rapidraw_wasm_probe.js');await wasm.default();
    const host=await import('/webgpu-renderer.js');
    const call=async id=>{
      const bytes=await(await fetch(`/${id}.dng`)).arrayBuffer();
      return await new Promise((resolve,reject)=>{const worker=new Worker('/worker.js',{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(Error('Camera worker timeout'));},30000);
        worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();resolve(data);};worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.postMessage({id:1,bytes,output:'exposure'},[bytes]);});
    };
    const rows=[];
    for (const row of valid) {
      const message=await call(row.id);if(!message.ok)throw Error(message.error);
      const bits=row.native.cases.map(c=>{
        const packed=host.packUiExposureFixture(wasm,c.json,message.exposure,{baselineExposure:c.baselineExposure,compensateHighlightPreservation:c.compensateHighlightPreservation});
        return new DataView(packed.bytes.buffer,packed.bytes.byteOffset).getUint32(0,true);
      });rows.push({id:row.id,exposure:message.exposure,bits});
    }
    const rejections=[];for(const id of invalid){const message=await call(id);if(message.ok)throw Error(`Invalid input accepted: ${id}`);rejections.push({id,error:message.error});}
    return {rows,rejections};
  },{valid:variants.map(({id,native})=>({id,native})),invalid:invalid.map(v=>v.id)});
  for (const [i,row] of result.rows.entries()) {assert.deepEqual(row.exposure,variants[i].native.exposure);assert.deepEqual(row.bits,variants[i].native.cases.map(c=>c.expectedExposureBits));}
  assert.equal(result.rejections.length,invalid.length);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const report={stage:'RWASM-03 original RAW camera exposure reader and original UI exposure input',nativeSource:provenance.nativeSource,decoderSource:provenance.decoderSource,
    publicFixture:{id:fixture.id,license:fixture.license,sourceSha256:fixture.sourceSha256},
    variants:variants.map((v,i)=>({id:v.id,sha256:v.sha256,mutation:v.mutation,nativeExposure:v.native.exposure,browserExposure:result.rows[i].exposure,exactMappedExposureBits:result.rows[i].bits.length,nativeMappedExposureBits:v.native.cases.map(c=>c.expectedExposureBits),browserMappedExposureBits:result.rows[i].bits})),
    exactMetadataMatches:variants.length,exactMappedExposureF32Matches:result.rows.reduce((n,r)=>n+r.bits.length,0),rejectedInvalidCases:result.rejections,
    wasmSha256:hash(assets.get('/cw_rapidraw_wasm_probe_bg.wasm')[1]),browserVersion:browser.version(),chromiumSandbox:process.env.CHROMIUM_SANDBOX!=='false',pageErrors:errors,failedRequests:failed,
    scope:'Original full baseline_exposure reader/helpers, exposure portion of original dummy read_as_shot, actual WASM module worker, original UI baseline/visibility mapping. Public Canon DNG and explicit derived signed rational tags. Native reference executes full source read_as_shot with WB result stubbed/ignored. No automatic as-shot WB conversion, other controls, rendered metadata-frame parity, React UI, file providers or full editor acceptance. Sensor estimate is not a total-memory guarantee.'};
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
} finally {await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await rm(temp,{recursive:true,force:true});}
