# DesignCraft PAR-03 original Redo candidate evidence

Date: 2026-10-13. This is an isolated, unregistered candidate on the pinned upstream DesignCraft commit `a127c6d5c3576972bbd60445f26d893db071eef3`.

- Reviewed Undo/Redo patch: [`par-03-frame-create-undo-candidate.patch`](../../patches/designcraft/a127c6d5/par-03-frame-create-undo-candidate.patch), SHA256 `989646f3a0e4ab2dcfbaeb7b0c424356f9647dc75ab196ea854e63f18eb632bf`.
- The Actions-built cumulative Open/Save Copy candidate also carries Redo in [`par-03-save-copy-candidate.patch`](../../patches/designcraft/a127c6d5/par-03-save-copy-candidate.patch), SHA256 `c2d268cf6ab89a811215a119df68132ff9608e55e5f72ddf1eb1301359caa555`, recorded by the [host-canvas manifest](../../engines/original-ui/designcraft/host-canvas.json).
- Manifest: [`frame-create-undo-candidate.json`](../../engines/original-ui/designcraft/frame-create-undo-candidate.json).
- Native test: `cargo test -p designcraft-engine server_mirror_stages_redo_without_mutating_local_document` passed 1/1 using `low-impact-build.py` (one job, at most two CPUs, nice 10).
- Optimized pinned-source WASM build passed with the same wrapper. Output SHA256: `6336f0d9d6da5ab2148415979aaf2401f7d9c074b3418bef1877435ba22b114a`.
- Chromium report: [`designcraft-par03-redo-browser.json`](designcraft-par03-redo-browser.json); [screenshot](designcraft-par03-redo-browser.png).

The original A4 preset, Rectangle Tool drag, Undo, Redo, and Undo actions reached the owned server worker as `file.new`, `frame.create`, `edit.undo`, `edit.redo`, and `edit.undo` at revisions 1–5. Redo restored the canonical edited snapshot and server-render change; the final Undo restored the original A4 snapshot and render. The browser also confirmed unbridged commands stay blocked, a failed preview does not hydrate the UI mirror, and no uncaught browser errors occurred. The 6,873-byte canonical snapshot hydrated only after ACK; the visible original canvas contained the server-rendered 595×842 PNG.

The first browser run caught a missing queue-level Redo allowlist; after fixing and rebuilding, the exact workflow passed. Actions initially exposed that its combined host-canvas build still used the older Undo-only patch; that cumulative patch now carries the same Redo ACK path. This evidence does not establish laptop folder permission, provider write ACK, save/reopen recovery, full command/tool parity, or DesignCraft availability. Keep the candidate unregistered and the alpha release draft.
