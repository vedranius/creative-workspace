// Candidate original-shell transport. Mutation ACKs/FIFO never pass here.
const active = new Map();
const MAX_REPLY_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

export function endnoteQueryEpoch() { return crypto.randomUUID(); }
export function endnoteQueryNow() { return performance.now(); }

export function abortEndnoteQuery(session, requestId) {
  const entry = active.get(requestId);
  if (!entry || entry.session !== session) return false;
  active.delete(requestId);
  entry.controller.abort();
  return true;
}

export async function fetchEndnoteQuery(session, requestId, encoded) {
  if (!/^[a-f0-9]{48}$/.test(session) || typeof requestId !== 'string'
      || !/^endnote-query-[a-f0-9-]{36}-[1-9][0-9]*$/.test(requestId)
      || requestId.length > 100 || typeof encoded !== 'string' || encoded.length > 1024) {
    throw Error('Invalid Endnote query identity');
  }
  const request = JSON.parse(encoded);
  if (Object.keys(request).sort().join(',') !== 'expectedVersion,method,params,requestId'
      || request.method !== 'endnote.list' || request.requestId !== requestId
      || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 1
      || !request.params || Array.isArray(request.params) || Object.keys(request.params).length) {
    throw Error('Invalid Endnote query');
  }
  if (active.size) throw Error('Endnote query transport already busy');
  const controller = new AbortController(), entry = { session, controller };
  active.set(requestId, entry);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`/api/designcraft/sessions/${session}/rpc`, {
      method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: encoded, signal: controller.signal,
    });
    if (!response.ok) throw Error('Endnote query failed');
    const length = response.headers.get('Content-Length');
    if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > MAX_REPLY_BYTES)) {
      controller.abort(); throw Error('Endnote query response exceeds its byte budget');
    }
    if (!response.body) throw Error('Missing Endnote query response');
    const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
    let total = 0; const chunks = [];
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_REPLY_BYTES) {
          controller.abort(); throw Error('Endnote query response exceeds its byte budget');
        }
        chunks.push(decoder.decode(value, { stream: true }));
      }
      chunks.push(decoder.decode());
      if (controller.signal.aborted) throw Error('Endnote query cancelled');
      return chunks.join(''); // Original Rust model validates the bounded JSON.
    } finally { reader.releaseLock(); }
  } finally {
    controller.abort(); // Also close an unread body after decoding/schema transport failure.
    clearTimeout(timer);
    if (active.get(requestId) === entry) active.delete(requestId);
  }
}
