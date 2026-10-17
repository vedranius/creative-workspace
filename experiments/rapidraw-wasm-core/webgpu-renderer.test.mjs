import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { packNeutralExposureAdjustments, renderOriginalFrame, WebGpuUnsupportedError } from "./webgpu-renderer.js";

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
  const bindGroup = calls.find(([name]) => name === "bindGroup")[1];
  assert.deepEqual(bindGroup.entries.map(({ binding }) => binding), Array.from({ length: 14 }, (_, i) => i));
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
