# Creative Workspace alpha.23 release verification

**Status:** verified draft prerelease; not publicly promoted because full original-app/provider parity is incomplete.

- Publisher identity: `vedranius`.
- Version: `0.2.0-alpha.23`.
- Immutable tag: `v0.2.0-alpha.23` → commit `4edfaeae33f52caff7fa6ff87e0857ae959f7958`.
- Draft release ID: `RE_kwDOVDgEq84Yf2nG`.
- Checks: [38306757205](https://github.com/vedranius/creative-workspace/actions/runs/38306757205), successful on Ubuntu, Windows and macOS.
- Build/release: [38306757116](https://github.com/vedranius/creative-workspace/actions/runs/38306757116), successful for the contract, native target matrix, FilmCraft browser regression, DesignCraft original UI registration and browser proofs, isolated DesignCraft build, and all three OS bundles/smokes.

## Actions-built release assets

All six archives and six `.sha256` sidecars were downloaded from the draft and verified with `sha256sum -c`.

| Asset | SHA256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.23-linux-x64.tar.gz` | `c8c27ba6162c33555739637b7ead0710780faab672632c1038eb73b8bf0b5b0e` |
| `creative-workspace-0.2.0-alpha.23-win32-x64.zip` | `a779e321a0c4835fba7ae1e08059280ba7ec273e4928e5f632d0a32808c6291f` |
| `creative-workspace-0.2.0-alpha.23-darwin-arm64.tar.gz` | `25be9a47c7ae917c9a4e1de5aa56193d70f4df1ddde606ba5fc11bff55da18cc` |
| `creative-workspace-0.2.0-alpha.23-filmcraft-original-ui.tar.gz` | `841803dbc9202e4792ae135765cc768603c2dcb7d42c00a8fde71aa835c8d7d3` |
| `creative-workspace-0.2.0-alpha.23-designcraft-par03-preview.tar.gz` | `cc20eb911a665d502612480638d62aa942ce9120c9c3fbe877778b4d9e2e9a8e` |
| `creative-workspace-0.2.0-alpha.23-designcraft-host-canvas-candidate.tar.gz` | `c5466729fed10237834afed0d69b38e7a019d58830b21799de1a8e6dc16485c0` |

Each OS archive includes the platform Node runtime, startup launcher, project license, pin/capability manifest, and owned PhotoCraft, PdfCraft, VectorCraft and DesignCraft engines with upstream licenses/attributions. The Actions bundle jobs completed actual target-native open/edit/save/reopen smokes. This is still a prototype bundle: the DesignCraft host-canvas candidate and browser previews are separate review assets, not registered/active complete editors; other application and provider parity limitations remain documented.

## DesignCraft proof and limits

The isolated host build compiled from the pinned source in a temporary copy, while the canonical reviewed patch was verified before and after compilation. The original A4 preset action, Rectangle Tool `frame.create`, and `edit.undo` reached the owned worker in order; the browser received the ACKed canonical snapshot and server PNG. Full original DesignCraft tools/menus/dialogs, common file provider, separate destination/retention, laptop write ACK, save/reopen and recovery are still unfinished. Keep DesignCraft planned and this release draft-only.

Detailed build/browser evidence: [alpha.23 isolation report](designcraft-alpha23-build-isolation.md) · [browser JSON](designcraft-alpha23-build-isolation-browser.json) · [screenshot](designcraft-alpha23-build-isolation-browser.png).
