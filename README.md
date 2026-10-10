# Creative Workspace

A self-hosted creative studio: native browser interfaces, server-side processing, and shared project files. No remote desktop or desktop-display transport.

**Status: early creative-suite integration.** RapidRAW has a separately built, workspace-owned Linux engine and a functioning browser editor. PhotoCraft now has a working Rust server engine and a native browser adapter prototype, including laptop-folder modes. The other six ArtCraft adapters are pending.

## Implemented

- Responsive application catalog for RapidRAW and seven ArtCraft creative apps.
- PhotoCraft browser editing: documents, brush strokes, layers, adjustments, history and layered saves/exports.
- Shared laptop-folder provider: on demand, hybrid background copy and copy-first modes, with server or laptop save destinations.
- Persistent per-application server workspace configuration.
- Browser file/folder selection and drag & drop from the visiting laptop, with streamed copies into server workspaces.
- Transfer progress and cancellation, folder structure preservation, and download back to the laptop.
- Root-restricted file browser; existing files are never overwritten on import.
- Visible upstream project/team attribution, including separate RapidRAW original and web-fork links.
- GitHub latest stable release checks, manually and every 24 hours while running.
- Distinct unchecked, upstream release, no release, and check failure states.
- Upstream releases explicitly marked as not yet verified for adapter compatibility.
- Optional HTTP Basic authentication; required when listening beyond loopback.
- Docker Compose packaging and cross-platform Node test workflow.

## Run locally

Requires Node.js 24 or later. Run `npm ci` to install the pinned gateway dependency.

```sh
npm ci
mkdir -p workspaces/photography
npm start
```

Open http://127.0.0.1:8788. Click **Import from laptop**, then choose files or a folder. An application workspace is created automatically inside the first allowed root if needed. You can also assign the **absolute** path of `workspaces/photography` manually. The default allowed root is this checkout's `workspaces` directory.

For other server directories, set `WORKSPACE_ROOTS` to a platform-delimited list (colon on Linux/macOS, semicolon on Windows). Set `DATA_DIR` to change the persistent state location. Use `WORKSPACE_AUTH=user:password` and TLS for network access. `GITHUB_TOKEN` is optional and only used server-side for release checks.

## Docker

```sh
cp .env.example .env
# Edit .env and replace the example password.
mkdir -p workspaces/photography
docker compose up --build -d
```

Open http://127.0.0.1:8788. The container sees the workspace at `/app/workspaces/photography`. The workspace mount is writable for imports. Ensure the container's non-root user can read and write your directories. No Docker socket or privileged container is needed.

## Checks

```sh
npm run check
npm test
```

## Next milestones

1. Installer/start controls in the control panel (managed CLI installers are implemented).
2. Extend PhotoCraft tools/dialogs and harden reconnect, version conflicts and recovery.
3. Shared adapter protocol and extension to PdfCraft, VectorCraft and DesignCraft.
4. FilmCraft and EffectCraft: server preview jobs, proxy media, synchronized playback and exports.
5. Multi-user identity, permissions, resumable file transfer, installation and verified upgrades.

See the [development roadmap](docs/roadmap.md) and [compact handoff](docs/development-state.md), as well as [architecture](docs/architecture.md), [adapter contract](docs/adapter-contract.md) and [validation](docs/validation.md).

## Known limits

Single-user only. No delete or document editing in the file browser yet. No automatic compatible upgrades, tag fallback, rollback, or the six remaining ArtCraft server adapters. Engine installation/start is currently managed by the CLI, not a control-panel job. PhotoCraft has at most four separate sessions and a prototype UI; save documents before server restarts. A 404 from GitHub's release endpoint is reported as no published release; repository deletion or access changes need separate future checks. Upstream release notes are displayed as plain text. Scheduled checks need the service to remain running. Filesystem permissions remain the final authority; do not allow unrelated processes to replace workspace symlinks while browsing. Windows/macOS runtime behavior requires verification on those hosts.

## Laptop file imports

The control-panel **Import from laptop** flow copies selected content to the server. In PhotoCraft, **Laptop folder modes** additionally exposes on-demand access and hybrid/copy-first workflows. See [storage modes](docs/storage-modes.md) for requirements and limitations. Choose-folder imports preserve the relative tree; empty directories are not transferred. For directories use **Choose folder**, rather than folder drag and drop. Click a server file to download it. Default per-file limit: 2 GiB, configurable with `MAX_UPLOAD_BYTES`. Transfers stream to temporary files, then publish without overwriting existing names. Failed or cancelled transfers remove their temporary file. Already completed files remain imported. Transfers are not resumable yet. The HTTP request timeout is one hour; reverse proxy limits also apply.

## Workspace-owned creative engines

RapidRAW is the first native browser/server adapter. Its own installer builds a separate engine with an independent application identifier and port 8791. It does not connect to your existing RapidRAW Web installation. See [engine installation](engines/rapidraw/README.md). The gateway only enables the editor after runtime-identity and backend checks. PhotoCraft uses a separately built Rust CLI process per editing session. Install it and the optional local-folder helper:

```sh
npm run engine:photocraft:install
npm run storage:install
npm start
```

See [PhotoCraft](engines/photocraft/README.md) and [local-folder provider](engines/storage/README.md). The current Docker image packages the control gateway, without native creative engines or FUSE. Engine-enabled container packaging is a later milestone.

## Attribution and license

Creative Workspace is AGPL-3.0-only; licenses and provenance accompany the shared file provider derived from RapidRAW Web. Original creative engines retain their upstream licenses and linked attribution.
