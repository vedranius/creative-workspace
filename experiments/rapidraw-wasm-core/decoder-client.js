// Browser-side owner for a single decoder worker. Transferring the buffer moves
// ownership to the worker; check File.size with isRawInputSizeAllowed first.
export const MAX_RAW_INPUT_BYTES = 128 * 1024 * 1024;
export const DEFAULT_DECODE_TIMEOUT_MS = 30_000;
export const MAX_DECODE_TIMEOUT_MS = 120_000;

let nextRequestId = 0;

export function isRawInputSizeAllowed(size) {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_RAW_INPUT_BYTES;
}

export function isDecodeTimeoutAllowed(timeoutMs) {
  return Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= MAX_DECODE_TIMEOUT_MS;
}

/**
 * Decode one transferred ArrayBuffer. The promise resolves exactly once on a
 * report, error, timeout or AbortSignal. Timeout and abort synchronously
 * terminate the dedicated worker; they do not wait for decoder cooperation.
 */
export function decodeRawInWorker(bytes, {
  signal,
  timeoutMs = DEFAULT_DECODE_TIMEOUT_MS,
  onStatus,
} = {}) {
  if (!(bytes instanceof ArrayBuffer)) {
    return Promise.resolve({ ok: false, reason: "invalid-input", error: "Expected an ArrayBuffer" });
  }
  if (!isRawInputSizeAllowed(bytes.byteLength)) {
    return Promise.resolve({ ok: false, reason: "input-limit", error: "RAW input must be between 1 byte and 128 MiB" });
  }
  if (!isDecodeTimeoutAllowed(timeoutMs)) {
    return Promise.resolve({ ok: false, reason: "invalid-timeout", error: "Decode timeout must be between 1 ms and 120 s" });
  }
  if (signal && (typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) {
    return Promise.resolve({ ok: false, reason: "invalid-signal", error: "Expected an AbortSignal" });
  }
  if (signal?.aborted) {
    return Promise.resolve({ ok: false, reason: "aborted", error: "RAW decode cancelled" });
  }

  const id = ++nextRequestId;
  let worker;
  try {
    worker = new Worker(new URL("./decoder-worker.js", import.meta.url), { type: "module" });
  } catch (error) {
    return Promise.resolve({ id, ok: false, reason: "worker-error", error: String(error?.message ?? error) });
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      resolve(result);
    };
    const onAbort = () => settle({ id, ok: false, reason: "aborted", error: "RAW decode cancelled" });
    const timer = setTimeout(
      () => settle({ id, ok: false, reason: "timeout", error: "RAW decode timed out" }),
      timeoutMs,
    );

    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data?.id !== id) return;
      if (data.status === "decoding") {
        try {
          onStatus?.(data.status);
        } catch (error) {
          settle({ id, ok: false, reason: "status-handler-error", error: String(error?.message ?? error) });
        }
        return;
      }
      settle(data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      settle({ id, ok: false, reason: "worker-error", error: event.message || "RAW worker failed" });
    };
    worker.onmessageerror = () => settle({ id, ok: false, reason: "worker-error", error: "RAW worker message could not be read" });

    if (signal?.aborted) {
      onAbort();
      return;
    }
    worker.postMessage({ id, bytes }, [bytes]);
  });
}
