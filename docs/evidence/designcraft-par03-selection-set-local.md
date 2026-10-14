# Creative Workspace 0.2.0-alpha.39 local DesignCraft selection candidate

The pinned original DesignApp Selection Tool now sends its original `selection.set` command through the bounded server action queue. The server validates at most 200 nonnegative safe integer object IDs and optional boolean `add`/`content` flags, rejects unrecognized fields, executes the unchanged command ID in the owned worker and returns selection in the matching ACK. The gateway also accepts the original graphic-frame `frame.create` content needed to create a selectable object with the Rectangle Frame Tool.

- Upstream DesignCraft pin: `a127c6d5c3576972bbd60445f26d893db071eef3`.
- Registered patch candidate `par-03-selection-set-v1`, exact patch apply/diff verified on a clean pinned archive. Patch SHA-256: `6974d1b20b5a8b053dc8ecf1aeb094ac63d8a4c9ec595880dd4668e53d96cb35`.
- Fresh native worker build from the exact pinned candidate completed through `low-impact-build.py`; SHA-256: `f3d6425a11d2a5f4bcb555eae65a7568f2fe9852c1a8b89cb42412f4028a580c`. Targeted mirror capture unit test: 1/1 passed.
- Original WebAssembly UI built optimized with Rust 1.99.0, Trunk 0.21.14 and `low-impact-build.py`; WASM SHA-256: `67df90f4db46b40b7c3f97ea66269cab65dad93c04b0b9ed7ff7ff1481db5a32`.
- One isolated Chromium run against that UI and owned worker verified `file.new` rev 1; original Rectangle Frame Tool graphic `frame.create` rev 3; empty selection rev 4; original `selection.set` selecting ID 8, ACK and server read-model at rev 5; Type Tool frame/caret ACKs rev 6–7; seven sequential text insert ACKs rev 8–14; refreshed server render; and zero browser errors. [Detailed JSON](designcraft-par03-selection-set-browser.json) · [Original UI screenshot](designcraft-par03-selection-set-browser.png).

The on-demand folder chooser is synthetic and is not browser permission evidence. This candidate does not prove real laptop write ACK, uncertain-output recovery, all original DesignApp commands/tools, or full provider parity. Keep DesignCraft planned and the release draft-only; Actions/release verification is pending.
