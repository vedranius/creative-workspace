# MCP-01 — audit i temelj kontroliranih izmjena

Datum: 2026-10-10. **MCP endpoint/klijent još nije implementiran.** Dovršen je inventar, odabran mali prvi prototip i implementirana provjera verzije PhotoCraft sesije. Testovi koriste naše zasebno instalirane engineove.

## PhotoCraft: postojeće sposobnosti

Pinned upstream: [storytold/photocraft, 29d5f791](https://github.com/storytold/photocraft/tree/29d5f791d52cd54e411611a609fbc56949e0c653). Autori: ArtCraft tim; licenca enginea MIT OR Apache-2.0.

- `apps/photocraft-cli/src/lib.rs`: `serve` daje JSON-lines RPC nad headless sesijom; `mcp` već nudi zaseban headless stdio MCP server. Pokretanje zasebnog `mcp` procesa stvara drugi dokument/sesiju. Naš adapter treba dijeliti postojeću gateway sesiju s browserom. GUI `--bridge` način ne koristimo.
- `crates/automation/src/rpc.rs`: otvaranje, stvaranje, inspect/render/save, session list/select/close, registry naredbi i jobs. Naš `src/photocraft.js` izlaže ograničen skup tih metoda kroz izoliran proces po sesiji, s read/write rootovima.
- Stvarni instalirani registry vratio je **853 naredbe**. `params` je opisna sintaksa, nije JSON Schema. Prvi MCP alati dobit će ručne stroge sheme za mali provjereni skup; ne izlažemo generički `engine.execute`/batch modelu.
- `crates/engine/src/inspect.rs`: native `revision` pripada dokumentu. Aktivni tab i drugi dokument mogu imati istu reviziju, pa ona sama ne određuje siguran cilj izmjene.

| Predloženi MCP alat | Postojeći gateway/native poziv | Prvi opseg |
| --- | --- | --- |
| `workspace_list_files` | Ograničeni `listFiles` u odobrenom workspaceu | Samo relativne putanje, bounded listing |
| `document_open` | `doc.open {path}` | Odobreni server workspace; mijenja aktivni dokument |
| `document_inspect` | `state` / `doc.inspect` | Dimenzije, slojevi, aktivni dokument i `stateVersion`; bez apsolutnih rootova |
| `document_preview` | `doc.render {maxSide}` / managed PNG | Sam dokument, manji PNG s ograničenim brojem bajtova |
| `photo_adjust` | `engine.execute`, `image.adjustments.brightnessContrast` | Brightness -150..150, contrast -50..100, `legacy:false`, `wait:true` |
| `document_undo` | `engine.execute`, `edit.undo`, `wait:true` | Jedan korak, uz očekivanu verziju |
| `document_save_copy` | `doc.save {path,format}` + output download | Nova generirana export podmapa, bez overwrite i bez pisanja preko otvorenog originala |

Za save-copy ne oslanjati se samo na postojeći `overwrite:false`: gateway dopušta ponovno spremanje istog otvorenog layered dokumenta. MCP adapter mora izabrati novu slučajnu export podmapu/putanju i ne prihvatiti originalnu putanju. Provjeru native write-roota, download output allowlista i potvrdu odredišta zadržati.

## Implementirani ugovor verzije

RPC rezultat sa snapshotom sada sadrži `stateVersion`, cijeli broj vezan uz lifetime konkretne gateway sesije. Svaka dispatchana mutacija, uključujući legacy zahtjev bez tokena, poništava staru verziju. Native failure također poništava token jer može imati djelomičan učinak. Promjene koje se vide u native session/document inspectu dodatno poništavaju opaženi token. Read-only snapshot bez promjena ne povećava verziju.

Zahtjev može poslati `expectedVersion` na vrhu RPC envelopea:

```json
{"method":"engine.execute","params":{"command":"image.adjustments.brightnessContrast","params":{"brightness":-40,"contrast":10},"wait":true},"requestId":"unique-operation-id","expectedVersion":3}
```

Usporedba se radi **unutar istog reda** kao browser/adapter mutacije. Zastarjeli zahtjev vraća HTTP 409 i `code: STATE_VERSION_CONFLICT` prije native dispatcha. Postojeća izlazna datoteka ima zasebni `code: OUTPUT_EXISTS`. Isti requestId s istim sadržajem/verzijom vraća sačuvani rezultat; izmijenjen sadržaj uz isti ID se odbija.

Browser šalje token za mutacije kada ga server podržava. Na konflikt osvježava state i ne ponavlja operaciju. Stale Save zatvara dijalog i ne nudi Replace; korisnik ponovno otvara Save za trenutačni dokument. Overwrite potvrda vrijedi samo za izričitu grešku postojeće datoteke. Stariji gateway bez `stateVersion` ostaje kompatibilan.

Ovo je optimistic guard za gateway queue, nije atomski native transaction ni provjera verzije datoteke na laptopu. Native jobs se mogu dovršiti između inspecta i sljedeće native naredbe. Prvi MCP prototip dopušta samo sinkrone alate s `wait:true`, odbija sesiju s aktivnim async poslovima i mora spriječiti novi async dispatch dok je grant aktivan. Jobs/batch ugovor dolazi zasebno. Cache request ID-eva je ograničen (~100 zadržanih zahtjeva), nije trajna idempotency evidencija nakon restarta/evictiona.

## Prvi transport, dozvole i UI sinkronizacija

Prvi MCP-02 prototip: **stdio adapter za desktop/CLI klijent → HTTPS/loopback gateway → ista PhotoCraft sesija**. Koristiti službeni SDK uz točno pinanu verziju provjerenu pri instalaciji. [SDK v2](https://github.com/modelcontextprotocol/typescript-sdk) koristi `@modelcontextprotocol/server`/`client`; nemoj automatski kopirati v1 import primjere. Provjeriti konkretnu protocol/client kompatibilnost kroz stvarni SDK/Inspector test.

[MCP transporti](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) razlikuju stdio i Streamable HTTP. [Autorizacija](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) za HTTP koristi OAuth model; stdio dobiva svoje vjerodajnice od lokalnog klijenta. Cloudflare browser login sam po sebi nije MCP OAuth tok.

Planirani session grant, **još neimplementiran**:

1. Korisnik iz browsera povezuje točno svoju PhotoCraft sesiju; grant se veže uz sesiju, app, root i mali skup dozvola. Prvo server source; laptop provider tek MCP-03.
2. Kratkotrajni slučajni secret, opoziv i expiry; secret nije u URL-u, logu ni git-u. Gateway endpoint za adapter mora provjeriti grant i na queued dispatchu. Opoziv sprječava sljedeće naredbe; ne tvrditi da može poništiti već izvršenu native izmjenu.
3. Adapter dohvaća samo bounded state/preview ili tipizirane akcije, uz obavezni expectedVersion i request ID za mutacije. Ne dobiva generički RPC, shell ni sve server/workspace ovlasti. Raw HTTP Basic račun nije scoped grant.
4. Za privatni/remote server lokalni bridge koristi odobreni HTTPS URL i grant; nema HTTP izvan loopbacka ni credential prosljeđivanja kroz redirect. Public Streamable HTTP za cloud klijente ide kasnije s provjerenim OAuth discovery/issuer/audience/scopes i odgovarajućim account/workspace politikama.
5. Browser dobiva mali state-version event ili bounded vidljivi polling, pa dohvaća snapshot kada vanjski kontroler promijeni stanje. Dok korisnik crta ili je operacija busy, ne zamijeniti stroke/preview usred interakcije. Queue guard ostaje posljednja provjera. Takav automatski push/poll još nije implementiran; sada se stale UI osvježava pri odbijenoj akciji.

Prije MCP save integracije izdvojiti postojeći gateway RPC dispatch u zajedničku funkciju koja zadržava share-online provjeru, focus/activity i `storage.settle`. Nemoj pozivati samo `photocraft.execute` pa zaobići laptop ACK. First prototype odbija laptop share dok taj tok nije povezan i testiran.

## RapidRAW: kasniji adapter

Pinned [vedranius/rapidraw-web, 38ddc8af](https://github.com/vedranius/rapidraw-web/tree/38ddc8af1bc51552fcab8781c4838b17082f97bd), vlastiti Creative Workspace runtime. Originalni RapidRAW: [CyberTimon](https://github.com/CyberTimon/RapidRAW). `src/rapidraw.js` sada daje identity/status i proxy, bez revision/RPC adaptera.

| Native/relay naredba | Izvor u pinned sourceu | Napomena |
| --- | --- | --- |
| `load_image`, `load_metadata` | `src-tauri/src/image_loader.rs`, `file_management.rs` | Otvaranje i postojeće prilagodbe |
| `apply_adjustments` | `src-tauri/src/lib.rs` | Preview obrađuje zajednički `original_image` |
| `generate_preview_for_path` | `src-tauri/src/lib.rs` | Preview eksplicitne putanje; root provjera i dalje potrebna |
| `save_metadata_and_update_thumbnail` | `src-tauri/src/file_management.rs` | Sidecar i thumbnail, ne flattened export |
| `export_images`, `cancel_export` | `src-tauri/src/export_processing.rs` | Worker je async; povratak poziva nije potvrda završetka |

Svi tabovi dijele native image/preview/export state. Load generation služi cancelu; relay seq/boot služi event replayu; nijedno nije document revision. Export completion/error/cancelled događaji su globalni, bez pouzdanog javnog job ID-a. React/Zustand adjustments/history ne ažuriraju se automatski iz MCP sidecara. Guard samo u MCP ruti bio bi zaobiđen postojećim `/ipc` browser pozivima. Prije MCP-03 presresti sve mutacije ili izolirati engine/sesije te povezati UI state i export job ID. Ne uključivati mutating RapidRAW tools prije toga.

## Provjera i sljedeći mali zadatak

- **18 lokalnih testova:** dvije konkurentne mutacije s istim tokenom; exact retry; legacy mutacija; reset native revizije; djelomičan native failure; opažena native promjena; neispravan token; postojeći path/auth/storage/recovery testovi.
- `scripts/smoke-photocraft-versions.mjs`: stvarni instalirani engine, painted midtone preview → brightness/contrast → konflikt druge mutacije → exact retry → drugi dokument/select → stale token rejection → undo → layered save/reopen (7,438 bajtova). Bez native rebuilda i bez restarta korisnikova editora.
- Browser fixture: vanjski RPC dodaje sloj; stale Add layer odbijen je i UI osvježen. Stale Save nakon promjene aktivnog dokumenta zatvara dijalog bez Replace prompta; izvorni layered file ostao je byte-identical i novi dokument nije spremljen pod starim nazivom.
- Sljedeće **MCP-02a**: lokalni session grant, tipizirani gateway dispatch i stdio SDK adapter za navedene server-only alate. Stvarni SDK/Inspector mora potvrditi tools listing + open/inspect/preview/adjust/undo/save-copy, revocation/expiry/conflict i browser refresh. **MCP-02b** proširuje provjeru na konkretan AI klijent i uređuje povezivanje u sučelju. Ne označiti remote OAuth ili laptop MCP podržanima prije njihovih provjera.
