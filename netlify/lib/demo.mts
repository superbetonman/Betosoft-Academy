import { createHash, randomBytes } from "node:crypto"
import type { Context } from "@netlify/functions"
import { db, UUID } from "./db.mts"
import { aangemeld, leesDemo, zetDemo } from "./sessie.mts"

/**
 * Demo enkel na registratie (migratie 013). demoPoort() staat voor elke demo (NL en FR):
 *  - aangemeld (cursist, onderneming, beheer): gewoon door;
 *  - ?toegang=<link uit de mail>: cookie zetten en door naar dezelfde pagina zonder de link;
 *  - geldig demo-cookie: bezoek noteren en door;
 *  - anders: het formulier (naam, e-mail, telefoon, onderneming).
 */
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex")
export const nieuwToken = () => randomBytes(24).toString("base64url")
const LINK_DAGEN = 30

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

async function bezoek(id: string, code: string) {
  const r = await db()`
    UPDATE demo_bezoekers SET bezoeken = bezoeken + 1, laatst_bezocht_op = now(), bevestigd_op = coalesce(bevestigd_op, now()),
      cursussen_bekeken = CASE WHEN ${code} = ANY(cursussen_bekeken) THEN cursussen_bekeken ELSE cursussen_bekeken || ${code}::text END
    WHERE id = ${id} RETURNING id`
  return r.length > 0
}

export async function demoPoort(req: Request, context: Context, code: string, taal: "nl" | "fr", titel: string): Promise<Response | null> {
  if (await aangemeld(context)) return null
  const url = new URL(req.url)
  const tok = url.searchParams.get("toegang")
  if (tok) {
    const [r] = await db()`SELECT id FROM demo_bezoekers WHERE token_hash = ${hashToken(tok)} AND aangevraagd_op > now() - make_interval(days => ${LINK_DAGEN})`
    if (r) {
      zetDemo(context, r.id)
      await bezoek(r.id, code)
      url.searchParams.delete("toegang")
      return new Response(null, { status: 302, headers: { location: url.pathname + url.search, "cache-control": "private, no-store" } })
    }
    return formulier(code, taal, titel, true)
  }
  const id = leesDemo(context)
  if (id && UUID.test(id) && (await bezoek(id, code))) return null
  return formulier(code, taal, titel, false)
}

const T = {
  nl: {
    lang: "nl-BE", thuis: "/", titel: "Bekijk de demo", sub: (t: string) => `Demo · ${t}`,
    uitleg: "Vul je gegevens in. Je krijgt meteen een persoonlijke link om de demo te openen. Die link werkt 30 dagen; daarna blijft de demo 90 dagen open in deze browser.",
    verlopen: "Deze link is niet meer geldig. Vraag hieronder een nieuwe aan.",
    naam: "Naam en voornaam", email: "E-mailadres", tel: "Telefoon (gsm)", org: "Onderneming (niet verplicht)",
    knop: "Stuur mij de link", bezig: "Even geduld…",
    privacy: "Betosoft gebruikt je gegevens om je toegang tot de demo te geven en je eventueel te contacteren over de cursus. We geven ze niet door.",
    al: "Heb je al een account?", aanmelden: "Aanmelden", aanmeldUrl: "/aanmelden/",
    mail: (e: string) => `<strong>Bekijk je mailbox.</strong> We stuurden een link naar ${e}. Geen mail binnen enkele minuten? Kijk bij ongewenste mail.`,
    fout: "Het versturen lukte niet. Probeer het opnieuw.",
  },
  fr: {
    lang: "fr-BE", thuis: "/fr/", titel: "Voir la démo", sub: (t: string) => `Démo · ${t}`,
    uitleg: "Indiquez vos coordonnées. Vous recevez tout de suite un lien personnel pour ouvrir la démo. Ce lien est valable 30 jours ; ensuite, la démo reste ouverte 90 jours dans ce navigateur.",
    verlopen: "Ce lien n'est plus valable. Demandez-en un nouveau ci-dessous.",
    naam: "Nom et prénom", email: "Adresse e-mail", tel: "Téléphone (GSM)", org: "Entreprise (facultatif)",
    knop: "Envoyez-moi le lien", bezig: "Un instant…",
    privacy: "Betosoft utilise vos données pour vous donner accès à la démo et, le cas échéant, vous contacter au sujet de la formation. Nous ne les transmettons pas.",
    al: "Vous avez déjà un compte ?", aanmelden: "Se connecter", aanmeldUrl: "/fr/connexion/",
    mail: (e: string) => `<strong>Consultez votre boîte mail.</strong> Nous avons envoyé un lien à ${e}. Pas de mail dans quelques minutes ? Regardez dans les indésirables.`,
    fout: "L'envoi a échoué. Réessayez.",
  },
}

function formulier(code: string, taal: "nl" | "fr", titel: string, verlopen: boolean) {
  const t = T[taal]
  const terug = taal === "fr" ? `/fr/demo/${code}/` : `/demo/${code}/`
  const html = `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.titel)} · ${esc(titel)} · Betosoft Academy</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script src="/thema.js"></script><link rel="stylesheet" href="/stijl.css"></head>
<body><header class="kop"><div class="kop-in"><a class="logo" href="${t.thuis}" aria-label="Betosoft Academy"><img src="/logo.svg" alt="" width="34" height="30"><span class="logo-tekst">Betosoft <em>Academy</em></span></a>
<div class="rechts"><a class="bknop" href="${t.aanmeldUrl}?terug=${encodeURIComponent(terug)}">${t.aanmelden}</a></div></div></header>
<main style="max-width:560px">
  <p class="label" style="margin-top:24px">${esc(t.sub(titel))}</p>
  <h1 style="margin-top:4px">${esc(t.titel)}</h1>
  ${verlopen ? `<div class="melding fout">${t.verlopen}</div>` : ""}
  <p>${t.uitleg}</p>
  <form id="demoform" novalidate>
    <label class="veld"><span class="label">${t.naam}</span><input name="naam" required maxlength="120" autocomplete="name"></label>
    <label class="veld"><span class="label">${t.email}</span><input name="email" type="email" required maxlength="254" autocomplete="email"></label>
    <label class="veld"><span class="label">${t.tel}</span><input name="telefoon" type="tel" required maxlength="30" autocomplete="tel" placeholder="0470 12 34 56"></label>
    <label class="veld"><span class="label">${t.org}</span><input name="onderneming" maxlength="160" autocomplete="organization"></label>
    <p class="klein zacht">${t.privacy}</p>
    <div class="knoppen"><button class="knop" type="submit">${t.knop}</button></div>
    <div id="demomelding" class="melding verborgen" role="status" style="margin-top:12px"></div>
  </form>
  <p class="klein zacht" style="margin-top:20px">${t.al} <a href="${t.aanmeldUrl}?terug=${encodeURIComponent(terug)}">${t.aanmelden}</a></p>
</main>
<script>
(function () {
  var f = document.getElementById("demoform"), m = document.getElementById("demomelding"), k = f.querySelector("button")
  f.addEventListener("submit", async function (e) {
    e.preventDefault()
    if (!f.reportValidity()) return
    k.disabled = true; var oud = k.textContent; k.textContent = ${JSON.stringify(t.bezig)}
    m.className = "melding verborgen"
    try {
      var d = Object.fromEntries(new FormData(f)); d.cursus = ${JSON.stringify(code)}; d.taal = ${JSON.stringify(taal)}
      var r = await fetch("/api/demo/aanvraag", { method: "POST", headers: { "content-type": "application/json", "x-academie": "1" }, body: JSON.stringify(d) })
      var j = await r.json().catch(function () { return {} })
      if (!r.ok) throw new Error(j.fout || ${JSON.stringify(t.fout)})
      if (j.url) { location.href = j.url; return }
      f.querySelectorAll("input,button").forEach(function (x) { x.disabled = true })
      m.className = "melding"; m.innerHTML = ${JSON.stringify(t.mail("__E__"))}.replace("__E__", d.email.replace(/[<>&"']/g, ""))
    } catch (err) {
      m.className = "melding fout"; m.textContent = err.message; k.disabled = false; k.textContent = oud
    }
  })
})()
</script>
<script src="/fout.js" type="module"></script></body></html>`
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex" } })
}
