# Original ArtCraft application ports — mandatory acceptance

User clarification, 2026-10-11. This requirement supersedes earlier plans for custom subset browser editors.

## Product requirement

Every ArtCraft application must use the original application's interface and complete functionality in the browser, 1:1 with its native application: layout, menus, tools, panels, dialogs, shortcuts, workflows, document semantics and supported operations. Reuse and port the upstream UI source. A newly designed HTML editor over an upstream engine, a selected tool subset, or a server-preview-only proof does not satisfy this requirement. Do not quietly remove unsupported functions or call the application complete before parity is demonstrated.

The browser executes the original interface; the server owns document processing and expensive rendering/export. No VNC, remote desktop or streamed desktop interface. Server-rendered document previews are permitted. A standalone WASM application doing the heavy work on the laptop is a feasibility step, not the accepted product.

Native-only host integration must be mapped to browser permissions and the common file provider while preserving the original application's user workflow. Any remaining behavior difference must be explicit in the parity inventory and kept incomplete; do not silently weaken the 1:1 acceptance requirement. Source modes, separate output destinations, acknowledgement-based saves, original preservation, recovery, root/session/auth/Origin isolation and upstream licensing remain mandatory.

## Upstream updates

Creative Workspace must follow updates of each original ArtCraft application. Update the original UI and its native engine together from the same verified upstream source revision/version, including new tools, dialogs and behavior. An engine-only bump with an old or custom UI is insufficient. Preserve a small, documented portability/backend patch set rather than independently recreating the application.

For a detected upstream update: stage the complete UI/engine candidate, adapt/rebase the browser/server/provider integration, build through Actions, and check it against that version's native UI/function inventory. Verify representative original workflows and open/edit/save/reopen, shortcuts/dialogs, browser permissions, server execution, destination ACK, formats and recovery. Activation requires compatible UI, protocol, engine and state schema as one versioned unit. Preserve previous bundles and project backups for rollback; protect unsaved live documents. Failed compatibility/parity checks must leave the current working version intact and expose the concrete pending issue, not silently install a reduced-function version.

Every port and later update must pin the original UI and engine to the same verified upstream revision. Rebase the small, documented portability/backend patch set onto that revision, then compare its menus, tool groups, dialogs, command/action IDs and formats with the upstream native registries. Run the browser, provider, acknowledgement and recovery checks against that same candidate. Package and activate UI, protocol, engine and state schema together through Actions-built target artifacts; stage and health-check before switching, retain rollback artifacts, and prevent activation from replacing sessions with unsaved work. An engine-only update against an older or custom UI fails this requirement.

Product SemVer/changelog/summary, upstream provenance/pin/digests and Actions-built OS downloads remain required for completed product updates. Product and upstream version numbers are distinct, but the displayed upstream UI/engine identity must agree.

## Evidence and current scope

Maintain a versioned parity inventory comparing the actual pinned native original with the browser port; test the original registry of tools/actions rather than our old reduced command list. Record visual comparisons at matching viewport/settings and functional workflow results. A successful WASM build, copied menus or document screenshot alone does not establish parity or server ownership of processing.

Current Creative Workspace alpha ArtCraft frontends are custom limited prototypes using genuine original engines. They have not met this original-app requirement. The DesignCraft source audit identifies an existing upstream browser shell using the shared original `DesignApp`, but it currently owns a local WASM `Session`. The next bounded implementation is to run that original source UI and establish a server backend while retaining the full original UI/tool semantics. Keep unfinished portions explicitly pending; do not repeat completed audits as progress.
