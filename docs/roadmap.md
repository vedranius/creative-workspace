# Creative Workspace — plan razvoja

Ovaj dokument određuje redoslijed razvoja. [Stanje razvoja](development-state.md) sadrži kratku primopredaju za sljedeću sesiju. Plan se mijenja kada stvarni engine ili provjera pokaže drukčije mogućnosti; stavka je dovršena tek uz kod i dokaz rada.

## Cilj i pravila proizvoda

Kreativni studio kojem korisnik pristupa iz browsera na slabijem laptopu, dok server obrađuje dokumente i izvozi rezultate. Control panel bira aplikacije, projekte, lokaciju datoteka, instalacije i provjerene nadogradnje.

- Sučelja se izvršavaju nativno u browseru. Nema VNC-a, remote desktopa ni streamanja slike desktop sučelja. Engine smije slati pregled samog dokumenta.
- Svaka aplikacija ima vlastitu instalaciju i adapter. Postojeća korisnikova instalacija RapidRAW Weba ostaje zasebna.
- Datoteke mogu biti na serveru, na laptopu uz pristup na zahtjev, ili na laptopu uz pozadinsko kopiranje. Lokacija izlaza i zadržavanje kopije biraju se zasebno.
- Browser traži pristup samo odabranim datotekama/mapama. Nepodržani način rada mora imati jasno objašnjenje i dostupnu alternativu.
- Svaka kartica aplikacije navodi i povezuje originalni projekt, repo i autora/tim. Licence i izvedeni kod imaju dokumentirano podrijetlo.
- Linux, Windows i macOS ostaju cilj. Podrška gatewaya, pojedinog enginea i on-demand mounta provjerava se zasebno. Docker izdanje uključit će provjerene engineove.
- Kvaliteta se mjeri stvarnim otvaranjem, izmjenom, spremanjem, ponovnim otvaranjem i oporavkom dokumenta. Popunjena kartica u katalogu nije gotova aplikacija.

## Polazište, 10. listopada 2026.

RapidRAW ima zaseban Linux engine i browser editor. PhotoCraft ima zaseban Rust CLI engine, izolirane sesije i browser prototip za dokumente, slojeve, kist, prilagodbe, history i izvoz. Zajednički provider podržava on-demand, hybrid i copy-first; native Linux provjera potvrđuje čitanje odabranog dokumenta i spremanje natrag na laptop, bez čitanja nepovezane datoteke. Pravi browser picker s korisnikovom mapom još treba ručnu provjeru. Ostalih šest ArtCraft adaptera još nije implementirano. Docker trenutno sadrži gateway.

**REC-01, REC-02, MCP-01, PDF-01, VEC-01 i DES-01 dovršeni:** recovery UI, provjera verzije PhotoCraft sesije i stvarni PdfCraft/VectorCraft/DesignCraft browser adapteri nad vlastitim native engineom. RapidRAW, PhotoCraft, PdfCraft, VectorCraft i DesignCraft imaju radne tokove, a dashboard odvaja pet dostupnih editora od tri planirana projekta. LGT-01b je započet sigurnim recipe ugovorom/validatorom; browser/session gateway, UI, provider tok i acceptance još puštaju LightCraft u planned status. Sljedeći mali zadatak: gateway recipe/session save/load s ACK-om, zatim browser/FUSE acceptance. MCP-02a i automatski laptop replay ostaju kasnije.

## Redoslijed i kriteriji dovršenosti

| Faza | Rezultat za korisnika | Zadaci i provjera |
| --- | --- | --- |
| 1. Pouzdane datoteke | Prekid veze ne prikazuje lažno uspješno spremanje; korisnik pronalazi zadržani izlaz | **REC-01** trajni journal i pregled neacknowledged izlaza nakon ponovnog pokretanja; **REC-02** UI oporavka i preuzimanja; **REC-03** provjera verzije lokalne datoteke i izričito rješavanje konflikta; **REC-04** kvote cachea, reconnect i usporena veza; **REC-05** ručna provjera stvarnog laptop pickera i svih triju načina. U provjerama prekinuti vezu prije i tijekom spremanja; potvrditi sadržaj i izolaciju mapa. |
| 2. Instalacija u panelu | Install, status, log, pokretanje i gašenje u jednom sučelju | **INS-01** trajni red poslova za postojeće upravljane installere, jedan build odjednom; **INS-02** panel s napretkom/fazom, logom, greškom i ponovnim pokušajem; **INS-03** provjera verzije, healtha, vlastitog identiteta i preduvjeta; **INS-04** otkazivanje samo vlastitih procesa i oporavak nedovršene instalacije. Prvo postojeći RapidRAW, PhotoCraft i storage helper. Ne objavljivati djelomičan build kao spreman. |
| 3. Zajednički adapter i PhotoCraft | Predvidljivo ponašanje otvaranja, spremanja i alata u svim editorima | **ADP-01** implementirati verzionirani ugovor sesije/komande/sposobnosti, koristeći postojeće stvarne RPC metode; **PC-01** inventar i implementacija preostalih važnih alata/dijaloga; **PC-02** autosave na serveru i oporavak od pada enginea; **PC-03** tipkovnica, stylus, pristupačnost i responzivni layout. Svaka implementirana opcija ima stvarni engine učinak; prijenos dokumenta nije browser obrada originala. |
| 3a. AI upravljanje kroz MCP | Korisnikov AI klijent upravlja dokumentom, a server izvršava obradu | **MCP-01** audit stvarnih komandi i dozvola; **MCP-02** PhotoCraft prototip s previewom, korekcijom, undo i save-copy; **MCP-03** RapidRAW, batch i laptop provider. **AI-01–03** recepti i audit specijaliziranih lokalnih AI modela. Detalji, kandidati, subscription granice i kriteriji u [AI/MCP planu](ai-assistant.md). |
| 4. PDF i vektori | Još dva stvarno upotrebljiva browser editora | **PDF-01** i **VEC-01** dovršeni kao Linux/browser prototipi. Daljnja puna kompatibilnost ostaje zasebna. Početni kriteriji: pregledati pinned PdfCraft/VectorCraft source i dostupne headless komande; izdvojiti engine ako je potrebno, bez desktop transporta. Za svaki izraditi zasebnu instalaciju i browser UI, otvoriti reprezentativan dokument, izmijeniti, izvesti i ponovno otvoriti rezultat. Definirati zasebne podzadatke nakon audita, prije obećavanja pune kompatibilnosti. |
| 5. Publikacije i foto biblioteka | Layout stranica i organizacija/razvoj fotografija prema mogućnostima projekata | **DES-01** dovršen kao native Linux/browser prototip za tekstualne publikacije, reflow i PDF. IDML/linked media/fonts ostaju follow-up. **LGT-01a** native CPU temelj dovršen: synthetic Bayer DNG/JPEG obrada i izolirani read/write hookovi. Sljedeći je **LGT-01b** browser/session adapter s ACKed editable recipes i common file providerom; nije dostupna aplikacija dok browser/FUSE tok ne prođe. Provjeriti koji dio rendering/preview procesa ostaje na serveru i koji je prikaz u browseru. Format dokumenta, fontovi i nedostajući asseti imaju jasna stanja. |
| 6. Video i kompoziting | FilmCraft i EffectCraft s timelineom, server previewom i izvozom | **FIL-01**, **FX-01** prvo audit enginea/codecova/GPU potreba. Zatim zasebni mali zadaci za media probe, proxy izradu, timeline komande, sinkroniziran playback, render queue, cancel i izvoz. Preview koristi proxy/segment; završni render originale iz odabranog providera. Provjeriti veliku datoteku, seek, prekid mreže i audio/video sinkronizaciju. |
| 7. Nadogradnje i proširenja | Provjerena nadogradnja s povratkom na prethodnu verziju | **UPD-01** katalog pinned verzija, adapter kompatibilnost i digest; **UPD-02** staging instalacija, health/proba i rollback; **UPD-03** migracije uz backup; **EXT-01** import repozitorija uz valjani adapter manifest, pregled dozvola i izolirani build. Sam GitHub link ne može automatski pretvoriti proizvoljnu desktop aplikaciju u browser editor; nepodržani repo dobiva izvještaj i potreban adapter. |
| 8. Projekti i više korisnika | Osobni projekti, ograničene mape i resursi servera | **AUTH-01** identitet i server sessions; **PRJ-01** projekti i članstvo; **ACL-01** dozvole po projektu/adapteru/provideru; **JOB-01** red CPU/GPU poslova i kvote. Dva korisnika ne mogu pristupiti tuđoj sesiji, shareu, outputu ni recovery zapisu. |
| 9. Jednostavno self-hostanje | Ponovljiva instalacija s engineovima i pristupom izvana | **PKG-01** engine-enabled Linux Docker image i Compose profile; **PKG-02** Windows engine/WinFsp provjere; **PKG-03** macOS engine/copy-first provjere i zaseban audit on-demand rješenja; **DEP-01** HTTPS/reverse proxy/Cloudflare Access vodič i provjera browser permission/origin ponašanja; **BKP-01** backup/restore statea i projekata. Mount dozvole se daju samo profilu koji ih treba. |
| 10. Izdanje | Lijep, pristupačan studio koji korisnik može pouzdano koristiti | **UX-01** jedinstven kreativni dizajn, prazan sadržaj, loading/error/recovery stanja; **QA-01** matrica browser/OS/engine/format; **PERF-01** mjerene performanse i granice; **REL-01** verzionirano izdanje, instalacijske upute, migracije i poznata ograničenja. Produkcijski status dobiva samo provjereni skup sposobnosti. |

Faza 1 i osnovni install panel prethode drugim adapterima. Audit sljedećeg enginea može se raditi uz izoliranu neovisnu stavku, ali istu radnu kopiju mijenja samo jedan razvojni posao. Opća nadogradnja/dodavanje proizvoljnog repozitorija dolazi nakon provjerenog ugovora adaptera. Višekorisničke dozvole prethode javnom višekorisničkom izdanju.

## Dovršenost pojedinog zadatka

1. Zapisati konkretan problem i mali opseg, uz broj stavke.
2. Implementirati stvarno ponašanje te jasno stanje za nepodržanu sposobnost.
3. Pokrenuti relevantnu provjeru. Za promjene gatewaya/providera pokrenuti `npm run check` i `npm test`; native build samo kada se mijenja native engine ili installer.
4. Za novi editor dokazati native engine + browser tok. Fixture provjeru, ručnu provjeru i neprovjereno ponašanje označiti odvojeno.
5. Dopuniti dokumentaciju i primopredaju, objaviti običan commit na korisnikov repo i provjeriti CI. Ne skrivati pad ili nedovršen native build.

## Automatizirani razvoj i potrošnja

Korisnik je autorizirao nastavak razvoja, objavu na `vedranius/creative-workspace`, lokalno testiranje i zasebne sesije po featureu/updateu. Automatizacija bira sljedeću spremnu malu stavku iz ovog plana i završava je s provjerama. Jedan aktivan posao mijenja checkout; nova sesija čita ovaj plan, stanje i relevantne datoteke umjesto cijelog razgovora.

Repo je spremljen kao lokalni Codex projekt. Korisnik je 11. listopada izričito zatražio novu sesiju za svaki feature/update. Satna automatizacija sada je standalone: svako pokretanje polazi od kratkog prompta i repo primopredaje. Samo jedan writer smije uređivati checkout; ako prethodna sesija još radi, čeka dopuštenja ili ostavlja nejasne izmjene, iduće pokretanje ne započinje paralelni rad ni retry sesiju. Nakon jednog malog podzadatka zapisati konkretan sljedeći korak za novu sesiju. Ovaj izvorni razgovor služi koordinaciji. Nova sesija smanjuje prenesenu povijest, ali ne jamči određenu uštedu i automatizacije i dalje troše usage.

Svaka primopredaja ima: broj zadatka, završni commit, promijenjeno ponašanje, rezultate provjera, konkretno nedovršeno, prvi sljedeći korak. Korisniku javiti značajan dovršeni rezultat, kvar ili potrebno odlučivanje; ne proizvoditi poruke za nepromijenjeno stanje.

Lokalni raspored ovisi o uključenom računalu, pokrenutoj desktop aplikaciji, dostupnom repozitoriju i dopuštenjima za potrebne alate. Raspored razvoja je razvojna automatizacija; provjera GitHub ažuriranja za krajnje korisnike ostaje zasebna funkcija Creative Workspace servera.
