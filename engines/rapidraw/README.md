# Workspace-owned RapidRAW engine

This adapter builds its own RapidRAW backend from a pinned upstream source commit. It never attaches to an existing RapidRAW Web installation.

The native engine has a distinct application identifier, binary name, loopback port, data directory, configuration, cache and photo workspace. Runtime IPC identity must match `creative-workspace-rapidraw-v1` before the gateway exposes it as ready. The original application's port 8780 is not used.

On Linux, install the Rust and Node.js toolchains and RapidRAW's build dependencies (GTK3, WebKitGTK 4.1, libsoup3, OpenSSL/pkg-config), plus Xvfb and fuse3. Then:

```sh
npm ci
node scripts/manage-rapidraw.mjs install
node scripts/manage-rapidraw.mjs start
```

The installer clones into this project's ignored `data/engines/rapidraw/source`, builds a separately identified bridge, and compiles a separate FUSE helper. `CW_RUNTIME_DIR` can place all engine state elsewhere. `CW_RAPIDRAW_WORKSPACE` chooses the engine's server photo directory. The user-facing control panel is still started separately with `npm start`.

The gateway serves `/apps/rapidraw/` and proxies RapidRAW IPC/file-sharing endpoints. A running engine appears with an **Open RapidRAW editor** button. The current adapter permits one shared editing session; per-user engine isolation is not implemented yet. RapidRAW's own Files → This computer offers transfer/on-demand local folder workflows in supported browsers. They are not yet a universal ArtCraft file provider.

The backend/source is AGPL-3.0-only; source, pinned revision and all adapter modifications are available through the installer and manifest. Original author: CyberTimon/Timon Käch. Web adaptation: vedranius. Workspace integration and isolation are tracked in this repository.

Docker engine packaging and Windows/macOS managed installers are pending; the control-panel Docker image alone does not contain this Rust engine.

The managed frontend skips upstream cloud sign-in and standalone update polling. Workspace authentication and the central release checker remain authoritative. Optional upstream cloud features are unavailable in this self-hosted build.
