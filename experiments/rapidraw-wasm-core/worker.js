// Experimental module worker for RapidRAW RAW pixel development.
import init, { develop_pixels, encode_rgb32f_png, read_raw_exposure, read_as_shot } from "./cw_rapidraw_wasm_probe.js";

const MAX_INPUT_BYTES = 128 * 1024 * 1024;
let ready;

self.onmessage = async ({ data }) => {
  const { id, bytes, fastDemosaic = false, linearMode = "default", output = "pixels", dpi } = data ?? {};
  if (!Number.isSafeInteger(id) || !(bytes instanceof ArrayBuffer)) {
    self.postMessage({ id, ok: false, error: "Expected { id, bytes: ArrayBuffer }" });
    return;
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_INPUT_BYTES) {
    self.postMessage({ id, ok: false, error: "RAW input must be between 1 byte and 128 MiB" });
    return;
  }
  if (!["pixels", "codec-png", "exposure", "as-shot"].includes(output) || (dpi !== undefined && (!Number.isInteger(dpi) || dpi < 0 || dpi > 65535))) {
    self.postMessage({ id, ok: false, error: "Unsupported output or invalid DPI" });
    return;
  }
  try {
    if (!ready) ready = init();
    await ready;
    if (output === "as-shot") {
      self.postMessage({ id, ok: true, asShot: JSON.parse(read_as_shot(new Uint8Array(bytes))) });
      return;
    }
    if (output === "exposure") {
      const exposure = JSON.parse(read_raw_exposure(new Uint8Array(bytes)));
      self.postMessage({ id, ok: true, exposure });
      return;
    }
    self.postMessage({ id, ok: true, status: "developing" });
    const image = develop_pixels(new Uint8Array(bytes), fastDemosaic, linearMode);
    if (output === "codec-png") {
      if (image.components !== 3) throw new Error("PNG codec requires RGB output");
      const png = encode_rgb32f_png(image.width, image.height, image.data, dpi);
      self.postMessage({ id, ok: true, width: image.width, height: image.height, mime: "image/png", data: png, scope: "RAW development and PNG codec only; GPU renderer/tone mapping not connected" }, [png.buffer]);
      return;
    }
    self.postMessage(
      { id, ok: true, width: image.width, height: image.height, components: image.components, data: image.data },
      [image.data.buffer],
    );
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
  }
};
