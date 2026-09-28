#!/usr/bin/env node
// Genera dai JSON del CMS tutto ciò che deve esistere come HTML/testo statico
// per crawler che non eseguono JavaScript (GPTBot, ClaudeBot, PerplexityBot...):
// testi in index.html, JSON-LD, <noscript>, llms.txt, llms-full.txt, sitemap.xml.
// Il sito resta senza build step: questo script gira nella GitHub Action
// (.github/workflows/seo-build.yml) e in locale con `node scripts/build-seo.mjs`.
// È idempotente: riscrive un file solo se il contenuto cambia.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const warnings = [];
const warn = (m) => warnings.push(m);

const readText = (f) => readFileSync(join(ROOT, f), "utf8");
const readJSON = (f) => (existsSync(join(ROOT, f)) ? JSON.parse(readText(f)) : {});
const changed = [];
function writeIfChanged(f, content) {
  const p = join(ROOT, f);
  if (existsSync(p) && readFileSync(p, "utf8") === content) return;
  writeFileSync(p, content);
  changed.push(f);
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Il contenuto arriva dal CMS: "<" nel JSON-LD è escapato per impedire di chiudere il tag <script>.
const jsonLd = (o) => JSON.stringify(o, null, 2).replace(/</g, "\\u003c");

// ── Dati ────────────────────────────────────────────────────────────────
const g = readJSON("generale.json");
const hero = readJSON("hero.json");
const intro = readJSON("intro.json");
const corsi = readJSON("corsi.json");
const orari = readJSON("orari.json");
const contatti = readJSON("contatti.json");
const galleria = readJSON("galleria.json");
const testi = readJSON("testimonianze.json");
const rating = readJSON("rating.json");

let site;
try {
  site = new URL(g.url_sito || "https://yoga-bari.pages.dev");
  if (site.protocol !== "https:") throw new Error("serve https");
} catch (e) {
  console.error(`✖ generale.json → url_sito non valido (${e.message}). Build SEO interrotta: nessun file modificato.`);
  process.exit(1);
}
const BASE = site.origin;
const HOME = `${BASE}/`;
const OG_IMAGE = `${BASE}/assets/img/og-cover.png`;
const NOME = g.nome_studio || "Il Fenicottero ASD";
const visibile = (sec) => sec.visibile !== false;

function commitDate() {
  try {
    return execSync("git log -1 --format=%cs", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
const LASTMOD = commitDate();

// ── Parser dei campi liberi del CMS ────────────────────────────────────
// "Corso Sonnino 148 — Bari, BA 70121"
function parseIndirizzo(str) {
  if (!str) return null;
  const parts = str.split(" — ");
  const addr = { "@type": "PostalAddress", streetAddress: (parts[0] || str).trim(), addressCountry: "IT" };
  if (parts[1]) {
    const m = parts[1].trim().match(/^(.+?),\s*([A-Z]{2})\s*(\d{5})?$/);
    if (m) {
      addr.addressLocality = m[1].trim();
      addr.addressRegion = m[2];
      if (m[3]) addr.postalCode = m[3];
    } else {
      addr.addressLocality = parts[1].trim();
    }
  }
  return addr;
}

const DAYS = [
  ["lun", "Monday"], ["mar", "Tuesday"], ["mer", "Wednesday"], ["gio", "Thursday"],
  ["ven", "Friday"], ["sab", "Saturday"], ["dom", "Sunday"],
];
const pad = (n) => String(n).padStart(2, "0");

// "Lun–Ven 07:00–22:00 · Sab 08:00–14:00" → OpeningHoursSpecification.
// Se anche un solo segmento non è riconosciuto restituisce null: meglio nessun
// orario strutturato che uno sbagliato su Google Maps.
function parseOrariApertura(str) {
  if (!str) return null;
  const re = /^\s*(lun|mar|mer|gio|ven|sab|dom)[a-zì]*\.?\s*(?:[–—-]\s*(lun|mar|mer|gio|ven|sab|dom)[a-zì]*\.?)?\s+(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})\s*$/i;
  const specs = [];
  for (const seg of str.split(/[·;|]/)) {
    if (!seg.trim()) continue;
    const m = seg.match(re);
    if (!m) { warn(`orari_apertura: segmento non riconosciuto "${seg.trim()}" — openingHoursSpecification omesso`); return null; }
    const a = DAYS.findIndex(([k]) => k === m[1].toLowerCase());
    const b = m[2] ? DAYS.findIndex(([k]) => k === m[2].toLowerCase()) : a;
    const days = [];
    for (let i = a; ; i = (i + 1) % 7) { days.push(DAYS[i][1]); if (i === b) break; }
    specs.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days,
      opens: `${pad(+m[3])}:${m[4]}`,
      closes: `${pad(+m[5])}:${m[6]}`,
    });
  }
  return specs.length ? specs : null;
}

const minutes = (s) => { const m = String(s || "").match(/(\d+)/); return m ? +m[1] : null; };
const socials = [g.social_fb, g.social_ig, g.social_yt].filter((u) => u && u !== "#");

// ── JSON-LD ─────────────────────────────────────────────────────────────
const addr = parseIndirizzo(g.indirizzo);
const business = {
  "@type": "ExerciseGym",
  "@id": `${HOME}#business`,
  name: NOME,
  description: hero.descrizione || g.slogan || undefined,
  url: HOME,
  image: OG_IMAGE,
  telephone: g.whatsapp ? `+${g.whatsapp}` : undefined,
  email: g.email || undefined,
  slogan: g.slogan || undefined,
  address: addr || undefined,
  areaServed: addr?.addressLocality ? { "@type": "City", name: addr.addressLocality } : undefined,
  openingHoursSpecification: parseOrariApertura(g.orari_apertura) || undefined,
  sameAs: socials.length ? socials : undefined,
  knowsAbout: ["Yoga Iyengar", ...(visibile(corsi) ? (corsi.lista || []).map((c) => c.nome) : [])],
};
const lat = Number(g.latitudine), lng = Number(g.longitudine);
if (g.latitudine !== undefined && g.longitudine !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) {
  business.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
}

const title = `Yoga a Bari | ${NOME} — Scuola di Yoga Iyengar`;
const graph = [
  business,
  { "@type": "WebSite", "@id": `${HOME}#website`, url: HOME, name: NOME, inLanguage: "it-IT", publisher: { "@id": business["@id"] } },
  { "@type": "WebPage", "@id": `${HOME}#webpage`, url: HOME, name: title, inLanguage: "it-IT", isPartOf: { "@id": `${HOME}#website` }, about: { "@id": business["@id"] } },
];
if (visibile(corsi)) {
  (corsi.lista || []).forEach((c) => {
    const min = minutes(c.durata);
    graph.push({
      "@type": "Course",
      name: c.nome,
      description: c.descrizione,
      inLanguage: "it",
      educationalLevel: c.livello || undefined,
      provider: { "@id": business["@id"] },
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "onsite",
        courseWorkload: min ? `PT${min}M` : undefined,
        location: { "@id": business["@id"] },
      },
    });
  });
}
const ldBlock = `<script type="application/ld+json" id="ldJson">\n${jsonLd({ "@context": "https://schema.org", "@graph": graph })}\n</script>`;

// ── Orari (raggruppati per giorno) ──────────────────────────────────────
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const orariPerGiorno = GIORNI.map((giorno) => ({
  giorno,
  slot: (orari.lista || []).filter((o) => o.giorno === giorno).sort((a, b) => String(a.ora).localeCompare(String(b.ora))),
})).filter((d) => d.slot.length);

// ── <noscript>: contenuto per chi non esegue JS ─────────────────────────
function noscriptBlock() {
  const out = [];
  out.push(`<section id="contenuto-statico" style="padding:3rem 1.5rem;max-width:960px;margin:0 auto;font-family:sans-serif;line-height:1.7">`);
  out.push(`<h2>${esc(NOME)} — Yoga Iyengar a ${esc(addr?.addressLocality || "Bari")}</h2>`);
  [intro.para1, intro.para2].filter(Boolean).forEach((p) => out.push(`<p>${esc(p)}</p>`));
  if (intro.nota) out.push(`<p><strong>${esc(intro.nota)}</strong></p>`);
  if (visibile(corsi) && corsi.lista?.length) {
    out.push(`<h2>${esc([corsi.titolo1, corsi.titolo2].filter(Boolean).join(" "))}</h2><ul>`);
    corsi.lista.forEach((c) => {
      const det = [c.livello, c.durata, c.max ? `max ${c.max} partecipanti` : ""].filter(Boolean).join(", ");
      out.push(`<li><strong>${esc(c.nome)}</strong> (${esc(det)}) — ${esc(c.descrizione || "")}</li>`);
    });
    out.push(`</ul>`);
  }
  if (visibile(orari) && orariPerGiorno.length) {
    out.push(`<h2>${esc([orari.titolo1, orari.titolo2].filter(Boolean).join(" "))}</h2><ul>`);
    orariPerGiorno.forEach((d) => {
      out.push(`<li><strong>${d.giorno}</strong>: ${d.slot.map((s) => `${esc(s.ora)} ${esc(s.corso)}${s.insegnante ? ` (con ${esc(s.insegnante)})` : ""}`).join("; ")}</li>`);
    });
    out.push(`</ul>`);
  }
  if (visibile(contatti)) {
    out.push(`<h2>${esc([contatti.titolo1, contatti.titolo2].filter(Boolean).join(" "))}</h2>`);
    if (contatti.testo) out.push(`<p>${esc(contatti.testo)}</p>`);
    out.push(`<address>`);
    if (g.indirizzo) out.push(`${esc(g.indirizzo)}<br>`);
    if (g.whatsapp) out.push(`Telefono / WhatsApp: <a href="https://wa.me/${esc(g.whatsapp)}">+${esc(g.whatsapp)}</a><br>`);
    if (g.email) out.push(`Email: <a href="mailto:${esc(g.email)}">${esc(g.email)}</a><br>`);
    if (g.orari_apertura) out.push(`Orari: ${esc(g.orari_apertura)}`);
    out.push(`</address>`);
  }
  out.push(`</section>`);
  return `<noscript>\n${out.join("\n")}\n</noscript>`;
}

// ── index.html ──────────────────────────────────────────────────────────
function setById(html, id, value) {
  if (typeof value !== "string" || !value.trim()) return html;
  const re = new RegExp(`(<([a-z0-9]+)\\b[^>]*\\sid="${id}"[^>]*>)([\\s\\S]*?)(</\\2>)`);
  if (!re.test(html)) { warn(`index.html: elemento id="${id}" non trovato`); return html; }
  return html.replace(re, (_m, open, _t, _i, close) => open + esc(value) + close);
}
function replaceBlock(html, name, content) {
  const re = new RegExp(`(<!-- SEO:${name}:START -->)[\\s\\S]*?(<!-- SEO:${name}:END -->)`);
  if (!re.test(html)) throw new Error(`marker SEO:${name} mancante in index.html`);
  return html.replace(re, (_m, a, b) => `${a}\n${content}\n${b}`);
}
function setAttr(html, tagRe, attr, value) {
  const re = new RegExp(`(${tagRe}[^>]*?\\s${attr}=")[^"]*(")`);
  if (!re.test(html)) { warn(`index.html: tag ${tagRe} non trovato`); return html; }
  return html.replace(re, (_m, a, b) => a + esc(value) + b);
}

let html = readText("index.html");
const texts = {
  siteTitle: title,
  navNome: NOME, footerNome: NOME,
  navScuola: g.nav_scuola, navCorsiLbl: g.nav_corsi, navOrariLbl: g.nav_orari, navGalleriaLbl: g.nav_galleria, navContattiLbl: g.nav_contatti,
  heroT1: hero.titolo1, heroT2: hero.titolo2, heroSub: hero.sub, heroDesc: hero.descrizione, heroClaim: hero.citazione, heroBtn: hero.btn_testo,
  introT1: intro.titolo1, introT2: intro.titolo2, introPara1: intro.para1, introPara2: intro.para2, introBtnTxt: intro.btn_wa, introNota: intro.nota,
  corsiLabel: corsi.sec_label, corsiT1: corsi.titolo1, corsiT2: corsi.titolo2,
  orariLabel: orari.sec_label, orariT1: orari.titolo1, orariT2: orari.titolo2,
  galleriaLabel: galleria.sec_label, galleriaT1: galleria.titolo1, galleriaT2: galleria.titolo2,
  testiLabel: testi.sec_label, testiT1: testi.titolo1, testiT2: testi.titolo2,
  ratingTesto: rating.testo,
  contattiLabel: contatti.sec_label, contattiT1: contatti.titolo1, contattiT2: contatti.titolo2, contattiTesto: contatti.testo,
};
for (const [id, v] of Object.entries(texts)) html = setById(html, id, v);

html = setAttr(html, `<link rel="canonical"`, "href", HOME);
html = setAttr(html, `<meta property="og:url"`, "content", HOME);
html = setAttr(html, `<meta property="og:image"`, "content", OG_IMAGE);
html = setAttr(html, `<meta name="twitter:image"`, "content", OG_IMAGE);
html = replaceBlock(html, "JSONLD", ldBlock);
html = replaceBlock(html, "NOSCRIPT", noscriptBlock());
writeIfChanged("index.html", html);

// ── sitemap.xml e robots.txt ────────────────────────────────────────────
writeIfChanged(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${HOME}</loc>\n    <lastmod>${LASTMOD}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`
);
if (existsSync(join(ROOT, "robots.txt"))) {
  const robots = readText("robots.txt");
  writeIfChanged("robots.txt", robots.replace(/^Sitemap:.*$/m, `Sitemap: ${BASE}/sitemap.xml`));
}

// ── llms.txt / llms-full.txt (spec llmstxt.org) ─────────────────────────
// Di proposito NON includono punteggi/recensioni/testimonianze: sono contenuti
// autodichiarati non verificabili, e le AI li ripeterebbero come fatti.
const citta = addr?.addressLocality || "Bari";
const corsiNomi = visibile(corsi) ? (corsi.lista || []).map((c) => c.nome) : [];
const summary = `Scuola di Yoga Iyengar a ${citta}${g.indirizzo ? ` (${g.indirizzo.replace(" — ", ", ")})` : ""}.${corsiNomi.length ? ` Corsi: ${corsiNomi.join(", ")}.` : ""}${intro.nota ? ` ${intro.nota}.` : ""}`;

const llms = [
  `# ${NOME}`,
  ``,
  `> ${summary}`,
  ``,
  `## Sito`,
  `- [Home page](${HOME}): presentazione della scuola e del metodo Iyengar`,
  visibile(corsi) ? `- [Corsi](${HOME}#corsi): discipline, livelli, durata e numero massimo di partecipanti` : null,
  visibile(orari) ? `- [Orari](${HOME}#orari): programmazione settimanale delle lezioni` : null,
  visibile(contatti) ? `- [Contatti](${HOME}#contatti): indirizzo, telefono, email e orari di apertura` : null,
  ``,
  `## Approfondimenti`,
  `- [Tutte le informazioni in testo semplice](${BASE}/llms-full.txt): corsi, orari settimanali e contatti in un unico file`,
  ``,
].filter((l) => l !== null).join("\n");
writeIfChanged("llms.txt", llms);

const full = [`# ${NOME}`, ``, `> ${summary}`, ``, `Ultimo aggiornamento: ${LASTMOD}. Fonte: ${HOME}`, ``];
if (intro.para1 || intro.para2) {
  full.push(`## La scuola`, ``, ...[intro.para1, intro.para2].filter(Boolean).flatMap((p) => [p, ``]));
}
if (visibile(corsi) && corsi.lista?.length) {
  full.push(`## Corsi`, ``);
  corsi.lista.forEach((c) => {
    full.push(`### ${c.nome}`, `- Livello: ${c.livello || "n.d."}`, `- Durata: ${c.durata || "n.d."}`, `- Partecipanti massimi: ${c.max || "n.d."}`, `- ${c.descrizione || ""}`, ``);
  });
}
if (visibile(orari) && orariPerGiorno.length) {
  full.push(`## Orari settimanali delle lezioni`, ``);
  orariPerGiorno.forEach((d) => full.push(`- ${d.giorno}: ${d.slot.map((s) => `${s.ora} ${s.corso}${s.insegnante ? ` (con ${s.insegnante})` : ""}`).join("; ")}`));
  full.push(``);
}
full.push(`## Contatti`, ``);
if (g.indirizzo) full.push(`- Indirizzo: ${g.indirizzo}`);
if (g.whatsapp) full.push(`- Telefono / WhatsApp: +${g.whatsapp}`);
if (g.email) full.push(`- Email: ${g.email}`);
if (g.orari_apertura) full.push(`- Orari di apertura: ${g.orari_apertura}`);
socials.forEach((u) => full.push(`- Social: ${u}`));
full.push(``);
writeIfChanged("llms-full.txt", full.join("\n"));

// ── Esito ───────────────────────────────────────────────────────────────
warnings.forEach((w) => console.warn(`⚠ ${w}`));
console.log(changed.length ? `✔ Aggiornati: ${changed.join(", ")}` : "✔ Nessuna modifica necessaria");
