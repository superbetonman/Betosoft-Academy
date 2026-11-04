import type { Config, Context } from "@netlify/functions"
import { db } from "../lib/db.mts"
import { aangemeld, isBeheer } from "../lib/sessie.mts"
import { CURSUSCODE, magCursus, cursusInfo, type CursusInfo } from "../lib/cursustoegang.mts"

/**
 * Serveert de cursusapps uit de databank (tabel cursus_bestanden):
 *   /cursus/<CODE>/          volledige cursus, enkel na aanmelden en met toegang (beheerders altijd, als tester)
 *                            cursisten krijgen index.html (zonder opnamebriefings, AI-prompts en mediaplan),
 *                            beheerders beheer.html (met die productie-informatie)
 *   /cursus/<CODE>/m2.js     losse modulescripts van dezelfde cursus
 *   /demo/<CODE>/            publieke teaser (start + vier lessen uit verschillende modules; de rest zit niet in het bestand)
 * Een afgeleide cursus (BMC, BPB: kolom bron) krijgt de bestanden van haar bron (BMC-BPB) met een eigen configuratie:
 * haar code, haar modules (de app laat de andere weg via de filterhaak), haar titel, en de voortgang bij de bron.
 */

const CONFIG = /<script>window\.ACADEMIE=(\{[^<]*?\});<\/script>/
const escHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

/** De app van de bron, ingesteld voor een afgeleide cursus. Null als de app daar niet op voorzien is (geen filterhaak). */
function afgeleid(html: string, c: CursusInfo, product: string | null): string | null {
  const m = CONFIG.exec(html)
  if (!m || !html.includes("window.ACADEMIE_FILTER(")) return null
  const cfg = { ...JSON.parse(m[1]), cursus: c.code, gegevens: c.bron, modules: c.app_modules, meta: c.app_meta ?? undefined, product }
  let uit = html.replace(m[0], () => `<script>window.ACADEMIE=${JSON.stringify(cfg).replace(/</g, "\\u003c")};</script>`)
  const titel = typeof c.app_meta?.title === "string" ? c.app_meta.title : c.titel
  uit = uit.replace(/<title>[^<]*<\/title>/i, () => `<title>${escHtml(titel)}</title>`)
  // naam in de kopbalk van de app (<a class="brand" aria-label="Betosoft · …">…<b>naam</b>), als de app die heeft
  uit = uit.replace(/(<a class="brand"[^>]*?aria-label=")[^"]*(")/, (_, a, b) => `${a}Betosoft · ${escHtml(titel)}${b}`)
  uit = uit.replace(/(<a class="brand"[^>]*>(?:(?!<\/a>)[\s\S])*?<b>)[^<]*(<\/b>)/, (_, a, b) => `${a}${escHtml(c.titel)}${b}`)
  return uit
}

function pagina(titel: string, tekst: string, link: string, linkTekst: string, status: number) {
  const html = `<!doctype html><html lang="nl-BE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titel} · Betosoft Academy</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><script src="/thema.js"></script><link rel="stylesheet" href="/stijl.css"></head>
<body><header class="kop"><div class="kop-in"><a class="logo" href="/" aria-label="Betosoft Academy, startpagina"><img src="/logo.svg" alt="" width="34" height="30"><span class="logo-tekst">Betosoft <em>Academy</em></span></a></div></header>
<main style="max-width:640px"><h1 style="margin-top:24px">${titel}</h1><p>${tekst}</p><p><a class="knop" style="text-decoration:none;display:inline-flex;align-items:center" href="${link}">${linkTekst}</a></p></main>
<script src="/fout.js" type="module"></script></body></html>`
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } })
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url)
  const m = url.pathname.match(/^\/(cursus|demo)\/([A-Za-z0-9-]{1,20})(\/(.*))?$/)
  if (!m) return pagina("Niet gevonden", "Deze pagina bestaat niet.", "/#cursussen", "Naar de cursussen", 404)
  const soort = m[1]
  const code = m[2].toUpperCase()
  if (!CURSUSCODE.test(code)) return pagina("Niet gevonden", "Deze cursus bestaat niet.", "/#cursussen", "Naar de cursussen", 404)
  // zonder slash op het einde vinden de losse scripts (m2.js) hun weg niet
  if (m[3] === undefined || m[2] !== code) return Response.redirect(new URL(`/${soort}/${code}/`, url).toString(), 301)

  let pad = m[4] || ""
  let beheer = false
  let verborgen = false
  const c = await cursusInfo(code)
  if (soort === "demo") {
    if (pad !== "" && pad !== "index.html") return pagina("Niet in de demo", "Dit onderdeel zit in de volledige cursus.", `/demo/${code}/`, "Terug naar de demo", 404)
    pad = "demo.html"
    // Een cursus die niet op de startpagina staat (Beheer → Cursussen: niet tonen), heeft geen publieke demo; beheerders zien ze wel.
    // Een bron (BMC-BPB) staat altijd op "niet tonen".
    if (c?.startpagina === "niet_tonen") {
      if (!isBeheer(await aangemeld(context))) return pagina("Niet gevonden", "Voor deze cursus is er nog geen demo.", "/#cursussen", "Naar de cursussen", 404)
      verborgen = true
    }
  } else {
    if (pad === "") pad = "index.html"
    if (!/^(index\.html|m\d{1,2}\.js)$/.test(pad)) return pagina("Niet gevonden", "Dit onderdeel bestaat niet.", `/cursus/${code}/`, "Naar de cursus", 404)
    const g = await aangemeld(context)
    if (!g) {
      if (pad !== "index.html") return new Response("Niet aangemeld", { status: 401 })
      return Response.redirect(new URL(`/aanmelden/?terug=${encodeURIComponent(`/cursus/${code}/`)}`, url).toString(), 302)
    }
    beheer = isBeheer(g)
    if (!(await magCursus(g, code))) {
      if (c && !c.gepubliceerd)
        return c.startpagina === "voorbereiding"
          ? pagina("In voorbereiding", "Deze cursus is in voorbereiding. Je voortgang blijft bewaard.", "/leren/", "Naar mijn leerlijn", 403)
          : pagina("Tijdelijk offline", "Deze cursus staat tijdelijk offline. Je voortgang blijft bewaard.", "/leren/", "Naar mijn leerlijn", 403)
      return pagina(
        "Geen toegang tot deze cursus",
        "Je hebt nog geen toegang tot de volledige cursus. Bekijk de demo, of vraag toegang via je onderneming of via een inschrijving.",
        `/demo/${code}/`,
        "Naar de demo",
        403,
      )
    }
  }

  // beheerders: de versie met briefings en prompts, als die bestaat
  const paden = beheer && pad === "index.html" ? ["beheer.html", "index.html"] : [pad]
  const bestanden = c?.bron ?? code
  const rijen = await db()`SELECT pad, type, inhoud FROM cursus_bestanden WHERE cursus = ${bestanden} AND pad = ANY(${paden}::text[])`
  const b = paden.map((p) => rijen.find((r: any) => r.pad === p)).find(Boolean)
  if (!b) return pagina("Niet gevonden", soort === "demo" ? "Voor deze cursus is er nog geen demo." : "Deze cursus is nog niet beschikbaar.", "/#cursussen", "Naar de cursussen", 404)
  let inhoud: string = b.inhoud
  if (c?.bron && /html/.test(b.type)) {
    // in de demo: inschrijven op de volledige cursus (CRS-<code>), als die te koop is
    const [p] = soort === "demo" ? await db()`SELECT code FROM producten WHERE code = ${"CRS-" + code} AND product_te_koop(id)` : []
    const a = afgeleid(inhoud, c, p?.code ?? null)
    if (!a) return pagina("Tijdelijk niet beschikbaar", "Deze cursus wordt bijgewerkt. Probeer het later opnieuw.", soort === "demo" ? "/#cursussen" : "/leren/", "Terug", 503)
    inhoud = a
  }
  return new Response(inhoud, {
    headers: {
      "content-type": b.type,
      "cache-control": soort === "demo" && !verborgen ? "public, max-age=300" : "private, no-store",
      "x-robots-tag": soort === "demo" ? "noarchive" : "noindex, nofollow",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    },
  })
}

export const config: Config = {
  region: "fra",
  path: ["/cursus/*", "/demo/*"],
}
