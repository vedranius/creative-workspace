import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeRawInWorker,
  isDecodeTimeoutAllowed,
  isRawInputSizeAllowed,
  MAX_DECODE_TIMEOUT_MS,
  MAX_RAW_INPUT_BYTES,
} from "./decoder-client.js";

let lastWorker;
class FakeWorker {
  constructor() {
    lastWorker = this;
    this.terminated = false;
  }
  postMessage({ id }) {
    queueMicrotask(() => this.onmessage?.({ data: { id, ok: true, status: "decoding" } }));
  }
  terminate() {
    this.terminated = true;
  }
}

test("RAW and timeout preflights are bounded", () => {
  assert.equal(isRawInputSizeAllowed(1), true);
  assert.equal(isRawInputSizeAllowed(MAX_RAW_INPUT_BYTES), true);
  assert.equal(isRawInputSizeAllowed(0), false);
  assert.equal(isRawInputSizeAllowed(MAX_RAW_INPUT_BYTES + 1), false);
  assert.equal(isDecodeTimeoutAllowed(1), true);
  assert.equal(isDecodeTimeoutAllowed(MAX_DECODE_TIMEOUT_MS), true);
  assert.equal(isDecodeTimeoutAllowed(MAX_DECODE_TIMEOUT_MS + 1), false);
});

test("AbortSignal terminates a worker after it reports decode start", async () => {
  globalThis.Worker = FakeWorker;
  const controller = new AbortController();
  let sawDecodeStart = false;
  const result = await decodeRawInWorker(new ArrayBuffer(1), {
    signal: controller.signal,
    timeoutMs: 100,
    onStatus: () => {
      sawDecodeStart = true;
      controller.abort();
    },
  });
  assert.equal(sawDecodeStart, true);
  assert.equal(result.reason, "aborted");
  assert.equal(lastWorker.terminated, true);
});

test("timeout terminates a worker that does not finish decoding", async () => {
  globalThis.Worker = FakeWorker;
  const result = await decodeRawInWorker(new ArrayBuffer(1), { timeoutMs: 5 });
  assert.equal(result.reason, "timeout");
  assert.equal(lastWorker.terminated, true);
});
