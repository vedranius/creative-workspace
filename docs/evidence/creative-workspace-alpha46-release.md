# Creative Workspace 0.2.0-alpha.46 release evidence

- Product source: `8a47d7f48fece46a05d9736b11c79cc8e6a4b887` (`feat: add original FigCraft preview`).
- Checks: run `38832882522` passed on the three supported CI platforms.
- Build/release: run `38832882686` completed successfully; its FigCraft exact-pin build and original browser archive upload succeeded along with the existing platform jobs.
- Immutable tag: `v0.2.0-alpha.46` resolves to `8a47d7f48fece46a05d9736b11c79cc8e6a4b887`.
- Release: [alpha.46 prerelease draft](https://github.com/vedranius/creative-workspace/releases/tag/untagged-2fb6e32771789a956010). It intentionally remains a draft while full original UI, server processing, provider, save/reopen/recovery, browser and platform acceptance remains incomplete.
- Assets: 11 Actions-built archives and 11 `.sha256` sidecars (22 assets). All were downloaded afresh from the draft into a clean directory and verified with `sha256sum -c`; all 11 pairs passed. This confirms archive integrity, not application bundle acceptance.
- FigCraft preview: original UI and Frame tool were browser-verified, but processing is browser WASM and upstream browser open/save is not wired. FigCraft remains planned; see [preview evidence](../figcraft-original-ui-preview.md).

No release publication or availability claim is made.
