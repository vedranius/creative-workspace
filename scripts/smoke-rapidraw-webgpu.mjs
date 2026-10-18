// Real full-shader execution on a bounded synthetic input. Optional independent
// native reference comparison; not real preprocessing/editor/performance proof.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';

const [artifact, output, nativeReferencePath, publicRawPath, nativePngDirectory] = process.argv.slice(2);
if (!artifact || !output) throw Error('Usage: smoke-rapidraw-webgpu.mjs WASM_DIR OUTPUT_JSON [NATIVE_REFERENCE_JSON [PUBLIC_RAW_FILE]]');
const nativeReference = nativeReferencePath ? JSON.parse(await readFile(nativeReferencePath, 'utf8')) : null;
const pngMode = !!nativePngDirectory;
if (pngMode) { assert.ok(publicRawPath); assert.equal(nativeReference?.format, 'rgba8unorm'); }
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const core = new URL('../experiments/rapidraw-wasm-core/', import.meta.url);
const wasmBytes = await readFile(path.join(artifact, 'cw_rapidraw_wasm_probe_bg.wasm'));
const launchArgs = ['--disable-dev-shm-usage', '--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader'];
const assets = new Map([
  ['/', ['text/html', Buffer.from('<!doctype html><title>RapidRAW isolated full shader proof</title>')]],
  ['/webgpu-renderer.js', ['text/javascript', await readFile(new URL('webgpu-renderer.js', core))]],
  ['/shader.wgsl', ['text/plain', await readFile(new URL('shader.wgsl', core))]],
  ['/cw_rapidraw_wasm_probe.js', ['text/javascript', await readFile(path.join(artifact, 'cw_rapidraw_wasm_probe.js'))]],
  ['/cw_rapidraw_wasm_probe_bg.wasm', ['application/wasm', wasmBytes]],
]);
let publicFixture = null;
if (publicRawPath) {
  assert.ok(nativeReference, 'RAW frame comparison requires an independent native reference');
  const evidence = JSON.parse(await readFile(new URL('../docs/evidence/rapidraw-wasm/runtime-smoke.json', import.meta.url), 'utf8'));
  publicFixture = evidence.fixtures.find(f => f.id === 'raw.pixls.us 1327');
  assert.equal(publicFixture.license, 'CC0-1.0');
  const raw = await readFile(publicRawPath);
  assert.equal(createHash('sha256').update(raw).digest('hex'), publicFixture.sourceSha256, 'Only the hash-pinned public CC0 fixture is admitted');
  assets.set('/public-fixture.dng', ['application/octet-stream', raw]);
  assets.set('/worker.js', ['text/javascript', await readFile(new URL('worker.js', core))]);
}
const server = createServer((req, res) => {
  const asset = req.method === 'GET' && assets.get(new URL(req.url, 'http://localhost').pathname);
  if (!asset) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': asset[0], 'Cache-Control': 'no-store' });
  res.end(asset[1]);
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
let browser;
const pageErrors = [], failedRequests = [];
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
    chromiumSandbox: process.env.CHROMIUM_SANDBOX !== 'false', args: launchArgs });
  const context = await browser.newContext({ acceptDownloads: pngMode }); const page = await context.newPage();
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('requestfailed', r => failedRequests.push(new URL(r.url()).pathname));
  page.setDefaultTimeout(60000);
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await Promise.race([
    page.evaluate(async ({ raw, pngMode, camera }) => {
      if (!navigator.gpu) throw Error('No WebGPU API');
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw Error('No WebGPU adapter');
      const adapterInfo = { vendor: adapter.info.vendor, architecture: adapter.info.architecture,
        device: adapter.info.device, description: adapter.info.description,
        isFallbackAdapter: adapter.info.isFallbackAdapter ?? adapter.isFallbackAdapter };
      const device = await adapter.requestDevice();
      const gpuErrors = []; device.addEventListener('uncapturederror', e => gpuErrors.push(e.error.message));
      let fixture;
      try {
        const wasm = await import('/cw_rapidraw_wasm_probe.js'); await wasm.default();
        const host = await import('/webgpu-renderer.js');
        let rejectedInvalidPngInputs = 0;
        if (pngMode) for (const [w,h,p] of [[0,1,[]],[1,0,[]],[32769,1,[]],[32768,32768,[]],[1,1,[]],[1,1,[0,1,2]]]) {
          try { wasm.encode_rendered_rgba8_png(w,h,new Uint8Array(p),300); } catch { rejectedInvalidPngInputs++; }
        }
        const shaderSource = await (await fetch('/shader.wgsl')).text();
        const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
        let width = 9, height = 3, inputF32Sha256, inputRgbaF16Sha256 = null, actualAsShot = null;
        if (raw) {
          const bytes = await (await fetch('/public-fixture.dng')).arrayBuffer();
          if (camera) {
            actualAsShot = await new Promise((resolve,reject)=>{
              const worker=new Worker('/worker.js',{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(Error('As-shot worker timed out'));},30000);
              worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.ok?resolve(data.asShot):reject(Error(data.error));};
              worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};
              const copy=bytes.slice(0);worker.postMessage({id:2,bytes:copy,output:'as-shot'},[copy]);
            });
          }
          const image = await new Promise((resolve, reject) => {
            const worker = new Worker('/worker.js', { type: 'module' });
            const timer = setTimeout(() => { worker.terminate(); reject(Error('RAW worker timed out')); }, 30000);
            worker.onmessage = ({ data }) => { if (data.status === 'developing') return; clearTimeout(timer); worker.terminate(); data.ok ? resolve(data) : reject(Error(data.error)); };
            worker.onerror = e => { clearTimeout(timer); worker.terminate(); reject(Error(e.message)); };
            worker.postMessage({ id: 1, bytes, fastDemosaic: true, output: 'pixels' }, [bytes]);
          });
          if (image.components !== 3) throw Error('Expected native developed RGB');
          width = image.width; height = image.height;
          inputF32Sha256 = await hash(image.data);
          const inputRgbaF16 = host.packRgb32fRendererInput(wasm, width, height, image.data);
          inputRgbaF16Sha256 = await hash(inputRgbaF16);
          fixture = host.createNeutralRendererResources(device, { width, height, inputRgbaF16 });
        } else {
          const inputRgba = new Float32Array(width * height * 4);
          for (let i = 0; i < width * height; i++) inputRgba.set([(i + 1) / 128, (i + 2) / 128, (i + 3) / 128, 1], i * 4);
          inputF32Sha256 = await hash(inputRgba);
          fixture = host.createNeutralRendererResources(device, { width, height, inputRgba });
        }
        const frames = [];
        const cases = camera ? camera.frames : [-1,0,1].map(exposure=>({exposure}));
        for (const testCase of cases) {
          const exposure = testCase.exposure;
          const adjustments = camera ? host.packCameraRendererFixture(wasm,testCase.json,actualAsShot,camera.options) : raw ? host.packUiExposureFixture(wasm, JSON.stringify({ exposure: exposure * 0.8 }),
            { sceneReferred: true, dngBaseline: 0, highlightPreservation: 0 },
            { baselineExposure: 0, compensateHighlightPreservation: false }) : host.packNeutralExposureAdjustments(wasm, exposure);
          const frame = await host.renderOriginalFrame({ device, width, height, shaderSource,
            inputTexture: fixture.inputTexture, adjustments, resources: fixture.resources, outputPrecision: pngMode ? 'eight' : 'sixteen' });
          const words = pngMode ? frame.pixels : new Uint16Array(frame.pixels.buffer);
          // A finite RGBA16F readback with alpha=1 rules out zeroed/unmapped output.
          if (!pngMode && words.some(v => (v & 0x7c00) === 0x7c00)) throw Error('Nonfinite shader output');
          for (let i = 3; i < words.length; i += 4) if (words[i] !== (pngMode ? 255 : 0x3c00)) throw Error('Unexpected output alpha');
          if (!words.some((v, i) => i % 4 !== 3 && v !== 0)) throw Error('Zero RGB shader output');
          const row = { exposure, bytes: frame.pixels.byteLength, sha256: await hash(frame.pixels),
            adjustmentSha256: await hash(adjustments.bytes), [pngMode ? 'rgbaU8' : 'rgbaF16Bits']: [...words], firstPixel: [...words.slice(0, 4)] };
          if (!pngMode) row.firstPixelF16Bits = row.firstPixel;
          if (pngMode) {
            const png = host.encodeRenderedFramePng(wasm, frame, 300);
            const blob = new Blob([png], { type: 'image/png' });
            const bitmap = await createImageBitmap(blob);
            if (bitmap.width !== width || bitmap.height !== height) throw Error('Decoded PNG dimensions differ');
            bitmap.close();
            const link = document.createElement('a'); link.id = `download-${frames.length}`; link.href = URL.createObjectURL(blob);
            link.download = `rapidraw-render-${frames.length}.png`; link.textContent = link.download; document.body.append(link);
            row.png = { bytes: png.length, sha256: await hash(png), decoded: true, bitDepth: png[24], colorType: png[25], dpi: 300 };
          }
          frames.push(row);
        }
        await device.queue.onSubmittedWorkDone();
        return { width, height, format: pngMode ? 'rgba8unorm' : 'rgba16float', inputFormat: raw ? 'RGB32F' : 'RGBA32F', inputF32Sha256, inputRgbaF16Sha256, actualAsShot, adapterInfo, frames, gpuErrors, ...(pngMode ? { rejectedInvalidPngInputs } : {}) };
      } finally { fixture?.ownedTextures.forEach(t => t.destroy()); device.destroy(); }
    }, { raw: !!publicRawPath, pngMode, camera: nativeReference?.camera ?? null }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('WebGPU proof timed out')), 60000); timer.unref(); }),
  ]);
  assert.deepEqual(result.gpuErrors, []); assert.deepEqual(pageErrors, []); assert.deepEqual(failedRequests, []);
  assert.equal(result.adapterInfo.architecture, 'swiftshader', 'Expected an explicitly identified software adapter');
  assert.equal(result.adapterInfo.isFallbackAdapter, true);
  if (pngMode) assert.equal(result.rejectedInvalidPngInputs, 6);
  assert.equal(new Set(result.frames.map(f => f.sha256)).size, nativeReference?.camera ? 5 : 3);
  if (nativeReference?.camera) assert.deepEqual(result.actualAsShot,nativeReference.camera.asShot);
  if (!publicRawPath) {
    assert.ok(result.frames[0].firstPixelF16Bits[0] < result.frames[1].firstPixelF16Bits[0]);
    assert.ok(result.frames[1].firstPixelF16Bits[0] < result.frames[2].firstPixelF16Bits[0]);
  }
  let nativeComparison = null;
  if (nativeReference) {
    assert.equal(nativeReference.source, 'b39884b38d8f148caef6fd0d52afd264951be329');
    assert.equal(nativeReference.highPrecisionOutput, pngMode ? 0 : 1);
    assert.equal(nativeReference.shaderSha256, createHash('sha256').update(assets.get('/shader.wgsl')[1]).digest('hex'));
    assert.equal(nativeReference.inputF32Sha256, result.inputF32Sha256);
    assert.equal(nativeReference.inputFormat ?? 'RGBA32F', result.inputFormat);
    if (publicRawPath) assert.equal(nativeReference.inputRgbaF16Sha256, result.inputRgbaF16Sha256);
    assert.equal(nativeReference.width, result.width); assert.equal(nativeReference.height, result.height);
    assert.equal(nativeReference.frames.length, result.frames.length);
    const ordered = v => v & 0x8000 ? 0x8000 - (v & 0x7fff) : 0x8000 + v;
    let exactComponents = 0, comparedComponents = 0, maxDifference = 0;
    const componentKey = pngMode ? 'rgbaU8' : 'rgbaF16Bits';
    for (const [i, frame] of result.frames.entries()) {
      const expected = nativeReference.frames[i];
      assert.equal(frame.exposure, expected.exposure); assert.equal(frame.bytes, expected.bytes);
      assert.equal(frame.adjustmentSha256, expected.adjustmentSha256, 'All original adjustment bytes must match native');
      assert.equal(frame[componentKey].length, expected[componentKey].length);
      for (const [j, word] of frame[componentKey].entries()) {
        const native = expected[componentKey][j];
        if (!pngMode) assert.equal((native & 0x7c00) === 0x7c00, false, 'Native frame must be finite');
        const difference = pngMode ? Math.abs(word - native) : Math.abs(ordered(word) - ordered(native));
        // One half-float representable step, declared before native execution;
        // alpha must be exact. This is not a tolerance for arbitrary effects.
        assert.ok(difference <= (pngMode || j % 4 === 3 ? 0 : 1), `Frame${i} component${j}: ${difference} ${pngMode ? 'byte' : 'f16 ULP'}`);
        if (word === native) exactComponents++;
        comparedComponents++; maxDifference = Math.max(maxDifference, difference);
      }
      if (pngMode) {
        assert.equal(expected.png.filename, `frame-${i}.png`);
        const nativePng = await readFile(path.join(nativePngDirectory, expected.png.filename));
        assert.equal(nativePng[24], 8); assert.equal(nativePng[25], 6);
        assert.equal(frame.png.sha256, createHash('sha256').update(nativePng).digest('hex'));
        assert.equal(frame.png.bytes, nativePng.length);
        const pending = page.waitForEvent('download'); await page.locator(`#download-${i}`).click(); const download = await pending;
        assert.equal(await download.failure(), null); const stream = await download.createReadStream(), digest = createHash('sha256'); let bytes = 0;
        for await (const chunk of stream) { digest.update(chunk); bytes += chunk.length; }
        assert.equal(digest.digest('hex'), frame.png.sha256); assert.equal(bytes, frame.png.bytes);
        frame.png.downloadCompleted = true; frame.png.downloadedBytes = bytes; frame.png.exactNativeEncodedBytes = true;
      }
    }
    nativeComparison = { referenceSha256: createHash('sha256').update(await readFile(nativeReferencePath)).digest('hex'),
      adapter: nativeReference.adapter, comparedComponents, exactComponents,
      ...(pngMode ? { maxByteDifference: maxDifference, allowedByteDifference: 0 } : { maxF16UlpDifference: maxDifference, allowedF16UlpDifference: 1 }),
      alphaExact: true, inputAndAllAdjustmentBytesMatch: true,
      scope: publicRawPath ? 'Independent native original RAW development plus wgpu29 shader on identical real public RAW-derived input; remaining preprocessing is neutral, not full Tauri/engine parity' : 'Independent native wgpu29 full pinned shader on identical neutral synthetic inputs, not full Tauri/preprocessing/engine frames' };
  }
  if (publicRawPath) for (const frame of result.frames) { delete frame.rgbaF16Bits; delete frame.rgbaU8; }
  const report = { stage: nativeReference?.camera ? 'RWASM-03 actual public RAW/as-shot WB/exposure through original shader and PNG' : pngMode ? 'RWASM-03 actual public RAW through original EightBit shader/dither and native PNG branch' : publicRawPath ? 'RWASM-03 public RAW Speed development to native f16 upload and original full shader' : 'RWASM-03 original full WGSL execution on neutral resources', nativeSource: 'b39884b38d8f148caef6fd0d52afd264951be329',
    publicFixture: publicFixture ? { id: publicFixture.id, sourceSha256: publicFixture.sourceSha256, license: publicFixture.license } : null,
    exposureInputs: nativeReference?.camera ? { camera: nativeReference.camera, metadata: 'Actual original as-shot WASM worker', otherControls: 'neutral' } : publicRawPath ? { uiExposure: [-0.8, 0, 0.8], mappedStops: [-1, 0, 1], baselineMarker: 'absent/disabled', cameraExposure: 'Explicit sceneReferred=true,dngBaseline=0,highlightPreservation=0 fixture inputs; metadata not extracted', otherControls: 'neutral' } : null,
    shaderSha256: createHash('sha256').update(assets.get('/shader.wgsl')[1]).digest('hex'),
    wasmSha256: createHash('sha256').update(wasmBytes).digest('hex'), browserVersion: browser.version(), launchArgs,
    chromiumSandbox: process.env.CHROMIUM_SANDBOX !== 'false', highPrecisionOutput: pngMode ? 0 : 1, ...result, nativeComparison, pageErrors, failedRequests,
    scope: nativeReference?.camera ? 'Actual public CC0 RAW Speed worker and separate original as-shot worker feed original WB visibility/adaptation/matrix/exposure projection, full EightBit shader/dither and original PNG branch; native adjustment bytes, image bytes and completed downloads compared. Other controls/preprocessing neutral, original React/providers/full editor remain open.' : pngMode ? 'Actual public CC0 RAW Speed worker→original f16 upload/exposure→original EightBit WGSL/dither→native RGBA8 PNG codec, sRGB ICC/300DPI, browser decode/completed download. Other preprocessing/effects neutral, camera inputs explicit, no metadata/XMP/watermarks/transforms/full UI/provider/editor acceptance.' : publicRawPath ? 'Actual public CC0 DNG Speed development in the existing WASM worker, original RGB32F-to-RGBA16F upload, explicit exposure UI mapping (baseline0/disabled), original full shader; remaining preprocessing/effects are neutral fixtures, not full native engine/UI/export/provider/editor acceptance.' : 'Actual browser WebGPU full pinned shader (native RGBA16F substitution), 14 bindings and WASM neutral/exposure fixture; software adapter, synthetic9x3 input. Optional independent native shader-fixture comparison only; no real preprocessing/full native engine/UI/editor acceptance or performance claim.' };
  await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  if (pngMode) await page.evaluate(() => document.querySelectorAll('a').forEach(a => URL.revokeObjectURL(a.href)));
  console.log(JSON.stringify(report)); await context.close();
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
