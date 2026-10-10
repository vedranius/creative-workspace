# Workspace-owned PdfCraft

The independent `cw-pdfcraft-engine` embeds [PdfCraft 0.5.0 by the ArtCraft team](https://github.com/storytold/pdfcraft), pinned by `manifest.json`. PdfCraft and our original Rust stdio adapter are licensed MIT OR Apache-2.0; Creative Workspace's surrounding gateway/browser code is AGPL-3.0-only. No desktop transport, existing app installation or MCP server is used.

Install with `npm run engine:pdfcraft:install`. Rust 1.90+, a C compiler/linker and CMake are required. `CW_PDFCRAFT_RUNTIME` and `CW_PDFCRAFT_SOURCE` choose owned runtime/source paths; `CW_PDFCRAFT_BINARY` chooses the resulting gateway binary. The installer preserves pinned upstream dependency versions and adds only the workspace shim package to Cargo.lock. It retains the upstream license/attribution notices.

Each browser session has a separate native process and a private workspace. Opening fetches only the selected PDF into this workspace. PDF parsing requires the entire selected file; it does not copy the remaining laptop library. The current open/export limit is 128 MB and eight documents per session.

The first browser adapter supports server/laptop import, blank A4 PDFs, page previews/navigation/rotation/deletion/move, sticky notes, undo/redo, text extraction and saving a new PDF copy. It does not reproduce every original tool or encrypted-file dialog. All processing and PNG rendering use the native engine.

Server, on-demand, hybrid and copy-first sources use the common storage provider. Save destination is separate. Server writes use exclusive atomic publication; laptop writes use an exclusive new filename and wait for provider ACK. Existing originals are never automatically replaced. The native export-copy operation does not clear undo or mark the engine document saved before destination acknowledgement. Gateway save state becomes clean only after successful publication/ACK. Failed laptop writes retain the provider's recovery journal.

Session caches are removed after an explicit clean close; dirty sessions are not silently expired. Native engine crash recovery, quotas, real user directory-picker permissions, large-file stress and native Windows/macOS remain separate verification tasks. Docker currently packages the gateway, not this engine.
