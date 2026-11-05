# Cloudflare demo redesign handoff

## Što se mijenja

Javna stranica je statički Cloudflare Pages demo na <https://creative-workspace.geekranius.stream/>; Pages fallback host je <https://creative-workspace-demo.pages.dev/>. Izvor za portal i vizualni identitet demo stranice je `cloudflare/demo/`:

- `index.html` — početni sadržaj, struktura i tekst portala.
- `demo.css` — izgled početne stranice, kartica, layouta aplikacije i ekrana za pristanak.
- `base.css` — zajednički osnovni stil za portal i prikaz aplikacije.
- `demo.js` — učitava `demo-manifest.json`, crta kartice i ekrane aplikacija te upravlja pristankom i učitavanjem iframea.
- `wasm-transport.js` — Service Worker za eksplicitno dozvoljene WASM resurse. Ne mijenjati za vizualni redizajn.

Geekranius brand kit resursi nalaze se lokalno u `cloudflare/demo/brand/`: favicon, monogram, ikona/sprite, mascot, lokalni Orbitron/Exo 2/Inter fontovi i njihove licence. Builder `scripts/build-cloudflare-demo.mjs` priprema `build/cloudflare-demo/`; Wrangler projekt i output putanja su zabilježeni u `cloudflare/wrangler.jsonc`. `/apps/<id>/` koristi isti `index.html`, dok `demo.js` odabire prikaz prema putanji.

## Granice dizajna

Promjene boja, tipografije, spacinga, responsive pravila, hero sekcije i kartica obično pripadaju `demo.css`. Promjena teksta i semantičke strukture početne stranice ide u `index.html`. Ako mijenjaš raspored kartica ili elemente koji se stvaraju nakon učitavanja, uskladi DOM iz `demo.js` s CSS-om. Sačuvaj pristupačne nazive, vidljive focus stateove i mobilni layout.

Demo obrađuje sadržaj na posjetiteljevu računalu, ne na Cloudflare serveru. Zadrži jasno objašnjenje browser processinga, laptop mode oznake i zasebne stranice pristanka prije iframe učitavanja. Nemoj uklanjati atribuciju, licence, provenance linkove ili postojeća ograničenja. Redizajn vizualno ne mijenja manifest, originalne aplikacije ni `wasm-transport.js`.

## Lokalni pregled

Za brz vizualni pregled portala, otvori `cloudflare/demo/index.html` preko lokalnog statičkog HTTP servera. Portal je objavljen iz alpha.78 commit `1447c70`; Pages deploy run `42126520325` verificirao je svih 13 aplikacija i uključio aktivnu custom domenu. Za ponovnu lokalnu provjeru s aplikacijama potrebni su provjereni UI paketi; oni se ne čuvaju u Git repozitoriju. Builder namjerno odbija popunjen output direktorij, zato koristi samo novi prazan direktorij i nikad ne stavljaj privatne fajlove u deployment output.

```sh
# Iz repo root-a: vizualni pregled samog portala
python3 -m http.server 4173 --directory cloudflare/demo

# Potpuni build nakon što postoji verificirani UI registry:
node scripts/build-cloudflare-demo.mjs /absolute/path/to/verified-ui-registry /absolute/path/to/new-empty-output

# Browser launch/isolation/transport provjera pripremljenog outputa:
node scripts/verify-cloudflare-demo.mjs /absolute/path/to/built-output /absolute/path/to/proof-output
```

U ovom checkoutu postoji veći set nepovezanih lokalnih izmjena, uključujući izmijenjen `scripts/build-cloudflare-demo.mjs`; prije builda usporedi ga s trenutnim branchom i nemoj ga resetirati ili prepisati. Za čisti vizualni pregled nije potrebno pokretati builder.

## Objava

Objava je zaseban korak i mijenja javni Pages sajt. Dokumentirani projekt je `creative-workspace-demo`, output `build/cloudflare-demo`, a deploy koristi ovlašteni Wrangler login ili GitHub Actions workflow `.github/workflows/artcraft-demo.yaml`. Prije ručnog deploya napravi build u novom praznom direktoriju, pregledaj stranicu i provjeri da je output samo javni sadržaj; zatim slijedi komande i credential pravila iz [Cloudflare demo dokumentacije](cloudflare-demo.md#build-and-publish). Ne kopiraj Wrangler/GitHub credentials u chat, source ili dokumente.

Promjena stranice može zahtijevati novu Creative Workspace SemVer verziju prema pravilima repozitorija. Ne mijenjaj upstream engine pinove zbog samog redizajna. Zabilježi promjene u changelog/development handoff i dokaži rezultat previewom prije objave. Trenutno stanje i automatizirani objavni tok su opisani u [deployment handoffu](cloudflare-demo-handoff.md).
