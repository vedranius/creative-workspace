<p align="center"><img src="docs/brand/banner.svg" alt="Creative Workspace — your studio, everywhere" width="1280"></p>

# Creative Workspace

**Version: 0.2.0-alpha.15** — open-source, self-hosted, single-user prototype.

Bring your creative tools together in one browser studio. Choose an application, select your files, and access your own server from a lightweight laptop. The goal is **the original application interfaces and tools in the browser, with the server doing the heavy work**: photography, image editing, illustration, PDF, publishing, video and motion graphics. Browser controls run locally; document commands, data and previews travel to the server. No VNC or remote desktop is involved.

[Download releases](https://github.com/vedranius/creative-workspace/releases) · [Install](#installation) · [Screenshots](#screenshots) · [Changelog](CHANGELOG.md) · [Roadmap](docs/original-app-port-plan.md) · [License](LICENSE.md) · [Original projects](#original-projects-and-authors)

> **Current scope:** RapidRAW has an independently owned browser/server integration. All seven ArtCraft original interfaces have been built and browser-verified as previews. DesignCraft's bounded PAR-03 edit bridge sends `file.new` and pointer-created `frame.create` actions to the owned server worker, then displays its revisioned PNG over the original UI shell. The original local `DesignApp` still reports no open document; other tools/actions, provider ACK/recovery and full parity remain pending. **No complete server-backed original ArtCraft port is accepted yet.**

## What is new

- **Original interfaces from one studio:** registered PhotoCraft, VectorCraft, PdfCraft, DesignCraft, LightCraft, FilmCraft and EffectCraft launch on the studio's own origin at `/original/<app>/`. Invalid or missing packages stay unavailable. [Installation and browser evidence](docs/studio-original-uis.md).
- **FilmCraft MKV/WebM import fix:** a reviewed patch to the original media browser handles pending reads, duplicate requests, selection/bin changes, cancellation and metadata retry. Eight isolated browser cases passed; this is not a claim that every codec or video export works. [Fix and evidence](docs/filmcraft-mkv-import-handoff.md).
- **DesignCraft PAR-03 edit slice:** the original UI shell sends allowlisted `file.new` and serialized pointer-created `frame.create` actions to the owned native worker. Chromium verified revision 1→3, changed 612×792 server renders, and stale-revision, foreign-session and invalid-Origin rejection. The local `DesignApp` remains unsynchronized; other tools, providers, save ACK and recovery are pending. [Bridge scope and evidence](docs/designcraft-par03-sample-bridge.md).
- **Release foundations:** GitHub Actions builds Linux x64, Windows x64 and Apple Silicon macOS native-prototype bundles with an embedded Node 24 runtime, licenses, manifests, native smokes and checksums. FilmCraft and DesignCraft preview archives have separate build jobs. Alpha.15 adds an original DesignCraft edit bridge candidate; its Actions builds/assets are pending. Keep the release draft because original DesignApp state, provider and full parity are pending.
- **A visual project guide:** real screenshots of the studio and all eight applications, an original CW logo, installation instructions and explicit source/license attribution.

The latest verified **public** download is [v0.2.0-alpha.7](https://github.com/vedranius/creative-workspace/releases/tag/v0.2.0-alpha.7). Alpha.14's ten assets/checksums are verified in a **draft** release; alpha.15 is the current edit-bridge candidate pending Actions verification. Neither draft is a public download. Every new product feature/fix receives its own version and changelog; documentation-only updates retain the product version. [Release requirements and upgrade guide](docs/releases.md).

## Applications and current status

| Application | Creative purpose | Current integration |
| --- | --- | --- |
| **RapidRAW** | RAW development and photography | Owned browser/server adapter; identity-checked independent installation. Separate CLI install; not in portable bundles. |
| **PhotoCraft** | Images, layers, masks and retouching | Original UI preview verified. Original server/provider integration pending; limited native prototype also exists. |
| **VectorCraft** | Vectors, shapes, paths and illustration | Original UI preview verified. Original server/provider integration pending; limited native prototype also exists. |
| **PdfCraft** | PDF viewing, page organisation and annotation | Original UI preview verified. Original server/provider integration pending; limited native prototype also exists. |
| **DesignCraft** | Page layout, typography and publications | Original UI preview plus limited server `file.new`/`frame.create` render bridge verified. Original document state, full edit/save integration pending. |
| **LightCraft** | Photo library and RAW development | Original UI preview and separate native CPU/recipe groundwork. Original server/provider acceptance pending; not bundled. |
| **FilmCraft** | Video timeline, colour and audio | Original UI preview with reviewed MKV/WebM import fix. Server media/proxy/render/provider integration pending. |
| **EffectCraft** | Motion graphics, composition and VFX | Original UI/demo preview verified. Server/GPU/render/provider integration pending; headless GPU-worker limits documented. |

Purpose describes each upstream project, **not a promise that every upstream function is already supported here**. Screenshots show real original interfaces; launch/render evidence does not establish complete browser/native parity or file-save acceptance. [Acceptance plan for every app](docs/original-app-port-plan.md).

## How the workspace works

The **control panel** lists applications and their upstream authors, searches/filters the catalog, assigns a separate server folder per app, imports laptop files, browses/downloads server files, checks GitHub releases and exposes save recovery. Each creative application has its own managed engine and isolated document sessions where implemented. The existing user RapidRAW Web service is never reused or modified.

Original UI packages contain the original shared upstream Rust/egui interface and WASM, a pinned source identity, source licenses and asset hashes. The loader checks integrity and serves them on the same authenticated origin. FilmCraft and DesignCraft use explicitly recorded reviewed patch variants. Original UI and native engine revisions must be staged and verified together on future upgrades; updating one component alone does not establish compatibility.

The shared provider supplies selected-file metadata, ranges, caches and destination writes to accepted adapters. An engine that needs filesystem paths can use a session-scoped mount. This is file transport, not desktop transport. A document preview sent by an engine is permitted; the application controls remain native browser UI.

### Files on your laptop or server

| Working mode | What happens | Current scope |
| --- | --- | --- |
| **Server workspace** | Import selected files/folders first, then process the server copies. Originals remain on your laptop. | Portal import/download and implemented native adapters. |
| **Laptop on demand** | Keep originals locally; a connected browser agent supplies requested file ranges to the server. Opening one file can still require all its bytes. | Common provider and generated Linux native proofs; original ArtCraft UIs not connected yet. |
| **Hybrid** | On-demand reads take priority while remaining originals copy to the server in the background. | Limited prototype/provider flow; stress/reconnect acceptance pending. |
| **Copy first** | Transfer the selected folder before editing server copies. | Upload fallback works without a mount; prototype folder-sharing flow also exists. |

**Source mode, save destination and retention are separate choices.** A fetched original can be temporarily cached or retained. Save results to the server and download them, or to an explicitly permitted laptop folder where that adapter supports it. Laptop save success requires the browser's write acknowledgement. Uncertain outputs remain in a durable recovery journal; recovery downloads use separate `.recovered` copies. Automatic conflict-safe replay is still pending.

On-demand/hybrid require a compatible secure browser page, granted folder access and a suitable server helper. Chrome/Edge File System Access on HTTPS or localhost is the reference path. Linux FUSE has generated native evidence; Windows/WinFsp runtime acceptance is pending; macOS on-demand server mounts are unsupported. Ordinary file/folder upload remains the fallback. A disconnected laptop cannot supply uncached data. [Provider requirements and exact limits](docs/storage-modes.md).

**Import from laptop** accepts files, a folder, or file drag-and-drop; folder selection preserves the relative tree. Empty directories are not transferred. Uploads stream to temporary files and publish under new names without overwriting originals. Progress/cancel are available; completed files stay imported after a later cancellation. Default limit is 2 GiB per file (`MAX_UPLOAD_BYTES`); transfers are not resumable yet.

`Directory is outside WORKSPACE_ROOTS` refers to a **server** path. Use an allowed absolute server folder, the default workspace, or **Import from laptop** to choose files on the visiting computer. A laptop path cannot become a server path merely by entering its name.

### Updates and reliability

- GitHub stable release checks run manually and every 24 hours while the service is running. The panel distinguishes unchecked, released, no published release and check failure.
- An upstream release is labeled **adapter compatibility not verified**. Automatic installation, activation, rollback and tag-only tracking are pending.
- Root confinement, per-session isolation, Origin/auth checks and bounded payloads apply to the gateway. Non-loopback access requires authentication.
- Engine installers are currently administrator CLI tools. The control-panel install queue and importing arbitrary GitHub repositories are future adapter-based features.
- MCP/AI-assisted editing is planned; no MCP endpoint or subscription-based AI editor is implemented yet. [AI/MCP plan](docs/ai-assistant.md).

### Legacy native prototypes

These are genuine owned upstream engines behind **limited custom HTML interfaces**, retained for existing work. They do not fulfill the original-UI requirement. PhotoCraft covers brush/layers/adjustments/history and layered saves; PdfCraft covers server page rendering, rotate/move/delete, notes and PDF export; VectorCraft covers shapes/paths, position/colour, editable native and SVG/PDF/PNG output; DesignCraft covers text frames, typography, overset/reflow and native/PDF/PNG output. LightCraft has a separate CPU/recipe foundation but stays planned.

Native Linux and generated on-demand proofs exist for the four main prototypes, including selected-file reads, separate outputs and save acknowledgement. They are distinct from real user folder permissions, broad format compatibility and the acceptance of an original UI. [Detailed validation](docs/validation.md).

## Screenshots

Actual browser captures with demo/generated content. The ArtCraft screenshots below are **original upstream interfaces**, not the legacy HTML editors. [Capture provenance, pins and limitations](docs/screenshots.md).

### Creative Workspace studio

![Creative Workspace catalog with original application launchers](docs/evidence/readme/studio.png)

One home for eight creative projects, with original-author links and explicit implementation status. This isolated documentation instance uses demo folders; its native prototype engines are intentionally not started.

### Laptop import and server files

![Laptop file and folder import dialog](docs/evidence/readme/laptop-import.png)

![Application server file browser with a generated demo file](docs/evidence/readme/server-files.png)

### GitHub updates, settings and recovery

![GitHub release check panel showing actual unchecked states](docs/evidence/readme/updates.png)

![Server settings with explicit roots and installation scope](docs/evidence/readme/settings.png)

![Save recovery dialog, empty in this isolated demo](docs/evidence/readme/save-recovery.png)

### RapidRAW — CyberTimon / web adaptation by vedranius

![RapidRAW original web interface served through the owned adapter](docs/evidence/readme/rapidraw.png)

[Original RapidRAW](https://github.com/CyberTimon/RapidRAW) · [RapidRAW Web fork](https://github.com/vedranius/rapidraw-web) · [Independent engine installation](engines/rapidraw/README.md)

### PhotoCraft — ArtCraft / storytold

![PhotoCraft original browser interface with its upstream menus, tools and panels](docs/evidence/studio-original-ui/photocraft.png)

[Original project](https://github.com/storytold/photocraft) · [Original UI build and evidence](docs/photocraft-original-ui-preview.md). Browser-local preview; original server/provider integration pending.

### VectorCraft — ArtCraft / storytold

![VectorCraft original interface with document presets and tool panels](docs/evidence/vectorcraft-original-ui-canvas-edit.png)

[Original project](https://github.com/storytold/vectorcraft) · [Original UI build and evidence](docs/vectorcraft-original-ui-preview.md). Browser-local preview; original server/provider integration pending.

### PdfCraft — ArtCraft / storytold

![PdfCraft original interface with a demo PDF annotation](docs/evidence/pdfcraft-original-ui-annotation.png)

[Original project](https://github.com/storytold/pdfcraft) · [Original UI build and evidence](docs/pdfcraft-original-ui-preview.md). Browser-local preview; original server/provider integration pending.

### DesignCraft — ArtCraft / storytold

![DesignCraft original interface displaying the server-generated sample](docs/evidence/designcraft-par03-original-ui.png)

[Original project](https://github.com/storytold/designcraft) · [Server sample evidence](docs/designcraft-par03-sample-bridge.md). Only the sample command/render is server-bridged; general editing, read-model and acknowledged saves remain pending.

### LightCraft — ArtCraft / storytold

![LightCraft original Develop interface with a generated exposure adjustment](docs/evidence/lightcraft-original-ui-exposure-edit.png)

[Original project](https://github.com/storytold/lightcraft) · [Original UI build and evidence](docs/lightcraft-original-ui-preview.md). Browser-local preview; full server/provider acceptance and some optional font assets pending.

### FilmCraft — ArtCraft / storytold

![FilmCraft original demo timeline and program preview](docs/evidence/studio-original-ui/filmcraft.png)

[Original project](https://github.com/storytold/filmcraft) · [MKV import evidence](docs/filmcraft-mkv-import-handoff.md). Reviewed original-UI patch; server media/proxy/render/provider integration pending.

### EffectCraft — ArtCraft / storytold

![EffectCraft original demo composition and timeline](docs/evidence/studio-original-ui/effectcraft.png)

[Original project](https://github.com/storytold/effectcraft) · [Original UI build and GPU limitations](docs/effectcraft-original-ui-preview.md). A rendered demo does not establish complete GPU-worker or server-render acceptance.

## Installation

### Portable prototype downloads

1. Open [GitHub Releases](https://github.com/vedranius/creative-workspace/releases) and choose a **published** release. Read its scope and verify the SHA256 sidecar.
2. Extract into a writable folder. Run `start.cmd` on Windows, `start.command` on macOS or `./start.sh` on Linux.
3. Open [http://127.0.0.1:8788](http://127.0.0.1:8788). An occupied port fails startup; set a free `PORT` explicitly.

| Target | Requirements | Download scope |
| --- | --- | --- |
| Linux x64 | glibc 2.35+ | Node 24, gateway, four native prototype engines, licenses/manifests/checksums. |
| Windows x64 | Microsoft Visual C++ 2015–2022 x64 runtime | Same prototype scope; unsigned. |
| Apple Silicon macOS | macOS 14+ | Same prototype scope; unsigned. |

The four bundled engines are PhotoCraft, PdfCraft, VectorCraft and DesignCraft. **These public bundles do not contain the complete original ArtCraft suite, RapidRAW, LightCraft or a native mount helper.** Intel Mac and Linux/Windows ARM bundles are not offered. Original UI packages require separate registration. GitHub's automatically generated source archives are not ready-to-run bundles. [Detailed requirements, checksums and upgrade steps](docs/releases.md).

### Run the gateway from source

Requires Git and Node.js 24 or later. On Linux/macOS:

```sh
git clone https://github.com/vedranius/creative-workspace.git
cd creative-workspace
npm ci
mkdir -p workspaces/photography
npm start
```

On Windows PowerShell use `New-Item -ItemType Directory -Force workspaces/photography` instead of `mkdir -p`; the remaining commands are the same. Open [http://127.0.0.1:8788](http://127.0.0.1:8788). This starts the **control panel**. Install/register an application before expecting its launcher to be available.

State defaults to `data/`; allowed project roots default to this checkout's `workspaces/`. `DATA_DIR` changes the state location. `WORKSPACE_ROOTS` accepts absolute server roots separated by `:` on Linux/macOS or `;` on Windows. The panel can assign an app folder only inside those roots. Each app gets its own default folder when needed.

### Install owned engines and original interfaces

- **RapidRAW:** [independent Linux installer and launcher](engines/rapidraw/README.md), using `npm run engine:rapidraw:install` then `npm run engine:rapidraw:start`. This creates a separate managed engine; it never attaches to the user's existing RapidRAW Web.
- **Native prototypes:** `npm run engine:photocraft:install`, `npm run engine:pdfcraft:install`, `npm run engine:vectorcraft:install`, `npm run engine:designcraft:install`. See their `engines/<app>/README.md` for build dependencies and exact scope. LightCraft's separate foundation has its own [guide](engines/lightcraft/README.md).
- **Original ArtCraft UIs:** build the exact known upstream web pin into an independent static directory, then register it. Registration requires Git; serving an already registered package does not require Git. It checks source identity, licenses, manifests and asset hashes; it does not build arbitrary repositories automatically.

```sh
# PhotoCraft example: use the exact pin and build recipe in its preview guide.
npm run ui:install -- photocraft /path/to/pinned/photocraft /path/to/photocraft/static-output
```

Set `CW_ORIGINAL_UI_DIR` to the same registration root before starting the gateway; default is `DATA_DIR/original-ui`. FilmCraft and DesignCraft require their exact reviewed patch variants, not an unpatched arbitrary build. [Registration guide](docs/studio-original-uis.md) · [FilmCraft variant](docs/filmcraft-mkv-import-handoff.md) · [DesignCraft variant](docs/designcraft-par03-sample-bridge.md).

For a suitable Linux on-demand host, install the separate helper with `npm run storage:install`; read [host/browser requirements](engines/storage/README.md). This does not grant browser folder permission or complete original-UI provider integration.

### Docker Compose

```sh
cp .env.example .env
# Set WORKSPACE_AUTH=user:password in .env before starting.
mkdir -p workspaces/photography
docker compose up --build -d
```

Windows PowerShell: use `Copy-Item .env.example .env` and `New-Item -ItemType Directory -Force workspaces/photography`. The rest is the same. Open [http://127.0.0.1:8788](http://127.0.0.1:8788). The container sees the bind-mounted files at `/app/workspaces`; persistent state uses the `workspace-state` volume. Ensure its non-root user can read/write your project folders.

**Current Docker scope is the gateway only.** It does not bundle creative engines, original UI packages or FUSE. Engine-enabled Docker is planned. Compose binds localhost, drops capabilities and needs neither privileged mode nor a Docker socket.

### Access from anywhere and upgrade

Use HTTPS through a reverse proxy or a Cloudflare Tunnel/Access deployment. Set `WORKSPACE_AUTH=user:password`; authentication is mandatory when listening beyond loopback. Secure-context/browser folder permissions still apply. Cloudflare Access complements the gateway's authentication and root checks. Keep tokens/passwords in server environment configuration; the optional `GITHUB_TOKEN` is used only server-side for release checks.

Save documents before stopping the server. Back up `data/` and your project roots. Extract upgrades into a new directory, point `DATA_DIR`/`WORKSPACE_ROOTS` to the backed-up data, and reopen a known document before retiring the old installation. Do not replace a running bundle or reload an unsaved original UI. Automatic migration/rollback is pending.

## Original projects and authors

Creative Workspace by [vedranius](https://github.com/vedranius) integrates independent upstream projects. It is **not authored as a replacement for their creative applications** and is not presented as an official ArtCraft product. Their original names, UI and licenses are retained.

| Project / author | Original repository | Pinned revision | License at the recorded pin |
| --- | --- | --- | --- |
| RapidRAW — **CyberTimon** | [CyberTimon/RapidRAW](https://github.com/CyberTimon/RapidRAW) | Via the pinned web fork below | AGPL v3; retain original notices. |
| RapidRAW Web — **vedranius**, derived from CyberTimon/RapidRAW | [vedranius/rapidraw-web](https://github.com/vedranius/rapidraw-web) | `38ddc8af` | AGPL-3.0-only |
| PhotoCraft — **ArtCraft / storytold** | [storytold/photocraft](https://github.com/storytold/photocraft) | `29d5f791` | MIT OR Apache-2.0 |
| VectorCraft — **ArtCraft / storytold** | [storytold/vectorcraft](https://github.com/storytold/vectorcraft) | `96344f07` | MIT OR Apache-2.0 |
| PdfCraft — **ArtCraft / storytold** | [storytold/pdfcraft](https://github.com/storytold/pdfcraft) | `9ccf77bd` | MIT OR Apache-2.0 |
| DesignCraft — **ArtCraft / storytold** | [storytold/designcraft](https://github.com/storytold/designcraft) | `a127c6d5` | MIT OR Apache-2.0 |
| LightCraft — **ArtCraft / storytold** | [storytold/lightcraft](https://github.com/storytold/lightcraft) | `9e6c4c6f` | MIT OR Apache-2.0 |
| FilmCraft — **ArtCraft / storytold** | [storytold/filmcraft](https://github.com/storytold/filmcraft) | `4e2d0bc2` | MIT OR Apache-2.0 |
| EffectCraft — **ArtCraft / storytold** | [storytold/effectcraft](https://github.com/storytold/effectcraft) | `9a7d3e76` | MIT OR Apache-2.0 |

Explore [ArtCraft's application collection](https://getartcraft.com/apps) and the [storytold repositories](https://github.com/storytold). Source pins and workspace changes live in engine manifests, original UI manifests, `patches/` and the linked evidence guides. The shared file provider is explicitly derived from RapidRAW Web, with its source header and bundled AGPL text preserved.

**About forks and discovery:** this repository is an integration project, not a GitHub fork of all the listed repositories. GitHub fork ancestry connects a fork to one upstream repository; a multi-project integration cannot have seven simultaneous “forked from” parents. Attribution links identify every source here, but do not automatically create reverse links from their repos. The repository description and topics help GitHub search; upstream acknowledgement or inclusion in their directories requires their maintainers' participation. [GitHub's fork model](https://docs.github.com/en/pull-requests/reference/forks). [Repository description/topics setup](docs/github-discovery.md) records the proposed metadata and current administration-permission limitation.

## License and use

Creative Workspace is **AGPL-3.0-only**, with the full terms in [LICENSE](LICENSE) and a plain-language guide in [LICENSE.md](LICENSE.md). Personal, educational, business and commercial use are permitted; Creative Workspace adds no restriction on the purpose of use and charges no license fee. AGPL source/notice obligations still apply when distributing covered software or operating a modified network service. “Open” does not mean removing those obligations.

Included applications, libraries, fonts and assets retain their original authors' licenses; this repository does not relicense them. Dual-license `MIT OR Apache-2.0` means a choice between those terms for the relevant upstream code, subject to its notices and dependencies. Your own photos, videos, documents and ordinary creative outputs do not become AGPL merely because you use the software. Embedded third-party assets may carry separate terms. See the [license and attribution guide](LICENSE.md).

## Development and next steps

```sh
npm run check
npm test
npm run release:validate
```

Next: extend the original DesignCraft server read-model, commands and editing flow; connect common providers and acknowledged save/reopen; repeat for the other original apps; stage paired upstream updates; then accept complete Actions OS bundles and engine-enabled Docker. Control-panel installation jobs, multi-user permissions, resumable transfer, cache quotas and automatic conflict-safe recovery remain planned.

[Complete original-app plan](docs/original-app-port-plan.md) · [Roadmap](docs/roadmap.md) · [Architecture](docs/architecture.md) · [Adapter contract](docs/adapter-contract.md) · [Validation](docs/validation.md) · [Development handoff](docs/development-state.md) · [AI/MCP plan](docs/ai-assistant.md)
