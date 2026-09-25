# 🚀 GUIDA SETUP — Il Fenicottero ASD su Cloudflare

> Stack attuale: **Cloudflare Pages** (hosting) + **Sveltia CMS** (pannello admin) +
> **Cloudflare Worker** (proxy OAuth GitHub) + **GitHub** (repository e storage contenuti).
> Il repository, il sito e il Worker sono **già creati e live** — questa guida serve come
> riferimento per ricostruire/riconfigurare il setup se necessario, e per capire come
> intervenire su ciascun pezzo.

## Cosa ottieni
- Sito live su `yoga-bari.pages.dev` (o dominio custom, vedi STEP 5)
- Pannello admin all'indirizzo `tuosito.com/admin`
- Il cliente aggiorna testi, foto, orari, video e visibilità delle sezioni dal browser — nessun codice
- Ogni salvataggio pubblica un commit su GitHub → Cloudflare Pages fa deploy automatico in ~1 minuto

---

## STEP 1 — Repository GitHub (già fatto)

Repo: `lucaiolienrico/yoga-bari`, branch `main`, **Private**.

Per un nuovo progetto analogo:
1. **github.com** → **New repository** → nome a scelta → **Private**
2. Carica i file del progetto

---

## STEP 2 — Cloudflare Pages (già fatto)

Il progetto Pages `yoga-bari` **non è collegato a Git**. Al suo posto, `_worker.js` (Pages "advanced mode") serve ogni richiesta leggendo il file corrispondente da `raw.githubusercontent.com/lucaiolienrico/yoga-bari/main`:

- ogni salvataggio dal CMS (= commit su `main`) è live in ~5 minuti, **senza nessun deploy**
- il repo deve restare **pubblico** (altrimenti raw.githubusercontent non è leggibile)
- `_worker.js` imposta anche Content-Type, header di sicurezza e blocca `worker/`, `SETUP.md`, dotfile
- **solo se modifichi `_worker.js` stesso** serve ridistribuire Pages (direct upload o `wrangler pages deploy . --project-name yoga-bari`)

`_redirects` e `_headers` restano nel repo ma con `_worker.js` attivo non vengono usati da Pages — la logica equivalente è dentro `_worker.js`.

---

## STEP 3 — GitHub OAuth App + Cloudflare Worker (già fatto)

Sveltia CMS ha bisogno di autenticarsi su GitHub per scrivere sul repo. Non usa più Netlify Identity: usa un **Cloudflare Worker come proxy OAuth**.

1. **GitHub** → Settings → Developer settings → **OAuth Apps** → **New OAuth App**
   - Homepage URL: `https://<pages-project>.pages.dev`
   - Authorization callback URL: `https://<worker-name>.<account>.workers.dev/callback`
2. Copia **Client ID** e genera un **Client Secret**
3. **Cloudflare** → **Workers & Pages** → **Create** → **Worker** → nome a scelta (es. `yoga-bari-oauth`)
4. Deploy del codice in `worker/worker.js` (via `wrangler deploy` da dentro `worker/`, o Quick Edit da dashboard)
5. Imposta le secrets (da CLI con `wrangler login`, oppure via API Cloudflare `PUT .../workers/scripts/yoga-bari-oauth/secrets`):
   ```bash
   cd worker
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET
   ```
6. `worker/wrangler.toml` contiene solo config non sensibile (nome, compatibility date) — **mai** mettere client id/secret in chiaro lì

Il Worker gestisce anche la protezione anti-CSRF sul login (parametro `state` in cookie HttpOnly) e limita i CORS al dominio del sito — vedi commenti in `worker/worker.js`.

**Deploy automatico del Worker (Workers Builds):** il Worker è collegato al repo; ogni push su `main` esegue `npx wrangler deploy` con **root directory `/worker`**. ⚠️ Non riportare mai la root directory a `/`: nella root non c'è `wrangler.toml`, e wrangler pubblicherebbe l'intero sito statico al posto del codice OAuth — `/auth` diventa 404 e le secrets vengono perse. È esattamente il bug che ha impedito il login dal 27 agosto al 25 settembre 2026.

**Formato del messaggio a Sveltia CMS:** il popup deve inviare `{ token, refreshToken? }`, non la risposta grezza di GitHub (`access_token`) — Sveltia controlla la chiave `token` e altrimenti considera il login fallito.

---

## STEP 4 — Invita il cliente come collaboratore GitHub

Non esiste più un sistema di inviti separato (era Netlify Identity). L'accesso al pannello admin è governato dai **permessi del repository GitHub**: chiunque acceda con successo via OAuth ottiene un token che Sveltia usa per chiamare le API GitHub — se quell'utente non ha permessi di scrittura sul repo, i salvataggi falliscono.

1. **GitHub** → repo `yoga-bari` → **Settings** → **Collaborators** → **Add people**
2. Inserisci l'username o l'email GitHub del cliente
3. Il cliente accetta l'invito ricevuto via email
4. Da quel momento il cliente accede a `tuosito.com/admin`, fa login con GitHub e può salvare

---

## STEP 5 — Configura Sveltia CMS

`admin/config.yml` — già configurato per questo repo:
```yaml
backend:
  name: github
  repo: lucaiolienrico/yoga-bari
  branch: main
  base_url: https://yoga-bari-oauth.lucaiolienrico.workers.dev
  auth_endpoint: /auth
```

Per un nuovo progetto, aggiorna `repo` e `base_url` con i tuoi valori, poi committa. Il sito rilegge sempre `admin/config.yml` a ogni caricamento del pannello — nessun rebuild extra necessario oltre al deploy automatico di Cloudflare Pages.

---

## STEP 6 — Dominio personalizzato (opzionale)

1. Cloudflare Pages → progetto → **Custom domains** → **Set up a custom domain**
2. Inserisci il dominio (es. `ilfenicottero.it`)
3. Se il dominio è già su Cloudflare: attivazione automatica. Altrimenti configura i DNS indicati dal pannello presso il tuo registrar
4. ✅ HTTPS gratuito automatico

Dopo il cambio dominio, aggiorna anche:
- `site_url` / `display_url` in `admin/config.yml`
- `url_sito` in `generale.json`
- `og:url`, `<link rel="canonical">` e Homepage URL della OAuth App in `index.html`
- Sitemap (`sitemap.xml`) e `robots.txt`
- **`ALLOWED_ORIGIN` in `worker/worker.js`** — è hardcoded al dominio attuale per limitare i CORS (vedi STEP 3). Se non lo aggiorni e ridistribuisci con `wrangler deploy`, il pannello admin aperto dal nuovo dominio non riesce più a fare login (CORS bloccato dal browser)

---

## Come usa il pannello il cliente

```
1. Vai su: tuosito.com/admin
2. Accedi con GitHub (pulsante "Login with GitHub")
3. Scegli la sezione da modificare (testi, foto, video, orari, contatti...)
4. Modifica i campi nel form — incluso il toggle "👁️ Mostra sezione sul sito"
   per nascondere/mostrare intere sezioni senza intervento tecnico
5. Clicca "Publish" (o "Save draft" per salvare senza pubblicare)
6. Il sito si aggiorna in circa 1 minuto (build automatica Cloudflare Pages)
```

---

## Struttura file del progetto

```
yoga-bari/
├── _worker.js           ← Pages: serve il sito live dal branch main (vedi STEP 2)
├── index.html           ← sito pubblico (legge i JSON, popola meta tag e JSON-LD)
├── robots.txt            ← direttive crawler + link alla sitemap
├── sitemap.xml            ← sitemap SEO
├── _redirects            ← regole di routing Cloudflare Pages (/admin, fallback SPA)
├── _headers               ← security headers Cloudflare Pages
├── admin/
│   ├── index.html         ← pannello CMS (Sveltia)
│   └── config.yml         ← definisce le collezioni/campi editabili
├── generale.json          ← nome studio, contatti, social, label menu
├── hero.json               ← titolo, sottotitolo, foto hero
├── intro.json                ← testo "pace interiore", foto disciplina
├── corsi.json                 ← le discipline offerte
├── orari.json                  ← planner settimanale
├── galleria.json                ← foto e video (YouTube/Vimeo)
├── testimonianze.json            ← recensioni allievi
├── rating.json                    ← punteggi Google, Facebook ecc.
├── contatti.json                   ← testi sezione contatti
└── worker/
    ├── worker.js                    ← proxy OAuth GitHub (auto-deploy da main, vedi STEP 3)
    └── wrangler.toml                 ← config Worker (nessun segreto)
```

Ogni file JSON di sezione ha un campo `visibile` (boolean) che nasconde l'intera sezione dal sito se impostato a `false` dal pannello.

---

## Costi

| Voce | Costo |
|------|-------|
| Cloudflare Pages hosting | **GRATIS** |
| Cloudflare Worker (piano free, 100k richieste/giorno) | **GRATIS** |
| GitHub (repo privato) | **GRATIS** |
| Sveltia CMS | **GRATIS, open source** |
| Dominio `.it` | ~€10-15/anno (Aruba, Register.it, o via Cloudflare Registrar) |

---

## Supporto

- Cloudflare Pages docs: https://developers.cloudflare.com/pages
- Cloudflare Workers docs: https://developers.cloudflare.com/workers
- Sveltia CMS docs: https://github.com/sveltia/sveltia-cms
- GitHub OAuth Apps docs: https://docs.github.com/apps/oauth-apps
