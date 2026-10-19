import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createNeutralRendererResources, encodePreviewResponse, encodeRenderedFramePng, packNeutralExposureAdjustments, packRgb32fRendererInput, packUiExposureFixture, packCameraRendererFixture, packGlobalRendererFixture, renderOriginalFrame, WebGpuUnsupportedError } from "./webgpu-renderer.js";

globalThis.GPUShaderStage = { COMPUTE: 4 };
globalThis.GPUBufferUsage = { STORAGE: 128, COPY_DST: 8, MAP_READ: 1 };
globalThis.GPUTextureUsage = { STORAGE_BINDING: 8, COPY_SRC: 1 };
globalThis.GPUMapMode = { READ: 1 };

test("native f16 upload preserves WASM words and uses correct texture formats and row stride", () => {
  const { device, calls } = makeDevice();
  const rgb = new Float32Array([0.1, 0.2, 0.3]);
  const words = new Uint16Array([0x2e66, 0x3266, 0x34cd, 0x3c00]);
  let forwarded;
  assert.equal(packRgb32fRendererInput({pack_rgb32f_renderer_input: (...args) => (forwarded = args, words)}, 1, 1, rgb), words);
  assert.deepEqual(forwarded, [1, 1, rgb]);
  createNeutralRendererResources(device, {width:1,height:1,inputRgbaF16:words});
  assert.deepEqual(calls.filter(([name])=>name==='texture').slice(0,7).map(([,d])=>d.format), [...Array(5).fill('rgba16float'),'rgba32float','rgba32float']);
  const uploads=calls.filter(([name])=>name==='writeTexture');
  assert.equal(uploads[0][2],words); assert.equal(uploads[0][3].bytesPerRow,8);
  assert.equal(uploads[5][3].bytesPerRow,16);
});

test("native upload rejects corrupt half words, shape and combined resource budget before creating textures", () => {
  const { device, calls } = makeDevice();
  assert.throws(()=>createNeutralRendererResources(device,{width:1,height:1,inputRgbaF16:new Uint16Array([0,0,0x7c00,0])}),/finite f16/);
  assert.throws(()=>createNeutralRendererResources(device,{width:1024,height:1024,inputRgbaF16:new Uint16Array(0)}),/bounded texture/);
  assert.throws(()=>packRgb32fRendererInput({pack_rgb32f_renderer_input:()=>{throw Error('must not call');}},1,1,new Float32Array(2)),/exact RGB32F/);
  assert.equal(calls.length,0);
});

const shaderSource = await readFile(new URL("./shader.wgsl", import.meta.url), "utf8");

const textureView = {};
const resourceViews = {
  maskTextures: textureView,
  lutTexture: textureView,
  lutSampler: {},
  sharpnessBlurTexture: textureView,
  tonalBlurTexture: textureView,
  clarityBlurTexture: textureView,
  structureBlurTexture: textureView,
  flareTexture: textureView,
  flareSampler: {},
  guidedFilterCoefficientsTexture: textureView,
  guidedFilterDehazeTexture: textureView,
};

function makeDevice() {
  const calls = [];
  const readbackBytes = new ArrayBuffer(512 * 2);
  const device = {
    limits: { maxTextureDimension2D: 4096, maxStorageBufferBindingSize: 1 << 20, maxBufferSize: 64 << 20 },
    queue: {
      writeBuffer: (...args) => calls.push(["writeBuffer", ...args]),
      writeTexture: (...args) => calls.push(["writeTexture", ...args]),
      submit: (...args) => calls.push(["submit", ...args]),
      onSubmittedWorkDone: async () => calls.push(["submitted"]),
    },
    pushErrorScope: (scope) => calls.push(["pushErrorScope", scope]),
    popErrorScope: async () => null,
    createShaderModule: (value) => (calls.push(["shader", value]), {}),
    createBindGroupLayout: (value) => (calls.push(["layout", value]), {}),
    createPipelineLayout: (value) => (calls.push(["pipelineLayout", value]), {}),
    createComputePipeline: (value) => (calls.push(["pipeline", value]), {}),
    createBuffer: (value) => {
      calls.push(["buffer", value]);
      return {
        mapAsync: async (mode) => calls.push(["mapAsync", mode]),
        getMappedRange: () => readbackBytes,
        unmap: () => calls.push(["unmap"]),
        destroy: () => calls.push(["destroyBuffer"]),
      };
    },
    createTexture: (value) => {
      calls.push(["texture", value]);
      return { createView: () => ({}), destroy: () => calls.push(["destroyTexture"]) };
    },
    createSampler: (value) => (calls.push(["sampler", value]), {}),
    createBindGroup: (value) => (calls.push(["bindGroup", value]), {}),
    createCommandEncoder: () => ({
      beginComputePass: () => ({
        setPipeline: () => calls.push(["setPipeline"]),
        setBindGroup: (index, group) => calls.push(["setBindGroup", index, group]),
        dispatchWorkgroups: (...args) => calls.push(["dispatch", ...args]),
        end: () => calls.push(["endPass"]),
      }),
      copyTextureToBuffer: (...args) => calls.push(["copyTextureToBuffer", ...args]),
      finish: () => ({}),
    }),
  };
  return { device, calls };
}

test("creates bounded source-shaped neutral texture descriptors and exact payload values", () => {
  const { device, calls } = makeDevice();
  const inputRgba = new Float32Array([0.125, 0.25, 0.5, 1, 0.75, 0.5, 0.25, 1]);
  const made = createNeutralRendererResources(device, { width: 2, height: 1, inputRgba });
  const textures = calls.filter(([name]) => name === "texture").map(([, descriptor]) => descriptor);
  assert.deepEqual(textures.map(({ label, size, format, dimension }) => ({ label, size, format, dimension })), [
    { label: "RapidRAW neutral fixture input", size: { width: 2, height: 1, depthOrArrayLayers: 1 }, format: "rgba32float", dimension: "2d" },
    ...["sharpness blur input", "tonal blur input", "clarity blur input", "structure blur input", "guided-filter coefficients", "guided-filter dehaze"].map((label) => ({ label: `RapidRAW neutral ${label}`, size: { width: 2, height: 1, depthOrArrayLayers: 1 }, format: "rgba32float", dimension: "2d" })),
    { label: "RapidRAW empty neutral mask atlas", size: { width: 2, height: 1, depthOrArrayLayers: 1 }, format: "r32float", dimension: "2d" },
    { label: "RapidRAW 2x2x2 identity LUT", size: { width: 2, height: 2, depthOrArrayLayers: 2 }, format: "rgba32float", dimension: "3d" },
    { label: "RapidRAW neutral black flare", size: { width: 1, height: 1, depthOrArrayLayers: 1 }, format: "rgba8unorm", dimension: "2d" },
  ]);
  const uploads = calls.filter(([name]) => name === "writeTexture");
  assert.equal(uploads.length, 10);
  assert.equal(uploads[0][2], inputRgba);
  assert.deepEqual([...uploads[5][2]], [1, 0, 1, 0, 1, 0, 1, 0]);
  assert.deepEqual([...uploads[6][2]], [1, 0, 1, 0, 1, 0, 1, 0]);
  assert.deepEqual([...uploads[7][2]], [0, 0]);
  assert.deepEqual([...uploads[8][2]], [0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual([...uploads[9][2]], [0, 0, 0, 255]);
  assert.equal(made.ownedTextures.length, 10);
  assert.throws(() => createNeutralRendererResources(device, { width: 1, height: 1, inputRgba: new Float32Array([NaN, 0, 0, 1]) }), /finite/);
});

function frameInput() {
  return {
    width: 3,
    height: 2,
    inputTexture: { createView: () => ({}) },
    adjustments: { bytes: new Uint8Array(45232) },
    resources: resourceViews,
    shaderSource,
  };
}

test("packs source-layout neutral adjustments through the pinned WASM constructor", () => {
  const expected = new Uint8Array(45232);
  const wasm = { pack_neutral_renderer_adjustments: (exposure) => {
    assert.equal(exposure, 1.25);
    return expected;
  } };
  assert.equal(packNeutralExposureAdjustments(wasm, 1.25).bytes, expected);
  assert.throws(() => packNeutralExposureAdjustments(wasm, Infinity), /finite/);
  assert.throws(() => packNeutralExposureAdjustments({ pack_neutral_renderer_adjustments: () => new Uint8Array(16) }), /invalid pinned/);
});

test("forwards WASM-packed adjustments into the original GPU storage binding", async () => {
  const { device, calls } = makeDevice();
  const expected = new Uint8Array(45232);
  await renderOriginalFrame({
    ...frameInput(),
    adjustments: undefined,
    wasm: { pack_neutral_renderer_adjustments: () => expected },
    exposure: 0.75,
    device,
  });
  assert.ok(calls.some(([name, _buffer, _offset, data]) => name === "writeBuffer" && data === expected));
});

test("original shader remains byte-identical to pinned source", async () => {
  assert.equal(
    createHash("sha256").update(shaderSource).digest("hex"),
    "9ecb4cc31b8ce4a12f439f69935ed0c8c27f58b52501929e0dc41d22e85ca178",
  );
  assert.match(shaderSource, /@group\(0\) @binding\(13\)/);
  assert.match(shaderSource, /fn main\(/);
});

test("dispatches original 14 bindings and returns tightly packed async readback", async () => {
  const { device, calls } = makeDevice();
  const result = await renderOriginalFrame({ ...frameInput(), device });
  assert.equal(result.format, "rgba16float");
  assert.equal(result.pixels.byteLength, 3 * 2 * 8);
  assert.deepEqual(calls.find(([name]) => name === "dispatch"), ["dispatch", 1, 1, 1]);
  assert.deepEqual(calls.find(([name]) => name === "pipeline")[1].compute.constants, { HIGH_PRECISION_OUTPUT: 1 });
  const bindGroup = calls.find(([name]) => name === "bindGroup")[1];
  assert.deepEqual(bindGroup.entries.map(({ binding }) => binding), Array.from({ length: 14 }, (_, i) => i));
  const layout = calls.find(([name]) => name === "layout")[1];
  assert.equal(layout.entries.find(({ binding }) => binding === 5).sampler.type, "non-filtering");
  assert.equal(layout.entries.find(({ binding }) => binding === 11).sampler.type, "filtering");
  assert.ok(calls.some(([name]) => name === "mapAsync"));
  assert.ok(calls.some(([name]) => name === "submitted"));
  assert.ok(calls.some(([name, _buffer, _offset, data]) => name === "writeBuffer" && data.byteLength === 45232));
});

test("reports an explicit unsupported result when browser WebGPU is absent", async () => {
  await assert.rejects(
    renderOriginalFrame({ ...frameInput(), gpu: undefined }),
    (error) => error instanceof WebGpuUnsupportedError && error.code === "WEBGPU_UNSUPPORTED",
  );
});

test("rejects frames beyond the selected adapter texture limit", async () => {
  const { device } = makeDevice();
  await assert.rejects(
    renderOriginalFrame({ ...frameInput(), width: 8192, device }),
    /texture limit/,
  );
});

test("rejects readback allocations over the bounded device capacity", async () => {
  const { device } = makeDevice();
  device.limits.maxBufferSize = 511;
  await assert.rejects(
    renderOriginalFrame({ ...frameInput(), device }),
    /bounded readback capacity/,
  );
});


test("UI exposure host forwards original JSON/camera/settings to WASM without reimplementing mapping", () => {
  let received;
  const wasm = { pack_ui_exposure_fixture: (...args) => { received = args; return new Uint8Array(45232); } };
  const input = '{"exposure":0.8,"baselineExposure":true,"activeTools":{"basic":false}}';
  const result = packUiExposureFixture(wasm, input, {sceneReferred:true,dngBaseline:0.75,highlightPreservation:-1}, {baselineExposure:null,compensateHighlightPreservation:true});
  assert.deepEqual(received,[input,true,0.75,-1,undefined,true]);
  assert.equal(result.bytes.length,45232);
  assert.match(result.scope,/other adjustments remain neutral/);
});

test("UI exposure host rejects oversized JSON/missing metadata and corrupt payloads", () => {
  let called=false;const wasm={pack_ui_exposure_fixture:()=>{called=true;return new Uint8Array(1);}};
  const shot={sceneReferred:true,dngBaseline:0,highlightPreservation:0},options={baselineExposure:0,compensateHighlightPreservation:false};
  assert.throws(()=>packUiExposureFixture(wasm," ".repeat(65537),shot,options),/64 KiB/);
  assert.throws(()=>packUiExposureFixture(wasm,"{}",{},options),/Explicit finite/);
  assert.throws(()=>packUiExposureFixture(wasm,"{}",shot,{}),/Explicit finite/);
  assert.equal(called,false);
  assert.throws(()=>packUiExposureFixture(wasm,"{}",shot,options),/invalid pinned/);
});

test("original EightBit PNG render retains shader/dither and uses RGBA8 storage/readback", async () => {
  const { device, calls } = makeDevice();
  const result=await renderOriginalFrame({...frameInput(),device,outputPrecision:'eight'});
  assert.equal(result.format,'rgba8unorm');assert.equal(result.pixels.length,3*2*4);
  assert.equal(calls.find(([n])=>n==='shader')[1].code,shaderSource);
  assert.deepEqual(calls.find(([n])=>n==='pipeline')[1].compute.constants,{HIGH_PRECISION_OUTPUT:0});
  assert.equal(calls.find(([n])=>n==='layout')[1].entries[1].storageTexture.format,'rgba8unorm');
  await assert.rejects(renderOriginalFrame({...frameInput(),device,outputPrecision:'auto'}),/native eight or sixteen/);
});

test("rendered PNG forwards actual RGBA8 output and refuses SixteenBit reinterpretation", () => {
  let received;const bytes=new Uint8Array([137,80,78,71]);
  const wasm={encode_rendered_rgba8_png:(...args)=>(received=args,bytes)};
  const frame={width:1,height:1,format:'rgba8unorm',pixels:new Uint8Array([0,1,2,255])};
  assert.equal(encodeRenderedFramePng(wasm,frame,300),bytes);
  assert.deepEqual(received,[1,1,frame.pixels,300]);
  assert.throws(()=>encodeRenderedFramePng(wasm,{...frame,format:'rgba16float'},300),/RGBA8 rendered/);
  assert.throws(()=>encodeRenderedFramePng(wasm,{...frame,pixels:new Uint8Array(3)},300),/RGBA8 rendered/);
  assert.throws(()=>encodeRenderedFramePng(wasm,frame,65536),/valid DPI/);
});


test("camera host forwards actual as-shot metadata and original JSON to WASM",()=>{
  const shot={whiteBalance:{temperature:6133.3,tint:39.7},exposure:{sceneReferred:true,dngBaseline:-0.5,highlightPreservation:0}};
  const options={baselineExposure:0,compensateHighlightPreservation:true};
  let args;const payload=new Uint8Array(45232),wasm={pack_camera_renderer_fixture:(...a)=>(args=a,payload)};
  assert.equal(packCameraRendererFixture(wasm,'{"temperature":10}',shot,options).bytes,payload);
  assert.deepEqual(args,['{"temperature":10}',6133.3,39.7,true,-0.5,0,0,true]);
  assert.throws(()=>packCameraRendererFixture(wasm,'{}',{...shot,whiteBalance:{temperature:0,tint:0}},options));
  assert.throws(()=>packCameraRendererFixture(wasm,'{}',{...shot,exposure:{...shot.exposure,dngBaseline:NaN}},options));
  assert.throws(()=>packCameraRendererFixture({pack_camera_renderer_fixture:()=>new Uint8Array(4)},'{}',shot,options));
});


test("full global host forwards pinned parser options and refuses unknown tone override",()=>{
  const shot={whiteBalance:{temperature:6133.3,tint:39.7},exposure:{sceneReferred:true,dngBaseline:-0.5,highlightPreservation:0}};
  const options={baselineExposure:0,compensateHighlightPreservation:true};let args;
  const payload=new Uint8Array(45232),wasm={pack_global_renderer_fixture:(...a)=>(args=a,payload)};
  assert.equal(packGlobalRendererFixture(wasm,'{"contrast":15}',shot,options,1).bytes,payload);
  assert.deepEqual(args,['{"contrast":15}',6133.3,39.7,true,-0.5,0,0,true,1]);
  assert.throws(()=>packGlobalRendererFixture(wasm,'{}',shot,options,2));
  assert.throws(()=>packGlobalRendererFixture({pack_global_renderer_fixture:()=>new Uint8Array(4)},'{}',shot,options));
});

test('native JPEG preview preserves ArrayBuffer and rejects malformed envelope or precision', () => {
  const frame={width:1,height:1,format:'rgba8unorm',pixels:new Uint8Array([0,1,2,255])};
  const jpeg=new Uint8Array([255,216,255,217]);
  const backed=new Uint8Array(12);backed.set(jpeg,3);
  const wasm={encode_preview_response:()=>backed.subarray(3,7)};
  assert.deepEqual(new Uint8Array(encodePreviewResponse(wasm,frame)),jpeg);
  for(const options of [{quality:75},{interactive:true,quality:94},{interactive:true,x:1},{fullWidth:32768,fullHeight:32768}]) {
    assert.throws(()=>encodePreviewResponse(wasm,frame,options));
  }
  assert.throws(()=>encodePreviewResponse(wasm,{...frame,format:'rgba16float'}));
  assert.throws(()=>encodePreviewResponse({encode_preview_response:()=>new Uint8Array(30)},frame));
  const envelope=new Uint8Array(28);const view=new DataView(envelope.buffer);
  [2,3,1,1,4,5].forEach((v,i)=>view.setUint32(i*4,v,true));envelope.set(jpeg,24);
  const interactive={encode_preview_response:()=>envelope};
  const options={interactive:true,x:2,y:3,fullWidth:4,fullHeight:5};
  assert.deepEqual(new Uint8Array(encodePreviewResponse(interactive,frame,options)),envelope);
  view.setUint32(0,3,true);assert.throws(()=>encodePreviewResponse(interactive,frame,options),/rectangle mismatch/);
});

test('full export has fixed separate GPU budget while preview cap stays unchanged', async()=>{
 const {fullExportPlan,createFullExportResources}=await import('./webgpu-renderer.js');
 assert.equal(fullExportPlan(2048,1536).estimatedGpuBytes,264286516);
 for(const [w,h]of [[0,1],[4096,4096],[2048,1537],[Infinity,1]])assert.throws(()=>fullExportPlan(w,h),/dedicated/);
 const {device,calls}=makeDevice();
 assert.throws(()=>createNeutralRendererResources(device,{width:2048,height:1536,inputRgbaF16:new Uint16Array(0),textureBudget:256*1024*1024}),/bounded texture/);
 assert.throws(()=>createFullExportResources(device,{width:4096,height:4096,inputRgbaF16:new Uint16Array(0)}),/dedicated/);
 assert.equal(calls.length,0);
});
