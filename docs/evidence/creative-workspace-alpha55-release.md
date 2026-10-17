# Creative Workspace 0.2.0-alpha.55 draft verification

Authenticated as `vedranius`. [Checks run `39023934892`](https://github.com/vedranius/creative-workspace/actions/runs/39023934892) and [Build/release run `39023934919`](https://github.com/vedranius/creative-workspace/actions/runs/39023934919) passed for commit `1b2ca33c30f7cd1c36728c714f52216c63e53021`. The immutable `v0.2.0-alpha.55` tag resolves to that commit. GitHub Actions created the alpha prerelease as a draft.

The release contains 12 Actions-built archives and 12 `.sha256` sidecars: three platform bundles plus original-UI and DesignCraft candidate packages. All 24 downloaded files match their GitHub asset SHA-256 digests, and all 12 archive/sidecar pairs pass checksum verification. The release remains a draft while original-app and provider acceptance is incomplete. [Draft release](https://github.com/vedranius/creative-workspace/releases/tag/untagged-5ea0c48e1b9ea4d7a955).

The clean `original-designcraft` Actions job passed its exact-pin build, original action/browser sequence, and preset/server-canvas candidate. Its [uploaded browser artifact](https://github.com/vedranius/creative-workspace/actions/runs/39023934919) `designcraft-par03-browser-evidence` reports:

- Original `file.new`, `frame.create`, `edit.selectAll`, and `edit.deselectAll` reached matching worker ACKs at revisions 1–4 and presented the server render.
- Original Text Tool Backspace reached `text.delete` at revision 9, changed `INK` to `IN`, updated the server render, and produced no browser errors.
- Original Open → edit → Undo → File → Save a Copy → reopen passed for both server and laptop-on-demand destinations. The laptop copy received a browser write ACK and reopened through the provider; the active source remained dirty/name-stable and existing targets were not overwritten.
- The separate Save a Copy failure smoke injected a destination close error. It produced no laptop success ACK, preserved the dirty `chosen.designcraft` at revision 5, exposed a 2,955-byte recovery output (SHA-256 `140eb439cf5f1376b5aa67b471733bad20584279e85b52ea9f459d72e5240f35`), and refused the same-target retry with HTTP 409.

The browser folder handle and close failure are test fixtures. These results do not prove real OS folder-picker permission, unsupported retention modes, full original-app parity, or availability. Keep DesignCraft planned and the alpha release draft-only. Preserve protected studio 8795/RapidRAW 8791 and user RapidRAW 8780.
