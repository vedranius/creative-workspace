# DesignCraft Save a Copy ACK-failure browser gate

Added `scripts/smoke-designcraft-save-copy-ack-failure.mjs` to the paired `original-designcraft` Actions job. It serves the exact-pinned original UI from the same-origin candidate route and invokes original File → Save a Copy through the owned DesignCraft worker. The worker creates the native output; the real Linux FUSE/common provider mount receives the pending copy. A synthetic File System Access handle rejects `close()` with `EIO` after output bytes arrive.

Chromium verified that the laptop save receives no success ACK, the active `chosen.designcraft` document remains dirty at revision 5, and the retained recovery download matches server mirror bytes (2,954 bytes; SHA-256 `54290a7f6ef7ccd3387197c969eead3f21f0dca39e0594966fb28f5176a4f999`). A retry to the same target returns HTTP 409 and writes no laptop bytes. The original canvas remained visibly rendered (534,954 bright pixels and at least 64 distinct colors); there were no uncaught browser errors.

This exercises the source action, owned native worker and Linux provider protocol. The browser directory handle/failure are fixtures, so it does not prove native OS folder permission or a successful laptop write/reopen. Keep DesignCraft planned.

- [Structured report](designcraft-par03-save-copy-ack-failure-actions-smoke.json)
- [Original canvas](designcraft-par03-save-copy-ack-failure-actions-smoke.png)
- [Recovery inventory](designcraft-par03-save-copy-ack-failure-actions-recovery.png)
