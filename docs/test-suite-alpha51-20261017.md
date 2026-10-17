# Local test suite — alpha.51, 17 October 2026

The running loopback studio is **http://127.0.0.1:8795/**. It is an isolated, frozen alpha.51 snapshot, separate from ongoing development and the user's own RapidRAW on port 8780. It uses a new data/workspace/package root; existing user documents/services were not restarted. It stays running after the QA browser closes, while this computer is on. It is not installed as an automatic boot service or exposed to the internet.

## Available to try

- **RapidRAW:** independent workspace-owned server engine on 8791, proxied by the studio. Runtime identity and `load_settings` health passed, and the actual browser UI opened. Single shared editing session. The user's separate service on 8780 remains untouched.
- **Twelve original ArtCraft browser previews:** PhotoCraft, VectorCraft, PdfCraft, LightCraft, FilmCraft, EffectCraft, WordCraft, GridCraft, DeckCraft, CADCraft, FigCraft and SoundCraft. Original upstream menus/panels/tools are retained. Document editing/rendering runs in browser WASM for these previews; a weak laptop still performs that work. These are not accepted server-backed adapters.
- **DesignCraft is excluded:** no registered package/launch link in this test root. Its ongoing server action/provider work and alpha.52 release candidate are separate. The catalog may still show its unavailable entry.

The complete suite with server-side processing for every ArtCraft application is not finished. Original preview interfaces exist for all 13; RapidRAW has its independent server adapter; DesignCraft is a partial server integration; the other twelve ArtCraft server/provider ports remain pending. No completion percentage or dependable final date is established by UI builds.

## Testing your files

1. Open the studio and select **Open original …** or **Open RapidRAW editor**.
2. Inside an original ArtCraft app, use its **File → Open / Import** browser chooser where implemented. Start with a copy of a small representative file. Use that app's original Save/Export/download flow and verify the downloaded result by reopening it.
3. RapidRAW's **Add Folder / Files** controls provide its existing file-provider workflow. This is the independently managed runtime, with a separate test workspace.
4. Panel uploads create server copies under this snapshot's per-app workspace. The original ArtCraft previews do not yet consume the common server/on-demand/hybrid provider. Server copying alone does not establish opening or acknowledged saving in those original interfaces.

The test server's allowed server root is its own `workspaces` directory, listed in `/api/settings` and the Server Folder dialog. A directory outside that root is deliberately rejected. Laptop browser file selection does not require entering an arbitrary server directory.

## Known scope limits

- FigCraft starts with a blank design and supports the original design UI; the pinned upstream web host does not wire file open/save or the PNG download action. Do not rely on it to retain work.
- WordCraft and GridCraft previously passed browser edit/download/reopen flows. A browser download or synthetic chooser is not proof of real folder permissions or destination write acknowledgement.
- FilmCraft keeps the reviewed pending MKV/WebM read fix. Codec support, large media and server decoding/proxy/rendering are not broadly accepted.
- EffectCraft's headless GPU worker limits, LightCraft's optional CJK font, SoundCraft audio/microphone/latency and broad cross-browser/format support retain their existing documented limitations.
- This new verification checks launch/render only. It does not newly establish full open/edit/save/reopen, folder permissions, write ACK/recovery, original tool parity or target OS acceptance for twelve apps.

## Deployment and evidence

Source snapshot: Actions-built Linux prototype bundle and seven original UI archives from immutable `v0.2.0-alpha.51`, source `560e997291fab253049ab3f13a27399290d57312`; archive SHA256 sidecars were rechecked before staging. Five earlier unchanged exact-pin original UI packages were copied from the existing owned registry. The registry revalidated all twelve installed packages; DesignCraft remains unavailable. Native limited-prototype binaries are disabled in this portal so their old replacement interfaces are not presented as original apps. No creative engine was rebuilt.

[Fresh browser report](evidence/test-suite-alpha51-20261017/browser.json) records thirteen launch links (12 original ArtCraft previews plus RapidRAW), the missing DesignCraft launch, owned RapidRAW identity, twelve original canvas loads, zero uncaught page errors and nonuniform screenshot pixels. Checks used one disposable Chromium context with WebGL/SwiftShader and closed it afterward; screenshots: [studio](evidence/test-suite-alpha51-20261017/studio.png), [RapidRAW](evidence/test-suite-alpha51-20261017/rapidraw.png), [WordCraft](evidence/test-suite-alpha51-20261017/wordcraft.png). Browser launch flags and `?webgl`/sample queries are recorded in the report; [Bare dashboard URL smoke](evidence/test-suite-alpha51-20261017/default-launches.json) also passed for all twelve apps without uncaught page errors.

Host-specific runtime path, process IDs, restart entry and logs are stored in the private coordinator handoff. Future development must not replace this snapshot, its UI packages, workspace or active RapidRAW session while user documents are open. Current alpha.52 GitHub Actions permission/release blocker remains separate and unchanged; this test deployment does not publish a new product release.
