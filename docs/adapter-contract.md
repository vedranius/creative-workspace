# Adapter contract — proposed, not implemented

Each adapter declares application ID, upstream repository, adapter protocol version, supported platform/architecture, package digest, workspace permissions, CPU/RAM/GPU requirements, health endpoint and compatibility range.

## Lifecycle

`install → verify → start session → open document → execute commands → save → stop`

Installation and privileged lifecycle actions belong to the administrator. Document operations execute in a user's isolated session with an explicitly granted project root.

## Transport

Use authenticated WebSockets for commands and events, and authorized HTTP media requests for previews and range reads. Proposed command envelope:

```json
{"protocol":1,"sessionId":"opaque-id","requestId":"unique-id","documentRevision":42,"command":"adapter-specific-command","params":{}}
```

Responses include request ID, authoritative revision and result/error. Events carry monotonically increasing sequence IDs. Reconnection must reconcile document revision and event cursor before accepting further mutations. Never automatically replay a non-idempotent command after an ambiguous disconnect; use request-ID deduplication and explicit operation status.

Browser-side optimistic interaction is limited to transient UI overlays. Server state is authoritative. Engine adapters map real command names; example envelopes are not claims that every application supports identical commands.

## First acceptance flow

Open a server file through the common picker, manipulate it in a browser-native UI, obtain server-rendered previews, save on the server, reconnect, and confirm persistence. Verify that the original document and expensive processing are not moved to the client. Repeat with two isolated sessions and prove that editing one does not affect the other.
