/**
 * Browser host boundary for the pinned RapidRAW compute renderer.
 * Upstream shader and AllAdjustments packing are retained verbatim; this
 * module owns only WebGPU resource binding, dispatch, and asynchronous readback.
 */

export const RAPIDRAW_SHADER_SHA256 = "9ecb4cc31b8ce4a12f439f69935ed0c8c27f58b52501929e0dc41d22e85ca178";
export const RAPIDRAW_SHADER_URL = new URL("./shader.wgsl", import.meta.url);
const MAX_FRAME_BUFFER_BYTES = 64 * 1024 * 1024;
export const RAPIDRAW_ALL_ADJUSTMENTS_BYTES = 45232;

const REQUIRED_VIEWS = [
  "maskTextures", "lutTexture", "sharpnessBlurTexture", "tonalBlurTexture",
  "clarityBlurTexture", "structureBlurTexture", "flareTexture",
  "guidedFilterCoefficientsTexture", "guidedFilterDehazeTexture",
];

export class WebGpuUnsupportedError extends Error {
  constructor(message) {
    super(message);
    this.name = "WebGpuUnsupportedError";
    this.code = "WEBGPU_UNSUPPORTED";
  }
}

function assertInput({ width, height, inputTexture, adjustments, resources }) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new TypeError("WebGPU render dimensions must be positive integers");
  }
  if (!inputTexture || !adjustments || !(adjustments.bytes instanceof Uint8Array)) {
    throw new TypeError("Original input texture and packed AllAdjustments bytes are required");
  }
  if (adjustments.bytes.byteLength < 16 || adjustments.bytes.byteLength % 4 !== 0) {
    throw new TypeError("Packed AllAdjustments must be a non-empty 32-bit aligned source buffer");
  }
  for (const name of REQUIRED_VIEWS) {
    if (!resources?.[name]) throw new TypeError(`Missing original renderer resource: ${name}`);
  }
  if (!resources.lutSampler || !resources.flareSampler) {
    throw new TypeError("Original LUT and flare samplers are required");
  }
}

/** Obtain the pinned native AllAdjustments layout from the WASM host. */
export function packNeutralExposureAdjustments(wasm, exposure = 0) {
  if (!wasm || typeof wasm.pack_neutral_renderer_adjustments !== "function") {
    throw new TypeError("RapidRAW WASM adjustment packer is required");
  }
  if (!Number.isFinite(exposure)) throw new TypeError("RapidRAW exposure must be finite");
  const bytes = wasm.pack_neutral_renderer_adjustments(exposure);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== RAPIDRAW_ALL_ADJUSTMENTS_BYTES) {
    throw new TypeError("WASM returned an invalid pinned AllAdjustments payload");
  }
  return { bytes, source: "CyberTimon/RapidRAW image_processing::AllAdjustments", scope: "neutral fixture with exposure only" };
}

async function checkedShaderSource(source) {
  if (typeof source !== "string") throw new TypeError("Pinned RapidRAW WGSL source is required");
  const bytes = new TextEncoder().encode(source);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const actual = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== RAPIDRAW_SHADER_SHA256) {
    throw new Error(`Pinned RapidRAW shader hash mismatch: ${actual}`);
  }
  return source.replace("rgba8unorm, write>", "rgba16float, write>");
}

function bindingLayout(device, adjustmentBytes) {
  return device.createBindGroupLayout({
    label: "RapidRAW original shader bindings",
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "2d" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba16float", viewDimension: "2d" } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage", minBindingSize: adjustmentBytes } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "2d-array" } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "3d" } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, sampler: { type: "filtering" } },
      ...[6, 7, 8, 9].map((binding) => ({ binding, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "2d" } })),
      { binding: 10, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "2d" } },
      { binding: 11, visibility: GPUShaderStage.COMPUTE, sampler: { type: "filtering" } },
      { binding: 12, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "2d" } },
      { binding: 13, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "2d" } },
    ],
  });
}

/**
 * Dispatches RapidRAW's complete main WGSL compute entry point.
 * The caller supplies resources produced by the pinned renderer's existing
 * preprocessing stages and its source-packed AllAdjustments bytes.
 * Returns tightly packed little-endian RGBA16F output after async GPU mapping.
 */
export async function renderOriginalFrame({
  gpu = globalThis.navigator?.gpu,
  width,
  height,
  inputTexture,
  adjustments,
  wasm,
  exposure = 0,
  resources,
  shaderSource,
  device: suppliedDevice,
}) {
  adjustments ??= packNeutralExposureAdjustments(wasm, exposure);
  assertInput({ width, height, inputTexture, adjustments, resources });
  if (!suppliedDevice && !gpu) {
    throw new WebGpuUnsupportedError("This browser does not expose navigator.gpu");
  }
  const adapter = suppliedDevice ? null : await gpu.requestAdapter();
  if (!suppliedDevice && !adapter) {
    throw new WebGpuUnsupportedError("The browser exposed WebGPU but returned no adapter");
  }
  const device = suppliedDevice ?? await adapter.requestDevice();
  const limits = device.limits;
  if (width > limits.maxTextureDimension2D || height > limits.maxTextureDimension2D) {
    throw new WebGpuUnsupportedError("Frame exceeds the selected WebGPU device texture limit");
  }
  const rowBytes = width * 8;
  const bytesPerRow = Math.ceil(rowBytes / 256) * 256;
  const readbackBytes = bytesPerRow * height;
  if (!Number.isSafeInteger(readbackBytes) || readbackBytes > MAX_FRAME_BUFFER_BYTES || readbackBytes > limits.maxBufferSize) {
    throw new WebGpuUnsupportedError("Frame exceeds the browser renderer's bounded readback capacity");
  }
  if (adjustments.bytes.byteLength > limits.maxStorageBufferBindingSize || adjustments.bytes.byteLength > limits.maxBufferSize) {
    throw new WebGpuUnsupportedError("AllAdjustments exceeds the selected WebGPU storage-buffer limit");
  }
  const source = await checkedShaderSource(shaderSource);
  const shader = device.createShaderModule({ label: "RapidRAW pinned shader", code: source });
  const layout = bindingLayout(device, adjustments.bytes.byteLength);
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  device.pushErrorScope("validation");
  const pipeline = device.createComputePipeline({
    label: "RapidRAW original full-effects compute",
    layout: pipelineLayout,
    compute: { module: shader, entryPoint: "main" },
  });

  const adjustmentBuffer = device.createBuffer({
    label: "RapidRAW source-packed AllAdjustments",
    size: adjustments.bytes.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(adjustmentBuffer, 0, adjustments.bytes);
  const output = device.createTexture({
    label: "RapidRAW RGBA16F compute result",
    size: { width, height, depthOrArrayLayers: 1 },
    format: "rgba16float",
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  const bindGroup = device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: inputTexture.createView() },
      { binding: 1, resource: output.createView() },
      { binding: 2, resource: { buffer: adjustmentBuffer } },
      { binding: 3, resource: resources.maskTextures },
      { binding: 4, resource: resources.lutTexture },
      { binding: 5, resource: resources.lutSampler },
      { binding: 6, resource: resources.sharpnessBlurTexture },
      { binding: 7, resource: resources.tonalBlurTexture },
      { binding: 8, resource: resources.clarityBlurTexture },
      { binding: 9, resource: resources.structureBlurTexture },
      { binding: 10, resource: resources.flareTexture },
      { binding: 11, resource: resources.flareSampler },
      { binding: 12, resource: resources.guidedFilterCoefficientsTexture },
      { binding: 13, resource: resources.guidedFilterDehazeTexture },
    ],
  });

  const readback = device.createBuffer({
    label: "RapidRAW async mapped frame readback",
    size: readbackBytes,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const encoder = device.createCommandEncoder({ label: "RapidRAW frame dispatch and readback" });
  const pass = encoder.beginComputePass({ label: "RapidRAW original compute" });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8), 1);
  pass.end();
  encoder.copyTextureToBuffer(
    { texture: output },
    { buffer: readback, bytesPerRow, rowsPerImage: height },
    { width, height, depthOrArrayLayers: 1 },
  );
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();
  const validationError = await device.popErrorScope();
  if (validationError) throw new Error(`RapidRAW WebGPU validation failed: ${validationError.message}`);
  await readback.mapAsync(GPUMapMode.READ);
  const mapped = new Uint8Array(readback.getMappedRange());
  const tightRowBytes = rowBytes;
  const pixels = new Uint8Array(tightRowBytes * height);
  for (let row = 0; row < height; row += 1) {
    pixels.set(mapped.subarray(row * bytesPerRow, row * bytesPerRow + tightRowBytes), row * tightRowBytes);
  }
  readback.unmap();
  readback.destroy();
  output.destroy();
  adjustmentBuffer.destroy();
  if (!suppliedDevice) device.destroy();
  return { width, height, format: "rgba16float", pixels };
}
