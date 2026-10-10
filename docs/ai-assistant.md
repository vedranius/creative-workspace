# AI upravljanje kreativnim aplikacijama

Status: MCP-01 audit i PhotoCraft provjera verzije sesije su implementirani; MCP endpoint i AI engine još nisu. Detalji stvarnih naredbi, transporta/dozvola, dokaza i ograničenja su u [MCP auditu](mcp-adapter-audit.md). Korisnik je 10. listopada 2026. predložio automatsku obradu nalik Evotu i AI klijent koji kroz MCP upravlja našim aplikacijama. Ovo proširuje studio: skupa obrada ostaje na serveru, a korisnik može raditi iz browsera.

## Glavni način rada: AI klijent + Creative Workspace MCP

Claude, ChatGPT/Codex ili drugi kompatibilni klijent poziva ograničene alate našeg MCP servera. MCP adapter prevodi alat u provjerenu komandu aplikacijskog enginea i vraća rezultat, stanje posla ili pregled dokumenta. AI bira korake i procjenjuje rezultat; originalni dokument obrađuje postojeći native engine. Browser prikazuje stvarno stanje istog dokumenta, uz undo i pregled AI promjena.

Primjer: korisnik kaže „Ujednači boje ovih portreta, malo podigni ekspoziciju i sačuvaj kopije.” Klijent odabire fotografije unutar odobrenog projekta, pregledava manje previewe, poziva korekcije, uspoređuje rezultat i pokreće batch export u odabranu lokaciju. Velike originale i obradu drži server; prema vanjskom AI-ju odlaze samo izričito odabrani podaci/pregledi.

Predloženi alati (imena su nacrt):

| Alat | Svrha |
| --- | --- |
| `workspace_list_apps`, `workspace_list_files` | Sposobnosti instaliranih adaptera i datoteke odobrenog projekta |
| `document_open`, `document_inspect`, `document_preview` | Otvaranje, slojevi/revizija i manji pregled koji AI može analizirati |
| `photo_adjust`, `layer_set`, `document_undo` | Tipizirane izmjene s rasponima parametara; provjera očekivane revizije |
| `document_save_copy`, `document_export` | Novi izlaz, odabran format/provider i potvrđeno spremanje |
| `batch_start`, `job_status`, `job_cancel` | Ograničena skupna obrada, mjerljiv napredak i prekid |

Svaki zahtjev ima projekt/sesiju, request ID i očekivanu reviziju. UI promjene objavljuju događaje pa browser prati i rad vanjskog AI klijenta. Dozvole ograničavaju mape i aplikacije. MCP ne izlaže shell, generički filesystem ni proizvoljne skripte. Laptop on-demand agent ostaje povezan u browseru; MCP mu pristupa kroz zajednički provider i postojeći grant. Spremanje na laptop i dalje čeka završnu potvrdu, a nesigurni izlazi koriste recovery journal.

## Pretplata i mjesto AI izvršavanja

1. **Vanjski AI klijent preko MCP-a:** model koristi plan/usage tog klijenta; Creative Workspace izvršava svoje engine naredbe. MCP sam ne zahtijeva OpenAI/Anthropic API ključ. Ako neki alat poziva dodatnu plaćenu uslugu, taj poziv ima zaseban trošak.
2. **AI ugrađen u naš browser UI:** plaćeni API je zasebna opcija s korisnikovim ključem, procjenom troška i limitom. Podržani službeni subscription OAuth treba provjeriti za konkretno osobno/server/višekorisničko izdanje.
3. **Lokalni modeli na serveru:** server izvršava otvorene modele i workflowe; trošak su hardver i rad servera. Provjeriti licence koda i svakog modela zasebno.

Claude ima [remote MCP konektore](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) i [desktop extensions](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop). Remote konektor dolazi iz Anthropicove infrastrukture čak i kada korisnik radi u Desktopu; mora imati dostupnu i pravilno autentificiranu rutu. Lokalni desktop bridge zasebna je opcija za privatnu mrežu. Browser login stranica na Cloudflare Accessu sama po sebi nije MCP autentifikacija.

ChatGPT podržava [custom MCP plugin s read/write alatima](https://developers.openai.com/api/docs/guides/custom-mcp-server); provjeriti dostupnost i politike konkretnog računa. [Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source) zasebno omogućuje eligible zahtjeve koristeći plan za podržane open-source/lokalne aplikacije; za plaćene/remote hosted aplikacije dokumentacija upućuje na prijavu interesa. To nije dokaz da su svi image modeli i svaki oblik našeg hostanja uključeni. Obični API billing ostaje zaseban. Claude API također ima zaseban Console billing; aktualna [dokumentacija](https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-is-claude-api-usage-billed-separately-from-my-paid-claude-plan) navodi API kredite za određene Max/Team planove, uz zaseban setup.

## Otvoreni kandidati za stvarnu AI obradu

| Projekt i tim | Moguća uloga |
| --- | --- |
| [ComfyUI — Comfy-Org](https://github.com/Comfy-Org/ComfyUI) | Server workflow engine i API; ponovljiva automatizacija, generativne izmjene i batch poslovi |
| [InvokeAI — invoke-ai](https://github.com/invoke-ai/InvokeAI) | Gotov browser canvas, maskirano uređivanje i workflowi; alternativa za AI kreativni editor |
| [rembg — Daniel Gatis i suradnici](https://github.com/danielgatis/rembg) | Uklanjanje pozadine kroz Python/CLI/HTTP/Docker adapter |
| [Real-ESRGAN — Xintao Wang i suradnici](https://github.com/xinntao/Real-ESRGAN) | Kandidat za upscale/restoration; zasebno provjeriti održavanje, kompatibilnost i modele prije instalacije |

Evoto daje [batch obradu](https://www.evoto.ai/features/batch-edits) i specijalizirane alate za retuš, uz vlastiti [credit model](https://support.evoto.ai/feature-page-pricing-faqs/). Koristit ćemo ga kao funkcionalnu referencu. Ugradnja baš njegova enginea ovisi o službenom dostupnom API-ju i uvjetima integracije. MCP sam ne daje modele za kvalitetan retuš kože; očuvanje teksture, dosljednost serije i precizne maske moraju proći stvarne evaluacije.

## Zadaci i prihvat

- **MCP-01 — dovršeno:** inventar PhotoCraft/RapidRAW naredbi i ugovor prvog prototipa; queue version guard s native/browser dokazima. Povezana sesija treba scoped grant i UI state push/poll, još neimplementirano.
- **MCP-02a:** implementirati single-user server-only session grant + stdio SDK adapter za PhotoCraft; otvori → inspect/preview → brightness/contrast → undo → save copy. Provjeriti SDK/Inspector, opoziv/expiry/konflikt i browser refresh bez lažnog enginea. **MCP-02b:** setup i provjera konkretnog AI klijenta.
- **MCP-03:** proširiti na vlastiti RapidRAW, batch red i laptop provider; testirati idempotenciju, revizijske konflikte, gubitak veze i oporavak.
- **AI-01:** implementirati recepte za kontrolirane fotografske korekcije kroz postojeće engineove; AI u klijentu bira parametre, korisnik dobiva prije/poslije i promjene koje može poništiti.
- **AI-02:** audit i instalacijski manifest jednog specijaliziranog lokalnog AI backend-a; mjeriti kvalitetu, VRAM/RAM i vrijeme rada. Nema preuzimanja velikih modela ili plaćenih poziva samo radi plana.
- **AI-03:** evaluacija portrait/batch kvalitete na reprezentativnim korisničkim primjerima, uz masku, intenzitet i dosljednost. Ne obećavati Evoto ekvivalent prije te provjere.

REC-02 UI oporavka i MCP-01 audit/version guard su implementirani. Sljedeći je MCP-02a scoped adapter prema auditu. Višekorisnički MCP endpoint zahtijeva AUTH/ACL fazu prije produkcijske dostupnosti.
