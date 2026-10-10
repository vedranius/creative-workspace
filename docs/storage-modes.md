# Storage modes — required architecture

Laptop access must support more than file upload. This requirement applies to every creative adapter, using one common file-provider layer.

## User choices

| Mode | Source of truth | Data access | Availability |
| --- | --- | --- | --- |
| Server project | Server workspace | Upload selected files/folders first; engines read the server copy | Implemented for transfers; engine adapters pending |
| Laptop / on demand | User-selected local folder | Engine requests file ranges through a browser agent, with bounded server cache; saves return to that folder | Required, not yet implemented in Creative Workspace |
| On demand + background copy | Laptop, with an explicitly retained server mirror | Interactive reads take priority; remaining originals copy in the background | Required, not yet implemented |

Storage retention is a separate choice: temporary cache or a retained server copy. Saving outputs is also separate: selected local folder, server project, or both. Avoid a silent change of the authoritative location when switching modes.

## Verified reference

Reviewed `vedranius/rapidraw-web`:

- `rrweb/files/remote.ts`: browser agent operates on the selected File System Access directory handle; reads use `File.slice(offset, offset + length)`; writes use writable file handles. Permission is scoped to the selected folder.
- `rrweb/relay/remote.mjs`: `transfer` and `ondemand` modes, 1 MiB fetch units, chunk cache, read-ahead, focus/read/background priorities, `keep` for retention and `fill` for background mirroring.
- `rrweb/fuse/src/main.rs`: filesystem operations travel between the native mount helper and relay over framed stdin/stdout messages. The helper is not a desktop-display transport.
- Linux uses FUSE; Windows uses WinFsp. The reference does not support macOS on-demand mounts currently. Folder sharing requires a compatible browser with File System Access and a secure page (HTTPS or localhost).

These are source-level findings, not an assertion that Creative Workspace has integrated or tested those modes yet. On the development Linux host `/dev/fuse` and `fusermount3` are present; the helper still needs building and integration.

## Common provider

The common file provider exposes directory listing, file metadata, byte-range reads, transactional writes, and change notifications. A server workspace implements these with normal storage. A laptop share implements them using an authenticated browser-agent connection and a cache.

For engines that require native filesystem paths, expose the provider through a session-scoped mount. For engines that accept reader/service abstractions, connect directly to the provider. One application's own engine must not own this facility for the whole workspace.

Use independent per-share namespaces and strong session identifiers; authenticate both HTTP and WebSocket requests, check origins, bound message sizes and cache consumption, and enforce the selected root. Browser UI controls continue to run locally; only document commands and data travel to the server.

## Lifecycle and correctness

- Keep the browser connection visible; laptop data that has not been cached cannot be read while that laptop is disconnected.
- Retain pending writes in a recovery journal until the browser acknowledges the save. Display a pending-save state, never an incorrect saved confirmation.
- Detect local changes and invalidate cached ranges. Do not silently replay a save over a newer local revision.
- Reconnect by reconciling share identity, permissions, file versions and outstanding operations.
- Stop a temporary share by safely unmounting, closing file handles, and removing only its temporary cache. Preserve retained mirrors and user originals.
- Prioritize open-document reads over thumbnails and background copies.
- On-demand does not imply zero network transfer or zero server storage. Opening a RAW file may require all its bytes; a video decoder may request scattered ranges. The benefit is avoiding an upfront transfer of the entire library.

## Acceptance gates before enabling modes in the UI

1. A generated local folder can be listed on the server without copying all contents.
2. Native or direct engine reads return the requested bytes and demonstrably avoid unrelated files.
3. Writes survive disconnect/reconnect and reach the selected local folder without corrupting originals.
4. Two shares and application sessions cannot cross their roots or interfere with each other's state.
5. Pure on-demand uses `fill=false`; hybrid mode uses background fill explicitly. Cache/retention controls are independent.
6. Browser and server capability checks disable unsupported modes with a concrete reason.
7. Large-file, cancellation, low disk-space and slow-connection cases have bounded behavior.

## Later options

Proxy-media mode for FilmCraft/EffectCraft: interactive preview uses small proxies while server exports use original media through the selected provider. Project-scoped asset collection can transfer only referenced files rather than the entire source folder. Neither option replaces the required laptop on-demand mode.
