# DesignCraft PAR-03 original Redo candidate evidence

Date: 2026-10-13. This is an isolated, unregistered candidate on the pinned upstream DesignCraft commit `a127c6d5c3576972bbd60445f26d893db071eef3`.

- Reviewed patch: [`par-03-frame-create-undo-candidate.patch`](../../patches/designcraft/a127c6d5/par-03-frame-create-undo-candidate.patch), SHA256 `2844846f0e72755347a76a3679ad0fddb45851b66e8ed0a97ca982ff4f0586ba`.
- Manifest: [`frame-create-undo-candidate.json`](../../engines/original-ui/designcraft/frame-create-undo-candidate.json).
- Native test: `cargo test -p designcraft-engine server_mirror_stages_redo_without_mutating_local_document` passed 1/1 using `low-impact-build.py` (one job, at most two CPUs, nice 10).
- Optimized pinned-source WASM build passed with the same wrapper. Output SHA256: `6336f0d9d6da5ab2148415979aaf2401f7d9c074b3418bef1877435ba22b114a`.
- Chromium report: [`designcraft-par03-redo-browser.json`](designcraft-par03-redo-browser.json); [screenshot](designcraft-par03-redo-browser.png).

The original A4 preset, Rectangle Tool drag, Undo, Redo, and Undo actions reached the owned server worker as `file.new`, `frame.create`, `edit.undo`, `edit.redo`, and `edit.undo` at revisions 1–5. Redo restored the canonical edited snapshot and server-render change; the final Undo restored the original A4 snapshot and render. The browser also confirmed unbridged commands stay blocked, a failed preview does not hydrate the UI mirror, and no uncaught browser errors occurred. The 6,873-byte canonical snapshot hydrated only after ACK; the visible original canvas contained the server-rendered 595×842 PNG.

The first browser run caught a missing queue-level Redo allowlist; after fixing and rebuilding, the exact workflow passed. This evidence does not establish laptop folder permission, provider write ACK, save/reopen recovery, full command/tool parity, or DesignCraft availability. Keep the candidate unregistered and the alpha release draft.
