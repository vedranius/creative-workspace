// Experimental dedicated worker for the generated wasm-bindgen web target.
// The caller can terminate this worker to cancel an in-flight decode.
import init, { decode_sensor_sample_count } from "./cw_rapidraw_wasm_probe.js";

let ready;

self.onmessage = async ({ data }) => {
  const { id, bytes } = data ?? {};
  if (!Number.isSafeInteger(id) || !(bytes instanceof ArrayBuffer)) {
    self.postMessage({ id, ok: false, error: "Expected { id, bytes: ArrayBuffer }" });
    return;
  }

  try {
    if (!ready) ready = init();
    await ready;
    const sampleCount = decode_sensor_sample_count(new Uint8Array(bytes));
    self.postMessage({ id, ok: true, sampleCount });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
  }
};
