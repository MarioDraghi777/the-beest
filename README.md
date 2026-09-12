# The Beest

Web app per gestire schede, piano annuale e allenamenti in palestra, con un
catalogo di 1.324 esercizi illustrati in italiano.

Mobile-first, installabile come PWA, funziona offline. **Nessun account,
nessun server, nessun database remoto**: i dati stanno nel browser di chi la
usa, e le schede si condividono con un link che contiene la scheda stessa.

---

## Come è fatta

| | |
|---|---|
| Frontend | Preact + `@preact/signals`, TypeScript, Vite |
| Dati utente | IndexedDB via Dexie |
| Catalogo | JSON statico precaricato dal service worker (980 KB, 120 in gzip) |
| Offline | `vite-plugin-pwa` (Workbox) |
| Media | repo separata, WebP 180×180 |
| Hosting | GitHub Pages, deploy da GitHub Actions |
| Test | Vitest |

Nessuna libreria di routing, di ricerca, di date o di UI: su questa scala non
servono e peserebbero più di quello che risolvono.

## Comandi

```bash
npm install

npm run dev        # sviluppo su http://localhost:5173
npm run dev:phone  # https sulla rete locale, per provare dall'iPhone
npm run build      # build di produzione (verifica i dati, poi compila)
npm run preview    # prova il build

npm test           # 176 test su dati, ricerca, calendario, import e condivisione

npm run ingest     # dataset grezzo -> public/data (serve il dataset)
npm run verify     # controlli di integrità sui dati generati
npm run media      # GIF/JPG -> WebP in media-build/ (~1 minuto)
```

## Dati

Il catalogo arriva da [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
(dati sotto licenza MIT), che va clonato a parte e trattato in sola lettura.
Di default `tools/ingest.mjs` lo cerca in `D:/exercises-dataset`, altrimenti
`npm run ingest -- --src <percorso>`.

La ingestion produce tre file in `public/data`, versionati nella repo così il
build in CI non ha bisogno del dataset:

- `catalog.json` — 1.324 esercizi in formato compatto, solo italiano
- `taxonomy.json` — filtri con etichetta italiana e conteggi
- `canonical.json` — termine italiano → esercizio preciso, per l'import
- `meta.json` — provenienza e attribuzione

Cosa succede in ingestion, e perché:

- si usano gli `instruction_steps.it` e non `instructions.it`: il testo unico
  ha due record con frasi rimaste in inglese, gli step sono puliti su tutti
- si buttano le altre 9 lingue: 16 MB diventano 980 KB
- si butta `category`, identico a `body_part` su tutti e 1.324 i record
- i muscoli doppi del dataset vengono unificati (`traps`/`trapezius`,
  `lats`/`latissimus dorsi`, `quads`/`quadriceps`…)
- i 4 nomi con mojibake (`sled 45в°`) vengono corretti
- i 6 nomi duplicati vengono disambiguati con il suffisso `v. 2`
- per ogni esercizio si precalcola un blob di ricerca con nome inglese, alias
  italiani e etichette tradotte: è quello che fa funzionare la ricerca in
  italiano senza tradurre i 1.324 nomi

I nomi degli esercizi restano in inglese, che è come si chiamano in palestra.
Il vocabolario italiano sta in `tools/dictionary.mjs`, scritto a mano.

## Media — leggere prima di pubblicare

Le animazioni e le miniature sono **© Gym visual** (gymvisual.com). Il dataset
di origine le ridistribuisce grazie a un permesso concesso al suo autore:
clonare quella repo non trasferisce alcun diritto, e per usarle in un proprio
progetto va ottenuta una licenza propria da Gym visual.

Per questo i media **non stanno in questa repo**. `npm run media` li converte
in `media-build/` (39 MB di animazioni + 3,3 MB di miniature, da 128,7 MB di
GIF originali), che va pubblicata come repo separata. L'app li carica da
`VITE_MEDIA_BASE` e **funziona lo stesso se quella variabile è vuota**,
mostrando i segnaposto: staccare i media è questione di una variabile
d'ambiente, non di codice. L'attribuzione è visibile ovunque compaiano.

In sviluppo, Vite serve `media-build/` su `/media-local` (vedi
`.env.development`): si lavora con i media veri senza pubblicarli.

## Import

Testo incollato, CSV, JSON e foto. Il parser del testo legge i formati che si
usano davvero (`Panca piana 4x8 60kg rec 90"`, `3 x 10 @ 80`, `4xmax`,
`3x30s`), e i nomi vengono riconosciuti su tre livelli: traduzione canonica
scritta a mano per i termini più usati (`panca piana` È quella col bilanciere,
e lo decide una tabella, non un punteggio), nome inglese identico, punteggio
per token con tolleranza ai refusi. Quello che resta incerto passa per una
riga di conferma con i tre candidati migliori — un esercizio sbagliato non
entra mai in scheda di nascosto.

L'OCR delle foto è opzionale e sta dietro un bottone: Tesseract pesa una
quindicina di megabyte scaricati da CDN al primo uso, e su una scheda scritta
a penna resta meno affidabile della trascrizione a mano. Il percorso
principale è fotografare e ricopiare i nomi, che il matcher completa.

## Promemoria degli allenamenti

Il caso d'uso è iPhone, dove il web non può programmare notifiche per conto
proprio: niente background sync, niente notifiche a tempo, e Web Push
richiederebbe un server acceso più l'app installata sulla Home.

Quindi il promemoria lo dà il **Calendario di iOS**: l'app esporta le sessioni
pianificate in un file `.ics` con l'avviso incorporato e identificativi
stabili, così riesportare aggiorna gli eventi invece di duplicarli. Arriva
anche con l'app chiusa, senza rete, e funziona identico per chiunque riceva il
link. Dentro l'app restano gli avvisi locali (fine recupero, riepilogo
all'apertura), sonori: iOS non concede la vibrazione al web.

## Nota su iOS e i dati

Safari cancella i dati dei siti non aperti da 7 giorni. Una PWA aggiunta alla
schermata Home ne è esente, ed è anche l'unico modo di avere schermo intero e
Wake Lock. Per questo il primo avvio spiega come installarla, con le
istruzioni giuste per il telefono che si ha in mano: dove il browser offre
l'evento `beforeinstallprompt` c'è un vero bottone, su iOS Safari si spiega a
parole dov'è il pulsante Condividi, e chi è già in standalone non vede niente.

Il backup è l'altra metà: senza account non c'è nessun recupero lato server,
quindi sta in evidenza nella pagina «I tuoi dati» e non in fondo a un menu.

## Licenze

- Codice di questa repo: MIT
- Dati degli esercizi: MIT (exercises-dataset)
- Font Archivo e IBM Plex: SIL Open Font License 1.1
- **Media degli esercizi: © Gym visual**, non coperti dalle licenze qui sopra
  (vedi sopra)
- Logo The Beest: dell'autore dell'app
