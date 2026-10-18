// Real full-shader execution on a bounded synthetic input. This is not native
// frame parity, real preprocessing, an editor, or a hardware performance test.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';

const [artifact, output] = process.argv.slice(2);
if (!artifact || !output) throw Error('Usage: smoke-rapidraw-webgpu.mjs WASM_DIR OUTPUT_JSON');
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
  const context = await browser.newContext(); const page = await context.newPage();
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('requestfailed', r => failedRequests.push(new URL(r.url()).pathname));
  page.setDefaultTimeout(60000);
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await Promise.race([
    page.evaluate(async () => {
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
        const shaderSource = await (await fetch('/shader.wgsl')).text();
        const width = 9, height = 3;
        const inputRgba = new Float32Array(width * height * 4);
        for (let i = 0; i < width * height; i++) inputRgba.set([0.01 + i / 100, 0.02 + i / 120, 0.03 + i / 150, 1], i * 4);
        fixture = host.createNeutralRendererResources(device, { width, height, inputRgba });
        const frames = [];
        for (const exposure of [-1, 0, 1]) {
          const adjustments = host.packNeutralExposureAdjustments(wasm, exposure);
          const frame = await host.renderOriginalFrame({ device, width, height, shaderSource,
            inputTexture: fixture.inputTexture, adjustments, resources: fixture.resources });
          const words = new Uint16Array(frame.pixels.buffer);
          // A finite RGBA16F readback with alpha=1 rules out zeroed/unmapped output.
          if (words.some(v => (v & 0x7c00) === 0x7c00)) throw Error('Nonfinite shader output');
          for (let i = 3; i < words.length; i += 4) if (words[i] !== 0x3c00) throw Error('Unexpected output alpha');
          if (!words.some((v, i) => i % 4 !== 3 && v !== 0)) throw Error('Zero RGB shader output');
          const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', frame.pixels));
          frames.push({ exposure, bytes: frame.pixels.byteLength, sha256: [...digest].map(v => v.toString(16).padStart(2, '0')).join(''), firstPixelF16Bits: [...words.slice(0, 4)] });
        }
        await device.queue.onSubmittedWorkDone();
        return { width, height, format: 'rgba16float', adapterInfo, frames, gpuErrors };
      } finally { fixture?.ownedTextures.forEach(t => t.destroy()); device.destroy(); }
    }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('WebGPU proof timed out')), 60000); timer.unref(); }),
  ]);
  assert.deepEqual(result.gpuErrors, []); assert.deepEqual(pageErrors, []); assert.deepEqual(failedRequests, []);
  assert.equal(result.adapterInfo.architecture, 'swiftshader', 'Expected an explicitly identified software adapter');
  assert.equal(result.adapterInfo.isFallbackAdapter, true);
  assert.equal(new Set(result.frames.map(f => f.sha256)).size, 3);
  assert.ok(result.frames[0].firstPixelF16Bits[0] < result.frames[1].firstPixelF16Bits[0]);
  assert.ok(result.frames[1].firstPixelF16Bits[0] < result.frames[2].firstPixelF16Bits[0]);
  const report = { stage: 'RWASM-03 original full WGSL execution on neutral resources', nativeSource: 'b39884b38d8f148caef6fd0d52afd264951be329',
    shaderSha256: createHash('sha256').update(assets.get('/shader.wgsl')[1]).digest('hex'),
    wasmSha256: createHash('sha256').update(wasmBytes).digest('hex'), browserVersion: browser.version(), launchArgs,
    chromiumSandbox: process.env.CHROMIUM_SANDBOX !== 'false', ...result, pageErrors, failedRequests,
    scope: 'Actual browser WebGPU compute, full pinned shader (native RGBA16F substitution), 14 bindings and WASM neutral/exposure fixture; software adapter, synthetic 9x3 input. No native rendered-frame comparison, real preprocessing, RAW-to-render flow, full effects/UI/editor acceptance or hardware performance claim.' };
  await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report)); await context.close();
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
