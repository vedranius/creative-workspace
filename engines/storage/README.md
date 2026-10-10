# Workspace local-folder provider

Shared storage is owned by Creative Workspace and runs independently of any creative engine or existing RapidRAW installation. The browser agent reads only the folder selected by the user. Native engines see a share-scoped filesystem mount; the gateway handles listings, ranges, temporary caching and acknowledged writes.

```sh
npm run storage:install
npm start
```

The installer builds the included, pinned Rust helper into `data/engines/storage/build/release`. It needs Rust and Linux `fuse3` (`/dev/fuse`, `fusermount3`), or Windows WinFsp. The Linux engine/mount combination is verified locally; the Windows build is not yet verified. macOS servers support copy mode; on-demand mounts are not implemented there. The laptop may use another OS, with Chrome/Edge and HTTPS or localhost.

Use `CW_STORAGE_RUNTIME` for another build directory and `CW_FUSE_BINARY` to point the gateway at that helper. The provider never discovers or attaches to a running RapidRAW relay. PhotoCraft uses this common provider; RapidRAW still uses the filesystem implementation bundled in its separately built, workspace-owned adapter.

## Modes and destinations

- **On demand:** `fill=false`; files are read in 1 MiB cache units when the engine requests them.
- **Hybrid:** on-demand foreground reads with explicitly enabled background copying.
- **Copy first:** the complete chosen tree transfers before the editing session starts.
- **Save to server:** source is read-only; outputs go to the app's configured server workspace.
- **Save to laptop:** on-demand only; the user grants write access to the chosen folder. Save returns only after the laptop acknowledges writes. Download remains available too.

Temporary caches are removed on stopping a clean share. Retained originals use separate `local-<share-id>` directories inside the application workspace. Failed/unacknowledged writes preserve their server mirror when stopping, with its recovery location in the server log. Automatic recovery after a server restart, version-conflict resolution, cache quotas and durable reconnect journals are still pending. Keep the browser tab connected and save documents regularly.

## Source attribution

`src/vendor/storage/provider.js`, `public/storage/agent.js` and this directory's Rust helper derive from [vedranius/rapidraw-web](https://github.com/vedranius/rapidraw-web), commit `38ddc8af1bc51552fcab8781c4838b17082f97bd`, under AGPL-3.0-only. Their licenses are included. Workspace changes isolate runtime paths and shares, make background fill opt-in, check message/listing sizes, bound requests/uploads, preserve pending writes, and integrate application session capabilities. Creative Workspace is distributed under the root AGPL license. Original PhotoCraft engine licensing remains MIT or Apache-2.0.

To repeat the native integration smoke with generated protocol data:

```sh
node scripts/smoke-photocraft-local-folder.mjs
```

It needs a running PhotoCraft engine and this helper. It tests actual processing, laptop save/reopen, server save, and zero reads of an unrelated 8 MiB file. It does not automate a browser directory-picker permission flow.
