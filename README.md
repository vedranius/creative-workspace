# Creative Workspace

A self-hosted creative studio: native browser interfaces, server-side processing, and shared project files. No remote desktop or desktop-display transport.

**Status: development foundation, not a finished creative suite.** This milestone implements a real control-panel service. It does not yet install or launch engines, and it does not claim ArtCraft's existing browser builds perform processing on the server.

## Implemented

- Responsive application catalog for RapidRAW and seven ArtCraft creative apps.
- Persistent per-application server workspace configuration.
- Read-only file browser restricted to configured roots, including symlink checks.
- GitHub latest stable release checks, manually and every 24 hours while running.
- Distinct unchecked, upstream release, no release, and check failure states.
- Upstream releases explicitly marked as not yet verified for adapter compatibility.
- Optional HTTP Basic authentication; required when listening beyond loopback.
- Docker Compose packaging and cross-platform Node test workflow.

## Run locally

Requires Node.js 24 or later. There are no npm dependencies to install.

```sh
mkdir -p workspaces/photography
npm start
```

Open http://127.0.0.1:8788. Assign the **absolute** path of `workspaces/photography` to an application. The default allowed root is this checkout's `workspaces` directory.

For other server directories, set `WORKSPACE_ROOTS` to a platform-delimited list (colon on Linux/macOS, semicolon on Windows). Set `DATA_DIR` to change the persistent state location. Use `WORKSPACE_AUTH=user:password` and TLS for network access. `GITHUB_TOKEN` is optional and only used server-side for release checks.

## Docker

```sh
cp .env.example .env
# Edit .env and replace the example password.
mkdir -p workspaces/photography
docker compose up --build -d
```

Open http://127.0.0.1:8788. The container sees the workspace at `/app/workspaces/photography`. Files are mounted read-only for this browsing milestone. Ensure the container's non-root user can read your directories. No Docker socket or privileged container is needed.

## Checks

```sh
npm run check
npm test
```

## Next milestones

1. RapidRAW service integration, with engine-session isolation and authenticated routing.
2. PhotoCraft proof: server document open → browser edit → server preview → server save.
3. Shared adapter protocol and extension to PdfCraft, VectorCraft and DesignCraft.
4. FilmCraft and EffectCraft: server preview jobs, proxy media, synchronized playback and exports.
5. Multi-user identity, permissions, resumable file transfer, installation and verified upgrades.

See [architecture](docs/architecture.md), [adapter contract](docs/adapter-contract.md) and [validation](docs/validation.md).

## Known limits

Single-user only. No upload, delete or editing in the file browser yet. No installed-version detection, tag fallback, engine installation, rollback or ArtCraft server adapters. A 404 from GitHub's release endpoint is reported as no published release; repository deletion or access changes need separate future checks. Upstream release notes are displayed as plain text. Scheduled checks need the service to remain running. Filesystem permissions remain the final authority; do not allow unrelated processes to replace workspace symlinks while browsing. Windows/macOS runtime behavior requires verification on those hosts.
