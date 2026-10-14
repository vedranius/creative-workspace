# Creative Workspace 0.2.0-alpha.37 evidence

- Commit: `ba2d7154117c6db05e5f5d36c81254ccdd3dc0fe`
- Immutable tag: `v0.2.0-alpha.37`
- Checks: [38581450259](https://github.com/vedranius/creative-workspace/actions/runs/38581450259) — passed.
- Build/release: [38581450222](https://github.com/vedranius/creative-workspace/actions/runs/38581450222) — passed, including pinned original UI build, native/browser checks and release checksum gate.
- Release: [v0.2.0-alpha.37 draft](https://github.com/vedranius/creative-workspace/releases/tag/untagged-0800b8e1117a0b7bb336) — draft prerelease, as required by `release/config.json`.
- Downloaded all six archives and ran `sha256sum -c *.sha256`; all six matched.
- Browser evidence: [DesignCraft PAR-03 report](designcraft-par03-alpha37-browser.json). Original `file.new` and Type Tool ACKs reached the owned worker. The separate provider candidate verified Open, edit/Undo and server/laptop Save a Copy ACK/reopen. The File System Access handle is mocked, so this does not establish a real browser permission grant or uncertain-output recovery. Keep DesignCraft planned; this is not full original-app parity.

## Actions archive SHA-256

| Actions-built archive | SHA-256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.37-darwin-arm64.tar.gz` | `bae9d8030e1eb873d53201c19220ad300979d8324eee0596e2c2d4516403677f` |
| `creative-workspace-0.2.0-alpha.37-designcraft-host-canvas-candidate.tar.gz` | `aae71808c1e2ae86558d54d98877791f035a37722ed2fc3c547eb226ec0c2926` |
| `creative-workspace-0.2.0-alpha.37-designcraft-par03-preview.tar.gz` | `4d2415aaa60fb036539d0fe819b3a9d6358b4e2b17b32e38c20c66e753b3ee56` |
| `creative-workspace-0.2.0-alpha.37-filmcraft-original-ui.tar.gz` | `2e49aabc39ee8f1cf1067dc2665bc66b0b1fa963ec5ea621ea39f91432753f41` |
| `creative-workspace-0.2.0-alpha.37-linux-x64.tar.gz` | `a1258615de39c09f702d75eca2f180d1049a0b2d125323c4ddcc67949182191e` |
| `creative-workspace-0.2.0-alpha.37-win32-x64.zip` | `96ae9553f4e3ef9583d6effc23dc7eaae738f136a9b6c3f6454168800490b3ac` |
