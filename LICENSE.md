# License, permitted use and upstream attribution

Creative Workspace is open-source software licensed **AGPL-3.0-only**. The authoritative complete license is [LICENSE](LICENSE); `package.json` uses the same identifier. This guide explains the existing license and component boundaries. It does not replace the license text or grant rights in other authors' work.

## Use for any purpose

You may use Creative Workspace for personal projects, education, research, paid creative work, commercial studios and businesses. There is no Creative Workspace license fee or additional restriction on the purpose of use. You can study and modify the software.

These freedoms coexist with AGPL conditions. Preserve applicable notices and licenses. Distribution of covered software requires the corresponding source and the other applicable AGPL conditions. If you modify the covered program and let users interact with it over a network, AGPL section 13 requires offering those users its corresponding source. Offering the actual deployed revision matters; a link to unrelated or older source is not a substitute. See sections 4–6 and 13 of [the full license](LICENSE) and the [official GNU AGPL text](https://www.gnu.org/licenses/agpl-3.0.html).

This project already includes an AGPL-derived file provider. Its license cannot be removed by describing the whole suite as unrestricted or relicensing other authors' code. The current project license remains AGPL-3.0-only.

## Your creative work

Using the software does not, by itself, place your own photos, videos, illustrations, PDF documents or publications under AGPL. You retain the rights you have in your material. Output that embeds third-party fonts, stock media, templates or other licensed assets can have separate requirements. The software license does not grant rights to those assets.

## Applications keep their authors' licenses

| Component | Author / source | Recorded license and provenance |
| --- | --- | --- |
| Creative Workspace integration, gateway and original CW identity | [vedranius/creative-workspace](https://github.com/vedranius/creative-workspace) and contributors | AGPL-3.0-only; [full text](LICENSE). |
| RapidRAW original application | [CyberTimon/RapidRAW](https://github.com/CyberTimon/RapidRAW) | GNU AGPL v3; preserve original notices in the pinned derived source. |
| RapidRAW Web adaptation and derived shared file provider | [vedranius/rapidraw-web](https://github.com/vedranius/rapidraw-web), pin `38ddc8af1bc51552fcab8781c4838b17082f97bd` | AGPL-3.0-only; [manifest](engines/rapidraw/manifest.json), [provider license](src/vendor/storage/LICENSE) and source header. |
| PhotoCraft | [ArtCraft / storytold/photocraft](https://github.com/storytold/photocraft) | MIT OR Apache-2.0; [pinned manifest](engines/photocraft/manifest.json). |
| VectorCraft | [ArtCraft / storytold/vectorcraft](https://github.com/storytold/vectorcraft) | MIT OR Apache-2.0; [pinned manifest](engines/vectorcraft/manifest.json). |
| PdfCraft | [ArtCraft / storytold/pdfcraft](https://github.com/storytold/pdfcraft) | MIT OR Apache-2.0; [pinned manifest](engines/pdfcraft/manifest.json). |
| DesignCraft | [ArtCraft / storytold/designcraft](https://github.com/storytold/designcraft) | MIT OR Apache-2.0; [pinned manifest](engines/designcraft/manifest.json), [reviewed bridge](docs/designcraft-par03-sample-bridge.md). |
| LightCraft | [ArtCraft / storytold/lightcraft](https://github.com/storytold/lightcraft) | MIT OR Apache-2.0; [pinned manifest](engines/lightcraft/manifest.json). |
| FilmCraft | [ArtCraft / storytold/filmcraft](https://github.com/storytold/filmcraft), pin `4e2d0bc2d3646f9cf27ef7aa8b2095c6858c7efe` | MIT OR Apache-2.0; [source and patch provenance](docs/filmcraft-mkv-import-handoff.md). |
| EffectCraft | [ArtCraft / storytold/effectcraft](https://github.com/storytold/effectcraft), pin `9a7d3e76991d5372448033b473dc12c2480a6a04` | MIT OR Apache-2.0 in the pinned root Cargo manifest, `LICENSE-MIT` and `LICENSE-APACHE`; [source evidence](docs/effectcraft-original-ui-preview.md). |

`MIT OR Apache-2.0` is the upstream dual-license choice, not a new Creative Workspace license. Retain whichever notices and requirements apply. Dependencies inside an application may have additional licenses.

Node.js, `ws`, Rust crates, codec/GPU libraries, fonts, models and other assets retain their own licenses. This table is an application overview, not an exhaustive dependency inventory. Registered UI packages preserve upstream license/notice files; release archives contain platform/pin/capability manifests and licensing materials. Consult the actual package, not merely this table, before redistribution.

Screenshots show the credited upstream interfaces; they do not transfer ownership of application artwork or trademarks. The CW logo/banner are original project assets under this project's AGPL license. This integration is not presented as an official product or endorsement by the upstream teams.

## Distribution and updates

Keep this project's license, upstream license files, notices, exact source revisions and reviewed patch provenance with distributions. A new engine/UI revision must be checked for license changes as well as technical compatibility. Creative Workspace's version and upstream versions are independent. Do not silently replace an upstream license or assume a repository's current license applies to every historical pin or bundled dependency.

See [README attribution](README.md#original-projects-and-authors), [original UI registration](docs/studio-original-uis.md) and [release packaging requirements](docs/releases.md). All purposes of use are allowed; the applicable open-source obligations remain.
