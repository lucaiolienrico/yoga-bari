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

Il progetto Pages `yoga-bari` è collegato al repo GitHub **via integrazione Git nativa** (stessa autorizzazione GitHub App già usata per il Worker — vedi STEP 3, sezione Workers Builds). Funziona con **repo privata**: Cloudflare legge il codice con un accesso autenticato proprio, non serve nessun file pubblico.

- ogni push su `main` (compresi i salvataggi del CMS) fa auto-deploy in ~1 minuto
- build settings: framework preset "None", build command vuoto, output directory `/` (sito HTML statico puro, nessuna build da eseguire)
- `_redirects` e `_headers` nella root gestiscono redirect e security header — **Cloudflare Pages non legge `netlify.toml`**, solo questi due file

⚠️ **Non usare `_worker.js` in root per "servire" il sito da un repo pubblico** — è stato un tentativo (poi rimosso) che avrebbe reso necessario rendere pubblico un repo che deve restare privato. Con l'integrazione Git corretta non serve: Cloudflare clona il repo privato da solo a ogni deploy.

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

Dopo il cambio dominio:
- **`url_sito`** dal pannello CMS (Info Generali): la build SEO aggiorna da sola canonical, og:url, og:image, JSON-LD, sitemap, `llms*.txt`
- `Sitemap:` in `robots.txt` si aggiorna da solo; in `_headers` sostituisci `yoga-bari.pages.dev` nella regola delle anteprime
- `site_url` / `display_url` in `admin/config.yml` e Homepage URL della OAuth App GitHub
- **`ALLOWED_ORIGIN` in `worker/worker.js`** — è hardcoded al dominio attuale per limitare i CORS (vedi STEP 3). Se non lo aggiorni e ridistribuisci con `wrangler deploy`, il pannello admin aperto dal nuovo dominio non riesce più a fare login (CORS bloccato dal browser)
- **Cloudflare Web Analytics** — crea un nuovo sito per il nuovo host e sostituisci il token nello snippet in fondo a `index.html` (STEP 7)
- **Google Search Console** — aggiungi la nuova proprietà e riverifica (STEP 7)

---

## STEP 7 — Analytics e Google Search Console

### Analytics: Cloudflare Web Analytics (già attivo)
Scelto al posto di Google Analytics 4: **non usa cookie né dati personali**, quindi
non serve il banner di consenso (GA4 in Italia richiede consenso esplicito e il
Garante Privacy ha già sanzionato configurazioni non conformi). È gratuito.
- Sito registrato: host `yoga-bari.pages.dev` — account Cloudflare → **Analytics & Logs → Web Analytics**
- Snippet in fondo a `index.html` (`data-cf-beacon`): il token è pubblico per design, non è un segreto
- Metriche: visite, pagine, paesi, dispositivi, Core Web Vitals reali

### Google Search Console (da completare — serve l'account Google del titolare)
1. https://search.google.com/search-console → **Aggiungi proprietà** → tipo **Prefisso URL** → `https://yoga-bari.pages.dev/` (il tipo "Dominio" richiede DNS, non disponibile su `pages.dev`)
2. Metodo di verifica **Tag HTML**: copia il valore `content="..."` del meta tag proposto
3. Incolla in `index.html`, dentro `<head>`: `<meta name="google-site-verification" content="VALORE">` → commit → attendi il deploy → **Verifica**
   (deve stare nel codice statico, non iniettato da JS: il crawler di verifica non è affidabile con tag creati via script)
4. In Search Console → **Sitemap** → invia `sitemap.xml`
5. Con il dominio custom (STEP 6): crea una nuova proprietà e ripeti

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
├── index.html           ← sito pubblico (legge i JSON, popola meta tag e JSON-LD)
├── robots.txt            ← direttive crawler + link alla sitemap
├── sitemap.xml            ← GENERATO da scripts/build-seo.mjs (non modificare a mano)
├── llms.txt · llms-full.txt ← GENERATI: riassunto del sito in testo semplice per le AI
├── _redirects            ← regole di routing Cloudflare Pages (/admin)
├── _headers               ← security headers, CSP home, noindex admin/json/anteprime
├── scripts/build-seo.mjs  ← genera i file SEO/GEO dai JSON del CMS (vedi sotto)
├── assets/img/og-cover.png ← immagine anteprima social (WhatsApp/Facebook/Google)
├── .github/workflows/
│   └── seo-build.yml      ← lancia lo script ad ogni push su main (anche i salvataggi CMS)
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

**Build SEO/GEO (`scripts/build-seo.mjs`):** il sito è statico puro e tutto il
testo viene disegnato da JavaScript a partire dai JSON — ma i crawler delle AI
(GPTBot, ClaudeBot, PerplexityBot) **non eseguono JavaScript** e vedrebbero una
pagina vuota. Lo script (Node, zero dipendenze) legge i JSON del CMS e scrive
nell'HTML: testi di hero/intro/titoli, JSON-LD (`ExerciseGym` + `Course`,
orari di apertura strutturati), un blocco `<noscript>` con corsi/orari/contatti,
più `llms.txt`, `llms-full.txt`, `sitemap.xml` (con `<lastmod>`), canonical e
og:url/og:image. Gira nella GitHub Action `seo-build.yml` ad ogni push su `main`,
quindi ogni modifica del cliente dal CMS aggiorna da sola anche la parte SEO/GEO
(2 deploy ravvicinati: contenuto + file rigenerati). In locale: `node scripts/build-seo.mjs`.
Non pubblica di proposito punteggi/recensioni/testimonianze (contenuti
autodichiarati che le AI ripeterebbero come fatti). Se `url_sito` non è un
URL https valido lo script si ferma senza modificare nulla.

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
