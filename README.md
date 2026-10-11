# Creative Workspace

**Version: 0.2.0-alpha.7** — single-user creative prototype.

A self-hosted creative studio: native browser interfaces, server-side processing, and shared project files. No remote desktop or desktop-display transport. The LightCraft browser preview opens at `/apps/lightcraft/`; its status stays planned until real browser permission and FUSE/agent open/edit/save/reopen acceptance passes.

**Original ArtCraft application ports: 0 complete.** PhotoCraft, PdfCraft, VectorCraft and DesignCraft have limited custom browser prototypes backed by independent server engines. The dashboard labels these as prototypes and keeps original application ports pending, regardless of engine readiness. PAR-03a is in progress: connect one representative original DesignCraft command and server-rendered canvas to its original browser UI. RapidRAW remains a separate integration. LightCraft remains a limited preview; FilmCraft and EffectCraft are pending.

## Goal and downloads

A lightweight laptop should be able to access a powerful self-hosted creative server from anywhere, using native browser editors and explicitly selected laptop/server files. The control panel brings owned engines, workspace folders, safe saves and upstream attribution together. LightCraft recipes preserve editable adjustments with their source hash; only an acknowledged recipe save marks the session clean.

[GitHub Releases](https://github.com/vedranius/creative-workspace/releases) is the download location. The Actions pipeline builds portable Linux x64, Windows x64 and Apple Silicon macOS bundles with Node 24 and PhotoCraft/PdfCraft/VectorCraft/DesignCraft; publication waits for every target native smoke. The PhotoCraft version-race smoke allows either concurrent request to win while requiring stale-version rejection. LightCraft is not included in those bundles yet. RapidRAW and the native mount helper are not bundled. A pipeline run in progress is not an available release. See [installation, requirements and upgrades](docs/releases.md) and [changelog](CHANGELOG.md).

**Frontend scope:** the current ArtCraft integrations use original upstream native engines, but their browser interfaces were written for Creative Workspace and expose limited subsets. They are prototypes, not the original ArtCraft applications ported with their full interfaces/toolsets. The original DesignCraft UI is built and previewed from upstream source; its session, commands and rendering are not yet server-backed. See PAR-03a in the roadmap. Existing download bundles have prototype scope.

## Implemented

- Responsive application catalog for RapidRAW and seven ArtCraft creative apps.
- PhotoCraft browser editing: documents, brush strokes, layers, adjustments, history and layered saves/exports.
- Shared laptop-folder provider: on demand, hybrid background copy and copy-first modes, with server or laptop save destinations.
- Durable pending-save journal with a Save recovery dialog in the homepage and PhotoCraft. Review uncertain/incomplete outputs and download separate `.recovered` server copies after a gateway restart.
- PhotoCraft gateway session-version checks reject stale browser/controller edits, including a stale Save after another client switches documents. The [MCP adapter audit](docs/mcp-adapter-audit.md) defines the next small prototype; an MCP endpoint is not yet implemented.
- PdfCraft opens/imports PDFs, renders pages on the server, rotates/moves/deletes pages, adds notes, supports undo/redo and exports a new PDF copy. Native on-demand tests confirm selected-file access, acknowledged laptop output and separate server output. See [PdfCraft runtime](engines/pdfcraft/README.md).
- VectorCraft opens SVG/native documents, draws shapes and paths, edits colours and positions, supports undo/redo and saves editable native copies or SVG/PDF/PNG exports. Native Linux and browser upload/edit/save/download/reopen flows passed, including acknowledged on-demand laptop output. See [VectorCraft runtime](engines/vectorcraft/README.md).
- DesignCraft creates/opens native publications, edits text frames and typography, reports overset, resizes/reflows frames and exports PDF/PNG or editable native copies. Native/browser save/reopen and acknowledged on-demand laptop output passed. See [DesignCraft runtime](engines/designcraft/README.md).
- LightCraft has a pinned native CPU foundation, version-guarded gateway, and browser preview UI for photo open, native-range controls, undo/redo, hash-bound editable recipes and image exports. Recipe saves require destination acknowledgement; JPEG/PNG export alone stays dirty. This preview is not yet accepted as an available app: real browser permission and FUSE/agent open/edit/save/reopen evidence is still required. LightCraft is not in Actions bundles. See [LightCraft foundation](engines/lightcraft/README.md).
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

See the [development roadmap](docs/roadmap.md), [AI/MCP integration plan](docs/ai-assistant.md) and [compact handoff](docs/development-state.md), as well as [architecture](docs/architecture.md), [adapter contract](docs/adapter-contract.md) and [validation](docs/validation.md).

## Known limits

Single-user only. No delete or document editing in the file browser yet. No automatic compatible upgrades, tag fallback, rollback, or the three remaining ArtCraft server adapters. Engine installation/start is currently managed by the CLI, not a control-panel job. PhotoCraft has at most four separate sessions and a prototype UI; save documents before server restarts. A 404 from GitHub's release endpoint is reported as no published release; repository deletion or access changes need separate future checks. Upstream release notes are displayed as plain text. Scheduled checks need the service to remain running. Filesystem permissions remain the final authority; do not allow unrelated processes to replace workspace symlinks while browsing. Windows/macOS runtime behavior requires verification on those hosts.

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
