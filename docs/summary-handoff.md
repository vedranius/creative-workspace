# DOCS-SUMMARY-01 — repository overview, screenshots and licensing

Updated 2026-10-11. Documentation/identity task; product version stays `0.2.0-alpha.12`.

README now describes the goal, current original-UI/server boundaries, updates, four source modes, save destination/retention/ACK, recovery, source/portable/Docker installation, hosting, upgrades and next milestones. It embeds 14 actual screenshots: six workspace surfaces and all eight applications. Seven fresh images were captured with a generated demo workspace and one closed QA browser; the seven ArtCraft images reuse recorded genuine original-UI evidence. [Capture provenance](screenshots.md).

Added original SVG logo/banner and `LICENSE.md`. The existing full AGPL license and package identifier remain unchanged. All-purpose/commercial use is allowed while applicable open-source conditions remain; third-party licenses are preserved. Explicit upstream authors/repos/pins explain derivatives and patch variants. Creative Workspace is an integration repo, not a GitHub multi-parent fork. GitHub description/topics edit was attempted but the authenticated token received HTTP 403 (repository administration scope unavailable). The concrete metadata is saved in [discovery guide](github-discovery.md); README attribution and keywords are publishable through normal content access. No upstream maintainer was messaged or reverse backlink claimed.

The release path filter excludes the new explanatory LICENSE.md, so a documentation-only push cannot accidentally build/publish the existing product version again. No engine, provider, application UI or live service was changed. Pre-existing untracked `engines/filmcraft/` remains untouched and unstaged.

Validation: `npm run check`, `npm run release:validate` and `git diff --check` passed. All 102 local references resolve; all 14 distinct screenshot PNGs and both SVGs passed structural checks. Fresh studio/RapidRAW screenshots and both vector assets were visually inspected. Normal commit/push and GitHub Checks verification follow this handoff; inspect Checks on the final main commit before declaring publication complete. No new product feature or cross-platform asset availability claim is made by this documentation update.

Next: verify queued alpha.12 release Actions and all actual assets, retaining draft scope; then continue original DesignCraft PAR-03 read-model/commands/editing, provider/save ACK and reopen. Full original ArtCraft ports remain pending.
