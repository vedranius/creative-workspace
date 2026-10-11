# FIL-MKV-01 publication and local runtime

2026-10-11. Product release candidate **0.2.0-alpha.10**, feature commit `1348d4b62aba016e498b654bd5745975f549768b`, normally pushed to `vedranius/creative-workspace` after verifying account `vedranius`, remote versions and existing assets. The prior alpha.8 draft/tag is untouched.

[Checks 38164623935](https://github.com/vedranius/creative-workspace/actions/runs/38164623935) passed. [Build and release 38164623715](https://github.com/vedranius/creative-workspace/actions/runs/38164623715) **failed at exact source patch registration after successful WASM compilation**. All 12 native builds and three target bundle startup/open/edit/save/reopen/archive smokes passed. Shallow Git generated seven-digit diff IDs; the full local repository generated eight. The identical source changes were rejected. No alpha.9 release/tag was created. Alpha.10 uses explicit full IDs/prefixes/context/algorithm, with full/shallow source equality and Git-format regression evidence, preserving exact pin/diff/SHA checks. Its Actions run must be verified separately.

Expected successful release: draft/prerelease `v0.2.0-alpha.10`, four archives (Linux x64, Windows x64, macOS arm64 native **prototype** bundles and separate original FilmCraft **browser-local** preview) and four SHA256 sidecars. Verify both workflow conclusion and the actual eight uploaded assets/checksums. All seven original app server/provider/full parity and original OS bundle acceptance remain incomplete; keep draft.

## Development host evidence

The protected alpha.9 persistent studio [8794](http://127.0.0.1:8794/) has a separate state/package root. Health reports alpha.9; all seven original package hashes/identity checks and launch responses pass. Browser verified seven original links and actual one-item synthetic MKV import through the original FilmCraft engine/UI with no uncaught exceptions. Gateway RapidRAW status is `ready:true, ownedRuntime:true`. [Host report](evidence/filmcraft-mkv/host-candidate.json), [original UI screenshot](evidence/filmcraft-mkv/host-candidate.png). The eight deferred-read regressions are separate from this persistent-host smoke, and neither establishes real user picker permission/full media compatibility.

Previous original studio 8793 and legacy 8792 were preserved, including their browser documents. Existing source preview ports and the user's separate RapidRAW 8780 were not changed. Main's known DesignCraft PAR-03 WIP and unrelated untracked FilmCraft adapter files were preserved byte-for-byte where unaffected; package syntax checks combine existing WIP with new Film scripts. The implementation commit excludes that WIP.

Alpha.10 packaging regression checks: 43 Node tests, syntax/release/diff/YAML validation; identical full/shallow upstream source diff; actual shallow-source UI registration with existing same-source WASM assets. Engine/UI behavior is unchanged from the eight passing original browser gates.

Next after alpha.10 CI/asset verification: implement DesignCraft PAR-03 original UI server-owned Session/read-model/render bridge from the preserved sample slice. Scheduled continuation is active and checks the actual owner before any work. Do not duplicate a live writer or repeat completed UI audits as progress.
