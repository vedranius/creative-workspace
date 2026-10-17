# PAR-03 Delete Page browser and worker evidence

The pinned original DesignCraft source `a127c6d5c3576972bbd60445f26d893db071eef3` was built with reviewed patch `par-03-delete-page-v1` (SHA-256 `9f9fc7de7907f6f4e544d222112f2959e9dbfe0d73c11ffe18b695c4485e7693`). The installed UI package records both identities. The owned worker was built in optimized release mode from the patched checkout; its SHA-256 is `014cda54ca526d51a6429ba3a2f2c49f9930f8722348f16609d606f9041c994b`.

The exact-source Rust test `original_delete_page_queues_engine_command_and_hydrates_only_after_ack` passes 1/1. It verifies the original `app.deletePage` path queues the engine command and keeps state unchanged until the matching ACK.

Isolated Chromium opened the pinned original UI, used the original Duplicate Spread menu action to prepare two pages, then selected Layout → Pages → Delete Page. The worker request was `layout.pages.delete` with `{ "pages": [0] }`; the matching ACK advanced revision 2 to 3, returned one page and `dirty: true`, and supplied a fresh server PNG (HTTP 200). Browser errors, failed responses and failed requests were all empty. The full machine-readable result is in [the browser report](designcraft-par03-delete-page-browser.json); screenshots show the acknowledged one-page result and the original menu [after opening Layout → Pages](designcraft-par03-delete-page-menu.png) and [after deletion](designcraft-par03-delete-page-browser.png).

The folder chooser was a synthetic connected-folder fixture. This evidence does not establish real OS permission, broad original-app parity, or full DesignCraft provider/save/reopen acceptance; keep DesignCraft planned.
