# Plan portanja originalnih aplikacija

Datum: 11. listopada 2026. Ovaj plan provodi [obvezni zahtjev za originalne aplikacije](original-app-requirements.md) i određuje novi redoslijed u [roadmapu](roadmap.md). Stanje i sljedeći zadatak zapisujemo u [primopredaju](development-state.md).

## Rezultat koji gradimo

Creative Workspace pokreće originalna ArtCraft sučelja u browseru, dok vlastiti engineovi na serveru obrađuju dokumente, fotografije, video i izvoze. Zadržavamo izvorne menije, alate, panele, dijaloge, prečace i radne tokove. Control panel upravlja aplikacijama, projektima, datotekama, instalacijama i provjerenim nadogradnjama. Nema remote desktopa ni prijenosa slike desktop sučelja; dopušteni su pregledi samog dokumenta i medija.

Korisnik je pregledao originalni DesignCraft UI na portu 8813 i potvrdio smjer. Taj pregled još koristi lokalni WASM engine. Potvrda izgleda ne mijenja cilj obrade na serveru niti dokazuje dovršenost svih funkcija.

## Polazište i izvorni kod

Izvori su provjereni na navedenim revizijama; to nisu tvrdnje da su njihove browser verzije već izgrađene ili integrirane. Putanje su unutar odgovarajućeg upstream repozitorija. Izvorni UI i engine uvijek prate istu reviziju.

| Aplikacija / originalni projekt | Kandidat revizije | Izvorni browser ulaz | Trenutni dokaz |
| --- | --- | --- | --- |
| [DesignCraft — storytold](https://github.com/storytold/designcraft) | `a127c6d5c3576972bbd60445f26d893db071eef3` | `apps/designcraft-web`, zajednički `DesignApp` | Originalni UI izgrađen i pregledan u browseru; server veza nedovršena |
| [PhotoCraft — storytold](https://github.com/storytold/photocraft) | `29d5f791d52cd54e411611a609fbc56949e0c653` | `apps/photocraft-web`, zajednički `PhotocraftApp` | Originalni WASM UI izgrađen i provjeren na `127.0.0.1:8814`; server obrada/provider integracija slijede — [dokaz](photocraft-original-ui-preview.md) |
| [VectorCraft — storytold](https://github.com/storytold/vectorcraft) | `96344f07617edb24ab22fa08430ad1389042811d` | `apps/vectorcraft-web`, zajednički `VectorcraftApp` | Originalni WASM UI izgrađen i provjeren na `127.0.0.1:8815`; server obrada/provider integracija slijede — [dokaz](vectorcraft-original-ui-preview.md) |
| [PdfCraft — storytold](https://github.com/storytold/pdfcraft) | `9ccf77bdf685bc3cb0f545865c9f9b3e97ab5025` | `apps/pdfcraft-web`, zajednički `PdfCraftApp` | Originalni WASM UI izgrađen i provjeren na `127.0.0.1:8816`; server obrada/provider integracija slijede — [dokaz](pdfcraft-original-ui-preview.md) |
| [LightCraft — storytold](https://github.com/storytold/lightcraft) | `9e6c4c6fc9c7a7f192ce846c00ceb531e0f64dda` | `apps/lightcraft-web`, zajednički `lightcraft-ui-egui` | Originalni UI build i browser preview dokazani na `127.0.0.1:8817`; server/provider integracija slijedi — [dokaz](lightcraft-original-ui-preview.md) |
| [FilmCraft — storytold](https://github.com/storytold/filmcraft) | `4e2d0bc2d3646f9cf27ef7aa8b2095c6858c7efe` | `apps/filmcraft-web`, zajednički `FilmcraftApp` | Originalni WASM UI izgrađen i provjeren na `127.0.0.1:8818`; server processing/provider integracija slijede — [dokaz](filmcraft-original-ui-preview.md) |
| [EffectCraft — storytold](https://github.com/storytold/effectcraft) | `9a7d3e76991d5372448033b473dc12c2480a6a04` | `apps/effectcraft-web`, shared `effectcraft-ui-egui` | Originalni UI izgrađen i provjeren na `127.0.0.1:8819`; headless frame-worker smoke blokira WebGPU adapter u SwiftShaderu — [dokaz](effectcraft-original-ui-preview.md) |
| [RapidRAW — CyberTimon](https://github.com/CyberTimon/RapidRAW), [web fork — vedranius](https://github.com/vedranius/rapidraw-web) | `38ddc8af1bc51552fcab8781c4838b17082f97bd` web forka | Postojeći izvorni web fork, zasebna upravljana instalacija | Postojeća integracija ostaje; zasebna provjera/pakiranje datoteka i OS podrške |

PhotoCraft/PdfCraft/VectorCraft/DesignCraft trenutno imaju i vlastite ograničene HTML prototipove. Oni ostaju sačuvani za postojeće dokumente, ali ne predstavljaju cilj ovog plana. LightCraftov vlastiti preview također nije originalni port. GIMP/PhotoGIMP nisu u opsegu.

## Redoslijed razvoja

### A. Originalna sučelja za pregled

**DesignCraft PAR-02 i originalni UI previewi PhotoCraft, VectorCraft, PdfCraft, LightCraft, FilmCraft i EffectCraft ORG-FX-UI su dovršeni.** EffectCraft build i browser evidence imaju poznato ograničenje headless GPU worker smokea; vidi [preview evidence](effectcraft-original-ui-preview.md). Slijedi konkretni DesignCraft PAR-03 server seam. Ovaj prolaz korisniku omogućuje pregled izvornog izgleda svih aplikacija. Svaki preview jasno navodi koristi li lokalnu obradu; preview ne postaje dostupna server aplikacija samim buildom.

Za svaku stavku `ORG-<APP>-UI`:

1. Napraviti clean detached checkout točno navedene revizije, odvojen od native wrappera i korisnikovih instalacija. Pročitati njegov web build postupak i relevantne upstream upute. Koristiti već instalirane build alate/cache kada odgovaraju; DesignCraftovi Rust 1.99.0 i Trunk 0.21.14 polazna su provjerena infrastruktura, ne unaprijed potvrđena kompatibilnost za sve aplikacije.
2. Izgraditi originalni browser ulaz i zajednički UI. Ne zamijeniti ga novim HTML editorom. Nužne portability izmjene spremiti kao mali reproducibilni patch set u repo, s originalnom revizijom i licencama.
3. Pokrenuti zaseban localhost preview bez restarta postojećih dokumenata. Zabilježiti stvarni URL tek nakon uspješnog starta i HTTP/browser provjere.
4. U browseru provjeriti originalne menije, reprezentativan dijalog, grupe alata/panele i canvas/timeline. Sačuvati screenshotove, konzolne greške, verziju/browser i izvorne registre. Usporedbu s native aplikacijom pratiti odvojeno; dijeljenje istog UI izvora nije samo po sebi dokaz svih funkcija.
5. Spremiti dokaz, točan build/start postupak i sljedeći korak. Nema ponavljanja uspješnog audita ili instalacije alata kao novog featurea.

### B. Izvorni UI povezan sa serverom

Referentni port je **DesignCraft PAR-03**, zatim PhotoCraft → VectorCraft → PdfCraft → LightCraft → FilmCraft → EffectCraft, kako je korisnik ponovno potvrdio. DesignCraft sample/read-model bridge je prvi djelomični korak; nakon njega dovršiti originalne command/state/edit/render/provider/save/reopen/recovery tokove prije prelaska na sljedeću aplikaciju. Nastaviti konkretni [PAR-03 handoff](par-03a-handoff.md), bez preview repriza, demo razvoja ili novog praznog audita.

Zajednički gateway osigurava autentikaciju, Origin, sesiju, revizije, red komandi, datoteke i ograničenja resursa. Svaka aplikacija dobiva vlastiti backend za svoje izvorne komande, stanje, render i formate. Ne pretpostavljamo da jedan generički wrapper može zamijeniti različite engineove.

Svaki `ORG-<APP>-SERVER` dijeli se na male stvarne implementacije:

1. **Komanda i stanje:** server je autoritativni vlasnik dokumenta/sesije; originalni UI dobiva verzionirano stanje za svoje panele i dijaloge. Očuvati originalne ID-jeve i redoslijed pointer/tool akcija. Zastarjeli odgovor ne smije zamijeniti novije stanje.
2. **Canvas/preview:** obrada i render na serveru; originalni UI prikazuje ograničen rezultat vezan uz reviziju i viewport/frame. Dokazati server izvršavanje mjerenjima worker komandi/revizija/rendera, a ne samo mrežnim zahtjevom uz lokalnu obradu.
3. **Preostali izvorni alati:** inventar svakog menija, dijaloga, prečaca, tool akcije i formata na istom upstream pinu. Za svaki provjera ili konkretan pending razlog. Prototip s jednom komandom nije kompletan port; ne sakrivati nepovezane alate da bi izgledao gotov.
4. **Browser host integracije:** izvorni file dijalozi, clipboard, fontovi, drag/drop, print i drugi OS servisi dobivaju browser/server ekvivalente koji zadržavaju radni tok i poštuju browser dozvole. Razlike i nedovršeni tokovi ostaju u inventaru do provjere.

| Aplikacija | Posebni tokovi za prihvatljivost originalnog porta |
| --- | --- |
| DesignCraft | Izvorni layout/typography alati, story reflow i overset, višestranice, fontovi/linked media, native dokument i PDF izvoz |
| PhotoCraft | Izvorni brush/stylus tokovi, slojevi/maske/selekcije, prilagodbe i history, native dokument/PSD i izvoz; ne lokalna obrada originalnih piksela na laptopu |
| VectorCraft | Izvorni path/node/pen alati, transformacije, tekst/fontovi, styling, native/SVG i izvozi; potvrditi preciznost pointera uz server latency |
| PdfCraft | Izvorni reader/stranice/annotacije i ostale pinned funkcije, undo, native save/export; provjeriti više dokumenata i velike PDF-ove |
| LightCraft | Izvorni library/develop UI, odabrani RAW decoderi, recepti i sidecar tokovi, batch i izvoz; server katalog/obrada umjesto laptop OPFS workera |
| FilmCraft | Izvorni timeline, trim/seek, titlovi/efekti/audio tokovi, media relink; server probe/proxy/decode/render i browser playback s audio/video sinkronizacijom |
| EffectCraft | Izvorni composition/timeline/graph/effect paneli, keyframe tokovi, nested media/fontovi i render queue; server preview/render uz originalni UI |

Ovo je popis područja provjere, ne tvrdnja da su već implementirana ili da svaki navedeni format na svakom OS-u prolazi. Potpun inventar nastaje iz originalne revizije. Za FilmCraft/EffectCraft provjeriti CPU/GPU/codec mogućnosti i server playback arhitekturu prije claims; niti jedan preview ne smije streamati desktop UI.

### C. Datoteke, oporavak i integracija u studio

Za svaku aplikaciju `ORG-<APP>-FILES` koristi isti provider ugovor, uz izvorne import/save/relink tokove:

| Način rada | Ponašanje |
| --- | --- |
| Server | Korisnik odabire dopušteni server folder; engine čita i piše unutar njega |
| Laptop on-demand | Browser dobiva dozvolu za odabrane datoteke/mapu; server traži potrebne bajtove tijekom rada, bez prethodnog kopiranja cijele mape |
| Hybrid | Aktivne datoteke dostupne su odmah; odabrani ostali sadržaj kopira se u pozadini uz vidljivo stanje i mogućnost otkazivanja |
| Copy-first | Odabrane radne datoteke najprije se prenesu; rad se nastavlja nad server kopijom |

Lokacija spremanja i zadržavanje server kopije zasebni su izbori. Server i dalje mora dobiti bajtove potrebne za obradu on-demand dokumenta; način rada smanjuje nepotreban prijenos, ne uklanja ga. Za linked media/fontove/relink također treba izričit pristup, bez čitanja susjednih privatnih datoteka.

Prihvatljivost: otvoriti korisnički dopušteni dokument → izmijeniti izvornim alatom → spremiti na odabrano odredište → dobiti potvrdu zapisa → ponovno otvoriti i potvrditi sadržaj. Export nije potvrda spremanja radnog dokumenta. Provjeriti prekid mreže, reconnect, uncertain output/recovery i konflikt s novijom lokalnom datotekom; ne replayati preko nje niti prepisivati originale. Fixture test ne zamjenjuje pravi browser permission test. FUSE/on-demand mogućnost provjerava se po hostu i OS-u.

Tek nakon server/provider dokaza i pune provjere originalnih funkcija zamijeniti launch link originalnim portom u studiju. Aktivacija čeka spremljene dokumente ili čuva staru sesiju/version bundle dok je korisnik ne zatvori. Preview i ograničeni prototip imaju zasebne oznake.

### D. Nadogradnje, instalacija i izdanja

1. Za svaki originalni repo pratiti releases/tagove prema njegovu stvarnom izdavanju. Postojeći panel samo provjerava latest stable release; tag fallback, staging i automatska instalacija još su zasebni implementacijski zadaci.
2. Nadogradnja uvijek nosi originalni UI i engine iz iste nove revizije, uz pripadajući protocol/schema/provider ugovor. Rebase malog patch seta, izvorni inventar novih/izmijenjenih funkcija, vizualna i funkcionalna provjera, format migracije uz backup.
3. Izgraditi kandidat, provjeriti health/parity/datoteke i Actions target dokaze, tek zatim ponuditi aktivaciju. Neuspješan kandidat ostaje pending uz konkretnu grešku; prethodni bundle i backup omogućuju rollback. Zaštititi nespremljene aktivne sesije.
4. Instalacija u panelu koristi samo provjerene adaptere/installere s redom poslova, logom, cancel/recovery i OS sposobnostima. Repo URL bez odgovarajućeg adaptera ne pokreće proizvoljni GitHub kod.
5. Svaka dovršena feature/fix verzija dobiva novi Creative Workspace SemVer, changelog, overview/goal/install/release docs i normalni push. GitHub Actions grade target assete za Linux x64, Windows x64 i macOS arm64 s Node runtimeom, owned engineovima, originalnim UI-jem, fontovima/resursima, pin/capability manifestom, licencama i SHA256. Intel Mac i ostali targeti dobivaju podršku tek uz zaseban dokaz.
6. Docker/Compose s engineovima, HTTPS/reverse proxy i Cloudflare Access provjere slijede nakon prihvaćenih portova. Ne prikazivati gateway-only image kao kompletni kreativni paket. Izdanje ostaje draft kada nedostaje dokaz za assete; prototype/prerelease oznaka ostaje do prihvaćenog opsega.

## Evidencija i automatizirani nastavak

Svaka aplikacija ima odvojena stanja: **originalni UI source potvrđen → originalni UI runnable → server-backed → provider-integrated → puna parity provjerena → OS/bundle prihvaćen**. Posljednje stanje ne slijedi automatski iz prethodnog. Za svako zabilježiti commit/pin, dokaz i konkretno preostalo; dashboard koristi dokaze, ne samo `engine.ready`.

Jedna nova sesija po malom zadatku, jedan writer u checkoutu. Plan → implementacija → relevantne provjere → compact handoff → normalni commit/push → CI; produktne promjene uključuju verziju i Actions release. Čisti plan/evidence docs koriste docs-only gate bez ponovnog izdavanja iste verzije. Automatizacija čita ovaj redoslijed i posljednju primopredaju; ne otvara retry petlje niti ponavlja dovršene audite/buildove.

**Prvi sljedeći zadatak: nastaviti DesignCraft PAR-03** iz konkretnog [PAR-03 handoffa](par-03a-handoff.md): isolated pinned-source candidate now bridges original A4 `file.new`, Rectangle Tool `frame.create`, Ctrl+Z `edit.undo`, Ctrl+Shift+Z `edit.redo`, and Type Tool `text.placeCaret` plus ACKed caret hydration; rapid `text.insert` ACK ordering is browser-proven. The alpha.31 candidate binds original bootstrap/Open to the selected on-demand provider and exposes separate Save a Copy destination/retention choices. The cumulative candidate remains unregistered; real browser folder permission/write ACK, uncertain-output recovery and remaining original action parity must pass before DesignCraft is accepted or work moves to PhotoCraft. All other original previews remain browser-local WASM previews, not server-backed ports.
