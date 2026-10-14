# Creative Workspace alpha.39 release verification

Date: 2026-10-15
Product commit: `d08ff58eeac1d11345519b90b86bccbc5d337ade`
Upstream DesignCraft pin: `a127c6d5c3576972bbd60445f26d893db071eef3`
Registered patch: `par-03-selection-set-v1`, SHA-256 `54a1021ce9550bdf608f4593ae6178caf54423941d03c3ce8c2c6cdc2ce2215e`

## Actions and browser evidence

- Checks run [38640343523](https://github.com/vedranius/creative-workspace/actions/runs/38640343523) and Build/release run [38640343490](https://github.com/vedranius/creative-workspace/actions/runs/38640343490) completed successfully on the product commit above.
- The original DesignCraft job built the exact pinned WASM candidate and passed the targeted native action capture test and Chromium smoke. The original UI drove A4 `file.new`, graphic `frame.create`, deselect and Selection Tool `selection.set` for ID 8; the server ACK hydrated the read model at revision 5. Type Tool caret and seven ordered text inserts advanced revisions 6–14, followed by server render refresh and zero browser errors.
- Downloaded Actions evidence artifact `designcraft-par03-browser-evidence` (`11932034885`) includes the JSON report and screenshots. Local clean-source browser evidence is documented in [the PAR-03 report](designcraft-par03-selection-set-local.md).
- Earlier runs `38635602056` and `38635602484` exposed the missing `file-provider.js` dependency in the first candidate patch. The cumulative patch now includes that required module; the successful run used the corrected patch.

## Immutable tag and assets

GitHub account was verified as `vedranius`. Immutable tag `v0.2.0-alpha.39` resolves to `d08ff58eeac1d11345519b90b86bccbc5d337ade`. The GitHub prerelease remains a draft. Its 12 uploaded assets comprise three OS prototype bundles, two DesignCraft candidate/preview archives, one FilmCraft original-UI preview and six `.sha256` sidecars. All six archives were downloaded and each sidecar passed `sha256sum -c`.

| Actions-built archive | SHA-256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.39-darwin-arm64.tar.gz` | `07f8bd15b9c90d02ca66708d3292621175059ff7fcee37961b33983c08ff6580` |
| `creative-workspace-0.2.0-alpha.39-designcraft-host-canvas-candidate.tar.gz` | `5b505d7c6691805303b1b6cef9e6877a0620f1695fdfc128df06684beeebd0f1` |
| `creative-workspace-0.2.0-alpha.39-designcraft-par03-preview.tar.gz` | `ac339d53200437fba62dea957256ada4ede62cbec755f49c586669c27d7ea42c` |
| `creative-workspace-0.2.0-alpha.39-filmcraft-original-ui.tar.gz` | `af143262cdd1ef8e554b44d1cefd0fe6e47914801e5d3bfcc1ddfb7d97d0f404` |
| `creative-workspace-0.2.0-alpha.39-linux-x64.tar.gz` | `5557a32dcc79cf5db1abf712d85dcc8d22da029114c0c2be7f23bc7f929aa065` |
| `creative-workspace-0.2.0-alpha.39-win32-x64.zip` | `571c6da19ebda7fc20a66be3eb7336836896f412fbe0a49b4b550c2264db7b3e` |

The product bundles are native prototypes with limited engines; they are not complete original ArtCraft application bundles. DesignCraft and FilmCraft previews are separate UI archives. Their presence does not demonstrate server-backed provider parity.

## Acceptance still open

The folder chooser in the browser smoke is synthetic. Real browser folder permission, laptop destination write acknowledgement, reopen and uncertain-output recovery, all provider modes, and full original DesignCraft action/tool parity remain unverified. Keep DesignCraft planned and leave this release as a draft prerelease. The next bounded step is to continue original DesignApp action/read-model coverage and provider recovery on a browser with real folder access. Preserve unsaved sessions and unrelated `engines/filmcraft/` work.
