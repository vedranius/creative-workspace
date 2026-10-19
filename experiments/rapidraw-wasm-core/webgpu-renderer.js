/**
 * Browser host boundary for the pinned RapidRAW compute renderer.
 * Upstream shader and AllAdjustments packing are retained verbatim; this
 * module owns only WebGPU resource binding, dispatch, and asynchronous readback.
 */

export const RAPIDRAW_SHADER_SHA256 = "9ecb4cc31b8ce4a12f439f69935ed0c8c27f58b52501929e0dc41d22e85ca178";
export const RAPIDRAW_SHADER_URL = new URL("./shader.wgsl", import.meta.url);
const MAX_FRAME_BUFFER_BYTES = 64 * 1024 * 1024;
export const RAPIDRAW_ALL_ADJUSTMENTS_BYTES = 45232;
const TEXTURE_BINDING_COPY_DST = 0x04 | 0x02;

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

/**
 * Creates source-compatible neutral inputs for protocol fixtures. Input and
 * blur payloads are supplied by the caller; this function only uploads them,
 * it does not approximate RapidRAW's CPU/GPU preprocessing filters.
 */
export function createNeutralRendererResources(device, options) {
  return createRendererResources(device,options,MAX_FRAME_BUFFER_BYTES);
}

/** Separate experimental export budget; no preview budget override argument. */
export function fullExportPlan(width,height) {
  const pixels=width*height,rowBytes=Math.ceil(width*4/256)*256;
  const estimatedGpuBytes=pixels*80+132+rowBytes*height+RAPIDRAW_ALL_ADJUSTMENTS_BYTES;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>4096||height>4096||
    !Number.isSafeInteger(pixels)||pixels>2048*1536||estimatedGpuBytes>256*1024*1024) {
    throw new WebGpuUnsupportedError('Full export exceeds dedicated3MP/256MiB estimated GPU payload budget');
  }
  return {width,height,pixels,estimatedGpuBytes};
}
export function createFullExportResources(device,options) {
  fullExportPlan(options.width,options.height);
  if(!(options.inputRgbaF16 instanceof Uint16Array)||options.inputRgba!==undefined)throw new TypeError('Full export requires native RGBA16F upload');
  return createRendererResources(device,options,256*1024*1024);
}

function createRendererResources(device, { width, height, inputRgba, inputRgbaF16 },textureBudget) {
  if (!device || typeof device.createTexture !== "function" || typeof device.queue?.writeTexture !== "function") {
    throw new TypeError("A WebGPU device with texture upload support is required");
  }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new TypeError("Neutral renderer dimensions must be positive integers");
  }
  const pixelCount = width * height;
  const useF16 = inputRgbaF16 !== undefined;
  const frameBytes = useF16 ? 8 : 16;
  const totalUploadBytes = pixelCount * (frameBytes * 5 + 16 * 2 + 4) + 132;
  if (!Number.isSafeInteger(pixelCount) || !Number.isSafeInteger(totalUploadBytes) || totalUploadBytes > textureBudget) {
    throw new WebGpuUnsupportedError("Neutral renderer input exceeds the bounded texture payload capacity");
  }
  if (width > device.limits?.maxTextureDimension2D || height > device.limits?.maxTextureDimension2D) {
    throw new WebGpuUnsupportedError("Neutral renderer dimensions exceed the selected WebGPU device texture limit");
  }
  if (useF16 && (inputRgba !== undefined || !(inputRgbaF16 instanceof Uint16Array) || inputRgbaF16.length !== pixelCount * 4 || inputRgbaF16.some(v => (v & 0x7c00) === 0x7c00))) {
    throw new TypeError("Input must contain exactly four finite f16 words per pixel, without an additional f32 payload");
  }
  if (!useF16 && (!(inputRgba instanceof Float32Array) || inputRgba.length !== pixelCount * 4 || inputRgba.some((v) => !Number.isFinite(v)))) {
    throw new TypeError("Input must contain exactly four finite float32 values per pixel");
  }
  const made = [];
  const make = (label, size, format, data, bytesPerRow, rowsPerImage, dimension = "2d") => {
    const texture = device.createTexture({
      label, size, dimension, format,
      usage: TEXTURE_BINDING_COPY_DST,
    });
    made.push(texture);
    device.queue.writeTexture({ texture }, data, { bytesPerRow, rowsPerImage }, size);
    return texture;
  };
  const frameSize = { width, height, depthOrArrayLayers: 1 };
  const rgbaBytesPerRow = width * frameBytes;
  const frameCopy = (label, data) => make(label, frameSize, useF16 ? "rgba16float" : "rgba32float", data, rgbaBytesPerRow, height);
  const inputPayload = useF16 ? inputRgbaF16 : inputRgba;
  const inputTexture = frameCopy("RapidRAW neutral fixture input", inputPayload);
  // These are identity/no-op preprocessing fixtures: blur inputs are caller
  // pixels; guided coefficients (a=1,b=0) produce zero detail at neutrality.
  const sharpnessBlurTexture = frameCopy("RapidRAW neutral sharpness blur input", inputPayload);
  const tonalBlurTexture = frameCopy("RapidRAW neutral tonal blur input", inputPayload);
  const clarityBlurTexture = frameCopy("RapidRAW neutral clarity blur input", inputPayload);
  const structureBlurTexture = frameCopy("RapidRAW neutral structure blur input", inputPayload);
  const gf = new Float32Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i += 1) { gf[i * 4] = 1; gf[i * 4 + 2] = 1; }
  const guidedFilterCoefficientsTexture = make("RapidRAW neutral guided-filter coefficients", frameSize, "rgba32float", gf, width * 16, height);
  const guidedFilterDehazeTexture = make("RapidRAW neutral guided-filter dehaze", frameSize, "rgba32float", gf, width * 16, height);
  const maskSize = { width, height, depthOrArrayLayers: 1 };
  const maskTextures = make("RapidRAW empty neutral mask atlas", maskSize, "r32float", new Float32Array(pixelCount), width * 4, height);
  const lutData = new Float32Array(2 * 2 * 2 * 4);
  for (let z = 0; z < 2; z += 1) for (let y = 0; y < 2; y += 1) for (let x = 0; x < 2; x += 1) {
    const i = ((z * 2 + y) * 2 + x) * 4;
    lutData[i] = x; lutData[i + 1] = y; lutData[i + 2] = z; lutData[i + 3] = 1;
  }
  const lutTexture = make("RapidRAW 2x2x2 identity LUT", { width: 2, height: 2, depthOrArrayLayers: 2 }, "rgba32float", lutData, 32, 2, "3d");
  const flareTexture = make("RapidRAW neutral black flare", { width: 1, height: 1, depthOrArrayLayers: 1 }, "rgba8unorm", new Uint8Array([0, 0, 0, 255]), 4, 1);
  const lutSampler = device.createSampler({ label: "RapidRAW LUT sampler", magFilter: "nearest", minFilter: "nearest" });
  const flareSampler = device.createSampler({ label: "RapidRAW flare sampler", magFilter: "linear", minFilter: "linear" });
  return {
    inputTexture, ownedTextures: made,
    resources: { maskTextures: maskTextures.createView({ dimension: "2d-array" }), lutTexture: lutTexture.createView({ dimension: "3d" }), lutSampler,
      sharpnessBlurTexture: sharpnessBlurTexture.createView(), tonalBlurTexture: tonalBlurTexture.createView(),
      clarityBlurTexture: clarityBlurTexture.createView(), structureBlurTexture: structureBlurTexture.createView(),
      flareTexture: flareTexture.createView(), flareSampler,
      guidedFilterCoefficientsTexture: guidedFilterCoefficientsTexture.createView(), guidedFilterDehazeTexture: guidedFilterDehazeTexture.createView() },
  };
}

/** Original RGB32F -> RGBA16F conversion runs in WASM, before GPU upload. */
export function packRgb32fRendererInput(wasm, width, height, pixels) {
  if (typeof wasm?.pack_rgb32f_renderer_input !== "function") throw new TypeError("Native renderer upload packer is required");
  const count = width * height;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 32768 || height > 32768 ||
      !Number.isSafeInteger(count) || count * 8 > MAX_FRAME_BUFFER_BYTES || !(pixels instanceof Float32Array) || pixels.length !== count * 3 || pixels.byteLength > MAX_FRAME_BUFFER_BYTES) {
    throw new TypeError("Renderer upload requires bounded dimensions and exact RGB32F input (64 MiB)");
  }
  const words = wasm.pack_rgb32f_renderer_input(width, height, pixels);
  if (!(words instanceof Uint16Array) || words.length !== count * 4 || words.some(v => (v & 0x7c00) === 0x7c00)) throw new TypeError("WASM returned invalid RGBA16F upload words");
  return words;
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

/** Map only the original exposure input; the remaining fields are neutral fixtures. */
export function packUiExposureFixture(wasm, json, asShot, options) {
  if (!wasm || typeof wasm.pack_ui_exposure_fixture !== "function") {
    throw new TypeError("RapidRAW WASM UI exposure packer is required");
  }
  validateExposureInputs(json, asShot, options);
  const bytes = wasm.pack_ui_exposure_fixture(json, asShot.sceneReferred, asShot.dngBaseline, asShot.highlightPreservation,
    options.baselineExposure === null ? undefined : options.baselineExposure, options.compensateHighlightPreservation);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== RAPIDRAW_ALL_ADJUSTMENTS_BYTES) {
    throw new TypeError("WASM returned an invalid pinned AllAdjustments payload");
  }
  return { bytes, source: "CyberTimon/RapidRAW native exposure input/visibility/baseline mapping", scope: "original UI exposure mapping only; other adjustments remain neutral fixtures" };
}

function validateExposureInputs(json, asShot, options) {
  if (typeof json !== "string" || json.length > 65536 || new TextEncoder().encode(json).byteLength > 65536) {
    throw new TypeError("Expected bounded adjustment JSON (64 KiB)");
  }
  if (typeof asShot?.sceneReferred !== "boolean" || !Number.isFinite(asShot?.dngBaseline) || !Number.isFinite(asShot?.highlightPreservation) ||
      typeof options?.compensateHighlightPreservation !== "boolean" || (options?.baselineExposure !== null && !Number.isFinite(options?.baselineExposure))) {
    throw new TypeError("Explicit finite camera exposure and baseline settings are required");
  }
}

/** Original camera WB/exposure only; remaining controls remain neutral fixtures. */
export function packCameraRendererFixture(wasm, json, asShot, options) {
  if (!wasm || typeof wasm.pack_camera_renderer_fixture !== "function") throw new TypeError("RapidRAW camera renderer packer is required");
  validateExposureInputs(json, asShot?.exposure, options);
  const wb = asShot?.whiteBalance;
  if (!Number.isFinite(wb?.temperature) || wb.temperature <= 0 || !Number.isFinite(wb?.tint)) throw new TypeError("Finite as-shot WB with positive temperature is required");
  const e = asShot.exposure;
  const bytes = wasm.pack_camera_renderer_fixture(json, wb.temperature, wb.tint, e.sceneReferred, e.dngBaseline, e.highlightPreservation,
    options.baselineExposure === null ? undefined : options.baselineExposure, options.compensateHighlightPreservation);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== RAPIDRAW_ALL_ADJUSTMENTS_BYTES) throw new TypeError("Invalid original camera adjustment payload");
  return { bytes, source: "CyberTimon/RapidRAW original WB/exposure projection", scope: "WB/exposure only; other controls remain neutral" };
}

/** Full pinned global parser; masks/preprocessing resources are separate. */
export function packGlobalRendererFixture(wasm,json,asShot,options,toneMapperOverride=null) {
  if (!wasm || typeof wasm.pack_global_renderer_fixture !== "function") throw new TypeError("Original global parser WASM is required");
  validateExposureInputs(json,asShot?.exposure,options);
  const wb=asShot?.whiteBalance;
  if (!Number.isFinite(wb?.temperature) || wb.temperature<=0 || !Number.isFinite(wb?.tint)) throw new TypeError("Finite positive as-shot WB is required");
  if (toneMapperOverride!==null && ![0,1].includes(toneMapperOverride)) throw new TypeError("Unknown original tone mapper override");
  const e=asShot.exposure;
  const bytes=wasm.pack_global_renderer_fixture(json,wb.temperature,wb.tint,e.sceneReferred,e.dngBaseline,e.highlightPreservation,
    options.baselineExposure===null?undefined:options.baselineExposure,options.compensateHighlightPreservation,toneMapperOverride===null?undefined:toneMapperOverride);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength!==RAPIDRAW_ALL_ADJUSTMENTS_BYTES) throw new TypeError("Invalid original global adjustment payload");
  return {bytes,source:"CyberTimon/RapidRAW full original global parser",scope:"Full global controls; masks and preprocessing resources remain separate"};
}

async function checkedShaderSource(source, format) {
  if (typeof source !== "string") throw new TypeError("Pinned RapidRAW WGSL source is required");
  const bytes = new TextEncoder().encode(source);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const actual = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== RAPIDRAW_SHADER_SHA256) {
    throw new Error(`Pinned RapidRAW shader hash mismatch: ${actual}`);
  }
  return format === "rgba16float" ? source.replace("rgba8unorm, write>", "rgba16float, write>") : source;
}

function bindingLayout(device, adjustmentBytes, format) {
  return device.createBindGroupLayout({
    label: "RapidRAW original shader bindings",
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "unfilterable-float", viewDimension: "2d" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format, viewDimension: "2d" } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage", minBindingSize: adjustmentBytes } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "unfilterable-float", viewDimension: "2d-array" } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "unfilterable-float", viewDimension: "3d" } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, sampler: { type: "non-filtering" } },
      ...[6, 7, 8, 9].map((binding) => ({ binding, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "unfilterable-float", viewDimension: "2d" } })),
      { binding: 10, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float", viewDimension: "2d" } },
      { binding: 11, visibility: GPUShaderStage.COMPUTE, sampler: { type: "filtering" } },
      { binding: 12, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "unfilterable-float", viewDimension: "2d" } },
      { binding: 13, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "unfilterable-float", viewDimension: "2d" } },
    ],
  });
}

/**
 * Dispatches RapidRAW's complete main WGSL compute entry point.
 * The caller supplies resources produced by the pinned renderer's existing
 * preprocessing stages and its source-packed AllAdjustments bytes.
 * Returns tightly packed RGBA8 or little-endian RGBA16F after async mapping.
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
  outputPrecision = "sixteen",
  onSubmitted,
}) {
  if (!["eight", "sixteen"].includes(outputPrecision)) throw new TypeError("Expected native eight or sixteen bit output precision");
  const format = outputPrecision === "eight" ? "rgba8unorm" : "rgba16float";
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
  const rowBytes = width * (outputPrecision === "eight" ? 4 : 8);
  const bytesPerRow = Math.ceil(rowBytes / 256) * 256;
  const readbackBytes = bytesPerRow * height;
  if (!Number.isSafeInteger(readbackBytes) || readbackBytes > MAX_FRAME_BUFFER_BYTES || readbackBytes > limits.maxBufferSize) {
    throw new WebGpuUnsupportedError("Frame exceeds the browser renderer's bounded readback capacity");
  }
  if (adjustments.bytes.byteLength > limits.maxStorageBufferBindingSize || adjustments.bytes.byteLength > limits.maxBufferSize) {
    throw new WebGpuUnsupportedError("AllAdjustments exceeds the selected WebGPU storage-buffer limit");
  }
  const source = await checkedShaderSource(shaderSource, format);
  const shader = device.createShaderModule({ label: "RapidRAW pinned shader", code: source });
  const layout = bindingLayout(device, adjustments.bytes.byteLength, format);
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  device.pushErrorScope("validation");
  const pipeline = device.createComputePipeline({
    label: "RapidRAW original full-effects compute",
    layout: pipelineLayout,
    // Original EightBit output keeps dither; SixteenBit disables it.
    compute: { module: shader, entryPoint: "main", constants: { HIGH_PRECISION_OUTPUT: outputPrecision === "eight" ? 0 : 1 } },
  });

  const adjustmentBuffer = device.createBuffer({
    label: "RapidRAW source-packed AllAdjustments",
    size: adjustments.bytes.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(adjustmentBuffer, 0, adjustments.bytes);
  const output = device.createTexture({
    label: `RapidRAW ${format} compute result`,
    size: { width, height, depthOrArrayLayers: 1 },
    format,
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
  onSubmitted?.();
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
  return { width, height, format, pixels };
}

/** Encode the native PNG path's actual EightBit render, preserving alpha. */
export function encodeRenderedFramePng(wasm, frame, dpi) {
  if (frame?.format !== "rgba8unorm" || !(frame.pixels instanceof Uint8Array) ||
      !Number.isSafeInteger(frame.width) || !Number.isSafeInteger(frame.height) || frame.width<1 || frame.height<1 || frame.width>32768 || frame.height>32768 ||
      frame.width*frame.height*4 !== frame.pixels.length || frame.pixels.byteLength>MAX_FRAME_BUFFER_BYTES ||
      (dpi !== undefined && (!Number.isInteger(dpi)||dpi<0||dpi>65535))) throw new TypeError("Native PNG requires a bounded RGBA8 rendered frame and valid DPI");
  if (typeof wasm?.encode_rendered_rgba8_png !== "function") throw new TypeError("Original PNG codec is required");
  const png=wasm.encode_rendered_rgba8_png(frame.width,frame.height,frame.pixels,dpi);
  if (!(png instanceof Uint8Array)||!png.length||png.byteLength>MAX_FRAME_BUFFER_BYTES) throw new TypeError("WASM returned invalid bounded PNG bytes");
  return png;
}

/** Native useImageProcessing expects an ArrayBuffer, JPEG or header+JPEG. */
export function encodePreviewResponse(wasm, frame, { interactive=false, quality=interactive?75:94,
    x=0, y=0, fullWidth=frame?.width, fullHeight=frame?.height }={}) {
  if (frame?.format !== 'rgba8unorm' || !(frame.pixels instanceof Uint8Array) ||
      ![frame.width,frame.height,fullWidth,fullHeight].every(v=>Number.isInteger(v)&&v>0&&v<=32768) ||
      ![x,y].every(v=>Number.isInteger(v)&&v>=0&&v<=32768) || typeof interactive !== 'boolean' ||
      x+frame.width>fullWidth || y+frame.height>fullHeight ||
      frame.width*frame.height*4 !== frame.pixels.byteLength || fullWidth*fullHeight*4>MAX_FRAME_BUFFER_BYTES ||
      !(interactive?[65,75,85].includes(quality):quality===94&&x===0&&y===0&&frame.width===fullWidth&&frame.height===fullHeight)) {
    throw new TypeError('Original preview requires bounded RGBA8, valid rectangle and native quality');
  }
  if (typeof wasm?.encode_preview_response !== 'function') throw new TypeError('Original preview codec is required');
  const bytes=wasm.encode_preview_response(frame.width,frame.height,frame.pixels,quality,interactive,x,y,fullWidth,fullHeight);
  const offset=interactive?24:0;
  if (!(bytes instanceof Uint8Array)||bytes.byteLength<offset+4||bytes.byteLength>MAX_FRAME_BUFFER_BYTES||
      bytes[offset]!==255||bytes[offset+1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217) {
    throw new TypeError('WASM returned invalid bounded JPEG preview');
  }
  if (interactive) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,24);
    const expected=[x,y,frame.width,frame.height,fullWidth,fullHeight];
    if(expected.some((v,i)=>view.getUint32(i*4,true)!==v)) throw new TypeError('WASM preview rectangle mismatch');
  }
  return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
