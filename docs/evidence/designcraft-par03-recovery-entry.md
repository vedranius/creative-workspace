# PAR-03 original DesignCraft recovery entry candidate

The exact pinned original DesignCraft page now exposes a `Save recovery` action that opens the existing shared recovery inventory for DesignCraft. This reuses `/api/storage/recovery` and its retained-output route; it does not add a gateway method or replay a laptop write. The shared recovery view labels the output as unacknowledged, preserves it, and offers a separate `.recovered` download.

An isolated Chromium run against the built original UI displayed a retained `exports/uncertain.designcraft` record and downloaded the exact retained bytes through the authenticated API route. The browser report records source pin, output SHA-256, zero browser errors and zero failed responses. [JSON report](designcraft-par03-recovery-entry-browser.json) · [screenshot](designcraft-par03-recovery-entry-browser.png).

The recovery manifest and provider chooser are fixtures. This proves original-page access to the shared recovery system, not a real OS folder permission, native laptop write/ACK, or Save a Copy failure created through the original DesignApp. Original Save a Copy is not yet wired to the server session. Keep DesignCraft planned and do not claim full provider acceptance.
