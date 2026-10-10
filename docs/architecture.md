# Architecture

## Invariant

User interface logic runs in the browser. Document engines, original media processing, previews, exports and persistent project state run on the server. The browser receives UI state, events, and media previews; the platform never transports screenshots of desktop widgets.

## Components

- Web workspace: application switcher, projects, common file picker and notifications.
- Control service: catalog, identity, permissions, installation metadata and updates.
- Session manager: one isolated engine session per user/document context, recovery and limits.
- Storage service: application roots, project assets, upload/download, atomic saves and permissions.
- Job service: CPU/GPU scheduling, priorities, cancellation and durable export state.
- App adapters: application-specific mapping between browser frontend and engine operations.

The current implementation includes the control service, catalog, workspace settings, imports/downloads, an independent RapidRAW gateway/runtime, a separate PhotoCraft process per editing session, and the common laptop-folder provider. Managed CLI installers build pinned engines. Control-panel install jobs, durable recovery, scheduling and multi-user identity are future work.

The transfer milestone additionally implements local browser file/folder imports and downloads. Upload alone is not the final storage architecture: [storage modes](storage-modes.md) requires laptop-authoritative on-demand access and hybrid background copying for every creative adapter.

## Update model

Track upstream application version, adapter version and installed deployment version separately. A new GitHub release does not imply the adapter is compatible. Future installation must pin build inputs, validate package digests, check migrations, and preserve an old deployment until health checks pass. Existing sessions must not be terminated silently. Persistent data migrations require their own backup/restore strategy.

## Initial runtime

Node.js 24+ with a control service, the `ws` transport dependency and a static native browser UI. This is a portable foundation, not a final constraint on engine runtimes. Rust engines will run as isolated processes or containers. Docker Compose is the initial deployment route. GPU access will be adapter- and platform-specific.

## ArtCraft integration

Existing ArtCraft WASM builds execute engines in the browser. They must be changed to communicate with remote engines; embedding those builds unchanged does not meet the project invariant. Existing command registries and engine/UI layering are promising entry points. Immediate-mode UI dependencies on synchronous local document state require an asynchronous state mirror or a frontend refactor. Interactive strokes and timeline gestures need batching, sequencing, authoritative results and bounded local feedback. Exact feature preservation must be established by application-specific acceptance tests.

## PhotoCraft prototype

PhotoCraft commands travel over authenticated same-origin HTTP to a session-scoped Rust CLI process using capability-scoped JSON lines on stdin/stdout. Document metadata and bounded PNG previews return to the browser; controls and transient stroke/selection overlays are DOM/SVG. The common file provider is engine-independent, with its own helper and isolated per-app/share roots. PhotoCraft can read from a laptop mount and write either to that mount or to its configured server workspace. Request IDs deduplicate engine mutations within a live session; saved layered documents provide manual restart recovery. This is a working subset of the original UI, not full egui feature parity.
