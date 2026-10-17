# DesignCraft original Save a Copy: laptop ACK failure and recovery

Isolated Chromium exercised the exact-pinned original DesignCraft UI with the owned native worker and Linux FUSE-backed common provider. The original File → Save a Copy action (`file.saveACopy`) selected a laptop destination and workspace retention. The synthetic browser directory handle rejected `release` with `EIO`, causing the common provider to retain the uncertain output and the recovery journal to mark it failed.

The original document stayed `chosen.designcraft`, dirty, at server revision 5, with no successful `file.saveACopy` ACK. The shared recovery UI listed `laptop-copy.designcraft` as “Laptop save failed — recovery record retained.” Downloaded server bytes were 2,954 bytes and SHA-256 `489a4f464b2a3a1e45100b7c0b959bc7e3ae8198ca23961a28bfa93527b394f3`; a retry to the same target returned HTTP 409 and did not write laptop bytes. The original canvas remained visibly rendered; there were zero uncaught browser errors.

- Full structured report: [JSON](designcraft-par03-save-copy-ack-failure-browser.json)
- Original editor after the failed save: [PNG](designcraft-par03-save-copy-ack-failure.png)
- Shared recovery inventory: [PNG](designcraft-par03-save-copy-recovery.png)
- Source pin `a127c6d5c3576972bbd60445f26d893db071eef3`, patch `par-03-save-recovery-v1`, SHA-256 `68ab6bf82dacf0cb23d6b6964ffe2f006f9d4ac3d2ffb35b86e66dceb1ad4688`
- UI WASM SHA-256 `2c87f1f3987c0d177faea7bce9ded2648aa5c21571e6b1e5532be44e1a7ff01a`; native worker SHA-256 `533a201c9c2d61ad428515f32e604dc4ebf47b488ef28efcd0d36dca894c7239`

The server mount and `LocalFolderAgent` protocol were real. The browser directory handle and its failing close were injected fixtures; this does not prove native OS folder-picker permission. This is bounded PAR-03 provider/recovery behavior, not complete DesignCraft parity or an availability claim. Keep the catalog planned and alpha.54 draft-only.
