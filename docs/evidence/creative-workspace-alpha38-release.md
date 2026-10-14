# Creative Workspace 0.2.0-alpha.38 evidence

- Commit: `e2e7c405e68c0f3c7f951d705a1eab5d39107294`.
- Immutable tag: [`v0.2.0-alpha.38`](https://github.com/vedranius/creative-workspace/releases/tag/untagged-8219da30a23a69214540), points to the commit above.
- Checks: [38603273789](https://github.com/vedranius/creative-workspace/actions/runs/38603273789) — passed.
- Build/release: [38603273617](https://github.com/vedranius/creative-workspace/actions/runs/38603273617) — passed, including all native targets, Linux/macOS/Windows bundles, the exact pinned DesignCraft build and browser checks, and publish.
- Release is a draft prerelease. The full release has not been accepted as an available DesignCraft port.
- Downloaded all 12 release assets (six archives and six `.sha256` files); all six archive hashes matched their sidecars. Asset digests are listed below.
- Actions browser report and screenshots: [run artifact `designcraft-par03-browser-evidence`](https://github.com/vedranius/creative-workspace/actions/runs/38603273617/artifacts/11917269077).

The registered original DesignApp proof reached the owned server worker. `file.new` created an A4 document at state version 1 with a 595×842 render. The Type Tool proof ACKed `text.placeCaret` at revision 4, then seven sequential `text.insert` operations through revision 11; the typed text was in the server snapshot, the server render updated, and the browser reported no errors. The provider proof used the original Open and Save a Copy commands in laptop on-demand mode: provider read was acknowledged before native open, edit/Undo restored the opened snapshot, server and laptop Save a Copy destinations returned write ACK, and the laptop output reopened through the provider without overwriting an existing target.

The File System Access folder handle was mocked. This run does not prove a real browser permission grant or uncertain-output recovery; other retention modes and full original tool/action parity are also pending. Keep DesignCraft planned and the release draft-only.

## Actions archive SHA-256

| Actions-built archive | SHA-256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.38-darwin-arm64.tar.gz` | `fc861b0608b5e63934005097d3405a736a9c781974ffce90f835ef7a30126cc8` |
| `creative-workspace-0.2.0-alpha.38-designcraft-host-canvas-candidate.tar.gz` | `21477bc4d814b49817981ccdf66e185aa2eaaa7d78e609bec869d28825eb3ad3` |
| `creative-workspace-0.2.0-alpha.38-designcraft-par03-preview.tar.gz` | `4b7793cf37d394c1467ced36ff77ef44191e515a8d1c0ed28c831669faad6fe4` |
| `creative-workspace-0.2.0-alpha.38-filmcraft-original-ui.tar.gz` | `59f7339030441a9e4e499a14fca622f5e6a35c077242447ce36949a4696d6a45` |
| `creative-workspace-0.2.0-alpha.38-linux-x64.tar.gz` | `2c17b8be547f0fa474d68f3324586b148423a989f3a9b00e8a61840655d75945` |
| `creative-workspace-0.2.0-alpha.38-win32-x64.zip` | `1ece4c66f2b534b6d0603fe51f1f3fddf654b3fa78deeab78eb35318996e2366` |
