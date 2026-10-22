# Public browser-processing playground

This independent static demo of thirteen original ArtCraft interfaces runs while the development computer is off. **The visitor's CPU, GPU and RAM perform editing, decoding, rendering and export inside the browser.** This explicitly labelled alternative demo mode preserves the Creative Workspace goal: server processing with original browser interfaces.

Each app requires an acknowledgement before its original iframe loads and retains a browser-mode label. The original editor UI and decoded WASM bytes are preserved. The portal uses Creative Workspace branding, links upstream repositories, retains licenses/provenance and makes no endorsement claim. Content Security Policy restricts connections to this same origin and browser-local blobs. There is no document-upload backend, analytics, private-server credential or local-studio tunnel. Save/download work before leaving. Browser storage and file permissions depend on the upstream app/browser; the demo makes no common-provider/on-demand/server-save claim.

RapidRAW requires an owned backend and is excluded. DesignCraft uses its official browser release here; the separate server candidate remains in development. Large media may overwhelm a weak laptop; broad format, audio and export parity remain unverified. This is a UI playground, not a fully accepted suite. There is no enforced 5–10 minute limit: browser computation uses no shared editing-server session, and an honest hard cutoff requires another service design.

## Official release updates (alpha.63)

The current demo uses the **official published web ZIP assets** from the fixed thirteen `storytold/<app>` repositories in `cloudflare/artcraft-releases.json`. Server engine/UI pins in `src/original-ui.js` remain independent: their reviewed server integration patches require separate compatibility work. No desktop binary or upstream build script is executed to update the demo. Each release records its tag, resolved source commit, release ID, asset name, size and GitHub SHA-256; downloading also checks the published `SHA256SUMS.txt`. ZIP entry count, expanded size, traversal, duplicate paths, symlinks and static file types are bounded. Upstream `_headers`/`.htaccess` are excluded; the demo owns its CSP and no Functions/backend is deployed. Licenses/NOTICE/OFL files remain with each app. An empty optional PhotoCraft served-font catalogue prevents a 404; upstream UI and built-in fonts remain unchanged.

[Update ArtCraft browser demo](../.github/workflows/artcraft-demo.yaml) checks every hour at minute17 (GitHub may delay scheduled runs), and supports manual runs. This repository cannot directly subscribe to another owner's release events, so it polls their published **stable** releases. The known-broken DeckCraft v0.9.0 (also reproduced in v0.8.0) is held in `cloudflare/artcraft-demo-policy.json` because its official WASM calls unsupported `std::process::id()` at startup. The demo uses its verified v0.7.0 release and displays the reason; the next stable tag is tested automatically. Any missing web ZIP/checksum, changed same-tag release, downgrade, invalid archive or failed browser gate stops the update and keeps the previous production deployment. The supported repository allowlist is explicit; new apps or prereleases require review. The browser gate checks all13 launches, consent, isolation, WASM and PhotoCraft part hashes, and failed/external requests. These are launch/transport checks, not full edit/save acceptance. Verification has no Cloudflare credential; only the separate upload job receives it. The workflow has read-only GitHub contents permission and does not commit upstream code.

One-time GitHub setup: add an Actions secret named `CLOUDFLARE_API_TOKEN`, either at repository scope or in environment `artcraft-demo`. Create a scoped Cloudflare API token with **Account → Cloudflare Pages → Edit**, restricted to account `37be952dfe8d74601e1af8bad125debb`. The existing local OAuth login is sufficient for this one-off publication but must not be copied into CI. The current GitHub PAT returns403 for secrets administration, so unattended publishing cannot be claimed until a workflow succeeds with the secret. Set it directly in GitHub; do not paste the token in chat or commit it.

```sh
python3 scripts/artcraft-demo-releases.py discover build/release-lock.json --current https://creative-workspace-demo.pages.dev/demo-manifest.json
python3 scripts/artcraft-demo-releases.py stage build/release-lock.json build/release-downloads build/release-registry
node scripts/build-cloudflare-demo.mjs build/release-registry build/cloudflare-demo build/release-lock.json
node scripts/verify-cloudflare-demo.mjs build/cloudflare-demo build/demo-proof
```

WASM larger than Pages' per-file limit uses ordered20MiB gzip parts, decoded into the exact original bytes by the allowlisted Service Worker. PhotoCraft's own official boot/parts loader remains intact. Returning visitors wait for the updated transport to activate before launch; documents are never intercepted or stored by it. Current acceptance/public deployment and continuation are recorded in [the handoff](cloudflare-demo-handoff.md).

## Build and publish

Version: `0.2.0-alpha.63`, prototype/prerelease candidate. Sources: `cloudflare/demo/` and `scripts/build-cloudflare-demo.mjs`. Use an **empty output directory** and a verified original-UI registry containing the twelve reviewed packages. No engine rebuild is needed. The builder rejects unexpected source/patch identity, path traversal, symlinks in listed assets, bad size/hash and assets above 25 MiB. Only listed public assets are exported, never workspace trees. WASM is stored as explicit `.wasm.gz` assets below Pages’ per-file limit. After consent, a browser Service Worker intercepts only an exact generated WASM URL allowlist and returns gzip-decoded bytes as `application/wasm`; original HTML, JS and SRI attributes stay untouched. It does not intercept document requests, upload files or cache documents. A first experiment using Content-Encoding headers was rejected after remote checks found double compression. Current-browser Service Worker and DecompressionStream support are required; failures remain visible at the launch screen. Remote SHA-256 and browser verification are required.

```sh
node scripts/build-cloudflare-demo.mjs /absolute/path/to/verified-ui-registry build/cloudflare-demo
# Existing authenticated Wrangler 4.151.0; never print its credentials.
node /absolute/path/to/wrangler/bin/wrangler.js pages deploy build/cloudflare-demo --project-name creative-workspace-demo --branch main
```

`cloudflare/wrangler.jsonc` records the independent Pages project and date. Set `CLOUDFLARE_ACCOUNT_ID=37be952dfe8d74601e1af8bad125debb`; Pages configuration does not accept an `account_id` field. The Meshtastic project is untouched. Initial deployment uses its already installed Wrangler 4.151.0 with explicit project name, without upgrading or bundling account credentials. Auth requires Pages write. Generated assets live in ignored `build/`. OS artifacts continue to come from GitHub Actions under their separate acceptance gates.

References: [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

## Alpha.63 published and verified

Production https://creative-workspace-demo.pages.dev/ is deployment https://095d5db3.creative-workspace-demo.pages.dev. All207 published files match the verified output. All13 original release interfaces pass public sandboxed Chromium at https://b63d9c92.creative-workspace-demo.pages.dev, with exact WASM/PhotoCraft part hashes, consent/isolation and zero failed/external requests or page errors. DeckCraft is held at verified v0.7.0 because official v0.8.0/v0.9.0 panic at startup. [Evidence](evidence/cloudflare-demo-alpha63/browser.json) · [current production/CI handoff](cloudflare-demo-handoff.md). Screenshots of PhotoCraft, DesignCraft and DeckCraft were visually inspected. Broader edit/save acceptance is still open.

## Previous deployment (alpha.57, historical)

Public URL: https://creative-workspace-demo.pages.dev/

Final source-bound deployment: https://1157ac0e.creative-workspace-demo.pages.dev/ at product commit `4efc0cfe8211f779d39ed497c44fe24351b1bc5b` (2026-10-17), with zero changed asset bytes from browser-verified deployment https://60bcb383.creative-workspace-demo.pages.dev/. All twelve original interfaces launched through the public portal; explicit consent precedes iframe load, the persistent laptop-processing label remains visible, and original decoded WASM SHA-256 values match every pinned package. All twelve canvases are non-uniform and cross-origin isolated. No page errors or failed requests were recorded. The smoke assertion for FilmCraft was corrected to ignore its upstream cache-busting query, then FilmCraft alone was rerun successfully. This is launch/render/transport evidence, not broad editing/save/format acceptance. [Browser report](evidence/cloudflare-demo-alpha57/browser.json).

![Public playground](evidence/cloudflare-demo-alpha57/studio.png)

![Original PhotoCraft through the public demo](evidence/cloudflare-demo-alpha57/photocraft.png)

The other eleven application screenshots are retained alongside that report. Local verification: 83 tests passed, `npm run check`, release validation and diff check passed. A regression test proves that the browser transport decodes only the exact WASM allowlist and does not intercept document, POST or other-origin requests. No protected local service was restarted.

GitHub source is pushed normally at `4efc0cf`. Checks run `39040178445` passed Linux, macOS and Windows. Build/release `39040178352` remains in progress on original UI/native OS jobs. Alpha.56 run `39037838837` is complete; its tag/draft and all downloaded archive/checksum pairs are verified in [release evidence](evidence/creative-workspace-alpha56-release.md). No alpha.57 tag/release assets are claimed yet. Inspect the alpha.57 run and verify its draft/tag plus all downloaded assets/checksums after it completes.
