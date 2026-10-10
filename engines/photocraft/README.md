# PhotoCraft browser/server adapter

The Rust PhotoCraft engine is built from a pinned public source commit into a separate workspace runtime. No existing PhotoCraft installation or desktop control bridge is used. Each editing session spawns `photocraft-cli serve` on stdin/stdout with explicit read/write directory capabilities. The browser owns its controls and overlays; original image data, edits, compositing, history and file encoding stay in Rust on the server. Only document previews and metadata return to the browser.

```sh
npm ci
npm run engine:photocraft:install
# Optional: on-demand access to laptop folders
npm run storage:install
npm start
```

The installer requires Rust and Git. The current engine runtime has been exercised on Linux x64. The Node gateway tests cover Windows/macOS too; full native engine builds on those hosts are not yet verified. `CW_PHOTOCRAFT_RUNTIME` chooses the install directory; `CW_PHOTOCRAFT_SOURCE` selects a development source checkout; `CW_PHOTOCRAFT_BINARY` points the gateway at an explicitly installed engine binary.

## First supported workflows

- Native browser UI with a canvas preview, layers and history.
- Open server documents or copy a selected laptop file into the application workspace.
- Choose a laptop folder: on demand, on demand with background copying, or copy the complete folder before editing.
- Keep originals on the laptop while saving results to the server, or grant write access and save back to that laptop folder.
- Create documents; brush strokes; rectangle selections; layer select/visibility/opacity/blend/duplicate/delete; undo/redo.
- Gaussian blur, brightness/contrast, hue/saturation and adjustment layers through the actual engine.
- Discover additional engine commands and their parameter descriptions.
- Save layered `.pcraft`/PSD documents and export PNG/JPEG/WebP; download outputs.
- Independent engine state per editing session, request deduplication, path restrictions, bounded preview size and overwrite confirmation.

## Important boundaries

This is a **browser adapter prototype**, not a port of the full original egui interface. Its UI does not yet expose every PhotoCraft tool or dialog with production fidelity. The original egui frontend directly owns a concrete `Session`; preserving that interface remotely requires an asynchronous engine boundary, metadata mirror, remote compositor and remote pixel/tool sampling. The headless protocol provides a functioning server-backed path while that larger refactor is developed.

Laptop folder modes use the independently built [common file provider](../storage/README.md). A native Linux engine/FUSE test opened and edited a selected generated image, saved/reopened a layered document on the simulated laptop, and did not read an unrelated 8 MiB file. This protocol fixture is not a real browser directory-picker permission test; hybrid/background-copy stress testing and durable crash/reconnect recovery remain pending. Chrome/Edge with File System Access and HTTPS or localhost are required for shared folders. Ordinary file imports remain available in other browsers. The current workspace remains single-user, with at most four PhotoCraft editing sessions. Session storage is in-memory and not crash-recoverable: save layered documents before restarting the service. Closed/idle sessions expire after one hour. Keep the editor tab open while working. Source PSD/pcraft files are protected by capabilities; overwriting a different existing output requires confirmation.

Original project: [PhotoCraft by the ArtCraft team](https://github.com/storytold/photocraft), MIT or Apache-2.0. Workspace adapter source is tracked here; upstream Rust source is not modified by this installer.
