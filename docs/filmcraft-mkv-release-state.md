# FIL-MKV-01 publication and local runtime

2026-10-11. **0.2.0-alpha.10** is verified and remains a GitHub draft/prerelease. Commit `6481512ae825ecab09dfa5a9ff731b54ecbe2574`; immutable tag `v0.2.0-alpha.10` points to that exact commit. The prior alpha.8 draft/tag remains untouched.

[Checks 38166022656](https://github.com/vedranius/creative-workspace/actions/runs/38166022656) and [Build and release 38166022700](https://github.com/vedranius/creative-workspace/actions/runs/38166022700) passed. The release was independently downloaded and verified: all eight assets and SHA256 sidecars match their GitHub asset sizes/digests; Linux x64, Windows x64 and macOS arm64 bundles contain their target manifests, Node 24 runtime, pinned native engines and successful startup/open/edit/save/reopen smoke evidence. The separate FilmCraft preview archive matches its upstream pin and all listed payload hashes. The original browser artifact reports eight passing cases and no uncaught errors. See [Alpha.10 verification evidence](evidence/filmcraft-mkv-alpha10-release.md). Alpha.9's failed exact patch registration remains historical; Alpha.10 canonicalizes the Git diff while preserving exact pin/diff/SHA checks.

Verified release: draft/prerelease `v0.2.0-alpha.10`, four archives (Linux x64, Windows x64, macOS arm64 native **prototype** bundles and separate original FilmCraft **browser-local** preview) and four SHA256 sidecars. All seven original app server/provider/full parity and original OS bundle acceptance remain incomplete; keep draft.

## Development host evidence

The protected alpha.9 persistent studio [8794](http://127.0.0.1:8794/) has a separate state/package root. Health reports alpha.9; all seven original package hashes/identity checks and launch responses pass. Browser verified seven original links and actual one-item synthetic MKV import through the original FilmCraft engine/UI with no uncaught exceptions. Gateway RapidRAW status is `ready:true, ownedRuntime:true`. [Host report](evidence/filmcraft-mkv/host-candidate.json), [original UI screenshot](evidence/filmcraft-mkv/host-candidate.png). The eight deferred-read regressions are separate from this persistent-host smoke, and neither establishes real user picker permission/full media compatibility.

Previous original studio 8793 and legacy 8792 were preserved, including their browser documents. Existing source preview ports and the user's separate RapidRAW 8780 were not changed. Main's known DesignCraft PAR-03 WIP and unrelated untracked FilmCraft adapter files were preserved byte-for-byte where unaffected; package syntax checks combine existing WIP with new Film scripts. The implementation commit excludes that WIP.

Alpha.10 packaging regression checks: 43 Node tests, syntax/release/diff/YAML validation; identical full/shallow upstream source diff; actual shallow-source UI registration with existing same-source WASM assets. Engine/UI behavior is unchanged from the eight passing original browser gates.

Next after alpha.10 CI/asset verification: implement DesignCraft PAR-03 original UI server-owned Session/read-model/render bridge from the preserved sample slice. Scheduled continuation is active and checks the actual owner before any work. Do not duplicate a live writer or repeat completed UI audits as progress.
