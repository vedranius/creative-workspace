# PAR-03 alpha.35 browser smoke alignment

The registered pinned DesignCraft UI test reached the owned Actions-built Linux worker. The original A4 preset ACKed at revision 1, two original frame actions at revisions 2–3, and the Type Tool's unchanged `text.placeCaret` action ACKed at revision 4 with the caret restored. Typing `Queue Ω` produced seven FIFO `text.insert` ACKs at revisions 5–11; the canonical server snapshot contained the text, the server render advanced, and Chromium reported zero browser errors. Details and hashes are in [the browser report](designcraft-par03-alpha35-text-caret-browser.json).

The report uses a synthetic provider-share fixture to bypass the folder chooser. It verifies original UI actions against the server worker; it does not verify real browser folder permission, laptop write ACK/reopen/recovery, or full DesignCraft parity. Keep DesignCraft planned.
