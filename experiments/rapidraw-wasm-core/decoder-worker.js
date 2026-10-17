// Experimental dedicated worker for the generated wasm-bindgen web target.
// The caller can terminate this worker to cancel an in-flight decode.
import init, { decode_sensor_report } from "./cw_rapidraw_wasm_probe.js";

const MAX_INPUT_BYTES = 128 * 1024 * 1024;
let ready;

self.onmessage = async ({ data }) => {
  const { id, bytes } = data ?? {};
  if (!Number.isSafeInteger(id) || !(bytes instanceof ArrayBuffer)) {
    self.postMessage({ id, ok: false, error: "Expected { id, bytes: ArrayBuffer }" });
    return;
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_INPUT_BYTES) {
    self.postMessage({ id, ok: false, error: "RAW input must be between 1 byte and 128 MiB" });
    return;
  }

  try {
    if (!ready) ready = init();
    await ready;
    const report = JSON.parse(decode_sensor_report(new Uint8Array(bytes)));
    self.postMessage({ id, ok: true, report });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
  }
};
