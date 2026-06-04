# 🚀 GUIDA SETUP — Iyengar Yoga Bari su Netlify

## Cosa ottieni
- Sito live su dominio gratuito (es. `yoga-bari.netlify.app`) o dominio custom
- Pannello admin all'indirizzo `tuosito.com/admin`
- Il cliente aggiorna testi, foto, orari dal browser — nessun codice
- Ogni salvataggio aggiorna il sito live in ~30 secondi

---

## STEP 1 — Crea repository GitHub

1. Vai su **github.com** → crea account se non hai
2. Clicca **"New repository"**
3. Nome: `yoga-bari` (o simile)
4. Seleziona **Private**
5. Clicca **Create repository**
6. Carica tutti i file di questa cartella nel repository

---

## STEP 2 — Collega Netlify

1. Vai su **netlify.com** → crea account gratuito
2. Clicca **"Add new site"** → **"Import an existing project"**
3. Scegli **GitHub** → autorizza l'accesso
4. Seleziona il repository `yoga-bari`
5. **Build settings**: lascia tutto vuoto (sito HTML puro)
6. Clicca **"Deploy site"**
7. ✅ Sito live! Netlify ti dà un URL tipo `random-name.netlify.app`

---

## STEP 3 — Abilita Netlify Identity (login admin)

1. Nel dashboard Netlify → **Site configuration** → **Identity**
2. Clicca **"Enable Identity"**
3. Vai su **Registration** → seleziona **"Invite only"** (solo persone invitate possono registrarsi)
4. Clicca **"Save"**

---

## STEP 4 — Invita il cliente come admin

1. Sempre nella sezione Identity → **"Invite users"**
2. Inserisci l'email del cliente
3. Il cliente riceve email → clicca il link → imposta password
4. Da quel momento il cliente accede a `tuosito.com/admin` con quella password

---

## STEP 5 — Configura Decap CMS

1. Apri il file `admin/config.yml`
2. Trova questa riga:
   ```
   repo: TUO-USERNAME/yoga-bari
   ```
3. Sostituisci `TUO-USERNAME` con il tuo nome utente GitHub
4. Salva e carica il file su GitHub
5. Netlify fa deploy automatico in ~30 secondi

---

## STEP 6 — Collega dominio personalizzato (opzionale)

1. Netlify dashboard → **Domain management** → **Add custom domain**
2. Inserisci `iyengaryogabari.it` (o qualsiasi dominio)
3. Netlify ti mostra i DNS da configurare nel pannello del registrar (Aruba, GoDaddy ecc.)
4. Attendi propagazione DNS: 15 minuti — 24 ore
5. ✅ HTTPS gratuito automatico (Let's Encrypt)

---

## Come usa il pannello il cliente

```
1. Vai su: tuosito.com/admin
2. Accedi con email + password
3. Scegli la sezione da modificare (testi, foto, orari...)
4. Modifica i campi nel form
5. Clicca "Publish" (o "Save draft" per salvare senza pubblicare)
6. Il sito si aggiorna in ~30 secondi
```

---

## Struttura file del progetto

```
yoga-bari/
├── index.html          ← sito pubblico (legge i JSON)
├── netlify.toml        ← configurazione Netlify
├── admin/
│   ├── index.html      ← pannello CMS (Decap)
│   └── config.yml      ← definisce i campi editabili
├── _data/
│   ├── generale.json   ← nome studio, telefono, email, social
│   ├── hero.json       ← titolo, sottotitolo, foto hero
│   ├── intro.json      ← testo "pace interiore", foto disciplina
│   ├── corsi.json      ← 6 discipline
│   ├── orari.json      ← planner settimanale
│   ├── galleria.json   ← foto e video
│   ├── testimonianze.json
│   └── rating.json     ← punteggi Google, Facebook ecc.
└── assets/
    └── img/            ← foto caricate dal pannello admin
```

---

## Costi

| Voce | Costo |
|------|-------|
| Netlify hosting | **GRATIS** |
| Netlify Identity (fino a 1000 utenti) | **GRATIS** |
| GitHub | **GRATIS** |
| Decap CMS | **GRATIS** |
| Dominio `.it` | ~€10-15/anno (Aruba, Register.it) |

---

## Supporto

- Netlify docs: https://docs.netlify.com
- Decap CMS docs: https://decapcms.org/docs
