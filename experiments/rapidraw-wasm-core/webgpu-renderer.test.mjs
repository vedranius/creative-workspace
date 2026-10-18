import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createNeutralRendererResources, packNeutralExposureAdjustments, packUiExposureFixture, renderOriginalFrame, WebGpuUnsupportedError } from "./webgpu-renderer.js";

globalThis.GPUShaderStage = { COMPUTE: 4 };
globalThis.GPUBufferUsage = { STORAGE: 128, COPY_DST: 8, MAP_READ: 1 };
globalThis.GPUTextureUsage = { STORAGE_BINDING: 8, COPY_SRC: 1 };
globalThis.GPUMapMode = { READ: 1 };

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
