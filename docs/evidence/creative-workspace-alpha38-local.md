# Creative Workspace 0.2.0-alpha.38 local DesignCraft candidate

The exact guarded DesignCraft source patch `par-03-provider-text-actions-v1` extends the original `DesignApp::run` boundary so `text.select` and `text.placeCaret` enter the same bounded server-action FIFO as `text.insert`. Acknowledged server snapshots hydrate the original app mirror before the next queued action is dispatched. The queue is capped at 32 actions and 16 KiB of inserted text; queued edits are retained after failures and are not automatically replayed.

- Pinned upstream DesignCraft source: `a127c6d5c3576972bbd60445f26d893db071eef3`.
- Reviewed source patch SHA-256: `7554053fc7659df8346f99ae56126b95ced6b1cdbc95599c5648ff6cee3535c9`.
- Optimized local WASM built with the pinned Rust 1.99.0 / Trunk 0.21.14 toolchain through `low-impact-build.py`; WASM SHA-256: `0a08170fc0c1ce4b9d2e788fc4dd1893b651e989cddb58521363fae4d2ec8e78`.
- Isolated Chromium 151.0.7922.34 reached the owned worker from the original UI: `file.new` ACK revision 1, two `frame.create` ACKs revisions 2–3, original `text.placeCaret` ACK/hydration revision 4, and seven sequential `text.insert` ACKs revisions 5–11. The server snapshot contains the typed text, server render refreshed, and there were zero browser errors. Full report: [browser JSON](designcraft-par03-alpha38-text-actions-browser.json).
- Focused Rust FIFO regression, gateway suite, exact patch guard, release validation and fresh Actions-built browser/bundle/assets verification are tracked separately in the handoff.

The browser fixture uses a synthetic folder chooser and does not prove real laptop folder permission/write ACK, collision/reopen/recovery, or complete original DesignCraft action/tool parity. Keep DesignCraft planned and any release draft-only.
