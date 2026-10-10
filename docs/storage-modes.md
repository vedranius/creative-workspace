# Storage modes — prototype implementation and production targets

Laptop access must support more than file upload. This requirement applies to every creative adapter, using one common file-provider layer.

## User choices

| Mode | Source of truth | Data access | Availability |
| --- | --- | --- | --- |
| Server project | Server workspace | Upload selected files/folders first; engines read the server copy | Working in RapidRAW, PhotoCraft, PdfCraft and VectorCraft |
| Laptop / on demand | User-selected local folder | Engine requests file ranges through a browser agent; save destination is selected separately | Native Linux PhotoCraft/PdfCraft/VectorCraft read/edit/laptop-save flows verified with generated protocol fixtures |
| On demand + background copy | Laptop; server retention is optional | Interactive reads take priority; remaining originals copy in the background | Available in PhotoCraft/PdfCraft/VectorCraft prototype UI; background-copy stress tests pending |

Storage retention is a separate choice: temporary cache or a retained server copy. Saving outputs is also separate: selected local folder or server project. Downloading saved outputs is always available. Simultaneous automatic saving to both locations is a future option. Avoid a silent change of the authoritative location when switching modes.

PdfCraft's headless library has one filesystem root. The adapter fetches only the selected PDF into a private session workspace for parsing; that PDF must be read in full. Its export-copy operation leaves native undo/state intact until the selected destination confirms publication. On-demand tests confirm no access to an unrelated 8 MiB file, byte-identical acknowledged laptop output, reopen, and separate server output. This does not automate a real user's directory picker or version-safe replay.

## Verified reference

Reviewed `vedranius/rapidraw-web`:

- `rrweb/files/remote.ts`: browser agent operates on the selected File System Access directory handle; reads use `File.slice(offset, offset + length)`; writes use writable file handles. Permission is scoped to the selected folder.
- `rrweb/relay/remote.mjs`: `transfer` and `ondemand` modes, 1 MiB fetch units, chunk cache, read-ahead, focus/read/background priorities, `keep` for retention and `fill` for background mirroring.
- `rrweb/fuse/src/main.rs`: filesystem operations travel between the native mount helper and relay over framed stdin/stdout messages. The helper is not a desktop-display transport.
- Linux uses FUSE; Windows uses WinFsp. The reference does not support macOS on-demand mounts currently. Folder sharing requires a compatible browser with File System Access and a secure page (HTTPS or localhost).

The common provider and browser agent now derive from these pinned sources, with licenses included and independent runtime paths. A separately built `cw-filesystem-helper` serves PhotoCraft without any RapidRAW relay. On the development Linux host, real PhotoCraft processing read the selected generated PNG, changed its preview, wrote/reopened a layered laptop document, and read zero bytes from an unrelated 8 MiB file. Server-destination output also passed. The directory-picker permission flow on a real laptop has not been automated.

## Common provider

The common file provider exposes directory listing, file metadata, byte-range reads, transactional writes, and change notifications. A server workspace implements these with normal storage. A laptop share implements them using an authenticated browser-agent connection and a cache.

For engines that require native filesystem paths, expose the provider through a session-scoped mount. For engines that accept reader/service abstractions, connect directly to the provider. One application's own engine must not own this facility for the whole workspace.

Use independent per-share namespaces and strong session identifiers; authenticate both HTTP and WebSocket requests, check origins, bound message sizes and uploads, and enforce the selected root. Cache quotas remain pending. Browser UI controls continue to run locally; only document commands and data travel to the server.

## Production lifecycle targets

- Keep the browser connection visible; laptop data that has not been cached cannot be read while that laptop is disconnected.
- Retain pending writes in a recovery journal until the browser acknowledges the save. Display a pending-save state, never an incorrect saved confirmation.
- Detect local changes and invalidate cached ranges. Do not silently replay a save over a newer local revision.
- Reconnect by reconciling share identity, permissions, file versions and outstanding operations.
- Stop a temporary share by safely unmounting, closing file handles, and removing only its temporary cache. Preserve retained mirrors and user originals.
- Prioritize open-document reads over thumbnails and background copies.
- On-demand does not imply zero network transfer or zero server storage. Opening a RAW file may require all its bytes; a video decoder may request scattered ranges. The benefit is avoiding an upfront transfer of the entire library.

## Production acceptance gates

1. A generated local folder can be listed on the server without copying all contents.
2. Native or direct engine reads return the requested bytes and demonstrably avoid unrelated files.
3. Writes survive disconnect/reconnect and reach the selected local folder without corrupting originals.
4. Two shares and application sessions cannot cross their roots or interfere with each other's state.
5. Pure on-demand uses `fill=false`; hybrid mode uses background fill explicitly. Cache/retention controls are independent.
6. Browser and server capability checks disable unsupported modes with a concrete reason.
7. Large-file, cancellation, low disk-space and slow-connection cases have bounded behavior.

## Later options

Proxy-media mode for FilmCraft/EffectCraft: interactive preview uses small proxies while server exports use original media through the selected provider. Project-scoped asset collection can transfer only referenced files rather than the entire source folder. Neither option replaces the required laptop on-demand mode.

## Current prototype boundaries

Shared folder handles are retained in browser IndexedDB and require a user gesture to regain permission. A browser reconnect can reattach to a live server share. Server share/session registry state is in memory: after a server restart, choose the folder again and reopen a saved document. Pending laptop writes now have a durable generation-scoped journal under `data/local-folders/recovery`, with a recovery inventory and authenticated server-copy download after restart. Failed final renames also retain temporary layered outputs, including when the engine attempts cleanup. An incomplete write is explicitly marked as possibly incomplete. **Save recovery** in the homepage shows all applications; PhotoCraft opens its own filtered list. Records show folder/path, time, state, size/availability and save errors. An optional availability check reports missing copies without changing files. The browser streams downloads directly, names them `.recovered`, and manages download progress/cancellation; access failures open separately. Downloading keeps the journal and never replays a write or opens a laptop directory handle. Automatic reconciliation/replay, version conflicts and cache quotas remain pending. Copy-first can work without a mount helper; on-demand currently needs a Linux/FUSE or Windows/WinFsp server. Windows native and high-latency behavior remain unverified; macOS on-demand server mounts are unsupported. Full-folder sharing requires File System Access, while ordinary file/folder upload is the browser fallback.

VectorCraft uses separate native read/write roots. It opens the selected file directly from the source provider and exports first into a private output folder. Only a confirmed native .vectorcraft save clears dirty state; SVG/PDF/PNG exports retain unsaved changes. Its generated Linux FUSE proof read the 154-byte selected SVG and zero bytes from an unrelated 8 MiB file, then acknowledged/reopened laptop output. Browser directory permission and reconnect/version-safe replay still need separate verification.
