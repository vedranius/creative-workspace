# DesignCraft PAR-03 common provider candidate evidence

## Local candidate verification — 2026-10-13

Built the exact pinned DesignCraft source (`a127c6d5c3576972bbd60445f26d893db071eef3`) with the reviewed candidate patch (`27c0c700330215288d50fcefc0ef27297579bf1cc8ef2146dcf26c41f158634f`). `npm run ui:designcraft:host -- build/original-ui/source-designcraft-host build/original-ui/assets-designcraft-provider-final` completed and passed the exact patch guard. Optimized WASM SHA-256: `4cd98a05250ae85a82f53318797a0b10651ca67771a981be8d9ea0a17c0ff112`.

The isolated Chromium/Playwright smoke uses the owned DesignCraft worker and existing storage FUSE helper. It opens the native A4 fixture through the original Open dialog against the selected app-scoped on-demand provider, acknowledges the read before native open, exercises original edit/Undo, and selects both server and laptop in separate original Save a Copy dialogs. It verifies browser provider ACK, output bytes, collision refusal, and reopening the laptop copy through the original provider chooser. The final server canvas has 532,837 bright pixels and at least 64 colors; no uncaught browser errors were observed.

Evidence: [browser report](designcraft-par03-provider-browser.json), [canvas screenshot](designcraft-par03-provider-browser.png), [Save a Copy dialog](designcraft-par03-save-dialog.png), [server destination menu](designcraft-par03-save-destination-dialog.png), [laptop destination selected](designcraft-par03-save-laptop-destination-dialog.png).

The browser File System Access folder handle is mocked. This is protocol/UI evidence, not genuine browser permission acceptance or an end-to-end UI selection of the laptop destination. Uncertain-output recovery, other retention modes, and full original app parity remain unverified. Keep the candidate unregistered and DesignCraft planned. Actions must build release assets for each target OS; leave the GitHub release draft until the original feature's actual folder permissions, laptop UI write ACK, and recovery requirements are accepted.


## Real folder permission attempt — 2026-10-13

Fetched the Actions artifact `release-designcraft-par03-ui` from successful run `38393945850` into ignored disk scratch `build/host-tmp/cw-par03-real-folder/assets/`. The candidate archive SHA-256 sidecar passes; embedded `SOURCE.json` names upstream pin `a127c6d5c3576972bbd60445f26d893db071eef3` and exact provider candidate patch `27c0c700330215288d50fcefc0ef27297579bf1cc8ef2146dcf26c41f158634f`.

Adapted the existing smoke only in that ignored scratch to preserve the browser's real `showDirectoryPicker`, run headful Chromium, and use a new QA folder with a generated synthetic `.designcraft` fixture. `/tmp` is full, so `TMPDIR` used the disk-backed `build/host-tmp/cw-par03-real-folder/tmp` through a short `/tmp/cw-par03-qa` symlink. Chromium launched, but this task's CUA inventory exposes only Codex In-app Browser and MCP Apps; Chrome is unavailable as a controllable browser target and there is no native window control. The directory picker did not return a handle, so the app's “Start this mode” stayed disabled and the smoke closed on timeout. No browser folder permission or laptop write was granted, and no save/ACK/reopen result is claimed. The only staged file is synthetic test data under the new QA folder; no protected runtime or user service was touched.

**Next:** repeat this same candidate flow in a task with a controllable Chrome/Edge native folder picker. Select the isolated QA folder; verify actual permission, provider read, original Save a Copy laptop write ACK, collision refusal, and reopen. Then exercise uncertain-output recovery. The existing mocked-handle report above remains protocol/UI evidence only. Continue to keep the candidate unregistered, DesignCraft planned, and alpha.31 draft-only.
