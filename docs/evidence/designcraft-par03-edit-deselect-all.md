# DesignCraft PAR-03 Edit > Deselect All server action — alpha.49 candidate

The browser-loaded original DesignApp at upstream pin `a127c6d5c3576972bbd60445f26d893db071eef3` sends the original `edit.deselectAll` ID to the owned DesignCraft worker. The same cumulative patch includes the earlier `edit.selectAll` action. The queue does not advance the original UI revision before a matching worker receipt; after ACK, the UI consumes the canonical selection/read-model and bounded server preview.

## Verification

- Reviewed source patch `par-03-selection-set-select-all-v1`, SHA-256 `f67f7fb23e3804a8949df4ae641a54d47891d6c4e158c1be862bca1dc5d4e24e`; a fresh pinned checkout applied it and `originalUiSourceDiff` matched all 75,351 bytes.
- Focused upstream test `original_edit_deselect_all_waits_for_worker_ack` passed 1/1. It checks the exact action ID, no revision advance before ACK, hydration after ACK, empty selection and preservation of a clean document.
- The optimized original UI/WASM candidate built with `low-impact-build.py` and was installed under a separate alpha.49 package root. This local candidate build is not a GitHub Actions release asset.
- Isolated Chromium used the original A4 preset and Rectangle Frame Tool, then Ctrl+A and the original Edit > Deselect All menu. The owned worker acknowledged revisions 1–4 for `file.new`, `frame.create`, `edit.selectAll` and `edit.deselectAll`. The final server selection is empty, the already-dirty document remains dirty, the original UI reports the server render, and there were zero page/console errors or failed requests. See [browser JSON](designcraft-par03-edit-deselect-all-browser.json) and [screenshot](designcraft-par03-edit-deselect-all-browser.png).

The chooser in this browser smoke is a synthetic provider fixture. It does not prove real folder permission, laptop destination-write acknowledgement, uncertain-output recovery or provider parity. Other original tools/actions, full open/edit/save/reopen and complete DesignCraft parity remain pending; keep the app catalog planned and any product release as a prerelease draft.
